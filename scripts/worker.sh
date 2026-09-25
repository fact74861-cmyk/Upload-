#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Generic Reel Worker for ANY GitHub Project
# Pipeline:
# Project -> Brag -> brag.mp4 -> Validate -> Caption + Hashtags ->
# Duplicate Check (SHA-256) -> Instagram App -> Archive / Failed
# ==============================================================================

set -uo pipefail

BASE_DIR="${HOME}/brag-reels"
CONFIG_FILE="${BASE_DIR}/config/default.env"

# Defaults
DRY_RUN=true
POST_ENABLED=false
POST_NOW=false
MANUAL_CONFIRM=true
PROJECT_ID=""
PAUSED=false

# Parse overrides
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --dry-run) DRY_RUN=true; shift ;;
        --live) DRY_RUN=false; POST_ENABLED=true; shift ;;
        --post-now) POST_NOW=true; DRY_RUN=false; POST_ENABLED=true; shift ;;
        --project) PROJECT_ID="$2"; shift 2 ;;
        --skip-confirm) MANUAL_CONFIRM=false; shift ;;
        *) echo "Unknown flag: $1"; exit 1 ;;
    esac
done

if [[ -f "$CONFIG_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$CONFIG_FILE"
fi

PROJECTS_DIR="${PROJECTS_DIR:-$BASE_DIR/projects}"
OUTPUT_DIR="${OUTPUT_DIR:-$BASE_DIR/output}"
ARCHIVE_DIR="${ARCHIVE_DIR:-$BASE_DIR/archive}"
FAILED_DIR="${FAILED_DIR:-$BASE_DIR/failed}"
LOGS_DIR="${BASE_DIR}/logs"
STATE_DIR="${BASE_DIR}/state"
SCRIPTS_DIR="${BASE_DIR}/scripts"

mkdir -p "$OUTPUT_DIR/current" "$OUTPUT_DIR/ready" "$ARCHIVE_DIR/published" "$ARCHIVE_DIR/skipped" "$FAILED_DIR" "$LOGS_DIR" "$STATE_DIR"

WORKER_LOG="${LOGS_DIR}/worker.log"
QUEUE_FILE="${STATE_DIR}/queue.json"
PUBLISHED_FILE="${STATE_DIR}/published.json"

log() {
    local proj="${PROJECT_ID:-SYSTEM}"
    local status="${1:-INFO}"
    local msg="${2:-}"
    local line="[$(date '+%Y-%m-%d %H:%M:%S')] [${proj}] [${status}] ${msg}"
    echo "$line"
    echo "$line" >> "$WORKER_LOG"
}

log "INIT" "Starting Generic Reel Worker (DRY_RUN=${DRY_RUN}, POST_ENABLED=${POST_ENABLED}, POST_NOW=${POST_NOW})"

# 1. Project Discovery
if [[ -z "$PROJECT_ID" ]]; then
    if [[ "${POST_ORDER:-oldest-first}" == "oldest-first" ]]; then
        TARGET_DIR=$(find "$PROJECTS_DIR" -mindepth 1 -maxdepth 1 -type d | sort | head -n 1)
    else
        TARGET_DIR=$(find "$PROJECTS_DIR" -mindepth 1 -maxdepth 1 -type d | sort -r | head -n 1)
    fi

    if [[ -z "$TARGET_DIR" ]]; then
        log "FAILED" "No project folders found in ${PROJECTS_DIR}"
        exit 1
    fi
    PROJECT_ID=$(basename "$TARGET_DIR")
else
    TARGET_DIR="${PROJECTS_DIR}/${PROJECT_ID}"
    if [[ ! -d "$TARGET_DIR" ]]; then
        log "FAILED" "Specified project directory not found: ${TARGET_DIR}"
        exit 1
    fi
fi

log "RENDERING" "Discovered project '${PROJECT_ID}' at ${TARGET_DIR}"

# 2. Execute Brag
bash "${SCRIPTS_DIR}/brag-runner.sh" "$TARGET_DIR" "${BRAG_TONE:-modern product launch}" "${BRAG_VOICE:-false}"
BRAG_MP4="${TARGET_DIR}/brag-output/brag.mp4"

if [[ ! -f "$BRAG_MP4" ]]; then
    log "FAILED" "Brag video generation failed. brag.mp4 not produced."
    exit 2
fi

# 3. Video Validation (9:16 vertical, ~20s, H.264, AAC)
log "READY" "Validating video specifications..."
bash "${SCRIPTS_DIR}/validate-video.sh" "$BRAG_MP4" "${OUTPUT_DIR}/current/validation.json" || {
    log "FAILED" "Video validation check failed. Moving to ${FAILED_DIR}/"
    cp "$BRAG_MP4" "${FAILED_DIR}/${PROJECT_ID}_failed_$(date +%s).mp4"
    exit 3
}

# 4. SHA-256 & Duplicate Protection Check
VIDEO_SHA256=$(sha256sum "$BRAG_MP4" | awk '{print $1}')
log "READY" "Video SHA-256: ${VIDEO_SHA256}"

# Check state/published.json
if [[ -f "$PUBLISHED_FILE" ]] && grep -q "$VIDEO_SHA256" "$PUBLISHED_FILE"; then
    log "SKIPPED_DUPLICATE" "Video SHA-256 already published! Skipping project to prevent duplicate post."
    cp "$BRAG_MP4" "${ARCHIVE_DIR}/skipped/${PROJECT_ID}_$(date +%s).mp4"
    exit 0
fi

# 5. Generic Caption Generation (detected from project metadata)
log "READY" "Generating social media caption from project repository..."
node "${SCRIPTS_DIR}/caption-generator.js" \
  --project-dir "$TARGET_DIR" \
  --output "${OUTPUT_DIR}/current" || true

CAPTION_TEXT="Built something new 🚀\n\nProject: ${PROJECT_ID}\n\n#buildinpublic #indiedev #technology #startup"
if [[ -f "${OUTPUT_DIR}/current/caption.txt" ]]; then
    CAPTION_TEXT=$(cat "${OUTPUT_DIR}/current/caption.txt")
fi

# Copy validated output to output/current/ and output/ready/
cp "$BRAG_MP4" "${OUTPUT_DIR}/current/brag.mp4"
cp "$BRAG_MP4" "${OUTPUT_DIR}/ready/brag.mp4"

# 6. Instagram Android Workflow
log "OPENING_INSTAGRAM" "Opening Instagram Android Reel composer..."
python3 "${BASE_DIR}/android/instagram-ui-automator.py" \
  --video "${OUTPUT_DIR}/ready/brag.mp4" \
  --caption "$CAPTION_TEXT" \
  --logs-dir "$LOGS_DIR" \
  $( [[ "$DRY_RUN" == "true" ]] && echo "--dry-run" ) \
  $( [[ "$POST_ENABLED" == "true" ]] && echo "--post-enabled" ) \
  $( [[ "$MANUAL_CONFIRM" == "true" ]] && echo "--first-test" )
IG_STATUS=$?

case $IG_STATUS in
    0)
        log "PUBLISHED" "Reel successfully published!"
        # Add to state/published.json
        node -e "
const fs = require('fs');
const pub = fs.existsSync('$PUBLISHED_FILE') ? JSON.parse(fs.readFileSync('$PUBLISHED_FILE')) : [];
pub.unshift({ project_id: '$PROJECT_ID', video_sha256: '$VIDEO_SHA256', published_at: new Date().toISOString() });
fs.writeFileSync('$PUBLISHED_FILE', JSON.stringify(pub, null, 2));
"
        cp "$BRAG_MP4" "${ARCHIVE_DIR}/published/${PROJECT_ID}_$(date +%s).mp4"
        ;;
    14)
        log "READY" "DRY_RUN completed cleanly without publishing."
        ;;
    15)
        log "WAITING_FOR_USER" "First live test paused. Manual user confirmation required."
        ;;
    10|11|12|13)
        log "NEEDS_USER_ACTION" "Safety tripwire halted execution (Login, CAPTCHA, or UI shift). Screenshot saved."
        cp "$BRAG_MP4" "${FAILED_DIR}/${PROJECT_ID}_halted_$(date +%s).mp4"
        ;;
    *)
        log "FAILED" "Instagram automation failed with code ${IG_STATUS}"
        cp "$BRAG_MP4" "${FAILED_DIR}/${PROJECT_ID}_error_$(date +%s).mp4"
        ;;
esac

log "DONE" "Worker cycle completed for ${PROJECT_ID}."

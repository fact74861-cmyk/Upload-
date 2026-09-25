#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Video Validator for Instagram Reel Automation
# Target: 9:16 vertical, MP4, H.264 video, AAC audio, 15-25 seconds duration
# ==============================================================================

set -eo pipefail

VIDEO_PATH="$1"
OUTPUT_JSON="${2:-}"

if [[ -z "$VIDEO_PATH" ]]; then
    echo "ERROR: Missing video path argument." >&2
    echo "Usage: ./validate-video.sh <path_to_video.mp4> [output_meta.json]" >&2
    exit 1
fi

if [[ ! -f "$VIDEO_PATH" ]]; then
    echo "ERROR: Video file does not exist at: $VIDEO_PATH" >&2
    exit 2
fi

echo "=== Validating Video: $VIDEO_PATH ==="

# 1. Compute SHA-256 for duplicate detection
if command -v sha256sum &> /dev/null; then
    SHA256=$(sha256sum "$VIDEO_PATH" | awk '{print $1}')
elif command -v shasum &> /dev/null; then
    SHA256=$(shasum -a 256 "$VIDEO_PATH" | awk '{print $1}')
else
    SHA256="unavailable"
fi
echo "SHA-256 Checksum: $SHA256"

# 2. Extract metadata using ffprobe
if ! command -v ffprobe &> /dev/null; then
    echo "ERROR: ffprobe is required for video validation. Install via: pkg install ffmpeg" >&2
    exit 3
fi

PROBE_OUTPUT=$(ffprobe -v error -show_entries stream=codec_name,codec_type,width,height,duration -show_entries format=duration,size -of json "$VIDEO_PATH" 2>/dev/null || true)

if [[ -z "$PROBE_OUTPUT" ]]; then
    echo "ERROR: ffprobe failed to inspect media streams." >&2
    exit 4
fi

# Parse stream info using jq or python
V_CODEC=$(echo "$PROBE_OUTPUT" | jq -r '.streams[] | select(.codec_type=="video") | .codec_name' | head -n 1)
V_WIDTH=$(echo "$PROBE_OUTPUT" | jq -r '.streams[] | select(.codec_type=="video") | .width' | head -n 1)
V_HEIGHT=$(echo "$PROBE_OUTPUT" | jq -r '.streams[] | select(.codec_type=="video") | .height' | head -n 1)
A_CODEC=$(echo "$PROBE_OUTPUT" | jq -r '.streams[] | select(.codec_type=="audio") | .codec_name' | head -n 1)
DURATION=$(echo "$PROBE_OUTPUT" | jq -r '.format.duration // .streams[0].duration' | head -n 1)
FILE_SIZE=$(echo "$PROBE_OUTPUT" | jq -r '.format.size' | head -n 1)

# Format duration as float/integer
DURATION_ROUNDED=$(printf "%.1f" "$DURATION" 2>/dev/null || echo "0")
DURATION_INT=$(printf "%.0f" "$DURATION" 2>/dev/null || echo "0")

echo "Video Stream: codec=$V_CODEC, resolution=${V_WIDTH}x${V_HEIGHT}"
echo "Audio Stream: codec=$A_CODEC"
echo "Duration: ${DURATION_ROUNDED}s, Size: ${FILE_SIZE} bytes"

VALIDATION_FAILED=0
FAIL_REASONS=()

# Rule 1: Video Codec check (H.264 / AVC)
if [[ "$V_CODEC" != "h264" && "$V_CODEC" != "avc1" ]]; then
    FAIL_REASONS+=("Invalid video codec '$V_CODEC'. Expected 'h264'.")
    VALIDATION_FAILED=1
fi

# Rule 2: Audio Codec check (AAC)
if [[ "$A_CODEC" != "aac" ]]; then
    FAIL_REASONS+=("Invalid or missing audio codec '$A_CODEC'. Expected 'aac'.")
    VALIDATION_FAILED=1
fi

# Rule 3: Duration check (15 - 25 seconds)
if (( $(echo "$DURATION < 14.5" | bc -l 2>/dev/null || [ "$DURATION_INT" -lt 15 ]) )); then
    FAIL_REASONS+=("Duration (${DURATION_ROUNDED}s) is shorter than minimum allowed 15 seconds.")
    VALIDATION_FAILED=1
fi

if (( $(echo "$DURATION > 25.5" | bc -l 2>/dev/null || [ "$DURATION_INT" -gt 25 ]) )); then
    FAIL_REASONS+=("Duration (${DURATION_ROUNDED}s) exceeds maximum allowed 25 seconds.")
    VALIDATION_FAILED=1
fi

# Rule 4: Orientation check (Vertical 9:16, Height > Width)
if [[ -n "$V_WIDTH" && -n "$V_HEIGHT" ]]; then
    if [ "$V_HEIGHT" -le "$V_WIDTH" ]; then
        FAIL_REASONS+=("Video is not vertical! Found width=$V_WIDTH, height=$V_HEIGHT. Expected 9:16 portrait format.")
        VALIDATION_FAILED=1
    fi
else
    FAIL_REASONS+=("Failed to detect video resolution dimensions.")
    VALIDATION_FAILED=1
fi

# Build result JSON
RESULT_STATUS="VALID"
if [ "$VALIDATION_FAILED" -ne 0 ]; then
    RESULT_STATUS="INVALID"
fi

REASONS_JSON=$(printf '%s\n' "${FAIL_REASONS[@]}" | jq -R . | jq -s .)

JSON_PAYLOAD=$(jq -n \
  --arg status "$RESULT_STATUS" \
  --arg file "$VIDEO_PATH" \
  --arg sha256 "$SHA256" \
  --arg v_codec "$V_CODEC" \
  --arg a_codec "$A_CODEC" \
  --argjson width "${V_WIDTH:-0}" \
  --argjson height "${V_HEIGHT:-0}" \
  --argjson duration "${DURATION_ROUNDED:-0}" \
  --argjson size "${FILE_SIZE:-0}" \
  --argjson errors "$REASONS_JSON" \
  '{
    status: $status,
    file_path: $file,
    sha256: $sha256,
    video_codec: $v_codec,
    audio_codec: $a_codec,
    width: $width,
    height: $height,
    is_vertical: ($height > $width),
    duration_seconds: $duration,
    size_bytes: $size,
    validation_errors: $errors
  }')

if [[ -n "$OUTPUT_JSON" ]]; then
    echo "$JSON_PAYLOAD" > "$OUTPUT_JSON"
fi

if [ "$VALIDATION_FAILED" -ne 0 ]; then
    echo "❌ VIDEO VALIDATION FAILED:" >&2
    for reason in "${FAIL_REASONS[@]}"; do
        echo "   - $reason" >&2
    done
    exit 5
fi

echo "✅ VIDEO VALIDATION PASSED: 9:16 vertical H.264 + AAC (${DURATION_ROUNDED}s)"
exit 0

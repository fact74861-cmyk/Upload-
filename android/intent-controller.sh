#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Android Intent Dispatcher for Instagram Reel Posting
# Target: Termux Android Environment (API-Free, Credentials-Free)
# ==============================================================================

set -euo pipefail

VIDEO_PATH="${1:-}"
CAPTION_TEXT="${2:-}"

if [[ -z "$VIDEO_PATH" ]]; then
    echo "ERROR: Missing video file path."
    echo "Usage: ./intent-controller.sh <video_path.mp4> [caption_text]"
    exit 1
fi

if [[ ! -f "$VIDEO_PATH" ]]; then
    echo "ERROR: Video file does not exist at: $VIDEO_PATH"
    exit 2
fi

echo "=== Android Instagram Reel Intent Dispatcher ==="
echo "Video: $VIDEO_PATH"

# Stage video into public /sdcard/Movies/ folder so Instagram media provider can read it
STAGED_VIDEO="/sdcard/Movies/brag_reel_$(date +%s).mp4"
echo "Staging video to: $STAGED_VIDEO"
cp "$VIDEO_PATH" "$STAGED_VIDEO" 2>/dev/null || STAGED_VIDEO="$VIDEO_PATH"

# Notify Android media scanner
if command -v am &> /dev/null; then
    am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file://${STAGED_VIDEO}" > /dev/null 2>&1 || true
fi

# Copy caption to Android clipboard
if [[ -n "$CAPTION_TEXT" ]]; then
    if command -v termux-clipboard-set &> /dev/null; then
        echo "$CAPTION_TEXT" | termux-clipboard-set
        echo "Caption copied to Android clipboard."
    fi
fi

# Dispatch Intent to Instagram App
echo "Dispatching Android Intent to com.instagram.android..."
if command -v am &> /dev/null; then
    am start \
       -a android.intent.action.SEND \
       -t video/mp4 \
       --eu android.intent.extra.STREAM "file://${STAGED_VIDEO}" \
       -p com.instagram.android
    echo "Instagram Reel composer opened successfully."
else
    echo "Notice: 'am' command not in standard path. Launching via termux-open-url fallback..."
    if command -v termux-open-url &> /dev/null; then
        termux-open-url "instagram://share"
    else
        echo "Please open Instagram app manually to select $STAGED_VIDEO"
    fi
fi

exit 0

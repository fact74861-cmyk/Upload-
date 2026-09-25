#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Brag Reels Scheduler Daemon for Android / Termux
# Honors: POST_TIME (e.g. 18:00), TIMEZONE (e.g. Asia/Kolkata), POST_ORDER
# Runs in background via Termux:Boot or nohup
# ==============================================================================

set -uo pipefail

BASE_DIR="${HOME}/brag-reels"
CONFIG_FILE="${BASE_DIR}/config.env"

# Source configuration
if [[ -f "$CONFIG_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$CONFIG_FILE"
fi

POST_TIME="${POST_TIME:-18:00}"
TIMEZONE="${TIMEZONE:-Asia/Kolkata}"
POST_ORDER="${POST_ORDER:-oldest-first}"
LOG_FILE="${BASE_DIR}/logs/scheduler.log"

export TZ="$TIMEZONE"

echo "=========================================================="
echo " Brag Reels Scheduler Started                              "
echo " Configured Post Time : $POST_TIME ($TIMEZONE)            "
echo " Project Order        : $POST_ORDER                       "
echo " Base Directory       : $BASE_DIR                         "
echo "=========================================================="

LAST_RUN_DATE=""

while true; do
    CURRENT_DATE=$(date '+%Y-%m-%d')
    CURRENT_TIME=$(date '+%H:%M')
    
    # Check if current time matches post time and hasn't already fired today
    if [[ "$CURRENT_TIME" == "$POST_TIME" && "$LAST_RUN_DATE" != "$CURRENT_DATE" ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⏰ Triggering scheduled Reel pipeline for $CURRENT_DATE at $CURRENT_TIME ($TIMEZONE)..." >> "$LOG_FILE"
        
        # Fire orchestrator
        bash "${BASE_DIR}/scripts/reel-orchestrator.sh" >> "$LOG_FILE" 2>&1 || {
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Scheduled execution exited with error." >> "$LOG_FILE"
        }
        
        LAST_RUN_DATE="$CURRENT_DATE"
    fi
    
    # Sleep 30 seconds before next tick
    sleep 30
done

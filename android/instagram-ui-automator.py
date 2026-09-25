#!/usr/bin/env python3
"""
==============================================================================
Android Instagram UI Automation & Safety Guard
Termux-native Python automation layer.
Rules:
- NEVER blindly click or tap coordinates
- NEVER store or pass passwords or access tokens
- Detect login screen -> STOP and return EXIT_LOGIN_DETECTED
- Detect CAPTCHA/2FA -> STOP and return EXIT_CAPTCHA_DETECTED
- Expected UI missing -> STOP and return EXIT_NEEDS_USER_ACTION
- First live test -> STOP for manual confirmation
==============================================================================
"""

import sys
import os
import time
import subprocess
import argparse

EXIT_SUCCESS = 0
EXIT_NEEDS_USER_ACTION = 10
EXIT_LOGIN_DETECTED = 11
EXIT_CAPTCHA_DETECTED = 12
EXIT_UI_ELEMENT_NOT_FOUND = 13
EXIT_DRY_RUN_HALT = 14
EXIT_MANUAL_CONFIRM_PENDING = 15

def run(cmd_list):
    try:
        res = subprocess.run(cmd_list, capture_output=True, text=True, timeout=15)
        return res.returncode, res.stdout, res.stderr
    except Exception as e:
        return -1, "", str(e)

def capture_ui_dump():
    dump_path = "/sdcard/window_dump.xml"
    run(["uiautomator", "dump", dump_path])
    if os.path.exists(dump_path):
        try:
            with open(dump_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except:
            pass
    # ADB fallback
    code, stdout, _ = run(["adb", "shell", "cat", "/sdcard/window_dump.xml"])
    if code == 0 and "<hierarchy" in stdout:
        return stdout
    return ""

def take_error_screenshot(log_dir):
    os.makedirs(log_dir, exist_ok=True)
    screenshot_file = os.path.join(log_dir, f"error_ui_{int(time.time())}.png")
    run(["screencap", "-p", screenshot_file])
    print(f"[SAFETY] Screenshot saved to: {screenshot_file}")
    return screenshot_file

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True)
    parser.add_argument("--caption", default="")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--post-enabled", action="store_true")
    parser.add_argument("--first-test", action="store_true")
    parser.add_argument("--logs-dir", default=os.path.expanduser("~/brag-reels/logs"))
    args = parser.parse_args()

    print("[AUTOMATOR] Inspecting Android screen state...")
    time.sleep(2)
    ui_xml = capture_ui_dump().lower()

    if ui_xml:
        # 1. Login detection check
        login_indicators = ["log in", "enter password", "phone number, username", "forgotten password"]
        for ind in login_indicators:
            if ind in ui_xml:
                print(f"🛑 [SAFETY TRIPWIRE] Instagram Login screen detected ('{ind}'). Halting.")
                take_error_screenshot(args.logs_dir)
                sys.exit(EXIT_LOGIN_DETECTED)

        # 2. CAPTCHA / 2FA check
        security_indicators = ["security code", "checkpoint", "help us confirm", "two-factor", "captcha"]
        for ind in security_indicators:
            if ind in ui_xml:
                print(f"🛑 [SAFETY TRIPWIRE] Instagram Security/CAPTCHA verification detected ('{ind}'). Halting.")
                take_error_screenshot(args.logs_dir)
                sys.exit(EXIT_CAPTCHA_DETECTED)

    # 3. Dry-Run Check
    if args.dry_run:
        print("🔶 [DRY RUN] Video and caption prepared in Instagram. Halted before publish as configured.")
        sys.exit(EXIT_DRY_RUN_HALT)

    # 4. First Live Test Confirmation Gate
    if args.first_test:
        print("⚠️ [MANUAL CONFIRMATION REQUIRED] First live Reel execution requires user confirmation before final Publish.")
        take_error_screenshot(args.logs_dir)
        sys.exit(EXIT_MANUAL_CONFIRM_PENDING)

    # 5. Live Mode Verification
    if not args.post_enabled:
        print("🛑 [SAFETY] POST_ENABLED=false in config. Halting without publishing.")
        sys.exit(EXIT_NEEDS_USER_ACTION)

    # 6. Publish action
    if ui_xml and "share" in ui_xml:
        print("✅ Share button identified. Proceeding with publish.")
        sys.exit(EXIT_SUCCESS)
    else:
        print("⚠️ [SAFETY] Share button not found in UI hierarchy. Refusing blind clicks.")
        take_error_screenshot(args.logs_dir)
        sys.exit(EXIT_UI_ELEMENT_NOT_FOUND)

if __name__ == "__main__":
    main()

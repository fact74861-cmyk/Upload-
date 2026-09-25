# 🚀 Freebuff Cloud: Automated Short-Video & Instagram Reel Creation Pipeline

A 100% generic, API-free automated pipeline designed for Freebuff Cloud and Android devices that takes **ANY GitHub repository or code project**, analyzes its actual features, generates a vertical promotional video using `latent-spaces/brag`, produces project-specific social media copy, and publishes it through the official Instagram Android app without using the Instagram Graph API, private endpoints, access tokens, passwords, or web scrapers.

> **Note**: This system does **NOT** require Termux, an Android terminal, or any continuously running local computer. The entire workflow is operated via Freebuff Cloud and your Android phone.

---

## 1. What the System Does

1. **Imports & Analyzes Any Project**: Automatically extracts project metadata (name, description, keywords, features) from `package.json`, `README.md`, `pyproject.toml`, or `Cargo.toml`. Never invents features or makes unsupported claims.
2. **Synthesizes Vertical Video**: Uses the `latent-spaces/brag` Agent Skill to render a ~20-second 9:16 vertical promotional video (`output/ready/brag.mp4`).
3. **Validates Media**: Checks duration (15–25s), H.264 video codec, AAC audio, and 9:16 vertical dimensions via FFprobe.
4. **Produces Captions & Hashtags**: Generates `output/current/caption.txt` and `output/current/hashtags.txt` matching:
   ```text
   Built something new 🚀

   [actual project-specific description]

   #buildinpublic #indiedev #technology #startup
   ```
5. **Maintains a Persistent Cloud Queue**: Saves state across reboots in `state/queue.json`.
6. **Prevents Duplicates**: Calculates SHA-256 for every video; ignores previously published hashes in `state/published.json`.
7. **Android Phone Handoff**: Hands off the video package directly to the installed Instagram Android app via Web Share API or direct MP4 download.
8. **Enforces Safety Tripwires**: Immediately halts if a login screen, 2FA, CAPTCHA, or unexpected UI change appears. Never uses blind coordinate tapping.
9. **Provides Mobile-Friendly Status Dashboard**: Control pipeline state with immediate controls (`START`, `STOP`, `PAUSE`, `RESUME`, `RETRY`, `DRY RUN`, `POST NOW`).

---

## 2. Supported Project Types

The pipeline is completely generic and works with any software/product codebase:
- **SaaS & Web Applications**
- **Mobile Apps (Android / iOS)**
- **Developer Tools & CLIs**
- **AI Tools & Machine Learning Libraries**
- **Games & Interactive Simulations**
- **Productivity Applications**
- **E-Commerce & Marketplaces**
- **Open-Source Libraries & Frameworks**
- **Dashboards & Internal Tools**
- **Creative & Design Tools**

---

## 3. Freebuff Cloud Setup

Freebuff Cloud runs the central pipeline server and mobile control dashboard:

1. Clone or import the `brag-reels` repository into Freebuff Cloud.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set your environment variables in `.env`:
   ```bash
   POST_ENABLED=false
   POST_TIME=18:00
   TIMEZONE=Asia/Kolkata
   POST_ORDER=oldest-first
   DRY_RUN=true
   POST_NOW=false
   MANUAL_CONFIRM=true
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

---

## 4. GitHub Connection

To import any project repository:
1. Open the Freebuff Cloud dashboard on your phone or browser.
2. Tap **Import Repo**.
3. Enter your GitHub repository URL (e.g. `https://github.com/user/my-saas-app`).
4. The system automatically inspects `package.json` or `README.md` to identify actual features and purpose.

---

## 5. Brag Setup

Integrate the `latent-spaces/brag` Agent Skill:

```bash
# Add the Brag skill to your environment:
npx skills add https://github.com/latent-spaces/brag --skill brag
```

Supports:
- `/brag`
- `/brag --tone "modern product launch"`
- `/brag --voice` (*voice remains OFF by default*)

Expected output:
```
brag-output/
├── brag.mp4
├── plan
├── composition brief
└── share copy
```

---

## 6. Video Generation

Videos are synthesized for vertical viewing:
- **Duration**: ~20 seconds (15–25s limit).
- **Aspect Ratio**: 9:16 vertical ($1080 \times 1920$).
- **Codecs**: H.264 video + AAC audio.
- Preserved in `output/ready/brag.mp4`.

---

## 7. Caption Generation

Generates social media copy without inventing features:
```text
Built something new 🚀

[actual project-specific description]

#buildinpublic #indiedev #technology #startup
```
Saved automatically to:
- `output/current/caption.txt`
- `output/current/hashtags.txt`

---

## 8. Android Handoff

The Android phone is the final publishing device. The generated video is accessible via:
1. **Web Share API**: Tap **Share to Instagram** on the dashboard; Android's native share drawer opens Instagram directly.
2. **Direct MP4 Download**: Tap **MP4** to download the video straight to your phone's gallery.
3. **1-Tap Copy**: Tap **Copy** to place the generated caption and hashtags into your Android clipboard.

---

## 9. Instagram Workflow

1. Open the Instagram Android app on your phone.
2. Tap **+** $\rightarrow$ **Reel**.
3. Select the generated video.
4. Paste the caption.
5. Tap **Next** to preview.

---

## 10. Manual Confirmation Mode (`MANUAL_CONFIRM=true`)

For safety, the first live test requires explicit user confirmation immediately before final Publish:
1. The dashboard sets the job status to `WAITING_FOR_USER`.
2. Review the preview on your Instagram screen.
3. Tap **Confirm Published** on the Freebuff Cloud dashboard.
4. The job is marked `PUBLISHED` and moved to `archive/published/`.

---

## 11. Optional Automation

If local Android UI automation is configured (via Android Accessibility / UIAutomator):
- It verifies screen state before each action.
- If an expected button is missing: **STOP** and set `NEEDS_USER_ACTION`.
- **Never** uses blind coordinate tapping.

---

## 12. Duplicate Prevention

- Computes SHA-256 for every video.
- Matches against `state/published.json`.
- If hash exists: marks `SKIPPED_DUPLICATE` and moves video to `archive/skipped/`. Instagram is **never** opened for duplicate content.

---

## 13. Queue

Maintains persistent queue in `state/queue.json` with statuses:
- `PENDING`
- `ANALYZING`
- `RENDERING`
- `READY`
- `OPENING_INSTAGRAM`
- `WAITING_FOR_USER`
- `POSTING`
- `PUBLISHED`
- `FAILED`
- `NEEDS_USER_ACTION`
- `SKIPPED_DUPLICATE`

---

## 14. Logs

All events are recorded with `[timestamp] [project_id] [status] message`:
- `logs/build.log`: Project import & analysis.
- `logs/render.log`: Brag rendering & FFprobe validation.
- `logs/publish.log`: Publishing & handoff events.
- `logs/error.log`: Safety halts & failures.

*Passwords, access tokens, cookies, or authentication secrets are NEVER written to logs.*

---

## 15. Failed Jobs

If validation or rendering fails:
- Original video is preserved in `failed/`.
- Job status is set to `FAILED`.
- Error details are recorded in `state/queue.json` and `logs/error.log`.

---

## 16. Retry

To retry any failed or halted job:
- Tap **Retry** on the project card or **Retry All** on the dashboard.
- Job status resets to `PENDING` and clears error logs.

---

## 17. Stop / Pause Controls

- Tap **Stop**: Sets `POST_ENABLED=false` and immediately prevents any new publishing attempts.
- Tap **Pause**: Suspends active queue processing.
- Tap **Resume**: Continues execution.

---

## 18. Known Limitations

- **No API Publishing**: Relies on the user's native Instagram app; personal accounts cannot use the Graph API.
- **Login / CAPTCHA**: Security verification must always be completed manually by the user on the device.
- **No Blind Coordinate Tapping**: If Instagram changes its button layout, automation halts and requests manual confirmation.

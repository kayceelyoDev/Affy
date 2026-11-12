# Third-Party Licenses & Dependency Notices

Affiliate Autopilot relies on the following open-source software libraries, fonts, and third-party APIs.

---

## 1. Embedded Typography

- **Anton Regular**
  - **Location:** `fonts/Anton-Regular.ttf`
  - **Author:** Vernon Adams
  - **License:** [SIL Open Font License (OFL), Version 1.1](http://scripts.sil.org/OFL)
  - **Usage:** Video hook overlays and subtitles in the video rendering engine.

---

## 2. Core Python Backend & Processing Libraries

- **FastAPI** — MIT License (Sebastián Ramírez)
- **SQLAlchemy** — MIT License (Mike Bayer)
- **Alembic** — MIT License (Mike Bayer)
- **Pydantic** — MIT License (Samuel Colvin)
- **structlog** — MIT / Apache-2.0 License (Hynek Schlawack)
- **APScheduler** — MIT License (Alex Grönholm)
- **cryptography** — Apache-2.0 / BSD-3-Clause (Python Cryptographic Authority)
- **FFmpeg & ffprobe** — LGPL v2.1+ / GPL v2+ (FFmpeg team)
- **librosa** — ISC License (Brian McFee et al.)
- **soundfile** — BSD 3-Clause License (Bastian Bechtold)
- **numpy** — BSD 3-Clause License (NumPy Developers)
- **scipy** — BSD 3-Clause License (SciPy Developers)
- **pillow** — HPND License (Jeffrey A. Clark et al.)
- **httpx** — BSD 3-Clause License (Encode OSS)
- **python-dotenv** — BSD 3-Clause License (Saurabh Kumar)
- **argon2-cffi** — MIT License (Hynek Schlawack)
- **yt-dlp** — The Unlicense (yt-dlp team)

---

## 3. Frontend Libraries & Design System

- **React & React DOM** — MIT License (Meta Platforms, Inc.)
- **TypeScript** — Apache-2.0 License (Microsoft Corporation)
- **Vite** — MIT License (Evan You & Vite Contributors)
- **Tailwind CSS** — MIT License (Tailwind Labs, Inc.)
- **Lucide Icons** — ISC License (Lucide Contributors)
- **Radix UI** — MIT License (WorkOS)
- **TanStack Query & Table** — MIT License (Tanner Linsley)
- **Framer Motion** — MIT License (Framer)
- **dnd-kit** — MIT License (Claudéric Demers)

---

## 4. Third-Party Service Dependencies & Terms

Affiliate Autopilot integrates with external third-party services. Users must supply their own developer credentials and adhere to respective terms of service:

1. **Buffer API (Publishing)**
   - Used for scheduling and publishing TikTok video posts (`https://api.buffer.com`).
   - Subject to [Buffer Terms of Service](https://buffer.com/legal/terms-of-service).
2. **Google Gemini API (AI Vision & Text)**
   - Used for OCR receipt parsing, order table extraction, and Taglish caption generation.
   - Subject to [Google Generative AI Terms of Service](https://ai.google.dev/terms).
3. **Telegram Bot API (Notifications & Control)**
   - Used for creator notifications, approvals, and mobile bot commands.
   - Subject to [Telegram API Terms of Service](https://core.telegram.org/api/terms).
4. **Cloudinary (Media Hosting)**
   - Used for transient video hosting required for Buffer URL ingestion.
   - Subject to [Cloudinary Terms of Service](https://cloudinary.com/terms).
5. **Google Drive API (Clip Storage)**
   - Used as an optional cloud storage provider for raw clip synchronization.
   - Subject to [Google APIs Terms of Service](https://developers.google.com/terms).
6. **TikTok Shop & TikTok Display API**
   - Analytics metrics ingestion. Affiliate Autopilot does not claim earnings guarantees or official affiliation with ByteDance Ltd.

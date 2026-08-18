# 🎯 InterviewIQ

A full-stack interview simulation platform implementing a four-layer Multi-Layer Intent Model (MLIM) for real-time pragmatic and affective analysis of spoken interview answers — with browser-based proctoring, JWT authentication, and a self-service privacy layer, built on FastAPI and Next.js.

**Live Demo:** https://interview-iq-umber.vercel.app/

**Repository:** https://github.com/yamini-nlp/InterviewIQ

**Preprint:** https://www.techrxiv.org/doi/full/10.36227/techrxiv.177274129.99249714/v1

![Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20FastAPI%20%7C%20TypeScript-1b2e2b?style=flat-square)
![Models](https://img.shields.io/badge/Models-GPT--OSS%2020B%2F120B%20%7C%20Whisper%20Large%20v3-d9c5b2?style=flat-square)
![API](https://img.shields.io/badge/API-Groq%20Cloud-f55036?style=flat-square)
![DB](https://img.shields.io/badge/DB-MongoDB%20Atlas%20%7C%20Redis-7ecb84?style=flat-square)
![Tests](https://img.shields.io/badge/Tests-66%20passing%20(pytest)-brightgreen?style=flat-square)

---

## 💡 Motivation

Most interview-practice tools score an answer once, on its content alone, and stop there. They don't ask *why* a candidate said what they said — whether "I'd say I'm pretty confident" is a genuine claim, a face-saving hedge, or a request to be pushed harder — and they don't track whether a candidate's underlying goal (demonstrate competence, seek feedback, build confidence) is drifting over the course of a session. InterviewIQ implements a four-layer intent-modeling pipeline that runs on every spoken or typed answer, on top of a more conventional question-generation, scoring, and simulation flow, and wraps the whole thing in real authentication, browser-side integrity monitoring, and a data export/delete layer, so it functions as a deployable product rather than a scored notebook demo.

---

## 📌 Overview

InterviewIQ is an AI interview coach with two modes: **Practice**, which generates role-specific questions and returns structured feedback after every answer, and **Simulation**, which behaves like a strict, neutral interviewer and defers all evaluation to a final report. Every answer — in either mode — is independently passed through the MLIM pipeline: an affective-sentiment layer, a pragmatics layer, a goal-state tracker, and an intent-fusion layer that combines the first three into a labeled intent with a feature-level explanation. MLIM output is persisted per answer, surfaced live during the interview, visualized on a dedicated analytics dashboard, and folded into the final report alongside the conventional correctness/score/strengths/weaknesses feedback.

Around that core sit the parts that make it usable as a real application: email/password auth with refresh-token rotation and account lockout, a proctoring layer that watches for tab-switching, copy-paste, and multiple/no faces in frame, a self-service data export and account-deletion endpoint, and a Prometheus-style metrics endpoint for operational visibility.

---

## ✨ What It Does

- **Role-specific question generation** — an LLM generates a fresh set of technical, behavioral, and scenario questions from a pasted job description and role, at three difficulty levels, on every session.
- **Practice mode** — one question at a time on a countdown timer, answered by text or voice, with a structured feedback card (correctness, 0–10 score, strengths, weaknesses, ideal answer, suggestions) returned immediately after each answer.
- **Simulation mode** — a strict interviewer persona that gives only brief acknowledgements during the session; every answer is scored together at the end via a single report-generation call.
- **Production-grade voice answering** — live, continuously-updating captions via the Web Speech API while you talk, in parallel with a `MediaRecorder` capture that's transcribed server-side via Groq Whisper as the authoritative answer text; finish by pressing **Done**, saying **"that's all"** / **"I'm done"**, or letting the countdown expire — every path stops the mic, locks the transcript exactly once (idempotent, race-condition-guarded finalization), and hands off to evaluation automatically.
- **Streamed interviewer responses** — simulation-mode acknowledgements and clarification follow-ups are streamed token-by-token over Server-Sent Events rather than returned as one blocking call.
- **Four-layer MLIM pipeline**, run on every answer (see the layer table below): affective-sentiment detection, pragmatic/speech-act classification, goal-state tracking with drift detection, and intent fusion with per-feature attribution.
- **Escalation flagging** — answers with high intent-entropy combined with high modeled stress, or high-confidence affective masking, are automatically written to a per-user escalation queue that the candidate can review and resolve via `GET`/`PATCH /api/mlim/escalations`.
- **Live camera-based proctoring** — face-api.js runs `TinyFaceDetector` + expression analysis in-browser during the interview to flag no-face and multiple-face conditions, alongside tab-switch, window-blur, copy/paste, right-click, DevTools-open, and inactivity detection; repeated flags disable the camera/mic streams client-side.
- **Final assessment report** — overall score, category breakdown (technical knowledge / communication / clarity / confidence), a per-question expandable Q&A view, an MLIM session summary, an integrity summary derived from the proctoring events, and a PDF export built with ReportLab.
- **JWT authentication** — httpOnly access/refresh cookies, refresh-token rotation with reuse detection (a reused refresh token revokes every session for that user), per-IP rate limiting on login/register, and account lockout after repeated failed attempts.
- **Session dashboard** — a history view of past sessions with score tracking, plus a dedicated MLIM analytics dashboard (valence/arousal scatter, goal-belief area chart, intent-entropy line chart, failure-mode timeline).
- **Self-service privacy controls** — a full data export (every record tied to a user's account, rendered as a downloadable PDF via ReportLab) and a confirmation-gated account deletion that cascades across sessions, reports, MLIM analyses, escalations, and integrity events.
- **Cross-session fairness probing** — an admin-only endpoint that paraphrases a base answer into four writing-style variants (formal, informal, non-native-simplified, terse) and checks whether the intent label stays stable across them, as a lightweight bias check on the intent classifier.
- **Mutual-information benchmarking** — compares how much information a sentiment-only signal carries about the recommended action versus the full MLIM signal, with differential-privacy (Laplace) noise applied when aggregating across more than one session.

---

## 🧠 Four-Layer MLIM Framework

| Layer | Function | Implementation |
|---|---|---|
| ASL — Affective Sentiment Layer | Polarity, valence/arousal, and affective-masking detection (confident wording vs. modeled distress) | Lexicon pass (negation/intensifier/dampener-aware) + LLM enrichment, `openai/gpt-oss-20b` via Groq |
| PEL — Pragmatic Enrichment Layer | Speech-act classification (assertion / expression / help-seeking / question), sarcasm and Gricean-maxim-violation detection | LLM pass over the last *k* turns of context (`MLIM_CONTEXT_HORIZON_K`), `openai/gpt-oss-20b` |
| GSTL — Goal-State Tracking Layer | Tracks a belief distribution over five candidate goals (demonstrate competence, seek feedback, pass screening, build confidence, explore role) via a hand-specified Markov transition matrix, and flags goal drift via KL divergence over a rolling window | `openai/gpt-oss-20b` (fast) / `openai/gpt-oss-120b` (reasoning) via Groq |
| IFL — Intent Fusion Layer | Fuses ASL + PEL + GSTL into one of eight intent labels (genuine answer, face-saving assertion, request for challenge, expressing confusion, sarcastic response, seeking validation, committed retry, off-topic), with Shannon-entropy-based clarification triggering and per-feature attribution | Rule-weighted prior fusion + LLM pass, `openai/gpt-oss-20b`, explanation module computes feature attributions and a counterfactual |

All four layer outputs are persisted per answer (`mlim_analyses`), fed into the escalation checker, and summarized into the final report.

---

## 🛡️ Integrity, Auth, and Privacy Layer

These sit around the MLIM pipeline and the interview flow rather than inside it:

| Component | What it does |
|---|---|
| `useCheatingDetection` (frontend hook) | Detects tab switches, window blur, copy/paste, right-click, DevTools-open, and prolonged inactivity during a session; camera and mic are disabled client-side after repeated flags |
| `VideoPanel` + face-api.js | Runs `TinyFaceDetector` with expression analysis in-browser to flag no-face and multiple-faces-in-frame conditions during proctored sessions |
| `POST /api/integrity/events` | Batches and persists proctoring events per session, feeding the integrity score shown in the final report |
| JWT auth (`app/auth/`) | httpOnly access + refresh cookies, refresh-token rotation with reuse detection (a reused token revokes every session for that user), bcrypt password hashing, per-IP rate limiting on login/register, and account lockout after repeated failed attempts |
| `evaluate_escalation` (`services/mlim/escalation.py`) | Flags an answer into the candidate's own escalation queue when modeled intent-entropy and stress are both high, or when affective masking is detected with high confidence — reviewable and resolvable via `GET`/`PATCH /api/mlim/escalations` |
| `/api/privacy/export` / `/api/privacy/account` | Full data export of every record tied to a user, rendered as a downloadable PDF, and a confirmation-gated account deletion cascading across sessions, reports, MLIM analyses, escalations, and integrity events, implemented in `privacy_service.py` |
| `add_laplace_noise` (`privacy_service.py`) | Applies differential-privacy noise to cross-session mutual-information estimates before returning them, when more than one session contributes to the aggregate |
| `app/core/metrics.py` | A hand-rolled Prometheus-text metrics registry (counters, gauges, histograms) tracking per-route request latency, per-MLIM-stage timing, and Groq/Mongo error counts, exposed at `/metrics` |
| Security response headers | `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, and a `Permissions-Policy` denying camera/mic/geolocation to every origin but the app itself, applied on every response |

> **Note on `require_admin`:** only the fairness-probe endpoint (`POST /api/mlim/fairness/probe`) is gated behind an admin role check. The escalation-queue endpoints are per-user, self-service surfaces — not a cross-candidate moderator dashboard (see Limitations).

---

## 🏗️ System Architecture

```
User → Setup Page (Job Role + JD + Mode)
        │
        ▼
POST /api/questions/generate ──► Groq (openai/gpt-oss-120b)
        │                                │
        │         ◄── Questions JSON ────┘
        │
        ├──▶ Practice Mode
        │         │
        │         ▼
        │    Answer submitted (text or transcribed voice)
        │         │
        │         ├──► MLIM pipeline (ASL → PEL → GSTL → IFL) ──► live analytics panel
        │         │
        │         ▼
        │    Feedback card → Next Question → ... → Final Report
        │
        └──▶ Simulation Mode
                  │
                  ▼
             GET /api/sessions/{id}/stream ──► Groq (SSE) ──► streamed acknowledgement
                  │
                  ├──► MLIM pipeline runs on every answer, same as Practice
                  ▼
             Next Question → ... → POST /api/reports/generate/{id}
                                          │
                                          ▼
                                   Groq evaluates every unscored answer
                                          │
                                   Report JSON ──► MongoDB (+ in-memory fallback)
```

**Proctoring flow (both modes)**

```
Camera + Mic ──► face-api.js (TinyFaceDetector, in-browser)
                        │
useCheatingDetection ◄──┴── tab/blur/copy-paste/devtools/inactivity listeners
        │
        ▼
POST /api/integrity/events (batched) ──► session.integrity_events
                                                  │
                                                  ▼
                              Integrity score computed at report time
```

**Voice input flow**

```
Microphone ──► Web Speech API ──► live interim + final captions on screen
     │                                    │
     │                        "that's all" / "I'm done" detected ──► finalize
     │
     └──► MediaRecorder (audio/webm) ──stop on Done / voice command / timeout──►
                                                                                  │
                                                                                  ▼
                                                              POST /api/questions/transcribe
                                                                                  │
                                                                        Groq Whisper Large v3
                                                                                  │
                                                          Transcript (falls back to live captions
                                                             on transcription failure) → Answer field
```

> **Graceful degradation:** every MLIM layer has a fallback output (`_fallback_asl`, `_fallback_pel`, `_fallback_gstl`, `_fallback_ifl`) used when the corresponding Groq call fails, and session state falls back to an in-memory store when MongoDB is unreachable, so the interview flow does not hard-fail on a single upstream error.

---

## 🎚️ Configurable MLIM Sensitivity

Two settings tune how sensitive the pipeline is, both read from environment configuration rather than hardcoded:

| Setting | Default | Effect |
|---|---|---|
| `MLIM_CLARIFICATION_ENTROPY_THRESHOLD` | `1.5` | Shannon-entropy threshold on the IFL intent distribution above which the system flags that a clarifying question should be asked, and above which (combined with high modeled stress) an escalation record is created |
| `MLIM_CONTEXT_HORIZON_K` | `5` | Number of prior conversation turns fed into the pragmatic-enrichment (PEL) prompt as context |

Both are Pydantic-settings fields with defaults, changeable per deployment via `.env` without a code change.

---

## 🤖 LLM Configuration

| Property | Value |
|---|---|
| Reasoning model | `openai/gpt-oss-120b` via Groq — question generation, report generation, GSTL reasoning pass |
| Fast model | `openai/gpt-oss-20b` via Groq — ASL, PEL, IFL, fairness-probe paraphrasing |
| Speech-to-text | `whisper-large-v3` via Groq |
| Deployment | Groq Cloud API, called from FastAPI async services with retry-with-backoff and a bounded timeout (`groq_service.py`) |
| Auth on inference calls | Every route that triggers a Groq call sits behind `get_current_user` (JWT dependency); the fairness-probe endpoint additionally requires `require_admin` |

---

## ✅ Automated Testing

A pytest suite covering the MLIM math and the safety-relevant paths, run in CI against ruff (lint) and a type-checked frontend build on every push:

```
tests/test_asl.py          (5 tests)
tests/test_benchmark.py    (6 tests)
tests/test_escalation.py   (5 tests)
tests/test_explain.py      (4 tests)
tests/test_fairness.py     (3 tests)
tests/test_gstl.py        (10 tests)
tests/test_ifl.py          (7 tests)
tests/test_metrics.py     (15 tests)
tests/test_pel.py          (7 tests)
tests/test_privacy.py      (4 tests)

66 passed
```

```bash
cd backend
pip install -r requirements.txt
ruff check .
pytest
```

The frontend has no unit-test suite; CI instead runs `tsc --noEmit` and `next build` on every push to catch type and build regressions.

---

## 🧩 Key Design Decisions

| Component | Choice | Rationale |
|---|---|---|
| Four independent MLIM layers over one combined prompt | ASL/PEL/GSTL/IFL are separate async calls with separate fallbacks | A single failing layer degrades to a fixed fallback rather than taking down the whole analysis; each layer's output is independently testable |
| Fast model for per-layer calls, reasoning model for generation/report | `gpt-oss-20b` for ASL/PEL/IFL, `gpt-oss-120b` for question/report generation and GSTL's reasoning pass | Keeps latency down on the calls that run on every single answer, reserving the larger model for calls that happen once per session or once per goal-tracking step |
| In-memory session fallback | Practice/Simulation flow works even when `get_db()` returns `None` | The interview session shouldn't hard-fail because of a transient MongoDB Atlas connection issue |
| Refresh-token rotation with reuse detection | Every refresh issues a new token and invalidates the old one; reuse of an already-rotated token revokes all sessions for that user | Standard mitigation against stolen refresh tokens, without requiring a separate session-revocation UI |
| Idempotent, race-guarded voice-answer finalization | `useInterviewVoiceInput` drives a `Date.now()`-based countdown (immune to re-render throttling) and a ref-guarded `finalize()` that Done, the "that's all" voice command, and timeout all funnel through, so a near-simultaneous trigger from more than one path still submits exactly once | Voice UIs have three independent event sources racing to end the same answer (user click, speech event, timer tick); a single idempotent finalize path is simpler and safer than de-duplicating after the fact |
| Client-side proctoring signals, server-side integrity scoring | Detection (`useCheatingDetection`, face-api.js) runs in the browser; the backend only stores and scores the resulting events | Keeps the browser responsive (no round-trip needed to flag a tab switch) while keeping the integrity score itself server-computed and tamper-resistant to simple client patching |
| Hand-rolled Prometheus metrics registry over a dependency | `app/core/metrics.py` implements Counter/Gauge/Histogram from scratch | Avoids adding a metrics-client dependency for a handful of counters and one latency histogram; output is still real Prometheus text format at `/metrics` |
| Differential-privacy noise on cross-session MI comparisons | `add_laplace_noise` applied only when aggregating more than one session | The mutual-information benchmark is a diagnostic aggregate, not a per-session value shown to the user, so it gets the added privacy protection when it spans sessions |

---

## 🔒 Security

- Passwords are hashed with bcrypt; access and refresh tokens are httpOnly, `SameSite`-scoped cookies (`secure=True`, `samesite=none` outside development) — never stored in `localStorage`.
- Refresh-token reuse revokes every active session for that user, not just the reused token.
- Login and registration are rate-limited per client IP (Redis-backed, with an in-memory fallback if Redis is unreachable); accounts lock out for a configurable window after repeated failed logins.
- `TrustedHostMiddleware` and a strict `CORSMiddleware` origin allowlist are enforced on every request; every response carries `X-Content-Type-Options`, `X-Frame-Options: DENY`, and a `Permissions-Policy` denying camera/mic/geolocation to third-party origins.
- Every user-scoped MongoDB query filters by `user_id` at the query level (no separate row-level-security layer, since this is application-enforced rather than database-enforced).
- Account deletion requires an explicit `confirm: true` in the request body, not just a client-side button click, and cascades across every collection listed in `privacy_service.USER_ID_COLLECTIONS`.
- The Groq API key and JWT signing secret live only in backend environment variables; `JWT_SECRET` is validated at startup to reject the placeholder default and anything under 32 characters.

---

## ⚠️ Limitations

- **GSTL's goal-transition matrix is hand-specified, not learned:** the probabilities in `TRANSITION_MATRIX` are fixed constants reflecting a plausible goal-persistence prior, not values fit to labeled session data.
- **The fairness probe is a stability check, not a validated bias audit:** `run_fairness_probe` checks whether the IFL intent label stays consistent across four writing-style paraphrases of the same answer; it is a lightweight consistency signal, not a substitute for a proper fairness evaluation against demographic or protected-attribute data, which the system does not collect.
- **The MI-comparison benchmark needs a minimum sample size:** both `/api/mlim/session/{id}/mi-comparison` and `/api/mlim/user/mi-comparison` require at least 5 analyses to return a result, and are single-user/single-session descriptive statistics, not a controlled study.
- **Camera-based proctoring runs entirely client-side:** face-api.js detection happens in the browser before any event reaches the server, so it is defeatable by anyone modifying client-side JavaScript; it is a friction/deterrent layer, not a tamper-proof exam-integrity system.
- **LLM-based scoring is not a standardized rubric:** correctness, score, and category-level feedback all depend on the reasoning model's judgment at generation time, and can vary between runs of the same answer.
- **No adaptive difficulty:** question difficulty is fixed at generation time and does not change based on how the candidate is performing mid-session.
- **In-memory session fallback is not durable:** when MongoDB is unavailable, session state lives only in the FastAPI process's memory and is lost on restart or redeploy.
- **Escalation review is self-service, not a moderator queue:** `GET`/`PATCH /api/mlim/escalations` are scoped to `get_current_user` and filtered by `user_id`, so a flagged answer is only visible to the candidate who gave it — there is no cross-user admin review surface or notification/paging path for a human reviewer today; `require_admin` currently gates only the fairness-probe endpoint.

---

## 🚀 Future Work

- Fit the GSTL goal-transition matrix to labeled session-trajectory data instead of hand-set constants, and evaluate goal-drift detection against ground-truth trajectory labels.
- Extend the fairness probe from an intent-label-stability check into a proper fairness evaluation, once a labeled evaluation set with protected-attribute proxies exists.
- Adaptive question difficulty, adjusted mid-session from the candidate's running MLIM/score signal rather than fixed at generation time.
- Resume upload with parsing, so question generation can personalize to a candidate's actual background rather than job description alone.
- A real admin-scoped moderation view over the escalation queue (`require_admin`-gated, cross-user), with notification/paging so a flagged session doesn't require polling `GET /api/mlim/escalations`.
- Replace the browser-only proctoring signals with a server-verifiable integrity check (e.g. periodic server-side frame sampling) to reduce client-side defeatability.
- Cross-session analytics beyond the current MLIM dashboard — trend lines for intent stability and goal drift across a user's full session history, not just within one session.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Charts | Recharts (MLIM analytics dashboard, performance charts) |
| Face Detection | face-api.js (`TinyFaceDetector` + expression models, loaded client-side) |
| PDF Export | ReportLab (server-side, `pdf_service.py`) |
| LLM Inference | Groq Cloud API — `openai/gpt-oss-120b` / `openai/gpt-oss-20b` |
| Speech-to-Text | Groq Whisper Large v3 |
| Backend Framework | FastAPI (Python 3.12, async) |
| Database | MongoDB Atlas (Motor async driver), in-memory fallback when unreachable |
| Cache / Rate Limiting | Redis, with in-memory fallback when unreachable |
| Auth | Custom JWT (PyJWT) with bcrypt password hashing, httpOnly cookie sessions |
| Metrics | Hand-rolled Prometheus-text registry (`app/core/metrics.py`), scraped at `/metrics` |
| Testing | pytest + pytest-asyncio (backend, 66 tests); `tsc --noEmit` + `next build` (frontend, CI only) |
| Lint | ruff (backend) |
| CI | GitHub Actions — backend lint + test, frontend type-check + build, on every push |
| Containerization | Docker (separate `Dockerfile`s for frontend/backend) + `docker-compose.yml` (Mongo + Redis + backend + frontend, with health checks) |
| Deployment | Vercel (frontend) + Render (backend) |

---

## ⚙️ Local Setup

**Prerequisites:** Python 3.12 · Node.js 20 · a Groq API key · a MongoDB connection string (Atlas or local) · Redis (optional — falls back to in-memory)

**1. Clone**
```bash
git clone https://github.com/yamini-nlp/InterviewIQ.git
cd InterviewIQ
```

**2. Configure environment**

Copy `.env.example` to `.env` **in the project root** and fill in the required values — this is the file `docker-compose.yml` loads (via `env_file: .env`) for both the `backend` and `frontend` services:

```env
GROQ_API_KEY=gsk_your_key_here
JWT_SECRET=a-random-string-at-least-32-characters-long
MONGODB_URL=mongodb+srv://user:password@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=interviewiq
ALLOWED_ORIGINS=http://localhost:3000
ALLOWED_HOSTS=localhost,127.0.0.1
```

> Running the backend manually without Docker (step 4 below)? Copy the same file to `backend/.env` as well — `pydantic-settings` loads `.env` relative to the directory `uvicorn` is started from.

**3. Run with Docker Compose (recommended)**
```bash
docker-compose up --build
```
This starts MongoDB, Redis, the FastAPI backend on `:8000`, and the Next.js frontend on `:3000`, wired together with health checks.

**4. Or run manually**

Backend:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Visit `http://localhost:3000`

**5. Run the test suite**
```bash
cd backend
pytest
ruff check .
```

**6. Run an interview**

1. Register an account, then go to **Setup** — select a job role, paste a job description, choose Practice or Simulation mode
2. Click **Start Interview** — questions are generated in real time
3. Answer each question via text or voice; grant camera/mic access if you want the proctoring signals active. In voice mode, live captions appear as you speak — finish with **Done**, saying **"that's all,"** or let the timer run out
4. In Practice mode, review your feedback card and live MLIM panel after each answer
5. Complete all questions to receive your **Final Assessment Report**
6. Export the report as PDF, review the **MLIM Analytics Dashboard**, or view past sessions on the main **Dashboard**

---

## 📁 Repository Structure

```
InterviewIQ/
├── .github/workflows/ci.yml       # Backend lint+test, frontend typecheck+build
├── .env.example
├── docker-compose.yml             # mongo + redis + backend + frontend, with health checks
│
├── frontend/
│   ├── Dockerfile
│   ├── middleware.ts              # Route protection + refresh-token rotation at the edge
│   ├── app/
│   │   ├── page.tsx               # Landing page
│   │   ├── login/page.tsx · register/page.tsx
│   │   ├── setup/page.tsx         # Session configuration
│   │   ├── practice/page.tsx      # Practice mode
│   │   ├── simulation/page.tsx    # Simulation mode
│   │   ├── report/[id]/page.tsx   # Final report with expandable Q&A breakdown
│   │   ├── dashboard/page.tsx     # Session history
│   │   ├── dashboard/mlim/page.tsx # MLIM analytics dashboard
│   │   ├── settings/page.tsx
│   │   └── api/auth/              # Next.js route handlers proxying to the FastAPI auth API
│   ├── components/
│   │   ├── ui/                    # Button, Card, Badge, Progress, Dialog, Toast, Skeleton, EmptyState, ErrorState
│   │   ├── interview/              # QuestionCard, FeedbackCard, VideoPanel, VoiceAnswerPanel, TimerBar, InterviewerAvatar, LiveAnalyticsPanel
│   │   ├── mlim/                  # MLIMAnalyticsCharts, MLIMReportSection
│   │   ├── dashboard/              # SessionCard, PerformanceChart
│   │   └── layout/                 # AppShell, Navbar, Sidebar, Breadcrumbs, LandingHeader
│   ├── contexts/AuthContext.tsx
│   ├── hooks/                     # useAuth, useInterview, useInterviewVoiceInput, useMLIM, useCamera, useCheatingDetection, useToast
│   ├── lib/                       # api.ts, mlim-api.ts, stream-api.ts, auth.ts, storage.ts, speech.ts, utils.ts, theme.ts
│   ├── types/                     # index.ts, mlim.ts
│   └── public/models/             # face-api.js model weights (TinyFaceDetector, landmarks, expressions)
│
└── backend/
    ├── Dockerfile · pytest.ini · ruff.toml · .python-version
    ├── app/
    │   ├── main.py                 # App entry, middleware, router registration, /health, /metrics
    │   ├── config.py               # Pydantic settings from .env, with startup validation
    │   ├── database.py             # MongoDB Motor async client
    │   ├── auth/                   # router.py, service.py (JWT/bcrypt), dependencies.py
    │   ├── core/                   # metrics.py, rate_limiter.py, redis_client.py, logging_config.py, exceptions.py
    │   ├── models/                 # mlim.py, question.py, report.py, session.py, user.py
    │   ├── routers/                 # questions, evaluate, simulate, reports, mlim, integrity, stream, privacy
    │   ├── services/
    │   │   ├── mlim/                # asl.py, pel.py, gstl.py, ifl.py, escalation.py, benchmark.py, explain.py, fairness.py
    │   │   ├── groq_service.py · mlim_service.py · question_service.py
    │   │   ├── evaluation_service.py · report_service.py · pdf_service.py · privacy_service.py
    │   └── prompts/                 # question_gen.py, evaluator.py, simulator.py
    └── tests/                       # 10 files, 66 tests (asl, pel, gstl, ifl, escalation, benchmark, explain, fairness, metrics, privacy)
```

---

<div align="center">

*Built by [Yamini G](https://github.com/yamini-nlp)*

</div>

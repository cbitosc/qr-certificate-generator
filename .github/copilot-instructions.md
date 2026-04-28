This repository is a two-part app: a Next.js (frontend) app using the app/ directory and a separate FastAPI (backend) service under `src/api`.

Key points for an AI coding agent to be immediately productive:

- Big picture
  - Frontend: `src/app` (Next.js 14+ app-dir). UI components live in `src/components` and `src/components/ui`.
  - Backend: FastAPI app in `src/api/index.py`. It's a standalone service (uvicorn) that the Next dev server proxies to under `/api` (see `next.config.mjs`).
  - Dev: `npm run dev` uses `concurrently` to run Next (port 3000) and FastAPI (port 8000). Requests from the browser to `/api/*` are rewritten to `http://127.0.0.1:8000/api/*` during development.

- Dev & build workflows (explicit)
  - Start dev (both servers): `npm run dev` (runs `next dev` + `python -m uvicorn src.api.index:app --reload`). Ensure Python deps from `requirements.txt` are installed (the `fastapi-dev` script installs them automatically, but in practice prefer a venv).
  - Build frontend: `npm run build` then `npm run start` for production Next. The backend must be deployed separately or served under `/api` for production.
  - Important file: `next.config.mjs` contains the rewrites that proxy `/api` to the FastAPI server in development — update it if you move the backend.

- How front and back communicate (patterns & examples)
  - Frontend form in `src/components/GenerateCertificate.tsx` builds a FormData and `fetch('/api/generate-certificates', { method: 'POST', body: formData })`.
  - The backend exposes `@app.post('/api/generate-certificates')` in `src/api/index.py` and accepts form fields and file uploads (template, excel, optional svg). The endpoint schedules a background task and returns immediately.
  - The generation logic (QR creation, PNG overlays, optional SVG->HTML docs) lives in `generate_certificates_task` inside `src/api/index.py`. Look there to understand output layout and JSON schema that the generator emits (`data.json`). The endpoint supports verifiable=true/false (whether to include QR code/static pages), custom fonts, and outputting PDF or PNG formats.

- Project conventions & gotchas
  - Distribute / output folders: the `distribute` tab is currently under construction. `src/api/__pycache__`, `src/api/certificates` and `src/api/docs` are `.gitignore`d avoiding bulk commits of generated artifacts.
  - Client vs Server components: components with DOM/dragging logic use `"use client"` (see `GenerateCertificate.tsx`). Use `src/components/Dynamic.tsx` for client-only mounting patterns.
  - Excel import: `GenerateCertificate` expects the first row to be headers. The backend expects at least a `Name` column (used to compose codes). Missing headers will raise an HTTP 400.
  - Dynamic overlays now let you define multiple text fields, each with its own `{column}` placeholders. The frontend builds `design_data.overlays` with `textFormat` strings taken directly from the Excel headers. The backend formats each overlay against row values and no longer looks for a separate `overlay_format` or hard‑coded name column.
  - Dev proxy: frontend uses `/api/*` at runtime; when adding new backend endpoints, ensure rewrites in `next.config.mjs` still cover them.
  - Native modules: the repo lists `canvas` and `konva`. `canvas` may require native build steps on some platforms; `next.config.mjs` already marks `canvas` as an external to avoid client bundling — be careful when editing code that imports `canvas`.

- Important files to inspect for context
  - `src/components/GenerateCertificate.tsx` — main UX flow for uploading template + excel, building FormData, Konva canvas placement, and calling the backend.
  - `src/api/index.py` — FastAPI app: form schema, `generate_certificates_task`, `modify_svg`, and the background processing logic that writes `certificates/` and `docs/` outputs.
  - `next.config.mjs` — rewrites + webpack externals (how dev proxy works and why some native modules are externalized).
  - `package.json` — `dev`, `fastapi-dev`, and `next-dev` scripts.
  - `src/app/layout.tsx` — shows local font usage and `ThemeProvider` (useful when touching styles or global layout).

- Safe edit guidance
  - If changing the API signature, update `GenerateCertificate.tsx` to send matching form fields and types (FormData keys are literal strings, e.g., `design_data`, `template`, `excel`).
  - When changing output locations or names, update both the backend task and any consumers that read the generated `docs` or `data.json` files.
  - For frontend changes that touch server-side rendering, be explicit about `"use client"` vs server components. Use `Dynamic` when in doubt.

- Quick troubleshooting tips
  - If `/api` fetches fail in dev: confirm `npm run dev` is running both servers and that FastAPI is on port 8000. Check `next.config.mjs` rewrites and the terminal logs for uvicorn.
  - If certificate generation errors: inspect FastAPI logs (uvicorn), and check that Excel file headers match the overlay format. The backend raises HTTP 400 for missing columns.
  - If canvas/konva errors during build: these are often native bindings problems — consult `next.config.mjs` externals and consider running the backend-only tasks in Python (they use PIL/qrcode/pandas) rather than bundling native canvas in Next.

If anything in this guide is unclear or you'd like more examples (e.g., exact FormData keys, a sequence diagram, or a small test harness), tell me which area to expand and I'll iterate.

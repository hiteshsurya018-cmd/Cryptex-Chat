# Cryptex Chat

Secure, chat-style encryption for text and files. Cryptex Chat provides a clean React UI and an Express API that encrypts/decrypts data using AES-256-GCM with scrypt-derived keys. It supports text, images, video, audio, and document workflows, plus document text extraction (PDF/DOCX/TXT).

## Features
- Chat-first UI with quick replies, intent detection, and encryption hints.
- Text encryption/decryption with Base64 output.
- File encryption/decryption via streaming (lower memory usage).
- Document text extraction (PDF/DOCX/TXT).
- Authenticated encryption (AES-256-GCM) with per-message salt + IV.
- Legacy PBKDF2 compatibility for decrypting older payloads.

## Tech Stack
- Frontend: React, React Router, Tailwind CSS, Radix UI, TanStack Query, Vite.
- Backend: Express, Multer, Node crypto.
- Tests: Vitest.

## How It Works
1. The user submits text or a file plus a secret key.
2. The key is derived with scrypt to a 256-bit key.
3. AES-256-GCM encrypts and authenticates the payload.
4. Output is packed as `[salt | iv | auth tag | ciphertext]`.
5. Text results are Base64 for easy copy/paste. File results are downloadable.

## Security Notes
- Encryption happens on the server in this build; the key is sent to the server.
- Wrong keys return plausible-looking output by design.
- For strongest privacy, move encryption client-side.

## API
Base URL (dev): `http://localhost:8080` (Vite dev server with Express middleware)

### Health & Demo
- `GET /api/ping` → `{ message }`
- `GET /api/demo`

### Text
- `POST /api/encrypt`
  - Body: `{ data: string, key: string }`
- `POST /api/decrypt`
  - Body: `{ data: string, key: string }`

### Files (multipart/form-data)
- `POST /api/encrypt-file`
  - Fields: `file`, `key`, `type` (image|video|audio|file)
- `POST /api/decrypt-file`
  - Fields: `file`, `key`, `type` (image|video|audio|file)
- Response includes either:
  - `downloadUrl` (local Express server)
  - `dataBase64` + `filename` (Vercel serverless)

### Document Text Extraction
- `POST /api/extract-text`
  - Fields: `file` (PDF/DOCX/TXT)
  - Response: `{ text, chars, truncated }`

Limits:
- Local server: 50MB per file.
- Vercel serverless: controlled by `MAX_UPLOAD_BYTES` (default 4MB).

## Getting Started

### Prerequisites
- Node.js 18+ recommended
- pnpm (recommended) or npm

### Install
```bash
pnpm install
```

### Run in Dev
```bash
pnpm dev
```

### Build
```bash
pnpm build
```

### Run Production Build
```bash
pnpm start
```

### Tests
```bash
pnpm test
```

## Environment Variables
- `PORT` (default: `3000`) for the production server.
- `PING_MESSAGE` (default: `ping`) for `/api/ping`.
- `MAX_UPLOAD_BYTES` (default: `4194304`) for serverless API payload size.

Create a `.env` file in the repo root if needed:
```ini
PORT=3000
PING_MESSAGE=ping
```

## Project Structure
- `client/` React app (UI, chat experience)
- `server/` Express API + crypto handlers
- `shared/` Shared types
- `public/processed/` Encrypted/decrypted file outputs (runtime)

## Scripts
- `pnpm dev` Start Vite dev server
- `pnpm build` Build client and server bundles
- `pnpm start` Run production server from `dist/`
- `pnpm test` Run Vitest
- `pnpm typecheck` TypeScript checks

## Roadmap Ideas
- Client-side encryption to avoid sending keys to the server.
- Optional key stretching settings (scrypt params).
- Key management and hardware-backed storage.

## License
Add a license of your choice.

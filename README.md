# Classroom Kingdom

Classroom Kingdom is a web learning platform powered by Firebase Auth and Firestore.
It provides role-aware flows for students, teachers, and admins with multi-page Vite builds.

## Tech Stack

- Vite (multi-page app)
- Vanilla JavaScript, HTML, CSS
- Firebase Authentication
- Cloud Firestore
- Google Drive upload via Firebase Cloud Functions
- Vitest + JSDOM

## Project Structure

```text
.
|-- assets/
|   `-- images/
|-- docs/
|-- scripts/
|   |-- pages/
|   |   |-- lesson-player/
|   |   |-- login/
|   |   |-- pdf-reader/
|   |   |-- student-library/
|   |   |-- student-profile/
|   |   |-- teacher-dashboard/
|   |   |-- teacher-plan-dashboard/
|   |   `-- team-showcase/
|   `-- services/
|       |-- firebase/
|       `-- local/
|-- functions/
|   |-- index.js
|   `-- package.json
|-- tests/
|   |-- pages/
|   `-- services/
|-- firebase.json
|-- firestore.rules
|-- vite.config.js
|-- vitest.config.js
`-- package.json
```

## Prerequisites

- Node.js 18+
- npm 9+
- Firebase CLI (`npm i -g firebase-tools`)

## Install

```bash
npm install
```

## Run (Development)

```bash
npm run dev
```

Default local URL:

- http://localhost:5173

## Run Tests

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

## Lint and Format

```bash
npm run lint
npm run format:check
npm run format
```

## Build and Preview

```bash
npm run build
npm run preview
```

## Firebase Configuration

Main config files:

- `firebase.json`
- `firestore.rules`
- `storage.rules`
- `scripts/services/firebase/firebase-config.js`

### Google Sign-in Notes

- Add your local domain to Firebase Auth authorized domains.
- Recommended local URL is `localhost`.

## Deploy (Firebase Hosting)

```bash
npm run build
firebase deploy --only hosting --project <firebase-project-id>
```

## Google Drive Upload Setup (Replace Firebase Storage)

This project uploads teacher files to Google Drive through a secure Cloud Function (`uploadToDrive`).

Why this architecture:

- Service account private keys are kept on server side (Cloud Functions secrets), never exposed to browser.
- Client uploads via authenticated API call using Firebase ID token.
- Only `teacher` / `admin` role can upload.

### 1. Share destination Drive folder with service account

- Use your destination folder (for example: `1HLfTQH_yTpySEnruBH5PolvfwN7XDaHE`).
- Share that folder with the service account email as **Editor**.

### 2. Choose one backend option

Option A - Firebase Cloud Functions (requires Firebase Blaze plan):

- This option uses `functions/index.js` in this repository.
- Spark plan cannot enable Secret Manager for `functions:secrets:set`.

Option B - Any external upload API (Cloud Run / Apps Script / server):

- Set `VITE_DRIVE_UPLOAD_ENDPOINT` to your upload API URL.
- The client uploads to that URL with Firebase ID token in `Authorization` header.

#### Option B quickstart (Cloud Run in this repo)

This repo includes a ready service at `external/drive-upload-service`.

1. Re-authenticate gcloud (if needed):

```bash
gcloud auth login
```

2. Deploy Cloud Run endpoint with one script:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-drive-upload-cloudrun.ps1
```

3. Copy output endpoint and set in `.env`:

```bash
VITE_DRIVE_UPLOAD_ENDPOINT=https://<cloud-run-url>/upload
```

4. Rebuild and deploy hosting:

```bash
npm run build
firebase deploy --only hosting --project <firebase-project-id>
```

### 3. Install functions dependencies (Option A only)

```bash
cd functions
npm install
cd ..
```

### 4. Set Cloud Functions secrets (Option A only)

Set service-account JSON (single line JSON string) and root folder id:

```bash
firebase functions:secrets:set DRIVE_SERVICE_ACCOUNT_JSON
firebase functions:secrets:set DRIVE_ROOT_FOLDER_ID
```

For `DRIVE_ROOT_FOLDER_ID`, provide only the folder id, not full URL.

### 5. Deploy functions + hosting (Option A only)

```bash
npm run build
firebase deploy --only functions,hosting --project <firebase-project-id>
```

### 6. Local testing notes

- If `VITE_DRIVE_UPLOAD_ENDPOINT` is set, client will always use that endpoint.
- If not set, local browser falls back to function emulator URL `http://127.0.0.1:5001/vuongquoclophoc/us-central1/uploadToDrive`.
- Production must set `VITE_DRIVE_UPLOAD_ENDPOINT` unless you add hosting rewrite to deployed function.

### Security warning

- Do **not** commit service-account key files to git.
- If a key was ever exposed, rotate/revoke it immediately in Google Cloud IAM.

## Core Pages

- Login: `scripts/pages/login/login.html`
- Teacher Dashboard: `scripts/pages/teacher-dashboard/teacher-dashboard.html`
- Teacher Plan Dashboard: `scripts/pages/teacher-plan-dashboard/teacher-plan-dashboard.html`
- Student Library: `scripts/pages/student-library/student-library.html`
- Student Profile: `scripts/pages/student-profile/student-profile.html`
- Team Showcase: `scripts/pages/team-showcase/team-showcase.html`
- Lesson Player: `scripts/pages/lesson-player/lesson-player.html`
- PDF Reader: `scripts/pages/pdf-reader/pdf-reader.html`

## Environment Variables

If you move Firebase config out of source files, use `.env` with `VITE_` prefixed variables.
See `.env.example` for expected keys.

## CI/CD

GitHub Actions workflow is provided at:

- `.github/workflows/ci.yml`

Current checks:

- Install dependencies
- Run tests
- Build production

## Contributing

Please read `CONTRIBUTING.md` before creating a Pull Request.

## Security

Please read `SECURITY.md` for vulnerability reporting and responsible disclosure.

## License

This project is licensed under MIT. See `LICENSE`.

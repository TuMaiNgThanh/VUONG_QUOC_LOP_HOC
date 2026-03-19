# Classroom Kingdom

Classroom Kingdom is a web learning platform powered by Firebase Auth, Firestore, and Storage.
It provides role-aware flows for students, teachers, and admins with multi-page Vite builds.

## Tech Stack

- Vite (multi-page app)
- Vanilla JavaScript, HTML, CSS
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
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
|-- tests/
|   |-- pages/
|   `-- services/
|-- firebase.json
|-- firestore.rules
|-- storage.rules
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

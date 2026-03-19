# Release Checklist

## Pre-release Quality

- [ ] `npm ci`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Manual smoke test on key pages

## Security Checks

- [ ] Review `firestore.rules` and `storage.rules`
- [ ] Verify no secrets in source control
- [ ] Run `npm audit --omit=dev`
- [ ] Validate Firebase authorized domains

## Functional Smoke Test

- [ ] Login flow (email/password)
- [ ] Login flow (Google)
- [ ] Role redirects (student/teacher/admin)
- [ ] Teacher content CRUD
- [ ] Student content visibility
- [ ] Leaderboard rendering

## Deployment

- [ ] Deploy hosting: `firebase deploy --only hosting --project <id>`
- [ ] Deploy rules: `firebase deploy --only firestore:rules,storage`
- [ ] Verify production URL and key routes

## Post-release

- [ ] Monitor Firebase usage/errors
- [ ] Track user-reported regressions
- [ ] Tag release in Git (`vX.Y.Z`)

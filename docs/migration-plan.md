# Migration Plan: React TSX to Vanilla HTML/CSS/JS

## Scope
- Replace TSX-based pages with stitch-aligned HTML/CSS/JS pages.
- Keep Firebase Auth + Firestore logic.
- Preserve role-based access for teacher and student.
- Remove unused legacy assets and duplicate stitch variants.

## Completed Phases
1. Foundation setup for vanilla multi-page structure and Firebase services.
2. Login migration.
3. Teacher dashboard migration.
4. Student library migration.
5. Lesson player migration.
6. Team showcase migration.
7. Student profile page implementation (new): profile info, rank, metrics, activity summary.
8. Cleanup legacy React/test/stitch duplicate artifacts.

## Reused Stitch Modules
- Quest and map-style widgets integrated into student flow.
- Class management and metrics patterns integrated into teacher flow.
- Unified profile entry points added from student, team, and teacher pages.

## Current Architecture
- UI: Vanilla HTML/CSS/JS under `scripts/pages/*`.
- Data/Auth: Firebase Auth + Firestore.
- Build/Serve: Vite (`dev`, `build`, `preview`) without React toolchain.

## Exit Criteria Status
- Core user flows work end-to-end with Firebase: Completed.
- UX/UI aligned with selected stitch screens: Completed.
- No critical syntax/runtime diagnostics on migrated core files: Completed.

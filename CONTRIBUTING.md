# Contributing Guide

## Branch Strategy

- main: production-ready branch
- develop: integration branch
- feature/<ticket-or-name>: new features
- bugfix/<ticket-or-name>: bug fixes
- hotfix/<ticket-or-name>: urgent production fixes

## Development Workflow

1. Create a branch from develop.
2. Keep commits focused and atomic.
3. Run tests before pushing.
4. Open a Pull Request into develop.

## Commit Message Suggestion

Use clear and descriptive messages. Example:

- feat(auth): add realtime role watcher
- fix(rules): restrict user profile read scope
- test(firestore): add enrollment edge cases

## Pull Request Checklist

- [ ] Code builds locally
- [ ] Tests pass locally
- [ ] No sensitive data committed
- [ ] PR description includes scope and test notes
- [ ] Screenshots attached for UI changes

## Review Expectations

- At least 1 reviewer approval before merge.
- Security-sensitive files require careful review:
  - firebase.json
  - firestore.rules
  - storage.rules
  - scripts/services/firebase/*

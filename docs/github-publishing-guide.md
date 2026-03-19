# GitHub Publishing Guide

## 1. Create Repository

Recommended settings:

- Name: `vuong-quoc-lop-hoc`
- Description: Classroom Kingdom learning platform with Firebase role-based flows
- Visibility: private or public based on your team policy
- Add README: yes
- Add .gitignore: Node
- Add license: MIT

## 2. First Push Commands

```bash
git init
git checkout -b main
git add .
git commit -m "Initial commit: Classroom Kingdom setup"
git remote add origin https://github.com/<your-username>/vuong-quoc-lop-hoc.git
git push -u origin main
```

If remote already has commits:

```bash
git pull origin main --rebase
git push -u origin main
```

## 3. Branching Model

- main
- develop
- feature/*
- bugfix/*
- hotfix/*

## 4. CI

CI workflow is in `.github/workflows/ci.yml`.
It currently runs:

- install (`npm ci`)
- tests (`npm test`)
- build (`npm run build`)

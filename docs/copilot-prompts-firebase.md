# Copilot Prompts (Firebase-Aligned)

These prompts are tailored for this repository, which currently uses Firebase Auth + Firestore on the client side.

## Why your original prompts are good

Your structure is strong:
1. Context
2. Data structure
3. Specific task

This is exactly how Copilot performs best.

## What needs adjustment for this codebase

This repo currently has:
- Auth and role logic in [scripts/services/firebase/auth-service.js](scripts/services/firebase/auth-service.js)
- Firestore data access in [scripts/services/firebase/firestore-service.js](scripts/services/firebase/firestore-service.js)
- Existing data model docs in [docs/firebase-data-model.md](docs/firebase-data-model.md)

But it does not yet have first-class entities for:
- Class
- Enrollment

So prompts should target Firestore collections + Security Rules + (optional) Cloud Functions.

---

## Prompt 1 (Firestore Data Model + Rules + Indexes)

Use this in Copilot Chat (English):

```text
I am building an educational platform on Firebase (Firestore + Firebase Auth). Act as an expert Firebase architect.

Design a Firestore data model for these entities and relationships:
- users/{uid}: displayName, email, phone (optional), role (TEACHER|STUDENT|ADMIN), createdAt
- classes/{classId}: name, classCode (unique), teacherId (must reference a TEACHER user), createdAt
- enrollments/{enrollmentId}: studentId, classId, createdAt (one student can enroll in many classes)
- lessons/{lessonId}: classId, teacherId, title, content, visible, createdAt, updatedAt

Requirements:
1) A teacher can own multiple classes.
2) A class can contain multiple lessons.
3) A student can enroll in multiple classes.
4) No duplicate enrollment for the same (studentId, classId).

Please output:
A) Firestore collection schemas (field types + constraints)
B) Suggested document IDs and unique strategy for classCode
C) Firestore Security Rules snippet enforcing role-based access
D) Required Firestore composite indexes
E) Migration notes from an existing app that currently has users + lessons only
```

---

## Prompt 2 (Registration Logic Without Role Confusion)

Use this in Copilot Chat (English):

```text
Write Firebase backend logic using Cloud Functions (Node.js, TypeScript preferred) to prevent role confusion during registration.

Create two HTTPS callable functions:
1) registerTeacher
   - Input: name, email, password, phone (optional)
   - Behavior: create Firebase Auth user, create users/{uid} with role='TEACHER' only

2) registerStudent
   - Input: name, email, password, classCode
   - Behavior:
     a) find class by classCode
     b) if class not found, throw invalid-argument with message 'Invalid class code'
     c) create Firebase Auth user
     d) create users/{uid} with role='STUDENT'
     e) create enrollment record linking this student to the class

Strict requirements:
- Do not accept role from client input.
- Use transactions to avoid partial writes.
- Prevent duplicate enrollment.
- Return structured error codes.
- Include input validation and basic normalization.

Also generate:
- TypeScript types for request/response
- A minimal client-side calling example from a web app
- Unit tests for success/failure paths
```

---

## Prompt 3 (Student Class View API)

Use this in Copilot Chat (English):

```text
Write a Firebase callable function getStudentClassView for endpoint-equivalent behavior of /api/classes/:classId/student-view.

Only an authenticated STUDENT enrolled in that class can access.
Input: classId
Output:
- className
- lessons[] for that class
- teacher contact: name, email, phone

Implementation requirements:
1) Verify Firebase Auth user exists.
2) Verify user role is STUDENT.
3) Verify enrollment(studentId, classId) exists.
4) Query class, lessons, and teacher profile safely.
5) Return standardized errors (unauthenticated, permission-denied, not-found).
6) Include security rule considerations.
7) Include test cases for unauthorized and not-enrolled scenarios.
```

---

## Prompt 4 (Refactor Existing Frontend Services)

Use this prompt to connect new model with existing files:

```text
Refactor existing Firebase client services to support classes and enrollments while preserving current lessons/references/exercises behavior.

Current files:
- scripts/services/firebase/auth-service.js
- scripts/services/firebase/firestore-service.js

Please add:
- watchClassesForStudent(studentId)
- watchClassesForTeacher(teacherId)
- enrollStudentByClassCode(studentId, classCode)
- getStudentClassView(classId, studentId)

Constraints:
- Keep function naming consistent with existing service style.
- Maintain backward compatibility.
- Add Vitest unit tests for edge cases.
- Do not break existing tests.

Return:
1) Updated service code
2) New tests
3) Short migration checklist
```

---

## Quick quality checklist for any prompt

Before sending a prompt to Copilot, include:
- Tech stack (Firebase, Firestore, Cloud Functions, TypeScript/JS)
- Exact file paths to edit
- Inputs/outputs schema
- Error cases and role constraints
- Test requirements
- Non-breaking constraints for existing code

If you include these six items, Copilot output is usually much more accurate.

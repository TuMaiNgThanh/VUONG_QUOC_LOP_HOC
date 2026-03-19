# Firebase Data Model

## Collections
- `users/{uid}`
  - `email`: string
  - `displayName`: string
  - `photoURL`: string
  - `role`: `teacher` | `student`
  - `createdAt`: timestamp

- `lessons/{lessonId}`
  - `title`: string
  - `classId`: string
  - `videoUrl`: string
  - `docUrl`: string
  - `visible`: boolean
  - `teacherId`: string
  - `teacherName`: string
  - `timestamp`: timestamp

- `classes/{classId}`
  - `name`: string
  - `classCode`: string (unique)
  - `teacherId`: string
  - `createdAt`: timestamp

- `enrollments/{studentId}_{classId}`
  - `studentId`: string
  - `classId`: string
  - `classCode`: string
  - `createdAt`: timestamp

- `lessons/{lessonId}/comments/{commentId}`
  - `text`: string
  - `userId`: string
  - `userName`: string
  - `userPhoto`: string
  - `timestamp`: timestamp

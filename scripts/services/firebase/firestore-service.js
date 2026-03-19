import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "./firebase-sdk.js";
import { db } from "./firebase-config.js";

export function watchVisibleLessons(callback) {
  const q = query(collection(db, "lessons"), where("visible", "==", true));
  return onSnapshot(q, callback);
}

export function watchUsers(callback) {
  return onSnapshot(collection(db, "users"), callback);
}

export async function updateUserRole(userId, role) {
  return updateDoc(doc(db, "users", userId), { role });
}

export function watchAllLessons(callback) {
  const q = query(collection(db, "lessons"), orderBy("timestamp", "desc"));
  return onSnapshot(q, callback);
}

export async function createLesson(payload) {
  return addDoc(collection(db, "lessons"), {
    ...payload,
    timestamp: serverTimestamp()
  });
}

export async function updateLesson(lessonId, payload) {
  return updateDoc(doc(db, "lessons", lessonId), payload);
}

export async function removeLesson(lessonId) {
  return deleteDoc(doc(db, "lessons", lessonId));
}

export async function getLessonById(lessonId) {
  const ref = doc(db, "lessons", lessonId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function watchLessonComments(lessonId, callback) {
  const q = query(collection(db, "lessons", lessonId, "comments"), orderBy("timestamp", "asc"));
  return onSnapshot(q, callback);
}

export async function addLessonComment(lessonId, payload) {
  return addDoc(collection(db, "lessons", lessonId, "comments"), {
    ...payload,
    timestamp: serverTimestamp()
  });
}

export function watchPrivateLessonPlansByTeacher(teacherId, callback) {
  const q = query(collection(db, "lessonPlans"), where("teacherId", "==", teacherId));
  return onSnapshot(q, callback);
}

export function watchAllPrivateLessonPlans(callback) {
  const q = query(collection(db, "lessonPlans"), orderBy("timestamp", "desc"));
  return onSnapshot(q, callback);
}

export async function createPrivateLessonPlan(payload) {
  return addDoc(collection(db, "lessonPlans"), {
    ...payload,
    timestamp: serverTimestamp()
  });
}

export async function updatePrivateLessonPlan(planId, payload) {
  return updateDoc(doc(db, "lessonPlans", planId), payload);
}

export async function removePrivateLessonPlan(planId) {
  return deleteDoc(doc(db, "lessonPlans", planId));
}

export async function getPrivateLessonPlanById(planId) {
  const ref = doc(db, "lessonPlans", planId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function watchVisibleReferences(callback) {
  const q = query(collection(db, "references"), where("visible", "==", true));
  return onSnapshot(q, callback);
}

export function watchAllReferences(callback) {
  const q = query(collection(db, "references"), orderBy("timestamp", "desc"));
  return onSnapshot(q, callback);
}

export async function createReference(payload) {
  return addDoc(collection(db, "references"), {
    ...payload,
    timestamp: serverTimestamp()
  });
}

export async function updateReference(referenceId, payload) {
  return updateDoc(doc(db, "references", referenceId), payload);
}

export async function removeReference(referenceId) {
  return deleteDoc(doc(db, "references", referenceId));
}

export async function getReferenceById(referenceId) {
  const ref = doc(db, "references", referenceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function watchVisibleExercises(callback) {
  const q = query(collection(db, "exercises"), where("visible", "==", true));
  return onSnapshot(q, callback);
}

export function watchAllExercises(callback) {
  const q = query(collection(db, "exercises"), orderBy("timestamp", "desc"));
  return onSnapshot(q, callback);
}

export async function createExercise(payload) {
  return addDoc(collection(db, "exercises"), {
    ...payload,
    timestamp: serverTimestamp()
  });
}

export async function updateExercise(exerciseId, payload) {
  return updateDoc(doc(db, "exercises", exerciseId), payload);
}

export async function removeExercise(exerciseId) {
  return deleteDoc(doc(db, "exercises", exerciseId));
}

export async function getExerciseById(exerciseId) {
  const ref = doc(db, "exercises", exerciseId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function watchClassesForTeacher(teacherId, callback) {
  const q = query(collection(db, "classes"), where("teacherId", "==", teacherId));
  return onSnapshot(q, callback);
}

export function watchClassesForStudent(studentId, callback) {
  const q = query(collection(db, "enrollments"), where("studentId", "==", studentId));

  return onSnapshot(q, async (snap) => {
    try {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const classRows = await Promise.all(
        rows.map(async (row) => {
          const classRef = doc(db, "classes", row.classId);
          const classSnap = await getDoc(classRef);
          if (!classSnap.exists()) return null;
          return { id: classSnap.id, ...classSnap.data() };
        })
      );

      callback(classRows.filter(Boolean));
    } catch {
      callback([]);
    }
  });
}

export async function enrollStudentByClassCode(studentId, classCode) {
  const classCodeValue = (classCode || "").trim();
  if (!studentId || !classCodeValue) {
    throw new Error("Missing studentId or classCode");
  }

  const classQ = query(collection(db, "classes"), where("classCode", "==", classCodeValue), limit(1));
  const classSnap = await getDocs(classQ);

  if (classSnap.empty) {
    throw new Error("Invalid class code");
  }

  const foundClass = classSnap.docs[0];
  const classId = foundClass.id;
  const enrollmentId = `${studentId}_${classId}`;
  const enrollmentRef = doc(db, "enrollments", enrollmentId);
  const enrollmentDoc = await getDoc(enrollmentRef);

  if (enrollmentDoc.exists()) {
    return { id: enrollmentId, alreadyEnrolled: true, classId };
  }

  await setDoc(enrollmentRef, {
    studentId,
    classId,
    classCode: classCodeValue,
    createdAt: serverTimestamp()
  });

  return { id: enrollmentId, alreadyEnrolled: false, classId };
}

export async function getStudentClassView(classId, studentId) {
  if (!classId || !studentId) {
    throw new Error("Missing classId or studentId");
  }

  const enrollmentQ = query(
    collection(db, "enrollments"),
    where("studentId", "==", studentId),
    where("classId", "==", classId),
    limit(1)
  );
  const enrollmentSnap = await getDocs(enrollmentQ);

  if (enrollmentSnap.empty) {
    throw new Error("Not enrolled in this class");
  }

  const classRef = doc(db, "classes", classId);
  const classSnap = await getDoc(classRef);
  if (!classSnap.exists()) {
    throw new Error("Class not found");
  }

  const classData = classSnap.data();
  const teacherRef = doc(db, "users", classData.teacherId);
  const teacherSnap = await getDoc(teacherRef);

  const lessonsQ = query(
    collection(db, "lessons"),
    where("classId", "==", classId),
    where("visible", "==", true),
    orderBy("timestamp", "desc")
  );
  const lessonsSnap = await getDocs(lessonsQ);
  const lessons = lessonsSnap.docs.map((lessonDoc) => ({ id: lessonDoc.id, ...lessonDoc.data() }));

  const teacher = teacherSnap.exists()
    ? {
        id: teacherSnap.id,
        name: teacherSnap.data()?.displayName || "",
        email: teacherSnap.data()?.email || "",
        phone: teacherSnap.data()?.phone || ""
      }
    : { id: classData.teacherId, name: "", email: "", phone: "" };

  return {
    className: classData.name || "",
    classCode: classData.classCode || "",
    lessons,
    teacher
  };
}

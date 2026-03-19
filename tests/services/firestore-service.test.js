import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn()
}));

vi.mock("../../scripts/services/firebase/firebase-sdk.js", () => mockFns);
vi.mock("../../scripts/services/firebase/firebase-config.js", () => ({ db: { key: "db" } }));

import {
  addLessonComment,
  createLesson,
  enrollStudentByClassCode,
  getLessonById,
  getStudentClassView,
  removeLesson,
  updateUserRole,
  updateLesson,
  watchAllLessons,
  watchLessonComments,
  watchUsers,
  watchVisibleLessons
  , createExercise,
  createPrivateLessonPlan,
  createReference,
  getExerciseById,
  getPrivateLessonPlanById,
  getReferenceById,
  removeExercise,
  removePrivateLessonPlan,
  removeReference,
  updateExercise,
  updatePrivateLessonPlan,
  updateReference,
  watchAllExercises,
  watchAllPrivateLessonPlans,
  watchAllReferences,
  watchPrivateLessonPlansByTeacher,
  watchVisibleExercises,
  watchVisibleReferences,
  watchClassesForStudent,
  watchClassesForTeacher
} from "../../scripts/services/firebase/firestore-service.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockFns.collection.mockImplementation((_db, ...parts) => parts.join("/"));
  mockFns.doc.mockImplementation((_db, ...parts) => parts.join("/"));
  mockFns.query.mockImplementation((...args) => ({ q: args }));
  mockFns.where.mockImplementation((...args) => ({ where: args }));
  mockFns.orderBy.mockImplementation((...args) => ({ orderBy: args }));
  mockFns.limit.mockImplementation((...args) => ({ limit: args }));
  mockFns.serverTimestamp.mockReturnValue("TS");
});

describe("firestore-service", () => {
  it("watch functions return Firestore unsubscribe handle", () => {
    const unsubscribe = vi.fn();
    mockFns.onSnapshot.mockReturnValue(unsubscribe);

    expect(watchUsers(vi.fn())).toBe(unsubscribe);
    expect(watchVisibleLessons(vi.fn())).toBe(unsubscribe);
    expect(watchAllLessons(vi.fn())).toBe(unsubscribe);
    expect(watchVisibleReferences(vi.fn())).toBe(unsubscribe);
    expect(watchAllReferences(vi.fn())).toBe(unsubscribe);
    expect(watchVisibleExercises(vi.fn())).toBe(unsubscribe);
    expect(watchAllExercises(vi.fn())).toBe(unsubscribe);
    expect(watchPrivateLessonPlansByTeacher("t1", vi.fn())).toBe(unsubscribe);
    expect(watchAllPrivateLessonPlans(vi.fn())).toBe(unsubscribe);
    expect(watchLessonComments("l1", vi.fn())).toBe(unsubscribe);
    expect(watchClassesForTeacher("t1", vi.fn())).toBe(unsubscribe);
    expect(watchClassesForStudent("s1", vi.fn())).toBe(unsubscribe);
  });

  it("watchClassesForTeacher filters classes by teacherId", () => {
    watchClassesForTeacher("teacher-1", vi.fn());
    expect(mockFns.collection).toHaveBeenCalledWith({ key: "db" }, "classes");
    expect(mockFns.where).toHaveBeenCalledWith("teacherId", "==", "teacher-1");
    expect(mockFns.onSnapshot).toHaveBeenCalled();
  });

  it("watchClassesForStudent resolves class docs from enrollments", async () => {
    let enrollmentCallback = null;
    mockFns.onSnapshot.mockImplementation((_q, cb) => {
      enrollmentCallback = cb;
      return vi.fn();
    });

    mockFns.getDoc
      .mockResolvedValueOnce({ id: "c1", exists: () => true, data: () => ({ name: "Class 1" }) })
      .mockResolvedValueOnce({ id: "c2", exists: () => false, data: () => ({}) });

    const resultCallback = vi.fn();
    watchClassesForStudent("student-1", resultCallback);

    await enrollmentCallback({
      docs: [
        { id: "e1", data: () => ({ classId: "c1" }) },
        { id: "e2", data: () => ({ classId: "c2" }) }
      ]
    });

    expect(resultCallback).toHaveBeenCalledWith([{ id: "c1", name: "Class 1" }]);
  });

  it("watchClassesForStudent falls back to empty list when class lookup fails", async () => {
    let enrollmentCallback = null;
    mockFns.onSnapshot.mockImplementation((_q, cb) => {
      enrollmentCallback = cb;
      return vi.fn();
    });

    mockFns.getDoc.mockRejectedValueOnce(new Error("fetch failed"));

    const resultCallback = vi.fn();
    watchClassesForStudent("student-2", resultCallback);

    await enrollmentCallback({
      docs: [{ id: "e1", data: () => ({ classId: "c1" }) }]
    });

    expect(resultCallback).toHaveBeenCalledWith([]);
  });

  it("watchVisibleLessons wires visible filter", () => {
    const callback = vi.fn();
    watchVisibleLessons(callback);
    expect(mockFns.where).toHaveBeenCalledWith("visible", "==", true);
    expect(mockFns.onSnapshot).toHaveBeenCalledTimes(1);
  });

  it("watchVisibleReferences wires visible filter", () => {
    const callback = vi.fn();
    watchVisibleReferences(callback);
    expect(mockFns.collection).toHaveBeenCalledWith({ key: "db" }, "references");
    expect(mockFns.where).toHaveBeenCalledWith("visible", "==", true);
    expect(mockFns.onSnapshot).toHaveBeenCalledTimes(1);
  });

  it("watchVisibleExercises wires visible filter", () => {
    const callback = vi.fn();
    watchVisibleExercises(callback);
    expect(mockFns.collection).toHaveBeenCalledWith({ key: "db" }, "exercises");
    expect(mockFns.where).toHaveBeenCalledWith("visible", "==", true);
    expect(mockFns.onSnapshot).toHaveBeenCalledTimes(1);
  });

  it("watchUsers subscribes users collection", () => {
    const callback = vi.fn();
    watchUsers(callback);
    expect(mockFns.collection).toHaveBeenCalledWith({ key: "db" }, "users");
    expect(mockFns.onSnapshot).toHaveBeenCalled();
  });

  it("watchAllLessons subscribes lessons ordered desc", () => {
    const callback = vi.fn();
    watchAllLessons(callback);
    expect(mockFns.orderBy).toHaveBeenCalledWith("timestamp", "desc");
    expect(mockFns.onSnapshot).toHaveBeenCalled();
  });

  it("watchAllReferences subscribes references ordered desc", () => {
    const callback = vi.fn();
    watchAllReferences(callback);
    expect(mockFns.collection).toHaveBeenCalledWith({ key: "db" }, "references");
    expect(mockFns.orderBy).toHaveBeenCalledWith("timestamp", "desc");
    expect(mockFns.onSnapshot).toHaveBeenCalled();
  });

  it("watchAllExercises subscribes exercises ordered desc", () => {
    const callback = vi.fn();
    watchAllExercises(callback);
    expect(mockFns.collection).toHaveBeenCalledWith({ key: "db" }, "exercises");
    expect(mockFns.orderBy).toHaveBeenCalledWith("timestamp", "desc");
    expect(mockFns.onSnapshot).toHaveBeenCalled();
  });

  it("watchPrivateLessonPlansByTeacher filters by teacher id", () => {
    const callback = vi.fn();
    watchPrivateLessonPlansByTeacher("teacher-42", callback);
    expect(mockFns.collection).toHaveBeenCalledWith({ key: "db" }, "lessonPlans");
    expect(mockFns.where).toHaveBeenCalledWith("teacherId", "==", "teacher-42");
    expect(mockFns.onSnapshot).toHaveBeenCalled();
  });

  it("watchAllPrivateLessonPlans subscribes ordered desc", () => {
    const callback = vi.fn();
    watchAllPrivateLessonPlans(callback);
    expect(mockFns.collection).toHaveBeenCalledWith({ key: "db" }, "lessonPlans");
    expect(mockFns.orderBy).toHaveBeenCalledWith("timestamp", "desc");
    expect(mockFns.onSnapshot).toHaveBeenCalled();
  });

  it("createLesson adds server timestamp", async () => {
    mockFns.addDoc.mockResolvedValue({ id: "new" });
    await createLesson({ title: "A" });
    expect(mockFns.addDoc).toHaveBeenCalledWith(
      "lessons",
      expect.objectContaining({ title: "A", timestamp: "TS" })
    );
  });

  it("updateLesson updates by lesson id", async () => {
    mockFns.updateDoc.mockResolvedValue(undefined);
    await updateLesson("l1", { title: "B" });
    expect(mockFns.updateDoc).toHaveBeenCalledWith("lessons/l1", { title: "B" });
  });

  it("createReference adds server timestamp", async () => {
    mockFns.addDoc.mockResolvedValue({ id: "ref-1" });
    await createReference({ title: "Ref" });
    expect(mockFns.addDoc).toHaveBeenCalledWith(
      "references",
      expect.objectContaining({ title: "Ref", timestamp: "TS" })
    );
  });

  it("updateReference updates by reference id", async () => {
    mockFns.updateDoc.mockResolvedValue(undefined);
    await updateReference("r1", { title: "R" });
    expect(mockFns.updateDoc).toHaveBeenCalledWith("references/r1", { title: "R" });
  });

  it("removeReference deletes by reference id", async () => {
    mockFns.deleteDoc.mockResolvedValue(undefined);
    await removeReference("r2");
    expect(mockFns.deleteDoc).toHaveBeenCalledWith("references/r2");
  });

  it("createExercise adds server timestamp", async () => {
    mockFns.addDoc.mockResolvedValue({ id: "ex-1" });
    await createExercise({ title: "Exercise" });
    expect(mockFns.addDoc).toHaveBeenCalledWith(
      "exercises",
      expect.objectContaining({ title: "Exercise", timestamp: "TS" })
    );
  });

  it("updateExercise updates by exercise id", async () => {
    mockFns.updateDoc.mockResolvedValue(undefined);
    await updateExercise("e1", { title: "E" });
    expect(mockFns.updateDoc).toHaveBeenCalledWith("exercises/e1", { title: "E" });
  });

  it("removeExercise deletes by exercise id", async () => {
    mockFns.deleteDoc.mockResolvedValue(undefined);
    await removeExercise("e2");
    expect(mockFns.deleteDoc).toHaveBeenCalledWith("exercises/e2");
  });

  it("createPrivateLessonPlan adds server timestamp", async () => {
    mockFns.addDoc.mockResolvedValue({ id: "plan-1" });
    await createPrivateLessonPlan({ title: "Plan" });
    expect(mockFns.addDoc).toHaveBeenCalledWith(
      "lessonPlans",
      expect.objectContaining({ title: "Plan", timestamp: "TS" })
    );
  });

  it("updatePrivateLessonPlan updates by plan id", async () => {
    mockFns.updateDoc.mockResolvedValue(undefined);
    await updatePrivateLessonPlan("p1", { title: "P" });
    expect(mockFns.updateDoc).toHaveBeenCalledWith("lessonPlans/p1", { title: "P" });
  });

  it("removePrivateLessonPlan deletes by plan id", async () => {
    mockFns.deleteDoc.mockResolvedValue(undefined);
    await removePrivateLessonPlan("p2");
    expect(mockFns.deleteDoc).toHaveBeenCalledWith("lessonPlans/p2");
  });

  it("removeLesson deletes by lesson id", async () => {
    mockFns.deleteDoc.mockResolvedValue(undefined);
    await removeLesson("l2");
    expect(mockFns.deleteDoc).toHaveBeenCalledWith("lessons/l2");
  });

  it("getLessonById returns null when not found", async () => {
    mockFns.getDoc.mockResolvedValue({ exists: () => false });
    await expect(getLessonById("missing")).resolves.toBeNull();
  });

  it("getLessonById merges id + data when found", async () => {
    mockFns.getDoc.mockResolvedValue({ id: "l3", exists: () => true, data: () => ({ title: "T" }) });
    await expect(getLessonById("l3")).resolves.toEqual({ id: "l3", title: "T" });
  });

  it("getReferenceById returns null when not found", async () => {
    mockFns.getDoc.mockResolvedValue({ exists: () => false });
    await expect(getReferenceById("missing")).resolves.toBeNull();
  });

  it("getReferenceById merges id + data when found", async () => {
    mockFns.getDoc.mockResolvedValue({ id: "r3", exists: () => true, data: () => ({ title: "R" }) });
    await expect(getReferenceById("r3")).resolves.toEqual({ id: "r3", title: "R" });
  });

  it("getExerciseById returns null when not found", async () => {
    mockFns.getDoc.mockResolvedValue({ exists: () => false });
    await expect(getExerciseById("missing")).resolves.toBeNull();
  });

  it("getExerciseById merges id + data when found", async () => {
    mockFns.getDoc.mockResolvedValue({ id: "e3", exists: () => true, data: () => ({ title: "E" }) });
    await expect(getExerciseById("e3")).resolves.toEqual({ id: "e3", title: "E" });
  });

  it("getPrivateLessonPlanById returns null when not found", async () => {
    mockFns.getDoc.mockResolvedValue({ exists: () => false });
    await expect(getPrivateLessonPlanById("missing")).resolves.toBeNull();
  });

  it("getPrivateLessonPlanById merges id + data when found", async () => {
    mockFns.getDoc.mockResolvedValue({ id: "p3", exists: () => true, data: () => ({ title: "Plan" }) });
    await expect(getPrivateLessonPlanById("p3")).resolves.toEqual({ id: "p3", title: "Plan" });
  });

  it("watchLessonComments subscribes ascending by timestamp", () => {
    watchLessonComments("l9", vi.fn());
    expect(mockFns.collection).toHaveBeenCalledWith({ key: "db" }, "lessons", "l9", "comments");
    expect(mockFns.orderBy).toHaveBeenCalledWith("timestamp", "asc");
    expect(mockFns.onSnapshot).toHaveBeenCalled();
  });

  it("addLessonComment adds timestamped comment", async () => {
    mockFns.addDoc.mockResolvedValue({ id: "c1" });
    await addLessonComment("l10", { text: "hello" });
    expect(mockFns.addDoc).toHaveBeenCalledWith(
      "lessons/l10/comments",
      expect.objectContaining({ text: "hello", timestamp: "TS" })
    );
  });

  it("updateUserRole updates role in users collection", async () => {
    mockFns.updateDoc.mockResolvedValue(undefined);
    await updateUserRole("u1", "teacher");
    expect(mockFns.updateDoc).toHaveBeenCalledWith("users/u1", { role: "teacher" });
  });

  it("enrollStudentByClassCode throws on missing params", async () => {
    await expect(enrollStudentByClassCode("", "ABC")).rejects.toThrow("Missing studentId or classCode");
    await expect(enrollStudentByClassCode("s1", "")).rejects.toThrow("Missing studentId or classCode");
  });

  it("enrollStudentByClassCode throws when class code invalid", async () => {
    mockFns.getDocs.mockResolvedValueOnce({ empty: true, docs: [] });
    await expect(enrollStudentByClassCode("s1", "ABC")).rejects.toThrow("Invalid class code");
  });

  it("enrollStudentByClassCode returns existing enrollment when duplicate", async () => {
    mockFns.getDocs.mockResolvedValueOnce({ empty: false, docs: [{ id: "class-1" }] });
    mockFns.getDoc.mockResolvedValueOnce({ exists: () => true });

    await expect(enrollStudentByClassCode("s1", "ABC")).resolves.toEqual({
      id: "s1_class-1",
      alreadyEnrolled: true,
      classId: "class-1"
    });
  });

  it("enrollStudentByClassCode creates new enrollment when not enrolled", async () => {
    mockFns.getDocs.mockResolvedValueOnce({ empty: false, docs: [{ id: "class-2" }] });
    mockFns.getDoc.mockResolvedValueOnce({ exists: () => false });
    mockFns.setDoc.mockResolvedValue(undefined);

    await expect(enrollStudentByClassCode("s2", " ABC ")).resolves.toEqual({
      id: "s2_class-2",
      alreadyEnrolled: false,
      classId: "class-2"
    });

    expect(mockFns.setDoc).toHaveBeenCalledWith(
      "enrollments/s2_class-2",
      expect.objectContaining({ studentId: "s2", classId: "class-2", classCode: "ABC", createdAt: "TS" })
    );
  });

  it("getStudentClassView validates params", async () => {
    await expect(getStudentClassView("", "s1")).rejects.toThrow("Missing classId or studentId");
    await expect(getStudentClassView("c1", "")).rejects.toThrow("Missing classId or studentId");
  });

  it("getStudentClassView blocks when student not enrolled", async () => {
    mockFns.getDocs.mockResolvedValueOnce({ empty: true, docs: [] });
    await expect(getStudentClassView("c1", "s1")).rejects.toThrow("Not enrolled in this class");
  });

  it("getStudentClassView throws when class missing", async () => {
    mockFns.getDocs.mockResolvedValueOnce({ empty: false, docs: [{ id: "e1" }] });
    mockFns.getDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(getStudentClassView("c1", "s1")).rejects.toThrow("Class not found");
  });

  it("getStudentClassView returns class, lessons and teacher contact", async () => {
    mockFns.getDocs
      .mockResolvedValueOnce({ empty: false, docs: [{ id: "e1" }] })
      .mockResolvedValueOnce({
        docs: [
          { id: "l1", data: () => ({ title: "Lesson 1" }) },
          { id: "l2", data: () => ({ title: "Lesson 2" }) }
        ]
      });

    mockFns.getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ name: "Math", classCode: "M01", teacherId: "t1" }) })
      .mockResolvedValueOnce({
        id: "t1",
        exists: () => true,
        data: () => ({ displayName: "Teacher One", email: "t1@mail.com", phone: "0900" })
      });

    await expect(getStudentClassView("c1", "s1")).resolves.toEqual({
      className: "Math",
      classCode: "M01",
      lessons: [
        { id: "l1", title: "Lesson 1" },
        { id: "l2", title: "Lesson 2" }
      ],
      teacher: {
        id: "t1",
        name: "Teacher One",
        email: "t1@mail.com",
        phone: "0900"
      }
    });

    expect(mockFns.where).toHaveBeenCalledWith("visible", "==", true);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  logout: vi.fn(),
  requireRoleOrRedirect: vi.fn(),
  watchUserRole: vi.fn()
}));

const firestoreMocks = vi.hoisted(() => ({
  createExercise: vi.fn(),
  createLesson: vi.fn(),
  createReference: vi.fn(),
  getExerciseById: vi.fn(),
  getLessonById: vi.fn(),
  getReferenceById: vi.fn(),
  removeExercise: vi.fn(),
  removeLesson: vi.fn(),
  removeReference: vi.fn(),
  updateExercise: vi.fn(),
  updateLesson: vi.fn(),
  updateReference: vi.fn(),
  updateUserRole: vi.fn(),
  watchAllExercises: vi.fn(),
  watchAllLessons: vi.fn(),
  watchAllReferences: vi.fn(),
  watchUsers: vi.fn(),
  lessonsCb: null,
  referencesCb: null,
  exercisesCb: null,
  usersCb: null
}));

const storageMocks = vi.hoisted(() => ({
  uploadFile: vi.fn()
}));

vi.mock("../../scripts/services/firebase/auth-service.js", () => ({
  logout: authMocks.logout,
  requireRoleOrRedirect: authMocks.requireRoleOrRedirect,
  watchUserRole: authMocks.watchUserRole
}));

vi.mock("../../scripts/services/firebase/firestore-service.js", () => ({
  createExercise: firestoreMocks.createExercise,
  createLesson: firestoreMocks.createLesson,
  createReference: firestoreMocks.createReference,
  getExerciseById: firestoreMocks.getExerciseById,
  getLessonById: firestoreMocks.getLessonById,
  getReferenceById: firestoreMocks.getReferenceById,
  removeExercise: firestoreMocks.removeExercise,
  removeLesson: firestoreMocks.removeLesson,
  removeReference: firestoreMocks.removeReference,
  updateExercise: firestoreMocks.updateExercise,
  updateLesson: firestoreMocks.updateLesson,
  updateReference: firestoreMocks.updateReference,
  updateUserRole: firestoreMocks.updateUserRole,
  watchAllExercises: firestoreMocks.watchAllExercises,
  watchAllLessons: firestoreMocks.watchAllLessons,
  watchAllReferences: firestoreMocks.watchAllReferences,
  watchUsers: firestoreMocks.watchUsers
}));

vi.mock("../../scripts/services/firebase/storage-service.js", () => ({
  uploadFile: storageMocks.uploadFile
}));

function doc(id, data) {
  return { id, data: () => data };
}

function mountTeacherDashboardDom() {
  document.body.innerHTML = `
    <button id="logoutBtn"></button>
    <button id="goProfileBtn"></button>
    <button id="goPlanDashboardBtn"></button>
    <button id="goStudentLibraryBtn"></button>
    <button id="goStudentProfileBtn" class="hidden"></button>

    <button class="composer-tab active" data-tab="lesson"></button>
    <button class="composer-tab" data-tab="reference"></button>
    <button class="composer-tab" data-tab="exercise"></button>

    <form id="lessonComposer">
      <input id="lessonTitleInput" />
      <input id="lessonVideoInput" />
      <input id="lessonDocInput" />
      <input id="lessonPptInput" />
      <input id="lessonPdfInput" />
      <input id="lessonPptFileInput" type="file" />
      <input id="lessonPdfFileInput" type="file" />
      <input id="lessonVisibleInput" type="checkbox" checked />
      <button id="lessonSaveBtn" type="submit">Lưu bài giảng</button>
      <p id="lessonToast"></p>
    </form>

    <form id="referenceComposer" class="hidden">
      <input id="referenceTitleInput" />
      <input id="referenceArticleInput" />
      <textarea id="referenceCitationInput"></textarea>
      <input id="referenceVisibleInput" type="checkbox" checked />
      <button id="referenceSaveBtn" type="submit">Lưu tài liệu tham khảo</button>
      <p id="referenceToast"></p>
    </form>

    <form id="exerciseComposer" class="hidden">
      <input id="exerciseTitleInput" />
      <input id="exerciseYoutubeInput" />
      <input id="exerciseDocsInput" />
      <input id="exercisePptInput" />
      <input id="exercisePdfInput" />
      <input id="exerciseDocsFileInput" type="file" />
      <input id="exercisePptFileInput" type="file" />
      <input id="exercisePdfFileInput" type="file" />
      <input id="exerciseVisibleInput" type="checkbox" checked />
      <button id="exerciseSaveBtn" type="submit">Lưu bài tập</button>
      <p id="exerciseToast"></p>
    </form>

    <section id="lessonListSection"></section>
    <section id="referenceListSection" class="hidden"></section>
    <section id="exerciseListSection" class="hidden"></section>
    <span id="contentCount"></span>

    <table><tbody id="lessonsTableBody"></tbody></table>
    <table><tbody id="referencesTableBody"></tbody></table>
    <table><tbody id="exercisesTableBody"></tbody></table>

    <section id="adminRoleSection" class="hidden"></section>
    <table><tbody id="userRolesTableBody"></tbody></table>
    <p id="adminToast"></p>

    <span id="metricLessons"></span>
    <span id="metricReferences"></span>
    <span id="metricExercises"></span>
  `;
}

describe("teacher-dashboard page ui flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mountTeacherDashboardDom();

    authMocks.requireRoleOrRedirect.mockResolvedValue({
      user: { uid: "teacher-1", displayName: "Teacher One" },
      role: "teacher"
    });
    authMocks.watchUserRole.mockImplementation(() => vi.fn());

    firestoreMocks.createLesson.mockResolvedValue({ id: "new-lesson" });
    firestoreMocks.createReference.mockResolvedValue({ id: "new-ref" });
    firestoreMocks.createExercise.mockResolvedValue({ id: "new-ex" });
    firestoreMocks.updateUserRole.mockResolvedValue(undefined);

    firestoreMocks.watchAllLessons.mockImplementation((cb) => {
      firestoreMocks.lessonsCb = cb;
      return vi.fn();
    });
    firestoreMocks.watchAllReferences.mockImplementation((cb) => {
      firestoreMocks.referencesCb = cb;
      return vi.fn();
    });
    firestoreMocks.watchAllExercises.mockImplementation((cb) => {
      firestoreMocks.exercisesCb = cb;
      return vi.fn();
    });
    firestoreMocks.watchUsers.mockImplementation((cb) => {
      firestoreMocks.usersCb = cb;
      return vi.fn();
    });

    storageMocks.uploadFile.mockResolvedValue("https://files.example.com/resource");
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("subscribes dashboard streams after teacher/admin gate", async () => {
    await import("../../scripts/pages/teacher-dashboard/teacher-dashboard.js");

    expect(authMocks.requireRoleOrRedirect).toHaveBeenCalledWith(["teacher", "admin"], "../login/login.html");
    expect(firestoreMocks.watchAllLessons).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.watchAllReferences).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.watchAllExercises).toHaveBeenCalledTimes(1);
  });

  it("validates lesson form and prevents empty submit", async () => {
    await import("../../scripts/pages/teacher-dashboard/teacher-dashboard.js");

    document.querySelector("#lessonComposer")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(document.querySelector("#lessonToast")?.textContent).toContain("Vui lòng nhập tiêu đề bài giảng.");
    expect(firestoreMocks.createLesson).not.toHaveBeenCalled();
  });

  it("creates lesson successfully with valid payload", async () => {
    await import("../../scripts/pages/teacher-dashboard/teacher-dashboard.js");

    document.querySelector("#lessonTitleInput").value = "Bai giang moi";
    document.querySelector("#lessonVideoInput").value = "https://youtube.com/watch?v=abcdefghijk";
    document.querySelector("#lessonDocInput").value = "";
    document.querySelector("#lessonPptInput").value = "";
    document.querySelector("#lessonPdfInput").value = "";

    document.querySelector("#lessonComposer")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(firestoreMocks.createLesson).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Bai giang moi",
        videoUrl: "https://youtube.com/watch?v=abcdefghijk",
        teacherId: "teacher-1",
        teacherName: "Teacher One"
      })
    );
    expect(document.querySelector("#lessonToast")?.textContent).toContain("Đã tạo bài giảng mới.");
  });

  it("switches composer tab and updates visible sections", async () => {
    await import("../../scripts/pages/teacher-dashboard/teacher-dashboard.js");

    const refTab = document.querySelector(".composer-tab[data-tab='reference']");
    refTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(refTab?.classList.contains("active")).toBe(true);
    expect(document.querySelector("#referenceComposer")?.classList.contains("hidden")).toBe(false);
    expect(document.querySelector("#lessonComposer")?.classList.contains("hidden")).toBe(true);
  });

  it("enables admin panel and updates user role", async () => {
    authMocks.requireRoleOrRedirect.mockResolvedValueOnce({
      user: { uid: "admin-1", displayName: "Admin One" },
      role: "admin"
    });

    await import("../../scripts/pages/teacher-dashboard/teacher-dashboard.js");

    expect(document.querySelector("#goStudentProfileBtn")?.classList.contains("hidden")).toBe(false);
    expect(document.querySelector("#adminRoleSection")?.classList.contains("hidden")).toBe(false);

    firestoreMocks.usersCb({
      docs: [doc("u1", { email: "student@x.com", displayName: "Stud", role: "student" })]
    });

    const select = document.querySelector("[data-role-user='u1']");
    select.value = "teacher";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();

    expect(firestoreMocks.updateUserRole).toHaveBeenCalledWith("u1", "teacher");
    expect(document.querySelector("#adminToast")?.textContent).toContain("Đã cập nhật quyền tài khoản.");
  });
});

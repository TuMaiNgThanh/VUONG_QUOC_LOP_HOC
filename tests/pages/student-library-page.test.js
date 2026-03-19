import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  logout: vi.fn(),
  requireRoleOrRedirect: vi.fn(),
  watchUserRole: vi.fn()
}));

const firestoreMocks = vi.hoisted(() => ({
  watchVisibleExercises: vi.fn(),
  watchVisibleLessons: vi.fn(),
  watchVisibleReferences: vi.fn(),
  lessonCb: null,
  refCb: null,
  exCb: null
}));

vi.mock("../../scripts/services/firebase/auth-service.js", () => ({
  logout: authMocks.logout,
  requireRoleOrRedirect: authMocks.requireRoleOrRedirect,
  watchUserRole: authMocks.watchUserRole
}));

vi.mock("../../scripts/services/firebase/firestore-service.js", () => ({
  watchVisibleExercises: firestoreMocks.watchVisibleExercises,
  watchVisibleLessons: firestoreMocks.watchVisibleLessons,
  watchVisibleReferences: firestoreMocks.watchVisibleReferences
}));

function doc(id, data) {
  return { id, data: () => data };
}

function mountStudentLibraryDom() {
  document.body.innerHTML = `
    <button id="logoutBtn"></button>
    <button id="goTeamBtn"></button>
    <button id="goProfileBtn"></button>
    <button id="goQuestBtn"></button>
    <button id="goMapBtn"></button>

    <button id="sectionLessonBtn" data-section="lesson" class="active"></button>
    <button id="sectionReferenceBtn" data-section="reference"></button>
    <button id="sectionExerciseBtn" data-section="exercise"></button>

    <input id="searchInput" />
    <button id="clearSearchBtn"></button>

    <p id="resultInfo"></p>
    <div id="contentGrid"></div>

    <p id="questCurrentText"></p>
    <p id="questProgressText"></p>
    <p id="mapSummaryText"></p>
    <p id="mapProgressText"></p>
    <div id="mapProgressBar"></div>

    <p id="classroomNameText"></p>
    <p id="teacherNameText"></p>
    <p id="teacherPhoneText"></p>
    <p id="teacherEmailText"></p>
  `;
}

describe("student-library page ui flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mountStudentLibraryDom();

    authMocks.requireRoleOrRedirect.mockResolvedValue({
      user: { uid: "u1" },
      role: "student"
    });
    authMocks.watchUserRole.mockImplementation(() => vi.fn());

    firestoreMocks.watchVisibleLessons.mockImplementation((cb) => {
      firestoreMocks.lessonCb = cb;
      return vi.fn();
    });
    firestoreMocks.watchVisibleReferences.mockImplementation((cb) => {
      firestoreMocks.refCb = cb;
      return vi.fn();
    });
    firestoreMocks.watchVisibleExercises.mockImplementation((cb) => {
      firestoreMocks.exCb = cb;
      return vi.fn();
    });
  });

  it("subscribes all visible streams after role gate passes", async () => {
    await import("../../scripts/pages/student-library/student-library.js");

    expect(authMocks.requireRoleOrRedirect).toHaveBeenCalledWith(["student", "teacher", "admin"], "../login/login.html");
    expect(firestoreMocks.watchVisibleLessons).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.watchVisibleReferences).toHaveBeenCalledTimes(1);
    expect(firestoreMocks.watchVisibleExercises).toHaveBeenCalledTimes(1);
  });

  it("renders lesson cards, teacher info and quest panel from snapshot", async () => {
    await import("../../scripts/pages/student-library/student-library.js");

    firestoreMocks.lessonCb({
      docs: [
        doc("l2", { title: "Bai B", teacherName: "Teacher B", visible: false, timestamp: "2026-01-01" }),
        doc("l1", { title: "Bai A", teacherName: "Teacher A", visible: true, timestamp: "2026-02-01", videoUrl: "https://youtu.be/abcdefghijk" })
      ]
    });

    expect(document.querySelector("#contentGrid")?.textContent).toContain("Bai A");
    expect(document.querySelector("#teacherNameText")?.textContent).toContain("Teacher A");
    expect(document.querySelector("#questCurrentText")?.textContent).toContain("Bai A");
    expect(document.querySelector("#mapProgressBar")?.style.width).toBe("50%");
  });

  it("filters by keyword and clears search", async () => {
    await import("../../scripts/pages/student-library/student-library.js");

    firestoreMocks.lessonCb({
      docs: [
        doc("l1", { title: "Toan nang cao", teacherName: "GV 1", visible: true }),
        doc("l2", { title: "Van hoc", teacherName: "GV 2", visible: true })
      ]
    });

    const search = document.querySelector("#searchInput");
    search.value = "toan";
    search.dispatchEvent(new Event("input", { bubbles: true }));

    expect(document.querySelector("#resultInfo")?.textContent).toContain("toan");
    expect(document.querySelector("#contentGrid")?.textContent).toContain("Toan nang cao");
    expect(document.querySelector("#contentGrid")?.textContent).not.toContain("Van hoc");

    document.querySelector("#clearSearchBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector("#searchInput")?.value).toBe("");
  });

  it("switches section to references and updates active tab state", async () => {
    await import("../../scripts/pages/student-library/student-library.js");

    firestoreMocks.refCb({
      docs: [
        doc("r1", {
          title: "Thong tu 01",
          teacherName: "GV Ref",
          articleUrl: "https://example.com/reference"
        })
      ]
    });

    document.querySelector("#sectionReferenceBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.querySelector("#sectionReferenceBtn")?.classList.contains("active")).toBe(true);
    expect(document.querySelector("#sectionLessonBtn")?.classList.contains("active")).toBe(false);
    expect(document.querySelector("#resultInfo")?.textContent).toContain("tài liệu tham khảo");
    expect(document.querySelector("#contentGrid")?.textContent).toContain("Thong tu 01");
  });

  it("stops bootstrap when role gate returns null", async () => {
    authMocks.requireRoleOrRedirect.mockResolvedValueOnce(null);

    await import("../../scripts/pages/student-library/student-library.js");

    expect(firestoreMocks.watchVisibleLessons).not.toHaveBeenCalled();
    expect(firestoreMocks.watchVisibleReferences).not.toHaveBeenCalled();
    expect(firestoreMocks.watchVisibleExercises).not.toHaveBeenCalled();
  });
});

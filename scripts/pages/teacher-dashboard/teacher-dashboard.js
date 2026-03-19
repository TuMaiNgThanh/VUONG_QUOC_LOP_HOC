import {
  createExercise,
  createLesson,
  createReference,
  getExerciseById,
  getLessonById,
  getReferenceById,
  removeExercise,
  removeLesson,
  removeReference,
  updateExercise,
  updateLesson,
  updateReference,
  updateUserRole,
  watchAllExercises,
  watchAllLessons,
  watchAllReferences,
  watchUsers
} from "../../services/firebase/firestore-service.js";
import { uploadFile } from "../../services/firebase/storage-service.js";
import { logout, requireRoleOrRedirect, watchUserRole } from "../../services/firebase/auth-service.js";

let currentUser = null;
let currentRole = null;
let activeTab = "lesson";

let currentLessonEditId = null;
let currentReferenceEditId = null;
let currentExerciseEditId = null;

let lessonsData = [];
let referencesData = [];
let exercisesData = [];

const FONT_SIZE_MAP = {
  1: "10px",
  2: "12px",
  3: "14px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "32px"
};

const LESSON_DESCRIPTION_MAX_CHARS = 1200;
const REFERENCE_CITATION_MAX_CHARS = 600;
const EXERCISE_DESCRIPTION_MAX_CHARS = 1200;

let adminRolePanelInitialized = false;

const EDITOR_LIMITS = {
  lesson: {
    editorSelector: "#lessonDescriptionEditor",
    counterSelector: "#lessonDescriptionCounter",
    maxChars: LESSON_DESCRIPTION_MAX_CHARS,
    label: "Mô tả bài giảng"
  },
  reference: {
    editorSelector: "#referenceCitationEditor",
    counterSelector: "#referenceCitationCounter",
    maxChars: REFERENCE_CITATION_MAX_CHARS,
    label: "Citation"
  },
  exercise: {
    editorSelector: "#exerciseDescriptionEditor",
    counterSelector: "#exerciseDescriptionCounter",
    maxChars: EXERCISE_DESCRIPTION_MAX_CHARS,
    label: "Mô tả bài tập"
  }
};

function fmtDate(ts) {
  if (!ts) return "...";
  if (typeof ts?.toDate === "function") return ts.toDate().toLocaleDateString("vi-VN");
  return new Date(ts).toLocaleDateString("vi-VN");
}

function extractYouTubeId(url) {
  const match = (url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

function isLikelyPowerPointUrl(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  return (
    lower.includes(".ppt") ||
    lower.includes(".pptx") ||
    lower.includes("powerpoint") ||
    lower.includes("onedrive.live.com") ||
    lower.includes("sharepoint.com") ||
    lower.includes("docs.google.com/presentation") ||
    lower.includes("drive.google.com")
  );
}

function isLikelyPdfUrl(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  return lower.includes(".pdf") || lower.includes("drive.google.com") || lower.includes("docs.google.com");
}

function isLikelyDocsUrl(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  return (
    lower.includes("docs.google.com") ||
    lower.includes("drive.google.com") ||
    lower.endsWith(".doc") ||
    lower.endsWith(".docx")
  );
}

function isLikelyExternalUrl(url) {
  if (!url) return false;
  return /^https?:\/\/.+/i.test(url.trim());
}

function isPowerPointFile(file) {
  if (!file) return true;
  const lower = (file.name || "").toLowerCase();
  return lower.endsWith(".ppt") || lower.endsWith(".pptx");
}

function isPdfFile(file) {
  if (!file) return true;
  const lower = (file.name || "").toLowerCase();
  return lower.endsWith(".pdf") || (file.type || "").toLowerCase().includes("pdf");
}

function isDocsFile(file) {
  if (!file) return true;
  const lower = (file.name || "").toLowerCase();
  return lower.endsWith(".doc") || lower.endsWith(".docx");
}

function setToast(id, message, isError = false) {
  const node = document.querySelector(id);
  if (!node) return;
  node.textContent = message;
  node.style.color = isError ? "#dc2626" : "#475569";
}

function setAdminToast(message, isError = false) {
  const node = document.querySelector("#adminToast");
  if (!node) return;
  node.textContent = message;
  node.style.color = isError ? "#dc2626" : "#475569";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html || ""), "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

function sanitizeRichHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${String(html || "")}</div>`, "text/html");
  const root = doc.body.firstElementChild;

  const sanitizeNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return doc.createTextNode(node.textContent || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return doc.createTextNode("");
    }

    const tag = node.tagName.toLowerCase();
    const allowed = new Set(["b", "strong", "i", "em", "u", "br", "p", "div", "span", "ul", "ol", "li", "font"]);

    if (!allowed.has(tag)) {
      const frag = doc.createDocumentFragment();
      node.childNodes.forEach((child) => frag.appendChild(sanitizeNode(child)));
      return frag;
    }

    const element = doc.createElement(tag === "font" ? "span" : tag);

    if (tag === "font") {
      const size = Number(node.getAttribute("size") || 3);
      const mappedSize = FONT_SIZE_MAP[size] || FONT_SIZE_MAP[3];
      element.style.fontSize = mappedSize;
    }

    if (tag === "span") {
      const styleText = String(node.getAttribute("style") || "").toLowerCase();
      const match = styleText.match(/font-size\s*:\s*([0-9]{1,2}px)/);
      const size = match?.[1];
      if (size && ["10px", "12px", "14px", "16px", "20px", "24px", "32px"].includes(size)) {
        element.style.fontSize = size;
      }
    }

    node.childNodes.forEach((child) => element.appendChild(sanitizeNode(child)));
    return element;
  };

  const cleaned = doc.createElement("div");
  root?.childNodes.forEach((child) => cleaned.appendChild(sanitizeNode(child)));
  return cleaned.innerHTML.trim();
}

function normalizeLegacyRichValue(value) {
  if (!value) return "";
  const input = String(value).trim();
  if (!input) return "";
  if (input.includes("<") && input.includes(">")) return sanitizeRichHtml(input);
  return sanitizeRichHtml(escapeHtml(input));
}

function setEditorHtml(selector, htmlValue) {
  const editor = document.querySelector(selector);
  if (!editor) return;
  editor.innerHTML = normalizeLegacyRichValue(htmlValue);
}

function getEditorPayload(selector) {
  const editor = document.querySelector(selector);
  if (!editor) return { html: "", text: "" };
  const safeHtml = sanitizeRichHtml(editor.innerHTML || "");
  editor.innerHTML = safeHtml;
  return { html: safeHtml, text: stripHtml(safeHtml) };
}

function updateEditorCounter(limitConfig) {
  if (!limitConfig) return;
  const editor = document.querySelector(limitConfig.editorSelector);
  const counter = document.querySelector(limitConfig.counterSelector);
  if (!editor || !counter) return;

  const textLength = stripHtml(editor.innerHTML || "").length;
  counter.textContent = `${textLength}/${limitConfig.maxChars} ký tự`;
  counter.classList.toggle("over-limit", textLength > limitConfig.maxChars);
}

function updateAllEditorCounters() {
  Object.values(EDITOR_LIMITS).forEach((config) => updateEditorCounter(config));
}

function validateEditorLimit(limitConfig, textValue, toastSelector) {
  if (!limitConfig) return true;
  if (textValue.length <= limitConfig.maxChars) return true;
  setToast(
    toastSelector,
    `${limitConfig.label} tối đa ${limitConfig.maxChars} ký tự. Hiện tại: ${textValue.length}.`,
    true
  );
  return false;
}

function bindRichEditor(root, onChange) {
  const content = root.querySelector(".rich-content");
  const sizeSelect = root.querySelector("[data-editor-size]");
  if (!content) return;

  root.addEventListener("click", (event) => {
    const clearBtn = event.target.closest("[data-editor-clear]");
    if (clearBtn) {
      content.textContent = content.textContent || "";
      content.focus();
      if (typeof onChange === "function") onChange();
      return;
    }

    const cmdBtn = event.target.closest("[data-editor-cmd]");
    if (!cmdBtn) return;
    const cmd = cmdBtn.getAttribute("data-editor-cmd");
    content.focus();
    document.execCommand(cmd, false);
    if (typeof onChange === "function") onChange();
  });

  sizeSelect?.addEventListener("change", (event) => {
    const size = event.target.value || "3";
    content.focus();
    document.execCommand("fontSize", false, size);
    event.target.value = "3";
    if (typeof onChange === "function") onChange();
  });

  content.addEventListener("input", () => {
    if (typeof onChange === "function") onChange();
  });
}

function roleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "teacher") return "Giáo viên";
  return "Học sinh";
}

function renderUserRoleRows(users) {
  const body = document.querySelector("#userRolesTableBody");
  if (!body) return;

  if (!users.length) {
    body.innerHTML = "<tr><td class='px-4 py-6 text-slate-400' colspan='4'>Chưa có tài khoản nào.</td></tr>";
    return;
  }

  body.innerHTML = users
    .map((user) => {
      const role = user.role || "student";
      const disableRoleSwitch = role === "admin";
      return `
      <tr>
        <td class="px-4 py-3 text-sm">${user.email || "-"}</td>
        <td class="px-4 py-3 text-sm">${user.displayName || "-"}</td>
        <td class="px-4 py-3 text-sm"><span class="role-pill role-${role}">${roleLabel(role)}</span></td>
        <td class="px-4 py-3 text-sm">
          <select class="role-select" data-role-user="${user.id}" ${disableRoleSwitch ? "disabled" : ""}>
            <option value="student" ${role === "student" ? "selected" : ""}>Học sinh</option>
            <option value="teacher" ${role === "teacher" ? "selected" : ""}>Giáo viên</option>
            <option value="admin" ${role === "admin" ? "selected" : ""}>Admin</option>
          </select>
        </td>
      </tr>`;
    })
    .join("");
}

function initAdminRolePanel() {
  const section = document.querySelector("#adminRoleSection");
  const tableBody = document.querySelector("#userRolesTableBody");
  if (!section || !tableBody) return;
  if (currentRole !== "admin") {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  if (adminRolePanelInitialized) return;
  adminRolePanelInitialized = true;

  watchUsers((snap) => {
    if (currentRole !== "admin") return;
    const users = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => (a.email || "").localeCompare(b.email || "", "vi"));
    renderUserRoleRows(users);
  });

  tableBody.addEventListener("change", async (event) => {
    const target = event.target.closest("[data-role-user]");
    if (!target) return;

    if (currentRole !== "admin") {
      setAdminToast("Chỉ admin mới có thể chỉnh quyền tài khoản.", true);
      return;
    }

    const userId = target.getAttribute("data-role-user");
    const nextRole = target.value;
    if (!userId || !nextRole) return;

    try {
      await updateUserRole(userId, nextRole);
      setAdminToast("Đã cập nhật quyền tài khoản.");
    } catch (error) {
      setAdminToast(error?.message || "Không thể cập nhật quyền.", true);
    }
  });
}

function resetLessonForm() {
  currentLessonEditId = null;
  document.querySelector("#lessonTitleInput").value = "";
  document.querySelector("#lessonVideoInput").value = "";
  document.querySelector("#lessonDocInput").value = "";
  document.querySelector("#lessonPptInput").value = "";
  document.querySelector("#lessonPdfInput").value = "";
  document.querySelector("#lessonPptFileInput").value = "";
  document.querySelector("#lessonPdfFileInput").value = "";
  document.querySelector("#lessonVisibleInput").checked = true;
  document.querySelector("#lessonSaveBtn").textContent = "Lưu bài giảng";
  setEditorHtml("#lessonDescriptionEditor", "");
  updateEditorCounter(EDITOR_LIMITS.lesson);
}

function resetReferenceForm() {
  currentReferenceEditId = null;
  document.querySelector("#referenceTitleInput").value = "";
  document.querySelector("#referenceArticleInput").value = "";
  setEditorHtml("#referenceCitationEditor", "");
  document.querySelector("#referenceVisibleInput").checked = true;
  document.querySelector("#referenceSaveBtn").textContent = "Lưu tài liệu tham khảo";
  updateEditorCounter(EDITOR_LIMITS.reference);
}

function resetExerciseForm() {
  currentExerciseEditId = null;
  document.querySelector("#exerciseTitleInput").value = "";
  document.querySelector("#exerciseYoutubeInput").value = "";
  document.querySelector("#exerciseDocsInput").value = "";
  document.querySelector("#exercisePptInput").value = "";
  document.querySelector("#exercisePdfInput").value = "";
  document.querySelector("#exerciseDocsFileInput").value = "";
  document.querySelector("#exercisePptFileInput").value = "";
  document.querySelector("#exercisePdfFileInput").value = "";
  document.querySelector("#exerciseVisibleInput").checked = true;
  document.querySelector("#exerciseSaveBtn").textContent = "Lưu bài tập";
  setEditorHtml("#exerciseDescriptionEditor", "");
  updateEditorCounter(EDITOR_LIMITS.exercise);
}

function updateMetrics() {
  const lessonsMetric = document.querySelector("#metricLessons");
  const refsMetric = document.querySelector("#metricReferences");
  const exMetric = document.querySelector("#metricExercises");
  if (lessonsMetric) lessonsMetric.textContent = `${lessonsData.length}`;
  if (refsMetric) refsMetric.textContent = `${referencesData.length}`;
  if (exMetric) exMetric.textContent = `${exercisesData.length}`;
}

function setActiveTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".composer-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
  });

  const formMap = {
    lesson: "#lessonComposer",
    reference: "#referenceComposer",
    exercise: "#exerciseComposer"
  };
  Object.entries(formMap).forEach(([key, selector]) => {
    document.querySelector(selector)?.classList.toggle("hidden", key !== tab);
  });

  const listMap = {
    lesson: "#lessonListSection",
    reference: "#referenceListSection",
    exercise: "#exerciseListSection"
  };
  Object.entries(listMap).forEach(([key, selector]) => {
    document.querySelector(selector)?.classList.toggle("hidden", key !== tab);
  });

  const count = document.querySelector("#contentCount");
  if (!count) return;
  if (tab === "lesson") count.textContent = `${lessonsData.length} bài giảng`;
  if (tab === "reference") count.textContent = `${referencesData.length} tài liệu`;
  if (tab === "exercise") count.textContent = `${exercisesData.length} bài tập`;
}

function lessonTagRow(item) {
  return `
    <div class="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-2">
      ${item.videoUrl ? "<span class='px-2 py-0.5 rounded bg-red-50 text-red-600'>YouTube</span>" : ""}
      ${item.docUrl ? "<span class='px-2 py-0.5 rounded bg-indigo-50 text-indigo-600'>Drive</span>" : ""}
      ${item.pptUrl ? "<span class='px-2 py-0.5 rounded bg-amber-50 text-amber-700'>PPT</span>" : ""}
      ${item.pdfUrl ? "<span class='px-2 py-0.5 rounded bg-rose-50 text-rose-700'>PDF</span>" : ""}
    </div>`;
}

function referenceTagRow(item) {
  const citation = stripHtml(item.citationHtml || item.citation || "");
  return `
    <div class="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-2">
      ${item.articleUrl || item.pdfUrl ? "<span class='px-2 py-0.5 rounded bg-indigo-50 text-indigo-700'>Thông tư</span>" : ""}
      ${citation ? "<span class='px-2 py-0.5 rounded bg-emerald-50 text-emerald-700'>Citation</span>" : ""}
    </div>`;
}

function exerciseTagRow(item) {
  return `
    <div class="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-2">
      ${item.youtubeUrl ? "<span class='px-2 py-0.5 rounded bg-red-50 text-red-600'>YouTube</span>" : ""}
      ${item.docsUrl ? "<span class='px-2 py-0.5 rounded bg-indigo-50 text-indigo-600'>Google Docs</span>" : ""}
      ${item.pptUrl ? "<span class='px-2 py-0.5 rounded bg-amber-50 text-amber-700'>PPT</span>" : ""}
      ${item.pdfUrl ? "<span class='px-2 py-0.5 rounded bg-rose-50 text-rose-700'>PDF</span>" : ""}
    </div>`;
}

function renderLessonsTable() {
  const body = document.querySelector("#lessonsTableBody");
  if (!body) return;
  if (!lessonsData.length) {
    body.innerHTML = "<tr><td class='px-4 py-8 text-slate-400' colspan='4'>Chưa có bài giảng nào.</td></tr>";
    return;
  }

  body.innerHTML = lessonsData
    .map((item) => {
      const ytId = extractYouTubeId(item.videoUrl);
      const descriptionText = stripHtml(item.descriptionHtml || item.description || "");
      return `
        <tr>
          <td class="px-4 py-3">
            <div class="font-semibold">${item.title || "Không có tiêu đề"}</div>
            <div class="text-xs text-slate-400 truncate max-w-64">${ytId ? `youtube.com/watch?v=${ytId}` : item.videoUrl || ""}</div>
            ${descriptionText ? `<div class="text-xs text-slate-500 mt-1 truncate max-w-80">${descriptionText}</div>` : ""}
            ${lessonTagRow(item)}
          </td>
          <td class="px-4 py-3"><span class="${item.visible ? "status-public" : "status-private"}">${item.visible ? "Công khai" : "Ẩn"}</span></td>
          <td class="px-4 py-3 text-sm text-slate-500">${fmtDate(item.timestamp)}</td>
          <td class="px-4 py-3 text-right">
            <button class="action-btn" data-lesson-edit-id="${item.id}">Sửa</button>
            <button class="action-btn" data-lesson-delete-id="${item.id}">Xóa</button>
          </td>
        </tr>`;
    })
    .join("");
}

function renderReferencesTable() {
  const body = document.querySelector("#referencesTableBody");
  if (!body) return;
  if (!referencesData.length) {
    body.innerHTML = "<tr><td class='px-4 py-8 text-slate-400' colspan='4'>Chưa có tài liệu tham khảo nào.</td></tr>";
    return;
  }

  body.innerHTML = referencesData
    .map((item) => `
      <tr>
        <td class="px-4 py-3">
          <div class="font-semibold">${item.title || "Không có tiêu đề"}</div>
          <div class="text-xs text-slate-400 truncate max-w-64">${item.articleUrl || item.pdfUrl || ""}</div>
          ${stripHtml(item.citationHtml || item.citation || "") ? `<div class="text-xs text-slate-500 truncate max-w-64 mt-1">${stripHtml(item.citationHtml || item.citation || "")}</div>` : ""}
          ${referenceTagRow(item)}
        </td>
        <td class="px-4 py-3"><span class="${item.visible ? "status-public" : "status-private"}">${item.visible ? "Công khai" : "Ẩn"}</span></td>
        <td class="px-4 py-3 text-sm text-slate-500">${fmtDate(item.timestamp)}</td>
        <td class="px-4 py-3 text-right">
          <button class="action-btn" data-reference-edit-id="${item.id}">Sửa</button>
          <button class="action-btn" data-reference-delete-id="${item.id}">Xóa</button>
        </td>
      </tr>
    `)
    .join("");
}

function renderExercisesTable() {
  const body = document.querySelector("#exercisesTableBody");
  if (!body) return;
  if (!exercisesData.length) {
    body.innerHTML = "<tr><td class='px-4 py-8 text-slate-400' colspan='4'>Chưa có bài tập nào.</td></tr>";
    return;
  }

  body.innerHTML = exercisesData
    .map((item) => `
      <tr>
        <td class="px-4 py-3">
          <div class="font-semibold">${item.title || "Không có tiêu đề"}</div>
          <div class="text-xs text-slate-400 truncate max-w-64">${item.youtubeUrl || item.docsUrl || item.pptUrl || item.pdfUrl || ""}</div>
          ${stripHtml(item.descriptionHtml || item.description || "") ? `<div class="text-xs text-slate-500 mt-1 truncate max-w-80">${stripHtml(item.descriptionHtml || item.description || "")}</div>` : ""}
          ${exerciseTagRow(item)}
        </td>
        <td class="px-4 py-3"><span class="${item.visible ? "status-public" : "status-private"}">${item.visible ? "Công khai" : "Ẩn"}</span></td>
        <td class="px-4 py-3 text-sm text-slate-500">${fmtDate(item.timestamp)}</td>
        <td class="px-4 py-3 text-right">
          <button class="action-btn" data-exercise-edit-id="${item.id}">Sửa</button>
          <button class="action-btn" data-exercise-delete-id="${item.id}">Xóa</button>
        </td>
      </tr>
    `)
    .join("");
}

async function handleLessonEdit(id) {
  const item = await getLessonById(id);
  if (!item) return;
  currentLessonEditId = item.id;
  document.querySelector("#lessonTitleInput").value = item.title || "";
  document.querySelector("#lessonVideoInput").value = item.videoUrl || "";
  document.querySelector("#lessonDocInput").value = item.docUrl || "";
  document.querySelector("#lessonPptInput").value = item.pptUrl || "";
  document.querySelector("#lessonPdfInput").value = item.pdfUrl || "";
  document.querySelector("#lessonPptFileInput").value = "";
  document.querySelector("#lessonPdfFileInput").value = "";
  document.querySelector("#lessonVisibleInput").checked = !!item.visible;
  document.querySelector("#lessonSaveBtn").textContent = "Cập nhật bài giảng";
  setEditorHtml("#lessonDescriptionEditor", item.descriptionHtml || item.description || "");
  updateEditorCounter(EDITOR_LIMITS.lesson);
  setActiveTab("lesson");
}

async function handleReferenceEdit(id) {
  const item = await getReferenceById(id);
  if (!item) return;
  currentReferenceEditId = item.id;
  document.querySelector("#referenceTitleInput").value = item.title || "";
  document.querySelector("#referenceArticleInput").value = item.articleUrl || item.pdfUrl || "";
  setEditorHtml("#referenceCitationEditor", item.citationHtml || item.citation || "");
  document.querySelector("#referenceVisibleInput").checked = !!item.visible;
  document.querySelector("#referenceSaveBtn").textContent = "Cập nhật tài liệu";
  updateEditorCounter(EDITOR_LIMITS.reference);
  setActiveTab("reference");
}

async function handleExerciseEdit(id) {
  const item = await getExerciseById(id);
  if (!item) return;
  currentExerciseEditId = item.id;
  document.querySelector("#exerciseTitleInput").value = item.title || "";
  document.querySelector("#exerciseYoutubeInput").value = item.youtubeUrl || "";
  document.querySelector("#exerciseDocsInput").value = item.docsUrl || "";
  document.querySelector("#exercisePptInput").value = item.pptUrl || "";
  document.querySelector("#exercisePdfInput").value = item.pdfUrl || "";
  document.querySelector("#exerciseDocsFileInput").value = "";
  document.querySelector("#exercisePptFileInput").value = "";
  document.querySelector("#exercisePdfFileInput").value = "";
  document.querySelector("#exerciseVisibleInput").checked = !!item.visible;
  document.querySelector("#exerciseSaveBtn").textContent = "Cập nhật bài tập";
  setEditorHtml("#exerciseDescriptionEditor", item.descriptionHtml || item.description || "");
  updateEditorCounter(EDITOR_LIMITS.exercise);
  setActiveTab("exercise");
}

async function bootstrap() {
  const gate = await requireRoleOrRedirect(["teacher", "admin"], "../login/login.html");
  if (!gate) return;
  currentUser = gate.user;
  currentRole = gate.role;

  watchUserRole(currentUser.uid, (nextRole) => {
    if (!nextRole || nextRole === currentRole) return;
    currentRole = nextRole;

    if (nextRole !== "teacher" && nextRole !== "admin") {
      window.location.href = "../student-library/student-library.html";
      return;
    }

    if (nextRole === "admin") {
      document.querySelector("#goStudentProfileBtn")?.classList.remove("hidden");
      initAdminRolePanel();
    } else {
      document.querySelector("#goStudentProfileBtn")?.classList.add("hidden");
      document.querySelector("#adminRoleSection")?.classList.add("hidden");
    }
  });

  document.querySelector("#logoutBtn")?.addEventListener("click", async () => {
    await logout();
    window.location.href = "../login/login.html";
  });

  document.querySelector("#goProfileBtn")?.addEventListener("click", () => {
    window.location.href = "../student-profile/student-profile.html";
  });

  document.querySelector("#goPlanDashboardBtn")?.addEventListener("click", () => {
    window.location.href = "../teacher-plan-dashboard/teacher-plan-dashboard.html";
  });

  document.querySelector("#goStudentLibraryBtn")?.addEventListener("click", () => {
    window.location.href = "../student-library/student-library.html?preview=teacher";
  });

  document.querySelector("#goStudentProfileBtn")?.addEventListener("click", () => {
    window.location.href = "../student-profile/student-profile.html";
  });

  document.querySelectorAll(".composer-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveTab(btn.getAttribute("data-tab"));
    });
  });

  document.querySelector("#lessonComposer")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = document.querySelector("#lessonTitleInput").value.trim();
    const videoUrl = document.querySelector("#lessonVideoInput").value.trim();
    const docUrl = document.querySelector("#lessonDocInput").value.trim();
    let pptUrl = document.querySelector("#lessonPptInput").value.trim();
    let pdfUrl = document.querySelector("#lessonPdfInput").value.trim();
    const pptFile = document.querySelector("#lessonPptFileInput")?.files?.[0] || null;
    const pdfFile = document.querySelector("#lessonPdfFileInput")?.files?.[0] || null;
    const visible = document.querySelector("#lessonVisibleInput").checked;
    const description = getEditorPayload("#lessonDescriptionEditor");

    if (!title) return setToast("#lessonToast", "Vui lòng nhập tiêu đề bài giảng.", true);
    if (!(videoUrl || docUrl || pptUrl || pdfUrl || pptFile || pdfFile)) {
      return setToast("#lessonToast", "Bài giảng cần ít nhất 1 tài nguyên.", true);
    }
    if (!isLikelyPowerPointUrl(pptUrl)) return setToast("#lessonToast", "Link PowerPoint chưa hợp lệ.", true);
    if (!isLikelyPdfUrl(pdfUrl)) return setToast("#lessonToast", "Link PDF chưa hợp lệ.", true);
    if (!isPowerPointFile(pptFile)) return setToast("#lessonToast", "File PPT chỉ nhận .ppt/.pptx.", true);
    if (!isPdfFile(pdfFile)) return setToast("#lessonToast", "File PDF chỉ nhận .pdf.", true);
    if (!validateEditorLimit(EDITOR_LIMITS.lesson, description.text, "#lessonToast")) return;

    try {
      if (pptFile) {
        setToast("#lessonToast", "Đang tải file PPT bài giảng...");
        pptUrl = await uploadFile({ file: pptFile, userId: currentUser.uid, folder: "lesson-ppt" });
      }
      if (pdfFile) {
        setToast("#lessonToast", "Đang tải file PDF bài giảng...");
        pdfUrl = await uploadFile({ file: pdfFile, userId: currentUser.uid, folder: "lesson-pdf" });
      }

      const payload = {
        title,
        videoUrl,
        docUrl,
        pptUrl,
        pdfUrl,
        descriptionHtml: description.html,
        description: description.text,
        visible,
        teacherId: currentUser.uid,
        teacherName: currentUser.displayName || "Teacher"
      };

      if (currentLessonEditId) {
        await updateLesson(currentLessonEditId, payload);
        setToast("#lessonToast", "Đã cập nhật bài giảng.");
      } else {
        await createLesson(payload);
        setToast("#lessonToast", "Đã tạo bài giảng mới.");
      }
      resetLessonForm();
    } catch (error) {
      setToast("#lessonToast", error?.message || "Không thể lưu bài giảng.", true);
    }
  });

  document.querySelector("#referenceComposer")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = document.querySelector("#referenceTitleInput").value.trim();
    const articleUrl = document.querySelector("#referenceArticleInput").value.trim();
    const citation = getEditorPayload("#referenceCitationEditor");
    const visible = document.querySelector("#referenceVisibleInput").checked;

    if (!title) return setToast("#referenceToast", "Vui lòng nhập tiêu đề tài liệu tham khảo.", true);
    if (!articleUrl) return setToast("#referenceToast", "Vui lòng nhập link bài thông tư.", true);
    if (!isLikelyExternalUrl(articleUrl)) return setToast("#referenceToast", "Link bài thông tư chưa hợp lệ.", true);
    if (!citation.text) return setToast("#referenceToast", "Vui lòng nhập citation.", true);
    if (!validateEditorLimit(EDITOR_LIMITS.reference, citation.text, "#referenceToast")) return;

    try {
      const payload = {
        title,
        articleUrl,
        citationHtml: citation.html,
        citation: citation.text,
        visible,
        teacherId: currentUser.uid,
        teacherName: currentUser.displayName || "Teacher"
      };

      if (currentReferenceEditId) {
        await updateReference(currentReferenceEditId, payload);
        setToast("#referenceToast", "Đã cập nhật tài liệu tham khảo.");
      } else {
        await createReference(payload);
        setToast("#referenceToast", "Đã tạo tài liệu tham khảo.");
      }
      resetReferenceForm();
    } catch (error) {
      setToast("#referenceToast", error?.message || "Không thể lưu tài liệu tham khảo.", true);
    }
  });

  document.querySelector("#exerciseComposer")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = document.querySelector("#exerciseTitleInput").value.trim();
    const youtubeUrl = document.querySelector("#exerciseYoutubeInput").value.trim();
    let docsUrl = document.querySelector("#exerciseDocsInput").value.trim();
    let pptUrl = document.querySelector("#exercisePptInput").value.trim();
    let pdfUrl = document.querySelector("#exercisePdfInput").value.trim();
    const docsFile = document.querySelector("#exerciseDocsFileInput")?.files?.[0] || null;
    const pptFile = document.querySelector("#exercisePptFileInput")?.files?.[0] || null;
    const pdfFile = document.querySelector("#exercisePdfFileInput")?.files?.[0] || null;
    const visible = document.querySelector("#exerciseVisibleInput").checked;
    const description = getEditorPayload("#exerciseDescriptionEditor");

    if (!title) return setToast("#exerciseToast", "Vui lòng nhập tiêu đề bài tập.", true);
    if (!(youtubeUrl || docsUrl || pptUrl || pdfUrl || docsFile || pptFile || pdfFile)) {
      return setToast("#exerciseToast", "Bài tập cần ít nhất 1 trong 4 dạng: YouTube/PPT/PDF/Google Docs.", true);
    }
    if (!isLikelyDocsUrl(docsUrl)) return setToast("#exerciseToast", "Link Google Docs chưa hợp lệ.", true);
    if (!isLikelyPowerPointUrl(pptUrl)) return setToast("#exerciseToast", "Link PPT chưa hợp lệ.", true);
    if (!isLikelyPdfUrl(pdfUrl)) return setToast("#exerciseToast", "Link PDF chưa hợp lệ.", true);
    if (!isDocsFile(docsFile)) return setToast("#exerciseToast", "File Docs chỉ nhận .doc/.docx.", true);
    if (!isPowerPointFile(pptFile)) return setToast("#exerciseToast", "File PPT chỉ nhận .ppt/.pptx.", true);
    if (!isPdfFile(pdfFile)) return setToast("#exerciseToast", "File PDF chỉ nhận .pdf.", true);
    if (!validateEditorLimit(EDITOR_LIMITS.exercise, description.text, "#exerciseToast")) return;

    try {
      if (docsFile) {
        setToast("#exerciseToast", "Đang tải file Docs bài tập...");
        docsUrl = await uploadFile({ file: docsFile, userId: currentUser.uid, folder: "exercise-docs" });
      }
      if (pptFile) {
        setToast("#exerciseToast", "Đang tải file PPT bài tập...");
        pptUrl = await uploadFile({ file: pptFile, userId: currentUser.uid, folder: "exercise-ppt" });
      }
      if (pdfFile) {
        setToast("#exerciseToast", "Đang tải file PDF bài tập...");
        pdfUrl = await uploadFile({ file: pdfFile, userId: currentUser.uid, folder: "exercise-pdf" });
      }

      const payload = {
        title,
        youtubeUrl,
        docsUrl,
        pptUrl,
        pdfUrl,
        descriptionHtml: description.html,
        description: description.text,
        visible,
        teacherId: currentUser.uid,
        teacherName: currentUser.displayName || "Teacher"
      };

      if (currentExerciseEditId) {
        await updateExercise(currentExerciseEditId, payload);
        setToast("#exerciseToast", "Đã cập nhật bài tập.");
      } else {
        await createExercise(payload);
        setToast("#exerciseToast", "Đã tạo bài tập mới.");
      }
      resetExerciseForm();
    } catch (error) {
      setToast("#exerciseToast", error?.message || "Không thể lưu bài tập.", true);
    }
  });

  document.querySelector("#lessonsTableBody")?.addEventListener("click", async (event) => {
    const editBtn = event.target.closest("[data-lesson-edit-id]");
    const deleteBtn = event.target.closest("[data-lesson-delete-id]");
    if (editBtn) return handleLessonEdit(editBtn.getAttribute("data-lesson-edit-id"));
    if (deleteBtn) {
      if (!window.confirm("Xóa bài giảng này?")) return;
      await removeLesson(deleteBtn.getAttribute("data-lesson-delete-id"));
      setToast("#lessonToast", "Đã xóa bài giảng.");
    }
  });

  document.querySelector("#referencesTableBody")?.addEventListener("click", async (event) => {
    const editBtn = event.target.closest("[data-reference-edit-id]");
    const deleteBtn = event.target.closest("[data-reference-delete-id]");
    if (editBtn) return handleReferenceEdit(editBtn.getAttribute("data-reference-edit-id"));
    if (deleteBtn) {
      if (!window.confirm("Xóa tài liệu tham khảo này?")) return;
      await removeReference(deleteBtn.getAttribute("data-reference-delete-id"));
      setToast("#referenceToast", "Đã xóa tài liệu tham khảo.");
    }
  });

  document.querySelector("#exercisesTableBody")?.addEventListener("click", async (event) => {
    const editBtn = event.target.closest("[data-exercise-edit-id]");
    const deleteBtn = event.target.closest("[data-exercise-delete-id]");
    if (editBtn) return handleExerciseEdit(editBtn.getAttribute("data-exercise-edit-id"));
    if (deleteBtn) {
      if (!window.confirm("Xóa bài tập này?")) return;
      await removeExercise(deleteBtn.getAttribute("data-exercise-delete-id"));
      setToast("#exerciseToast", "Đã xóa bài tập.");
    }
  });

  watchAllLessons((snap) => {
    lessonsData = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderLessonsTable();
    updateMetrics();
    setActiveTab(activeTab);
  });

  watchAllReferences((snap) => {
    referencesData = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderReferencesTable();
    updateMetrics();
    setActiveTab(activeTab);
  });

  watchAllExercises((snap) => {
    exercisesData = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderExercisesTable();
    updateMetrics();
    setActiveTab(activeTab);
  });

  if (currentRole === "admin") {
    document.querySelector("#goStudentProfileBtn")?.classList.remove("hidden");
    initAdminRolePanel();
  } else {
    document.querySelector("#goStudentProfileBtn")?.classList.add("hidden");
    document.querySelector("#adminRoleSection")?.classList.add("hidden");
  }

  document.querySelectorAll(".rich-editor").forEach((root) => {
    const key = root.getAttribute("data-editor-root");
    bindRichEditor(root, () => updateEditorCounter(EDITOR_LIMITS[key]));
    updateEditorCounter(EDITOR_LIMITS[key]);
  });

  updateAllEditorCounters();

  setActiveTab("lesson");
}

bootstrap();

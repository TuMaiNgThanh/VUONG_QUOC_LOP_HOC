import {
  watchVisibleExercises,
  watchVisibleLessons,
  watchVisibleReferences
} from "../../services/firebase/firestore-service.js";
import { logout, requireRoleOrRedirect, watchUserRole } from "../../services/firebase/auth-service.js";

let allLessons = [];
let allReferences = [];
let allExercises = [];
let activeSection = "lesson";
let currentRole = "student";
let previewMode = false;

const DEFAULT_CLASSROOM = "Lớp A1 - Classroom Kingdom";
const DEFAULT_TEACHER_PHONE = "0900 000 000";
const DEFAULT_TEACHER_EMAIL = "teacher@classroom.edu";

const FONT_SIZE_MAP = {
  1: "10px",
  2: "12px",
  3: "14px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "32px"
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function normalizeRichValue(value) {
  if (!value) return "";
  const input = String(value).trim();
  if (!input) return "";
  if (input.includes("<") && input.includes(">")) return sanitizeRichHtml(input);
  return sanitizeRichHtml(escapeHtml(input));
}

function getTimestampValue(ts) {
  if (!ts) return 0;
  if (typeof ts?.toDate === "function") return ts.toDate().getTime();
  const value = new Date(ts).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function updateQuestAndMapPanel() {
  const questCurrentText = document.querySelector("#questCurrentText");
  const questProgressText = document.querySelector("#questProgressText");
  const mapSummaryText = document.querySelector("#mapSummaryText");
  const mapProgressText = document.querySelector("#mapProgressText");
  const mapProgressBar = document.querySelector("#mapProgressBar");
  if (!questCurrentText || !questProgressText || !mapSummaryText || !mapProgressText || !mapProgressBar) return;

  const total = allLessons.length;
  const visible = allLessons.filter((item) => item.visible).length;
  const current = allLessons[0]?.title || "Không có nhiệm vụ mới";
  const progress = total === 0 ? 0 : Math.round((visible / total) * 100);

  questCurrentText.textContent = current;
  questProgressText.textContent = `${progress}% hoan thanh`;
  mapSummaryText.textContent = total === 0 ? "Chưa có vùng nào được mở." : `Đã mở ${visible} vùng tri thức, còn ${Math.max(total - visible, 0)} vùng đang ẩn.`;
  mapProgressText.textContent = `${visible} / ${total} vùng đã mở`;
  mapProgressBar.style.width = `${progress}%`;
}

function pickTeacherName() {
  return (
    allLessons[0]?.teacherName ||
    allReferences[0]?.teacherName ||
    allExercises[0]?.teacherName ||
    "Đang cập nhật"
  );
}

function updateTeacherInfoPanel() {
  const classroomNameText = document.querySelector("#classroomNameText");
  const teacherNameText = document.querySelector("#teacherNameText");
  const teacherPhoneText = document.querySelector("#teacherPhoneText");
  const teacherEmailText = document.querySelector("#teacherEmailText");
  if (!classroomNameText || !teacherNameText || !teacherPhoneText || !teacherEmailText) return;

  classroomNameText.textContent = DEFAULT_CLASSROOM;
  teacherNameText.textContent = pickTeacherName();
  teacherPhoneText.textContent = DEFAULT_TEACHER_PHONE;
  teacherEmailText.textContent = DEFAULT_TEACHER_EMAIL;
}

function extractYouTubeId(url) {
  const match = (url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

function safeExternalUrl(url) {
  if (!url) return "";
  const value = String(url).trim();
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return "";
}

function defaultThumb(type) {
  if (type === "reference") return "https://placehold.co/640x360/d1fae5/064e3b?text=Reference";
  if (type === "exercise") return "https://placehold.co/640x360/ffedd5/7c2d12?text=Exercise";
  return "https://placehold.co/640x360/e0e7ff/111827?text=Lesson";
}

function cardTemplate(lesson) {
  const ytId = extractYouTubeId(lesson.videoUrl);
  const thumbnail = ytId
    ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
    : defaultThumb("lesson");
  const safeDocUrl = safeExternalUrl(lesson.docUrl);
  const safePptUrl = safeExternalUrl(lesson.pptUrl);
  const descriptionHtml = normalizeRichValue(lesson.descriptionHtml || lesson.description || "");

  return `
    <article class="lesson-card" data-lesson-id="${lesson.id}">
      <img class="thumb" src="${thumbnail}" alt="${lesson.title || "Lesson"}" />
      <div class="p-4">
        <h3 class="font-bold line-clamp-1">${lesson.title || "Không có tiêu đề"}</h3>
        <p class="text-xs text-slate-500 mt-1">${lesson.teacherName || "Giáo viên"}</p>
        <div class="card-meta">
          ${lesson.pdfUrl ? `<a class="meta-chip pdf" href="../pdf-reader/pdf-reader.html?url=${encodeURIComponent(lesson.pdfUrl)}&title=${encodeURIComponent(lesson.title || "Tài liệu PDF")}" data-pdf-link="true"><span class="material-symbols-outlined text-sm">picture_as_pdf</span>PDF</a>` : ""}
          ${safeDocUrl ? `<a class="meta-chip docs" href="${safeDocUrl}" target="_blank" rel="noopener noreferrer"><span class="material-symbols-outlined text-sm">description</span>Drive</a>` : ""}
          ${safePptUrl ? `<a class="meta-chip ppt" href="${safePptUrl}" target="_blank" rel="noopener noreferrer"><span class="material-symbols-outlined text-sm">slideshow</span>PPT</a>` : ""}
        </div>
        ${descriptionHtml ? `<div class="rich-preview mt-2">${descriptionHtml}</div>` : ""}
      </div>
    </article>`;
}

function referenceCardTemplate(reference) {
  const thumbnail = reference.coverImageUrl || defaultThumb("reference");
  const articleUrl = safeExternalUrl(reference.articleUrl || reference.pdfUrl);
  const citationHtml = normalizeRichValue(reference.citationHtml || reference.citation || "");

  return `
    <article class="lesson-card">
      <img class="thumb" src="${thumbnail}" alt="${reference.title || "Reference"}" />
      <div class="p-4">
        <h3 class="font-bold line-clamp-1">${reference.title || "Không có tiêu đề"}</h3>
        <p class="text-xs text-slate-500 mt-1">${reference.teacherName || "Giáo viên"}</p>
        <div class="card-meta">
          ${articleUrl ? `<a class="meta-chip docs" href="${articleUrl}" target="_blank" rel="noopener noreferrer"><span class="material-symbols-outlined text-sm">description</span>Mở thông tư</a>` : ""}
        </div>
        ${citationHtml ? `<div class="rich-preview mt-2">${citationHtml}</div>` : ""}
      </div>
    </article>`;
}

function exerciseCardTemplate(exercise) {
  const ytId = extractYouTubeId(exercise.youtubeUrl);
  const thumbnail = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : defaultThumb("exercise");
  const safeYoutubeUrl = safeExternalUrl(exercise.youtubeUrl);
  const safeDocsUrl = safeExternalUrl(exercise.docsUrl);
  const safePptUrl = safeExternalUrl(exercise.pptUrl);
  const descriptionHtml = normalizeRichValue(exercise.descriptionHtml || exercise.description || "");

  return `
    <article class="lesson-card">
      <img class="thumb" src="${thumbnail}" alt="${exercise.title || "Exercise"}" />
      <div class="p-4">
        <h3 class="font-bold line-clamp-1">${exercise.title || "Không có tiêu đề"}</h3>
        <p class="text-xs text-slate-500 mt-1">${exercise.teacherName || "Giáo viên"}</p>
        <div class="card-meta">
          ${safeYoutubeUrl ? `<a class="meta-chip video" href="${safeYoutubeUrl}" target="_blank" rel="noopener noreferrer"><span class="material-symbols-outlined text-sm">play_circle</span>YouTube</a>` : ""}
          ${safeDocsUrl ? `<a class="meta-chip docs" href="${safeDocsUrl}" target="_blank" rel="noopener noreferrer"><span class="material-symbols-outlined text-sm">description</span>Docs</a>` : ""}
          ${safePptUrl ? `<a class="meta-chip ppt" href="${safePptUrl}" target="_blank" rel="noopener noreferrer"><span class="material-symbols-outlined text-sm">slideshow</span>PPT</a>` : ""}
          ${exercise.pdfUrl ? `<a class="meta-chip pdf" href="../pdf-reader/pdf-reader.html?url=${encodeURIComponent(exercise.pdfUrl)}&title=${encodeURIComponent(exercise.title || "Bài tập PDF")}"><span class="material-symbols-outlined text-sm">picture_as_pdf</span>PDF</a>` : ""}
        </div>
        ${descriptionHtml ? `<div class="rich-preview mt-2">${descriptionHtml}</div>` : ""}
      </div>
    </article>`;
}

function getActiveDataSource() {
  if (activeSection === "reference") return allReferences;
  if (activeSection === "exercise") return allExercises;
  return allLessons;
}

function getActiveLabel() {
  if (activeSection === "reference") return "tài liệu tham khảo";
  if (activeSection === "exercise") return "bài tập";
  return "bài giảng";
}

function renderSectionTabs() {
  document.querySelectorAll("[data-section]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-section") === activeSection);
  });
}

function renderCards(items) {
  if (activeSection === "reference") return items.map(referenceCardTemplate).join("");
  if (activeSection === "exercise") return items.map(exerciseCardTemplate).join("");
  return items.map(cardTemplate).join("");
}

function applyFilter() {
  const keyword = (document.querySelector("#searchInput")?.value || "").trim().toLowerCase();
  const grid = document.querySelector("#contentGrid");
  const info = document.querySelector("#resultInfo");
  if (!grid || !info) return;

  const source = getActiveDataSource();

  const filtered = keyword
    ? source.filter((item) => (item.title || "").toLowerCase().includes(keyword))
    : [...source];

  if (filtered.length === 0) {
    grid.innerHTML = "<div class='bg-white border border-slate-200 rounded-2xl p-8 text-slate-500'>Không tìm thấy nội dung phù hợp.</div>";
  } else {
    grid.innerHTML = renderCards(filtered);
  }

  const label = getActiveLabel();
  info.textContent = keyword
    ? `Tìm thấy ${filtered.length} ${label} cho \"${keyword}\".`
    : `Tổng cộng ${filtered.length} ${label} đang hiển thị.`;
}

function changeSection(section) {
  activeSection = section;
  renderSectionTabs();
  applyFilter();
}

async function bootstrap() {
  const params = new URLSearchParams(window.location.search || "");
  previewMode = params.get("preview") === "teacher";

  const gate = await requireRoleOrRedirect(["student", "teacher", "admin"], "../login/login.html");
  if (!gate) return;

  currentRole = gate.role || "student";

  watchUserRole(gate.user.uid, (nextRole) => {
    if (!previewMode && (nextRole === "teacher" || nextRole === "admin")) {
      window.location.href = "../teacher-dashboard/teacher-dashboard.html";
    }
  });

  const grid = document.querySelector("#contentGrid");
  const searchInput = document.querySelector("#searchInput");
  const clearSearchBtn = document.querySelector("#clearSearchBtn");
  const logoutBtn = document.querySelector("#logoutBtn");
  const goTeamBtn = document.querySelector("#goTeamBtn");
  const goProfileBtn = document.querySelector("#goProfileBtn");
  const goQuestBtn = document.querySelector("#goQuestBtn");
  const goMapBtn = document.querySelector("#goMapBtn");
  const teacherPreviewBanner = document.querySelector("#teacherPreviewBanner");
  const backToTeacherDashboardBtn = document.querySelector("#backToTeacherDashboardBtn");
  const sectionLessonBtn = document.querySelector("#sectionLessonBtn");
  const sectionReferenceBtn = document.querySelector("#sectionReferenceBtn");
  const sectionExerciseBtn = document.querySelector("#sectionExerciseBtn");

  logoutBtn?.addEventListener("click", async () => {
    await logout();
    window.location.href = "../login/login.html";
  });

  goTeamBtn?.addEventListener("click", () => {
    window.location.href = "../team-showcase/team-showcase.html";
  });

  goProfileBtn?.addEventListener("click", () => {
    window.location.href = "../student-profile/student-profile.html";
  });

  if (previewMode) {
    if (currentRole === "teacher" || currentRole === "admin") {
      teacherPreviewBanner?.classList.remove("hidden");
      backToTeacherDashboardBtn?.addEventListener("click", () => {
        window.location.href = "../teacher-dashboard/teacher-dashboard.html";
      });
    }
    goHomeBtnTextFix();
  }

  goQuestBtn?.addEventListener("click", () => {
    const firstLessonId = allLessons[0]?.id;
    if (!firstLessonId) return;
    window.location.href = `../lesson-player/lesson-player.html?id=${firstLessonId}`;
  });

  goMapBtn?.addEventListener("click", () => {
    window.location.href = "../team-showcase/team-showcase.html";
  });

  searchInput?.addEventListener("input", applyFilter);
  clearSearchBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    applyFilter();
  });

  sectionLessonBtn?.addEventListener("click", () => changeSection("lesson"));
  sectionReferenceBtn?.addEventListener("click", () => changeSection("reference"));
  sectionExerciseBtn?.addEventListener("click", () => changeSection("exercise"));

  grid?.addEventListener("click", (event) => {
    if (event.target.closest("[data-pdf-link='true']")) return;
    if (activeSection !== "lesson") return;
    const card = event.target.closest("[data-lesson-id]");
    if (!card) return;
    const lessonId = card.getAttribute("data-lesson-id");
    window.location.href = `../lesson-player/lesson-player.html?id=${lessonId}`;
  });

  watchVisibleLessons((snap) => {
    allLessons = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => getTimestampValue(b.timestamp) - getTimestampValue(a.timestamp));
    applyFilter();
    updateQuestAndMapPanel();
    updateTeacherInfoPanel();
  });

  watchVisibleReferences((snap) => {
    allReferences = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => getTimestampValue(b.timestamp) - getTimestampValue(a.timestamp));
    applyFilter();
    updateTeacherInfoPanel();
  });

  watchVisibleExercises((snap) => {
    allExercises = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => getTimestampValue(b.timestamp) - getTimestampValue(a.timestamp));
    applyFilter();
    updateTeacherInfoPanel();
  });

  updateTeacherInfoPanel();
  renderSectionTabs();
}

function goHomeBtnTextFix() {
  const goProfileBtn = document.querySelector("#goProfileBtn");
  const goTeamBtn = document.querySelector("#goTeamBtn");
  if (currentRole === "teacher" || currentRole === "admin") {
    goProfileBtn && (goProfileBtn.textContent = "Hồ sơ giáo viên");
    goTeamBtn && (goTeamBtn.textContent = "Leaderboard");
  }
}

bootstrap();

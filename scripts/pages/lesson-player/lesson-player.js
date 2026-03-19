import {
  addLessonComment,
  getLessonById,
  watchLessonComments
} from "../../services/firebase/firestore-service.js";
import { logout, requireAuthenticatedUser } from "../../services/firebase/auth-service.js";

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

function normalizeRichValue(value) {
  if (!value) return "";
  const input = String(value).trim();
  if (!input) return "";
  if (input.includes("<") && input.includes(">")) return sanitizeRichHtml(input);
  return sanitizeRichHtml(escapeHtml(input));
}

function getCommentEditorPayload() {
  const editor = document.querySelector("#commentInput");
  if (!editor) return { html: "", text: "" };
  const safeHtml = sanitizeRichHtml(editor.innerHTML || "");
  editor.innerHTML = safeHtml;
  return { html: safeHtml, text: stripHtml(safeHtml) };
}

function bindCommentToolbar() {
  const form = document.querySelector("#commentForm");
  const editor = document.querySelector("#commentInput");
  const sizeSelect = document.querySelector("#commentFontSize");
  if (!form || !editor) return;

  form.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-comment-cmd]");
    if (!btn) return;
    const cmd = btn.getAttribute("data-comment-cmd");
    editor.focus();
    document.execCommand(cmd, false);
  });

  sizeSelect?.addEventListener("change", (event) => {
    editor.focus();
    document.execCommand("fontSize", false, event.target.value || "3");
    event.target.value = "3";
  });
}

function extractYouTubeId(url) {
  const match = (url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

function renderComments(comments) {
  const node = document.querySelector("#commentsList");
  if (!node) return;

  if (comments.length === 0) {
    node.innerHTML = "<p class='text-sm text-slate-400'>Chưa có bình luận nào.</p>";
    return;
  }

  node.innerHTML = comments
    .map((comment) => {
      const safeRich = normalizeRichValue(comment.textHtml || comment.text || "");
      return `
      <div class="comment-item">
        <p class="comment-author">${comment.userName || "Người dùng"}</p>
        <div class="comment-text comment-rich">${safeRich}</div>
      </div>`;
    })
    .join("");

  node.scrollTop = node.scrollHeight;
}

async function bootstrap() {
  const user = await requireAuthenticatedUser();
  if (!user) {
    window.location.href = "../login/login.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const lessonId = params.get("id");
  if (!lessonId) {
    window.location.href = "../student-library/student-library.html";
    return;
  }

  const lesson = await getLessonById(lessonId);
  if (!lesson) {
    document.querySelector("#lessonTitle").textContent = "Không tìm thấy bài giảng";
    return;
  }

  const titleNode = document.querySelector("#lessonTitle");
  const metaNode = document.querySelector("#lessonMeta");
  const videoWrap = document.querySelector("#videoWrap");
  const docLink = document.querySelector("#docLink");
  const resourceLinks = document.querySelector("#resourceLinks");
  const commentForm = document.querySelector("#commentForm");
  const commentInput = document.querySelector("#commentInput");
  const logoutBtn = document.querySelector("#logoutBtn");

  bindCommentToolbar();

  titleNode.textContent = lesson.title || "Bài giảng";
  metaNode.textContent = `GV: ${lesson.teacherName || "Teacher"}`;

  const ytId = extractYouTubeId(lesson.videoUrl);
  if (ytId) {
    videoWrap.innerHTML = `<iframe src="https://www.youtube.com/embed/${ytId}?rel=0" allowfullscreen title="${lesson.title || "lesson"}"></iframe>`;
  } else if (lesson.videoUrl) {
    videoWrap.innerHTML = `<a class="h-full w-full flex items-center justify-center text-white" target="_blank" rel="noreferrer" href="${lesson.videoUrl}">Mở video ở tab mới</a>`;
  } else {
    videoWrap.innerHTML = `
      <div class="h-full w-full flex flex-col items-center justify-center text-slate-200 gap-2 px-6 text-center">
        <span class="material-symbols-outlined text-5xl">slideshow</span>
        <p class="text-lg font-bold">Bài này không có video</p>
        <p class="text-sm text-slate-300">Bạn có thể học bằng tài liệu Drive/PowerPoint/PDF ở phần bên dưới.</p>
      </div>`;
  }

  if (lesson.docUrl) {
    docLink.href = lesson.docUrl;
    docLink.classList.remove("hidden");
  }

  const resourceItems = [];
  if (lesson.pptUrl) {
    resourceItems.push(`
      <a target="_blank" rel="noreferrer" href="${lesson.pptUrl}" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 text-amber-700 font-bold text-sm">
        <span class="material-symbols-outlined text-sm">slideshow</span>
        Mở PowerPoint
      </a>
    `);
  }
  if (lesson.pdfUrl) {
    const pdfReaderUrl = `../pdf-reader/pdf-reader.html?url=${encodeURIComponent(lesson.pdfUrl)}&title=${encodeURIComponent(lesson.title || "Tài liệu PDF")}`;
    resourceItems.push(`
      <a href="${pdfReaderUrl}" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-50 text-rose-700 font-bold text-sm">
        <span class="material-symbols-outlined text-sm">picture_as_pdf</span>
        Đọc PDF
      </a>
    `);
  }
  if (resourceLinks && resourceItems.length > 0) {
    resourceLinks.innerHTML = resourceItems.join("");
  }

  logoutBtn?.addEventListener("click", async () => {
    await logout();
    window.location.href = "../login/login.html";
  });

  commentForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const textPayload = getCommentEditorPayload();
    if (!textPayload.text) return;
    await addLessonComment(lessonId, {
      text: textPayload.text,
      textHtml: textPayload.html,
      userId: user.uid,
      userName: user.displayName || "Học viên",
      userPhoto: user.photoURL || ""
    });
    commentInput.innerHTML = "";
  });

  watchLessonComments(lessonId, (snap) => {
    const comments = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderComments(comments);
  });
}

bootstrap();

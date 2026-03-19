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

let currentReplyTarget = null;
let commentsLookup = new Map();

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

function getCommentLink(commentId) {
  const current = new URL(window.location.href);
  current.hash = `comment-${commentId}`;
  return current.toString();
}

function updateReplyState() {
  const replyState = document.querySelector("#replyState");
  const replyStateText = document.querySelector("#replyStateText");
  const editor = document.querySelector("#commentInput");
  if (!replyState || !replyStateText) return;

  if (!currentReplyTarget) {
    replyState.classList.add("hidden");
    replyStateText.textContent = "";
    if (editor) editor.dataset.placeholder = "Gửi bình luận...";
    return;
  }

  replyState.classList.remove("hidden");
  replyStateText.textContent = `Đang reply ${currentReplyTarget.userName || "Người dùng"}`;
  if (editor) editor.dataset.placeholder = `Reply ${currentReplyTarget.userName || "Người dùng"}...`;
}

function setReplyTarget(comment) {
  if (!comment?.id) return;
  currentReplyTarget = {
    id: comment.id,
    userName: comment.userName || "Người dùng"
  };
  updateReplyState();
  document.querySelector("#commentInput")?.focus();
}

function clearReplyTarget() {
  currentReplyTarget = null;
  updateReplyState();
}

async function copyCommentLink(commentId) {
  if (!commentId) return;
  const link = getCommentLink(commentId);
  try {
    await navigator.clipboard.writeText(link);
    return;
  } catch {
    window.prompt("Sao chép link bình luận", link);
  }
}

function bindCommentToolbar() {
  const form = document.querySelector("#commentForm");
  const editor = document.querySelector("#commentInput");
  const sizeSelect = document.querySelector("#commentFontSize");
  if (!form || !editor) return;

  form.addEventListener("click", (event) => {
    const clearBtn = event.target.closest("[data-comment-clear]");
    if (clearBtn) {
      editor.textContent = stripHtml(editor.innerHTML || "");
      editor.focus();
      return;
    }

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

  commentsLookup = new Map(comments.map((comment) => [comment.id, comment]));

  if (comments.length === 0) {
    node.innerHTML = "<p class='text-sm text-slate-400'>Chưa có bình luận nào.</p>";
    return;
  }

  const byParentId = new Map();
  const appendToParent = (parentId, comment) => {
    if (!byParentId.has(parentId)) byParentId.set(parentId, []);
    byParentId.get(parentId).push(comment);
  };

  comments.forEach((comment) => {
    const parentId = comment.replyToId && commentsLookup.has(comment.replyToId) ? comment.replyToId : "root";
    appendToParent(parentId, comment);
  });

  const renderThread = (parentId, depth) => {
    const rows = byParentId.get(parentId) || [];
    return rows
      .map((comment) => {
        const safeRich = normalizeRichValue(comment.textHtml || comment.text || "");
        const safeName = escapeHtml(comment.userName || "Người dùng");
        const depthLevel = Math.min(depth, 4);
        const replyRef = comment.replyToUserName ? `<p class="comment-reply-ref">Reply ${escapeHtml(comment.replyToUserName)}</p>` : "";

        const html = `
          <div id="comment-${comment.id}" class="comment-item" style="--comment-depth:${depthLevel}">
            <p class="comment-author">${safeName}</p>
            ${replyRef}
            <div class="comment-text comment-rich">${safeRich}</div>
            <div class="comment-actions">
              <button type="button" class="comment-action-btn" data-comment-reply-id="${comment.id}">Reply</button>
              <button type="button" class="comment-action-btn" data-comment-copy-id="${comment.id}">Copy link</button>
            </div>
          </div>`;

        return `${html}${renderThread(comment.id, depth + 1)}`;
      })
      .join("");
  };

  node.innerHTML = renderThread("root", 0);

  const hashId = (window.location.hash || "").replace(/^#/, "");
  const anchor = hashId ? document.getElementById(hashId) : null;
  if (anchor) {
    anchor.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    node.scrollTop = node.scrollHeight;
  }
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
  const commentsList = document.querySelector("#commentsList");
  const cancelReplyBtn = document.querySelector("#cancelReplyBtn");
  const logoutBtn = document.querySelector("#logoutBtn");

  bindCommentToolbar();
  updateReplyState();

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

  cancelReplyBtn?.addEventListener("click", () => {
    clearReplyTarget();
  });

  commentsList?.addEventListener("click", async (event) => {
    const replyBtn = event.target.closest("[data-comment-reply-id]");
    if (replyBtn) {
      const replyId = replyBtn.getAttribute("data-comment-reply-id");
      const replyComment = commentsLookup.get(replyId);
      if (replyComment) setReplyTarget(replyComment);
      return;
    }

    const copyBtn = event.target.closest("[data-comment-copy-id]");
    if (copyBtn) {
      const commentId = copyBtn.getAttribute("data-comment-copy-id");
      await copyCommentLink(commentId);
    }
  });

  commentForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const textPayload = getCommentEditorPayload();
    if (!textPayload.text) return;
    const replyPayload = currentReplyTarget
      ? {
          replyToId: currentReplyTarget.id,
          replyToUserName: currentReplyTarget.userName
        }
      : {};

    await addLessonComment(lessonId, {
      text: textPayload.text,
      textHtml: textPayload.html,
      userId: user.uid,
      userName: user.displayName || "Học viên",
      userPhoto: user.photoURL || "",
      ...replyPayload
    });
    commentInput.innerHTML = "";
    clearReplyTarget();
  });

  watchLessonComments(lessonId, (snap) => {
    const comments = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    renderComments(comments);
  });
}

bootstrap();

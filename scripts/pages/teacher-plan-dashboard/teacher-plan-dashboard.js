import {
  watchAllPrivateLessonPlans,
  watchPrivateLessonPlansByTeacher
} from "../../services/firebase/firestore-service.js";
import { logout, requireRoleOrRedirect } from "../../services/firebase/auth-service.js";

let allPlans = [];
let selectedPlanId = null;

function fmtDate(ts) {
  if (!ts) return "...";
  if (typeof ts?.toDate === "function") return ts.toDate().toLocaleDateString("vi-VN");
  return new Date(ts).toLocaleDateString("vi-VN");
}

function extractYouTubeId(url) {
  const match = (url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

function getThumbnail(plan) {
  const ytId = extractYouTubeId(plan.videoUrl);
  if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  if (plan.pdfUrl) return "https://placehold.co/640x360/ffe4e6/9f1239?text=PDF+Plan";
  if (plan.pptUrl) return "https://placehold.co/640x360/ffedd5/9a3412?text=PPT+Plan";
  return "https://placehold.co/640x360/e2e8f0/0f172a?text=Lesson+Plan";
}

function renderMetrics(plans) {
  const metricTotal = document.querySelector("#metricTotal");
  const metricYoutube = document.querySelector("#metricYoutube");
  const metricPpt = document.querySelector("#metricPpt");
  const metricPdf = document.querySelector("#metricPdf");
  const summaryText = document.querySelector("#summaryText");

  const youtubeCount = plans.filter((p) => Boolean(p.videoUrl)).length;
  const pptCount = plans.filter((p) => Boolean(p.pptUrl)).length;
  const pdfCount = plans.filter((p) => Boolean(p.pdfUrl)).length;

  if (metricTotal) metricTotal.textContent = `${plans.length}`;
  if (metricYoutube) metricYoutube.textContent = `${youtubeCount}`;
  if (metricPpt) metricPpt.textContent = `${pptCount}`;
  if (metricPdf) metricPdf.textContent = `${pdfCount}`;
  if (summaryText) {
    summaryText.textContent = plans.length
      ? `Bạn có ${plans.length} giáo án riêng. Chọn từng thẻ để xem chi tiết nội dung.`
      : "Chưa có giáo án riêng nào.";
  }
}

function cardTemplate(plan) {
  const active = selectedPlanId === plan.id ? "ring-2 ring-primary/30" : "";
  return `
    <article class="plan-card ${active}" data-plan-id="${plan.id}">
      <img class="plan-thumb" src="${getThumbnail(plan)}" alt="${plan.title || "Giáo án"}" />
      <div class="p-4 space-y-2">
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-bold line-clamp-2">${plan.title || "Chưa đặt tiêu đề"}</h3>
          <span class="tag-pill tag-private">Riêng tư</span>
        </div>
        <p class="text-xs text-slate-500">Tác giả: ${plan.teacherName || "-"}</p>
        <p class="text-xs text-slate-500">Cập nhật: ${fmtDate(plan.timestamp)}</p>
        <div class="flex flex-wrap gap-2 pt-1">
          ${plan.videoUrl ? "<span class='tag-pill tag-youtube'>YouTube</span>" : ""}
          ${plan.pptUrl ? "<span class='tag-pill tag-ppt'>PPT</span>" : ""}
          ${plan.pdfUrl ? "<span class='tag-pill tag-pdf'>PDF</span>" : ""}
        </div>
      </div>
    </article>`;
}

function fillDetail(plan) {
  const title = document.querySelector("#detailTitle");
  const objective = document.querySelector("#detailObjective");
  const outline = document.querySelector("#detailOutline");
  const notes = document.querySelector("#detailNotes");
  const resources = document.querySelector("#detailResources");

  if (!title || !objective || !outline || !notes || !resources) return;

  if (!plan) {
    title.textContent = "Chưa chọn giáo án.";
    objective.textContent = "-";
    outline.textContent = "-";
    notes.textContent = "-";
    resources.innerHTML = "";
    return;
  }

  title.textContent = plan.title || "Chưa đặt tiêu đề";
  objective.textContent = plan.objective || "-";
  outline.textContent = plan.outline || "-";
  notes.textContent = plan.notes || "-";

  const items = [];
  if (plan.videoUrl) {
    items.push(`<a class="tag-pill tag-youtube" href="${plan.videoUrl}" target="_blank" rel="noreferrer">Mở YouTube</a>`);
  }
  if (plan.pptUrl) {
    items.push(`<a class="tag-pill tag-ppt" href="${plan.pptUrl}" target="_blank" rel="noreferrer">Mở PPT</a>`);
  }
  if (plan.pdfUrl) {
    items.push(`<a class="tag-pill tag-pdf" href="${plan.pdfUrl}" target="_blank" rel="noreferrer">Mở PDF</a>`);
  }

  resources.innerHTML = items.length ? items.join("") : "<span class='text-xs text-slate-500'>Không có tài nguyên đính kèm.</span>";
}

function applyFilter() {
  const keyword = (document.querySelector("#searchInput")?.value || "").trim().toLowerCase();
  const grid = document.querySelector("#plansGrid");
  const info = document.querySelector("#resultInfo");
  if (!grid || !info) return;

  const filtered = keyword
    ? allPlans.filter((plan) => {
        const blob = `${plan.title || ""} ${plan.objective || ""} ${plan.teacherName || ""}`.toLowerCase();
        return blob.includes(keyword);
      })
    : [...allPlans];

  renderMetrics(filtered);

  if (filtered.length === 0) {
    grid.innerHTML = "<div class='bg-white border border-slate-200 rounded-2xl p-8 text-slate-500'>Không tìm thấy giáo án phù hợp.</div>";
    fillDetail(null);
  } else {
    grid.innerHTML = filtered.map(cardTemplate).join("");
    const active = filtered.find((item) => item.id === selectedPlanId) || filtered[0];
    selectedPlanId = active.id;
    fillDetail(active);
  }

  info.textContent = keyword
    ? `Tìm thấy ${filtered.length} giáo án cho "${keyword}".`
    : `Đang hiển thị ${filtered.length} giáo án.`;
}

async function bootstrap() {
  const gate = await requireRoleOrRedirect(["teacher", "admin"], "../login/login.html");
  if (!gate) return;

  const { user, role } = gate;

  const logoutBtn = document.querySelector("#logoutBtn");
  const backTeacherBtn = document.querySelector("#backTeacherBtn");
  const goProfileBtn = document.querySelector("#goProfileBtn");
  const searchInput = document.querySelector("#searchInput");
  const clearSearchBtn = document.querySelector("#clearSearchBtn");
  const plansGrid = document.querySelector("#plansGrid");

  logoutBtn?.addEventListener("click", async () => {
    await logout();
    window.location.href = "../login/login.html";
  });

  backTeacherBtn?.addEventListener("click", () => {
    window.location.href = "../teacher-dashboard/teacher-dashboard.html";
  });

  goProfileBtn?.addEventListener("click", () => {
    window.location.href = "../student-profile/student-profile.html";
  });

  searchInput?.addEventListener("input", applyFilter);
  clearSearchBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    applyFilter();
  });

  plansGrid?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-plan-id]");
    if (!card) return;
    selectedPlanId = card.getAttribute("data-plan-id");
    applyFilter();
  });

  const onSnapshotData = (snap) => {
    allPlans = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => {
        const aTime = typeof a?.timestamp?.toDate === "function" ? a.timestamp.toDate().getTime() : new Date(a?.timestamp || 0).getTime();
        const bTime = typeof b?.timestamp?.toDate === "function" ? b.timestamp.toDate().getTime() : new Date(b?.timestamp || 0).getTime();
        return bTime - aTime;
      });
    applyFilter();
  };

  if (role === "admin") {
    watchAllPrivateLessonPlans(onSnapshotData);
  } else {
    watchPrivateLessonPlansByTeacher(user.uid, onSnapshotData);
  }
}

bootstrap();

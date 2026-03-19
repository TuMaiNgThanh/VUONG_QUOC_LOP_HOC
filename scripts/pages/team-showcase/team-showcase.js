import { watchUsers } from "../../services/firebase/firestore-service.js";
import {
  getUserRole,
  logout,
  requireAuthenticatedUser
} from "../../services/firebase/auth-service.js";

const FALLBACK_AVATAR = "https://placehold.co/96x96/e2e8f0/0f172a?text=CK";

let allMembers = [];
let activeFilter = "student";
let currentUser = null;

function resolvePoints(member) {
  const candidates = [member.points, member.xp, member.score, member.totalXp];
  const found = candidates.find((value) => Number.isFinite(Number(value)));
  return found ? Number(found) : 0;
}

function normalizeMember(docData) {
  const displayName = docData.displayName || docData.email || "Thành viên vô danh";
  const role = docData.role === "teacher" ? "teacher" : "student";

  return {
    id: docData.id,
    displayName,
    email: docData.email || "",
    photoURL: docData.photoURL || FALLBACK_AVATAR,
    role,
    points: resolvePoints(docData)
  };
}

function filteredMembers() {
  const studentOnly = allMembers.filter((member) => member.role === "student");
  const sorted = [...studentOnly].sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName));
  if (activeFilter === "all" || activeFilter === "student") return sorted;
  return sorted.filter((member) => member.role === activeFilter);
}

function podiumCard(member, rank) {
  if (!member) {
    return `<article class="empty-rank">Chưa đủ dữ liệu cho hạng #${rank}</article>`;
  }

  const isTop = rank === 1;
  return `
    <article class="podium-card ${isTop ? "top" : ""}">
      <div class="flex items-center justify-between mb-4">
        <p class="text-xs uppercase font-bold tracking-wider text-slate-500">Hạng #${rank}</p>
        <span class="material-symbols-outlined ${isTop ? "text-yellow-500" : "text-primary"}">${isTop ? "crown" : "workspace_premium"}</span>
      </div>
      <div class="flex items-center gap-3">
        <img class="podium-avatar" src="${member.photoURL}" alt="${member.displayName}" />
        <div>
          <h4 class="font-bold text-slate-800 line-clamp-1">${member.displayName}</h4>
          <p class="text-xs text-slate-500 uppercase font-semibold tracking-wide">${member.role === "teacher" ? "Giáo viên" : "Học sinh"}</p>
          <p class="text-sm font-black text-primary mt-1">${member.points.toLocaleString("vi-VN")} XP</p>
        </div>
      </div>
    </article>`;
}

function tableRow(member, index) {
  const isMine = currentUser && member.id === currentUser.uid;
  return `
    <tr class="${isMine ? "me-row" : ""}">
      <td class="px-4 py-3 font-black text-slate-600">#${index + 1}</td>
      <td class="px-4 py-3">
        <div class="flex items-center gap-3">
          <img class="w-9 h-9 rounded-full object-cover" src="${member.photoURL}" alt="${member.displayName}" />
          <div>
            <p class="font-semibold text-slate-800">${member.displayName}${isMine ? " (Bạn)" : ""}</p>
            <p class="text-xs text-slate-500 line-clamp-1">${member.email || ""}</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-3">
        <span class="inline-flex px-2 py-1 rounded-full text-xs font-bold ${
          member.role === "teacher"
            ? "bg-amber-100 text-amber-700"
            : "bg-indigo-100 text-indigo-700"
        }">${member.role === "teacher" ? "Teacher" : "Student"}</span>
      </td>
      <td class="px-4 py-3 text-right font-black text-primary">${member.points.toLocaleString("vi-VN")}</td>
    </tr>`;
}

function render() {
  const members = filteredMembers();
  const podium = document.querySelector("#podium");
  const body = document.querySelector("#rankingBody");
  const memberCount = document.querySelector("#memberCount");
  const myRankText = document.querySelector("#myRankText");
  const myPointText = document.querySelector("#myPointText");
  const progressBar = document.querySelector("#progressBar");
  const progressText = document.querySelector("#progressText");
  if (!podium || !body || !memberCount || !myRankText || !myPointText || !progressBar || !progressText) return;

  podium.innerHTML = [podiumCard(members[1], 2), podiumCard(members[0], 1), podiumCard(members[2], 3)].join("");
  memberCount.textContent = `${members.length} thành viên`;

  if (members.length === 0) {
    body.innerHTML = "<tr><td colspan='4' class='px-4 py-8 text-center text-slate-500'>Không có dữ liệu xếp hạng.</td></tr>";
    myRankText.textContent = "#-";
    myPointText.textContent = "0 XP";
    progressBar.style.width = "0%";
    progressText.textContent = "Không có dữ liệu để tính tiến độ.";
    return;
  }

  body.innerHTML = members.map(tableRow).join("");
  const myIndex = currentUser ? members.findIndex((m) => m.id === currentUser.uid) : -1;

  if (myIndex < 0) {
    myRankText.textContent = "#-";
    myPointText.textContent = "0 XP";
    progressBar.style.width = "0%";
    progressText.textContent = "Đang theo dõi xếp hạng chung.";
    return;
  }

  const mine = members[myIndex];
  myRankText.textContent = `#${myIndex + 1}`;
  myPointText.textContent = `${mine.points.toLocaleString("vi-VN")} XP`;

  if (myIndex === 0) {
    progressBar.style.width = "100%";
    progressText.textContent = "Bạn đang dẫn đầu bảng xếp hạng.";
  } else {
    const target = members[myIndex - 1];
    const gap = Math.max(0, target.points - mine.points);
    const ratio = target.points === 0 ? 0 : Math.min(100, Math.round((mine.points / target.points) * 100));
    progressBar.style.width = `${ratio}%`;
    progressText.textContent = `Cần thêm ${gap.toLocaleString("vi-VN")} XP để vượt hạng #${myIndex}.`;
  }
}

function bindFilterButtons() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.getAttribute("data-filter") || "all";
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      render();
    });
  });
}

async function bootstrap() {
  const user = await requireAuthenticatedUser();
  if (!user) {
    window.location.href = "../login/login.html";
    return;
  }
  currentUser = user;

  const role = await getUserRole(user.uid);
  const goLibraryBtn = document.querySelector("#goLibraryBtn");
  const goProfileBtn = document.querySelector("#goProfileBtn");
  const goTeacherBtn = document.querySelector("#goTeacherBtn");
  const logoutBtn = document.querySelector("#logoutBtn");
  const welcomeText = document.querySelector("#welcomeText");

  if (welcomeText) {
    welcomeText.textContent = `Xin chào, ${user.displayName || "chiến binh"}.`;
  }

  if (role === "teacher") {
    goTeacherBtn?.classList.remove("hidden");
  }

  goLibraryBtn?.addEventListener("click", () => {
    window.location.href = "../student-library/student-library.html";
  });

  goProfileBtn?.addEventListener("click", () => {
    window.location.href = "../student-profile/student-profile.html";
  });

  goTeacherBtn?.addEventListener("click", () => {
    window.location.href = "../teacher-dashboard/teacher-dashboard.html";
  });

  logoutBtn?.addEventListener("click", async () => {
    await logout();
    window.location.href = "../login/login.html";
  });

  bindFilterButtons();

  watchUsers((snapshot) => {
    allMembers = snapshot.docs.map((item) => normalizeMember({ id: item.id, ...item.data() }));
    render();
  });
}

bootstrap();

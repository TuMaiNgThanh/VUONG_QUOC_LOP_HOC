import {
  getUserProfile,
  getUserRole,
  logout,
  requireAuthenticatedUser,
  updateUserProfileDetails,
  watchUserRole
} from "../../services/firebase/auth-service.js";
import {
  watchAllLessons,
  watchUsers,
  watchVisibleLessons
} from "../../services/firebase/firestore-service.js";

const FALLBACK_AVATAR = "https://placehold.co/128x128/e2e8f0/0f172a?text=CK";

let currentUser = null;
let currentRole = "student";
let currentProfile = null;
let allMembers = [];
let stopLessonMetricsWatch = null;

function setProfileEditToast(message, isError = false) {
  const node = document.querySelector("#profileEditToast");
  if (!node) return;
  node.textContent = message;
  node.style.color = isError ? "#dc2626" : "#475569";
}

function parseDateText(value) {
  if (!value) return "Mới tham gia";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Mới tham gia";
  return `Tham gia ${date.toLocaleDateString("vi-VN")}`;
}

function resolvePoints(member) {
  const candidates = [member?.points, member?.xp, member?.score, member?.totalXp];
  const found = candidates.find((value) => Number.isFinite(Number(value)));
  return found ? Number(found) : 0;
}

function sortedMembers() {
  return [...allMembers].sort((a, b) => resolvePoints(b) - resolvePoints(a));
}

function renderUserProfile(profile) {
  const displayName = document.querySelector("#displayName");
  const email = document.querySelector("#email");
  const avatar = document.querySelector("#avatar");
  const roleBadge = document.querySelector("#roleBadge");
  const joinedBadge = document.querySelector("#joinedBadge");
  const pointText = document.querySelector("#pointText");
  const profileSubTitle = document.querySelector("#profileSubTitle");
  const metricRole = document.querySelector("#metricRole");

  if (!displayName || !email || !avatar || !roleBadge || !joinedBadge || !pointText || !profileSubTitle || !metricRole) return;

  const roleText = currentRole === "teacher" ? "Teacher" : "Student";
  const points = resolvePoints(profile);
  displayName.textContent = profile?.displayName || currentUser?.displayName || "Người dùng Classroom Kingdom";
  email.textContent = profile?.email || currentUser?.email || "Không có email";
  avatar.setAttribute("src", profile?.photoURL || currentUser?.photoURL || FALLBACK_AVATAR);
  roleBadge.textContent = roleText;
  roleBadge.className = `inline-flex px-3 py-1 rounded-full text-xs font-bold ${
    currentRole === "teacher" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
  }`;
  joinedBadge.textContent = parseDateText(profile?.createdAt);
  pointText.textContent = `${points.toLocaleString("vi-VN")} XP`;
  profileSubTitle.textContent = `Xin chào ${profile?.displayName || "chiến binh"}, đây là thông tin tài khoản của bạn.`;
  metricRole.textContent = roleText;
}

function fillProfileEditForm(profile) {
  const displayNameInput = document.querySelector("#profileDisplayNameInput");
  const phoneInput = document.querySelector("#profilePhoneInput");
  const bioInput = document.querySelector("#profileBioInput");
  if (!displayNameInput || !phoneInput || !bioInput) return;

  displayNameInput.value = profile?.displayName || currentUser?.displayName || "";
  phoneInput.value = profile?.phone || "";
  bioInput.value = profile?.bio || "";
}

function renderRank() {
  const members = sortedMembers();
  const rankText = document.querySelector("#rankText");
  const rankHint = document.querySelector("#rankHint");
  const rankProgress = document.querySelector("#rankProgress");
  const rankProgressText = document.querySelector("#rankProgressText");
  const metricMembers = document.querySelector("#metricMembers");
  if (!rankText || !rankHint || !rankProgress || !rankProgressText || !metricMembers) return;

  metricMembers.textContent = `${members.length}`;
  const index = members.findIndex((item) => item.id === currentUser?.uid);
  if (index < 0) {
    rankText.textContent = "#-";
    rankHint.textContent = "Bạn chưa có thứ hạng trong bảng xếp hạng.";
    rankProgress.style.width = "0%";
    rankProgressText.textContent = "0% tiến độ đến hạng tiếp theo";
    return;
  }

  const mine = members[index];
  const minePoints = resolvePoints(mine);
  rankText.textContent = `#${index + 1}`;

  if (index === 0) {
    rankHint.textContent = "Bạn đang đứng đầu bảng xếp hạng.";
    rankProgress.style.width = "100%";
    rankProgressText.textContent = "100% tiến độ đến hạng tiếp theo";
    return;
  }

  const target = members[index - 1];
  const targetPoints = resolvePoints(target);
  const gap = Math.max(targetPoints - minePoints, 0);
  const ratio = targetPoints === 0 ? 0 : Math.min(100, Math.round((minePoints / targetPoints) * 100));

  rankHint.textContent = `Còn ${gap.toLocaleString("vi-VN")} XP để vượt hạng #${index}.`;
  rankProgress.style.width = `${ratio}%`;
  rankProgressText.textContent = `${ratio}% tiến độ đến hạng tiếp theo`;
}

function renderActivity() {
  const list = document.querySelector("#activityList");
  if (!list) return;

  const members = sortedMembers();
  const myIndex = members.findIndex((item) => item.id === currentUser?.uid);
  const myProfile = members[myIndex] || {};
  const roleText = currentRole === "teacher" ? "Giáo viên" : "Học sinh";
  const myPoints = resolvePoints(myProfile);

  const lines = [
    `Vai trò hiện tại: ${roleText}.`,
    `Tổng điểm hiện tại: ${myPoints.toLocaleString("vi-VN")} XP.`,
    myIndex >= 0 ? `Thứ hạng hiện tại: #${myIndex + 1} trên ${members.length} thành viên.` : "Chưa có thứ hạng trong leaderboard.",
    currentRole === "teacher"
      ? "Bạn có thể tạo và quản lý bài giảng trong Teacher Dashboard."
      : "Bạn có thể tiếp tục học trong Student Library và Lesson Player."
  ];

  list.innerHTML = lines.map((line) => `<li class="activity-item">- ${line}</li>`).join("");
}

function bindNavigation() {
  const goHomeBtn = document.querySelector("#goHomeBtn");
  const goTeamBtn = document.querySelector("#goTeamBtn");
  const logoutBtn = document.querySelector("#logoutBtn");

  goHomeBtn?.addEventListener("click", () => {
    window.location.href = currentRole === "teacher"
      ? "../teacher-dashboard/teacher-dashboard.html"
      : "../student-library/student-library.html";
  });

  goTeamBtn?.addEventListener("click", () => {
    window.location.href = "../team-showcase/team-showcase.html";
  });

  logoutBtn?.addEventListener("click", async () => {
    await logout();
    window.location.href = "../login/login.html";
  });
}

function bindProfileEditForm() {
  const form = document.querySelector("#profileEditForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const displayNameInput = document.querySelector("#profileDisplayNameInput");
    const phoneInput = document.querySelector("#profilePhoneInput");
    const bioInput = document.querySelector("#profileBioInput");

    const displayName = (displayNameInput?.value || "").trim();
    const phone = (phoneInput?.value || "").trim();
    const bio = (bioInput?.value || "").trim();

    if (!displayName) {
      setProfileEditToast("Tên hiển thị không được để trống.", true);
      return;
    }

    try {
      await updateUserProfileDetails(currentUser.uid, {
        displayName,
        phone,
        bio
      });

      currentProfile = {
        ...(currentProfile || {}),
        displayName,
        phone,
        bio
      };

      renderUserProfile(currentProfile);
      renderRank();
      renderActivity();
      setProfileEditToast("Đã cập nhật hồ sơ thành công.");
    } catch (error) {
      setProfileEditToast(error?.message || "Không thể cập nhật hồ sơ.", true);
    }
  });
}

function bindLessonMetrics() {
  const totalNode = document.querySelector("#metricTotalLessons");
  const visibleNode = document.querySelector("#metricVisibleLessons");
  if (!totalNode || !visibleNode) return;

  if (typeof stopLessonMetricsWatch === "function") {
    stopLessonMetricsWatch();
    stopLessonMetricsWatch = null;
  }

  const updateMetrics = (lessons) => {
    const total = lessons.length;
    const visible = lessons.filter((item) => item.visible).length;
    totalNode.textContent = `${total}`;
    visibleNode.textContent = `${visible}`;
  };

  if (currentRole === "teacher") {
    stopLessonMetricsWatch = watchAllLessons((snapshot) => {
      const lessons = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      updateMetrics(lessons);
    });
  } else {
    stopLessonMetricsWatch = watchVisibleLessons((snapshot) => {
      const lessons = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      updateMetrics(lessons);
    });
  }
}

async function bootstrap() {
  const user = await requireAuthenticatedUser();
  if (!user) {
    window.location.href = "../login/login.html";
    return;
  }

  currentUser = user;
  currentRole = (await getUserRole(user.uid)) || "student";

  bindNavigation();
  bindProfileEditForm();
  bindLessonMetrics();

  const profile = await getUserProfile(user.uid);
  currentProfile = profile || {
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    role: currentRole
  };

  renderUserProfile(currentProfile);
  fillProfileEditForm(currentProfile);

  watchUsers((snapshot) => {
    allMembers = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((member) => (member.role || "student") === "student");
    renderRank();
    renderActivity();
  });

  watchUserRole(user.uid, (nextRole) => {
    if (!nextRole || nextRole === currentRole) return;
    currentRole = nextRole;
    currentProfile = {
      ...(currentProfile || {}),
      displayName: currentProfile?.displayName || user.displayName,
      email: currentProfile?.email || user.email,
      photoURL: currentProfile?.photoURL || user.photoURL,
      role: currentRole
    };

    renderUserProfile(currentProfile);
    fillProfileEditForm(currentProfile);
    bindLessonMetrics();
    renderRank();
    renderActivity();
  });
}

bootstrap();

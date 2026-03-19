import {
  loginWithEmailPassword,
  loginWithGoogle,
  sendResetPassword,
  signupWithEmailPassword,
  upsertUserRole,
  watchAuth
} from "../../services/firebase/auth-service.js";

function ensureAuthorizedLocalHost() {
  if (typeof window === "undefined") return;
  const { hostname, port, pathname, search, hash, protocol } = window.location;
  if (hostname !== "127.0.0.1") return;

  const target = `${protocol}//localhost${port ? `:${port}` : ""}${pathname}${search}${hash}`;
  window.location.replace(target);
}

function setMode(nextMode) {
  const loginTab = document.querySelector("#modeLoginBtn");
  const signupTab = document.querySelector("#modeSignupBtn");
  const loginForm = document.querySelector("#loginForm");
  const signupForm = document.querySelector("#signupForm");

  loginTab?.classList.toggle("active", nextMode === "login");
  signupTab?.classList.toggle("active", nextMode === "signup");
  loginForm?.classList.toggle("hidden", nextMode !== "login");
  signupForm?.classList.toggle("hidden", nextMode !== "signup");
}

function redirectByRole(role) {
  if (role === "teacher" || role === "admin") {
    window.location.href = "../teacher-dashboard/teacher-dashboard.html";
    return;
  }
  window.location.href = "../student-library/student-library.html";
}

function showMessage(text, isError = false) {
  const node = document.querySelector("#loginMessage");
  if (!node) return;
  node.textContent = text || "";
  node.style.color = isError ? "#dc2626" : "#475569";
}

function setOverlay(visible) {
  const overlay = document.querySelector("#portalOverlay");
  if (overlay) overlay.style.display = visible ? "flex" : "none";
}

function normalizeError(error) {
  const code = error?.code || "";
  if (code.includes("auth/unauthorized-domain")) {
    return "Tên miền hiện tại chưa được cấp quyền Firebase Auth. Vui lòng mở bằng localhost hoặc thêm domain này trong Firebase Console > Authentication > Settings > Authorized domains.";
  }
  if (code.includes("auth/operation-not-allowed")) {
    return "Phương thức Email/Password hiện chưa bật trong Firebase Authentication. Bạn có thể đăng nhập bằng Google, hoặc bật Email/Password trong Firebase Console > Authentication > Sign-in method.";
  }
  if (code.includes("auth/invalid-credential")) return "Email hoặc mật khẩu không đúng.";
  if (code.includes("auth/email-already-in-use")) return "Email này đã được sử dụng.";
  if (code.includes("auth/invalid-email")) return "Email không hợp lệ.";
  if (code.includes("auth/weak-password")) return "Mật khẩu quá yếu (tối thiểu 6 ký tự).";
  if (code.includes("auth/missing-password")) return "Vui lòng nhập mật khẩu.";
  return error?.message || "Đăng nhập thất bại. Vui lòng thử lại.";
}

function bindPasswordToggles() {
  document.querySelectorAll(".toggle-pass").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-target");
      if (!targetId) return;
      const input = document.querySelector(`#${targetId}`);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
      const icon = button.querySelector(".material-symbols-outlined");
      if (icon) icon.textContent = input.type === "password" ? "visibility" : "visibility_off";
    });
  });
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const email = document.querySelector("#loginEmailInput")?.value?.trim() || "";
  const password = document.querySelector("#loginPasswordInput")?.value || "";

  if (!email || !password) {
    showMessage("Vui lòng nhập đầy đủ email và mật khẩu.", true);
    return;
  }

  try {
    setOverlay(true);
    showMessage("Đang đăng nhập...");
    await loginWithEmailPassword(email, password, "student");
  } catch (error) {
    setOverlay(false);
    showMessage(normalizeError(error), true);
  }
}

async function handleSignupSubmit(event) {
  event.preventDefault();
  const displayName = document.querySelector("#signupNameInput")?.value?.trim() || "";
  const email = document.querySelector("#signupEmailInput")?.value?.trim() || "";
  const password = document.querySelector("#signupPasswordInput")?.value || "";
  const confirm = document.querySelector("#signupConfirmInput")?.value || "";

  if (!displayName || !email || !password || !confirm) {
    showMessage("Vui lòng điền đầy đủ thông tin đăng ký.", true);
    return;
  }
  if (password.length < 6) {
    showMessage("Mật khẩu cần ít nhất 6 ký tự.", true);
    return;
  }
  if (password !== confirm) {
    showMessage("Mật khẩu xác nhận không khớp.", true);
    return;
  }

  try {
    setOverlay(true);
    showMessage("Đang tạo tài khoản...");
    await signupWithEmailPassword({
      email,
      password,
      displayName,
      preferredRole: "student"
    });
  } catch (error) {
    setOverlay(false);
    showMessage(normalizeError(error), true);
  }
}

async function handleForgotPassword() {
  const email = document.querySelector("#loginEmailInput")?.value?.trim() || "";
  if (!email) {
    showMessage("Nhập email trước khi yêu cầu đặt lại mật khẩu.", true);
    return;
  }
  try {
    await sendResetPassword(email);
    showMessage("Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.");
  } catch (error) {
    showMessage(normalizeError(error), true);
  }
}

async function bootstrap() {
  ensureAuthorizedLocalHost();

  const googleLoginBtn = document.querySelector("#googleLoginBtn");
  const modeLoginBtn = document.querySelector("#modeLoginBtn");
  const modeSignupBtn = document.querySelector("#modeSignupBtn");
  const loginForm = document.querySelector("#loginForm");
  const signupForm = document.querySelector("#signupForm");
  const forgotPasswordBtn = document.querySelector("#forgotPasswordBtn");

  modeLoginBtn?.addEventListener("click", () => setMode("login"));
  modeSignupBtn?.addEventListener("click", () => setMode("signup"));

  loginForm?.addEventListener("submit", handleLoginSubmit);
  signupForm?.addEventListener("submit", handleSignupSubmit);
  forgotPasswordBtn?.addEventListener("click", handleForgotPassword);

  googleLoginBtn?.addEventListener("click", async () => {
    try {
      setOverlay(true);
      showMessage("Đang kết nối Google...");
      await loginWithGoogle("student");
    } catch (error) {
      setOverlay(false);
      showMessage(normalizeError(error), true);
    }
  });

  bindPasswordToggles();

  watchAuth(async (user) => {
    if (!user) return;
    const role = await upsertUserRole(user);
    redirectByRole(role);
  });
}

bootstrap();

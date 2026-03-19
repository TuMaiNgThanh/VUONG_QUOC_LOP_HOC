import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  loginWithEmailPassword: vi.fn(),
  loginWithGoogle: vi.fn(),
  sendResetPassword: vi.fn(),
  signupWithEmailPassword: vi.fn(),
  upsertUserRole: vi.fn(),
  watchAuth: vi.fn(),
  authCallback: null
}));

vi.mock("../../scripts/services/firebase/auth-service.js", () => ({
  loginWithEmailPassword: authMocks.loginWithEmailPassword,
  loginWithGoogle: authMocks.loginWithGoogle,
  sendResetPassword: authMocks.sendResetPassword,
  signupWithEmailPassword: authMocks.signupWithEmailPassword,
  upsertUserRole: authMocks.upsertUserRole,
  watchAuth: authMocks.watchAuth
}));

function mountLoginDom() {
  document.body.innerHTML = `
    <div id="portalOverlay" style="display:none"></div>

    <button id="modeLoginBtn" class="active" type="button">Login</button>
    <button id="modeSignupBtn" type="button">Signup</button>

    <form id="loginForm">
      <input id="loginEmailInput" type="email" />
      <input id="loginPasswordInput" type="password" />
      <button class="toggle-pass" data-target="loginPasswordInput" type="button">
        <span class="material-symbols-outlined">visibility</span>
      </button>
      <button id="loginSubmitBtn" type="submit">Submit</button>
    </form>

    <form id="signupForm" class="hidden">
      <input id="signupNameInput" type="text" />
      <input id="signupEmailInput" type="email" />
      <input id="signupPasswordInput" type="password" />
      <button class="toggle-pass" data-target="signupPasswordInput" type="button">
        <span class="material-symbols-outlined">visibility</span>
      </button>
      <input id="signupConfirmInput" type="password" />
      <button id="signupSubmitBtn" type="submit">Create</button>
    </form>

    <button id="forgotPasswordBtn" type="button">Forgot</button>
    <button id="googleLoginBtn" type="button">Google</button>
    <p id="loginMessage"></p>
  `;
}

describe("login page ui flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mountLoginDom();

    authMocks.loginWithEmailPassword.mockResolvedValue({ ok: true });
    authMocks.signupWithEmailPassword.mockResolvedValue({ ok: true });
    authMocks.loginWithGoogle.mockResolvedValue({ ok: true });
    authMocks.sendResetPassword.mockResolvedValue(undefined);
    authMocks.upsertUserRole.mockResolvedValue("student");

    authMocks.watchAuth.mockImplementation((cb) => {
      authMocks.authCallback = cb;
      return vi.fn();
    });
  });

  it("submits email login with selected student role", async () => {
    await import("../../scripts/pages/login/login.js");

    document.querySelector("#loginEmailInput").value = "student@example.com";
    document.querySelector("#loginPasswordInput").value = "secret";
    document.querySelector("#loginForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await Promise.resolve();

    expect(authMocks.loginWithEmailPassword).toHaveBeenCalledWith("student@example.com", "secret", "student");
    expect(document.querySelector("#portalOverlay")?.style.display).toBe("flex");
  });

  it("shows validation message when login fields are missing", async () => {
    await import("../../scripts/pages/login/login.js");

    document.querySelector("#loginForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(document.querySelector("#loginMessage")?.textContent).toContain("Vui lòng nhập đầy đủ email và mật khẩu.");
  });

  it("switches to signup mode and validates password mismatch", async () => {
    await import("../../scripts/pages/login/login.js");

    document.querySelector("#modeSignupBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector("#signupForm")?.classList.contains("hidden")).toBe(false);

    document.querySelector("#signupNameInput").value = "Tester";
    document.querySelector("#signupEmailInput").value = "tester@example.com";
    document.querySelector("#signupPasswordInput").value = "123456";
    document.querySelector("#signupConfirmInput").value = "000000";
    document.querySelector("#signupForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(document.querySelector("#loginMessage")?.textContent).toContain("Mật khẩu xác nhận không khớp.");
    expect(authMocks.signupWithEmailPassword).not.toHaveBeenCalled();
  });

  it("toggles password visibility icon and input type", async () => {
    await import("../../scripts/pages/login/login.js");

    const input = document.querySelector("#loginPasswordInput");
    const toggle = document.querySelector(".toggle-pass[data-target='loginPasswordInput']");
    const icon = toggle?.querySelector(".material-symbols-outlined");

    expect(input?.getAttribute("type")).toBe("password");
    toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(input?.getAttribute("type")).toBe("text");
    expect(icon?.textContent).toBe("visibility_off");
  });

  it("handles forgot password and Google login actions", async () => {
    await import("../../scripts/pages/login/login.js");

    document.querySelector("#forgotPasswordBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector("#loginMessage")?.textContent).toContain("Nhập email trước khi yêu cầu đặt lại mật khẩu.");

    document.querySelector("#loginEmailInput").value = "student@example.com";
    document.querySelector("#forgotPasswordBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(authMocks.sendResetPassword).toHaveBeenCalledWith("student@example.com");

    document.querySelector("#googleLoginBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(authMocks.loginWithGoogle).toHaveBeenCalledWith("student");
  });

  it("forces signup role to student", async () => {
    await import("../../scripts/pages/login/login.js");

    document.querySelector("#modeSignupBtn")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    document.querySelector("#signupNameInput").value = "Teacher Candidate";
    document.querySelector("#signupEmailInput").value = "candidate@example.com";
    document.querySelector("#signupPasswordInput").value = "123456";
    document.querySelector("#signupConfirmInput").value = "123456";
    document.querySelector("#signupForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await Promise.resolve();

    expect(authMocks.signupWithEmailPassword).toHaveBeenCalledWith(
      expect.objectContaining({ preferredRole: "student" })
    );
  });
});

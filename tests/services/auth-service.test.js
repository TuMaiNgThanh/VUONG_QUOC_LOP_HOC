import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  createUserWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onSnapshot: vi.fn(),
  updateProfile: vi.fn(),
  setDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn()
}));

vi.mock("../../scripts/services/firebase/firebase-sdk.js", () => mockFns);
vi.mock("../../scripts/services/firebase/firebase-config.js", () => ({
  auth: { key: "auth" },
  db: { key: "db" },
  googleProvider: { key: "provider" }
}));

import {
  getUserProfile,
  getUserRole,
  loginWithEmailPassword,
  loginWithGoogle,
  logout,
  requireAuthenticatedUser,
  requireRoleOrRedirect,
  sendResetPassword,
  signupWithEmailPassword,
  upsertUserRole,
  watchUserRole,
  watchAuth
} from "../../scripts/services/firebase/auth-service.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockFns.doc.mockImplementation((_db, col, id) => `${col}/${id}`);
  window.__ckRedirect = undefined;
  window.history.replaceState({}, "", "/");
});

describe("auth-service", () => {
  it("watchAuth forwards to Firebase onAuthStateChanged", () => {
    const callback = vi.fn();
    watchAuth(callback);
    expect(mockFns.onAuthStateChanged).toHaveBeenCalledTimes(1);
    expect(mockFns.onAuthStateChanged).toHaveBeenCalledWith({ key: "auth" }, callback);
  });

  it("loginWithGoogle stores preferred role and calls signInWithPopup", async () => {
    mockFns.signInWithPopup.mockResolvedValue({ ok: true });
    await loginWithGoogle("teacher");
    expect(localStorage.getItem("ck_role_preference")).toBe("teacher");
    expect(mockFns.signInWithPopup).toHaveBeenCalledWith({ key: "auth" }, { key: "provider" });
  });

  it("loginWithEmailPassword stores preferred role and calls Firebase auth", async () => {
    mockFns.signInWithEmailAndPassword.mockResolvedValue({ ok: true });
    await loginWithEmailPassword("user@mail.com", "secret", "student");
    expect(localStorage.getItem("ck_role_preference")).toBe("student");
    expect(mockFns.signInWithEmailAndPassword).toHaveBeenCalledWith({ key: "auth" }, "user@mail.com", "secret");
  });

  it("signupWithEmailPassword updates profile and upserts role", async () => {
    const credential = {
      user: {
        uid: "u1",
        email: "new@mail.com",
        displayName: null,
        photoURL: ""
      }
    };
    mockFns.createUserWithEmailAndPassword.mockResolvedValue(credential);
    mockFns.getDoc.mockResolvedValue({ exists: () => false });
    mockFns.setDoc.mockResolvedValue(undefined);

    await signupWithEmailPassword({
      email: "new@mail.com",
      password: "123456",
      displayName: "New User",
      preferredRole: "teacher"
    });

    expect(mockFns.updateProfile).toHaveBeenCalledWith(credential.user, { displayName: "New User" });
    expect(mockFns.setDoc).toHaveBeenCalled();
  });

  it("sendResetPassword delegates to Firebase", async () => {
    mockFns.sendPasswordResetEmail.mockResolvedValue(undefined);
    await sendResetPassword("mail@test.com");
    expect(mockFns.sendPasswordResetEmail).toHaveBeenCalledWith({ key: "auth" }, "mail@test.com");
  });

  it("logout delegates to Firebase signOut", async () => {
    mockFns.signOut.mockResolvedValue(undefined);
    await logout();
    expect(mockFns.signOut).toHaveBeenCalledWith({ key: "auth" });
  });

  it("getUserRole returns null for missing document", async () => {
    mockFns.getDoc.mockResolvedValue({ exists: () => false });
    await expect(getUserRole("uid-1")).resolves.toBeNull();
  });

  it("getUserRole returns role for existing document", async () => {
    mockFns.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ role: "teacher" }) });
    await expect(getUserRole("uid-2")).resolves.toBe("teacher");
  });

  it("watchUserRole subscribes and emits role", () => {
    const cb = vi.fn();
    mockFns.onSnapshot.mockImplementation((_ref, handler) => {
      handler({ exists: () => true, data: () => ({ role: "teacher" }) });
      return vi.fn();
    });

    watchUserRole("uid-2", cb);

    expect(mockFns.onSnapshot).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("teacher");
  });

  it("getUserProfile returns null for missing document", async () => {
    mockFns.getDoc.mockResolvedValue({ exists: () => false });
    await expect(getUserProfile("uid-1")).resolves.toBeNull();
  });

  it("getUserProfile returns merged profile when doc exists", async () => {
    mockFns.getDoc.mockResolvedValue({
      id: "uid-1",
      exists: () => true,
      data: () => ({ displayName: "A" })
    });
    await expect(getUserProfile("uid-1")).resolves.toEqual({ id: "uid-1", displayName: "A" });
  });

  it("upsertUserRole creates new user as student by default", async () => {
    localStorage.setItem("ck_role_preference", "teacher");
    mockFns.getDoc.mockResolvedValue({ exists: () => false });
    mockFns.setDoc.mockResolvedValue(undefined);

    const role = await upsertUserRole({ uid: "u1", email: "e", displayName: "d", photoURL: "p" });

    expect(role).toBe("student");
    expect(mockFns.setDoc).toHaveBeenCalledWith(
      "users/u1",
      expect.objectContaining({ role: "student", email: "e", displayName: "d" })
    );
  });

  it("upsertUserRole no longer changes existing role by preference", async () => {
    localStorage.setItem("ck_role_preference", "teacher");
    mockFns.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ role: "student" }) });
    mockFns.setDoc.mockResolvedValue(undefined);

    const role = await upsertUserRole({ uid: "u1" });

    expect(role).toBe("student");
    expect(mockFns.setDoc).not.toHaveBeenCalled();
  });

  it("upsertUserRole keeps current role when unchanged", async () => {
    localStorage.setItem("ck_role_preference", "student");
    mockFns.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ role: "student" }) });

    const role = await upsertUserRole({ uid: "u1" });

    expect(role).toBe("student");
    expect(mockFns.setDoc).not.toHaveBeenCalled();
  });

  it("upsertUserRole assigns admin for whitelisted email", async () => {
    localStorage.setItem("ck_role_preference", "student");
    mockFns.getDoc.mockResolvedValue({ exists: () => false });

    const role = await upsertUserRole({ uid: "u-admin", email: "admin@vuongquoc.com", displayName: "Admin" });

    expect(role).toBe("admin");
    expect(mockFns.setDoc).toHaveBeenCalledWith(
      "users/u-admin",
      expect.objectContaining({ role: "admin", email: "admin@vuongquoc.com" })
    );
  });

  it("requireAuthenticatedUser handles synchronous auth callback edge case", async () => {
    const unsub = vi.fn();
    mockFns.onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb({ uid: "sync-user" });
      return unsub;
    });

    const user = await requireAuthenticatedUser();

    expect(user).toEqual({ uid: "sync-user" });
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it("requireRoleOrRedirect redirects unauthenticated users", async () => {
    const redirectSpy = vi.fn();
    window.__ckRedirect = redirectSpy;
    mockFns.onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb(null);
      return () => {};
    });

    const result = await requireRoleOrRedirect("teacher", "../login/login.html");

    expect(result).toBeNull();
    expect(redirectSpy).toHaveBeenCalledWith("../login/login.html");
  });

  it("requireRoleOrRedirect redirects wrong role", async () => {
    const redirectSpy = vi.fn();
    window.__ckRedirect = redirectSpy;
    mockFns.onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb({ uid: "u1" });
      return () => {};
    });
    mockFns.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ role: "student" }) });

    const result = await requireRoleOrRedirect("teacher", "../login/login.html");

    expect(result).toBeNull();
    expect(redirectSpy).toHaveBeenCalledWith("/scripts/pages/student-library/student-library.html");
  });

  it("requireRoleOrRedirect keeps redirect stable on malformed nested URL", async () => {
    window.history.replaceState({}, "", "/scripts/pages/login/scripts/pages/login/login.html");
    const redirectSpy = vi.fn();
    window.__ckRedirect = redirectSpy;

    mockFns.onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb({ uid: "u1" });
      return () => {};
    });
    mockFns.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ role: "student" }) });

    const result = await requireRoleOrRedirect("teacher", "../login/login.html");

    expect(result).toBeNull();
    expect(redirectSpy).toHaveBeenCalledWith("/scripts/pages/student-library/student-library.html");
  });

  it("requireRoleOrRedirect preserves app base path when hosted under subfolder", async () => {
    window.history.replaceState({}, "", "/classroom/scripts/pages/login/login.html");
    const redirectSpy = vi.fn();
    window.__ckRedirect = redirectSpy;

    mockFns.onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb({ uid: "u2" });
      return () => {};
    });
    mockFns.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ role: "student" }) });

    const result = await requireRoleOrRedirect("teacher", "../login/login.html");

    expect(result).toBeNull();
    expect(redirectSpy).toHaveBeenCalledWith("/classroom/scripts/pages/student-library/student-library.html");
  });

  it("requireRoleOrRedirect returns user+role when access is valid", async () => {
    mockFns.onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb({ uid: "u1" });
      return () => {};
    });
    mockFns.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ role: "teacher" }) });

    const result = await requireRoleOrRedirect("teacher");

    expect(result).toEqual({ user: { uid: "u1" }, role: "teacher" });
  });

  it("requireRoleOrRedirect accepts expected role array", async () => {
    mockFns.onAuthStateChanged.mockImplementation((_auth, cb) => {
      cb({ uid: "u-admin" });
      return () => {};
    });
    mockFns.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ role: "admin" }) });

    const result = await requireRoleOrRedirect(["teacher", "admin"]);

    expect(result).toEqual({ user: { uid: "u-admin" }, role: "admin" });
  });
});

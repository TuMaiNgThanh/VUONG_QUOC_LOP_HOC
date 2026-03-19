import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onSnapshot,
  setDoc,
  doc,
  getDoc,
  updateProfile
} from "./firebase-sdk.js";
import { auth, db, googleProvider } from "./firebase-config.js";

const ADMIN_EMAILS = ["admin@vuongquoc.com"];

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes((email || "").toLowerCase());
}

function redirectTo(url) {
  if (typeof window === "undefined") return;
  if (typeof window.__ckRedirect === "function") {
    window.__ckRedirect(url);
    return;
  }
  if (typeof window.location?.assign === "function") {
    try {
      window.location.assign(url);
    } catch {
      window.location.href = url;
    }
    return;
  }
  window.location.href = url;
}

function appBasePath() {
  if (typeof window === "undefined") return "";
  const marker = "/scripts/pages/";
  const pathname = window.location?.pathname || "";
  const idx = pathname.indexOf(marker);
  if (idx < 0) return "";
  return pathname.slice(0, idx);
}

function pagePath(path) {
  const base = appBasePath();
  return `${base}/scripts/pages/${path}`;
}

function roleHomePath(role) {
  if (role === "teacher" || role === "admin") {
    return pagePath("teacher-dashboard/teacher-dashboard.html");
  }
  return pagePath("student-library/student-library.html");
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function loginWithGoogle(preferredRole = "student") {
  localStorage.setItem("ck_role_preference", preferredRole);
  return signInWithPopup(auth, googleProvider);
}

export async function loginWithEmailPassword(email, password, preferredRole = "student") {
  localStorage.setItem("ck_role_preference", preferredRole);
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signupWithEmailPassword({ email, password, displayName, preferredRole = "student" }) {
  void preferredRole;
  localStorage.setItem("ck_role_preference", "student");
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }
  await upsertUserRole({
    uid: credential.user.uid,
    email: credential.user.email,
    displayName: displayName || credential.user.displayName,
    photoURL: credential.user.photoURL
  });
  return credential;
}

export async function sendResetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

export async function logout() {
  return signOut(auth);
}

export async function getUserRole(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data()?.role || null;
}

export function watchUserRole(uid, callback) {
  if (!uid || typeof callback !== "function") return () => {};
  const ref = doc(db, "users", uid);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback(snap.data()?.role || null);
  });
}

export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function updateUserProfileDetails(uid, payload) {
  if (!uid) throw new Error("Missing uid");
  const ref = doc(db, "users", uid);
  return setDoc(
    ref,
    {
      ...payload,
      updatedAt: new Date()
    },
    { merge: true }
  );
}

export async function upsertUserRole(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const shouldBeAdmin = isAdminEmail(user?.email);

  if (!snap.exists()) {
    const initialRole = shouldBeAdmin ? "admin" : "student";
    await setDoc(ref, {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      role: initialRole,
      createdAt: new Date()
    });
    return initialRole;
  }

  const current = snap.data()?.role || "student";

  if (current === "admin") {
    return "admin";
  }

  if (shouldBeAdmin) {
    await setDoc(ref, { role: "admin" }, { merge: true });
    return "admin";
  }

  return current;
}

export async function requireAuthenticatedUser() {
  return new Promise((resolve) => {
    let unsub = null;
    let pendingUnsub = false;
    let settled = false;

    const finish = (user) => {
      if (settled) return;
      settled = true;
      resolve(user || null);
    };

    const onUser = (user) => {
      if (typeof unsub === "function") {
        unsub();
      } else {
        pendingUnsub = true;
      }
      finish(user);
    };

    unsub = watchAuth(onUser);

    if (pendingUnsub && typeof unsub === "function") {
      unsub();
    }
  });
}

export async function requireRoleOrRedirect(expectedRole, redirectUrl = "./login.html") {
  const user = await requireAuthenticatedUser();
  if (!user) {
    redirectTo(redirectUrl);
    return null;
  }

  const role = await getUserRole(user.uid);
  const expectedRoles = Array.isArray(expectedRole) ? expectedRole : [expectedRole];

  if (!expectedRoles.includes(role)) {
    redirectTo(roleHomePath(role));
    return null;
  }

  return { user, role };
}

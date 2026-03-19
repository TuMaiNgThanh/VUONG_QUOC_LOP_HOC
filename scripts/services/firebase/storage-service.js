import { auth } from "./firebase-config.js";

function sanitizeFileName(name = "file") {
  return String(name)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function resolveUploadEndpoint() {
  const configuredEndpoint = (import.meta?.env?.VITE_DRIVE_UPLOAD_ENDPOINT || "").trim();
  if (configuredEndpoint) return configuredEndpoint;

  const localPath = "http://127.0.0.1:5001/vuongquoclophoc/us-central1/uploadToDrive";
  if (typeof window === "undefined") return "";
  const onLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  return onLocalhost ? localPath : "";
}

function mapUploadError(status, payload) {
  if (status === 401) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại rồi thử upload.";
  }

  if (status === 403) {
    return "Bạn không có quyền tải tệp. Chỉ giáo viên hoặc quản trị viên được phép.";
  }

  if (status === 413) {
    return "Kích thước tệp vượt giới hạn 25MB.";
  }

  return payload?.message || "Tải tệp thất bại.";
}

export async function uploadFile({ file, userId = "anonymous", folder = "lesson-resources" } = {}) {
  if (!file) {
    throw new Error("Vui lòng chọn file để tải lên.");
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại rồi thử upload.");
  }

  const token = await currentUser.getIdToken();
  const endpoint = resolveUploadEndpoint();
  if (!endpoint) {
    throw new Error("Thiếu cấu hình VITE_DRIVE_UPLOAD_ENDPOINT cho môi trường production.");
  }

  const payload = new FormData();
  payload.append("file", file, sanitizeFileName(file.name || "resource"));
  payload.append("folder", folder);
  payload.append("userId", userId);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: payload
    });

    let result = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      throw new Error(mapUploadError(response.status, result));
    }

    return result?.webViewLink || result?.downloadUrl || "";
  } catch (error) {
    throw new Error(error?.message || "Tải tệp thất bại.");
  }
}

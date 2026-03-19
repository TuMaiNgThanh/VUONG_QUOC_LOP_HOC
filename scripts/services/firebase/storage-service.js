import { getDownloadURL, ref, uploadBytes } from "./firebase-sdk.js";
import { auth, storage } from "./firebase-config.js";

function sanitizeFileName(name = "file") {
  return String(name)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function resolveUploadEndpoint() {
  const configuredEndpoint = (import.meta?.env?.VITE_DRIVE_UPLOAD_ENDPOINT || "").trim();
  if (configuredEndpoint) return configuredEndpoint;

  return "";
}

function resolveCloudinaryConfig() {
  const cloudName = (import.meta?.env?.VITE_CLOUDINARY_CLOUD_NAME || "").trim();
  const uploadPreset = (import.meta?.env?.VITE_CLOUDINARY_UPLOAD_PRESET || "").trim();

  if (!cloudName || !uploadPreset) {
    return null;
  }

  return {
    cloudName,
    uploadPreset
  };
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

function mapCloudinaryError(payload) {
  const message = payload?.error?.message || payload?.message || "Tải tệp lên Cloudinary thất bại.";

  if (/preset/i.test(message)) {
    return "Cloudinary upload preset không hợp lệ hoặc chưa bật unsigned upload.";
  }

  if (/file size|too large/i.test(message)) {
    return "Kích thước tệp vượt giới hạn cho phép trên Cloudinary.";
  }

  return message;
}

function mapFirebaseStorageError(error) {
  const code = error?.code;

  if (code === "storage/unauthorized") {
    return "Bạn không có quyền tải tệp. Chỉ giáo viên hoặc quản trị viên được phép.";
  }

  if (code === "storage/unauthenticated") {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại rồi thử upload.";
  }

  if (code === "storage/bucket-not-found") {
    return "Firebase Storage chưa được khởi tạo cho dự án. Vào Firebase Console > Storage > Get started.";
  }

  if (code === "storage/project-not-found") {
    return "Không tìm thấy dự án Firebase Storage. Kiểm tra lại cấu hình Firebase.";
  }

  if (code === "storage/retry-limit-exceeded") {
    return "Kết nối tới Firebase Storage bị gián đoạn. Vui lòng thử lại sau.";
  }

  return error?.message || "Tải tệp thất bại.";
}

async function uploadViaFirebaseStorage({ file, userId, folder }) {
  const safeName = sanitizeFileName(file.name || "resource");
  const path = `${folder}/${userId}/${Date.now()}-${safeName}`;
  const fileRef = ref(storage, path);

  try {
    await uploadBytes(fileRef, file, {
      contentType: file.type || undefined
    });

    return await getDownloadURL(fileRef);
  } catch (error) {
    throw new Error(mapFirebaseStorageError(error));
  }
}

async function uploadViaDriveEndpoint({ file, userId, folder, endpoint }) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại rồi thử upload.");
  }

  const token = await currentUser.getIdToken();
  const payload = new FormData();
  payload.append("file", file, sanitizeFileName(file.name || "resource"));
  payload.append("folder", folder);
  payload.append("userId", userId);

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
}

async function uploadViaCloudinary({ file, userId, folder, cloudName, uploadPreset }) {
  const pathParts = [folder, userId].filter(Boolean);
  const folderPath = pathParts.join("/");
  const safeName = sanitizeFileName((file.name || "resource").replace(/\.[^.]+$/, ""));

  const payload = new FormData();
  payload.append("file", file);
  payload.append("upload_preset", uploadPreset);
  payload.append("folder", folderPath);
  payload.append("public_id", `${Date.now()}-${safeName}`);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: payload
  });

  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    throw new Error(mapCloudinaryError(result));
  }

  return result?.secure_url || result?.url || "";
}

export async function uploadFile({ file, userId = "anonymous", folder = "lesson-resources" } = {}) {
  if (!file) {
    throw new Error("Vui lòng chọn file để tải lên.");
  }

  const endpoint = resolveUploadEndpoint();
  const cloudinary = resolveCloudinaryConfig();

  try {
    if (cloudinary) {
      return await uploadViaCloudinary({
        file,
        userId,
        folder,
        cloudName: cloudinary.cloudName,
        uploadPreset: cloudinary.uploadPreset
      });
    }

    if (endpoint) {
      return await uploadViaDriveEndpoint({ file, userId, folder, endpoint });
    }

    return await uploadViaFirebaseStorage({ file, userId, folder });
  } catch (error) {
    throw new Error(error?.message || "Tải tệp thất bại.");
  }
}

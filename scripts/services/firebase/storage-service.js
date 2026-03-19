import { getDownloadURL, ref, uploadBytes } from "./firebase-sdk.js";
import { storage } from "./firebase-config.js";

function sanitizeFileName(name = "file") {
  return String(name)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function mapStorageError(error) {
  const code = error?.code || "";

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

export async function uploadFile({ file, userId = "anonymous", folder = "lesson-resources" } = {}) {
  if (!file) {
    throw new Error("Vui lòng chọn file để tải lên.");
  }

  const safeName = sanitizeFileName(file.name || "resource");
  const stamp = Date.now();
  const filePath = `${folder}/${userId}/${stamp}-${safeName}`;
  const resourceRef = ref(storage, filePath);

  try {
    await uploadBytes(resourceRef, file, {
      contentType: file.type || undefined
    });

    return getDownloadURL(resourceRef);
  } catch (error) {
    throw new Error(mapStorageError(error));
  }
}

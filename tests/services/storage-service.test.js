import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn()
}));

vi.mock("../../scripts/services/firebase/firebase-sdk.js", () => mockFns);
vi.mock("../../scripts/services/firebase/firebase-config.js", () => ({
  storage: { key: "storage" }
}));

import { uploadFile } from "../../scripts/services/firebase/storage-service.js";

describe("storage-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.ref.mockImplementation((_storage, path) => ({ path }));
  });

  it("uploadFile throws when no file is provided", async () => {
    await expect(uploadFile()).rejects.toThrow("Vui lòng chọn file để tải lên.");
  });

  it("uploadFile uploads file and returns download URL", async () => {
    const file = { name: "English Lesson.pdf", type: "application/pdf" };
    mockFns.uploadBytes.mockResolvedValue({ ok: true });
    mockFns.getDownloadURL.mockResolvedValue("https://files.example.com/lesson.pdf");

    const url = await uploadFile({
      file,
      userId: "teacher-1",
      folder: "lesson-pdf"
    });

    expect(mockFns.ref).toHaveBeenCalledWith({ key: "storage" }, expect.stringContaining("lesson-pdf/teacher-1/"));
    expect(mockFns.uploadBytes).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining("English-Lesson.pdf") }),
      file,
      { contentType: "application/pdf" }
    );
    expect(mockFns.getDownloadURL).toHaveBeenCalledTimes(1);
    expect(url).toBe("https://files.example.com/lesson.pdf");
  });

  it("uploadFile uses defaults for missing folder and userId", async () => {
    const file = { name: "Plan.pptx", type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
    mockFns.uploadBytes.mockResolvedValue({ ok: true });
    mockFns.getDownloadURL.mockResolvedValue("https://files.example.com/plan.pptx");

    await uploadFile({ file });

    expect(mockFns.ref).toHaveBeenCalledWith(
      { key: "storage" },
      expect.stringMatching(/^lesson-resources\/anonymous\/\d+-Plan\.pptx$/)
    );
  });

  it("uploadFile sanitizes unsafe file names and falls back to resource", async () => {
    const file = { name: "@@@ ###", type: "application/octet-stream" };
    mockFns.uploadBytes.mockResolvedValue({ ok: true });
    mockFns.getDownloadURL.mockResolvedValue("https://files.example.com/resource.bin");

    await uploadFile({ file, userId: "u1", folder: "uploads" });

    expect(mockFns.ref).toHaveBeenCalledWith(
      { key: "storage" },
      expect.stringMatching(/^uploads\/u1\/\d+--$/)
    );
  });

  it("uploadFile sets undefined contentType when file.type is empty", async () => {
    const file = { name: "raw-data", type: "" };
    mockFns.uploadBytes.mockResolvedValue({ ok: true });
    mockFns.getDownloadURL.mockResolvedValue("https://files.example.com/raw-data");

    await uploadFile({ file, userId: "u2", folder: "raw" });

    expect(mockFns.uploadBytes).toHaveBeenCalledWith(
      expect.anything(),
      file,
      { contentType: undefined }
    );
  });

  it.each([
    ["storage/unauthorized", "Bạn không có quyền tải tệp. Chỉ giáo viên hoặc quản trị viên được phép."],
    ["storage/unauthenticated", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại rồi thử upload."],
    ["storage/bucket-not-found", "Firebase Storage chưa được khởi tạo cho dự án. Vào Firebase Console > Storage > Get started."],
    ["storage/project-not-found", "Không tìm thấy dự án Firebase Storage. Kiểm tra lại cấu hình Firebase."],
    ["storage/retry-limit-exceeded", "Kết nối tới Firebase Storage bị gián đoạn. Vui lòng thử lại sau."]
  ])("uploadFile maps Firebase error code %s", async (code, expected) => {
    const file = { name: "f.txt", type: "text/plain" };
    mockFns.uploadBytes.mockRejectedValue({ code });

    await expect(uploadFile({ file })).rejects.toThrow(expected);
  });

  it("uploadFile falls back to original error message for unknown code", async () => {
    const file = { name: "f.txt", type: "text/plain" };
    mockFns.uploadBytes.mockRejectedValue({ code: "storage/unknown", message: "Network down" });

    await expect(uploadFile({ file })).rejects.toThrow("Network down");
  });

  it("uploadFile falls back to generic message when unknown error has no message", async () => {
    const file = { name: "f.txt", type: "text/plain" };
    mockFns.uploadBytes.mockRejectedValue({ code: "storage/unknown" });

    await expect(uploadFile({ file })).rejects.toThrow("Tải tệp thất bại.");
  });
});

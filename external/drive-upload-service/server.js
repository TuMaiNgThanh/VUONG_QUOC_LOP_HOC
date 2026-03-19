import express from "express";
import multer from "multer";
import { Readable } from "node:stream";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { google } from "googleapis";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1
  }
});

if (!getApps().length) {
  initializeApp();
}

const ROLE_ALLOW_LIST = new Set(["teacher", "admin"]);

function setCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
}

function sanitize(value = "file") {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function parseToken(req) {
  const authHeader = String(req.headers.authorization || "");
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function readRequiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function createDriveClient() {
  const rootFolderId = readRequiredEnv("DRIVE_ROOT_FOLDER_ID");
  const raw = readRequiredEnv("DRIVE_SERVICE_ACCOUNT_JSON");

  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error("DRIVE_SERVICE_ACCOUNT_JSON must be valid JSON string");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"]
  });

  const drive = google.drive({ version: "v3", auth });
  return { drive, rootFolderId };
}

function escapeDriveQuery(value) {
  return String(value).replace(/'/g, "\\'");
}

async function findOrCreateFolder(drive, parentId, folderName) {
  const escaped = escapeDriveQuery(folderName);
  const query = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${escaped}' and trashed=false`;

  const found = await drive.files.list({
    q: query,
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  const existing = found.data.files?.[0];
  if (existing?.id) return existing.id;

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId]
    },
    fields: "id",
    supportsAllDrives: true
  });

  return created.data.id;
}

async function assertTeacherOrAdmin(uid) {
  const userSnap = await getFirestore().collection("users").doc(uid).get();
  const role = userSnap.exists ? userSnap.data()?.role : null;
  if (!ROLE_ALLOW_LIST.has(role)) {
    throw new Error("FORBIDDEN_ROLE");
  }
}

app.options("*", (_req, res) => {
  setCors(res);
  res.status(204).send("");
});

app.get("/health", (_req, res) => {
  setCors(res);
  res.status(200).json({ ok: true });
});

app.post("/upload", upload.single("file"), async (req, res) => {
  setCors(res);

  try {
    const token = parseToken(req);
    if (!token) {
      res.status(401).json({ message: "Missing authorization token" });
      return;
    }

    const decoded = await getAuth().verifyIdToken(token);
    await assertTeacherOrAdmin(decoded.uid);

    const file = req.file;
    if (!file) {
      res.status(400).json({ message: "Missing file in multipart payload" });
      return;
    }

    const folder = sanitize(req.body?.folder || "lesson-resources");
    const userId = sanitize(req.body?.userId || decoded.uid || "unknown");
    const folderName = `${folder}-${userId}`;

    const { drive, rootFolderId } = createDriveClient();
    const targetFolderId = await findOrCreateFolder(drive, rootFolderId, folderName);

    const fileName = `${Date.now()}-${sanitize(file.originalname || "upload.bin")}`;
    const created = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [targetFolderId]
      },
      media: {
        mimeType: file.mimetype || "application/octet-stream",
        body: Readable.from(file.buffer)
      },
      fields: "id",
      supportsAllDrives: true
    });

    const fileId = created.data.id;
    if (!fileId) {
      throw new Error("DRIVE_CREATE_FAILED");
    }

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone"
      },
      supportsAllDrives: true
    });

    const detail = await drive.files.get({
      fileId,
      fields: "id,name,webViewLink,webContentLink",
      supportsAllDrives: true
    });

    res.status(200).json({
      id: fileId,
      name: detail.data.name,
      webViewLink: detail.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
      downloadUrl: detail.data.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`
    });
  } catch (error) {
    if (error?.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ message: "File too large. Maximum size is 25MB." });
      return;
    }

    if (error?.message === "FORBIDDEN_ROLE") {
      res.status(403).json({ message: "Only teacher/admin can upload files." });
      return;
    }

    if (String(error?.message || "").startsWith("auth/")) {
      res.status(401).json({ message: "Invalid or expired token." });
      return;
    }

    res.status(500).json({
      message: "Drive upload failed.",
      code: error?.message || "UPLOAD_FAILED"
    });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`Drive upload service is listening on port ${port}`);
});

import { Readable } from "node:stream";
import Busboy from "busboy";
import { google } from "googleapis";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

if (!getApps().length) {
  initializeApp();
}

const DRIVE_SERVICE_ACCOUNT_JSON = defineSecret("DRIVE_SERVICE_ACCOUNT_JSON");
const DRIVE_ROOT_FOLDER_ID = defineSecret("DRIVE_ROOT_FOLDER_ID");

const ROLE_ALLOW_LIST = new Set(["teacher", "admin"]);
const MAX_FILE_SIZE = 25 * 1024 * 1024;

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function sanitizeName(value = "file") {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function parseBearerToken(req) {
  const authHeader = String(req.headers.authorization || "");
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1
      }
    });

    const fields = {};
    const chunks = [];
    let fileMeta = null;

    bb.on("file", (_name, file, info) => {
      fileMeta = {
        filename: info?.filename || "upload.bin",
        mimeType: info?.mimeType || "application/octet-stream"
      };

      file.on("data", (chunk) => chunks.push(chunk));
      file.on("limit", () => reject(new Error("FILE_TOO_LARGE")));
      file.on("error", (error) => reject(error));
    });

    bb.on("field", (name, value) => {
      fields[name] = value;
    });

    bb.on("error", (error) => reject(error));
    bb.on("finish", () => {
      if (!fileMeta || chunks.length === 0) {
        reject(new Error("MISSING_FILE"));
        return;
      }

      resolve({
        fields,
        file: {
          ...fileMeta,
          buffer: Buffer.concat(chunks)
        }
      });
    });

    bb.end(req.rawBody);
  });
}

function escapeDriveQuery(value) {
  return String(value).replace(/'/g, "\\'");
}

async function findOrCreateFolder(drive, parentId, folderName) {
  const escapedFolderName = escapeDriveQuery(folderName);
  const query = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${escapedFolderName}' and trashed=false`;

  const found = await drive.files.list({
    q: query,
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  const first = found.data.files?.[0];
  if (first?.id) return first.id;

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
  const profileSnap = await getFirestore().collection("users").doc(uid).get();
  const role = profileSnap.exists ? profileSnap.data()?.role : null;
  if (!ROLE_ALLOW_LIST.has(role)) {
    throw new Error("FORBIDDEN_ROLE");
  }
}

async function buildDriveClient() {
  const rawCredential = DRIVE_SERVICE_ACCOUNT_JSON.value();
  const rootFolderId = DRIVE_ROOT_FOLDER_ID.value();

  if (!rawCredential) throw new Error("MISSING_DRIVE_SERVICE_ACCOUNT_JSON");
  if (!rootFolderId) throw new Error("MISSING_DRIVE_ROOT_FOLDER_ID");

  let credentials;
  try {
    credentials = JSON.parse(rawCredential);
  } catch {
    throw new Error("INVALID_DRIVE_SERVICE_ACCOUNT_JSON");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"]
  });

  const drive = google.drive({ version: "v3", auth });
  return { drive, rootFolderId };
}

export const uploadToDrive = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [DRIVE_SERVICE_ACCOUNT_JSON, DRIVE_ROOT_FOLDER_ID]
  },
  async (req, res) => {
    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ message: "Method not allowed" });
      return;
    }

    try {
      const token = parseBearerToken(req);
      if (!token) {
        res.status(401).json({ message: "Missing authorization token" });
        return;
      }

      const decoded = await getAuth().verifyIdToken(token);
      await assertTeacherOrAdmin(decoded.uid);

      const { file, fields } = await parseMultipart(req);
      const userId = sanitizeName(fields.userId || decoded.uid || "unknown");
      const folder = sanitizeName(fields.folder || "lesson-resources");

      const { drive, rootFolderId } = await buildDriveClient();
      const targetFolder = await findOrCreateFolder(drive, rootFolderId, `${folder}-${userId}`);

      const savedName = `${Date.now()}-${sanitizeName(file.filename)}`;
      const created = await drive.files.create({
        requestBody: {
          name: savedName,
          parents: [targetFolder]
        },
        media: {
          mimeType: file.mimeType,
          body: Readable.from(file.buffer)
        },
        fields: "id",
        supportsAllDrives: true
      });

      const fileId = created.data.id;
      if (!fileId) throw new Error("DRIVE_CREATE_FAILED");

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

      const webViewLink = detail.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
      const downloadUrl = detail.data.webContentLink || `https://drive.google.com/uc?id=${fileId}&export=download`;

      res.status(200).json({
        id: fileId,
        name: detail.data.name,
        webViewLink,
        downloadUrl
      });
    } catch (error) {
      const code = error?.message || "UPLOAD_FAILED";

      if (code === "FILE_TOO_LARGE") {
        res.status(413).json({ message: "File too large. Maximum size is 25MB." });
        return;
      }

      if (code === "MISSING_FILE") {
        res.status(400).json({ message: "Missing file in multipart payload." });
        return;
      }

      if (code === "FORBIDDEN_ROLE") {
        res.status(403).json({ message: "Only teacher/admin can upload files." });
        return;
      }

      if (code === "auth/id-token-expired" || code === "auth/argument-error") {
        res.status(401).json({ message: "Invalid or expired token." });
        return;
      }

      res.status(500).json({ message: "Drive upload failed.", code });
    }
  }
);

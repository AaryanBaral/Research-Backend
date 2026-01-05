import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { v2 as cloudinary } from "cloudinary";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.resolve(__dirname, "..", "..", process.env.UPLOAD_DIR || "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".mp4";
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 500 },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const getBaseUrl = (req) => process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
const buildPublicUrl = (req, storedPath, filename, folder = "") => {
  if (storedPath && storedPath.startsWith("http")) {
    return storedPath;
  }
  const base = getBaseUrl(req);
  if (!filename) {
    return "";
  }
  const suffix = folder ? `/${folder}/${filename}` : `/${filename}`;
  return `${base}/uploads${suffix}`;
};

const buildCloudinaryThumbnail = (publicId) => {
  if (!publicId || !process.env.CLOUDINARY_CLOUD_NAME) {
    return "";
  }
  const encodedId = encodeURIComponent(publicId);
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload/so_auto,w_640,h_360,c_fill,q_auto,f_auto/${encodedId}.jpg`;
};

const toVideoResponse = (req, video) => {
  const fullUrl = buildPublicUrl(req, video.storage_path, video.filename);
  const thumbnailUrl = video.storage_path?.startsWith("http")
    ? buildCloudinaryThumbnail(video.filename)
    : "";

  return {
    id: video.id,
    subtopic_id: video.subtopic_id,
    filename: video.filename,
    original_name: video.original_name,
    mime_type: video.mime_type,
    size_bytes: video.size_bytes,
    created_at: video.created_at,
    url: fullUrl,
    thumbnail_url: thumbnailUrl,
  };
};

router.post("/", requireAuth, upload.single("video"), async (req, res) => {
  const { subtopicId } = req.body || {};

  if (!subtopicId) {
    return res.status(400).json({ error: "subtopicId is required" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "video file is required" });
  }

  try {
    const cloudinaryReady =
      !!process.env.CLOUDINARY_CLOUD_NAME &&
      !!process.env.CLOUDINARY_API_KEY &&
      !!process.env.CLOUDINARY_API_SECRET;

    let storagePath = req.file.path;
    let storedFilename = req.file.filename;
    let sizeBytes = req.file.size;

    if (cloudinaryReady) {
      const publicId = `${process.env.CLOUDINARY_VIDEO_FOLDER || "research/videos"}/${uuidv4()}`;
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          resource_type: "video",
          public_id: publicId,
        });
        storagePath = uploadResult.secure_url || req.file.path;
        storedFilename = uploadResult.public_id || req.file.filename;
        sizeBytes = uploadResult.bytes || req.file.size;
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", {
          message: uploadError?.message,
          name: uploadError?.name,
          http_code: uploadError?.http_code,
          stack: uploadError?.stack,
          error: uploadError,
        });
        throw uploadError;
      }
    }

    const result = await query(
      `INSERT INTO videos
        (subtopic_id, user_id, original_name, filename, mime_type, size_bytes, storage_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, subtopic_id, filename, original_name, mime_type, size_bytes, storage_path, created_at`,
      [
        subtopicId,
        req.user.id,
        req.file.originalname,
        storedFilename,
        req.file.mimetype,
        sizeBytes,
        storagePath,
      ]
    );

    const video = result.rows[0];
    if (storagePath.startsWith("http")) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(201).json({
      video: toVideoResponse(req, video),
    });
  } catch (error) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(500).json({ error: "Failed to store video" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  const { subtopicId } = req.query;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  try {
    if (subtopicId) {
      const result = await query(
      `SELECT id, subtopic_id, filename, original_name, mime_type, size_bytes, storage_path, created_at
         FROM videos
         WHERE subtopic_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [subtopicId, limit, offset]
      );
      const videos = result.rows.map((video) => toVideoResponse(req, video));
      const countResult = await query(
        `SELECT COUNT(*)::int AS total
         FROM videos
         WHERE subtopic_id = $1`,
        [subtopicId]
      );
      const total = countResult.rows[0]?.total || 0;
      return res.json({ videos, page, limit, total });
    }

    const result = await query(
      `SELECT id, subtopic_id, filename, original_name, mime_type, size_bytes, storage_path, created_at
       FROM videos
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const videos = result.rows.map((video) => toVideoResponse(req, video));
    const countResult = await query(`SELECT COUNT(*)::int AS total FROM videos`);
    const total = countResult.rows[0]?.total || 0;
    return res.json({ videos, page, limit, total });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch videos" });
  }
});

router.get("/subtopic/:subtopicId", async (req, res) => {
  const { subtopicId } = req.params;

  try {
    const result = await query(
      `SELECT id, subtopic_id, filename, original_name, mime_type, size_bytes, storage_path, created_at
       FROM videos
       WHERE subtopic_id = $1
       ORDER BY created_at DESC`,
      [subtopicId]
    );

    const videos = result.rows.map((video) => toVideoResponse(req, video));

    return res.json({ videos });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch videos" });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { subtopicId } = req.body || {};

  if (!subtopicId) {
    return res.status(400).json({ error: "subtopicId is required" });
  }

  try {
    const result = await query(
      `UPDATE videos
       SET subtopic_id = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, subtopic_id, filename, original_name, mime_type, size_bytes, storage_path, created_at`,
      [subtopicId, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Video not found" });
    }

    const video = result.rows[0];
    return res.json({
      video: toVideoResponse(req, video),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update video" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `DELETE FROM videos
       WHERE id = $1 AND user_id = $2
       RETURNING id, filename, storage_path`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Video not found" });
    }

    const video = result.rows[0];
    if (video.storage_path && video.storage_path.startsWith("http")) {
      cloudinary.uploader
        .destroy(video.filename, { resource_type: "video" })
        .catch((destroyError) => {
          console.error("Cloudinary delete failed:", {
            message: destroyError?.message,
            name: destroyError?.name,
            http_code: destroyError?.http_code,
            stack: destroyError?.stack,
            error: destroyError,
          });
        });
    } else {
      const filePath = video.storage_path || path.join(uploadDir, video.filename);
      fs.unlink(filePath, () => {});
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete video" });
  }
});

export default router;

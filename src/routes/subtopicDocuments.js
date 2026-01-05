import express from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const getPagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

router.get("/", async (req, res) => {
  const { subtopicId } = req.query;
  const { page, limit, offset } = getPagination(req.query);

  if (!subtopicId) {
    return res.status(400).json({ error: "subtopicId is required" });
  }

  try {
    const result = await query(
      `SELECT id, subtopic_id, title, url, description, created_at
       FROM subtopic_documents
       WHERE subtopic_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [subtopicId, limit, offset]
    );
    const countResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM subtopic_documents
       WHERE subtopic_id = $1`,
      [subtopicId]
    );
    const total = countResult.rows[0]?.total || 0;
    return res.json({ documents: result.rows, page, limit, total });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch documents" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT id, subtopic_id, title, url, description, created_at
       FROM subtopic_documents
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    return res.json({ document: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch document" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const { subtopicId, title, url, description } = req.body || {};

  if (!subtopicId) {
    return res.status(400).json({ error: "subtopicId is required" });
  }

  if (!title || !url) {
    return res.status(400).json({ error: "title and url are required" });
  }

  try {
    const result = await query(
      `INSERT INTO subtopic_documents (subtopic_id, title, url, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, subtopic_id, title, url, description, created_at`,
      [subtopicId, title, url, description || null]
    );
    return res.status(201).json({ document: result.rows[0] });
  } catch (error) {
    if (error?.code === "23503") {
      return res.status(400).json({ error: "subtopicId does not exist" });
    }
    return res.status(500).json({ error: "Failed to create document" });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, url, description } = req.body || {};

  if (!title && !url && typeof description === "undefined") {
    return res.status(400).json({ error: "title, url, or description is required" });
  }

  try {
    const result = await query(
      `UPDATE subtopic_documents
       SET title = COALESCE($1, title),
           url = COALESCE($2, url),
           description = COALESCE($3, description)
       WHERE id = $4
       RETURNING id, subtopic_id, title, url, description, created_at`,
      [title || null, url || null, description ?? null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    return res.json({ document: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update document" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `DELETE FROM subtopic_documents
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete document" });
  }
});

export default router;

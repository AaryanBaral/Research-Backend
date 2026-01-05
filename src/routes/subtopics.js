import express from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getPagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

router.get("/", async (req, res) => {
  const { topicId, search } = req.query;
  const { page, limit, offset } = getPagination(req.query);
  const trimmedSearch = typeof search === "string" ? search.trim() : "";
  const regex = trimmedSearch ? `.*${escapeRegex(trimmedSearch)}.*` : null;

  try {
    const result = await query(
      `SELECT id, topic_id, name, description, has_animated_docs, created_at
       FROM subtopics
       WHERE ($1::text IS NULL OR topic_id = $1)
         AND ($2::text IS NULL OR name ~* $2 OR id ~* $2 OR COALESCE(description, '') ~* $2)
       ORDER BY name ASC
       LIMIT $3 OFFSET $4`,
      [topicId || null, regex, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM subtopics
       WHERE ($1::text IS NULL OR topic_id = $1)
         AND ($2::text IS NULL OR name ~* $2 OR id ~* $2 OR COALESCE(description, '') ~* $2)`,
      [topicId || null, regex]
    );
    const total = countResult.rows[0]?.total || 0;

    return res.json({ subtopics: result.rows, page, limit, total });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch subtopics" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT id, topic_id, name, description, has_animated_docs, created_at
       FROM subtopics
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Subtopic not found" });
    }

    return res.json({ subtopic: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch subtopic" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const { id, topicId, name, description, hasAnimatedDocs } = req.body || {};

  if (!topicId) {
    return res.status(400).json({ error: "topicId is required" });
  }

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const subtopicId = id || slugify(`${topicId}-${name}`);
  if (!subtopicId) {
    return res.status(400).json({ error: "id could not be generated" });
  }

  try {
    const result = await query(
      `INSERT INTO subtopics (id, topic_id, name, description, has_animated_docs)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, topic_id, name, description, has_animated_docs, created_at`,
      [subtopicId, topicId, name, description || null, Boolean(hasAnimatedDocs)]
    );
    return res.status(201).json({ subtopic: result.rows[0] });
  } catch (error) {
    if (error?.code === "23503") {
      return res.status(400).json({ error: "topicId does not exist" });
    }
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Subtopic already exists" });
    }
    return res.status(500).json({ error: "Failed to create subtopic" });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, description, topicId, hasAnimatedDocs } = req.body || {};

  if (!name && typeof description === "undefined" && !topicId && typeof hasAnimatedDocs === "undefined") {
    return res
      .status(400)
      .json({ error: "name, description, topicId, or hasAnimatedDocs is required" });
  }

  try {
    const result = await query(
      `UPDATE subtopics
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           topic_id = COALESCE($3, topic_id),
           has_animated_docs = COALESCE($4, has_animated_docs)
       WHERE id = $5
       RETURNING id, topic_id, name, description, has_animated_docs, created_at`,
      [name || null, description ?? null, topicId || null, hasAnimatedDocs ?? null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Subtopic not found" });
    }

    return res.json({ subtopic: result.rows[0] });
  } catch (error) {
    if (error?.code === "23503") {
      return res.status(400).json({ error: "topicId does not exist" });
    }
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Subtopic already exists" });
    }
    return res.status(500).json({ error: "Failed to update subtopic" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `DELETE FROM subtopics
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Subtopic not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete subtopic" });
  }
});

export default router;

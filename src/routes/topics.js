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
  const { categoryId, search } = req.query;
  const { page, limit, offset } = getPagination(req.query);
  const trimmedSearch = typeof search === "string" ? search.trim() : "";
  const regex = trimmedSearch ? `.*${escapeRegex(trimmedSearch)}.*` : null;

  try {
    const result = await query(
      `SELECT id, category_id, name, description, created_at
       FROM topics
       WHERE ($1::text IS NULL OR category_id = $1)
         AND ($2::text IS NULL OR name ~* $2 OR id ~* $2 OR COALESCE(description, '') ~* $2)
       ORDER BY name ASC
       LIMIT $3 OFFSET $4`,
      [categoryId || null, regex, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM topics
       WHERE ($1::text IS NULL OR category_id = $1)
         AND ($2::text IS NULL OR name ~* $2 OR id ~* $2 OR COALESCE(description, '') ~* $2)`,
      [categoryId || null, regex]
    );
    const total = countResult.rows[0]?.total || 0;

    return res.json({ topics: result.rows, page, limit, total });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch topics" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT id, category_id, name, description, created_at
       FROM topics
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Topic not found" });
    }

    return res.json({ topic: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch topic" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const { id, categoryId, name, description } = req.body || {};

  if (!categoryId) {
    return res.status(400).json({ error: "categoryId is required" });
  }

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const topicId = id || slugify(`${categoryId}-${name}`);
  if (!topicId) {
    return res.status(400).json({ error: "id could not be generated" });
  }

  try {
    const result = await query(
      `INSERT INTO topics (id, category_id, name, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, category_id, name, description, created_at`,
      [topicId, categoryId, name, description || null]
    );
    return res.status(201).json({ topic: result.rows[0] });
  } catch (error) {
    if (error?.code === "23503") {
      return res.status(400).json({ error: "categoryId does not exist" });
    }
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Topic already exists" });
    }
    return res.status(500).json({ error: "Failed to create topic" });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, description, categoryId } = req.body || {};

  if (!name && typeof description === "undefined" && !categoryId) {
    return res.status(400).json({ error: "name, description, or categoryId is required" });
  }

  try {
    const result = await query(
      `UPDATE topics
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           category_id = COALESCE($3, category_id)
       WHERE id = $4
       RETURNING id, category_id, name, description, created_at`,
      [name || null, description ?? null, categoryId || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Topic not found" });
    }

    return res.json({ topic: result.rows[0] });
  } catch (error) {
    if (error?.code === "23503") {
      return res.status(400).json({ error: "categoryId does not exist" });
    }
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Topic already exists" });
    }
    return res.status(500).json({ error: "Failed to update topic" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `DELETE FROM topics
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Topic not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete topic" });
  }
});

export default router;

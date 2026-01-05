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

router.get("/", async (_req, res) => {
  try {
    const { search } = _req.query;
    const { page, limit, offset } = getPagination(_req.query);
    const trimmedSearch = typeof search === "string" ? search.trim() : "";
    const regex = trimmedSearch ? `.*${escapeRegex(trimmedSearch)}.*` : null;

    const result = await query(
      `SELECT id, name, description, created_at
       FROM categories
       WHERE ($1::text IS NULL OR name ~* $1 OR id ~* $1 OR COALESCE(description, '') ~* $1)
       ORDER BY name ASC
       LIMIT $2 OFFSET $3`,
      [regex, limit, offset]
    );
    const countResult = await query(
      `SELECT COUNT(*)::int AS total
       FROM categories
       WHERE ($1::text IS NULL OR name ~* $1 OR id ~* $1 OR COALESCE(description, '') ~* $1)`,
      [regex]
    );
    const total = countResult.rows[0]?.total || 0;

    return res.json({ categories: result.rows, page, limit, total });
  } catch (error) {
    return res
      .status(500)
      .json({ error: error?.message || "Failed to fetch categories" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT id, name, description, created_at
       FROM categories
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    return res.json({ category: result.rows[0] });
  } catch (error) {
    return res
      .status(500)
      .json({ error: error?.message || "Failed to fetch category" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const { id, name, description } = req.body || {};

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const categoryId = id || slugify(name);
  if (!categoryId) {
    return res.status(400).json({ error: "id could not be generated" });
  }

  try {
    const result = await query(
      `INSERT INTO categories (id, name, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, created_at`,
      [categoryId, name, description || null]
    );
    return res.status(201).json({ category: result.rows[0] });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Category already exists" });
    }
    return res
      .status(500)
      .json({ error: error?.message || "Failed to create category" });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body || {};

  if (!name && typeof description === "undefined") {
    return res.status(400).json({ error: "name or description is required" });
  }

  try {
    const result = await query(
      `UPDATE categories
       SET name = COALESCE($1, name),
           description = COALESCE($2, description)
       WHERE id = $3
       RETURNING id, name, description, created_at`,
      [name || null, description ?? null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    return res.json({ category: result.rows[0] });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Category name already exists" });
    }
    return res
      .status(500)
      .json({ error: error?.message || "Failed to update category" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `DELETE FROM categories
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    return res
      .status(500)
      .json({ error: error?.message || "Failed to delete category" });
  }
});

export default router;

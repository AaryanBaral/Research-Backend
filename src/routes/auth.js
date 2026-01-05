import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const result = await query(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to login" });
  }
});

export default router;

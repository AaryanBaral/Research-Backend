import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { query } from "./db.js";

dotenv.config();

const adminEmail = (process.env.ADMIN_EMAIL || "admin@research.local").trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";
const adminName = process.env.ADMIN_NAME || "Admin";

async function main() {
  try {
    const existing = await query("SELECT id FROM users WHERE email = $1", [adminEmail]);
    if (existing.rows.length > 0) {
      console.log("Admin already exists.");
      return;
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)",
      [adminName, adminEmail, passwordHash]
    );

    console.log("Admin seeded:");
    console.log(`  email: ${adminEmail}`);
    console.log(`  password: ${adminPassword}`);
  } catch (error) {
    console.error("Failed to seed admin:", error.message || error);
    process.exitCode = 1;
  }
}

main();

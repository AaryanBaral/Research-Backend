import pg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pg;

if (!process.env.PG_CA_CERT) throw new Error("PG_CA_CERT missing");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");

const ca = process.env.PG_CA_CERT.replace(/\\n/g, "\n");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca,                
    rejectUnauthorized: true,
  },
});

// optional: verify a connection once at boot
pool.connect().then(c => c.release()).catch(err => {
  console.error("DB connect failed:", err);
});

export default pool;
export const query = (text, params) => pool.query(text, params);

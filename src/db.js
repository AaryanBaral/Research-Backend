import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const ca = process.env.PG_CA_CERT?.replace(/\\n/g, "\n");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:{
    rejectUnauthorized: false,
    ca
  },
});

export const query = (text, params) => pool.query(text, params);
export default pool;

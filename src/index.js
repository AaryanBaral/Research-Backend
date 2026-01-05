import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import videoRoutes from "./routes/videos.js";
import categoryRoutes from "./routes/categories.js";
import topicRoutes from "./routes/topics.js";
import subtopicRoutes from "./routes/subtopics.js";
import subtopicDocumentRoutes from "./routes/subtopicDocuments.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const corsOrigin = process.env.CORS_ORIGIN || "*";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "..", process.env.UPLOAD_DIR || "uploads");

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  const startTime = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1e6;
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(
        1
      )}ms`
    );
  });
  next();
});

app.use("/uploads", express.static(uploadDir));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/topics", topicRoutes);
app.use("/api/subtopics", subtopicRoutes);
app.use("/api/subtopic-documents", subtopicDocumentRoutes);

app.use((err, _req, res, _next) => {
  console.error("Request error:", err);
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "Video exceeds 500MB limit" });
  }
  return res.status(500).json({ error: "Unexpected server error" });
});

app.listen(port, () => {
  console.log(`Video backend listening on port ${port}`);
});

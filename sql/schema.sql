CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category_id, name)
);

CREATE INDEX IF NOT EXISTS topics_category_id_idx ON topics(category_id);

CREATE TABLE IF NOT EXISTS subtopics (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  has_animated_docs BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topic_id, name)
);

CREATE INDEX IF NOT EXISTS subtopics_topic_id_idx ON subtopics(topic_id);

CREATE TABLE IF NOT EXISTS subtopic_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subtopic_id TEXT NOT NULL REFERENCES subtopics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subtopic_documents_subtopic_id_idx
  ON subtopic_documents(subtopic_id);

CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subtopic_id TEXT REFERENCES subtopics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS videos_subtopic_id_idx ON videos(subtopic_id);

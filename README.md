# Research Video Backend

Minimal Express + PostgreSQL backend for auth and video uploads tied to a subtopic.

## Setup

1. Run migrations:

```sh
npm run migrate
```

2. Copy env file:

```sh
cp .env.example .env
```

3. Install deps and run:

```sh
npm install
npm run seed:admin
npm run seed:videos
npm run dev
```

## Thumbnail generation

Uploads and seeds use `ffmpeg` to generate thumbnails. Ensure `ffmpeg` is installed and available on your PATH.

## Endpoints

- `POST /api/auth/login` { email, password }
- `POST /api/videos` (auth, multipart form-data: `video`, `subtopicId`)
- `GET /api/videos` (auth, optional query: `subtopicId`)
- `GET /api/videos/subtopic/:subtopicId`
- `PATCH /api/videos/:id` { subtopicId }
- `DELETE /api/videos/:id`
- `GET /api/categories`
- `POST /api/categories` (auth)
- `PATCH /api/categories/:id` (auth)
- `DELETE /api/categories/:id` (auth)
- `GET /api/topics` (optional query: `categoryId`)
- `POST /api/topics` (auth)
- `PATCH /api/topics/:id` (auth)
- `DELETE /api/topics/:id` (auth)
- `GET /api/subtopics` (optional query: `topicId`)
- `POST /api/subtopics` (auth)
- `PATCH /api/subtopics/:id` (auth)
- `DELETE /api/subtopics/:id` (auth)
- `GET /api/subtopic-documents` (query: `subtopicId`)
- `GET /api/subtopic-documents/:id`
- `POST /api/subtopic-documents` (auth)
- `PATCH /api/subtopic-documents/:id` (auth)
- `DELETE /api/subtopic-documents/:id` (auth)

When Cloudinary is not configured, uploaded files are served from `/uploads/<filename>`.

## Cloudinary uploads

Video uploads are stored in Cloudinary when `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are set. Optional: set `CLOUDINARY_VIDEO_FOLDER` to control the folder name. If the credentials are omitted, uploads stay on disk.

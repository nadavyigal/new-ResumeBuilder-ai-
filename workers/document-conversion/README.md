# MarkItDown Document Conversion Service

FastAPI microservice that wraps Microsoft MarkItDown to convert PDF and DOCX resume files into structured Markdown.

## Why a separate service

MarkItDown is Python. ResumeBuilder runs on Vercel (Node). Vercel's Python runtime cannot reliably handle MarkItDown's native library dependencies (pypdf, python-docx). Railway or Render host this service; Vercel calls it via `MARKITDOWN_SERVICE_URL`.

## Local development

```bash
cd workers/document-conversion
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Test:
```bash
curl -F "file=@/path/to/resume.pdf" http://localhost:8000/convert
curl http://localhost:8000/health
```

## Docker

```bash
docker build -t markitdown-service .
docker run -p 8000:8000 -e ALLOWED_ORIGINS=http://localhost:3000 markitdown-service
```

## Deploy to Railway

1. Create a new Railway project, point at this directory.
2. Set `ALLOWED_ORIGINS` to your ResumeBuilder production domain.
3. Copy the Railway service URL into Vercel as `MARKITDOWN_SERVICE_URL`.

## API

### `POST /convert`

Accepts: `multipart/form-data` with a `file` field (PDF or DOCX, max 10MB).

Returns:
```json
{
  "markdown": "# John Doe\n\n## Experience\n...",
  "format": "pdf",
  "char_count": 1842
}
```

Errors: 400 (empty), 413 (too large), 415 (wrong format), 500 (parse failure).

### `GET /health`

Returns `{"status": "ok", "max_file_mb": 10}`.

## Security

- Files are written to a temp path with a uuid name — never the user-supplied filename.
- Temp files are deleted in a `finally` block on both success and failure.
- Only `.pdf` and `.docx` extensions accepted.
- `MAX_FILE_SIZE_MB` enforced before conversion runs.
- Service runs as a non-root user in Docker.

"""
MarkItDown microservice — FastAPI entry point.
Exposes POST /convert and GET /health.
"""

import os
import logging
from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from converter import convert_file

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MarkItDown Conversion Service", version="1.0.0")

MAX_MB = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
MAX_BYTES = MAX_MB * 1024 * 1024

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

ALLOWED_EXTENSIONS = {".pdf", ".docx"}


def _validate_file(file: UploadFile) -> None:
    name = (file.filename or "").lower()
    ext = os.path.splitext(name)[1]
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(415, f"Unsupported file extension: {ext}. Allowed: pdf, docx")
    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        logger.warning("Unexpected content-type %s for %s", file.content_type, name)


@app.post("/convert")
async def convert(file: UploadFile):
    _validate_file(file)

    file_bytes = await file.read()
    if len(file_bytes) > MAX_BYTES:
        raise HTTPException(413, f"File exceeds {MAX_MB}MB limit")
    if len(file_bytes) == 0:
        raise HTTPException(400, "Empty file")

    logger.info("Converting %s (%d bytes)", file.filename, len(file_bytes))

    try:
        result = convert_file(file_bytes, file.filename or "upload.pdf")
    except ValueError as e:
        raise HTTPException(415, str(e))
    except Exception as e:
        logger.exception("Conversion failed for %s", file.filename)
        raise HTTPException(500, f"Conversion error: {str(e)}")

    logger.info("Converted %s: %d chars of Markdown", file.filename, result["char_count"])
    return result


@app.get("/health")
async def health():
    return {"status": "ok", "max_file_mb": MAX_MB}

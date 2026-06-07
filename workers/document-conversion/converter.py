"""
MarkItDown wrapper with safe temp file handling.
Initialized once at module level to avoid re-loading dependencies per request.
"""

import os
import tempfile
from markitdown import MarkItDown

_md = MarkItDown()


def convert_file(file_bytes: bytes, original_filename: str) -> dict:
    """
    Convert a PDF or DOCX file to Markdown.
    Uses a uuid-named temp file — never the user-supplied filename.
    Cleans up on both success and failure.
    """
    name = original_filename.lower()
    if name.endswith(".pdf"):
        suffix = ".pdf"
        fmt = "pdf"
    elif name.endswith(".docx"):
        suffix = ".docx"
        fmt = "docx"
    else:
        raise ValueError(f"Unsupported file format: {original_filename}")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        result = _md.convert(tmp_path)
        markdown = result.text_content or ""

        return {
            "markdown": markdown,
            "format": fmt,
            "char_count": len(markdown),
        }
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

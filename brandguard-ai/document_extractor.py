
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader
from docx import Document
from pptx import Presentation


MAX_FILE_SIZE = 15 * 1024 * 1024

SUPPORTED_FORMATS = {".pdf", ".docx", ".pptx", ".txt"}


class DocumentExtractionError(Exception):
    pass


def extract_document_text(file_bytes: bytes, filename: str) -> dict:
    """
    Extract readable text from an uploaded document.
    Returns extraction status, filename, format and extracted text.
    """

    extension = Path(filename).suffix.lower()

    if extension not in SUPPORTED_FORMATS:
        raise DocumentExtractionError(
            f"Unsupported document format: {extension or 'unknown'}"
        )

    if not file_bytes:
        raise DocumentExtractionError("The uploaded document is empty.")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise DocumentExtractionError(
            "Document exceeds the 15 MB size limit."
        )

    try:
        if extension == ".pdf":
            text = extract_pdf(file_bytes)

        elif extension == ".docx":
            text = extract_docx(file_bytes)

        elif extension == ".pptx":
            text = extract_pptx(file_bytes)

        else:
            text = extract_txt(file_bytes)

    except DocumentExtractionError:
        raise

    except Exception as exc:
        raise DocumentExtractionError(
            "Unable to read this document. It may be damaged, "
            "encrypted or in an unsupported format."
        ) from exc

    text = text.strip()

    if not text:
        raise DocumentExtractionError(
            "No readable text was found. The document may be scanned "
            "or contain only images."
        )

    return {
        "filename": Path(filename).name,
        "format": extension.lstrip(".").upper(),
        "status": "extracted",
        "text": text,
        "character_count": len(text)
    }


def extract_pdf(file_bytes: bytes) -> str:
    reader = PdfReader(BytesIO(file_bytes))

    if reader.is_encrypted:
        raise DocumentExtractionError(
            "Password-protected PDFs are not supported."
        )

    pages = []

    for page_number, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text() or ""

        if page_text.strip():
            pages.append(
                f"[Page {page_number}]\n{page_text.strip()}"
            )

    return "\n\n".join(pages)


def extract_docx(file_bytes: bytes) -> str:
    document = Document(BytesIO(file_bytes))

    parts = []

    for paragraph in document.paragraphs:
        if paragraph.text.strip():
            parts.append(paragraph.text.strip())

    for table in document.tables:
        for row in table.rows:
            cells = [
                cell.text.strip()
                for cell in row.cells
                if cell.text.strip()
            ]

            if cells:
                parts.append(" | ".join(cells))

    return "\n".join(parts)


def extract_pptx(file_bytes: bytes) -> str:
    presentation = Presentation(BytesIO(file_bytes))

    slides = []

    for slide_number, slide in enumerate(
        presentation.slides, start=1
    ):
        slide_parts = []

        for shape in slide.shapes:
            if shape.has_text_frame:
                content = shape.text.strip()

                if content:
                    slide_parts.append(content)

            if shape.has_table:
                for row in shape.table.rows:
                    cells = [
                        cell.text.strip()
                        for cell in row.cells
                        if cell.text.strip()
                    ]

                    if cells:
                        slide_parts.append(" | ".join(cells))

        if slide_parts:
            slides.append(
                f"[Slide {slide_number}]\n"
                + "\n".join(slide_parts)
            )

    return "\n\n".join(slides)


def extract_txt(file_bytes: bytes) -> str:
    try:
        return file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            return file_bytes.decode("cp1252")
        except UnicodeDecodeError as exc:
            raise DocumentExtractionError(
                "The TXT file encoding is not supported."
            ) from exc

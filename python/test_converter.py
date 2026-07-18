"""Tests for converter.py — tests our integration logic, not Docling internals."""

import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add python dir to path so we can import converter
sys.path.insert(0, str(Path(__file__).parent))

from converter import (
    convert,
    convert_md_to_pdf,
    dispatch,
    make_error,
    make_success,
    pdf_compress,
    pdf_merge,
    pdf_split,
    validate_input,
)


def _make_pdf(path, pages=1):
    import fitz
    doc = fitz.open()
    for _ in range(pages):
        doc.new_page()
    doc.save(str(path))
    doc.close()


class TestValidateInput:
    def test_empty_input_path(self):
        err = validate_input("", None)
        assert err is not None
        assert err["errorCode"] == "INVALID_INPUT"

    def test_nonexistent_file(self):
        err = validate_input("C:\\nao\\existe\\arquivo.pdf", None)
        assert err is not None
        assert err["errorCode"] == "FILE_NOT_FOUND"

    def test_invalid_extension(self, tmp_path):
        txt_file = tmp_path / "documento.txt"
        txt_file.write_text("conteudo")
        err = validate_input(str(txt_file), None)
        assert err is not None
        assert err["errorCode"] == "INVALID_EXTENSION"

    def test_valid_pdf_no_output(self, tmp_path):
        pdf = tmp_path / "doc.pdf"
        pdf.write_bytes(b"%PDF-1.4 test")
        err = validate_input(str(pdf), None)
        assert err is None

    def test_output_dir_created(self, tmp_path):
        pdf = tmp_path / "doc.pdf"
        pdf.write_bytes(b"%PDF-1.4 test")
        out_dir = tmp_path / "subdir" / "nested"
        out_path = out_dir / "doc.md"
        err = validate_input(str(pdf), str(out_path))
        assert err is None
        assert out_dir.exists()

    def test_special_chars_in_filename(self, tmp_path):
        pdf = tmp_path / "relatório_2024 (v2).pdf"
        pdf.write_bytes(b"%PDF-1.4 test")
        err = validate_input(str(pdf), None)
        assert err is None


class TestConvert:
    def test_file_not_found_returns_error_json(self):
        result = convert("C:\\nao\\existe\\arquivo.pdf", None)
        assert result["success"] is False
        assert result["errorCode"] == "FILE_NOT_FOUND"
        assert "message" in result

    def test_invalid_extension_returns_error_json(self, tmp_path):
        txt = tmp_path / "doc.txt"
        txt.write_text("texto")
        result = convert(str(txt), None)
        assert result["success"] is False
        assert result["errorCode"] == "INVALID_EXTENSION"

    def test_invalid_output_path(self, tmp_path):
        pdf = tmp_path / "doc.pdf"
        pdf.write_bytes(b"%PDF-1.4 test")
        # Pass a path to a location where we can't write (root of a non-writable path)
        # We mock the mkdir to raise OSError
        with patch("converter.Path.mkdir", side_effect=OSError("permission denied")):
            result = convert(str(pdf), "C:\\Windows\\System32\\cantwrite\\doc.md")
        assert result["success"] is False
        assert result["errorCode"] in ("OUTPUT_ERROR", "FILE_NOT_FOUND", "INVALID_INPUT")

    def test_successful_conversion(self, tmp_path):
        pdf = tmp_path / "doc.pdf"
        pdf.write_bytes(b"%PDF-1.4 test")
        output = tmp_path / "doc.md"

        mock_result = MagicMock()
        mock_result.document.export_to_markdown.return_value = "# Título\n\nConteúdo convertido."

        mock_converter_instance = MagicMock()
        mock_converter_instance.convert.return_value = mock_result

        with patch("docling.document_converter.DocumentConverter", return_value=mock_converter_instance):
            result = convert(str(pdf), str(output))

        assert result["success"] is True
        assert "markdown" in result
        assert result["markdown"] == "# Título\n\nConteúdo convertido."
        assert "durationMs" in result
        assert isinstance(result["durationMs"], int)
        assert output.read_text(encoding="utf-8") == "# Título\n\nConteúdo convertido."

    def test_conversion_without_output_path(self, tmp_path):
        pdf = tmp_path / "doc.pdf"
        pdf.write_bytes(b"%PDF-1.4 test")

        mock_result = MagicMock()
        mock_result.document.export_to_markdown.return_value = "# Sem salvar"

        mock_converter_instance = MagicMock()
        mock_converter_instance.convert.return_value = mock_result

        with patch("docling.document_converter.DocumentConverter", return_value=mock_converter_instance):
            result = convert(str(pdf), None)

        assert result["success"] is True
        assert result["markdown"] == "# Sem salvar"
        assert result["outputPath"] == ""

    def test_docling_exception_returns_conversion_failed(self, tmp_path):
        pdf = tmp_path / "doc.pdf"
        pdf.write_bytes(b"%PDF-1.4 test")

        mock_converter_instance = MagicMock()
        mock_converter_instance.convert.side_effect = RuntimeError("Docling internal error")

        with patch("docling.document_converter.DocumentConverter", return_value=mock_converter_instance):
            result = convert(str(pdf), None)

        assert result["success"] is False
        assert result["errorCode"] == "CONVERSION_FAILED"

    def test_special_chars_filename(self, tmp_path):
        pdf = tmp_path / "relatório_2024 (versão 2).pdf"
        pdf.write_bytes(b"%PDF-1.4 test")

        mock_result = MagicMock()
        mock_result.document.export_to_markdown.return_value = "# Relatório"

        mock_converter_instance = MagicMock()
        mock_converter_instance.convert.return_value = mock_result

        with patch("docling.document_converter.DocumentConverter", return_value=mock_converter_instance):
            result = convert(str(pdf), None)

        assert result["success"] is True


class TestDispatch:
    def test_unknown_tool(self):
        result = dispatch("inexistente", {})
        assert result["success"] is False
        assert result["errorCode"] == "INVALID_INPUT"

    def test_pdf2md_routes_to_convert(self):
        # inputPath vazio → mesma validação de convert()
        result = dispatch("pdf2md", {"inputPath": "", "outputPath": ""})
        assert result["success"] is False
        assert result["errorCode"] == "INVALID_INPUT"


class TestMdToPdf:
    def test_missing_output_path(self):
        result = convert_md_to_pdf(None, None, "# Olá")
        assert result["success"] is False
        assert result["errorCode"] in ("OUTPUT_ERROR", "INVALID_INPUT")

    def test_no_markdown_source(self, tmp_path):
        result = convert_md_to_pdf(None, str(tmp_path / "out.pdf"), None)
        assert result["success"] is False
        assert result["errorCode"] == "INVALID_INPUT"

    def test_generates_pdf_from_text(self, tmp_path):
        out = tmp_path / "out.pdf"
        result = convert_md_to_pdf(None, str(out), "# Título\n\nTexto **negrito**.")
        assert result["success"] is True, result
        assert out.exists()
        assert out.read_bytes()[:5] == b"%PDF-"

    def test_generates_pdf_from_file(self, tmp_path):
        src = tmp_path / "doc.md"
        src.write_text("# Do arquivo", encoding="utf-8")
        out = tmp_path / "out.pdf"
        result = convert_md_to_pdf(str(src), str(out), None)
        assert result["success"] is True, result
        assert out.exists()


class TestPdfMerge:
    def test_needs_two(self, tmp_path):
        pdf = tmp_path / "a.pdf"
        _make_pdf(pdf)
        result = pdf_merge([str(pdf)], str(tmp_path / "out.pdf"))
        assert result["success"] is False
        assert result["errorCode"] == "INVALID_INPUT"

    def test_merges(self, tmp_path):
        a, b = tmp_path / "a.pdf", tmp_path / "b.pdf"
        _make_pdf(a, 2)
        _make_pdf(b, 3)
        out = tmp_path / "merged.pdf"
        result = pdf_merge([str(a), str(b)], str(out))
        assert result["success"] is True, result
        import fitz
        with fitz.open(str(out)) as d:
            assert d.page_count == 5


class TestPdfSplit:
    def test_splits_every_page(self, tmp_path):
        src = tmp_path / "doc.pdf"
        _make_pdf(src, 3)
        out_dir = tmp_path / "parts"
        result = pdf_split(str(src), str(out_dir), 1)
        assert result["success"] is True, result
        assert len(result["outputs"]) == 3

    def test_splits_in_blocks(self, tmp_path):
        src = tmp_path / "doc.pdf"
        _make_pdf(src, 5)
        out_dir = tmp_path / "parts"
        result = pdf_split(str(src), str(out_dir), 2)
        assert result["success"] is True
        assert len(result["outputs"]) == 3  # 2+2+1


class TestPdfCompress:
    def test_compress_produces_output(self, tmp_path):
        src = tmp_path / "doc.pdf"
        _make_pdf(src, 2)
        out_dir = tmp_path / "out"
        result = pdf_compress([str(src)], str(out_dir))
        assert result["success"] is True, result
        assert len(result["outputs"]) == 1
        assert Path(result["outputs"][0]).exists()


class TestJsonOutput:
    def test_make_error_structure(self):
        err = make_error("FILE_NOT_FOUND", "Arquivo não encontrado.")
        assert err == {
            "success": False,
            "errorCode": "FILE_NOT_FOUND",
            "message": "Arquivo não encontrado.",
        }

    def test_make_success_structure(self):
        ok = make_success("/path/doc.md", "# Título", 1500)
        assert ok == {
            "success": True,
            "outputPath": "/path/doc.md",
            "markdown": "# Título",
            "durationMs": 1500,
        }

    def test_result_is_json_serializable(self, tmp_path):
        pdf = tmp_path / "doc.pdf"
        pdf.write_bytes(b"%PDF-1.4 test")
        result = convert("nao_existe.pdf", None)
        # Must serialize without error
        serialized = json.dumps(result, ensure_ascii=False)
        parsed = json.loads(serialized)
        assert parsed["success"] is False

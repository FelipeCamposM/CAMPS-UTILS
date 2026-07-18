#!/usr/bin/env python3
"""PDF to Markdown converter sidecar for Tauri."""

import sys
import json
import time
import argparse
import os
from pathlib import Path

# Redirect all non-JSON output to stderr so stdout stays clean
def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def make_error(code: str, message: str) -> dict:
    return {"success": False, "errorCode": code, "message": message}


def make_success(output_path: str, markdown: str, duration_ms: int) -> dict:
    return {
        "success": True,
        "outputPath": output_path,
        "markdown": markdown,
        "durationMs": duration_ms,
    }


def validate_input(input_path: str, output_path: str | None) -> dict | None:
    if not input_path:
        return make_error("INVALID_INPUT", "Caminho do arquivo PDF não informado.")

    path = Path(input_path)

    if not path.exists():
        return make_error("FILE_NOT_FOUND", "Arquivo PDF não encontrado.")

    if path.suffix.lower() != ".pdf":
        return make_error("INVALID_EXTENSION", "O arquivo selecionado não é um PDF válido.")

    if output_path:
        out = Path(output_path)
        try:
            out.parent.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            log(f"OUTPUT_ERROR: {e}")
            return make_error("OUTPUT_ERROR", "Não foi possível criar o diretório de saída.")

    return None


def detect_first_run() -> bool:
    """Check if Docling models are already cached."""
    cache_dir = Path.home() / ".cache" / "huggingface" / "hub"
    # Look for any docling-related model cache
    if cache_dir.exists():
        for item in cache_dir.iterdir():
            if "docling" in item.name.lower() or "ds4sd" in item.name.lower():
                return False
    return True


def convert(input_path: str, output_path: str | None) -> dict:
    start = time.time()

    error = validate_input(input_path, output_path)
    if error:
        return error

    if detect_first_run():
        log("FIRST_RUN: Modelos do Docling não encontrados. O primeiro uso pode levar alguns minutos para baixar os modelos necessários.")

    try:
        from docling.document_converter import DocumentConverter
        from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions
        from docling.datamodel.base_models import InputFormat
        from docling.document_converter import PdfFormatOption
    except ImportError as e:
        log(f"MODEL_ERROR: {e}")
        return make_error("MODEL_ERROR", "Não foi possível carregar o Docling. Verifique a instalação.")

    try:
        log(f"STEP: Preparando documento: {Path(input_path).name}")
        ocr_options = RapidOcrOptions(backend="onnxruntime")
        pipeline_options = PdfPipelineOptions(ocr_options=ocr_options)
        converter = DocumentConverter(
            format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)}
        )

        log("STEP: Analisando páginas")
        result = converter.convert(input_path)

        log("STEP: Convertendo conteúdo")
        markdown = result.document.export_to_markdown()

        log("STEP: Gerando Markdown")
        duration_ms = int((time.time() - start) * 1000)

        if output_path:
            out = Path(output_path)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(markdown, encoding="utf-8")
            log(f"SAVED: {output_path}")

        return make_success(output_path or "", markdown, duration_ms)

    except Exception as e:
        log(f"CONVERSION_FAILED: {type(e).__name__}: {e}")
        return make_error("CONVERSION_FAILED", "Não foi possível converter o documento.")


PDF_CSS = """
body { font-family: Helvetica, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.5; }
h1, h2, h3, h4 { color: #111; margin: 0.6em 0 0.3em; }
h1 { font-size: 20pt; } h2 { font-size: 16pt; } h3 { font-size: 13pt; }
code { font-family: Courier, monospace; background: #f2f2f2; padding: 1px 3px; }
pre { background: #f2f2f2; padding: 8px; }
table { border-collapse: collapse; }
th, td { border: 1px solid #ccc; padding: 4px 8px; }
blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 10px; color: #555; }
"""


def convert_md_to_pdf(input_path: str | None, output_path: str | None, markdown_text: str | None) -> dict:
    start = time.time()

    if markdown_text:
        md_source = markdown_text
    elif input_path:
        p = Path(input_path)
        if not p.exists():
            return make_error("FILE_NOT_FOUND", "Arquivo Markdown não encontrado.")
        md_source = p.read_text(encoding="utf-8")
    else:
        return make_error("INVALID_INPUT", "Nenhum Markdown informado.")

    if not output_path:
        return make_error("OUTPUT_ERROR", "Caminho de saída não informado.")

    try:
        import markdown as md_lib
        from xhtml2pdf import pisa
    except ImportError as e:
        log(f"MODEL_ERROR: {e}")
        return make_error("MODEL_ERROR", "Bibliotecas de geração de PDF não encontradas.")

    try:
        log("STEP: Renderizando Markdown")
        html_body = md_lib.markdown(
            md_source, extensions=["extra", "tables", "fenced_code", "sane_lists"]
        )
        html = (
            "<html><head><meta charset='utf-8'>"
            f"<style>{PDF_CSS}</style></head><body>{html_body}</body></html>"
        )

        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)

        log("STEP: Gerando PDF")
        with open(out, "wb") as f:
            pisa_status = pisa.CreatePDF(html, dest=f, encoding="utf-8")

        if pisa_status.err:
            return make_error("RENDER_FAILED", "Falha ao gerar o PDF a partir do Markdown.")

        duration_ms = int((time.time() - start) * 1000)
        log(f"SAVED: {output_path}")
        return {"success": True, "outputPath": str(out), "durationMs": duration_ms}

    except Exception as e:
        log(f"RENDER_FAILED: {type(e).__name__}: {e}")
        return make_error("RENDER_FAILED", "Não foi possível gerar o PDF.")


def pdf_merge(inputs: list[str], output_path: str | None) -> dict:
    start = time.time()
    if not inputs or len(inputs) < 2:
        return make_error("INVALID_INPUT", "Selecione ao menos dois PDFs para juntar.")
    if not output_path:
        return make_error("OUTPUT_ERROR", "Caminho de saída não informado.")

    try:
        import fitz
    except ImportError as e:
        log(f"MODEL_ERROR: {e}")
        return make_error("MODEL_ERROR", "Biblioteca de PDF (PyMuPDF) não encontrada.")

    try:
        merged = fitz.open()
        for path in inputs:
            p = Path(path)
            if not p.exists():
                merged.close()
                return make_error("FILE_NOT_FOUND", f"Arquivo não encontrado: {p.name}")
            with fitz.open(path) as src:
                merged.insert_pdf(src)
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        merged.save(str(out))
        merged.close()
        duration_ms = int((time.time() - start) * 1000)
        return {"success": True, "outputPath": str(out), "durationMs": duration_ms}
    except Exception as e:
        log(f"PDF_MERGE_FAILED: {type(e).__name__}: {e}")
        return make_error("CONVERSION_FAILED", "Não foi possível juntar os PDFs.")


def pdf_split(input_path: str | None, output_dir: str | None, every: int) -> dict:
    """Divide um PDF em blocos de `every` páginas (every>=1)."""
    start = time.time()
    if not input_path:
        return make_error("INVALID_INPUT", "Nenhum PDF informado.")
    p = Path(input_path)
    if not p.exists():
        return make_error("FILE_NOT_FOUND", "PDF não encontrado.")
    if not output_dir:
        return make_error("OUTPUT_ERROR", "Pasta de saída não informada.")
    every = max(1, int(every))

    try:
        import fitz
    except ImportError as e:
        log(f"MODEL_ERROR: {e}")
        return make_error("MODEL_ERROR", "Biblioteca de PDF (PyMuPDF) não encontrada.")

    try:
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        outputs = []
        with fitz.open(input_path) as src:
            total = src.page_count
            for start_page in range(0, total, every):
                end_page = min(start_page + every - 1, total - 1)
                part = fitz.open()
                part.insert_pdf(src, from_page=start_page, to_page=end_page)
                out = out_dir / f"{p.stem}_{start_page + 1}-{end_page + 1}.pdf"
                part.save(str(out))
                part.close()
                outputs.append(str(out))
        duration_ms = int((time.time() - start) * 1000)
        return {"success": True, "outputs": outputs, "durationMs": duration_ms}
    except Exception as e:
        log(f"PDF_SPLIT_FAILED: {type(e).__name__}: {e}")
        return make_error("CONVERSION_FAILED", "Não foi possível dividir o PDF.")


def pdf_compress(inputs: list[str], output_dir: str | None) -> dict:
    start = time.time()
    if not inputs:
        return make_error("INVALID_INPUT", "Nenhum PDF informado.")
    if not output_dir:
        return make_error("OUTPUT_ERROR", "Pasta de saída não informada.")

    try:
        import fitz
    except ImportError as e:
        log(f"MODEL_ERROR: {e}")
        return make_error("MODEL_ERROR", "Biblioteca de PDF (PyMuPDF) não encontrada.")

    try:
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        outputs = []
        for path in inputs:
            p = Path(path)
            if not p.exists():
                return make_error("FILE_NOT_FOUND", f"Arquivo não encontrado: {p.name}")
            out = out_dir / f"{p.stem}_comprimido.pdf"
            with fitz.open(path) as src:
                src.save(str(out), garbage=4, deflate=True, clean=True)
            outputs.append(str(out))
        duration_ms = int((time.time() - start) * 1000)
        return {"success": True, "outputs": outputs, "durationMs": duration_ms}
    except Exception as e:
        log(f"PDF_COMPRESS_FAILED: {type(e).__name__}: {e}")
        return make_error("CONVERSION_FAILED", "Não foi possível comprimir o PDF.")


class _StderrLogger:
    """Loga toda saída do yt-dlp no stderr, mantendo o stdout limpo (só o JSON)."""
    def debug(self, msg): log(msg)
    def info(self, msg): log(msg)
    def warning(self, msg): log(msg)
    def error(self, msg): log(msg)


def _best_thumb(obj: dict) -> str:
    thumbs = obj.get("thumbnails") or []
    if thumbs:
        return thumbs[-1].get("url", "") or ""
    return obj.get("thumbnail") or ""


def youtube_info(url: str) -> dict:
    """Busca dados p/ preview. Playlist: nome + capa + total (rápido, sem ver faixa por faixa).
    Vídeo: título, thumbnail, duração, canal, qualidades."""
    if not url:
        return make_error("INVALID_URL", "URL não informada.")
    try:
        import yt_dlp
    except ImportError as e:
        log(f"MODEL_ERROR: {e}")
        return make_error("MODEL_ERROR", "yt-dlp não encontrado.")

    try:
        # 1) Extração "flat" — barata: lista sem processar cada vídeo.
        flat_opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": True,
            "logger": _StderrLogger(),
        }
        with yt_dlp.YoutubeDL(flat_opts) as ydl:
            info = ydl.extract_info(url, download=False)
        if not info:
            return make_error("UNAVAILABLE", "Conteúdo indisponível.")

        # Playlist: só nome, capa e contagem.
        if info.get("_type") == "playlist" or "entries" in info:
            entries = [e for e in (info.get("entries") or []) if e]
            count = info.get("playlist_count") or len(entries)
            thumb = _best_thumb(info)
            if not thumb and entries:
                thumb = _best_thumb(entries[0])
            return {
                "success": True,
                "isPlaylist": True,
                "title": info.get("title") or "Playlist",
                "thumbnail": thumb,
                "uploader": info.get("uploader") or info.get("channel") or "",
                "trackCount": count,
                "heights": [],
            }
    except Exception as e:
        log(f"YOUTUBE_INFO_FAILED: {type(e).__name__}: {e}")
        return make_error("UNAVAILABLE", "Não foi possível obter os dados.")

    # 2) Vídeo único: extração completa (p/ qualidades).
    try:
        full_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "noplaylist": True,
            "logger": _StderrLogger(),
        }
        with yt_dlp.YoutubeDL(full_opts) as ydl:
            info = ydl.extract_info(url, download=False)
        if not info:
            return make_error("UNAVAILABLE", "Vídeo indisponível.")

        heights = sorted(
            {
                f["height"]
                for f in (info.get("formats") or [])
                if f.get("height") and f.get("vcodec") not in (None, "none")
            },
            reverse=True,
        )
        return {
            "success": True,
            "isPlaylist": False,
            "title": info.get("title") or "",
            "thumbnail": info.get("thumbnail") or "",
            "duration": info.get("duration") or 0,
            "uploader": info.get("uploader") or "",
            "heights": heights,
        }
    except Exception as e:
        log(f"YOUTUBE_INFO_FAILED: {type(e).__name__}: {e}")
        return make_error("UNAVAILABLE", "Não foi possível obter os dados do vídeo.")


def _emit_event(obj: dict) -> None:
    """Envia um evento estruturado pelo stderr (o Rust reencaminha p/ o frontend)."""
    log("EVENT: " + json.dumps(obj, ensure_ascii=False))


def _yt_audio_url(video_url: str, output_dir: str, ffmpeg_location: str | None, audio_kbps: int | None) -> str:
    """Baixa um único vídeo do YouTube como MP3. Retorna o caminho. Lança em erro."""
    import yt_dlp

    opts: dict = {
        "outtmpl": str(Path(output_dir) / "%(title)s.%(ext)s"),
        "format": "bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "logger": _StderrLogger(),
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": str(audio_kbps or 192),
        }],
    }
    if ffmpeg_location:
        opts["ffmpeg_location"] = ffmpeg_location

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(video_url, download=True)
        entry = info["entries"][0] if isinstance(info, dict) and "entries" in info else info
        return str(Path(ydl.prepare_filename(entry)).with_suffix(".mp3"))


def youtube_playlist(url: str, output_dir: str, ffmpeg_location: str | None, audio_kbps: int | None) -> dict:
    """Baixa uma playlist do YouTube em MP3, uma faixa por vez.

    Emite eventos por faixa (fila/baixando/pronta/pulada) e progresso do total.
    Erros em faixas individuais são pulados sem interromper as demais.
    """
    import yt_dlp

    start = time.time()

    # 1) Lista a playlist sem baixar (flat).
    try:
        flat_opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": True,
            "logger": _StderrLogger(),
        }
        with yt_dlp.YoutubeDL(flat_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as e:
        log(f"PLAYLIST_LIST_FAILED: {type(e).__name__}: {e}")
        return make_error("NETWORK_ERROR", "Não foi possível ler a playlist. Verifique a URL.")

    entries = [e for e in (info.get("entries") or []) if e] if isinstance(info, dict) else []
    if not entries:
        return make_error("UNAVAILABLE", "Playlist vazia ou indisponível.")

    tracks = [
        {"i": i, "title": e.get("title") or e.get("id") or f"Faixa {i + 1}", "id": e.get("id") or e.get("url")}
        for i, e in enumerate(entries)
    ]
    total = len(tracks)
    _emit_event({"type": "tracks", "tracks": [{"i": t["i"], "title": t["title"]} for t in tracks]})

    outputs: list[str] = []
    skipped: list[dict] = []

    for t in tracks:
        _emit_event({"type": "track", "i": t["i"], "status": "downloading"})
        try:
            video_url = f"https://www.youtube.com/watch?v={t['id']}"
            path = _yt_audio_url(video_url, output_dir, ffmpeg_location, audio_kbps)
            outputs.append(path)
            _emit_event({"type": "track", "i": t["i"], "status": "done"})
        except Exception as e:  # noqa: BLE001 — pula faixa com erro, segue as outras
            log(f"PLAYLIST_TRACK_SKIP: {t['title']}: {e}")
            skipped.append({"i": t["i"], "title": t["title"]})
            _emit_event({"type": "track", "i": t["i"], "status": "skipped"})
        log(f"PROGRESS: {int((t['i'] + 1) * 100 / total)}")

    if not outputs:
        return make_error("NETWORK_ERROR", "Nenhuma faixa da playlist pôde ser baixada.")

    duration_ms = int((time.time() - start) * 1000)
    return {"success": True, "outputs": outputs, "skipped": skipped, "durationMs": duration_ms}


def youtube_download(
    url: str,
    mode: str,
    output_dir: str | None,
    ffmpeg_location: str | None,
    audio_kbps: int | None,
    max_height: int | None = None,
) -> dict:
    if mode == "playlist_audio":
        if not url:
            return make_error("INVALID_URL", "URL não informada.")
        if not output_dir:
            return make_error("OUTPUT_ERROR", "Pasta de saída não informada.")
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        return youtube_playlist(url, output_dir, ffmpeg_location, audio_kbps)

    start = time.time()
    if not url:
        return make_error("INVALID_URL", "URL não informada.")
    if not output_dir:
        return make_error("OUTPUT_ERROR", "Pasta de saída não informada.")

    try:
        import yt_dlp
    except ImportError as e:
        log(f"MODEL_ERROR: {e}")
        return make_error("MODEL_ERROR", "yt-dlp não encontrado.")

    Path(output_dir).mkdir(parents=True, exist_ok=True)

    def hook(d: dict) -> None:
        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            done = d.get("downloaded_bytes") or 0
            pct = int(done * 100 / total) if total else 0
            log(f"PROGRESS: {pct}")
        elif status == "finished":
            log("PROGRESS: 100")
            log("STEP: Pós-processando")

    is_playlist = mode == "playlist_audio"
    is_audio = mode in ("audio", "playlist_audio")

    opts: dict = {
        "outtmpl": str(Path(output_dir) / "%(title)s.%(ext)s"),
        "noplaylist": not is_playlist,
        "progress_hooks": [hook],
        "quiet": True,
        "no_warnings": True,
        "ignoreerrors": is_playlist,
        "logger": _StderrLogger(),
    }
    if ffmpeg_location:
        opts["ffmpeg_location"] = ffmpeg_location

    if is_audio:
        opts["format"] = "bestaudio/best"
        opts["postprocessors"] = [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": str(audio_kbps or 192),
        }]
    else:
        if max_height:
            opts["format"] = (
                f"bestvideo[height<={max_height}][ext=mp4]+bestaudio[ext=m4a]/"
                f"best[height<={max_height}][ext=mp4]/best[height<={max_height}]/best"
            )
        else:
            opts["format"] = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
        opts["merge_output_format"] = "mp4"

    try:
        outputs: list[str] = []
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            entries = info.get("entries") if isinstance(info, dict) and "entries" in info else [info]
            for entry in entries or []:
                if not entry:
                    continue
                filename = ydl.prepare_filename(entry)
                if is_audio:
                    filename = str(Path(filename).with_suffix(".mp3"))
                outputs.append(filename)

        duration_ms = int((time.time() - start) * 1000)
        return {"success": True, "outputs": outputs, "durationMs": duration_ms}

    except Exception as e:
        msg = str(e)
        log(f"YOUTUBE_FAILED: {type(e).__name__}: {msg}")
        if "ffmpeg" in msg.lower() or "ffprobe" in msg.lower():
            return make_error("FFMPEG_MISSING", "ffmpeg necessário não foi encontrado.")
        return make_error("NETWORK_ERROR", "Não foi possível baixar. Verifique a URL e a conexão.")


# Credenciais públicas compartilhadas do spotdl (open-source) — só leitura de metadados.
_SPOTIFY_CLIENT_ID = "5f573c9620494bae87890c0f08a60293"
_SPOTIFY_CLIENT_SECRET = "212476d9b0f3472eaa762d90b19b0ba8"


def _spotify_tracks(sp, kind: str, sid: str) -> list[dict]:
    """Retorna a lista de faixas (dicts do Spotify) de uma track/álbum/playlist."""
    tracks: list[dict] = []
    if kind == "track":
        tracks = [sp.track(sid)]
    elif kind == "album":
        res = sp.album_tracks(sid, limit=50)
        tracks = list(res["items"])
        while res.get("next"):
            res = sp.next(res)
            tracks += res["items"]
    else:  # playlist
        res = sp.playlist_items(sid, limit=100)
        tracks = [it["track"] for it in res["items"] if it.get("track")]
        while res.get("next"):
            res = sp.next(res)
            tracks += [it["track"] for it in res["items"] if it.get("track")]
    return [t for t in tracks if t]


def _yt_audio(query: str, output_dir: str, ffmpeg_location: str | None, audio_kbps: int | None) -> str | None:
    """Baixa a 1ª correspondência do YouTube p/ a query como MP3. Retorna o caminho."""
    import yt_dlp

    opts: dict = {
        "outtmpl": str(Path(output_dir) / "%(title)s.%(ext)s"),
        "format": "bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "logger": _StderrLogger(),
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": str(audio_kbps or 192),
        }],
    }
    if ffmpeg_location:
        opts["ffmpeg_location"] = ffmpeg_location

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(f"ytsearch1:{query}", download=True)
        entries = info.get("entries") if isinstance(info, dict) and "entries" in info else [info]
        entry = next((e for e in (entries or []) if e), None)
        if not entry:
            return None
        return str(Path(ydl.prepare_filename(entry)).with_suffix(".mp3"))


def spotify_download(
    url: str,
    output_dir: str | None,
    ffmpeg_location: str | None,
    audio_kbps: int | None,
    client_id: str | None = None,
    client_secret: str | None = None,
) -> dict:
    """Faixa/álbum/playlist do Spotify: metadados via spotipy → áudio equivalente do YouTube."""
    import re

    start = time.time()
    if not url:
        return make_error("INVALID_URL", "URL do Spotify não informada.")
    if not output_dir:
        return make_error("OUTPUT_ERROR", "Pasta de saída não informada.")
    if not ffmpeg_location:
        return make_error("FFMPEG_MISSING", "ffmpeg necessário não foi encontrado.")

    match = re.search(r"(track|album|playlist)[/:]([A-Za-z0-9]+)", url)
    if not match:
        return make_error("INVALID_URL", "URL do Spotify inválida (use track, album ou playlist).")
    kind, sid = match.group(1), match.group(2)

    try:
        import spotipy
        from spotipy.oauth2 import SpotifyClientCredentials
        from spotipy.cache_handler import CacheFileHandler
    except ImportError as e:
        log(f"MODEL_ERROR: {e}")
        return make_error("MODEL_ERROR", "spotipy não encontrado.")

    Path(output_dir).mkdir(parents=True, exist_ok=True)

    user_creds = bool((client_id or "").strip() and (client_secret or "").strip())
    cid = (client_id or "").strip() or _SPOTIFY_CLIENT_ID
    csecret = (client_secret or "").strip() or _SPOTIFY_CLIENT_SECRET
    log(f"SPOTIFY_CREDS: usando {'PRÓPRIAS' if user_creds else 'PÚBLICAS (compartilhadas)'} — id {cid[:6]}…")

    # Cacheia o token por Client ID (evita pedir token novo a cada chamada = economiza cota).
    cache_dir = Path.home() / ".cache" / "camps-utils"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path = str(cache_dir / f"spotify-token-{cid[:8]}.json")

    try:
        auth = SpotifyClientCredentials(
            client_id=cid,
            client_secret=csecret,
            cache_handler=CacheFileHandler(cache_path=cache_path),
        )
        # retries=0: não fica preso tentando de novo em 429 (Retry-After pode ser 24h).
        sp = spotipy.Spotify(auth_manager=auth, requests_timeout=20, retries=0)
        tracks = _spotify_tracks(sp, kind, sid)
    except Exception as e:
        msg = str(e)
        log(f"SPOTIFY_META_FAILED: {type(e).__name__}: {msg}")
        if "rate/request limit" in msg or "429" in msg:
            return make_error(
                "RATE_LIMIT",
                "Limite de requisições do Spotify atingido. Configure suas próprias credenciais "
                "do Spotify (Client ID e Secret) para evitar o limite compartilhado.",
            )
        return make_error(
            "UNAVAILABLE",
            "Não foi possível ler os dados do Spotify. Playlists editoriais do Spotify não são "
            "acessíveis pela API — use uma playlist sua, álbum ou faixa.",
        )

    if not tracks:
        return make_error("UNAVAILABLE", "Nenhuma faixa encontrada nessa URL.")

    queries = [
        f"{t['artists'][0]['name']} - {t['name']}"
        for t in tracks
        if t.get("name") and t.get("artists")
    ]
    total = len(queries)
    outputs: list[str] = []
    for i, query in enumerate(queries):
        try:
            path = _yt_audio(query, output_dir, ffmpeg_location, audio_kbps)
            if path:
                outputs.append(path)
        except Exception as e:  # noqa: BLE001
            log(f"SPOTIFY_TRACK_FAILED: {query}: {e}")
        log(f"PROGRESS: {int((i + 1) * 100 / total)}")

    if not outputs:
        return make_error("NETWORK_ERROR", "Nenhuma faixa pôde ser baixada.")

    duration_ms = int((time.time() - start) * 1000)
    return {"success": True, "outputs": outputs, "durationMs": duration_ms}


def dispatch(tool: str, data: dict) -> dict:
    if tool == "pdf2md":
        input_path = data.get("inputPath", "").strip()
        output_path = data.get("outputPath", "").strip() or None
        return convert(input_path, output_path)

    if tool == "md2pdf":
        return convert_md_to_pdf(
            data.get("inputPath", "").strip() or None,
            data.get("outputPath", "").strip() or None,
            data.get("markdown", "").strip() or None,
        )

    if tool == "pdf_merge":
        return pdf_merge(data.get("inputs", []), data.get("outputPath", "").strip() or None)

    if tool == "pdf_split":
        return pdf_split(
            data.get("inputPath", "").strip() or None,
            data.get("outputDir", "").strip() or None,
            data.get("every", 1),
        )

    if tool == "pdf_compress":
        return pdf_compress(data.get("inputs", []), data.get("outputDir", "").strip() or None)

    if tool == "youtube_info":
        return youtube_info(data.get("url", "").strip())

    if tool == "spotify":
        return spotify_download(
            data.get("url", "").strip(),
            data.get("outputDir", "").strip() or None,
            data.get("ffmpegLocation") or None,
            data.get("audioKbps"),
            data.get("clientId"),
            data.get("clientSecret"),
        )

    if tool == "youtube":
        return youtube_download(
            data.get("url", "").strip(),
            data.get("mode", "audio").strip() or "audio",
            data.get("outputDir", "").strip() or None,
            data.get("ffmpegLocation") or None,
            data.get("audioKbps"),
            data.get("maxHeight"),
        )

    return make_error("INVALID_INPUT", f"Ferramenta desconhecida: {tool}")


def main() -> None:
    # Force UTF-8 output
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="CAMPS-UTILS conversion sidecar")
    parser.add_argument("--tool", default="pdf2md", help="Tool to run (pdf2md, md2pdf, …)")
    parser.add_argument("--input", required=False, help="JSON string with the tool's input")
    args = parser.parse_args()

    if args.input:
        raw = args.input
    else:
        raw = sys.stdin.read().strip()

    if not raw:
        result = make_error("INVALID_INPUT", "Nenhum dado de entrada recebido.")
        print(json.dumps(result, ensure_ascii=False), flush=True)
        sys.exit(1)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        log(f"INVALID_INPUT: JSON parse error: {e}")
        result = make_error("INVALID_INPUT", "Dados de entrada inválidos.")
        print(json.dumps(result, ensure_ascii=False), flush=True)
        sys.exit(1)

    result = dispatch(args.tool, data)
    print(json.dumps(result, ensure_ascii=False), flush=True)

    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()

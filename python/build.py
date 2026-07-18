#!/usr/bin/env python3
"""Build dos sidecars PyInstaller.

Dois alvos:
  light   -> converter-<triple>.exe (sem Docling) — vai no instalador (externalBin).
  docling -> converter-docling-<triple>.exe (só Docling) — zipado p/ o GitHub Release,
             baixado sob demanda no 1º uso do PDF→MD.

Uso:
  python build.py           # ambos
  python build.py light
  python build.py docling
"""

import argparse
import hashlib
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent.parent
PYTHON_DIR = ROOT / "python"
DIST_DIR = PYTHON_DIR / "dist"
BUILD_DIR = PYTHON_DIR / "build"
BINARIES_DIR = ROOT / "src-tauri" / "binaries"
CONVERTER = PYTHON_DIR / "converter.py"

# Módulos pesados do Docling — excluídos do bundle light.
DOCLING_MODULES = [
    "docling", "docling_core", "docling_parse", "torch", "torchvision",
    "rapidocr", "onnxruntime", "transformers", "scipy", "cv2",
]

# Bibliotecas leves usadas pelas demais ferramentas (md2pdf, pdf-utils, youtube, spotify).
LIGHT_COLLECTS = ["markdown", "xhtml2pdf", "reportlab", "svglib", "fitz", "pikepdf", "yt_dlp", "spotipy"]


def get_target_triple() -> str:
    try:
        result = subprocess.run(["rustc", "-vV"], capture_output=True, text=True, check=False)
        for line in result.stdout.splitlines():
            if line.startswith("host:"):
                return line.split(":", 1)[1].strip()
    except FileNotFoundError:
        pass
    return "x86_64-pc-windows-msvc"


def _run_pyinstaller(name: str, extra: list[str]) -> Path:
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile", "--noconfirm", "--clean",
        f"--name={name}",
        "--distpath", str(DIST_DIR),
        "--workpath", str(BUILD_DIR),
        *extra,
        str(CONVERTER),
    ]
    print("\n" + " ".join(cmd))
    if subprocess.run(cmd, cwd=str(PYTHON_DIR)).returncode != 0:
        print("ERRO: PyInstaller falhou.", file=sys.stderr)
        sys.exit(1)
    return DIST_DIR / f"{name}.exe"


def build_light(triple: str) -> None:
    name = f"converter-{triple}"
    print(f"\n=== Bundle LIGHT: {name} ===")
    extra: list[str] = []
    for lib in LIGHT_COLLECTS:
        extra += ["--collect-all", lib]
    for mod in DOCLING_MODULES:
        extra += ["--exclude-module", mod]

    exe = _run_pyinstaller(name, extra)
    BINARIES_DIR.mkdir(parents=True, exist_ok=True)
    dest = BINARIES_DIR / f"{name}.exe"
    if dest.exists():
        dest.unlink()
    shutil.copy2(exe, dest)
    print(f"Light copiado para: {dest}  ({dest.stat().st_size // (1024*1024)} MB)")


def build_docling(triple: str) -> None:
    name = f"converter-docling-{triple}"
    print(f"\n=== Bundle DOCLING: {name} ===")
    extra = [
        "--collect-data", "docling_parse",
        "--collect-all", "docling",
        "--collect-all", "rapidocr",
        "--collect-all", "onnxruntime",
    ]
    exe = _run_pyinstaller(name, extra)

    # Zip + SHA256 p/ o Release.
    zip_path = DIST_DIR / "camps-docling.zip"
    print(f"\nZipando {exe.name} -> {zip_path.name} …")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(exe, arcname=exe.name)

    sha = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    (DIST_DIR / "camps-docling.sha256").write_text(sha, encoding="utf-8")

    print(f"\nZip:    {zip_path}  ({zip_path.stat().st_size // (1024*1024)} MB)")
    print(f"SHA256: {sha}")
    print("\n>> Suba 'camps-docling.zip' num Release do GitHub e cole o SHA256 no app "
          "(src-tauri/src/commands.rs -> DOCLING_SHA256).")


def clean() -> None:
    for d in (DIST_DIR, BUILD_DIR):
        if d.exists():
            shutil.rmtree(d, ignore_errors=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build dos sidecars CAMPS-UTILS")
    parser.add_argument("target", nargs="?", default="both", choices=["light", "docling", "both"])
    args = parser.parse_args()

    triple = get_target_triple()
    print(f"Target triple: {triple}")
    clean()

    if args.target in ("light", "both"):
        build_light(triple)
    if args.target in ("docling", "both"):
        build_docling(triple)

    print("\nBuild concluído.")

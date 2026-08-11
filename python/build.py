#!/usr/bin/env python3
"""Build dos sidecars PyInstaller e dos módulos baixados sob demanda.

Alvos:
  light   -> converter-<triple>.exe (sem Docling) — vai no instalador (externalBin).
  docling -> converter-docling-<triple>.exe (só Docling) — zipado p/ o GitHub Release,
             baixado sob demanda no 1º uso do PDF→MD.
  whisper -> converter-whisper-<triple>.exe (faster-whisper) — zipado p/ o Release,
             baixado sob demanda no 1º uso da legenda automática. ~90 MB.
  depth   -> converter-depth-<triple>.exe (Depth Anything V2 via ONNX Runtime) —
             zipado p/ o Release, baixado sob demanda no 1º mapa de profundidade.
  ffmpeg  -> camps-ffmpeg.zip (ffmpeg.exe + ffprobe.exe) — não compila nada, só
             empacota os binários que já estão em src-tauri/binaries/. Saíram do
             instalador porque somam 168 MB crus.

Uso:
  python build.py           # light + docling
  python build.py light
  python build.py docling
  python build.py whisper
  python build.py depth
  python build.py ffmpeg
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

# Bibliotecas leves usadas pelas demais ferramentas (md2pdf, pdf-utils, youtube).
LIGHT_COLLECTS = [
    "markdown", "pymdownx", "pygments", "xhtml2pdf", "reportlab", "svglib",
    "fitz", "pikepdf", "yt_dlp", "mammoth",
]


# O PyInstaller segue import dentro de função. `converter.py::depth_map` faz
# `import depth`, e depth.py importa numpy + onnxruntime no topo — sem excluir o
# próprio módulo `depth`, o instalador engordaria ~70 MB com a inferência que
# nunca roda ali (o Rust manda `depth_map` para o sidecar `depth`).
LIGHT_EXCLUDES = ["depth"]


# Arrastados transitivamente pelo yt-dlp e inúteis na transcrição.
WHISPER_EXCLUDES = [
    "websockets", "requests", "urllib3", "curl_cffi", "Cryptodome",
    "secretstorage", "brotli", "mutagen", "PIL", "reportlab", "html5lib",
]

# A pilha da transcrição, vista de fora. `WHISPER_EXCLUDES` não serve aqui: ela
# lista o que o bundle do whisper NÃO quer, e por definição não exclui o próprio
# whisper. Sem esta lista o bundle do depth saiu com 124 MB — `av.libs` (63 MB),
# `ctranslate2` (59 MB), pandas e lxml, tudo alcançado pelo `import
# faster_whisper` que mora DENTRO de `transcribe()`.
DEPTH_EXCLUDES = [
    "faster_whisper", "ctranslate2", "av", "tokenizers",
    "pandas", "huggingface_hub", "hf_xet", "lxml",
    "pydantic", "pydantic_core", "safetensors",
]


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
    for mod in DOCLING_MODULES + LIGHT_EXCLUDES:
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


def build_whisper(triple: str) -> None:
    """Sidecar de transcrição (faster-whisper). ~90 MB medidos.

    NÃO excluir `av` nem `onnxruntime`:
    - `av` é importado no topo de faster_whisper/audio.py; sem ele o exe nem
      abre. De quebra, ele traz o próprio ffmpeg, o que deixa este módulo
      autossuficiente (não depende do módulo ffmpeg estar instalado).
    - `onnxruntime` É o VAD Silero embutido. Cortar economiza 14 MB e leva o
      `vad_filter=True` junto.
    Ver o Portão 0 em roadmaps/ia-local/roadmap.md.
    """
    name = f"converter-whisper-{triple}"
    print(f"\n=== Bundle WHISPER: {name} ===")

    coletar = ["faster_whisper", "ctranslate2", "tokenizers", "onnxruntime", "av"]

    # O PyInstaller analisa o converter.py INTEIRO, inclusive imports dentro de
    # função — sem estas exclusões o bundle vinha com yt_dlp, websockets,
    # requests, reportlab e cia., e ia de ~99 para 144 MB. Este exe só atende
    # `transcribe` (o Rust roteia assim), então nada disso é alcançável.
    #
    # ⚠️ A subtração não é firula: `onnxruntime` está em DOCLING_MODULES, então
    # a lista crua emitia `--collect-all onnxruntime` E `--exclude-module
    # onnxruntime`. A exclusão vence, e o exe morria em tempo de execução com
    # "Applying the VAD filter requires the onnxruntime package" — só no
    # empacotado, porque em dev a .venv tem tudo.
    excluir = [m for m in DOCLING_MODULES + LIGHT_COLLECTS + WHISPER_EXCLUDES
               if m not in coletar]

    extra: list[str] = []
    for lib in coletar:
        extra += ["--collect-all", lib]
    for mod in excluir:
        extra += ["--exclude-module", mod]

    exe = _run_pyinstaller(name, extra)

    zip_path = DIST_DIR / "camps-whisper.zip"
    print(f"\nZipando {exe.name} -> {zip_path.name} …")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(exe, arcname=exe.name)

    sha = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    (DIST_DIR / "camps-whisper.sha256").write_text(sha, encoding="utf-8")

    print(f"\nZip:    {zip_path}  ({zip_path.stat().st_size // (1024*1024)} MB)")
    print(f"SHA256: {sha}")
    print("\n>> Suba 'camps-whisper.zip' num Release com a tag 'whisper-v1' (marcado como "
          "pre-release) e cole o SHA256 em src-tauri/src/commands.rs -> WHISPER.sha256")


def build_depth(triple: str) -> None:
    """Sidecar de profundidade (Depth Anything V2 via ONNX Runtime).

    ONNX e não torch/transformers: medido na .venv, torch (492 MB) +
    transformers (90 MB) contra onnxruntime + numpy + Pillow (86 MB) — o mesmo
    modelo, os mesmos pesos, um décimo do peso. Ver o cabeçalho de `depth.py`.

    Os PESOS não entram no zip: `depth.py` os busca na HuggingFace no primeiro
    uso (~94 MB) e guarda em `~/.cache/camps-utils/models/`.
    """
    name = f"converter-depth-{triple}"
    print(f"\n=== Bundle DEPTH: {name} ===")

    # `numpy` fora do collect-all de propósito: o hook padrão do PyInstaller já
    # traz o que ele precisa, e `--collect-all` acrescentaria os testes e os
    # headers. `PIL` PRECISA estar aqui — está em WHISPER_EXCLUDES, e sem entrar
    # na subtração abaixo viraria `--exclude-module`.
    coletar = ["onnxruntime", "PIL"]

    # Mesma subtração do whisper, pelo mesmo motivo: `onnxruntime` está em
    # DOCLING_MODULES e a exclusão vence o `--collect-all`. Sem isto o exe
    # compila e só morre em produção, na hora da inferência.
    excluir = [m for m in DOCLING_MODULES + LIGHT_COLLECTS + WHISPER_EXCLUDES + DEPTH_EXCLUDES
               if m not in coletar]

    extra: list[str] = []
    for lib in coletar:
        extra += ["--collect-all", lib]
    for mod in excluir:
        extra += ["--exclude-module", mod]

    exe = _run_pyinstaller(name, extra)

    zip_path = DIST_DIR / "camps-depth.zip"
    print(f"\nZipando {exe.name} -> {zip_path.name} …")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(exe, arcname=exe.name)

    sha = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    (DIST_DIR / "camps-depth.sha256").write_text(sha, encoding="utf-8")

    print(f"\nZip:    {zip_path}  ({zip_path.stat().st_size // (1024*1024)} MB)")
    print(f"SHA256: {sha}")
    print("\n>> Suba 'camps-depth.zip' num Release com a tag 'depth-v1' (marcado como "
          "pre-release) e cole o SHA256 em src-tauri/src/commands.rs -> DEPTH.sha256")


def build_ffmpeg() -> None:
    """Zipa ffmpeg.exe + ffprobe.exe p/ o Release. Não compila nada."""
    print("\n=== Bundle FFMPEG ===")
    fontes = [BINARIES_DIR / "ffmpeg.exe", BINARIES_DIR / "ffprobe.exe"]
    faltando = [f.name for f in fontes if not f.exists()]
    if faltando:
        sys.exit(
            f"Não encontrei {', '.join(faltando)} em {BINARIES_DIR}.\n"
            "Baixe uma build do ffmpeg e coloque os dois .exe lá antes de empacotar."
        )

    DIST_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = DIST_DIR / "camps-ffmpeg.zip"
    print(f"Zipando {' + '.join(f.name for f in fontes)} -> {zip_path.name} …")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in fontes:
            # arcname sem pasta: o Rust procura runtime/ffmpeg.exe direto.
            zf.write(f, arcname=f.name)

    sha = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    (DIST_DIR / "camps-ffmpeg.sha256").write_text(sha, encoding="utf-8")

    print(f"\nZip:    {zip_path}  ({zip_path.stat().st_size // (1024*1024)} MB)")
    print(f"SHA256: {sha}")
    print("\n>> Suba 'camps-ffmpeg.zip' num Release com a tag 'ffmpeg-v1' e cole o SHA256 em "
          "src-tauri/src/commands.rs -> FFMPEG.sha256")


def clean() -> None:
    """Limpa o trabalho do PyInstaller preservando os pacotes de Release.

    `camps-*.zip` e o `.sha256` correspondente são artefatos caros e prontos
    para publicar — o do Docling leva ~40 min para regerar. Apagá-los ao
    construir OUTRO alvo é destruir trabalho alheio ao que se está fazendo.
    """
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR, ignore_errors=True)

    if not DIST_DIR.exists():
        return
    for item in DIST_DIR.iterdir():
        if item.name.startswith("camps-") and item.suffix in (".zip", ".sha256"):
            continue
        if item.is_dir():
            shutil.rmtree(item, ignore_errors=True)
        else:
            item.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build dos sidecars CAMPS-UTILS")
    parser.add_argument("target", nargs="?", default="both",
                        choices=["light", "docling", "whisper", "depth", "ffmpeg", "both"])
    args = parser.parse_args()

    # ffmpeg só empacota binários prontos: não roda PyInstaller e, sobretudo,
    # não pode chamar clean() — isso apagaria os sidecars já compilados.
    if args.target == "ffmpeg":
        build_ffmpeg()
        print("\nBuild concluído.")
        raise SystemExit(0)

    triple = get_target_triple()
    print(f"Target triple: {triple}")
    clean()

    if args.target in ("light", "both"):
        build_light(triple)
    if args.target in ("docling", "both"):
        build_docling(triple)
    if args.target == "whisper":
        build_whisper(triple)
    if args.target == "depth":
        build_depth(triple)

    print("\nBuild concluído.")

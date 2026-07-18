# Roadmap — CAMPS-UTILS (suíte de utilitários)

Estado vivo da implementação. Spec formal: `spec/novas-funcoes/camps-utils-spec.md`.
Última atualização: 2026-07-18.

---

## Onde estamos

**Fase 1 (núcleo) implementada e verde.** App deixou de ser single-purpose (PDF→Markdown) e
virou suíte multi-ferramenta com menu. Falta o empacotamento (web installer + 2 bundles) e a
validação visual rodando `tauri dev`.

Verificação atual (tudo passando):
- `npm run typecheck` — limpo
- `npm run test` (vitest) — 8/8
- `cargo check` (em `src-tauri/`) — ok
- `.venv/Scripts/python -m pytest python/test_converter.py` — 22/22
- Smoke md2pdf real → gerou PDF válido (`%PDF-`)

---

## Feito nesta implantação

### Arquitetura / menu
- **Registro de ferramentas** `src/tools/registry.tsx` — fonte única (id, nome, categoria, ícone,
  componente). Categorias: Documentos / Imagens / Mídia / Utilitários.
- **Home** em grade `src/components/Home.tsx` (cards por categoria, `aria-label="Abrir <tool>"`).
- **Sidebar** reescrita `src/components/Sidebar.tsx` — marca CAMPS-UTILS, nav por categoria,
  Início/Histórico/Configurações.
- **App shell** `src/App.tsx` — estado `activeToolId` + `showHistory`; roteia Home / tool / histórico.
- **Histórico generalizado** — `HistoryEntry` ganhou `tool`; `markdown` virou opcional
  (`src/types/conversion.ts`).

### Ferramentas
- **PDF → Markdown** — extraída de `App.tsx` p/ `src/tools/pdf-to-markdown/PdfToMarkdownTool.tsx`
  (lógica/UI idênticas, Docling mantido).
- **Markdown → PDF** — `src/tools/markdown-to-pdf/MarkdownToPdfTool.tsx` (arquivo .md ou texto colado →
  save dialog → sidecar `md2pdf`).
- **Converter imagens** — `src/tools/image-convert/ImageConvertTool.tsx`. Drag-drop, preview com
  thumbnails+nomes+remover, escolher pasta ao salvar. Formatos webp/png/jpg/ico + qualidade.
- **Base64 / Texto** — `src/tools/base64/Base64Tool.tsx` (frontend puro).
- **QR code** — `src/tools/qr-code/QrCodeTool.tsx` → Rust `generate_qr` (crate `qrcode`), salva PNG.
- **Hash / Checksum** — `src/tools/hash/HashTool.tsx` → Rust `hash_files` (md5/sha1/sha256), testado.
- **Ferramentas de PDF** — `src/tools/pdf-tools/PdfToolsTool.tsx` (juntar/dividir/comprimir) → sidecar
  `pdf_merge`/`pdf_split`/`pdf_compress` (PyMuPDF). Pytest cobre.
- **Redimensionar imagens** — `src/tools/image-resize/ImageResizeTool.tsx` → Rust `resize_images`
  (dimensão máx / escala %, formato, qualidade, renomear em lote). cargo test cobre.

- **Baixar do YouTube** — `src/tools/youtube/YoutubeTool.tsx` → Rust `download_youtube` → sidecar
  `youtube` (yt-dlp) + ffmpeg empacotado. Progresso real via evento `tool-progress`.

- **Comprimir vídeo / Converter áudio / Vídeo→GIF** — `src/tools/video-compress`,
  `src/tools/audio-convert`, `src/tools/video-to-gif` → Rust `compress_video`/`convert_audio`/
  `video_to_gif` (ffmpeg empacotado). Progresso real onde faz sentido.
- **Baixar do Spotify** — `src/tools/spotify/SpotifyTool.tsx` → Rust `download_spotify` → sidecar
  `spotify`. **Usa spotipy** (API oficial, `requests_timeout`) p/ metadados + **yt-dlp** p/ áudio
  (não usa mais spotdl — tinha bug `KeyError: ownerV2` no scraping de playlist). Creds públicas do
  spotdl hardcodadas (só leitura). Progresso por faixa.
  ⚠️ Playlists **editoriais do Spotify** (`37i9...`) são bloqueadas pela API deles desde nov/2024 —
  só funciona playlist de usuário, álbum ou faixa; app mostra erro claro nesse caso.
  ⚠️ Creds públicas compartilhadas = rate-limit 429 rápido. Tool tem seção "Credenciais do Spotify"
  (Client ID/Secret do usuário, salvos em localStorage `spotify-creds`, passados pro backend). Sem
  creds próprias, cai no limite compartilhado. Backend detecta 429 → errorCode `RATE_LIMIT` c/ dica.

**13 ferramentas ativas:** Documentos (PDF→MD, MD→PDF, Ferramentas de PDF) · Imagens (Converter,
Redimensionar) · Mídia (YouTube, Spotify, Comprimir vídeo, Converter áudio, Vídeo→GIF) ·
Utilitários (Base64, QR code, Hash).

### Gotcha de build descoberto
`python/build.py` precisa `--collect-all` p/ libs importadas de forma lazy (dentro de funções):
adicionados `markdown`, `xhtml2pdf`, `reportlab`, `svglib`, `fitz`, `pikepdf`. Sem isso o exe
empacotado dá `MODEL_ERROR`. Também: rebuild do sidecar tem que rodar **depois** de mexer no
`converter.py` (senão dispatch novo = "ferramenta desconhecida").

### Backend Rust (`src-tauri/src/commands.rs`)
- `run_python_tool(app, tool, input_json)` genérico (spawn/stream do sidecar, contrato stdout=JSON).
- `convert_pdf` virou wrapper fino → `run_python_tool("pdf2md", …)`.
- `run_tool(tool, input_json)` — comando genérico exposto ao frontend (md2pdf etc.).
- `convert_images(args)` — nativo, crates `image` + `webp`. webp/png/jpg/ico, qualidade, ico ≤256px.
- Registrados em `src-tauri/src/lib.rs`. Cargo: `image`, `webp` (tauri-build ativou `protocol-asset`).

### Sidecar Python (`python/converter.py`)
- Dispatch `--tool` (default `pdf2md` p/ compat) → `dispatch()`.
- `convert_md_to_pdf()` via `markdown` + `xhtml2pdf` (deps novas em `requirements.txt` e no `.venv`).
- `pdf2md` inalterado (Docling).

### Fixes de raiz
- **Drag-drop quebrado** (`src/hooks/useDragDrop.ts`): usava evento Tauri **v1**
  (`tauri://file-drop`); trocado p/ API v2 `onDragDropEvent`. Agora aceita `accept: string[]`
  (default `["pdf"]`) — conserta drag de PDF **e** habilita imagens.
- **Asset protocol** habilitado em `tauri.conf.json` (`security.assetProtocol.enable + scope`) p/
  thumbnails via `convertFileSrc`.

### Rename → CAMPS-UTILS
- `tauri.conf.json` (`productName`, `identifier=com.camps.utils`, título), `package.json` (`name`),
  `index.html` (`<title>`), Sidebar. **Pendente:** ícone (`scripts/setup.ps1::New-AppIcon` ainda "MD").
- Crate Rust interno segue `pdf-to-markdown` (invisível ao usuário — não mexer sem necessidade).

### Testes
- `src/test/App.test.tsx` reescrito p/ UI atual (Home → abre tool → fluxo FileQueue) + teste Base64.
- `src/test/setup.ts` mocks atualizados (`onDragDropEvent`, `convertFileSrc`).
- `python/test_converter.py` + `TestDispatch` e `TestMdToPdf`; corrigido alvo de patch pré-quebrado
  (`docling.document_converter.DocumentConverter`).

---

## Gotchas (não esquecer)

- **DEV roda o Python da fonte, não o exe.** `run_python_tool` em `commands.rs` tem `#[cfg]`:
  em **debug** (`npm run dev`) executa `.venv/Scripts/python.exe python/converter.py` direto
  (via `tokio::process`) → mudanças no `converter.py` valem na hora, sem PyInstaller. Em **release**
  usa o sidecar empacotado. ⇒ **Não precisa `build:python` pra testar sidecar em dev.**
- **Sidecar empacotado (`build:python`) só importa p/ RELEASE/instalador.** Rodar quando for gerar
  o `.exe` final; precisa das libs coletadas no `build.py` (docling, md2pdf, pdf, yt_dlp).
- **Drag/preview/asset só funcionam no Tauri real** (`npm run dev`), não em `npm run dev:vite`.
- **`tauri dev` 1ª vez**: Rust ~10-20 min; depois rápido.
- **YouTube em ambiente de datacenter** retorna "Video unavailable" (IP bloqueado). Testar só em
  máquina com IP residencial.

---

## Próximos passos

### Fase 1 — fechar o que falta
- [~] Rebuild do sidecar com `--tool` via `build.py` — **em andamento** (background). Depois
      `npm run dev` e validar visualmente TODAS as tools (inclui runtime de imagem e thumbnails).
- [x] Ícone CAMPS-UTILS: `New-AppIcon` agora desenha "CU"; ícones regenerados via `npx tauri icon`
      (`src-tauri/icons/*`).
- [x] **build.py split**: `python build.py light|docling|both`. Light exclui torch/docling
      (`--exclude-module`) → só ferramentas leves. Docling gera `camps-docling.zip` + `.sha256`.
- [x] **Download no 1º uso** (escolhido em vez de NSIS): Rust `ensure_docling` (reqwest stream +
      SHA256 + crate `zip` → `%LOCALAPPDATA%/com.camps.utils/runtime/`), `docling_installed`, rota
      release `pdf2md` → sidecar docling baixado (`run_docling_release`). Frontend `DoclingGate` no
      PdfToMarkdownTool (botão + barra via evento `docling-progress`). Dev = no-op (roda a fonte).
- [x] Git: `git init` + commit em `main` + remote `FelipeCamposM/CAMPS-UTILS`.
- [~] Build **light** — em andamento (background).
- [ ] Build **docling** (`python build.py docling`) → zip + hash.
- [ ] **Usuário:** `git push -u origin main`; criar Release tag `docling-v1`; subir
      `python/dist/camps-docling.zip`.
- [ ] Preencher `DOCLING_SHA256` em `commands.rs` com o hash gerado; `npm run build` (instalador).
- [ ] (Opcional/futuro) NSIS install-time download; MSI full offline.

### Fase 2 — YouTube
- [x] Empacotar **ffmpeg + ffprobe** (static, ~87MB cada) em `src-tauri/binaries/`; `tauri.conf.json`
      `bundle.resources`. Rust `resolve_ffmpeg` (prod=resource, dev=`CARGO_MANIFEST_DIR`, fallback exe).
- [x] Sidecar `--tool youtube` (`yt-dlp`): `audio`(mp3) / `video`(mp4) / `playlist_audio`.
      `ffmpegLocation` injetado pelo Rust.
- [x] **Progresso real**: `run_python_tool` emite `tool-progress` ao ver `PROGRESS: <pct>` no stderr;
      `YoutubeTool` escuta com `listen()` e mostra barra.
- [x] Tool `src/tools/youtube/YoutubeTool.tsx` (URL, modo, kbps, pasta) — categoria Mídia.
- [ ] **Validar download real** — bloqueado aqui (IP de datacenter → YouTube barra). yt-dlp/ffmpeg/erros
      OK; falta testar na máquina do usuário (`npm run build:python` + `npm run dev`).
- [~] Rebuild do sidecar com `yt_dlp` coletado — **em andamento** (background).

### Fase 3 — PDF-utils, mídia extra, utilitários, tamanho
- [x] PDF: juntar / dividir / comprimir (sidecar `pdf_merge`/`pdf_split`/`pdf_compress` via PyMuPDF).
      Tool único `src/tools/pdf-tools/PdfToolsTool.tsx` (3 modos). Pytest 12/12 (rápido, sem Docling).
      **Antecipado.** Falta validar via exe empacotado após rebuild.
- [x] Imagens: redimensionar / comprimir / renomear em lote — Rust `resize_images` (helper
      `write_image` reaproveitado), tool `src/tools/image-resize/ImageResizeTool.tsx`. cargo test 4/4.
      **Antecipado.**
- [x] **Comprimir vídeo** — Rust `compress_video` (ffmpeg H.264, CRF Leve/Médio/Forte), progresso
      real via ffprobe + `-progress pipe:1`. Tool `src/tools/video-compress/`. Pipeline validado
      headless (155KB→43KB). **Antecipado.**
- [x] **Converter áudio** (mp3/wav/flac) — Rust `convert_audio` (batch, ffmpeg). Tool
      `src/tools/audio-convert/`. Validado headless.
- [x] **Vídeo → GIF** — Rust `video_to_gif` (fps/largura/trecho, ffmpeg + progresso). Tool
      `src/tools/video-to-gif/`. Validado headless. Helpers `ffmpeg_run`/`ffmpeg_run_progress`
      compartilhados com `compress_video`.
- [x] QR code (`qrcode`) + hash/checksum (`sha2`/`sha1`/`md5`/`hex`) — **antecipados p/ agora**.
      Comandos Rust `generate_qr`/`hash_files` (+ `cargo test` c/ vetores conhecidos), tools
      `src/tools/qr-code/` e `src/tools/hash/`, registrados na categoria Utilitários.
- [ ] Trims oportunistas no bundle Docling (`--exclude-module`, UPX, torch CPU-only); medir zip.

> Nota de ordem: QR e hash foram puxados da F3 p/ frente (eram Rust puro, testáveis headless) enquanto
> o empacotamento F1 aguarda feedback de build/instalador.

---

## Verificação por fase (rodar sempre)
- `npm run typecheck` · `npm run test` · `cargo check` · `pytest python/test_converter.py`
- Manual: `npm run build:python` → `npm run dev` → exercitar cada tool com arquivo real.
- Web installer (F1): rodar `.exe` em máquina limpa com internet; testar hash inválido/offline.

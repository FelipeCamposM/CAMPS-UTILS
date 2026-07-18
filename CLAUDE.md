# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Roadmap obrigatório

Este projeto está migrando de "PDF to Markdown" para a suíte **CAMPS-UTILS**. **Sempre** registre o
progresso em `roadmaps/new-functions/roadmap.md`: ao concluir um passo, marque o checkbox e anote o
que foi feito (com caminhos de arquivo) e os próximos passos, antes de encerrar o turno. A spec formal
é `spec/novas-funcoes/camps-utils-spec.md`. Comece qualquer sessão de trabalho lendo esses dois.

## What this is

Local-only Windows desktop app that converts PDFs to Markdown privately (no cloud). Tauri 2 shell (Rust) + React/TypeScript/Vite/Tailwind frontend + a Python (Docling) sidecar for the actual conversion. UI strings are Portuguese (pt-BR).

## Commands

```bash
npm run dev            # tauri dev — full app (Rust + Vite), needs sidecar built + Rust installed
npm run dev:vite       # Vite only, no Tauri — UI work without Rust (invoke() calls will fail)
npm run test           # vitest run (jsdom)
npm run test:watch     # vitest watch
npx vitest run src/test/App.test.tsx   # single test file
npm run typecheck      # tsc --noEmit
npm run build:python   # rebuild the Python sidecar via python/build.py (activate .venv first)
npm run build          # tauri build — production installer (.exe/.msi in src-tauri/target/release/bundle)
npm run build:all      # build:python then tauri build
```

First-time setup / full build from clean machine: `npm run setup` (installs Rust, Node deps, Python venv, icons, sidecar, then builds the installer) or `npm run setup:dev` (same but launches `tauri dev` instead of building). See `scripts/setup.ps1`.

Vite dev server is pinned to port **1420** (strictPort) — Tauri expects it there.

## Architecture

Conversion flow crosses three process boundaries. Follow it end to end before changing any layer:

1. **React** (`src/App.tsx`) — user drops a PDF → `useConversion` hook (`src/hooks/useConversion.ts`) → `conversionService.convertPdf()` (`src/services/conversionService.ts`).
2. **conversionService** calls Tauri `invoke("convert_pdf", { inputJson })`. `inputJson` is `JSON.stringify({ inputPath, outputPath? })`.
3. **Rust** (`src-tauri/src/commands.rs::convert_pdf`) spawns the Python sidecar via the shell plugin: `sidecar("converter").args(["--input", inputJson])`. It streams events, collects **stdout only**, and returns it as a raw string.
4. **Python** (`python/converter.py`) parses `--input` JSON, runs Docling (`DocumentConverter` + `RapidOcrOptions`), and prints **exactly one JSON line to stdout**. All progress/logging goes to **stderr** (`log()`), which Rust captures separately for debugging.
5. Back in `conversionService`, the stdout string is `JSON.parse`d into a `ConversionResult` discriminated union and returned to the hook, which dispatches state updates.

**The stdout/stderr split is a hard contract.** Python must never print anything but the final JSON to stdout, or the frontend's `JSON.parse` breaks. Use `log()` (stderr) for everything else.

### State

- Frontend app state is a **discriminated-union reducer** in `src/types/conversion.ts` (`appReducer` + `AppAction`), driven by `useReducer` in `App.tsx`. No Redux/context store.
- `ConversionResult` is `ConversionSuccess | ConversionFailure` keyed on `success`; error paths carry an `ErrorCode`. Both Rust and Python emit JSON matching this shape (including error JSON on failure) — keep the TS types, `converter.py` `make_error/make_success`, and the Rust error strings in `commands.rs` in sync.
- **Progress steps are cosmetic**: `useConversion` advances a fake step counter on a `setInterval` (`PROGRESS_STEPS`, `STEP_INTERVAL_MS`) because Docling doesn't report real progress. Don't mistake it for actual conversion state.

### Three Rust commands (that's the whole native surface)

Registered in `src-tauri/src/lib.rs`: `convert_pdf`, `save_markdown`, `open_folder`. Adding a native capability means: new fn in `commands.rs` → register in `lib.rs` `generate_handler!` → matching wrapper in `conversionService.ts`. Permissions live in `src-tauri/capabilities/default.json`.

### Persistence

Settings and history are **localStorage only** (MVP), not the Tauri fs plugin — `settingsService.ts` (key `pdf-to-markdown-settings`) and `historyService.ts` (key `pdf-to-markdown-history`, capped at 50 entries). File saving to disk goes through the `save_markdown` Rust command instead.

### Python sidecar packaging

`python/build.py` bundles `converter.py` with PyInstaller (collects `docling`, `rapidocr`, `onnxruntime`, `docling_parse`), names the output `converter-<target-triple>` (Tauri 2 sidecar convention), and copies the `.exe` into `src-tauri/binaries/`. `tauri.conf.json` references it via `externalBin: ["binaries/converter"]`. On first conversion Docling downloads ML models to `~/.cache/huggingface/hub` — `detect_first_run()` warns about this.

## Notes

- Rust must be installed for `tauri dev`/`tauri build` (`winget install Rustlang.Rustup`); MSVC Build Tools needed for linking. Pure UI work can skip Rust with `npm run dev:vite`.
- Frontend tests use Vitest + Testing Library + jsdom (`src/test/setup.ts`); Python has `python/test_converter.py` (pytest).
- `roadmap.md` tracks feature checklist state; `promptbase.md` / `spec/` hold the original spec.

import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { convertImages, openFolder } from "../../services/conversionService";
import type { ImageConvertArgs } from "../../services/conversionService";
import { useDragDrop } from "../../hooks/useDragDrop";
import type { SelectedFile } from "../../types/conversion";
import type { ToolProps } from "../registry";

type Format = ImageConvertArgs["format"];

const FORMATS: { value: Format; label: string }[] = [
  { value: "webp", label: "WebP" },
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "ico", label: "ICO" },
];

const IMAGE_EXTS = ["jpg", "jpeg", "png", "bmp", "gif", "webp", "tiff", "ico"];

export function ImageConvertTool({ addHistory }: ToolProps) {
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [format, setFormat] = useState<Format>("webp");
  const [quality, setQuality] = useState(85);
  const [busy, setBusy] = useState(false);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);

  const usesQuality = format === "webp" || format === "jpg";

  function addFiles(incoming: SelectedFile[]) {
    setOutputs([]);
    setError(null);
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => f.path));
      const merged = [...prev];
      for (const f of incoming) {
        if (!seen.has(f.path)) {
          seen.add(f.path);
          merged.push(f);
        }
      }
      return merged;
    });
  }

  const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useDragDrop({
    accept: IMAGE_EXTS,
    onFiles: (fs) => { setDropError(null); addFiles(fs); },
    onError: setDropError,
  });

  async function pickFiles() {
    const picked = await open({
      multiple: true,
      filters: [{ name: "Imagens", extensions: IMAGE_EXTS }],
    });
    if (!picked) return;
    const list = Array.isArray(picked) ? picked : [picked];
    addFiles(
      list.map((p) => ({ name: p.split(/[/\\]/).pop() ?? p, path: p, size: 0 }))
    );
  }

  function removeFile(path: string) {
    setFiles((prev) => prev.filter((f) => f.path !== path));
  }

  async function handleConvert() {
    if (files.length === 0 || busy) return;

    const outDir = await open({
      directory: true,
      title: "Escolher pasta para salvar as imagens",
    });
    if (typeof outDir !== "string") return;

    setBusy(true);
    setError(null);
    setOutputs([]);
    try {
      const result = await convertImages({
        inputs: files.map((f) => f.path),
        format,
        outDir,
        quality: usesQuality ? quality : undefined,
      });
      setOutputs(result);
      addHistory({
        id: crypto.randomUUID(),
        tool: "image-convert",
        filename: `${files.length} imagem(ns) → ${format.toUpperCase()}`,
        inputPath: files[0].path,
        outputPath: result[0],
        durationMs: 0,
        timestamp: Date.now(),
        success: true,
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Arraste imagens aqui ou clique para selecionar"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={pickFiles}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickFiles(); }
        }}
        className={[
          "rounded-xl border-2 border-dashed p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
          isDragging
            ? "border-accent bg-accent/10"
            : "border-border-subtle hover:border-border hover:bg-bg-elevated",
        ].join(" ")}
      >
        <ImgIcon dragging={isDragging} />
        <p className="text-text-primary text-sm font-medium">
          {isDragging ? "Solte as imagens aqui" : "Arraste imagens aqui"}
        </p>
        <p className="text-text-muted text-xs">ou clique para selecionar — múltiplas</p>
      </div>

      {dropError && <p role="alert" className="text-red-400 text-xs">{dropError}</p>}

      {/* Preview grid */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-text-secondary text-xs font-medium">
              {files.length} imagem(ns)
            </p>
            <button
              onClick={() => setFiles([])}
              className="text-text-muted text-xs hover:text-red-400 transition-colors"
            >
              Limpar
            </button>
          </div>
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {files.map((f) => (
              <li
                key={f.path}
                className="group relative rounded-lg border border-border-subtle bg-bg-surface overflow-hidden"
              >
                <img
                  src={convertFileSrc(f.path)}
                  alt={f.name}
                  className="w-full h-20 object-cover bg-bg-elevated"
                  loading="lazy"
                />
                <p className="text-text-muted text-[10px] px-1.5 py-1 truncate" title={f.name}>
                  {f.name}
                </p>
                <button
                  onClick={() => removeFile(f.path)}
                  aria-label={`Remover ${f.name}`}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Format */}
      <div className="space-y-2">
        <span className="text-text-secondary text-xs font-medium">Formato de saída</span>
        <div className="flex gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFormat(f.value)}
              className={[
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                format === f.value
                  ? "bg-accent text-white"
                  : "border border-border-subtle text-text-secondary hover:bg-bg-elevated",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {usesQuality && (
        <div className="space-y-1.5">
          <label htmlFor="img-quality" className="text-text-secondary text-xs font-medium">
            Qualidade: {quality}
          </label>
          <input
            id="img-quality"
            type="range"
            min={1}
            max={100}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </div>
      )}

      <button
        onClick={handleConvert}
        disabled={files.length === 0 || busy}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {busy ? "Convertendo…" : "Converter e salvar…"}
      </button>

      {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}

      {outputs.length > 0 && (
        <div className="rounded-xl border border-green-900/40 bg-green-950/20 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-green-400 text-xs font-medium">
              {outputs.length} arquivo(s) gerado(s)
            </p>
            <button
              onClick={() => openFolder(outputs[0])}
              className="text-accent text-xs hover:underline"
            >
              Abrir pasta
            </button>
          </div>
          <ul className="text-text-muted text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
            {outputs.map((o) => (
              <li key={o} className="truncate">{o}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ImgIcon({ dragging }: { dragging: boolean }) {
  return (
    <svg
      className={`w-8 h-8 transition-colors ${dragging ? "text-accent" : "text-text-muted"}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

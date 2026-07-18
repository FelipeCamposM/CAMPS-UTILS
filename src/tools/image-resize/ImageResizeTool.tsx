import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { resizeImages, openFolder } from "../../services/conversionService";
import type { ResizeArgs } from "../../services/conversionService";

type Mode = "dimensao" | "escala";
type Fmt = "manter" | "webp" | "png" | "jpg";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "bmp", "gif", "webp", "tiff"];

export function ImageResizeTool() {
  const [files, setFiles] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("dimensao");
  const [maxDim, setMaxDim] = useState(1280);
  const [scale, setScale] = useState(50);
  const [fmt, setFmt] = useState<Fmt>("manter");
  const [quality, setQuality] = useState(85);
  const [prefix, setPrefix] = useState("");
  const [busy, setBusy] = useState(false);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const usesQuality = fmt === "webp" || fmt === "jpg";

  async function pickFiles() {
    const picked = await open({ multiple: true, filters: [{ name: "Imagens", extensions: IMAGE_EXTS }] });
    if (!picked) return;
    setFiles(Array.isArray(picked) ? picked : [picked]);
    setOutputs([]);
    setError(null);
  }

  async function handleRun() {
    if (files.length === 0 || busy) return;
    const outDir = await open({ directory: true, title: "Escolher pasta de saída" });
    if (typeof outDir !== "string") return;

    setBusy(true);
    setError(null);
    setOutputs([]);
    try {
      const args: ResizeArgs = {
        inputs: files,
        outDir,
        quality: usesQuality ? quality : undefined,
        format: fmt === "manter" ? undefined : fmt,
        renamePrefix: prefix.trim() || undefined,
      };
      if (mode === "dimensao") args.maxWidth = args.maxHeight = maxDim;
      else args.scalePct = scale;

      setOutputs(await resizeImages(args));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={pickFiles}
        className="w-full rounded-lg border border-dashed border-border-subtle px-4 py-3 text-sm text-text-muted hover:border-border hover:text-text-secondary hover:bg-bg-elevated transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {files.length > 0 ? `${files.length} imagem(ns) selecionada(s)` : "Selecionar imagens"}
      </button>

      <div className="flex gap-2">
        {(["dimensao", "escala"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={[
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
              mode === m ? "bg-accent text-white" : "border border-border-subtle text-text-secondary hover:bg-bg-elevated",
            ].join(" ")}
          >
            {m === "dimensao" ? "Dimensão máx." : "Escala %"}
          </button>
        ))}
      </div>

      {mode === "dimensao" ? (
        <div className="space-y-1.5">
          <label htmlFor="max-dim" className="text-text-secondary text-xs font-medium">
            Máx. largura/altura: {maxDim}px (mantém proporção)
          </label>
          <input id="max-dim" type="range" min={64} max={4096} step={64} value={maxDim}
            onChange={(e) => setMaxDim(Number(e.target.value))} className="w-full accent-accent" />
        </div>
      ) : (
        <div className="space-y-1.5">
          <label htmlFor="scale" className="text-text-secondary text-xs font-medium">Escala: {scale}%</label>
          <input id="scale" type="range" min={1} max={100} value={scale}
            onChange={(e) => setScale(Number(e.target.value))} className="w-full accent-accent" />
        </div>
      )}

      <div className="space-y-2">
        <span className="text-text-secondary text-xs font-medium">Formato de saída</span>
        <div className="flex gap-2">
          {(["manter", "webp", "png", "jpg"] as Fmt[]).map((f) => (
            <button key={f} onClick={() => setFmt(f)}
              className={[
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                fmt === f ? "bg-accent text-white" : "border border-border-subtle text-text-secondary hover:bg-bg-elevated",
              ].join(" ")}
            >
              {f === "manter" ? "Manter" : f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {usesQuality && (
        <div className="space-y-1.5">
          <label htmlFor="rq" className="text-text-secondary text-xs font-medium">Qualidade: {quality}</label>
          <input id="rq" type="range" min={1} max={100} value={quality}
            onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-accent" />
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="prefix" className="text-text-secondary text-xs font-medium">
          Renomear em lote (opcional)
        </label>
        <input id="prefix" type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)}
          placeholder="ex.: foto → foto_1, foto_2…"
          className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" />
      </div>

      <button
        onClick={handleRun}
        disabled={files.length === 0 || busy}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {busy ? "Processando…" : "Redimensionar e salvar…"}
      </button>

      {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}

      {outputs.length > 0 && (
        <div className="rounded-xl border border-green-900/40 bg-green-950/20 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-green-400 text-xs font-medium">{outputs.length} arquivo(s) gerado(s)</p>
            <button onClick={() => openFolder(outputs[0])} className="text-accent text-xs hover:underline">Abrir pasta</button>
          </div>
          <ul className="text-text-muted text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
            {outputs.map((o) => <li key={o} className="truncate">{o}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

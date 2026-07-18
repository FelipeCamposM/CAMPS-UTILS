import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertAudio, openFolder } from "../../services/conversionService";
import type { ToolProps } from "../registry";

type Fmt = "mp3" | "wav" | "flac";
const FORMATS: Fmt[] = ["mp3", "wav", "flac"];
const AUDIO_EXTS = ["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus", "wma", "mp4", "mkv"];

export function AudioConvertTool({ addHistory }: ToolProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [format, setFormat] = useState<Fmt>("mp3");
  const [bitrate, setBitrate] = useState(192);
  const [busy, setBusy] = useState(false);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function pickFiles() {
    const picked = await open({ multiple: true, filters: [{ name: "Áudio/Vídeo", extensions: AUDIO_EXTS }] });
    if (!picked) return;
    setFiles(Array.isArray(picked) ? picked : [picked]);
    setOutputs([]);
    setError(null);
  }

  async function handleConvert() {
    if (files.length === 0 || busy) return;
    const outDir = await open({ directory: true, title: "Escolher pasta de saída" });
    if (typeof outDir !== "string") return;

    setBusy(true);
    setError(null);
    setOutputs([]);
    try {
      const result = await convertAudio(files, outDir, format, format === "mp3" ? bitrate : undefined);
      setOutputs(result);
      addHistory({
        id: crypto.randomUUID(),
        tool: "audio-convert",
        filename: `${files.length} áudio(s) → ${format.toUpperCase()}`,
        inputPath: files[0],
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
      <button
        onClick={pickFiles}
        className="w-full rounded-lg border border-dashed border-border-subtle px-4 py-3 text-sm text-text-muted hover:border-border hover:text-text-secondary hover:bg-bg-elevated transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : "Selecionar áudios"}
      </button>

      <div className="space-y-2">
        <span className="text-text-secondary text-xs font-medium">Formato de saída</span>
        <div className="flex gap-2">
          {FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={[
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                format === f ? "bg-accent text-white" : "border border-border-subtle text-text-secondary hover:bg-bg-elevated",
              ].join(" ")}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {format === "mp3" && (
        <div className="space-y-1.5">
          <label htmlFor="au-br" className="text-text-secondary text-xs font-medium">
            Bitrate: {bitrate} kbps
          </label>
          <input id="au-br" type="range" min={64} max={320} step={32} value={bitrate}
            onChange={(e) => setBitrate(Number(e.target.value))} className="w-full accent-accent" />
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

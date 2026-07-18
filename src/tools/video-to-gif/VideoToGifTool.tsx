import { useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { videoToGif, openFolder } from "../../services/conversionService";
import type { ToolProps } from "../registry";

const VIDEO_EXTS = ["mp4", "mkv", "mov", "avi", "webm", "flv", "wmv", "m4v", "gif"];

export function VideoToGifTool({ addHistory }: ToolProps) {
  const [input, setInput] = useState<string | null>(null);
  const [fps, setFps] = useState(12);
  const [width, setWidth] = useState(480);
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = listen<number>("tool-progress", (e) => setProgress(e.payload));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  function name(p: string) {
    return p.split(/[/\\]/).pop() ?? p;
  }

  async function pickFile() {
    const picked = await open({ multiple: false, filters: [{ name: "Vídeos", extensions: VIDEO_EXTS }] });
    if (typeof picked === "string") {
      setInput(picked);
      setResult(null);
      setError(null);
    }
  }

  async function handleConvert() {
    if (!input || busy) return;
    const base = name(input).replace(/\.[^.]+$/, "");
    const output = await save({ filters: [{ name: "GIF", extensions: ["gif"] }], defaultPath: `${base}.gif` });
    if (!output) return;

    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const path = await videoToGif(input, output, {
        fps,
        width,
        start: start ? Number(start) : undefined,
        duration: duration ? Number(duration) : undefined,
      });
      setResult(path);
      addHistory({
        id: crypto.randomUUID(),
        tool: "video-to-gif",
        filename: name(input),
        inputPath: input,
        outputPath: path,
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
        onClick={pickFile}
        className="w-full rounded-lg border border-dashed border-border-subtle px-4 py-3 text-sm text-text-muted hover:border-border hover:text-text-secondary hover:bg-bg-elevated transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {input ? name(input) : "Selecionar vídeo"}
      </button>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="gif-fps" className="text-text-secondary text-xs font-medium">FPS: {fps}</label>
          <input id="gif-fps" type="range" min={5} max={30} value={fps}
            onChange={(e) => setFps(Number(e.target.value))} className="w-full accent-accent" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="gif-w" className="text-text-secondary text-xs font-medium">Largura: {width}px</label>
          <input id="gif-w" type="range" min={120} max={1080} step={40} value={width}
            onChange={(e) => setWidth(Number(e.target.value))} className="w-full accent-accent" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="gif-start" className="text-text-secondary text-xs font-medium">Início (s) — opcional</label>
          <input id="gif-start" type="number" min={0} value={start} onChange={(e) => setStart(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="gif-dur" className="text-text-secondary text-xs font-medium">Duração (s) — opcional</label>
          <input id="gif-dur" type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)}
            placeholder="tudo"
            className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" />
        </div>
      </div>

      <button
        onClick={handleConvert}
        disabled={!input || busy}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {busy ? "Gerando GIF…" : "Gerar GIF e salvar…"}
      </button>

      {busy && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} role="progressbar" aria-valuenow={progress} />
          </div>
          <p className="text-text-muted text-[11px] text-center">{progress}%</p>
        </div>
      )}

      {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}

      {result && (
        <div className="rounded-xl border border-green-900/40 bg-green-950/20 px-4 py-3 flex items-center justify-between gap-2">
          <p className="text-green-400 text-xs truncate">Salvo: {result}</p>
          <button onClick={() => openFolder(result)} className="text-accent text-xs hover:underline shrink-0">Abrir pasta</button>
        </div>
      )}
    </div>
  );
}

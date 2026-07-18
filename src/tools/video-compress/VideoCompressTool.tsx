import { useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { compressVideo, openFolder } from "../../services/conversionService";
import type { ToolProps } from "../registry";

const VIDEO_EXTS = ["mp4", "mkv", "mov", "avi", "webm", "flv", "wmv", "m4v"];

const LEVELS: { label: string; crf: number; hint: string }[] = [
  { label: "Leve", crf: 23, hint: "melhor qualidade" },
  { label: "Médio", crf: 28, hint: "equilíbrio" },
  { label: "Forte", crf: 32, hint: "menor arquivo" },
];

export function VideoCompressTool({ addHistory }: ToolProps) {
  const [input, setInput] = useState<string | null>(null);
  const [crf, setCrf] = useState(28);
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

  async function handleCompress() {
    if (!input || busy) return;

    const base = name(input).replace(/\.[^.]+$/, "");
    const output = await save({
      filters: [{ name: "MP4", extensions: ["mp4"] }],
      defaultPath: `${base}_comprimido.mp4`,
    });
    if (!output) return;

    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const path = await compressVideo(input, output, crf, "medium");
      setResult(path);
      addHistory({
        id: crypto.randomUUID(),
        tool: "video-compress",
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

      <div className="space-y-2">
        <span className="text-text-secondary text-xs font-medium">Nível de compressão</span>
        <div className="flex gap-2">
          {LEVELS.map((l) => (
            <button
              key={l.crf}
              onClick={() => setCrf(l.crf)}
              className={[
                "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
                crf === l.crf ? "bg-accent text-white" : "border border-border-subtle text-text-secondary hover:bg-bg-elevated",
              ].join(" ")}
            >
              <span className="block">{l.label}</span>
              <span className="block text-[10px] opacity-70">{l.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleCompress}
        disabled={!input || busy}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {busy ? "Comprimindo…" : "Comprimir e salvar…"}
      </button>

      {busy && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
            />
          </div>
          <p className="text-text-muted text-[11px] text-center">{progress}%</p>
        </div>
      )}

      {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}

      {result && (
        <div className="rounded-xl border border-green-900/40 bg-green-950/20 px-4 py-3 flex items-center justify-between gap-2">
          <p className="text-green-400 text-xs truncate">Salvo: {result}</p>
          <button onClick={() => openFolder(result)} className="text-accent text-xs hover:underline shrink-0">
            Abrir pasta
          </button>
        </div>
      )}
    </div>
  );
}

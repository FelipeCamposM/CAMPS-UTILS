import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { runTool, openFolder } from "../../services/conversionService";

type Mode = "merge" | "split" | "compress";
interface ToolResult {
  success: boolean;
  outputPath?: string;
  outputs?: string[];
  errorCode?: string;
  message?: string;
}

const MODES: { value: Mode; label: string }[] = [
  { value: "merge", label: "Juntar" },
  { value: "split", label: "Dividir" },
  { value: "compress", label: "Comprimir" },
];

export function PdfToolsTool() {
  const [mode, setMode] = useState<Mode>("merge");
  const [files, setFiles] = useState<string[]>([]);
  const [every, setEvery] = useState(1);
  const [busy, setBusy] = useState(false);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const single = mode === "split";

  function switchMode(m: Mode) {
    setMode(m);
    setFiles([]);
    setOutputs([]);
    setError(null);
  }

  async function pickFiles() {
    const picked = await open({
      multiple: !single,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!picked) return;
    setFiles(Array.isArray(picked) ? picked : [picked]);
    setOutputs([]);
    setError(null);
  }

  function name(p: string) {
    return p.split(/[/\\]/).pop() ?? p;
  }

  const canRun =
    !busy && (single ? files.length === 1 : mode === "merge" ? files.length >= 2 : files.length >= 1);

  async function handleRun() {
    if (!canRun) return;
    setError(null);
    setOutputs([]);

    try {
      let result: ToolResult;
      if (mode === "merge") {
        const outputPath = await save({
          filters: [{ name: "PDF", extensions: ["pdf"] }],
          defaultPath: "juntado.pdf",
        });
        if (!outputPath) return;
        setBusy(true);
        result = await runTool<ToolResult>("pdf_merge", { inputs: files, outputPath });
      } else {
        const outputDir = await open({ directory: true, title: "Escolher pasta de saída" });
        if (typeof outputDir !== "string") return;
        setBusy(true);
        if (mode === "split") {
          result = await runTool<ToolResult>("pdf_split", {
            inputPath: files[0],
            outputDir,
            every,
          });
        } else {
          result = await runTool<ToolResult>("pdf_compress", { inputs: files, outputDir });
        }
      }

      if (result.success) {
        setOutputs(result.outputs ?? (result.outputPath ? [result.outputPath] : []));
      } else {
        setError(result.message ?? "Falha na operação.");
      }
    } catch {
      setError("Falha ao iniciar o conversor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => switchMode(m.value)}
            className={[
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
              mode === m.value
                ? "bg-accent text-white"
                : "border border-border-subtle text-text-secondary hover:bg-bg-elevated",
            ].join(" ")}
          >
            {m.label}
          </button>
        ))}
      </div>

      <button
        onClick={pickFiles}
        className="w-full rounded-lg border border-dashed border-border-subtle px-4 py-3 text-sm text-text-muted hover:border-border hover:text-text-secondary hover:bg-bg-elevated transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {files.length > 0
          ? `${files.length} PDF(s) selecionado(s)`
          : single
          ? "Selecionar PDF"
          : "Selecionar PDFs"}
      </button>

      {files.length > 0 && (
        <ul className="text-text-muted text-[11px] space-y-0.5 max-h-24 overflow-y-auto">
          {files.map((f, i) => (
            <li key={f} className="truncate">
              {mode === "merge" ? `${i + 1}. ` : ""}
              {name(f)}
            </li>
          ))}
        </ul>
      )}

      {mode === "split" && (
        <div className="space-y-1.5">
          <label htmlFor="split-every" className="text-text-secondary text-xs font-medium">
            Páginas por arquivo: {every}
          </label>
          <input
            id="split-every"
            type="range"
            min={1}
            max={20}
            value={every}
            onChange={(e) => setEvery(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </div>
      )}

      <button
        onClick={handleRun}
        disabled={!canRun}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {busy ? "Processando…" : MODES.find((m) => m.value === mode)?.label + " e salvar…"}
      </button>

      {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}

      {outputs.length > 0 && (
        <div className="rounded-xl border border-green-900/40 bg-green-950/20 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-green-400 text-xs font-medium">{outputs.length} arquivo(s) gerado(s)</p>
            <button onClick={() => openFolder(outputs[0])} className="text-accent text-xs hover:underline">
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

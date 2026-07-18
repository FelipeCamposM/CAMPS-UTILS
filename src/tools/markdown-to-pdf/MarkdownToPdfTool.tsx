import { useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { runTool, openFolder } from "../../services/conversionService";
import type { ToolProps } from "../registry";

interface Md2PdfResult {
  success: boolean;
  outputPath?: string;
  durationMs?: number;
  errorCode?: string;
  message?: string;
}

export function MarkdownToPdfTool({ settings, addHistory }: ToolProps) {
  const [text, setText] = useState("");
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pickFile() {
    const picked = await open({
      multiple: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }],
    });
    if (typeof picked === "string") {
      setSourcePath(picked);
      setSourceName(picked.split(/[/\\]/).pop() ?? picked);
      setText("");
      setResultPath(null);
      setError(null);
    }
  }

  function clearFile() {
    setSourcePath(null);
    setSourceName(null);
  }

  const canConvert = !busy && (sourcePath !== null || text.trim().length > 0);

  async function handleConvert() {
    if (!canConvert) return;
    setError(null);
    setResultPath(null);

    const baseName = sourceName ? sourceName.replace(/\.(md|markdown|txt)$/i, "") : "documento";
    const savePath = await save({
      filters: [{ name: "PDF", extensions: ["pdf"] }],
      defaultPath: settings.defaultOutputDir
        ? `${settings.defaultOutputDir}\\${baseName}.pdf`
        : `${baseName}.pdf`,
    });
    if (!savePath) return;

    setBusy(true);
    try {
      const result = await runTool<Md2PdfResult>("md2pdf", {
        inputPath: sourcePath ?? "",
        markdown: sourcePath ? "" : text,
        outputPath: savePath,
      });

      addHistory({
        id: crypto.randomUUID(),
        tool: "markdown-to-pdf",
        filename: sourceName ?? `${baseName}.pdf`,
        inputPath: sourcePath ?? "(texto)",
        outputPath: result.success ? result.outputPath : undefined,
        durationMs: result.success ? result.durationMs ?? 0 : 0,
        timestamp: Date.now(),
        success: result.success,
      });

      if (result.success && result.outputPath) {
        setResultPath(result.outputPath);
        if (settings.openFolderAfterSave) await openFolder(result.outputPath);
      } else {
        setError(result.message ?? "Não foi possível gerar o PDF.");
      }
    } catch {
      setError("Falha ao iniciar o conversor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={pickFile}
          className="rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-elevated transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Escolher arquivo .md
        </button>
        {sourceName && (
          <span className="flex items-center gap-1.5 text-xs text-text-secondary">
            {sourceName}
            <button
              onClick={clearFile}
              aria-label="Remover arquivo"
              className="text-text-muted hover:text-red-400"
            >
              ✕
            </button>
          </span>
        )}
      </div>

      {!sourcePath && (
        <div className="space-y-1.5">
          <label htmlFor="md-input" className="text-text-secondary text-xs font-medium">
            …ou cole o Markdown
          </label>
          <textarea
            id="md-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="# Título&#10;&#10;Seu conteúdo em Markdown…"
            className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent resize-y font-mono"
          />
        </div>
      )}

      <button
        onClick={handleConvert}
        disabled={!canConvert}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {busy ? "Gerando PDF…" : "Gerar PDF"}
      </button>

      {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}

      {resultPath && (
        <div className="rounded-xl border border-green-900/40 bg-green-950/20 px-4 py-3 flex items-center justify-between gap-2">
          <p className="text-green-400 text-xs truncate">PDF gerado: {resultPath}</p>
          <button
            onClick={() => openFolder(resultPath)}
            className="text-accent text-xs hover:underline shrink-0"
          >
            Abrir pasta
          </button>
        </div>
      )}
    </div>
  );
}

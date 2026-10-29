import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { runTool, openFolder } from "../../services/conversionService";
import type { ToolProps } from "../registry";
import { useToolEnter } from "../../lib/motion";
import { Button, FilePicker, ResultPanel } from "../../components/ui";

interface Pdf2DocxResult {
  success: boolean;
  outputPath?: string;
  durationMs?: number;
  errorCode?: string;
  message?: string;
}

function baseName(p: string) {
  return p.split(/[/\\]/).pop() ?? p;
}

export function PdfToWordTool({ settings, addHistory }: ToolProps) {
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConvert() {
    if (!sourcePath || busy) return;

    const stem = baseName(sourcePath).replace(/\.pdf$/i, "");
    const savePath = await save({
      filters: [{ name: "Word", extensions: ["docx"] }],
      defaultPath: settings.defaultOutputDir
        ? `${settings.defaultOutputDir}\\${stem}.docx`
        : `${stem}.docx`,
    });
    if (!savePath) return;

    setBusy(true);
    setError(null);
    setResultPath(null);
    try {
      const result = await runTool<Pdf2DocxResult>("pdf2docx", {
        inputPath: sourcePath,
        outputPath: savePath,
      });

      addHistory({
        id: crypto.randomUUID(),
        tool: "pdf-to-word",
        filename: baseName(sourcePath),
        inputPath: sourcePath,
        outputPath: result.success ? result.outputPath : undefined,
        durationMs: result.success ? result.durationMs ?? 0 : 0,
        timestamp: Date.now(),
        success: result.success,
      });

      if (result.success && result.outputPath) {
        setResultPath(result.outputPath);
        if (settings.openFolderAfterSave) await openFolder(result.outputPath);
      } else {
        setError(result.message ?? "Não foi possível converter o PDF para Word.");
      }
    } catch {
      setError("Falha ao iniciar o conversor.");
    } finally {
      setBusy(false);
    }
  }

  const toolRef = useToolEnter();

  return (
    <div ref={toolRef} className="space-y-4">
      <FilePicker
        accept={["pdf"]}
        filterName="PDF"
        maxSizeMb={settings.maxFileSizeMb}
        onError={setError}
        onPick={([p]) => { setSourcePath(p); setResultPath(null); setError(null); }}
        className="w-full"
      >
        {sourcePath ? baseName(sourcePath) : "Selecionar arquivo PDF"}
      </FilePicker>

      <div className="glass rounded-glass p-4 space-y-1">
        <p className="text-text-secondary text-xs font-medium">Como a conversão funciona</p>
        <p className="text-text-muted text-[11px]">
          Tudo roda no seu computador. Texto, tabelas e imagens viram um documento editável no
          Word. PDF escaneado (foto de papel) sai como imagem, sem texto editável — para esse caso
          use <b>PDF → Markdown</b>, que reconhece o texto. Layouts muito elaborados podem precisar
          de ajustes depois.
        </p>
      </div>

      <Button
        variant="primary"
        className="w-full"
        onClick={handleConvert}
        disabled={!sourcePath}
        loading={busy}
      >
        {busy ? "Convertendo…" : "Converter para Word e salvar…"}
      </Button>

      {error && <p role="alert" className="text-danger text-xs">{error}</p>}

      {resultPath && <ResultPanel paths={[resultPath]} />}
    </div>
  );
}

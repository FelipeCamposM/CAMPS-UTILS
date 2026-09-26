import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { getPdfTextSpans, applyPdfTextEdits, openFolder } from "../../services/conversionService";
import type { PdfTextSpan, PdfTextEdit } from "../../services/conversionService";
import type { ToolProps } from "../registry";
import { useToolEnter } from "../../lib/motion";
import { Button, FilePicker, ResultPanel } from "../../components/ui";
import { PdfInlineEditor } from "./PdfInlineEditor";

/**
 * Edição in-place: mostra o PDF exatamente como ele é (canvas pdf.js), cada
 * span de texto vira uma caixa editável no lugar exato de onde está. Ao
 * salvar, só os spans editados são redigidos (branco) e redesenhados no
 * PyMuPDF — o resto da página não é tocado.
 */
export function EditPdfTextTool({ settings, addHistory }: ToolProps) {
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [spansByPage, setSpansByPage] = useState<Map<number, PdfTextSpan[]> | null>(null);
  const [edited, setEdited] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setSourcePath(null);
    setSourceName(null);
    setSpansByPage(null);
    setEdited(new Map());
    setResultPath(null);
    setError(null);
  }

  async function handlePick(path: string) {
    reset();
    setSourcePath(path);
    setSourceName(path.split(/[/\\]/).pop() ?? path);
    setLoading(true);
    try {
      const r = await getPdfTextSpans(path);
      if (!r.success || !r.pages) {
        setError(r.message ?? "Não foi possível ler o texto do PDF.");
        setSourcePath(null);
        setSourceName(null);
        return;
      }
      const porPagina = new Map<number, PdfTextSpan[]>();
      r.pages.forEach((pagina, idx) => {
        porPagina.set(idx, pagina.spans.map((s) => ({ ...s, page: idx })));
      });
      setSpansByPage(porPagina);
    } catch {
      setError("Falha ao ler o PDF.");
      setSourcePath(null);
      setSourceName(null);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(id: string, texto: string) {
    setEdited((prev) => {
      // Achar o span original pra comparar — procura em todas as páginas.
      let original: string | undefined;
      for (const spans of spansByPage?.values() ?? []) {
        const s = spans.find((sp) => sp.id === id);
        if (s) { original = s.text; break; }
      }
      const next = new Map(prev);
      if (original !== undefined && texto === original) {
        next.delete(id);
      } else {
        next.set(id, texto);
      }
      return next;
    });
  }

  const allSpans = useMemo(
    () => Array.from(spansByPage?.values() ?? []).flat(),
    [spansByPage]
  );

  async function handleSave() {
    if (!sourceName || !sourcePath || busy || edited.size === 0) return;

    const baseName = sourceName.replace(/\.pdf$/i, "");
    const savePath = await save({
      filters: [{ name: "PDF", extensions: ["pdf"] }],
      defaultPath: settings.defaultOutputDir
        ? `${settings.defaultOutputDir}\\${baseName}-editado.pdf`
        : `${baseName}-editado.pdf`,
    });
    if (!savePath) return;

    setBusy(true);
    setError(null);
    try {
      const edits: PdfTextEdit[] = allSpans
        .filter((s) => edited.has(s.id))
        .map((s) => ({
          page: s.page,
          bbox: s.bbox,
          font: s.font,
          size: s.size,
          color: s.color,
          flags: s.flags,
          text: edited.get(s.id) ?? s.text,
        }));

      const r = await applyPdfTextEdits(sourcePath, savePath, edits);
      addHistory({
        id: crypto.randomUUID(),
        tool: "edit-pdf-text",
        filename: sourceName,
        inputPath: sourcePath,
        outputPath: r.success ? r.outputPath : undefined,
        durationMs: r.success ? r.durationMs ?? 0 : 0,
        timestamp: Date.now(),
        success: r.success,
      });

      if (r.success && r.outputPath) {
        setResultPath(r.outputPath);
        if (settings.openFolderAfterSave) await openFolder(r.outputPath);
      } else {
        setError(r.message ?? "Não foi possível salvar as edições no PDF.");
      }
    } catch {
      setError("Falha ao salvar o PDF.");
    } finally {
      setBusy(false);
    }
  }

  const toolRef = useToolEnter();

  if (!sourcePath) {
    return (
      <div ref={toolRef} className="space-y-4">
        <FilePicker
          accept={["pdf"]}
          filterName="PDF"
          maxSizeMb={settings.maxFileSizeMb}
          onError={setError}
          onPick={([p]) => handlePick(p)}
        >
          Escolher PDF
        </FilePicker>
        {error && <p role="alert" className="text-danger text-xs">{error}</p>}
        <p className="text-text-muted text-xs text-center">
          Mostra o PDF como ele é — clique num texto pra editar no lugar.
        </p>
      </div>
    );
  }

  return (
    <div ref={toolRef} className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0 truncate text-text-primary text-sm font-medium">
          {sourceName}
        </span>
        <Button variant="ghost" size="sm" aria-label="Escolher outro PDF" onClick={reset}>
          <X aria-hidden="true" className="w-3.5 h-3.5" />
        </Button>
      </div>

      {loading || !spansByPage ? (
        <p className="text-text-muted text-xs text-center py-8">Lendo o texto do PDF…</p>
      ) : (
        <>
          <PdfInlineEditor
            path={sourcePath}
            spansByPage={spansByPage}
            edited={edited}
            onEdit={handleEdit}
          />

          <Button
            variant="primary"
            className="w-full"
            onClick={handleSave}
            disabled={busy || edited.size === 0}
            loading={busy}
          >
            {busy
              ? "Salvando…"
              : edited.size === 0
                ? "Edite um texto pra salvar"
                : `Salvar PDF (${edited.size} ${edited.size === 1 ? "alteração" : "alterações"})`}
          </Button>

          <p className="text-text-muted text-[11px] text-center">
            Preenche de branco onde o texto antigo estava — pode aparecer um retângulo branco se o
            texto sentava sobre imagem/cor de fundo.
          </p>
        </>
      )}

      {error && <p role="alert" className="text-danger text-xs">{error}</p>}

      {resultPath && <ResultPanel paths={[resultPath]} />}
    </div>
  );
}

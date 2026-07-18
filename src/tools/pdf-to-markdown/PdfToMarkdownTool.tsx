import { useReducer, useCallback, useEffect, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { appReducer, INITIAL_STATE } from "../../types/conversion";
import type { FileItem, ConversionResult, SelectedFile } from "../../types/conversion";
import { useConversion } from "../../hooks/useConversion";
import { doclingInstalled, ensureDocling } from "../../services/conversionService";
import { DropZone } from "../../components/DropZone";
import { FileQueue } from "../../components/FileQueue";
import { MarkdownViewer } from "../../components/MarkdownViewer";
import { ActionBar } from "../../components/ActionBar";
import type { ToolProps } from "../registry";

function DoclingGate({ onReady }: { onReady: () => void }) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = listen<number>("docling-progress", (e) => setProgress(e.payload));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    setProgress(0);
    try {
      await ensureDocling();
      onReady();
    } catch (e) {
      setError(String(e));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 text-center space-y-3">
      <p className="text-text-primary text-sm font-medium">Módulo PDF → Markdown</p>
      <p className="text-text-muted text-xs">
        A conversão de PDF usa o Docling (OCR e layout), baixado uma única vez (~700 MB).
        Requer internet nesta primeira vez.
      </p>
      {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}
      {downloading ? (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} role="progressbar" aria-valuenow={progress} />
          </div>
          <p className="text-text-muted text-[11px]">Baixando… {progress}%</p>
        </div>
      ) : (
        <button
          onClick={handleDownload}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Baixar módulo (~700 MB)
        </button>
      )}
    </div>
  );
}

export function PdfToMarkdownTool({ settings, addHistory }: ToolProps) {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  const [doclingReady, setDoclingReady] = useState<boolean | null>(null);

  useEffect(() => {
    doclingInstalled().then(setDoclingReady).catch(() => setDoclingReady(true));
  }, []);

  const handleComplete = useCallback(
    (fileItem: FileItem, result: ConversionResult) => {
      addHistory({
        id: crypto.randomUUID(),
        tool: "pdf-to-markdown",
        filename: fileItem.file.name,
        inputPath: fileItem.file.path,
        outputPath: result.success ? result.outputPath : undefined,
        durationMs: result.success ? result.durationMs : 0,
        timestamp: Date.now(),
        success: result.success,
        markdown: result.success ? result.markdown : "",
      });
    },
    [addHistory]
  );

  const { convertFile, saveFile, openContainingFolder } = useConversion(
    dispatch,
    handleComplete
  );

  function computeOutputPath(file: SelectedFile): string | undefined {
    if (settings.autoSaveNextToPdf) {
      const name = file.name.replace(/\.pdf$/i, ".md");
      const dir = file.path.replace(/[/\\][^/\\]+$/, "");
      return `${dir}\\${name}`;
    }
    if (settings.defaultOutputDir) {
      const name = file.name.replace(/\.pdf$/i, ".md");
      return `${settings.defaultOutputDir}\\${name}`;
    }
    return undefined;
  }

  function handleAddFiles(files: SelectedFile[]) {
    const newItems: FileItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      status: "pending",
      progressStep: 0,
    }));
    dispatch({ type: "ADD_FILES", files: newItems });
    if (!state.activeFileId && newItems.length > 0) {
      dispatch({ type: "SET_ACTIVE_FILE", id: newItems[0].id });
    }
  }

  async function handleConvertFile(id: string) {
    const item = state.files.find((f) => f.id === id);
    if (!item || item.status !== "pending") return;
    await convertFile(item, computeOutputPath(item.file));
  }

  async function handleConvertAll() {
    const pending = state.files.filter((f) => f.status === "pending");
    for (const item of pending) {
      await convertFile(item, computeOutputPath(item.file));
    }
  }

  async function handleSave() {
    const active = activeFile;
    if (!active || active.status !== "success" || !active.markdown) return;

    const suggestedName = active.file.name.replace(/\.pdf$/i, ".md");
    const savePath = await save({
      filters: [{ name: "Markdown", extensions: ["md"] }],
      defaultPath: settings.defaultOutputDir
        ? `${settings.defaultOutputDir}\\${suggestedName}`
        : suggestedName,
    });

    if (savePath) {
      await saveFile(active.id, savePath, active.markdown);
      if (settings.openFolderAfterSave) {
        await openContainingFolder(savePath);
      }
    }
  }

  async function handleOpenFolder() {
    const active = activeFile;
    if (!active || !active.savedPath) return;
    await openContainingFolder(active.savedPath);
  }

  function handleClearDone() {
    const done = state.files.filter(
      (f) => f.status === "success" || f.status === "error"
    );
    for (const f of done) {
      dispatch({ type: "REMOVE_FILE", id: f.id });
    }
  }

  const isConverting = state.files.some((f) => f.status === "converting");
  const activeFile = state.files.find((f) => f.id === state.activeFileId) ?? null;

  if (doclingReady === false) {
    return <DoclingGate onReady={() => setDoclingReady(true)} />;
  }

  return (
    <div className="space-y-5">
      {state.files.length === 0 ? (
        <DropZone onFiles={handleAddFiles} disabled={isConverting} />
      ) : (
        <DropZone onFiles={handleAddFiles} disabled={isConverting} compact />
      )}

      {state.files.length > 0 && (
        <FileQueue
          files={state.files}
          activeFileId={state.activeFileId}
          isConverting={isConverting}
          onSelectFile={(id) => dispatch({ type: "SET_ACTIVE_FILE", id })}
          onRemoveFile={(id) => dispatch({ type: "REMOVE_FILE", id })}
          onConvertFile={handleConvertFile}
          onConvertAll={handleConvertAll}
          onClearDone={handleClearDone}
        />
      )}

      {activeFile?.status === "success" && activeFile.markdown && (
        <>
          <div className="flex items-center gap-2">
            <p className="text-text-primary text-sm font-medium flex-1 truncate">
              {activeFile.file.name}
            </p>
            <span className="text-green-400 text-xs font-medium bg-green-950/30 border border-green-900/40 px-2 py-0.5 rounded-full">
              Convertido
            </span>
          </div>

          <MarkdownViewer
            content={activeFile.markdown}
            onChange={(md) =>
              dispatch({
                type: "UPDATE_FILE",
                id: activeFile.id,
                updates: { markdown: md },
              })
            }
            onCopy={() => {}}
            onClear={() => dispatch({ type: "REMOVE_FILE", id: activeFile.id })}
          />

          <ActionBar
            savedPath={activeFile.savedPath ?? null}
            durationMs={activeFile.durationMs ?? 0}
            onSave={handleSave}
            onOpenFolder={handleOpenFolder}
            onReset={() => dispatch({ type: "REMOVE_FILE", id: activeFile.id })}
          />
        </>
      )}

      {activeFile?.status === "error" && (
        <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-4 space-y-1">
          <p className="text-red-400 text-sm font-medium">Erro na conversão</p>
          <p className="text-text-muted text-xs">{activeFile.errorMessage}</p>
          <button
            onClick={() => {
              dispatch({
                type: "UPDATE_FILE",
                id: activeFile.id,
                updates: { status: "pending", errorMessage: undefined, errorCode: undefined },
              });
            }}
            className="mt-2 text-xs text-accent hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {state.files.length === 0 && (
        <p className="text-text-muted text-xs text-center">
          Todo o processamento ocorre localmente. Nenhum arquivo é enviado para a internet.
        </p>
      )}
    </div>
  );
}

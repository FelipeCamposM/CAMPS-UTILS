import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { SelectedFile } from "../types/conversion";
import { MAX_FILE_SIZE_MB } from "../types/settings";
import { useDragDrop } from "../hooks/useDragDrop";

interface DropZoneProps {
  onFiles: (files: SelectedFile[]) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function DropZone({ onFiles, disabled, compact }: DropZoneProps) {
  const [dropError, setDropError] = useState<string | null>(null);

  const { isDragging, handleDragOver, handleDragLeave, handleDrop } = useDragDrop({
    onFiles: (files) => { setDropError(null); onFiles(files); },
    onError: setDropError,
  });

  async function openFilePicker() {
    if (disabled) return;
    setDropError(null);

    const result = await open({
      multiple: true,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (!result) return;
    const paths = Array.isArray(result) ? result : [result];
    const files: SelectedFile[] = paths.map((p) => ({
      name: p.split(/[/\\]/).pop() ?? p,
      path: p,
      size: 0,
    }));
    if (files.length > 0) onFiles(files);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFilePicker();
    }
  }

  if (compact) {
    return (
      <div className="space-y-1">
        <button
          onClick={openFilePicker}
          disabled={disabled}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={[
            "w-full flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm transition-all",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
            isDragging
              ? "border-accent bg-accent/10 text-accent"
              : "border-border-subtle text-text-muted hover:border-border hover:text-text-secondary hover:bg-bg-elevated",
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          ].join(" ")}
        >
          <PlusIcon />
          {isDragging ? "Solte os PDFs aqui" : "Adicionar mais PDFs"}
        </button>
        {dropError && (
          <p role="alert" className="text-red-400 text-xs px-1">{dropError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Área de arrastar e soltar PDFs. Clique ou pressione Enter para selecionar arquivos."
        aria-disabled={disabled}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFilePicker}
        onKeyDown={handleKeyDown}
        className={[
          "rounded-xl border-2 border-dashed p-10 flex flex-col items-center justify-center gap-3 transition-all duration-150 cursor-pointer",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
          isDragging
            ? "border-accent bg-accent/10"
            : "border-border-subtle hover:border-border hover:bg-bg-elevated",
          disabled ? "opacity-50 cursor-not-allowed" : "",
        ].join(" ")}
      >
        <UploadIcon dragging={isDragging} />
        <div className="text-center space-y-1">
          <p className="text-text-primary text-sm font-medium">
            {isDragging ? "Solte os PDFs aqui" : "Arraste PDFs aqui"}
          </p>
          <p className="text-text-muted text-xs">
            ou clique para selecionar — múltiplos arquivos, máx. {MAX_FILE_SIZE_MB} MB cada
          </p>
        </div>
      </div>

      {dropError && (
        <p role="alert" className="text-red-400 text-xs px-1">{dropError}</p>
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
    </svg>
  );
}

function UploadIcon({ dragging }: { dragging: boolean }) {
  return (
    <svg
      className={`w-10 h-10 transition-colors ${dragging ? "text-accent" : "text-text-muted"}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  );
}

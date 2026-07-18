import type { FileItem } from "../types/conversion";
import { PROGRESS_STEPS } from "../hooks/useConversion";

interface FileQueueProps {
  files: FileItem[];
  activeFileId: string | null;
  isConverting: boolean;
  onSelectFile: (id: string) => void;
  onRemoveFile: (id: string) => void;
  onConvertFile: (id: string) => void;
  onConvertAll: () => void;
  onClearDone: () => void;
}

export function FileQueue({
  files,
  activeFileId,
  isConverting,
  onSelectFile,
  onRemoveFile,
  onConvertFile,
  onConvertAll,
  onClearDone,
}: FileQueueProps) {
  const pendingCount = files.filter((f) => f.status === "pending").length;
  const doneCount = files.filter((f) => f.status === "success" || f.status === "error").length;

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle bg-bg-elevated">
        <p className="text-text-primary text-sm font-medium flex-1">
          {files.length} arquivo{files.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-1.5">
          {doneCount > 0 && (
            <button
              onClick={onClearDone}
              disabled={isConverting}
              className="px-2.5 py-1 rounded-md text-xs text-text-muted hover:text-text-primary hover:bg-border-subtle transition-colors disabled:opacity-40"
            >
              Limpar concluídos
            </button>
          )}
          {pendingCount > 1 && (
            <button
              onClick={onConvertAll}
              disabled={isConverting}
              className="px-3 py-1 rounded-md text-xs font-medium bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Converter todos ({pendingCount})
            </button>
          )}
        </div>
      </div>

      {/* File list */}
      <ul className="divide-y divide-border-subtle">
        {files.map((item) => (
          <FileRow
            key={item.id}
            item={item}
            active={item.id === activeFileId}
            isConverting={isConverting}
            onSelect={() => onSelectFile(item.id)}
            onRemove={() => onRemoveFile(item.id)}
            onConvert={() => onConvertFile(item.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function FileRow({
  item,
  active,
  isConverting,
  onSelect,
  onRemove,
  onConvert,
}: {
  item: FileItem;
  active: boolean;
  isConverting: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onConvert: () => void;
}) {
  return (
    <li
      className={[
        "flex items-center gap-3 px-4 py-3 transition-colors",
        active ? "bg-bg-elevated" : "hover:bg-bg-elevated/40",
        (item.status === "success" || item.status === "error") ? "cursor-pointer" : "",
      ].join(" ")}
      onClick={() => {
        if (item.status === "success" || item.status === "error") onSelect();
      }}
    >
      <StatusDot status={item.status} />

      <div className="flex-1 min-w-0">
        <p className="text-text-primary text-sm truncate" title={item.file.name}>
          {item.file.name}
        </p>
        <StatusLabel item={item} />
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {item.status === "pending" && (
          <button
            onClick={(e) => { e.stopPropagation(); onConvert(); }}
            disabled={isConverting}
            className="px-2.5 py-1 rounded-md text-xs font-medium bg-accent/10 hover:bg-accent/20 text-accent transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Converter
          </button>
        )}

        {(item.status === "pending" || item.status === "error") && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            disabled={isConverting && item.status !== "error"}
            aria-label="Remover arquivo"
            className="p-1 rounded text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
          >
            <RemoveIcon />
          </button>
        )}
      </div>
    </li>
  );
}

function StatusLabel({ item }: { item: FileItem }) {
  if (item.status === "converting") {
    const step = PROGRESS_STEPS[item.progressStep] ?? PROGRESS_STEPS[0];
    return (
      <p className="text-accent text-xs flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        {step}
      </p>
    );
  }
  if (item.status === "success") {
    const secs = ((item.durationMs ?? 0) / 1000).toFixed(1);
    return <p className="text-green-400 text-xs">Concluído em {secs}s</p>;
  }
  if (item.status === "error") {
    return <p className="text-red-400 text-xs truncate">{item.errorMessage ?? "Erro na conversão"}</p>;
  }
  return <p className="text-text-muted text-xs">Pendente</p>;
}

function StatusDot({ status }: { status: FileItem["status"] }) {
  const colors: Record<FileItem["status"], string> = {
    pending: "bg-border",
    converting: "bg-accent animate-pulse",
    success: "bg-green-500",
    error: "bg-red-500",
  };
  return (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${colors[status]}`}
      aria-hidden="true"
    />
  );
}

function RemoveIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

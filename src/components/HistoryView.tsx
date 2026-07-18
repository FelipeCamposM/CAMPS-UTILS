import { useState } from "react";
import type { HistoryEntry } from "../types/conversion";
import { MarkdownViewer } from "./MarkdownViewer";

interface HistoryViewProps {
  history: HistoryEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export function HistoryView({
  history,
  selectedId,
  onSelect,
  onDelete,
  onClear,
}: HistoryViewProps) {
  const selected = history.find((e) => e.id === selectedId) ?? null;

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
        <ClockIcon />
        <p className="text-text-secondary text-sm font-medium">Nenhuma conversão ainda</p>
        <p className="text-text-muted text-xs">
          As conversões aparecerão aqui automaticamente
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-5 h-full">
      {/* List */}
      <div className="w-64 shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-text-secondary text-xs font-medium">
            {history.length} conversõe{history.length !== 1 ? "s" : ""}
          </p>
          <button
            onClick={onClear}
            className="text-text-muted text-xs hover:text-red-400 transition-colors"
          >
            Limpar tudo
          </button>
        </div>

        <ul className="space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
          {history.map((entry) => (
            <HistoryItem
              key={entry.id}
              entry={entry}
              active={entry.id === selectedId}
              onSelect={() => onSelect(entry.id)}
              onDelete={() => onDelete(entry.id)}
            />
          ))}
        </ul>
      </div>

      {/* Detail */}
      <div className="flex-1 min-w-0">
        {selected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-text-primary text-sm font-medium flex-1 truncate">
                {selected.filename}
              </p>
              <span
                className={[
                  "text-xs font-medium px-2 py-0.5 rounded-full border",
                  selected.success
                    ? "text-green-400 bg-green-950/30 border-green-900/40"
                    : "text-red-400 bg-red-950/30 border-red-900/40",
                ].join(" ")}
              >
                {selected.success ? "Sucesso" : "Erro"}
              </span>
            </div>
            <p className="text-text-muted text-xs">
              {formatDate(selected.timestamp)}
              {selected.success && ` · ${(selected.durationMs / 1000).toFixed(1)}s`}
            </p>

            {selected.success && selected.markdown ? (
              <MarkdownViewer
                content={selected.markdown}
                onChange={() => {}}
                onCopy={() => {}}
                onClear={() => {}}
              />
            ) : (
              <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 text-center">
                <p className="text-text-muted text-sm">Sem conteúdo disponível</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-center">
            <p className="text-text-muted text-sm">
              Selecione uma conversão para ver o resultado
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryItem({
  entry,
  active,
  onSelect,
  onDelete,
}: {
  entry: HistoryEntry;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <li
      className={[
        "group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
        active ? "bg-bg-elevated" : "hover:bg-bg-elevated/60",
      ].join(" ")}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          entry.success ? "bg-green-500" : "bg-red-500"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className="text-text-primary text-xs font-medium truncate">{entry.filename}</p>
        <p className="text-text-muted text-[10px]">{formatDate(entry.timestamp)}</p>
      </div>
      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="Remover do histórico"
          className="p-0.5 rounded text-text-muted hover:text-red-400 transition-colors"
        >
          <TrashIcon />
        </button>
      )}
    </li>
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Agora mesmo";
  if (diffMins < 60) return `Há ${diffMins}min`;
  if (diffHours < 24) return `Há ${diffHours}h`;
  if (diffDays < 7) return `Há ${diffDays} dia${diffDays !== 1 ? "s" : ""}`;

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function ClockIcon() {
  return (
    <svg className="w-8 h-8 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  );
}

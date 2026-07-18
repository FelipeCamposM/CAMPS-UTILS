interface ActionBarProps {
  savedPath: string | null;
  durationMs: number;
  onSave: () => void;
  onOpenFolder: () => void;
  onReset: () => void;
}

export function ActionBar({
  savedPath,
  durationMs,
  onSave,
  onOpenFolder,
  onReset,
}: ActionBarProps) {
  const seconds = (durationMs / 1000).toFixed(1);

  return (
    <div className="space-y-3">
      {savedPath ? (
        <div className="flex items-center gap-2 rounded-lg bg-green-950/20 border border-green-900/40 px-4 py-3">
          <CheckIcon />
          <div className="min-w-0 flex-1">
            <p className="text-green-400 text-sm font-medium">Arquivo salvo</p>
            <p className="text-text-muted text-xs truncate" title={savedPath}>
              {savedPath}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-text-muted text-xs text-center">
          Conversão concluída em {seconds}s — escolha onde salvar
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        {!savedPath && (
          <button
            onClick={onSave}
            className="flex-1 min-w-[140px] py-2.5 px-4 rounded-lg text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Salvar .md
          </button>
        )}

        {savedPath && (
          <button
            onClick={onOpenFolder}
            className="flex-1 min-w-[140px] py-2.5 px-4 rounded-lg text-sm font-medium bg-bg-elevated hover:bg-border-subtle text-text-primary border border-border-subtle transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Abrir pasta
          </button>
        )}

        <button
          onClick={onReset}
          className="flex-1 min-w-[140px] py-2.5 px-4 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary border border-border-subtle hover:border-border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Converter outro PDF
        </button>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-green-400 shrink-0"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

interface ErrorDisplayProps {
  message: string;
  errorCode?: string;
  onRetry?: () => void;
  onReset: () => void;
}

export function ErrorDisplay({ message, onRetry, onReset }: ErrorDisplayProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-900/40 bg-red-950/20 p-6 space-y-4"
    >
      <div className="flex gap-3">
        <ErrorIcon />
        <div className="space-y-1">
          <p className="text-red-400 font-medium text-sm">Erro na conversão</p>
          <p className="text-text-secondary text-sm">{message}</p>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-bg-elevated hover:bg-border-subtle text-text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Tentar novamente
          </button>
        )}
        <button
          onClick={onReset}
          className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Escolher outro arquivo
        </button>
      </div>
    </div>
  );
}

function ErrorIcon() {
  return (
    <svg
      className="w-5 h-5 text-red-400 shrink-0 mt-0.5"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
        clipRule="evenodd"
      />
    </svg>
  );
}

interface ConvertButtonProps {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

export function ConvertButton({ disabled, loading, onClick }: ConvertButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      className={[
        "w-full py-3 px-6 rounded-lg font-medium text-sm transition-all duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2",
        disabled || loading
          ? "bg-bg-elevated text-text-muted cursor-not-allowed border border-border-subtle"
          : "bg-accent hover:bg-accent-hover text-white cursor-pointer border border-transparent shadow-sm",
      ].join(" ")}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <SpinnerIcon />
          Convertendo...
        </span>
      ) : (
        "Converter para Markdown"
      )}
    </button>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

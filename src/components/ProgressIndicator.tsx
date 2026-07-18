interface ProgressIndicatorProps {
  steps: string[];
  currentStep: number;
}

export function ProgressIndicator({ steps, currentStep }: ProgressIndicatorProps) {
  const label = steps[currentStep] ?? steps[0];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Conversão em andamento: ${label}`}
      className="flex flex-col items-center gap-6 py-8"
    >
      <div className="relative w-12 h-12">
        <svg
          className="animate-spin w-12 h-12 text-accent"
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="24"
            cy="24"
            r="20"
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeWidth="4"
          />
          <path
            d="M44 24a20 20 0 01-20 20"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="text-center space-y-1">
        <p className="text-text-primary font-medium text-sm">{label}</p>
        <p className="text-text-muted text-xs">Processamento local — pode levar alguns minutos</p>
      </div>

      <div className="flex gap-1.5" aria-hidden="true">
        {steps.map((_, i) => (
          <span
            key={i}
            className={[
              "h-1 rounded-full transition-all duration-500",
              i <= currentStep
                ? "w-6 bg-accent"
                : "w-3 bg-border",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}

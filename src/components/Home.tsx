import { CATEGORY_ORDER, CATEGORY_LABELS, toolsByCategory } from "../tools/registry";

interface HomeProps {
  onSelect: (id: string) => void;
}

export function Home({ onSelect }: HomeProps) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-text-primary text-xl font-semibold">CAMPS-UTILS</h1>
        <p className="text-text-muted text-sm">
          Ferramentas de conversão locais. Escolha uma ferramenta para começar.
        </p>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const tools = toolsByCategory(category);
        if (tools.length === 0) return null;
        return (
          <section key={category} className="space-y-3">
            <h2 className="text-text-secondary text-xs font-medium uppercase tracking-wider">
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => onSelect(tool.id)}
                  aria-label={`Abrir ${tool.name}`}
                  className="flex items-start gap-3 rounded-xl border border-border-subtle bg-bg-surface p-4 text-left hover:border-border hover:bg-bg-elevated transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span className="w-8 h-8 shrink-0 rounded-lg bg-accent/20 text-accent p-1.5">
                    {tool.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-text-primary text-sm font-medium">{tool.name}</span>
                    <span className="block text-text-muted text-xs">{tool.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

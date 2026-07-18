import { CATEGORY_ORDER, CATEGORY_LABELS, toolsByCategory } from "../tools/registry";

interface SidebarProps {
  activeToolId: string | null;
  showHistory: boolean;
  onHome: () => void;
  onSelectTool: (id: string) => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  activeToolId,
  showHistory,
  onHome,
  onSelectTool,
  onOpenHistory,
  onOpenSettings,
}: SidebarProps) {
  const atHome = activeToolId === null && !showHistory;

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-bg-surface border-r border-border-subtle h-screen sticky top-0">
      {/* Logo */}
      <button
        onClick={onHome}
        className="px-4 py-5 border-b border-border-subtle text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
            <LogoIcon />
          </div>
          <div>
            <p className="text-text-primary text-xs font-semibold leading-tight">CAMPS-UTILS</p>
            <p className="text-text-muted text-[10px] leading-tight">Utilitários locais</p>
          </div>
        </div>
      </button>

      {/* Nav */}
      <nav className="px-2 py-3 flex-1 min-h-0 overflow-y-auto space-y-3">
        <NavItem active={atHome} onClick={onHome} icon={<HomeIcon />} label="Início" />

        {CATEGORY_ORDER.map((category) => {
          const tools = toolsByCategory(category);
          if (tools.length === 0) return null;
          return (
            <div key={category} className="space-y-0.5">
              <p className="text-text-muted text-[10px] font-medium uppercase tracking-wider px-3 pt-1">
                {CATEGORY_LABELS[category]}
              </p>
              {tools.map((tool) => (
                <NavItem
                  key={tool.id}
                  active={activeToolId === tool.id}
                  onClick={() => onSelectTool(tool.id)}
                  icon={<span className="w-4 h-4 block">{tool.icon}</span>}
                  label={tool.name}
                />
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-border-subtle space-y-0.5">
        <NavItem active={showHistory} onClick={onOpenHistory} icon={<HistoryIcon />} label="Histórico" />
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <GearIcon />
          Configurações
        </button>
      </div>
    </aside>
  );
}

function NavItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
        active
          ? "bg-bg-elevated text-text-primary font-medium"
          : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50",
      ].join(" ")}
    >
      <span className={active ? "text-accent" : ""}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function LogoIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 011.262.125l1.668 1.667a1 1 0 01.125 1.263l-.834 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 01.804.98v2.361a1 1 0 01-.804.98l-1.473.295a6.95 6.95 0 01-.587 1.416l.834 1.25a1 1 0 01-.125 1.262l-1.668 1.668a1 1 0 01-1.263.125l-1.25-.834a6.953 6.953 0 01-1.416.587l-.294 1.473a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.295-1.473a6.957 6.957 0 01-1.416-.587l-1.25.834a1 1 0 01-1.262-.125L1.95 15.348a1 1 0 01-.125-1.263l.834-1.25a6.957 6.957 0 01-.587-1.416l-1.473-.294A1 1 0 01.795 10.2V7.839a1 1 0 01.804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 01.125-1.262L4.617 1.97a1 1 0 011.263-.126l1.25.834a6.957 6.957 0 011.416-.587L8.84 1.804zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  );
}

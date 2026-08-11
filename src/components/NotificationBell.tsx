import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNotifications } from "../hooks/useNotifications";
import type { SettingsSection } from "../hooks/useNotifications";

/**
 * Sino de pendências no topo da barra lateral. Só avisa e leva até
 * Configurações — quem instala é o card de lá (ver `useNotifications`).
 */
export function NotificationBell({
  onOpenSettings,
}: {
  onOpenSettings: (secao: SettingsSection) => void;
}) {
  const itens = useNotifications();
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora e no Esc — um popover que só fecha no próprio botão
  // vira armadilha quando o usuário já seguiu para outra coisa.
  useEffect(() => {
    if (!aberto) return;

    function onDown(e: PointerEvent) {
      if (!caixaRef.current?.contains(e.target as Node)) setAberto(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }

    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [aberto]);

  const total = itens.length;
  const temPendencia = total > 0;

  return (
    <div ref={caixaRef} className="relative shrink-0">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label={
          temPendencia
            ? `Notificações: ${total} pendência${total > 1 ? "s" : ""}`
            : "Notificações: nenhuma pendência"
        }
        aria-expanded={aberto}
        aria-haspopup="dialog"
        className={[
          "relative p-1.5 !rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
          temPendencia
            ? "text-accent hover:bg-overlay/[0.07]"
            : "text-text-muted hover:text-text-secondary hover:bg-overlay/[0.07]",
        ].join(" ")}
      >
        <Bell className={`w-4 h-4 ${temPendencia ? "bell-ring" : ""}`} aria-hidden="true" />

        {temPendencia && (
          <span
            aria-hidden="true"
            className="badge-pulse absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-danger text-white text-[9px] font-bold leading-[15px] text-center"
          >
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-label="Notificações"
          className="popover absolute left-0 top-full mt-2 w-64 z-50 p-2 space-y-1"
        >
          {total === 0 ? (
            <p className="text-text-muted text-xs px-2 py-3 text-center">
              Nada pendente por aqui.
            </p>
          ) : (
            itens.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setAberto(false);
                  onOpenSettings(n.secao);
                }}
                className="glass-hover w-full text-left px-2.5 py-2 !rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="block text-text-primary text-xs font-medium">{n.titulo}</span>
                <span className="block text-text-muted text-[10px] leading-snug">{n.detalhe}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

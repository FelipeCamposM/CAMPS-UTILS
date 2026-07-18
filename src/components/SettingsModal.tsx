import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { AppSettings } from "../types/settings";

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (updates: Partial<AppSettings>) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [local, setLocal] = useState<AppSettings>({ ...settings });

  function handleChange<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  async function pickFolder() {
    const result = await open({ directory: true, multiple: false });
    if (typeof result === "string") {
      handleChange("defaultOutputDir", result);
    }
  }

  function handleSave() {
    onSave(local);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Configurações"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-bg-surface rounded-2xl border border-border-subtle shadow-xl w-full max-w-md p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-text-primary font-semibold text-base">Configurações</h2>
          <button
            onClick={onClose}
            aria-label="Fechar configurações"
            className="text-text-muted hover:text-text-primary transition-colors rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-5">
          {/* Default output dir */}
          <div className="space-y-2">
            <label className="text-text-secondary text-sm font-medium" htmlFor="output-dir">
              Pasta padrão de saída
            </label>
            <div className="flex gap-2">
              <input
                id="output-dir"
                type="text"
                value={local.defaultOutputDir}
                onChange={(e) => handleChange("defaultOutputDir", e.target.value)}
                placeholder="Mesma pasta do PDF"
                className="flex-1 min-w-0 bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
              />
              <button
                onClick={pickFolder}
                className="px-3 py-2 rounded-lg border border-border-subtle bg-bg-elevated text-text-secondary hover:text-text-primary hover:border-border text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                Procurar
              </button>
            </div>
          </div>

          {/* Auto save next to PDF */}
          <Toggle
            id="auto-save"
            label="Salvar automaticamente ao lado do PDF"
            description="Salva o .md na mesma pasta do PDF sem pedir destino."
            checked={local.autoSaveNextToPdf}
            onChange={(v) => handleChange("autoSaveNextToPdf", v)}
          />

          {/* Open folder after save */}
          <Toggle
            id="open-folder"
            label="Abrir pasta após salvar"
            description="Abre o Explorer na pasta do arquivo salvo."
            checked={local.openFolderAfterSave}
            onChange={(v) => handleChange("openFolderAfterSave", v)}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Salvar
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary border border-border-subtle transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-3 items-start">
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={[
          "relative w-10 h-5 rounded-full transition-colors shrink-0 mt-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
          checked ? "bg-accent" : "bg-border",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer space-y-0.5">
        <p className="text-text-primary text-sm">{label}</p>
        <p className="text-text-muted text-xs">{description}</p>
      </label>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

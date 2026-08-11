import { useState, useCallback, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { AppSettings } from "../types/settings";
import { DEFAULT_SETTINGS } from "../types/settings";
import { loadSettings, saveSettings } from "../services/settingsService";
import { setMotionLevel } from "../lib/motion";
import { isBackgroundEffect } from "../components/backgrounds/registry";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  // Fora de effect de propósito: os hooks de GSAP dos filhos rodam logo após
  // este render e precisam do nível já atualizado.
  setMotionLevel(settings.animations);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
    saveSettings({ ...DEFAULT_SETTINGS });
  }, []);

  // Tema: o atributo data-theme no <html> troca as CSS vars (ver index.css).
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme !== "sistema") {
      root.dataset.theme = settings.theme;
      return;
    }
    const media = window.matchMedia?.("(prefers-color-scheme: light)");
    const apply = () => {
      root.dataset.theme = media?.matches ? "claro" : "escuro";
    };
    apply();
    media?.addEventListener("change", apply);
    return () => media?.removeEventListener("change", apply);
  }, [settings.theme]);

  // Aparência: fundo, intensidade do vidro e movimento (ver index.css).
  useEffect(() => {
    const root = document.documentElement;
    // Efeitos animados são desenhados pelo <AppBackground>, não pelo CSS —
    // um data-bg genérico desliga as camadas do body (ver index.css).
    root.dataset.bg = isBackgroundEffect(settings.background) ? "efeito" : settings.background;
    root.dataset.glass = settings.glass;
    root.dataset.motion = settings.animations;
    root.style.setProperty("--app-bg-opacity", String(settings.backgroundOpacity / 100));
    root.style.setProperty("--app-bg-blur", `${settings.backgroundBlur}px`);

    if (settings.background === "custom" && settings.backgroundPath) {
      // Aspas simples na url() evitam quebrar o valor com caminhos que tenham ".
      const src = convertFileSrc(settings.backgroundPath).replace(/'/g, "%27");
      root.style.setProperty("--app-bg-image", `url('${src}')`);
    } else {
      // Deixa o preset de [data-bg] no index.css valer.
      root.style.removeProperty("--app-bg-image");
    }
  }, [
    settings.background,
    settings.backgroundPath,
    settings.backgroundOpacity,
    settings.backgroundBlur,
    settings.glass,
    settings.animations,
  ]);

  return { settings, updateSettings, resetSettings };
}

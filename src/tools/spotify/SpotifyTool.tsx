import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { downloadSpotify, openFolder } from "../../services/conversionService";
import type { ToolProps } from "../registry";

const CREDS_KEY = "spotify-creds";

function loadCreds(): { id: string; secret: string } {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignora
  }
  return { id: "", secret: "" };
}

export function SpotifyTool({ addHistory }: ToolProps) {
  const [url, setUrl] = useState("");
  const [kbps, setKbps] = useState(192);
  const [clientId, setClientId] = useState(() => loadCreds().id);
  const [clientSecret, setClientSecret] = useState(() => loadCreds().secret);
  const [showCreds, setShowCreds] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = listen<number>("tool-progress", (e) => setProgress(e.payload));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  function saveCreds(id: string, secret: string) {
    setClientId(id);
    setClientSecret(secret);
    try {
      localStorage.setItem(CREDS_KEY, JSON.stringify({ id, secret }));
    } catch {
      // ignora
    }
  }

  async function handleDownload() {
    if (!url.trim() || busy) return;
    const outputDir = await open({ directory: true, title: "Escolher pasta de destino" });
    if (typeof outputDir !== "string") return;

    setBusy(true);
    setError(null);
    setOutputs([]);
    setProgress(0);
    try {
      const result = await downloadSpotify(url.trim(), outputDir, kbps, clientId, clientSecret);
      addHistory({
        id: crypto.randomUUID(),
        tool: "spotify",
        filename: url.trim(),
        inputPath: url.trim(),
        outputPath: result.outputs?.[0],
        durationMs: result.durationMs ?? 0,
        timestamp: Date.now(),
        success: result.success,
      });
      if (result.success) setOutputs(result.outputs ?? []);
      else setError(result.message ?? "Falha no download.");
    } catch {
      setError("Falha ao iniciar o download.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="sp-url" className="text-text-secondary text-xs font-medium">
          URL do Spotify (faixa, álbum ou playlist)
        </label>
        <input
          id="sp-url"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://open.spotify.com/playlist/…"
          className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="sp-kbps" className="text-text-secondary text-xs font-medium">
          Qualidade do áudio: {kbps} kbps
        </label>
        <input id="sp-kbps" type="range" min={64} max={320} step={32} value={kbps}
          onChange={(e) => setKbps(Number(e.target.value))} className="w-full accent-accent" />
      </div>

      {/* Credenciais do Spotify */}
      <div className="rounded-lg border border-border-subtle bg-bg-surface">
        <button
          onClick={() => setShowCreds((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span>
            Credenciais do Spotify
            {clientId && clientSecret ? (
              <span className="text-green-400"> ✓ configuradas</span>
            ) : (
              <span className="text-amber-400"> — recomendado</span>
            )}
          </span>
          <span>{showCreds ? "▲" : "▼"}</span>
        </button>
        {showCreds && (
          <div className="px-3 pb-3 space-y-2">
            <p className="text-text-muted text-[11px] leading-relaxed">
              Sem credenciais próprias, o app usa uma chave compartilhada que atinge limite de
              requisições rápido. Crie um app grátis em{" "}
              <span className="text-accent">developer.spotify.com/dashboard</span> e cole o
              Client ID e Client Secret abaixo (salvos localmente).
            </p>
            <input
              type="text"
              value={clientId}
              onChange={(e) => saveCreds(e.target.value, clientSecret)}
              placeholder="Client ID"
              className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            />
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => saveCreds(clientId, e.target.value)}
              placeholder="Client Secret"
              className="w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            />
          </div>
        )}
      </div>

      <button
        onClick={handleDownload}
        disabled={!url.trim() || busy}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {busy ? "Baixando…" : "Baixar e salvar…"}
      </button>

      {busy && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-bg-elevated overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} role="progressbar" aria-valuenow={progress} />
          </div>
          <p className="text-text-muted text-[11px] text-center">{progress}%</p>
        </div>
      )}

      {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}

      {outputs.length > 0 && (
        <div className="rounded-xl border border-green-900/40 bg-green-950/20 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-green-400 text-xs font-medium">{outputs.length} faixa(s) baixada(s)</p>
            <button onClick={() => openFolder(outputs[0])} className="text-accent text-xs hover:underline">Abrir pasta</button>
          </div>
          <ul className="text-text-muted text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
            {outputs.map((o) => <li key={o} className="truncate">{o}</li>)}
          </ul>
        </div>
      )}

      <p className="text-text-muted text-[11px]">
        As faixas vêm do YouTube casadas pelos metadados do Spotify — a correspondência pode variar.
        Baixe apenas conteúdo que você tem direito de baixar.
      </p>
    </div>
  );
}

import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { hashFiles } from "../../services/conversionService";
import type { HashResult } from "../../services/conversionService";

type Algo = "md5" | "sha1" | "sha256";
const ALGOS: Algo[] = ["md5", "sha1", "sha256"];

export function HashTool() {
  const [files, setFiles] = useState<string[]>([]);
  const [algo, setAlgo] = useState<Algo>("sha256");
  const [results, setResults] = useState<HashResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickFiles() {
    const picked = await open({ multiple: true });
    if (!picked) return;
    setFiles(Array.isArray(picked) ? picked : [picked]);
    setResults([]);
    setError(null);
  }

  async function handleHash() {
    if (files.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      setResults(await hashFiles(files, algo));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function name(path: string) {
    return path.split(/[/\\]/).pop() ?? path;
  }

  return (
    <div className="space-y-4">
      <button
        onClick={pickFiles}
        className="w-full rounded-lg border border-dashed border-border-subtle px-4 py-3 text-sm text-text-muted hover:border-border hover:text-text-secondary hover:bg-bg-elevated transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : "Selecionar arquivos"}
      </button>

      <div className="flex gap-2">
        {ALGOS.map((a) => (
          <button
            key={a}
            onClick={() => setAlgo(a)}
            className={[
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium uppercase transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
              algo === a
                ? "bg-accent text-white"
                : "border border-border-subtle text-text-secondary hover:bg-bg-elevated",
            ].join(" ")}
          >
            {a}
          </button>
        ))}
      </div>

      <button
        onClick={handleHash}
        disabled={files.length === 0 || busy}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {busy ? "Calculando…" : "Calcular hash"}
      </button>

      {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.path} className="rounded-lg border border-border-subtle bg-bg-surface p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-text-primary text-xs font-medium truncate" title={r.path}>
                  {name(r.path)}
                </p>
                <button
                  onClick={() => navigator.clipboard.writeText(r.hash)}
                  className="text-accent text-xs hover:underline shrink-0"
                >
                  Copiar
                </button>
              </div>
              <p className="text-text-muted text-[11px] font-mono break-all">{r.hash}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

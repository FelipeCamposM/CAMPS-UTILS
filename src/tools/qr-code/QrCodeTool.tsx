import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { generateQr, openFolder } from "../../services/conversionService";

export function QrCodeTool() {
  const [text, setText] = useState("");
  const [size, setSize] = useState(512);
  const [busy, setBusy] = useState(false);
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!text.trim() || busy) return;
    setError(null);
    setResultPath(null);

    const outPath = await save({
      filters: [{ name: "PNG", extensions: ["png"] }],
      defaultPath: "qrcode.png",
    });
    if (!outPath) return;

    setBusy(true);
    try {
      const path = await generateQr(text, outPath, size);
      setResultPath(path);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="qr-text" className="text-text-secondary text-xs font-medium">
          Texto ou URL
        </label>
        <textarea
          id="qr-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="https://exemplo.com"
          className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent resize-y"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="qr-size" className="text-text-secondary text-xs font-medium">
          Tamanho: {size}px
        </label>
        <input
          id="qr-size"
          type="range"
          min={128}
          max={1024}
          step={64}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-full accent-accent"
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={!text.trim() || busy}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {busy ? "Gerando…" : "Gerar QR code e salvar…"}
      </button>

      {error && <p role="alert" className="text-red-400 text-xs">{error}</p>}

      {resultPath && (
        <div className="rounded-xl border border-green-900/40 bg-green-950/20 px-4 py-3 flex items-center justify-between gap-2">
          <p className="text-green-400 text-xs truncate">Salvo: {resultPath}</p>
          <button
            onClick={() => openFolder(resultPath)}
            className="text-accent text-xs hover:underline shrink-0"
          >
            Abrir pasta
          </button>
        </div>
      )}
    </div>
  );
}

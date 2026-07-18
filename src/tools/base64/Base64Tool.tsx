import { useState } from "react";

function encodeBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

function decodeBase64(text: string): string {
  return decodeURIComponent(escape(atob(text.trim())));
}

export function Base64Tool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(mode: "encode" | "decode") {
    setError(null);
    try {
      setOutput(mode === "encode" ? encodeBase64(input) : decodeBase64(input));
    } catch {
      setOutput("");
      setError(mode === "decode" ? "Base64 inválido." : "Não foi possível codificar.");
    }
  }

  async function copyOutput() {
    if (output) await navigator.clipboard.writeText(output);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="b64-input" className="text-text-secondary text-xs font-medium">
          Entrada
        </label>
        <textarea
          id="b64-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={5}
          placeholder="Cole o texto ou o Base64 aqui…"
          className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent resize-y"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => run("encode")}
          className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Codificar
        </button>
        <button
          onClick={() => run("decode")}
          className="flex-1 rounded-lg border border-border-subtle px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-elevated transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Decodificar
        </button>
      </div>

      {error && (
        <p role="alert" className="text-red-400 text-xs">{error}</p>
      )}

      {output && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="b64-output" className="text-text-secondary text-xs font-medium">
              Resultado
            </label>
            <button
              onClick={copyOutput}
              className="text-accent text-xs hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              Copiar
            </button>
          </div>
          <textarea
            id="b64-output"
            aria-label="Resultado Base64"
            value={output}
            readOnly
            rows={5}
            className="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary resize-y"
          />
        </div>
      )}
    </div>
  );
}

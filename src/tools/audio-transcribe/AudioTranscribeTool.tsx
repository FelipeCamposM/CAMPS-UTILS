import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { saveMarkdown, transcribe } from "../../services/conversionService";
import type { WhisperModelSize } from "../../services/conversionService";
import type { ToolProps } from "../registry";
import { useToolEnter } from "../../lib/motion";
import { useToolProgress } from "../../hooks/useToolProgress";
import { Button, FilePicker, ResultPanel, Textarea } from "../../components/ui";
import { CamposTranscricao } from "../../components/CamposTranscricao";
import { ProgressoTranscricao } from "../../components/ProgressoTranscricao";
import { MediaPreview } from "../../components/MediaPreview";

const MIDIA_EXTS = [
  "mp3", "wav", "m4a", "flac", "ogg", "aac", "opus", "wma",
  "mp4", "mkv", "mov", "avi", "webm", "m4v",
];

function nome(p: string) {
  return p.split(/[/\\]/).pop() ?? p;
}

/**
 * Transcreve áudio/vídeo em texto corrido (.txt). Mesmo motor da Legenda
 * automática — o `transcribe` já devolve os trechos na memória; aqui eles só
 * viram parágrafo em vez de bloco com tempo.
 */
export function AudioTranscribeTool({ settings, addHistory }: ToolProps) {
  const [input, setInput] = useState<string | null>(null);
  const [idioma, setIdioma] = useState("pt");
  const [modelo, setModelo] = useState<WhisperModelSize>(settings.whisperModel);
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const { progresso, etapa, zerar } = useToolProgress();
  const toolRef = useToolEnter();

  async function transcrever() {
    if (!input || busy) return;
    setBusy(true);
    setErro(null);
    setResultado(null);
    setTexto("");
    zerar();
    const inicio = Date.now();
    try {
      const r = await transcribe({
        inputPath: input,
        // O Python exige um destino de legenda; este é descartado.
        outputPath: `${input}.rascunho.srt`,
        language: idioma || undefined,
        model: modelo,
        format: "srt",
      });
      if (!r.success) {
        setErro(r.message ?? "Falha ao transcrever.");
        return;
      }
      setTexto((r.segments ?? []).map((s) => s.text.trim()).filter(Boolean).join(" "));
      addHistory({
        id: crypto.randomUUID(),
        tool: "audio-transcribe",
        filename: nome(input),
        inputPath: input,
        durationMs: Date.now() - inicio,
        timestamp: Date.now(),
        success: true,
      });
    } catch {
      setErro("Falha ao iniciar a transcrição.");
    } finally {
      setBusy(false);
    }
  }

  async function salvar() {
    if (!input || !texto) return;
    const base = nome(input).replace(/\.[^.]+$/, "");
    const destino = await save({
      filters: [{ name: "Texto", extensions: ["txt"] }],
      defaultPath: settings.defaultOutputDir
        ? `${settings.defaultOutputDir}\\${base}.txt`
        : `${base}.txt`,
    });
    if (!destino) return;
    try {
      await saveMarkdown(destino, texto);
      setResultado(destino);
    } catch {
      setErro("Falha ao salvar o texto.");
    }
  }

  async function copiar() {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <div ref={toolRef} className="space-y-4">
      <FilePicker
        accept={MIDIA_EXTS}
        filterName="Áudio ou vídeo"
        maxSizeMb={settings.maxFileSizeMb}
        onError={setErro}
        onPick={([p]) => { setInput(p); setTexto(""); setResultado(null); setErro(null); }}
        size="md"
        className="w-full"
      >
        {input ? `Trocar arquivo — ${nome(input)}` : "Escolher áudio ou vídeo"}
      </FilePicker>

      {input && (
        <MediaPreview
          path={input}
          onClear={() => { setInput(null); setTexto(""); setResultado(null); setErro(null); }}
        />
      )}

      <div className="glass rounded-glass p-4 space-y-3">
        <CamposTranscricao
          prefixo="transc"
          idioma={idioma}
          setIdioma={setIdioma}
          modelo={modelo}
          setModelo={setModelo}
        />
      </div>

      <Button
        variant={texto ? "glass" : "primary"}
        className="w-full"
        onClick={transcrever}
        disabled={!input}
        loading={busy}
      >
        {busy ? "Transcrevendo…" : texto ? "Transcrever de novo" : "Transcrever"}
      </Button>

      {busy && (
        <ProgressoTranscricao
          progresso={progresso}
          etapa={etapa}
          aviso="A transcrição roda no processador e costuma levar tempo parecido com a duração do arquivo."
        />
      )}

      {erro && <p role="alert" className="text-danger text-xs">{erro}</p>}

      {texto && (
        <>
          <Textarea
            aria-label="Texto transcrito"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={12}
            className="w-full"
          />
          <div className="flex gap-2">
            <Button variant="glass" className="flex-1" onClick={copiar}>
              {copiado ? "Copiado!" : "Copiar texto"}
            </Button>
            <Button variant="primary" className="flex-1" onClick={salvar}>
              Salvar .txt…
            </Button>
          </div>
        </>
      )}

      {resultado && <ResultPanel paths={[resultado]} label="Texto salvo" />}

      <p className="text-text-muted text-[11px]">
        Tudo roda no seu computador. Nome próprio, sigla e número costumam sair errados — revise
        antes de usar. Para legenda com tempo (SRT/VTT), use <b>Legenda automática</b>.
      </p>
    </div>
  );
}

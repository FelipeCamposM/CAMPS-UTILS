import { Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import {
  captureSite,
  createZip,
  openFolder,
} from "../../services/conversionService";
import type {
  CaptureOptions,
  CaptureResult,
  CaptureScope,
} from "../../services/conversionService";
import type { ToolProps } from "../registry";
import { useToolEnter } from "../../lib/motion";
import { useToolProgress } from "../../hooks/useToolProgress";
import { useCaptureEvents } from "../../hooks/useCaptureEvents";
import { ProgressoTranscricao } from "../../components/ProgressoTranscricao";
import { Button, Field, Input, SegmentedControl, Slider } from "../../components/ui";
import { CrawlQueueList } from "./CrawlQueueList";

const ESCOPOS: { value: CaptureScope; label: string }[] = [
  { value: "dominio", label: "Domínio inteiro" },
  { value: "pagina", label: "Somente esta página" },
  { value: "pagina_subpaginas", label: "Esta página + subpáginas" },
];

const OPCOES_IMAGENS: CaptureOptions = {
  texto: false,
  markdown: false,
  html: false,
  links: false,
  screenshot: false,
  metadados: false,
  explorarTabsAccordions: false,
  scrollAutomatico: false,
  assets: true,
  somenteImagens: true,
};

/** Resposta de falha que o sidecar pode emitir no lugar de um `CaptureResult`. */
type CaptureFailure = { success: false; errorCode?: string; message: string };

function ehFalha(r: CaptureResult | CaptureFailure): r is CaptureFailure {
  return (r as CaptureFailure).success === false;
}

/**
 * Captura de imagens: mesmo crawler do "Capturar site", só que o resultado
 * traz somente as imagens do site (opcoes fixo, sem checkboxes) — pra remake
 * de site sem precisar pedir as imagens pro cliente.
 */
export function WebCaptureImagesTool({ addHistory }: ToolProps) {
  const [url, setUrl] = useState("");
  const [escopo, setEscopo] = useState<CaptureScope>("dominio");
  const [maxPaginas, setMaxPaginas] = useState("");
  const [concorrencia, setConcorrencia] = useState(5);

  const [capturando, setCapturando] = useState(false);
  const [zipando, setZipando] = useState(false);
  const [zipPath, setZipPath] = useState<string | null>(null);
  const [resultado, setResultado] = useState<CaptureResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const { progresso, etapa, zerar } = useToolProgress();
  const { paginas, zerar: zerarPaginas } = useCaptureEvents();

  async function capturar() {
    if (!url.trim() || capturando) return;
    setCapturando(true);
    setErro(null);
    setResultado(null);
    setZipPath(null);
    zerar();
    zerarPaginas();
    try {
      const r = await captureSite({
        url: url.trim(),
        escopo,
        opcoes: OPCOES_IMAGENS,
        maxPaginas: maxPaginas.trim() ? Number(maxPaginas) : null,
        concorrencia,
      });
      if (ehFalha(r)) {
        setErro(r.message ?? "Falha ao capturar as imagens.");
        return;
      }
      setResultado(r);
      addHistory({
        id: crypto.randomUUID(),
        tool: "web-capture-images",
        filename: url.trim(),
        inputPath: url.trim(),
        outputPath: r.outputDir,
        durationMs: r.durationMs,
        timestamp: Date.now(),
        success: r.falharam === 0,
      });
    } catch {
      setErro("Falha ao iniciar a captura de imagens.");
    } finally {
      setCapturando(false);
    }
  }

  async function baixarZip() {
    if (!resultado || zipando) return;
    const destino = await save({
      filters: [{ name: "ZIP", extensions: ["zip"] }],
      defaultPath: "imagens-site.zip",
    });
    if (!destino) return;

    setZipando(true);
    setErro(null);
    try {
      await createZip(resultado.outputDir, destino);
      setZipPath(destino);
    } catch {
      setErro("Falha ao gerar o ZIP.");
    } finally {
      setZipando(false);
    }
  }

  const toolRef = useToolEnter();

  return (
    <div ref={toolRef} className="space-y-4">
      <Field label="URL" htmlFor="web-capture-images-url">
        <Input
          id="web-capture-images-url"
          type="url"
          placeholder="https://exemplo.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={capturando}
        />
      </Field>

      <SegmentedControl
        label="Escopo"
        options={ESCOPOS}
        value={escopo}
        onChange={setEscopo}
        grow={false}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Máximo de páginas" htmlFor="web-capture-images-max" description="Vazio = sem limite">
          <Input
            id="web-capture-images-max"
            type="number"
            min={1}
            placeholder="Sem limite"
            value={maxPaginas}
            onChange={(e) => setMaxPaginas(e.target.value)}
            disabled={capturando}
          />
        </Field>

        <Slider
          id="web-capture-images-concorrencia"
          label="Concorrência"
          value={concorrencia}
          min={1}
          max={10}
          onChange={setConcorrencia}
          disabled={capturando}
        />
      </div>

      <Button
        variant="primary"
        className="w-full"
        onClick={capturar}
        disabled={!url.trim()}
        loading={capturando}
      >
        {capturando ? "Capturando…" : "Baixar imagens"}
      </Button>

      {capturando && (
        <ProgressoTranscricao
          progresso={progresso}
          etapa={etapa}
          aviso="Isto navega o site de verdade — sites grandes podem levar alguns minutos."
        />
      )}

      {paginas.length > 0 && <CrawlQueueList paginas={paginas} />}

      {erro && <p role="alert" className="text-danger text-xs">{erro}</p>}

      {resultado && (
        <section className="glass glass-success glass-sheen p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Resumo label="páginas encontradas" valor={resultado.encontradas} />
            <Resumo label="processadas" valor={resultado.processadas} />
            <Resumo label="falharam" valor={resultado.falharam} tom={resultado.falharam > 0 ? "danger" : undefined} />
            <Resumo label="imagens" valor={resultado.arquivos.assets} />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="glass" size="sm" onClick={() => openFolder(resultado.outputDir)}>
              Abrir pasta
            </Button>
            <Button variant="glass" size="sm" onClick={baixarZip} loading={zipando}>
              {zipando ? "Gerando ZIP…" : "Baixar ZIP"}
            </Button>
          </div>

          {zipPath && (
            <p className="text-success text-[11px] truncate" title={zipPath}>
              ZIP salvo em {zipPath}
            </p>
          )}
        </section>
      )}

      <p className="text-text-muted text-[11px] flex items-center gap-1.5">
        <ImageIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        A captura roda no seu computador com um navegador real — nada é enviado à nuvem.
      </p>
    </div>
  );
}

function Resumo({
  label,
  valor,
  tom,
}: {
  label: string;
  valor: number;
  tom?: "danger";
}) {
  return (
    <div className="glass-inset px-2.5 py-2">
      <p className={`text-sm font-medium ${tom === "danger" ? "text-danger" : "text-text-primary"}`}>
        {valor}
      </p>
      <p className="text-text-muted text-[11px]">{label}</p>
    </div>
  );
}

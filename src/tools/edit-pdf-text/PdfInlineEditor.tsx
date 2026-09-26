import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePdfDocument } from "../../hooks/usePdfDocument";
import type { PdfTextSpan } from "../../services/conversionService";
import { Button } from "../../components/ui";

const LARGURA_DISPLAY = 720;
const FONTE_PISO_PX = 6;

interface PdfInlineEditorProps {
  path: string;
  spansByPage: Map<number, PdfTextSpan[]>;
  edited: Map<string, string>;
  onEdit: (id: string, text: string) => void;
}

/**
 * Editor de uma página por vez: o canvas mostra o PDF exatamente como ele é
 * (pdf.js), e cada span de texto vira uma caixa clicável posicionada em cima
 * do pixel certo. Só vira caixa branca+editável quando está sendo editada ou
 * já tem edição pendente — o resto continua mostrando o canvas original por
 * baixo, sem nada duplicado.
 */
export function PdfInlineEditor({ path, spansByPage, edited, onEdit }: PdfInlineEditorProps) {
  const { pageCount, renderPage, getPageSize } = usePdfDocument(path);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeElRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelado = false;
    (async () => {
      await renderPage(page, canvasRef.current!, LARGURA_DISPLAY);
      const { widthPt } = await getPageSize(page);
      if (!cancelado && widthPt > 0) setScale(LARGURA_DISPLAY / widthPt);
    })();
    return () => {
      cancelado = true;
    };
  }, [path, page, renderPage, getPageSize]);

  useEffect(() => {
    setActiveId(null);
  }, [page]);

  const spans = spansByPage.get(page - 1) ?? [];

  function shrinkToFit(el: HTMLDivElement, tamanhoBasePx: number) {
    el.style.fontSize = `${tamanhoBasePx}px`;
    while (el.scrollHeight > el.clientHeight && parseFloat(el.style.fontSize) > FONTE_PISO_PX) {
      el.style.fontSize = `${parseFloat(el.style.fontSize) - 0.5}px`;
    }
  }

  function ativar(span: PdfTextSpan) {
    setActiveId(span.id);
  }

  function finalizarEdicao(span: PdfTextSpan) {
    const texto = activeElRef.current?.innerText.replace(/\n$/, "") ?? span.text;
    onEdit(span.id, texto);
    setActiveId(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Página anterior"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          <ChevronLeft aria-hidden="true" className="w-4 h-4" />
        </Button>
        <span className="text-text-secondary text-xs">
          Página {page} / {pageCount || "…"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Próxima página"
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          disabled={page >= pageCount}
        >
          <ChevronRight aria-hidden="true" className="w-4 h-4" />
        </Button>
      </div>

      <div className="glass-inset relative mx-auto" style={{ width: LARGURA_DISPLAY }}>
        <canvas ref={canvasRef} className="block w-full" />

        {spans.map((span) => {
          const [x0, y0, x1, y1] = span.bbox;
          const texto = edited.get(span.id) ?? span.text;
          const temEdicao = edited.has(span.id);
          const ativo = activeId === span.id;
          const mascarado = ativo || temEdicao;
          const tamanhoPx = span.size * scale;
          const fonte = {
            fontFamily:
              span.flags & 8 ? "monospace" : span.flags & 4 ? "serif" : "sans-serif",
            fontWeight: span.flags & 16 ? 700 : 400,
            fontStyle: span.flags & 2 ? "italic" : "normal",
          } as const;

          const estiloBase: CSSProperties = {
            position: "absolute",
            left: x0 * scale,
            top: y0 * scale,
            width: (x1 - x0) * scale,
            height: (y1 - y0) * scale,
            fontSize: tamanhoPx,
            lineHeight: 1.15,
            overflow: "hidden",
            ...fonte,
          };

          if (!mascarado) {
            return (
              <div
                key={span.id}
                role="button"
                tabIndex={0}
                aria-label={`Editar: ${span.text}`}
                onClick={() => ativar(span)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") ativar(span);
                }}
                className="cursor-text outline outline-1 outline-transparent hover:outline-accent/50"
                style={estiloBase}
              />
            );
          }

          return (
            <div
              key={span.id}
              ref={ativo ? activeElRef : undefined}
              contentEditable={ativo}
              suppressContentEditableWarning
              onInput={(e) => {
                if (ativo) shrinkToFit(e.currentTarget, tamanhoPx);
              }}
              onBlur={() => ativo && finalizarEdicao(span)}
              onClick={() => !ativo && ativar(span)}
              className={`bg-white text-black outline outline-2 ${
                ativo ? "outline-accent" : "outline-success"
              }`}
              style={estiloBase}
            >
              {texto}
            </div>
          );
        })}
      </div>
    </div>
  );
}

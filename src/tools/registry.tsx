import type { ReactNode, ComponentType } from "react";
import type { AppSettings } from "../types/settings";
import type { HistoryEntry } from "../types/conversion";
import { PdfToMarkdownTool } from "./pdf-to-markdown/PdfToMarkdownTool";
import { MarkdownToPdfTool } from "./markdown-to-pdf/MarkdownToPdfTool";
import { PdfToolsTool } from "./pdf-tools/PdfToolsTool";
import { ImageConvertTool } from "./image-convert/ImageConvertTool";
import { ImageResizeTool } from "./image-resize/ImageResizeTool";
import { Base64Tool } from "./base64/Base64Tool";
import { QrCodeTool } from "./qr-code/QrCodeTool";
import { HashTool } from "./hash/HashTool";
import { YoutubeTool } from "./youtube/YoutubeTool";
import { VideoCompressTool } from "./video-compress/VideoCompressTool";
import { AudioConvertTool } from "./audio-convert/AudioConvertTool";
import { VideoToGifTool } from "./video-to-gif/VideoToGifTool";
import { SpotifyTool } from "./spotify/SpotifyTool";

export type ToolCategory = "documentos" | "imagens" | "midia" | "utilitarios";

/** Props que todo componente de ferramenta recebe. */
export interface ToolProps {
  settings: AppSettings;
  addHistory: (entry: HistoryEntry) => void;
}

export interface ToolDef {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: ReactNode;
  component: ComponentType<ToolProps>;
}

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  documentos: "Documentos",
  imagens: "Imagens",
  midia: "Mídia",
  utilitarios: "Utilitários",
};

export const CATEGORY_ORDER: ToolCategory[] = [
  "documentos",
  "imagens",
  "midia",
  "utilitarios",
];

export const TOOLS: ToolDef[] = [
  {
    id: "pdf-to-markdown",
    name: "PDF → Markdown",
    description: "Converte PDFs em Markdown localmente, com OCR.",
    category: "documentos",
    icon: <DocIcon />,
    component: PdfToMarkdownTool,
  },
  {
    id: "markdown-to-pdf",
    name: "Markdown → PDF",
    description: "Gera um PDF a partir de arquivos ou texto Markdown.",
    category: "documentos",
    icon: <PdfIcon />,
    component: MarkdownToPdfTool,
  },
  {
    id: "pdf-tools",
    name: "Ferramentas de PDF",
    description: "Juntar, dividir ou comprimir arquivos PDF.",
    category: "documentos",
    icon: <DocIcon />,
    component: PdfToolsTool,
  },
  {
    id: "image-convert",
    name: "Converter imagens",
    description: "Converte imagens para WebP, PNG, JPG ou ICO.",
    category: "imagens",
    icon: <ImageIcon />,
    component: ImageConvertTool,
  },
  {
    id: "image-resize",
    name: "Redimensionar imagens",
    description: "Redimensiona, comprime e renomeia imagens em lote.",
    category: "imagens",
    icon: <ImageIcon />,
    component: ImageResizeTool,
  },
  {
    id: "youtube",
    name: "Baixar do YouTube",
    description: "Baixa música (MP3), vídeo (MP4) ou playlist.",
    category: "midia",
    icon: <MediaIcon />,
    component: YoutubeTool,
  },
  {
    id: "video-compress",
    name: "Comprimir vídeo",
    description: "Reduz o tamanho de vídeos (H.264).",
    category: "midia",
    icon: <VideoIcon />,
    component: VideoCompressTool,
  },
  {
    id: "audio-convert",
    name: "Converter áudio",
    description: "Converte áudios para MP3, WAV ou FLAC.",
    category: "midia",
    icon: <AudioIcon />,
    component: AudioConvertTool,
  },
  {
    id: "video-to-gif",
    name: "Vídeo → GIF",
    description: "Cria um GIF a partir de um trecho de vídeo.",
    category: "midia",
    icon: <VideoIcon />,
    component: VideoToGifTool,
  },
  {
    id: "spotify",
    name: "Baixar do Spotify",
    description: "Baixa faixa, álbum ou playlist do Spotify em MP3.",
    category: "midia",
    icon: <MediaIcon />,
    component: SpotifyTool,
  },
  {
    id: "base64",
    name: "Base64 / Texto",
    description: "Codifica e decodifica texto em Base64.",
    category: "utilitarios",
    icon: <CodeIcon />,
    component: Base64Tool,
  },
  {
    id: "qr-code",
    name: "QR code",
    description: "Gera um QR code PNG a partir de texto ou URL.",
    category: "utilitarios",
    icon: <QrIcon />,
    component: QrCodeTool,
  },
  {
    id: "hash",
    name: "Hash / Checksum",
    description: "Calcula MD5, SHA-1 ou SHA-256 de arquivos.",
    category: "utilitarios",
    icon: <HashIcon />,
    component: HashTool,
  },
];

export function getTool(id: string): ToolDef | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function toolsByCategory(category: ToolCategory): ToolDef[] {
  return TOOLS.filter((t) => t.category === category);
}

function DocIcon() {
  return (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 3h6m2 6H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM13.5 13.5h3m-3 3h3m3-3v3.75M19.5 19.5h.008v.008H19.5V19.5z" />
    </svg>
  );
}

function HashIcon() {
  return (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5l-3 15m9-15l-3 15M4.5 9h15m-16 6h15" />
    </svg>
  );
}

function MediaIcon() {
  return (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v16.5L20.25 12 3.75 3.75z" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h8.25a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
    </svg>
  );
}

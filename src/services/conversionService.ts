import { invoke } from "@tauri-apps/api/core";
import type { ConversionRequest, ConversionResult } from "../types/conversion";

/**
 * O sidecar imprime o JSON de resultado como última linha do stdout, mas
 * bibliotecas (yt-dlp/ffmpeg) podem escrever linhas antes. Pega a última
 * linha que faz parse como JSON.
 */
function parseLastJson<T>(raw: string): T {
  const lines = raw.trim().split(/\r?\n/).filter((l) => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]) as T;
    } catch {
      // tenta a linha anterior
    }
  }
  throw new Error("Resposta inválida do conversor.");
}

export async function convertPdf(
  request: ConversionRequest
): Promise<ConversionResult> {
  const inputJson = JSON.stringify(request);

  let rawOutput: string;
  try {
    rawOutput = await invoke<string>("convert_pdf", { inputJson });
  } catch (err) {
    return {
      success: false,
      errorCode: "SIDECAR_ERROR",
      message:
        "Não foi possível iniciar o conversor. Verifique se o sidecar foi compilado.",
    };
  }

  // The sidecar may output progress lines to stderr (captured by Rust),
  // but stdout should contain exactly one JSON line.
  const trimmed = rawOutput.trim();

  if (!trimmed) {
    return {
      success: false,
      errorCode: "CONVERSION_FAILED",
      message: "O conversor não retornou nenhuma resposta.",
    };
  }

  try {
    const result = JSON.parse(trimmed) as ConversionResult;
    return result;
  } catch {
    return {
      success: false,
      errorCode: "CONVERSION_FAILED",
      message: "Resposta inválida do conversor.",
    };
  }
}

/** Runs a generic Python sidecar tool (md2pdf, pdf_merge, youtube, …). */
export async function runTool<T = unknown>(
  tool: string,
  request: unknown
): Promise<T> {
  const inputJson = JSON.stringify(request);
  const raw = await invoke<string>("run_tool", { tool, inputJson });
  if (!raw.trim()) {
    throw new Error("O conversor não retornou nenhuma resposta.");
  }
  return parseLastJson<T>(raw);
}

export interface ImageConvertArgs {
  inputs: string[];
  format: "webp" | "png" | "jpg" | "ico";
  outDir?: string;
  quality?: number;
}

/** Batch image conversion (native Rust). Returns output paths. */
export async function convertImages(args: ImageConvertArgs): Promise<string[]> {
  return invoke<string[]>("convert_images", {
    args: {
      inputs: args.inputs,
      format: args.format,
      out_dir: args.outDir ?? null,
      quality: args.quality ?? null,
    },
  });
}

/** Generates a QR code PNG. Returns the output path. */
export async function generateQr(
  text: string,
  outPath: string,
  size?: number
): Promise<string> {
  return invoke<string>("generate_qr", { text, outPath, size: size ?? null });
}

export interface HashResult {
  path: string;
  hash: string;
}

/** Computes file hashes (md5/sha1/sha256). */
export async function hashFiles(
  paths: string[],
  algo: "md5" | "sha1" | "sha256"
): Promise<HashResult[]> {
  return invoke<HashResult[]>("hash_files", { args: { paths, algo } });
}

export interface ResizeArgs {
  inputs: string[];
  outDir: string;
  maxWidth?: number;
  maxHeight?: number;
  scalePct?: number;
  format?: "webp" | "png" | "jpg";
  quality?: number;
  renamePrefix?: string;
}

/** Batch resize/compress/rename images (native Rust). Returns output paths. */
export async function resizeImages(args: ResizeArgs): Promise<string[]> {
  return invoke<string[]>("resize_images", {
    args: {
      inputs: args.inputs,
      out_dir: args.outDir,
      max_width: args.maxWidth ?? null,
      max_height: args.maxHeight ?? null,
      scale_pct: args.scalePct ?? null,
      format: args.format ?? null,
      quality: args.quality ?? null,
      rename_prefix: args.renamePrefix ?? null,
    },
  });
}

export interface YoutubeResult {
  success: boolean;
  outputs?: string[];
  skipped?: { i: number; title: string }[];
  durationMs?: number;
  errorCode?: string;
  message?: string;
}

export type YoutubeMode = "audio" | "video" | "playlist_audio";

export interface YoutubeInfo {
  success: boolean;
  title?: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  isPlaylist?: boolean;
  trackCount?: number;
  heights?: number[];
  errorCode?: string;
  message?: string;
}

/** Fetches video metadata (title/thumbnail/qualities) without downloading. */
export async function youtubeInfo(url: string): Promise<YoutubeInfo> {
  const raw = await invoke<string>("youtube_info", { url });
  return parseLastJson<YoutubeInfo>(raw);
}

/** Downloads from YouTube via yt-dlp (bundled ffmpeg). Progress via `tool-progress` events. */
export async function downloadYoutube(
  url: string,
  mode: YoutubeMode,
  outputDir: string,
  audioKbps?: number,
  maxHeight?: number
): Promise<YoutubeResult> {
  const raw = await invoke<string>("download_youtube", {
    url,
    mode,
    outputDir,
    audioKbps: audioKbps ?? null,
    maxHeight: maxHeight ?? null,
  });
  return parseLastJson<YoutubeResult>(raw);
}

/** Compresses a video via bundled ffmpeg (H.264 re-encode). Progress via `tool-progress`. */
export async function compressVideo(
  input: string,
  output: string,
  crf?: number,
  preset?: string
): Promise<string> {
  return invoke<string>("compress_video", {
    args: { input, output, crf: crf ?? null, preset: preset ?? null },
  });
}

/** Batch audio conversion (mp3/wav/flac) via bundled ffmpeg. Returns output paths. */
export async function convertAudio(
  inputs: string[],
  outDir: string,
  format: "mp3" | "wav" | "flac",
  bitrate?: number
): Promise<string[]> {
  return invoke<string[]>("convert_audio", {
    args: { inputs, out_dir: outDir, format, bitrate: bitrate ?? null },
  });
}

export interface GifOptions {
  fps?: number;
  width?: number;
  start?: number;
  duration?: number;
}

/** Converts a video clip to GIF via bundled ffmpeg. Progress via `tool-progress`. */
export async function videoToGif(
  input: string,
  output: string,
  opts: GifOptions = {}
): Promise<string> {
  return invoke<string>("video_to_gif", {
    args: {
      input,
      output,
      fps: opts.fps ?? null,
      width: opts.width ?? null,
      start: opts.start ?? null,
      duration: opts.duration ?? null,
    },
  });
}

/** Downloads a Spotify track/album/playlist (Spotify metadata → YouTube audio). */
export async function downloadSpotify(
  url: string,
  outputDir: string,
  audioKbps?: number,
  clientId?: string,
  clientSecret?: string
): Promise<YoutubeResult> {
  const raw = await invoke<string>("download_spotify", {
    url,
    outputDir,
    audioKbps: audioKbps ?? null,
    clientId: clientId || null,
    clientSecret: clientSecret || null,
  });
  return parseLastJson<YoutubeResult>(raw);
}

/** Whether the on-demand Docling module (PDF→Markdown) is ready. Always true in dev. */
export async function doclingInstalled(): Promise<boolean> {
  return invoke<boolean>("docling_installed");
}

/** Downloads + extracts the Docling module if missing. Progress via `docling-progress`. */
export async function ensureDocling(): Promise<void> {
  await invoke("ensure_docling");
}

export async function saveMarkdown(
  path: string,
  content: string
): Promise<void> {
  await invoke("save_markdown", { path, content });
}

export async function openFolder(filePath: string): Promise<void> {
  await invoke("open_folder", { filePath });
}

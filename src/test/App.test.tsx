import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App";

const mockInvoke = vi.mocked((await import("@tauri-apps/api/core")).invoke);
const mockOpen = vi.mocked((await import("@tauri-apps/plugin-dialog")).open);

/** Roteia o invoke por comando. docling_installed=true por padrão; resto "{}". */
function routeInvoke(overrides: Record<string, () => Promise<unknown>> = {}) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (overrides[cmd]) return overrides[cmd]();
    if (cmd === "docling_installed") return Promise.resolve(true);
    return Promise.resolve("{}");
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  routeInvoke();
});

/** Landing é a Home; abre a ferramenta PDF → Markdown antes de testar o conversor. */
async function openPdfTool() {
  await userEvent.click(screen.getByRole("button", { name: /abrir pdf/i }));
}

/** Abre o tool, seleciona um PDF via diálogo e retorna quando a fila aparece. */
async function addPdf(path = "C:\\docs\\relatorio.pdf") {
  mockOpen.mockResolvedValueOnce(path);
  await openPdfTool();
  await userEvent.click(screen.getByRole("button", { name: /arrastar/i }));
  await waitFor(() => screen.getByRole("button", { name: /^Converter$/ }));
}

describe("Home / navegação", () => {
  it("mostra a Home com as ferramentas no carregamento", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /abrir pdf/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /abrir converter imagens/i })).toBeInTheDocument();
  });

  it("abre a ferramenta PDF → Markdown e mostra a zona de soltar", async () => {
    render(<App />);
    await openPdfTool();
    expect(screen.getByRole("button", { name: /arrastar/i })).toBeInTheDocument();
  });
});

describe("PDF → Markdown", () => {
  it("mostra o botão Converter após selecionar um arquivo", async () => {
    render(<App />);
    await addPdf();
    expect(screen.getByRole("button", { name: /^Converter$/ })).toBeInTheDocument();
  });

  it("mostra progresso enquanto converte", async () => {
    routeInvoke({ convert_pdf: () => new Promise(() => {}) }); // nunca resolve
    render(<App />);
    await addPdf();
    await userEvent.click(screen.getByRole("button", { name: /^Converter$/ }));
    await waitFor(() => {
      expect(screen.getByText(/preparando documento/i)).toBeInTheDocument();
    });
  });

  it("mostra o visualizador de Markdown após conversão bem-sucedida", async () => {
    routeInvoke({
      convert_pdf: () =>
        Promise.resolve(
          JSON.stringify({ success: true, outputPath: "", markdown: "# Relatório\n\nConteúdo.", durationMs: 1200 })
        ),
    });
    render(<App />);
    await addPdf();
    await userEvent.click(screen.getByRole("button", { name: /^Converter$/ }));
    await waitFor(() => {
      expect(screen.getByLabelText(/conteúdo markdown/i)).toBeInTheDocument();
    });
  });

  it("mostra erro quando a conversão falha", async () => {
    routeInvoke({
      convert_pdf: () =>
        Promise.resolve(
          JSON.stringify({ success: false, errorCode: "CONVERSION_FAILED", message: "Não foi possível converter o documento." })
        ),
    });
    render(<App />);
    await addPdf();
    await userEvent.click(screen.getByRole("button", { name: /^Converter$/ }));
    await waitFor(() => {
      expect(screen.getByText(/erro na conversão/i)).toBeInTheDocument();
    });
  });

  it("copia o conteúdo Markdown", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, writable: true });

    routeInvoke({
      convert_pdf: () =>
        Promise.resolve(JSON.stringify({ success: true, outputPath: "", markdown: "# Título", durationMs: 800 })),
    });
    render(<App />);
    await addPdf();
    await userEvent.click(screen.getByRole("button", { name: /^Converter$/ }));
    await waitFor(() => screen.getByLabelText(/conteúdo markdown/i));

    await userEvent.click(screen.getByRole("button", { name: /copiar conteúdo/i }));
    expect(writeText).toHaveBeenCalledWith("# Título");
  });
});

describe("Base64 / Texto", () => {
  it("codifica texto em Base64", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /abrir base64/i }));
    await userEvent.type(screen.getByLabelText(/entrada/i), "abc");
    await userEvent.click(screen.getByRole("button", { name: /^codificar$/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/resultado base64/i)).toHaveValue("YWJj");
    });
  });
});

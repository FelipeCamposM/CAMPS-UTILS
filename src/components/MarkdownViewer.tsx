import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

interface MarkdownViewerProps {
  content: string;
  onChange: (value: string) => void;
  onCopy: () => void;
  onClear: () => void;
}

type Tab = "code" | "preview";

export function MarkdownViewer({
  content,
  onChange,
  onCopy,
  onClear,
}: MarkdownViewerProps) {
  const [activeTab, setActiveTab] = useState<Tab>("code");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    onCopy();
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border-subtle bg-bg-elevated">
        <TabButton active={activeTab === "code"} onClick={() => setActiveTab("code")}>
          Código Markdown
        </TabButton>
        <TabButton active={activeTab === "preview"} onClick={() => setActiveTab("preview")}>
          Prévia
        </TabButton>

        <div className="flex-1" />

        <button
          onClick={handleCopy}
          aria-label="Copiar conteúdo"
          className="px-3 py-1.5 rounded-md text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-border-subtle transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {copied ? "Copiado!" : "Copiar"}
        </button>

        <button
          onClick={onClear}
          aria-label="Limpar resultado"
          className="px-3 py-1.5 rounded-md text-xs font-medium text-text-muted hover:text-text-secondary hover:bg-border-subtle transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Limpar
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto max-h-[420px]">
        {activeTab === "code" ? (
          <textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Conteúdo Markdown editável"
            spellCheck={false}
            className="selectable w-full h-full min-h-[420px] p-4 bg-transparent text-text-primary text-sm font-mono resize-none focus:outline-none leading-relaxed"
          />
        ) : (
          <div className="selectable p-6 prose prose-invert prose-sm max-w-none">
            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {content}
            </Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={[
        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
        active
          ? "bg-bg-primary text-text-primary"
          : "text-text-secondary hover:text-text-primary",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

---
name: camps-ui
description: Interface React/TypeScript da suíte — src/tools, src/components, src/hooks, registry.tsx. Use para criar a tela de uma ferramenta nova ou mexer em componente existente. NÃO use para Rust, Python ou empacotamento.
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
---

Você escreve a interface. Strings em **pt-BR**.

## Antes de criar qualquer coisa, procure

O kit já existe em `src/components/ui`: `Button`, `Field`, `Input`, `Select`, `Slider`,
`SegmentedControl`, `ResultPanel`. Componente novo só quando nenhum deles serve — e aí ele vai
para o kit, não para dentro da ferramenta.

Mesma regra para hooks: `src/lib/motion.ts` já tem entrada, cascata, shake, pulso e revelação de
mídia. `src/hooks/` tem drag&drop, settings, histórico, PDF.

## Como se adiciona uma ferramenta

1. Componente em `src/tools/<id>/<Nome>Tool.tsx`, recebendo `ToolProps` (`settings`, `addHistory`).
2. Entrada em `src/tools/registry.tsx` — **fonte única**; Home e Sidebar saem dela sozinhas.
3. Se depender de módulo pesado: `module: "whisper"` no registry. **O `App` embrulha no
   `<ModuleGate>` sozinho** — não escreva gate dentro da ferramenta.
4. Ícone do `lucide-react`. Não existe SVG inline neste projeto.
5. Uma linha de `useToolEnter()` no root para a cascata de entrada.
6. Grade larga (miniaturas) pede `wide: true` no registry.
7. Grave no histórico via `addHistory` quando gerar arquivo.

## Armadilhas que já custaram tempo aqui

- **Tamanho de botão é a prop `size`, nunca padding por className.** O Tailwind emite a escala em
  ordem crescente, então `py-2` no call site perde para `py-2.5` da base e o override falha em
  silêncio.
- **`gsap.killTweensOf(el)` genérico mata o tween de entrada do pai** e deixa o elemento preso em
  `opacity: 0`. Sempre escopar por propriedade: `killTweensOf(el, "x,y")`.
- **Handler que recebe argumento não vai direto em `onClick`.** O React entrega o `MouseEvent` como
  primeiro parâmetro. Use `() => fn()`.
- **Nada de hook depois de `return` condicional.** Já houve um `if (...) return <Gate/>` antes de
  um `useToolEnter()` neste código.
- **Vidro custa GPU.** `.glass` em superfícies (cartão, painel, modal), nunca em cada linha de
  lista ou botão. Botões usam `.btn*`, que não têm `backdrop-filter` de propósito.
- Cores de estado são token: `text-danger`, `text-success`, `text-warning`, `bg-overlay/[0.07]`.
  Nada de `text-red-400` — quebra o tema claro.

## Verificação obrigatória

```bash
npm run typecheck
npm run test
```

Teste novo em `src/test/` quando houver lógica (não para markup puro). Fora do Tauri o `invoke`
falha — o padrão é tratar erro de checagem como "disponível" em vez de travar a ferramenta.

## Limites

- Não mexa em `src-tauri/` nem em `python/`.
- Não edite arquivos vendorizados em `src/components/<Nome>/` (React Bits) — um `shadcn add` futuro
  sobrescreve. Preset e ajuste moram no registry de fundos.
- Não adicione biblioteca de UI nova sem aprovação do orquestrador.

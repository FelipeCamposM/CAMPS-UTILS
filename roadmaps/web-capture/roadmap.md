# Roadmap: Capturar Site (crawl de domínio → Markdown/HTML/screenshot)

Nova ferramenta na suíte CAMPS-UTILS: dado uma URL, varre o site (fila + dedupe,
escopo configurável) e salva cada página como Markdown, HTML, texto, screenshot
full-page, metadados e links, explorando tabs/accordions e fazendo scroll
automático. Não é extensão de nenhum roadmap anterior — feature nova.

Decisões fechadas: Playwright puro (não Scrapling) + BeautifulSoup + markdownify;
browser = Edge do Windows via `channel="msedge"` (sem baixar Chromium); MVP já
inclui crawl completo de domínio (não fica pra v2). Peso medido do módulo: ~46MB
(playwright+bs4+markdownify), na faixa do realesrgan/depth.

## Passos

- [x] **1. Gate camps-medidor** — medido peso real do bundle PyInstaller do stack
  Playwright+BeautifulSoup+markdownify: 46MB exe / 45,5MB zip, viável.
  `channel="msedge"` confirmado funcionando sem `playwright install`. Driver Node
  embutido do Playwright é 79% do peso (inevitável, não é dado excluível).
- [x] **2. Python isolado** — `python/webcapture.py` (novo: `capturar_site()` async,
  fila BFS com N workers persistentes, scroll automático, exploração de
  tabs/accordions best-effort, extração via BeautifulSoup, conversão HTML→MD via
  markdownify). `python/converter.py`: branch `capture_site` no `dispatch()`,
  handler `capture_site()` com validação barata antes do import tardio de
  `webcapture`, callbacks `STEP:`/`PAGEEVENT:` no stderr. `python/requirements.txt`:
  `playwright`, `beautifulsoup4`, `markdownify`. `python/test_converter.py`:
  `TestCaptureSiteEntrada` + `TestCaptureSiteSaida` (9 testes novos). Suite completa:
  90/90 passando.
- [x] **3. Rust** — `src-tauri/src/commands.rs`: const `WEBCAPTURE` (RemoteModule,
  `sha256` vazio até o release existir), `webcapture_installed`/`ensure_webcapture`,
  novo prefixo stderr `PAGEEVENT:` → evento Tauri `capture-page-event`, arm de
  roteamento `"capture_site"` no sidecar, comando `create_zip` (crate `zip`,
  `spawn_blocking`). `src-tauri/src/lib.rs`: 3 comandos novos registrados.
  `python/build.py`: `WEBCAPTURE_STACK`, `build_webcapture()`, stack subtraída dos
  excludes de light/whisper/depth/rembg. `cargo check` debug+release: limpo.
- [x] **4. Frontend** — `src/tools/web-capture/WebCaptureTool.tsx` (URL, escopo via
  `SegmentedControl`, 8 checkboxes de captura, limite de páginas, `Slider` de
  concorrência, resumo final com 6 contadores, Abrir pasta/Baixar ZIP),
  `CrawlQueueList.tsx` (lista ao vivo por página), hook `useCaptureEvents.ts`
  (evento `capture-page-event`). `conversionService.ts`: tipos + `captureSite`/
  `webcaptureInstalled`/`ensureWebcapture`/`createZip`. `ModuleGate.tsx`: entrada
  `webcapture`. `registry.tsx`: tool `web-capture` (categoria utilitarios, wide).
  `npm run typecheck` + `npm run test`: limpos (104 testes).
- [x] **5. Empacotar e publicar** — `python build.py webcapture` gerou
  `camps-webcapture.zip` (56MB) + sha256
  `a7990e665875256f997784a71751e940e9dd82d6f1fefb11a8557a1a1cda78f8`. `.exe`
  compilado testado de verdade contra `https://example.com` (captura completa,
  channel=msedge sem baixar Chromium). Publicado
  [webcapture-v1](https://github.com/FelipeCamposM/CAMPS-UTILS/releases/tag/webcapture-v1)
  como pre-release. sha256 gravado em `commands.rs` → `WEBCAPTURE`.
- [x] **6. Smoke test manual** — usuário testou manualmente em `npm run dev` e
  confirmou funcionando.
- [x] **7. Release da versão 1.2.0** — `VERSION`/`version:sync`, entrada em
  `src/lib/changelog.ts`, verificações completas (typecheck/vitest/pytest/cargo
  debug+release, todas passando), `npm run build` assinado, `npm run release` →
  `latest.json`, publicado
  [v1.2.0](https://github.com/FelipeCamposM/CAMPS-UTILS/releases/tag/v1.2.0)
  (marcado "Latest" corretamente, na frente do `webcapture-v1` que é pre-release).

## Riscos conhecidos

- Heurística de tabs/accordions é best-effort — não cobre 100% dos sites.
- Crawl de "domínio inteiro" sem `maxPaginas` pode demorar bastante em sites
  grandes (sem limite de tempo total, só de páginas/concorrência).

## v2: seleção de conteúdo + assets + Capturar Imagens

Motivação: com as 8 opções antigas todas ligadas por padrão, um crawl de site
médio gerava arquivo demais pro usuário analisar depois. Pedido: escolher o
que cada página retorna (só md+screenshot pré-marcados), extrair todos os
assets do site (imagens/CSS/JS/fontes, inclusive de terceiros) pra dar pra
remontar o site de um cliente, e uma ferramenta nova só pra baixar imagens.

- [x] **1. Defaults** — `OPCOES_DEFAULT`/`OPCOES_PADRAO`/`opcoes_padrao` (3
  cópias: `WebCaptureTool.tsx`, `webcapture.py`, `converter.py`) trocados pra
  só `markdown`+`screenshot` ligados por padrão, resto desligado.
- [x] **2. `assets` + `somenteImagens`** — `python/webcapture.py`:
  `extrair_urls_assets()` (imagens/css/js, sem filtro de domínio),
  `_urls_de_css()` (regex `url()` pra bg-image e `@font-face`), `_nome_asset()`
  (hash da URL, evita colisão cross-origin), `_baixar_assets()` (via
  `context.request`, dedupe por URL com lock+sentinel, sem dependência nova),
  `_ler_css_local()` (relê CSS já baixado pra achar fontes sem golpe de rede
  extra). Pasta compartilhada `out_dir/assets/`, `assetsPaths` por página no
  manifesto, contador `arquivos.assets`. Guard novo: página sem nenhuma opção
  de arquivo-por-página ligada não cria pasta vazia.
- [x] **3. Frontend** — checkbox "Assets" em `WebCaptureTool.tsx` + contador no
  resumo. Tipos novos em `conversionService.ts` (`CaptureOptions.assets`,
  `CapturePageResult.assetsCount`, `CaptureResult.arquivos.assets`).
- [x] **4. Nova ferramenta "Capturar Imagens"** —
  `src/tools/web-capture/WebCaptureImagesTool.tsx` (novo arquivo, sem
  checkboxes, `opcoes` fixo com `assets: true, somenteImagens: true`),
  entrada `web-capture-images` em `registry.tsx` reaproveitando o mesmo
  `module: "webcapture"` (sem novo comando Rust nem branch de dispatch —
  mesma sidecar, `opcoes` diferente). `ModuleGate.tsx`: `usadoPor` atualizado.
- [x] **5. Testes** — `python/test_converter.py`: `test_opcoes_default`
  atualizado pros novos defaults; `TestExtrairUrlsAssets` (imagens/srcset,
  css/js cross-origin, tipo não pedido fica de fora); `TestNomeAsset` (dedupe
  por hash de URL não colide entre origens, determinístico). Suite completa:
  95/95 passando. `npm run typecheck` limpo, `npm run test`: 104/104
  passando.

- [x] **6. Nome do asset + limpeza no fechar** — `_nome_asset()` trocado de
  hash puro pra `<hash10>_<nome-original>` (mantém a origem legível, hash só
  resolve colisão entre domínios que compartilham path). Confirmado por
  inspeção real do disco: as pastas de captura (e também rembg/depth) nunca
  eram limpas — acumulavam em `%TEMP%\camps-utils\` pra sempre. Fix:
  `src-tauri/src/lib.rs` passou a usar `.build()` + `.run(|_, event| ...)`
  e apaga `std::env::temp_dir().join("camps-utils")` inteiro em
  `RunEvent::Exit` — cobre todos os módulos (webcapture/rembg/depth/etc), não
  só webcapture, uma limpeza só ao fechar o app.

### Cortes deliberados

- Sem parser CSS de verdade — regex `url()` cobre o caso de uso (harvesting,
  não validação de CSS).
- Sem lock por URL — lock único do crawl com sentinel de reserva; risco
  aceito: duas páginas pedindo a mesma URL nova ao mesmo tempo podem deixar
  uma delas sem listar o asset em `assetsPaths` (o arquivo existe, só a
  referência na página que "perdeu" a corrida fica de fora).
- Sem dedupe por hash de conteúdo, sem sniff de magic bytes pra extensão.
- Sem novo comando Rust/branch de dispatch pra Capturar Imagens — reaproveita
  `capture_site` com `opcoes` fixo do lado do frontend.
- Sem componente compartilhado entre `WebCaptureTool.tsx` e
  `WebCaptureImagesTool.tsx` (`ESCOPOS`, `Resumo`) — duplicar 3-15 linhas é
  mais barato que acoplar os dois arquivos.

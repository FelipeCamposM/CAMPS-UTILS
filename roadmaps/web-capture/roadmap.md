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
- [ ] **5. Empacotar e publicar** — rodar `python build.py webcapture`, **rodar o
  `.exe` compilado de verdade** (não só dev venv) contra um site real, preencher
  `sha256` real em `commands.rs` (`WEBCAPTURE`), publicar Release `webcapture-v1`
  como **pre-release** no GitHub com `camps-webcapture.zip` + `.sha256`.
- [ ] **6. Smoke test manual em `npm run dev`** — testar os 3 escopos (só esta
  página / esta página + subpáginas / domínio inteiro) contra um site pequeno real,
  confirmar screenshot/MD/HTML/ZIP/abrir pasta funcionando ponta a ponta.

## Riscos conhecidos

- Heurística de tabs/accordions é best-effort — não cobre 100% dos sites.
- Crawl de "domínio inteiro" sem `maxPaginas` pode demorar bastante em sites
  grandes (sem limite de tempo total, só de páginas/concorrência).

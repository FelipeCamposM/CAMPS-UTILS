# Roadmap — Prospecção de leads

Feature local de descoberta e qualificação de empresas via Google Maps e
Instagram, auditoria de sites com Playwright, minimapa e CRM persistente.

## Etapas

- [x] Contratos de domínio, banco SQLite e migrações.
- [x] CRUD de campanhas/leads, pipeline, lixeira e Markdown.
- [x] Coleta Maps/Instagram, sessão persistente e auditoria de sites.
- [x] Interface Buscar / Resultados / Pipeline / Configurações.
- [x] Empacotar/publicar `webcapture-v2` e validar o executável empacotado.

## Decisões

- SQLite em `appLocalData/leads.db`; Markdown é exportação/importação portátil.
- Playwright dirige o Edge instalado e mantém o perfil do Instagram somente no PC.
- Limite padrão de 100 leads, pausas humanizadas e retomada por campanha.
- Contato é assistido; o aplicativo não envia mensagens automaticamente.
- O coletor direto é experimental: mudanças das interfaces podem exigir manutenção.

## Progresso

- 2026-08-24 — planejamento fechado; arquitetura existente e módulo `webcapture`
  inspecionados. Implementação iniciada pelos contratos e pela persistência.
- 2026-08-24 — backend SQLite em `src-tauri/src/leads.rs`; contratos e serviço em
  `src/types/leads.ts` e `src/services/leadService.ts`; coletor/auditoria em
  `python/leads.py`; interface completa em `src/tools/leads/`; Leaflet e CSP
  integrados. Verificações: TypeScript e build Vite limpos, `cargo check` limpo,
  Vitest 106/106 e pytest 114/114.
- 2026-08-24 — corrigida a tela preta ao abrir Resultados: leads persistidos
  agora são normalizados antes da renderização e a lista tolera campos legados
  ausentes. Teste de regressão cobre abertura da aba com registro incompleto.
- 2026-08-24 — o Leaflet deixou de ser inicializado sem coordenadas e passou a
  ter isolamento de erro próprio, impedindo uma falha do mapa de apagar a aba.
- 2026-08-24 — busca orientada a oportunidade: amostra ampliada do Maps,
  shortlist e ranking final priorizam sem site, só redes, quebrados e fracos.
  Auditoria móvel/SEO/conversão ampliada; diagnósticos aparecem nos cards.
  Links externos são normalizados e cada lead ganhou a ação “Ver no Maps”.
- 2026-08-24 — abertura externa corrigida no backend: URLs passam por comando
  nativo validado e a capability inclui o escopo HTTP/HTTPS do opener.
- 2026-09-03 — busca sobrevive a trocar de ferramenta: estado (`running`,
  leads, listener de `lead-search-event`) subiu para `src/hooks/useLeadSearch.ts`,
  instanciado uma vez em `src/App.tsx` (nunca desmonta) e passado como prop pra
  `LeadsTool`; toast `sonner` (canto inferior direito, estilo `.popover`)
  substitui o aviso local e persiste até o fim mesmo fora da tela de Leads.
  `Select.tsx` ganhou o mesmo fix de `NotificationBell.tsx` (portal pro
  `<body>` + posição `fixed` medida) — corrige selects renderizando atrás de
  cards `.glass` abaixo, em todo o app. Filtro de Resultados reorganizado
  (status ganhou label e linha própria). `LeadList.tsx` agrupa por campanha
  com cabeçalho quando "Todas as campanhas" mistura buscas diferentes, e cada
  card mostra a quantidade de avaliações do lugar. Verificações: `typecheck`
  limpo, Vitest 112/112 (+ `App.test.tsx` 19/19 isolado). Não validado
  visualmente em `tauri dev` nesta sessão — falta conferir o toast e o
  dropdown por cima dos cards na tela real.
- 2026-09-03 — tela de Resultados virou navegação em dois níveis: grade de
  cards (um por campanha/busca, com status rodando/concluída/falhou, contagem
  e data) e, ao clicar, o detalhe só daquela campanha com os filtros de sempre.
  `LeadList.tsx` voltou a ser lista plana (o agrupamento por cabeçalho da
  entrada anterior foi revertido — não fazia mais sentido com a navegação por
  card). Dropdown "Todas as campanhas" removido; Exportar .md mudou pro
  cabeçalho do detalhe, Importar .md ficou na grade. Testes de
  `LeadsTool.test.tsx` ajustados pra sempre passar por uma campanha (nenhum
  lead nasce mais sem campanha na UI real). Verificações: `typecheck` limpo,
  Vitest 112/112. Não validado visualmente em `tauri dev`.
- 2026-09-03 — toast sonner recolorido: estava branco puro (sonner ignora o
  tema do app por padrão) — `App.tsx` agora passa as CSS vars oficiais do
  sonner (`--normal-bg`/`--normal-border`/etc.) lendo os tokens do app
  (`--c-bg-elevated`, `--c-accent`...), com fundo tingido de destaque
  (`color-mix`) e um glow suave atrás, mesma cor de destaque usada nos botões
  (inclusive quando personalizada). `useLeadSearch.ts` passou a também ouvir
  `tool-progress` (só atualiza enquanto a própria busca está rodando, pra não
  misturar com o progresso de outra ferramenta) e mostra a porcentagem no
  texto do toast junto da contagem de leads. Adicionada opção de excluir uma
  campanha inteira (`deleteCampaign`, já existia no serviço, sem uso até
  então) — ícone de lixeira no card da grade e botão "Excluir busca" no
  cabeçalho do detalhe, ambos atrás de `window.confirm` (mesmo padrão de
  "excluir lead permanentemente"). No processo, corrigido bug de HTML
  inválido: o card da campanha era um `<button>` com outro `<button>`
  (excluir) aninhado dentro — navegador quebra essa estrutura sozinho: virou
  `<article onClick=...>`, mesmo padrão do `LeadCard` em `LeadList.tsx`.
  Verificações: `typecheck` limpo, Vitest 112/112.
- 2026-09-04 — formulário de busca (`LeadSearchForm.tsx`) trocou inputs livres
  de País/Idioma por `Select` (por enquanto só Estados Unidos/Brasil e
  Português — fácil de estender depois). Quando País=Brasil, Local vira três
  campos: Estado (as 27 UFs, fixo no código) + Cidade (searchable, populada
  automaticamente a partir do estado escolhido) + Local livre (agora só rua/
  bairro, opcional). Município→UF vem de `src/tools/leads/brCities.json`
  (~84 KB, 5.571 municípios, buscados uma vez na API pública do IBGE e
  embutidos no bundle — nenhuma chamada de rede em tempo de execução,
  mantendo a suíte 100% local). `effectiveLocation()` em `LeadSearchForm.tsx`
  junta rua+cidade+UF num único texto só na hora de mandar pra busca
  (`useLeadSearch.ts`) — o formulário continua guardando os campos separados.
  Novos padrões: País=Brasil, Estado=GO, Cidade=Goiânia, Fonte=Google Maps,
  nicho/placeholder em português. Verificações: `typecheck` limpo, Vitest
  112/112. Não validado visualmente em `tauri dev`.

## Distribuição

`webcapture-v2` publicado como pre-release em 26/09/2026 com
`python/dist/camps-webcapture.zip` (56 MB), SHA-256
`bc88ce3a1aac7b2d5ae3a9bc2887863cccc872c26b9e3a3ab8c0bf67edbbbc2f`.
O executável empacotado reconheceu `--tool search_leads` e devolveu a validação
esperada para entrada vazia, comprovando que `python/leads.py` entrou no bundle.

### Release v1.3.0 — troca da chave de assinatura

A senha da `~/.tauri/camps-utils.key` foi perdida (a `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
do Windows é do projeto OMNI). Gerada `~/.tauri/camps-utils-v2.key`; caminho e senha no
`.env` (gitignored). Pubkey nova em `src-tauri/tauri.conf.json`, instalador recompilado e
assinado com ela. **Consequência:** quem está na ≤1.2.0 não recebe a 1.3.0 pelo updater
(assinatura recusada) — precisa reinstalar na mão uma vez. CLAUDE.md atualizado.

- [ ] Build assinado + `latest.json` + Release `v1.3.0` publicado.

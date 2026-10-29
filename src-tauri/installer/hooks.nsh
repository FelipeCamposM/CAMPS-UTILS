; Visual e textos do instalador (incluído pelo template NSIS do Tauri ANTES das
; páginas — cada define abaixo é consumido pela próxima página do tipo dela).
; Arte em src-tauri/installer/, gerada por scripts/make-installer-art.py.
; Este arquivo precisa ficar em UTF-8 COM BOM, senão o NSIS lê os acentos errado.

; Tema escuro do app (--c-bg-primary / --c-text-primary em src/index.css).
!define MUI_BGCOLOR "0E0E14"
!define MUI_TEXTCOLOR "E2E2EC"
; Sem isto o Windows ignora a cor do texto das caixas de seleção e elas saem
; pretas sobre o fundo escuro, ilegíveis.
!define MUI_FORCECLASSICCONTROLS

; 1. Boas-vindas
!define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao CAMPS-UTILS"
!define MUI_WELCOMEPAGE_TITLE_3LINES
!define MUI_WELCOMEPAGE_TEXT "Este assistente vai instalar o CAMPS-UTILS no seu computador: ferramentas para PDF, imagens, áudio, vídeo e mais.$\r$\n$\r$\nTudo roda no seu PC — seus arquivos não são enviados para a internet.$\r$\n$\r$\nSão só três passos:$\r$\n   1. Escolher a pasta de instalação$\r$\n   2. Aguardar a cópia dos arquivos$\r$\n   3. Abrir o programa$\r$\n$\r$\nSe o CAMPS-UTILS estiver aberto, feche-o antes. Clique em Próximo para começar."

; 2. Pasta
!define MUI_DIRECTORYPAGE_TEXT_TOP "Passo 1 de 3 — Onde instalar.$\r$\n$\r$\nA pasta sugerida já serve para a maioria das pessoas: é só clicar em Instalar. Para escolher outro lugar, clique em Procurar."

; 3. Cópia dos arquivos
!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "Arquivos copiados"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "Passo 2 de 3 concluído. Clique em Próximo."

; 4. Conclusão
!define MUI_FINISHPAGE_TITLE "Pronto! O CAMPS-UTILS está instalado"
!define MUI_FINISHPAGE_TITLE_3LINES
!define MUI_FINISHPAGE_TEXT "Passo 3 de 3 — Abrir o programa.$\r$\n$\r$\nVocê encontra o CAMPS-UTILS no menu Iniciar. Algumas ferramentas pedem um download extra na primeira vez que forem usadas; o próprio programa avisa e faz isso por você.$\r$\n$\r$\nAs próximas versões chegam sozinhas, com um aviso no programa.$\r$\n$\r$\nClique em Concluir para fechar."
!define MUI_FINISHPAGE_RUN_TEXT "Abrir o CAMPS-UTILS agora"

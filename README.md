# PDF to Markdown

Aplicativo desktop para Windows que converte PDFs em Markdown localmente, sem enviar arquivos para a internet.

**Stack:** Tauri 2 · React 18 · TypeScript · Vite · Tailwind CSS · Python 3 · Docling · PyInstaller

---

## Pré-requisitos

| Ferramenta | Versão mínima | Instalação |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| Rust + Cargo | 1.77+ | https://rustup.rs |
| Python | 3.11+ | https://python.org |
| Visual Studio Build Tools | 2022 | Exigido pelo Rust no Windows |

### Instalar Rust no Windows

```powershell
winget install Rustlang.Rustup
# Feche e reabra o terminal após a instalação
rustc --version
```

### Instalar dependências do Tauri (WebView2)

O Tauri usa o WebView2 no Windows. Ele geralmente já está disponível no Windows 10/11.
Se não estiver: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### Visual Studio Build Tools

O Rust no Windows requer o MSVC toolchain:
```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```
Durante a instalação, selecione "Desenvolvimento para desktop com C++".

---

## Setup

### 1. Instalar dependências Node

```powershell
npm install
```

### 2. Criar ambiente virtual Python

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

### 3. Instalar dependências Python

```powershell
pip install -r python\requirements.txt
```

> **Nota:** O Docling é uma dependência pesada (~500 MB com dependências). A instalação pode demorar alguns minutos.

---

## Desenvolvimento

```powershell
# Com o ambiente virtual ativado:
npm run dev
```

Isso abre o aplicativo Tauri com hot-reload do React.

> **Importante:** O sidecar Python precisa ser compilado antes de testar a conversão real.
> Em modo dev, você pode testar a interface sem o sidecar, mas a conversão falhará com erro de sidecar.

---

## Compilar o sidecar Python

```powershell
# Com o ambiente virtual ativado:
npm run build:python
# ou diretamente:
python python/build.py
```

O script:
1. Limpa builds anteriores
2. Executa o PyInstaller em modo `--onedir`
3. Copia o executável para `src-tauri/binaries/converter-x86_64-pc-windows-msvc/`

> **Por que `--onedir` e não `--onefile`?**
> O Docling usa muitas DLLs e modelos que não funcionam bem no modo `--onefile`
> (extração lenta, conflitos de caminho). O modo `--onedir` é mais confiável.

---

## Gerar ícones

```powershell
# Crie ou obtenha um PNG de 1024x1024 pixels e execute:
npx tauri icon caminho\para\icone.png
```

Isso gera automaticamente todos os tamanhos necessários em `src-tauri/icons/`.

---

## Build do instalador

```powershell
# Compila o sidecar Python + gera o instalador Tauri
npm run build:all
```

O instalador ficará em `src-tauri/target/release/bundle/`:
- `.msi` — Windows Installer
- `nsis/` — instalador NSIS (`.exe`)

O instalador **não requer** que o usuário tenha Python, Node.js ou Rust instalados.

---

## Testes

### Testes Python

```powershell
.venv\Scripts\Activate.ps1
cd python
pytest test_converter.py -v
```

### Testes da interface

```powershell
npm test
```

---

## Modelos do Docling

Na **primeira conversão**, o Docling baixa automaticamente os modelos de ML necessários.

- **Localização:** `C:\Users\<usuario>\.cache\huggingface\hub\`
- **Tamanho:** ~1–2 GB dependendo dos modelos
- **Tempo:** pode levar 5–15 minutos na primeira execução
- **Reutilização:** os modelos são cacheados e não são baixados novamente

O aplicativo exibe um aviso quando detecta que é o primeiro uso.

---

## Estrutura de pastas

```
pdf-to-markdown/
├── src/                        # Interface React/TypeScript
│   ├── components/             # Componentes UI
│   ├── hooks/                  # React hooks
│   ├── services/               # Serviços (Tauri invoke, settings, log)
│   ├── types/                  # Tipos TypeScript compartilhados
│   ├── test/                   # Testes da interface
│   ├── App.tsx                 # Componente raiz + reducer de estado
│   ├── main.tsx                # Entry point React
│   └── index.css               # Estilos globais + Tailwind
├── src-tauri/                  # Backend Tauri/Rust
│   ├── src/
│   │   ├── main.rs             # Entry point Rust
│   │   ├── lib.rs              # Setup do Tauri + plugins
│   │   └── commands.rs         # Comandos: convert_pdf, save_markdown, open_folder
│   ├── binaries/               # Sidecar compilado (gerado pelo build:python)
│   ├── capabilities/           # Permissões Tauri
│   ├── icons/                  # Ícones do aplicativo
│   ├── Cargo.toml
│   └── tauri.conf.json
├── python/                     # Sidecar Python
│   ├── converter.py            # Conversor PDF → Markdown
│   ├── build.py                # Script de empacotamento PyInstaller
│   ├── requirements.txt        # Dependências Python
│   └── test_converter.py       # Testes unitários
├── skills/                     # Referências de UI/UX (uso manual)
├── .venv/                      # Ambiente virtual Python (não versionado)
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── roadmap.md                  # Checklist de implementação
```

---

## Limpar cache e builds

```powershell
# Limpar build Tauri/Rust
Remove-Item -Recurse -Force src-tauri\target

# Limpar build Python
Remove-Item -Recurse -Force python\dist, python\build

# Limpar sidecar compilado
Remove-Item -Recurse -Force src-tauri\binaries

# Limpar node_modules
Remove-Item -Recurse -Force node_modules
npm install

# Limpar modelos Docling (libera ~1-2 GB)
# ATENÇÃO: precisará baixar novamente na próxima conversão
Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\huggingface\hub"
```

---

## Limitações conhecidas

- **Cancelamento de conversão:** não implementado no MVP. O processo Python roda até o fim.
  A arquitetura está preparada (o PID do sidecar é acessível via `tauri-plugin-shell`) para
  implementação futura.

- **Primeiro uso:** o Docling precisa baixar modelos ML (~1-2 GB). O aplicativo exibe aviso,
  mas não há barra de progresso do download.

- **Múltiplos PDFs:** apenas um arquivo por vez no MVP.

- **OCR:** o Docling pode realizar OCR básico, mas a configuração avançada não está exposta na
  interface do MVP.

---

## Solução de problemas

### "Sidecar não encontrado"
Execute `npm run build:python` com o ambiente virtual ativado antes de usar a conversão.

### "Conversor encerrou com código 1"
Verifique se o arquivo PDF não está corrompido ou protegido por senha.

### Primeira conversão lenta
Normal — o Docling está baixando os modelos. Conexão à internet necessária apenas nesta etapa.

### Erro de compilação Rust: "link.exe not found"
Instale o Visual Studio Build Tools com suporte a C++ (ver seção de Pré-requisitos).

### PyInstaller falha com erro de módulo
Certifique-se de que o ambiente virtual está ativado antes de executar `npm run build:python`.

### "WebView2 não encontrado"
Baixe e instale o WebView2 Runtime: https://developer.microsoft.com/en-us/microsoft-edge/webview2/

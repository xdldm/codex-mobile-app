# Codex Mobile

App mobile interno em Expo + React Native + TypeScript.

## Setup

Instale as dependencias dentro desta pasta:

```powershell
cd E:\codex-mobile-app\mobile
npm install
```

## Desenvolvimento visual

```powershell
npx expo start
```

Se o Metro mostrar `Unable to deserialize cloned data` ao ler o cache,
limpe o cache do Expo/Metro e inicie novamente:

```powershell
npm run start:clear
```

Para visualizar no navegador:

```powershell
npx expo start --web
```

Por padrao, no web o app tenta acessar:

```text
http://127.0.0.1:8787
```

Em mobile fisico, o default aponta para o Bridge dentro do tunnel WireGuard:

```text
http://10.77.77.1:8787
```

Tambem e possivel sobrescrever no start:

```powershell
$env:EXPO_PUBLIC_BRIDGE_URL="http://127.0.0.1:8787"
npx expo start
```

## Build config

Builds internos leem variaveis `CODEX_MOBILE_*` via `app.config.js`. Com o
transporte WireGuard, sao apenas duas — de preferencia em `mobile/.env.local`,
que e ignorado pelo Git:

```text
CODEX_MOBILE_GATEWAY=http
CODEX_MOBILE_API_BASE_URL=http://10.77.77.1:8787
```

Ou por variavel de ambiente no terminal do build:

```powershell
$env:CODEX_MOBILE_GATEWAY="http"
$env:CODEX_MOBILE_API_BASE_URL="http://10.77.77.1:8787"
```

**Nenhum segredo entra no APK.** A chave privada do WireGuard e gerada pelo app
do WireGuard no proprio aparelho e nunca sai dele. Nao ha usuario, senha nem
chave embutida no build.

A URL salva em Settings tem precedencia sobre o default de build, e sobrevive a
`adb install -r`.

Os gateways suportados sao `http` (padrao) e `mock`. Qualquer outro valor cai em
`http`.

## Scripts

```powershell
npm run typecheck
npm test
npm run web
```

## Funcionalidades

- Health e capabilities do Bridge.
- Selecao de repositorio (`GET /v1/workspaces`), com navegador de pastas (`GET /v1/filesystem/roots|children`) e adicionar/remover da allowlist (`POST /v1/workspaces/add|remove|restore`).
- Selecao de modelo, reasoning effort e service tier (`GET /v1/settings/models`).
- Gestao de conversas (`GET /v1/threads?cwd=...`), incluindo renomear e arquivar.
- Chat em streaming (`POST /v1/threads/:id/runs/stream`) com renderizacao Markdown.
- Timeline estruturada de atividade, ferramentas e aprovacoes human-in-the-loop, com cancelamento.
- Mentions estruturadas no composer (`$app` / `$skill` / `$mcp`) e navegacao de recursos MCP.
- Anexos no composer: escolhe um arquivo pelo seletor do sistema, le em base64, envia para `POST /v1/uploads` e anexa o caminho ao run (imagens vao como imagem; o resto como referencia de caminho).
- Copiar resposta: botao `Copy` (ou toque longo) no balao do Codex copia o texto e o codigo da resposta pelo `expo-clipboard`.
- Limites de conta e presets de modo de execucao (sandbox, approval policy, network).
- Settings para URL do Bridge e defaults do Codex.

## Estrutura

- `src/screens/`: telas (`HomeScreen`, `SettingsScreen`, `ConversationsScreen`, `RepositoriesScreen`).
  - `src/screens/home/` e `src/screens/settings/`: subcomponentes e `styles.ts` de cada tela grande.
- `src/components/`: componentes reutilizaveis (`IconAction`, `MarkdownText`, `Screen`, ...).
- `src/state/BridgeProvider.tsx`: estado central e cliente do bridge (contexto React, hook `useBridge`).
- `src/domain/`: tipos e logica de dominio (tipos do bridge, mentions, partes de mensagem, parsing de historico, opcoes do composer).
- `src/api/`: cliente HTTP/SSE.
- `src/config/`, `src/storage/`, `src/theme/`, `src/utils/`: build config, preferencias, tema e utilidades.
- `assets/`: fontes do icone (`icon.svg`, `adaptive-icon.svg`, `splash-icon.svg`) e os PNGs consumidos pelo `app.json`. O projeto Android ja vem com os mipmaps e o icone adaptativo em `android/app/src/main/res`.

## Icones

Os PNGs em `assets/` e os recursos em `android/app/src/main/res/` sao gerados a partir dos SVG em `assets/` — qualquer rasterizador de SVG serve (`rsvg-convert`, Inkscape, `sharp`).

- `icon.svg`: icone base (iOS, favicon e icones legados do Android).
- `adaptive-icon.svg`: primeiro plano do icone adaptativo; a marca fica a 75% para caber na zona segura de 66% recortada pelas mascaras do Android.
- `splash-icon.svg`: marca do splash nas cores do tema claro (o fundo do splash e branco).

Tamanhos usados: 1024 para `icon.png` e `adaptive-icon.png`, 48 para `favicon.png`, 48/72/96/144/192 para `mipmap-*/ic_launcher.png` e `ic_launcher_round.png`, 108/162/216/324/432 para `mipmap-*/ic_launcher_foreground.png`, e 288/432/576/864/1152 para `drawable-*/splashscreen_logo.png`.

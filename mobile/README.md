# Tauri + Vue + TypeScript

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Backend configuration

The mobile frontend talks to the backend through `src/services/backend.ts`.

Set `VITE_BACKEND_URL` to your backend base URL (defaults to `http://127.0.0.1:3000`):

```bash
VITE_BACKEND_URL=http://192.168.1.12:3000 bun run dev
```

## iOS signing (Tauri)

iOS builds require an Apple Development Team ID.

Set this environment variable before running `tauri ios build` (or in CI secrets/env):

```bash
export APPLE_DEVELOPMENT_TEAM=YOUR_TEAM_ID
```

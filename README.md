# vue-project

## AI Agent Workflow

Workflow chuẩn cho AI agent nằm ở `AGENTS.md`.

Quick check trước khi agent báo cáo kết quả:

```sh
./scripts/agent-check.sh auto
```

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) 
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

## OneSignal Web Push

Frontend env:

```env
VITE_ONESIGNAL_APP_ID=
```

Backend env in `python-api/.env`:

```env
ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
ONESIGNAL_API_URL=https://api.onesignal.com/notifications
APP_PUBLIC_URL=https://your-frontend-domain.example
```

The service worker file must be served from the site root at `/OneSignalSDKWorker.js`.

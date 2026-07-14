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

Backend env:

```env
APP_PUBLIC_URL=https://your-production-domain.example
ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
```

Frontend đăng ký thiết bị và gắn `external_id` bằng ID user sau khi đăng nhập. Backend gửi push theo cùng `external_id` cho mọi notification đã được tạo trong ứng dụng; REST API key chỉ được giữ ở backend.

Các sự kiện ticket hiện phát đồng thời notification trong ứng dụng, realtime và OneSignal gồm: tạo ticket, phản hồi, phân công, nhận xử lý, thay đổi trạng thái, xử lý xong, mở lại và từ chối ticket.

Ứng dụng hiển thị hộp hỏi quyền thông báo; nếu chọn `Để sau`, hộp hỏi sẽ xuất hiện lại ở lần mở ứng dụng tiếp theo.

The service worker file must be served from the site root at `/OneSignalSDKWorker.js`. The OneSignal Dashboard web origin must match the deployed frontend origin.

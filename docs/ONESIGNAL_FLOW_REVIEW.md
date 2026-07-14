# OneSignal Notification Flow Review

## 1. Tóm tắt luồng hiện tại

Ứng dụng có 2 loại thông báo:

1. **In-app notification**
   - Lưu trong bảng `notifications`.
   - Hiển thị ở bell popover và trang `/notifications`.
   - Realtime qua WebSocket `/api/realtime/ws/notifications`.

2. **Device push notification bằng OneSignal**
   - Frontend dùng OneSignal Web SDK để đăng ký browser/device.
   - Frontend lấy `OneSignal.User.PushSubscription.id`.
   - Frontend gửi subscription id về backend.
   - Backend lưu mapping `user_id -> subscription_id` trong bảng `notification_subscriptions`.
   - Backend gửi push bằng OneSignal REST API với `include_subscription_ids`.

Nguyên tắc hiện tại:

- Không dùng `OneSignal.login()`.
- Không dùng `addTag`, `addTags`, `addAlias` từ frontend.
- Không gọi `api.onesignal.com` từ frontend.
- Không đưa `ONESIGNAL_REST_API_KEY` lên frontend.
- Backend là nơi duy nhất gọi OneSignal REST API.

## 2. Cấu hình bắt buộc

### 2.1 App ID phải đồng nhất

Frontend, backend và OneSignal Dashboard phải dùng **cùng một OneSignal App ID**.

Frontend build-time env:

```env
VITE_ONESIGNAL_APP_ID=<onesignal-app-id>
```

Backend runtime env:

```env
ONESIGNAL_APP_ID=<onesignal-app-id>
ONESIGNAL_REST_API_KEY=<rest-api-key-cua-cung-app-id>
APP_PUBLIC_URL=https://ops.guta.asia
ONESIGNAL_API_URL=https://api.onesignal.com/notifications
```

Lưu ý:

- `VITE_ONESIGNAL_APP_ID` được embed vào bundle lúc build, đổi biến này phải build/deploy frontend lại.
- `ONESIGNAL_REST_API_KEY` phải thuộc cùng app với `ONESIGNAL_APP_ID`.
- Nếu frontend dùng app A, backend dùng app B, hoặc dashboard đang mở app C thì sẽ thấy trạng thái rất khó hiểu.

### 2.2 Case đang nghi ngờ hiện tại

Log browser gần đây cho thấy app đang init với App ID:

```text
25a0ae6f-8f3f-4747-8bc8-e5234f8c41f3
```

Trong khi trước đó App ID từng được cung cấp là:

```text
1c4f879e-5e79-4460-bd90-2edd71bafdcd
```

Nếu đang mở dashboard của `1c4...` nhưng app đang chạy `25a0...`, thì bật trong app sẽ không thấy subscription/user xuất hiện ở dashboard `1c4...`.

Cần chốt một App ID duy nhất rồi cấu hình đồng bộ:

```env
VITE_ONESIGNAL_APP_ID=<same-app-id>
ONESIGNAL_APP_ID=<same-app-id>
ONESIGNAL_REST_API_KEY=<rest-api-key-of-same-app>
```

### 2.3 Worker file

Production phải serve được file này tại root domain:

```text
https://ops.guta.asia/OneSignalSDKWorker.js
```

Nội dung file hiện tại:

```js
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js')
```

Nếu worker không serve đúng root path, OneSignal Web Push có thể không subscribe được hoặc không nhận push nền.

### 2.4 OneSignal Dashboard Web Config

Trong OneSignal Dashboard, Web Push origin phải đúng domain đang chạy app:

```text
https://ops.guta.asia
```

Nếu test local, origin local cũng phải được OneSignal cho phép nếu app id đó hỗ trợ whitelist local.

Lỗi domain thường gặp:

```text
Can only be used on: https://ops.guta.asia
```

## 3. Frontend flow hiện tại

### 3.1 File chính

- `src/services/onesignal_service.js`
- `src/layout/default.vue`
- `src/pages/NotificationsPage.vue`
- `src/services/notification_service.js`
- `public/OneSignalSDKWorker.js`

### 3.2 Khi user login/vào app

Layout authenticated kiểm tra trạng thái subscription:

```http
GET /api/notifications/subscriptions/status
```

Nếu backend báo user đã có subscription active:

- Không hiện prompt.
- Không đăng ký lại.

Nếu backend báo chưa có subscription active:

- App kiểm tra user có opt-out local chưa.
- Nếu user chưa opt-out, app thử gọi native browser/OneSignal permission prompt.
- Nếu browser chặn prompt vì chưa có user gesture, app đợi click/keydown đầu tiên rồi gọi lại.

Không có custom prompt UI.

### 3.3 Khi user bấm bật ở trang `/notifications`

Flow bật thủ công:

1. Clear opt-out local của user.
2. Load OneSignal SDK:

```text
https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js
```

3. Init SDK:

```js
OneSignal.init({ appId })
```

4. Gọi native permission prompt:

```js
OneSignal.Notifications.requestPermission()
```

5. Nếu browser permission đã `granted`, gọi opt-in lại OneSignal subscription:

```js
OneSignal.User.PushSubscription.optIn()
```

6. Đọc subscription id:

```js
OneSignal.User.PushSubscription.id
```

7. Gửi subscription id về backend:

```http
POST /api/notifications/subscriptions
```

Payload:

```json
{
  "subscription_id": "...",
  "platform": "web"
}
```

### 3.4 Khi user bấm tắt ở trang `/notifications`

Flow tắt hiện tại:

1. Frontend gọi:

```http
DELETE /api/notifications/subscriptions
```

2. Backend set tất cả subscription active của user hiện tại thành `is_active=false` trong DB app.
3. Frontend lưu opt-out local theo user:

```text
onesignal-push-opt-out:<userId> = 1
```

4. Auto prompt sẽ không tự bật lại cho user đã opt-out.

Lưu ý quan trọng:

- Tắt trong app chủ yếu tắt ở DB app, để backend không gửi push nữa.
- Nếu muốn trạng thái OneSignal Dashboard chuyển về subscribed lại sau khi đã unsubscribe, flow bật lại phải gọi `PushSubscription.optIn()`.
- Nếu dashboard vẫn hiển thị `unsubscribed`, cần kiểm tra SDK opt-in có thành công không và App ID có đúng dashboard không.

## 4. Backend flow hiện tại

### 4.1 File chính

- `python-api/app/api/routers/notifications.py`
- `python-api/app/models/notification_subscription.py`
- `python-api/app/services/notification_service.py`
- `python-api/app/api/routers/tickets.py`
- `python-api/app/api/routers/ticket_logs.py`
- `python-api/app/core/config.py`

### 4.2 API subscription

Check trạng thái user hiện tại:

```http
GET /api/notifications/subscriptions/status
```

Đăng ký subscription:

```http
POST /api/notifications/subscriptions
```

Tắt tất cả subscription active của user hiện tại:

```http
DELETE /api/notifications/subscriptions
```

Tắt một subscription cụ thể:

```http
DELETE /api/notifications/subscriptions/{subscription_id}
```

### 4.3 Chỗ gửi OneSignal thật sự

Chỉ có một hàm backend gọi OneSignal REST API:

```text
python-api/app/services/notification_service.py
send_onesignal_notifications(...)
```

Hàm này:

1. Check `ONESIGNAL_APP_ID` và `ONESIGNAL_REST_API_KEY`.
2. Load active subscriptions từ `notification_subscriptions`.
3. Gửi OneSignal payload bằng `include_subscription_ids`.

Payload chính:

```json
{
  "app_id": "<ONESIGNAL_APP_ID>",
  "include_subscription_ids": ["..."],
  "headings": {"vi": "...", "en": "..."},
  "contents": {"vi": "...", "en": "..."},
  "url": "..."
}
```

### 4.4 Những event hiện đang gửi OneSignal

Hiện chỉ có 2 luồng nghiệp vụ kích hoạt OneSignal:

1. **Tạo ticket mới**
   - Tạo notification kiểu `ticket_created`.
   - Gửi cho admin/handler phù hợp.

2. **Phản hồi/chat ticket**
   - Tạo notification kiểu `ticket_reply`.
   - Gửi cho requester/assignees phù hợp.

Chưa gửi OneSignal cho:

- Assign handler.
- Nhận xử lý.
- Rời xử lý.
- Resolve.
- Reopen.
- Update ticket.

## 5. Vì sao bật trong app nhưng OneSignal Dashboard không thấy subscription/user

Đây là checklist quan trọng nhất cho lỗi hiện tại.

### 5.1 Đang nhìn sai OneSignal App ID

Dấu hiệu:

- Browser log có `appId=<id-a>`.
- Dashboard đang mở app `<id-b>`.
- DB app có subscription id nhưng dashboard đang xem không thấy user/subscription.

Cách kiểm tra:

1. Mở console browser, xem log OneSignal có appId nào.
2. Kiểm tra frontend bundle đang dùng App ID nào:

```js
import.meta.env.VITE_ONESIGNAL_APP_ID
```

Trong production không đọc trực tiếp được `import.meta.env`, có thể search built bundle hoặc log tạm trong dev.

3. Kiểm tra env:

```sh
VITE_ONESIGNAL_APP_ID
ONESIGNAL_APP_ID
```

4. Kiểm tra OneSignal Dashboard URL/app đang mở có đúng app đó không.

Kỳ vọng:

```text
Frontend VITE_ONESIGNAL_APP_ID == Backend ONESIGNAL_APP_ID == Dashboard App ID
```

### 5.2 REST API Key không cùng app

Dấu hiệu:

- Frontend subscribe được.
- DB có subscription active.
- Backend gửi push fail hoặc dashboard app không thấy delivery đúng.

Cách kiểm tra:

- `ONESIGNAL_REST_API_KEY` phải lấy từ cùng app với `ONESIGNAL_APP_ID`.
- Không dùng REST API key của app khác.

### 5.3 Service worker/site data còn cache app cũ

Dấu hiệu:

- Đã đổi env/build nhưng browser log vẫn hiện App ID cũ.
- OneSignal dashboard vẫn hiện trạng thái cũ.
- Browser vẫn gửi operation `update-subscription` với app id cũ.

Cách reset sạch:

1. DevTools > Application > Service Workers.
2. Unregister service worker của domain.
3. DevTools > Application > Storage.
4. Clear site data.
5. Hard refresh.
6. Login lại và bật lại notification.

### 5.4 Browser permission là granted nhưng OneSignal subscription là unsubscribed

Dấu hiệu:

- Browser permission vẫn `granted`.
- OneSignal dashboard subscription status là `unsubscribed`.
- Bấm bật không thấy native permission prompt vì browser đã được cấp quyền rồi.

Cách xử lý trong code hiện tại:

- Khi bật lại, app gọi `OneSignal.User.PushSubscription.optIn()`.
- Sau đó app đọc lại `OneSignal.User.PushSubscription.id`.
- Nếu opt-in fail, dashboard vẫn có thể giữ trạng thái `unsubscribed`.

Cần kiểm tra console có lỗi dạng:

```text
Op failed (no retry): update-subscription
```

Nếu có lỗi này, kiểm tra App ID, service worker cache, domain config, và browser/site data.

### 5.5 App chỉ lưu DB, không đồng bộ ngược từ OneSignal Dashboard

Nếu bạn xoá user/subscription trong OneSignal Dashboard:

- DB app không tự biết.
- `/notifications` có thể vẫn báo đã bật nếu DB app còn `is_active=true`.
- Cần bấm `Tắt thông báo` trong app hoặc update DB app để set inactive.

Nếu muốn sync hai chiều thật sự cần thêm webhook hoặc reconcile job từ OneSignal, hiện chưa có.

### 5.6 Native prompt không hiện khi gọi tự động

Browser có thể không cho hiện permission prompt nếu không có user gesture.

Code hiện tại đã xử lý:

- Thử gọi sau login.
- Nếu không hiện, chờ click/keydown đầu tiên rồi gọi lại.

Nếu permission đã `denied`, browser sẽ không hiện prompt nữa. User phải tự vào Site settings để Allow.

## 6. Checklist test sạch từ đầu

### 6.1 Reset browser

1. Mở `https://ops.guta.asia`.
2. DevTools > Application > Service Workers > Unregister.
3. DevTools > Application > Storage > Clear site data.
4. Đóng tab, mở lại domain.

### 6.2 Verify env/app id

Kiểm tra production đang dùng cùng App ID ở cả frontend/backend:

```env
VITE_ONESIGNAL_APP_ID=<same-app-id>
ONESIGNAL_APP_ID=<same-app-id>
ONESIGNAL_REST_API_KEY=<same-app-rest-key>
```

Nếu đổi `VITE_ONESIGNAL_APP_ID`, phải build/deploy frontend lại.

### 6.3 Bật notification

1. Login.
2. Vào `/notifications`.
3. Bấm `Bật thông báo` nếu chưa tự prompt.
4. Cho phép native browser notification.
5. Kiểm tra Network có:

```http
POST /api/notifications/subscriptions
```

6. Kiểm tra DB:

```sql
select id, user_id, subscription_id, is_active, created_at, last_seen_at
from notification_subscriptions
where user_id = <USER_ID>
order by id desc;
```

Kỳ vọng:

- Có record `is_active=true`.
- `subscription_id` giống subscription id bên OneSignal Dashboard của cùng app.

### 6.4 Kiểm tra OneSignal Dashboard

Trong đúng OneSignal app:

- Vào Audience/Subscriptions.
- Search subscription id nếu dashboard hỗ trợ.
- Kiểm tra trạng thái không phải `unsubscribed`.
- Gửi test push từ dashboard tới subscription đó.

### 6.5 Test app gửi push

1. User nhận đã bật notification.
2. User khác tạo ticket hoặc reply ticket có liên quan.
3. Backend log kỳ vọng:

```text
OneSignal push sent: notification_id=... recipient_id=... subscriptions=1.
```

Nếu log:

```text
OneSignal push skipped: no active subscriptions for recipients=[...]
```

thì DB app chưa có subscription active cho user nhận.

Nếu log:

```text
Failed to send OneSignal notification ... status=... body=...
```

thì xem body OneSignal trả về để biết sai app id, key, subscription id hoặc payload.

## 7. Ý nghĩa log `Op failed update-subscription`

Ví dụ log:

```text
Op failed (no retry): update-subscription appId=... subscriptionId=...
```

Ý nghĩa:

- OneSignal SDK/service worker đang cố update subscription lên OneSignal.
- Operation này xảy ra trong browser SDK, không phải backend app.
- Nếu operation fail, dashboard có thể không cập nhật user/subscription đúng dù app có lấy được subscription id.

Nguyên nhân thường gặp:

1. App ID không đúng dashboard đang kiểm tra.
2. Service worker/site data còn cache app cũ.
3. Domain không khớp Web Push config trong OneSignal Dashboard.
4. Subscription đang `unsubscribed` và opt-in fail.
5. Browser/extension/network chặn request của OneSignal SDK.

Cách xử lý ưu tiên:

1. Đồng bộ App ID frontend/backend/dashboard.
2. Clear site data + unregister service worker.
3. Bật lại notification.
4. Kiểm tra dashboard đúng app.
5. Nếu vẫn lỗi, copy full console log và Network request OneSignal liên quan.

## 8. Checklist CI/CD

Frontend GitHub Actions cần set:

```env
VITE_ONESIGNAL_APP_ID=<same-app-id>
```

Backend production runtime cần set:

```env
ONESIGNAL_APP_ID=<same-app-id>
ONESIGNAL_REST_API_KEY=<same-app-rest-key>
APP_PUBLIC_URL=https://ops.guta.asia
ONESIGNAL_API_URL=https://api.onesignal.com/notifications
```

Không set `ONESIGNAL_REST_API_KEY` vào frontend build env.

## 9. Kết luận hiện tại

Nếu bật thông báo trong app nhưng OneSignal Dashboard không thấy subscription/user, khả năng cao nhất hiện tại là:

1. Đang lệch OneSignal App ID giữa app và dashboard.
2. Browser/service worker vẫn cache App ID cũ.
3. Subscription đang `unsubscribed` và OneSignal SDK update/opt-in fail.
4. DB app còn active nhưng OneSignal Dashboard đã xoá subscription, hai bên không tự sync.

Trước khi sửa code thêm, cần chốt một App ID duy nhất và test sạch sau khi clear service worker/site data.

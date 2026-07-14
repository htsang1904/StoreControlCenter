# OneSignal Notification Flow Review

## 1. Mục tiêu hiện tại

Tích hợp OneSignal Web Push để người dùng nhận thông báo ticket trên máy tính, song song với hệ thống in-app notification hiện có.

Luồng hiện tại giữ 2 lớp:

1. **In-app notification**
   - Lưu record trong bảng `notifications`.
   - Bell popover và trang `/notifications` đọc từ backend.
   - Realtime bằng WebSocket `/api/realtime/ws/notifications`.

2. **Web Push notification**
   - Frontend đăng ký browser/device với OneSignal.
   - Backend lưu mapping `user_id -> subscription_id`.
   - Backend gọi OneSignal REST API để gửi push theo `subscription_id`.

## 2. Cấu hình cần có

### Frontend build-time env

Biến này phải có khi GitHub Actions chạy `npm run build`:

```env
VITE_ONESIGNAL_APP_ID=1c4f879e-5e79-4460-bd90-2edd71bafdcd
```

### Backend runtime env

Các biến này phải có khi backend container/process chạy:

```env
ONESIGNAL_APP_ID=1c4f879e-5e79-4460-bd90-2edd71bafdcd
ONESIGNAL_REST_API_KEY=<secret>
APP_PUBLIC_URL=https://ops.guta.asia
```

`ONESIGNAL_API_URL` có default trong code:

```env
ONESIGNAL_API_URL=https://api.onesignal.com/notifications
```

### Worker file

Frontend phải serve được file này từ root domain:

```text
/OneSignalSDKWorker.js
```

File hiện tại:

```js
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js')
```

## 3. Frontend flow hiện tại

### File chính

- `src/services/onesignal_service.js`
- `src/pages/NotificationsPage.vue`
- `src/plugins/app.js`
- `src/services/notification_service.js`

### Flow sau khi user login

1. `src/plugins/app.js` fetch profile user sau login hoặc khi app initialize.
2. App gọi:

```js
bindOneSignalUser(user, { requestPermission: false })
```

3. Vì `requestPermission=false`, app chỉ cố bind nếu browser đã có permission/subscription; không bật native permission prompt ngay.
4. User vào trang `/notifications` để bật thông báo.
5. Khi user bấm `Bật thông báo`:
   - App init OneSignal SDK.
   - App gọi `OneSignal.Notifications.requestPermission()`.
   - App đọc `OneSignal.User.PushSubscription.id` hoặc fallback sang browser Push API endpoint.
   - App gọi `POST /api/notifications/subscriptions` để lưu subscription.

### Flow tại trang `/notifications`

Trang `/notifications` cũng có block bật thông báo:

1. Check `pushState`.
2. Nếu chưa bật, user có thể bấm `Bật thông báo`.
3. Gọi cùng flow `bindOneSignalUser(user, { requestPermission: true })`.

### Điểm đã xử lý trên frontend

- Có timeout 12 giây cho thao tác OneSignal để tránh kẹt `Đang bật...`.
- Nếu SDK đã init trước đó và báo `already initialized`, app xem như init thành công.
- Không dùng `OneSignal.login()` nữa vì production từng lỗi ở `LoginManager.ts`.
- App đang tự lưu mapping user/subscription trong backend, nên không phụ thuộc OneSignal external identity.

## 4. Backend flow hiện tại

### File chính

- `python-api/app/api/routers/notifications.py`
- `python-api/app/models/notification_subscription.py`
- `python-api/app/services/notification_service.py`
- `python-api/app/api/routers/tickets.py`
- `python-api/app/api/routers/ticket_logs.py`

### API subscription

Frontend đăng ký subscription qua:

```http
POST /api/notifications/subscriptions
```

Payload:

```json
{
  "subscription_id": "...",
  "external_id": "<user_id>",
  "platform": "web"
}
```

Backend upsert theo `subscription_id`:

- Nếu subscription đã tồn tại, chuyển nó sang user hiện tại.
- Set `is_active=true`.
- Update `last_seen_at`.

Logout gọi:

```http
DELETE /api/notifications/subscriptions/{subscription_id}
```

Backend set `is_active=false` nếu subscription thuộc user hiện tại.

### Khi tạo notification

Hiện có 2 nhóm event tạo notification:

1. **Ticket created**
   - Gửi cho admin active.
   - Gửi cho handler active cùng `responsible_department_id`.
   - Không gửi cho chính người tạo.

2. **Ticket reply**
   - Gửi cho requester.
   - Gửi cho assignees.
   - Hiện tại `include_actor=True`, nghĩa là người phản hồi cũng có thể nhận notification của chính họ.

Sau khi notification được lưu DB:

1. Backend emit WebSocket event `notification.created`.
2. Backend gọi OneSignal REST API nếu có config và có active subscriptions.
3. Backend gửi payload OneSignal bằng `include_subscription_ids`.

## 5. Database/migration

### Bảng mới

```text
notification_subscriptions
```

Các field chính:

- `user_id`
- `subscription_id`
- `external_id`
- `platform`
- `is_active`
- `last_seen_at`
- `created_at`
- `updated_at`

### Migration liên quan

- `b8f4c2d9e7a1_add_notification_subscriptions.py`
  - Tạo bảng `notification_subscriptions`.

- `c9e1f2a3b4d5_backfill_notification_timestamps.py`
  - Backfill `notifications.created_at` bị null.
  - Set default `now()` cho `notifications.created_at` và `updated_at`.

Production phải chạy:

```sh
cd python-api
alembic upgrade head
```

## 6. Những điểm đang bất hợp lý/rủi ro

### 6.1 Không dùng `OneSignal.login()`

Hiện tại app đã bỏ `OneSignal.login()` vì production lỗi SDK nội bộ:

```text
Cannot read properties of undefined (reading 'Qe')
```

Tác động:

- Push vẫn hoạt động vì backend gửi bằng `include_subscription_ids`.
- Nhưng OneSignal dashboard có thể không map user đẹp theo external user id.
- Nếu sau này muốn gửi push theo external id hoặc segment user trên OneSignal thì cần xử lý lại.

Đánh giá: **chấp nhận được cho thiết kế hiện tại**, vì source of truth là DB app.

### 6.2 `subscription_id` có unique global và có thể bị chuyển user

Backend upsert theo `subscription_id`. Nếu cùng browser đăng nhập user A rồi user B:

- Subscription đó sẽ chuyển từ user A sang user B.
- Đây là hợp lý nếu browser/device hiện tại thuộc session user B.

Rủi ro:

- Nếu logout không gọi được API deactivate, record cũ vẫn active cho user cũ cho đến khi user khác login và upsert lại.
- Có thể gửi nhầm push tới browser shared nếu người dùng dùng chung máy nhưng không logout đúng.

Đề xuất:

- Khi login user mới, nên đảm bảo subscription hiện tại được upsert sang user mới như hiện tại.
- Có thể bổ sung cleanup inactive/last_seen về lâu dài.

### 6.3 Logout chỉ deactivate subscription đang nhớ trong memory

`registeredSubscriptionId` là biến memory trong frontend. Nếu reload app rồi logout trước khi refresh subscription đọc lại được id, có thể không deactivate đúng subscription.

Đề xuất:

- Lưu `registeredSubscriptionId` vào `localStorage` để logout ổn định hơn.
- Hoặc thêm API `DELETE /api/notifications/subscriptions/current-device` sau khi đọc lại subscription từ SDK.

### 6.4 Prompt có thể hiện lại sau mỗi session nếu user bấm `Để sau`

Hiện `dismissed` chỉ là state runtime. Reload/logout-login có thể hiện lại.

Đánh giá:

- Có lợi vì ép user cũ bật thông báo.
- Nhưng có thể gây phiền nếu user cố tình chưa muốn bật.

Đề xuất:

- Nếu muốn mềm hơn, lưu `dismissedUntil` vào localStorage theo user, ví dụ nhắc lại sau 1 ngày.
- Nếu muốn bắt buộc nghiệp vụ, giữ như hiện tại.

### 6.5 Timeout chỉ tránh treo UI, không đảm bảo OneSignal hoàn tất

Timeout 12 giây giúp nút không kẹt `Đang bật...`, nhưng nếu OneSignal SDK phản hồi chậm hơn thì thao tác có thể fail dù sau đó SDK hoàn tất.

Đề xuất:

- Giữ timeout để UX không treo.
- Cho user bấm thử lại.
- Log lỗi ở frontend nếu cần debug production.

### 6.6 `include_actor=True` ở ticket reply

Hiện reply ticket có thể tạo notification cho chính người vừa reply.

Tác động:

- User có thể nhận push cho hành động của chính mình.
- Có thể gây nhiễu.

Đề xuất:

- Nếu nghiệp vụ không cần tự nhận, đổi `include_actor=False` ở `ticket_logs.py`.
- Nếu muốn mọi người trong ticket đều có timeline notification, giữ như hiện tại.

### 6.7 Event coverage còn hạn chế

Hiện push mới có cho:

- Tạo ticket.
- Reply ticket.

Chưa có cho:

- Assign handler.
- Nhận xử lý.
- Rời xử lý.
- Resolve.
- Reopen.
- Update ticket/store/department.

Đề xuất:

- Xác định danh sách event cần push trước khi mở rộng.
- Không nên push mọi update để tránh spam.

### 6.8 Production không được inject OneSignal init bên ngoài app

Nếu production template/CDN/tag manager còn đoạn:

```html
<script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
<script>
  OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({ appId: "..." });
  });
</script>
```

thì có nguy cơ SDK init trùng.

Hiện app đã có xử lý `already initialized`, nhưng best practice vẫn là:

- Chỉ để Vue app quản lý SDK/init.
- Không inject init snippet bên ngoài.

## 7. Đề xuất cải thiện tiếp theo

### Ưu tiên cao

1. **Quyết định có gửi notification cho actor không**
   - Nếu không muốn người reply nhận thông báo của chính họ, đổi `include_actor=False`.

2. **Lưu subscription id vào localStorage**
   - Giúp logout deactivate ổn định hơn.

3. **Thêm trạng thái debug nhẹ cho admin/dev**
   - Không show technical error cho user thường.
   - Có thể log `pushState` ở dev mode.

### Ưu tiên trung bình

4. **Thêm unsubscribe/current-device endpoint**
   - Backend có endpoint deactivate subscription hiện tại dễ hơn.

5. **Thêm retry hoặc refresh subscription định kỳ**
   - Khi user vào app, nếu permission đã granted nhưng DB chưa có subscription thì auto register lại.

6. **Mở rộng event push có kiểm soát**
   - Assign handler.
   - Resolve/reopen.
   - Claim/release handler.

### Ưu tiên thấp

7. **Khôi phục OneSignal external identity nếu cần dashboard segmentation**
   - Chỉ làm khi chắc SDK không bị init trùng và cần gửi theo external id.
   - Hiện tại không bắt buộc.

## 8. Checklist test production

### Test subscription

1. Login user nhận thông báo.
2. Bấm `Bật thông báo`.
3. Browser permission chọn `Allow`.
4. Kiểm tra Network có:

```http
POST /api/notifications/subscriptions
```

5. Kiểm tra DB:

```sql
select id, user_id, subscription_id, is_active, created_at, last_seen_at
from notification_subscriptions
order by id desc
limit 10;
```

Kỳ vọng `is_active=true` cho user đang login.

### Test push

1. User B bật thông báo.
2. User A tạo/reply ticket có liên quan tới User B.
3. Backend log kỳ vọng:

```text
OneSignal push sent: notification_id=... recipient_id=... subscriptions=1.
```

4. User B nhận:
   - Bell notification.
   - Browser push notification.

### Test lỗi thường gặp

- Nếu log:

```text
OneSignal push skipped: no active subscriptions for recipients=[...]
```

thì user nhận chưa đăng ký subscription hoặc subscription inactive.

- Nếu log:

```text
OneSignal push skipped: missing config app_id=True api_key=False.
```

thì backend thiếu `ONESIGNAL_REST_API_KEY`.

- Nếu frontend báo domain OneSignal không đúng, kiểm tra domain trong OneSignal Dashboard phải khớp production origin.

## 9. Kết luận

Thiết kế hiện tại phù hợp với hướng app tự quản lý subscription trong DB và backend gửi push theo `subscription_id`. Điểm bất hợp lý lớn nhất hiện tại là không dùng OneSignal external identity do lỗi production SDK, nhưng điều này không ảnh hưởng đến luồng push ticket hiện tại.

Nếu muốn luồng đơn giản và ổn định: giữ thiết kế hiện tại, tập trung làm chắc subscription registration, logout cleanup và event coverage.

Nếu muốn dùng sâu OneSignal dashboard/segment/external id: cần xử lý triệt để vấn đề init SDK trùng và khôi phục `OneSignal.login()` sau.

# Báo Cáo Màn Hình Quản Lý Ticket

## 1. Phạm vi khảo sát

Tài liệu này mô tả hiện trạng màn hình quản lý ticket tại `src/pages/TicketManagementPage.vue`, các composable/service liên quan, API đang dùng và các điểm bất hợp lý cần cân nhắc cải thiện.

Các file chính đã khảo sát:

- `src/pages/TicketManagementPage.vue`
- `src/composables/useTicketList.js`
- `src/composables/useTicketReportSummary.js`
- `src/composables/useTicketPresentation.js`
- `src/services/ticket_service.js`
- `src/router/index.js`
- `python-api/app/api/routers/tickets.py`
- `python-api/app/api/routers/dashboard.py`

## 2. Mục đích của màn hình

Màn hình quản lý ticket dùng để:

- Xem tổng quan số lượng ticket theo bộ lọc ngày/cửa hàng.
- Tra cứu danh sách ticket theo mã, tiêu đề hoặc nội dung.
- Lọc ticket theo trạng thái.
- Xem nhanh thông tin ticket: mã ticket, tiêu đề, cửa hàng/phòng ban, trạng thái, người xử lý, ngày tạo, thời gian xử lý.
- Điều hướng sang chi tiết ticket.
- Điều hướng sang chế độ inbox.
- Điều hướng sang màn hình tạo ticket.
- Cho phép sửa/xoá/mở lại ticket ở giao diện mobile/card khi đủ điều kiện quyền và trạng thái.

## 3. Route frontend liên quan

Các route ticket hiện có trong `src/router/index.js`:

| Route | Page | Mục đích |
| --- | --- | --- |
| `/ticket` | `TicketManagementPage.vue` | Màn hình quản lý/danh sách ticket |
| `/ticket/inbox` | `TicketInboxPage.vue` | Giao diện inbox để xử lý ticket theo dạng hội thoại/danh sách |
| `/ticket/add-ticket` | `AddTicketPage.vue` | Tạo ticket mới |
| `/ticket/:id/edit` | `AddTicketPage.vue` | Sửa ticket |
| `/ticket/:id` | `TicketDetailPage.vue` | Xem chi tiết ticket |

## 4. UI hiện có trên màn hình quản lý ticket

### 4.1. Khu vực thẻ thống kê

Nguồn dữ liệu: `useTicketReportSummary()`.

Hiện có 4 thẻ:

| Thẻ | Ý nghĩa | Field backend |
| --- | --- | --- |
| `Tổng ticket` | Tổng số ticket theo bộ lọc hiện tại | `summary.total_ticket` |
| `Đang chờ hỗ trợ` | Ticket đang xử lý/cần hỗ trợ | `summary.in_progress` |
| `Đã hoàn thành` | Ticket đã xử lý xong | `summary.resolved` |
| `Cần phản hồi` | Ticket quá hạn hoặc sát hạn | `summary.overdue` |

Ghi chú: label đã được chuẩn hoá thành `Tổng ticket` để khớp với dữ liệu thực tế theo `date_from`, `date_to`, `store_ids` từ query route.

### 4.2. Toolbar và bộ lọc

Các thành phần đang có:

- Nút `Chế độ inbox`: chuyển sang `/ticket/inbox`.
- Ô tìm kiếm `Tìm mã ticket, tiêu đề hoặc nội dung...`: debounce 400ms hoặc nhấn Enter, đồng bộ `q` lên query URL.
- Dropdown `Trạng thái`: lọc nhiều trạng thái bằng checkbox và đồng bộ lên query URL.
- Nút `Tạo ticket`: chuyển sang `/ticket/add-ticket`.

Trạng thái lọc lấy từ `ticketStatusOptions`:

- `new` → `Mới`
- `in_progress` → `Đang xử lý`
- `resolved` → `Hoàn thành`
- `closed` → `Đã đóng`
- `rejected` → `Cần phản hồi`

### 4.3. Bảng desktop

Bảng desktop chỉ hiển thị ở breakpoint `pc` trở lên.

Các cột hiện có:

| Cột | Dữ liệu hiển thị | Mục đích |
| --- | --- | --- |
| `Mã ticket` | `ticket.ticket_code` hoặc `#id` | Nhận diện ticket |
| `Tiêu đề & Nội dung` | `title` và subline cửa hàng/phòng ban | Xem nhanh nội dung/ngữ cảnh |
| `Trạng thái` | `normalizeTicketStatus(status)` | Xem trạng thái xử lý |
| `Người xử lý` | assignee đầu tiên hoặc `Chưa phân công` | Xem người đang xử lý |
| `Ngày tạo` | ngày + giờ tạo | Xem thời điểm phát sinh |
| `Thời gian xử lý` | `processing_duration_label` và cảnh báo nếu có | Theo dõi SLA/thời gian xử lý |
| `Thao tác` | `Sửa`, `Mở lại`, `Xoá` nếu đủ điều kiện | Thao tác nhanh ngay trên desktop |

Hành vi:

- Click vào một dòng ticket sẽ chuyển sang `/ticket/:id`.
- Click các nút trong cột `Thao tác` sẽ không mở detail nhờ `@click.stop`.
- Khi đang tải dữ liệu có `v-loading="loading"`.
- Khi có lỗi API, hiển thị box lỗi phía trên bảng.

### 4.4. Card mobile

Mobile dùng card thay vì table.

Thông tin hiển thị:

- Mã ticket.
- Tiêu đề.
- Subline cửa hàng/phòng ban.
- Badge trạng thái.
- Người xử lý.
- Ngày tạo.
- Thời gian xử lý.
- Cảnh báo quá hạn nếu có.
- Action `Sửa`, `Mở lại`, `Xoá` nếu role/trạng thái cho phép.
- Empty state có CTA `Trợ lý tạo ticket`, đồng bộ với desktop.

### 4.5. Phân trang

Phân trang nằm ở cuối section:

- Hiển thị khoảng record đang xem: `paginationStart` → `paginationEnd` trên tổng `pagination.total` ticket.
- Có nút previous/next.
- Có danh sách page, rút gọn bằng dấu `...` nếu nhiều trang.
- `pageSize` mặc định là `10`.

## 5. API frontend đang dùng

Các API được khai báo tại `src/services/ticket_service.js`.

### 5.1. API màn hình quản lý ticket đang gọi trực tiếp

| Hàm frontend | Method + Endpoint | Được dùng ở | Mục đích |
| --- | --- | --- | --- |
| `getDashboardOverview(params)` | `POST /api/dashboard/overview` | `useTicketReportSummary.js` | Lấy số liệu thẻ tổng quan |
| `listTickets(params)` | `GET /api/tickets?...` | `useTicketList.js` | Lấy danh sách ticket có phân trang/lọc/search |
| `deleteTicket(id)` | `DELETE /api/tickets/{id}` | `useTicketList.js` | Xoá ticket |
| `reopenTicket(id)` | `POST /api/tickets/{id}/reopen` | `useTicketList.js` | Mở lại ticket đã resolved |

### 5.2. API ticket khác trong service nhưng không phải luồng chính của table

| Hàm frontend | Method + Endpoint | Mục đích |
| --- | --- | --- |
| `createTicket(payload)` | `POST /api/tickets/create` | Tạo ticket |
| `getTicketById(id)` | `GET /api/tickets/{id}` | Lấy chi tiết ticket |
| `updateTicket(id, payload)` | `PUT /api/tickets/{id}` | Cập nhật ticket |
| `listTicketAssignees(id)` | `GET /api/tickets/{id}/assignees` | Lấy danh sách assignee |
| `listAssignableTicketHandlers(id)` | `GET /api/tickets/{id}/assignable-handlers` | Lấy handler có thể gán |
| `assignTicketHandler(id, handlerId)` | `POST /api/tickets/{id}/assignees` | Gán handler |
| `claimTicket(id)` | `POST /api/tickets/{id}/assignees/me` | Handler tự nhận xử lý |
| `resolveTicket(id)` | `POST /api/tickets/{id}/resolve` | Đánh dấu đã xử lý |
| `listTicketLogs(ticketId)` | `GET /api/tickets/{ticketId}/logs` | Lấy log/phản hồi ticket |
| `createTicketLog(payload)` | `POST /api/ticket-logs/create` | Tạo phản hồi/log |
| `uploadTicketAttachments(formData)` | `POST /api/tickets/upload-attachments` | Upload ảnh đính kèm |
| `getActiveDepartments()` | `GET /api/departments/active` | Lấy phòng ban active cho form tạo/sửa |

## 6. API backend tương ứng

### 6.1. `GET /api/tickets`

Khai báo tại `python-api/app/api/routers/tickets.py`.

Query params:

| Param | Ý nghĩa |
| --- | --- |
| `page` | Trang hiện tại, mặc định `1` |
| `pageSize` | Số item/trang, mặc định `10`, tối đa `100` |
| `q` | Search theo `title`, `ticket_code`, `description` |
| `status` | Danh sách status phân tách bằng dấu phẩy |
| `date_from` | Lọc theo ngày tạo từ |
| `date_to` | Lọc theo ngày tạo đến |
| `store_ids` | Lọc theo danh sách store, không áp dụng trực tiếp cho role `store` |

Phân quyền dữ liệu:

- Role `store`: chỉ thấy ticket thuộc store được gán.
- Role `handler`: thấy ticket thuộc phòng ban của mình hoặc ticket mình được assign.
- Role khác như `admin`: thấy theo filter truyền vào.

Response chính:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 0,
    "pageCount": 0
  }
}
```

### 6.2. `POST /api/dashboard/overview`

Khai báo tại `python-api/app/api/routers/dashboard.py`.

Payload frontend gửi từ màn hình quản lý:

```json
{
  "date_from": "...",
  "date_to": "...",
  "store_ids": "1,2,3",
  "top_stores_limit": 20,
  "activity_limit": 12
}
```

Màn hình quản lý hiện chỉ dùng phần `summary`:

- `total_ticket`
- `in_progress`
- `resolved`
- `overdue`

API này cũng có logic RBAC tương tự:

- Role `store`: giới hạn theo store được gán hoặc requester là chính user.
- Role `handler`: giới hạn theo phòng ban hoặc ticket được assign.

### 6.3. `DELETE /api/tickets/{id}`

Dùng để xoá ticket.

Rule backend:

- Admin được xoá.
- User không phải admin chỉ xoá được ticket mà mình là requester.
- Backend xoá log, assignee relation và null notification ticket_id để tránh lỗi FK.

### 6.4. `POST /api/tickets/{id}/reopen`

Dùng để mở lại ticket.

Rule backend:

- Chỉ role `admin` hoặc `store` được mở lại.
- Ticket được chuyển về `in_progress`.
- `resolved_at` được reset về `null`.
- Có tạo system log và emit realtime event.

## 7. Luồng dữ liệu hiện tại

### 7.1. Khi vào màn hình `/ticket`

1. `TicketManagementPage.vue` đọc query route gồm `date_from`, `date_to`, `store_ids`.
2. `syncReportRangeFromRoute()` đồng bộ khoảng ngày/store cho report summary.
3. Gọi song song:
   - `fetchTicketReports()` → `POST /api/dashboard/overview`
   - `fetchTickets()` → `GET /api/tickets`
4. Render thẻ thống kê và danh sách ticket.

### 7.2. Khi search

1. User nhập từ khoá.
2. Page tự debounce 400ms sau khi nhập hoặc chạy ngay khi nhấn Enter.
3. Page cập nhật `q` lên query URL và xoá `page` khỏi query.
4. Watcher route đồng bộ `searchInput`, `filters.q`, reset page về `1`.
5. Gọi lại `GET /api/tickets`.

### 7.3. Khi lọc trạng thái

1. User tick/untick checkbox trạng thái.
2. `filters.statuses` được cập nhật.
3. Page cập nhật `status` lên query URL và xoá `page` khỏi query.
4. Watcher route đồng bộ status, reset page về `1`.
5. Gọi lại `GET /api/tickets` với `status=new,in_progress,...`.

### 7.4. Khi đổi query ngày/store

1. Watcher theo dõi `route.query.date_from`, `route.query.date_to`, `route.query.store_ids`.
2. Đồng bộ filter trong `useTicketList` và `useTicketReportSummary`.
3. Gọi lại report summary và list ticket.

## 8. Quyền và điều kiện action trên UI

### 8.1. Sửa ticket

Frontend cho phép hiển thị action sửa khi:

- Role là `store` hoặc `admin`.
- Ticket có status `new`.
- Ticket chưa có `assignees`.

Điểm lưu ý: action sửa hiện chỉ xuất hiện ở card mobile, chưa thấy action tương đương trong table desktop.

### 8.2. Xoá ticket

Frontend hiện chỉ hiển thị action xoá khi:

- Role `admin`.
- Hoặc role `store` và user hiện tại là requester của ticket.

Backend thực tế cho phép:

- Admin xoá mọi ticket.
- User không phải admin chỉ xoá ticket nếu là requester.

Điểm lưu ý: rule frontend đã được đồng bộ gần hơn với backend để hạn chế trường hợp store user thấy nút xoá nhưng backend reject `403`.

### 8.3. Mở lại ticket

Frontend cho phép role `store` hoặc `admin` mở lại ticket có status `resolved`.

Backend cũng dùng rule tương tự qua `can_reopen_ticket()`.

## 9. Các điểm bất hợp lý / cần cân nhắc cải thiện

### 9.1. Label thống kê đã được chuẩn hoá

Thẻ tổng hiện đã đổi thành `Tổng ticket`, phù hợp hơn với dữ liệu theo bộ lọc route `date_from`, `date_to`, `store_ids`.

### 9.2. Search placeholder đã khớp backend

Placeholder hiện đã đổi thành `Tìm mã ticket, tiêu đề hoặc nội dung...`, khớp với backend search cả `description`.

### 9.3. Desktop table đã có action sửa/xoá/mở lại

Desktop table hiện đã có cột `Thao tác`, đồng bộ với mobile card cho các action `Sửa`, `Mở lại`, `Xoá` khi đủ quyền/trạng thái.

### 9.4. Quyền xoá frontend đã được đồng bộ gần hơn với backend

Frontend hiện dùng rule:

- Admin được thấy action xoá.
- Store chỉ thấy action xoá khi là requester của ticket.

Đề xuất còn lại: nếu muốn chắc chắn hơn cho mọi role/case đặc biệt, backend có thể trả về field quyền như `permissions.can_delete` để UI hiển thị theo quyền đã tính từ server.

### 9.5. Text UI còn lẫn `yêu cầu` và `phiếu`

Một số message frontend trong màn hình quản lý đã đổi sang `ticket`, nhưng backend response vẫn còn dùng `yêu cầu`/`phiếu` ở một số lỗi/log nghiệp vụ.

Đề xuất:

- Chuẩn hoá toàn bộ wording frontend sang `ticket`.
- Backend message có thể giữ tiếng Việt nghiệp vụ, nhưng frontend nên normalize nếu muốn đồng nhất trải nghiệm.

### 9.6. State `selectedStores` dư đã được dọn khỏi page quản lý

`TicketManagementPage.vue` hiện đọc trực tiếp `route.query.store_ids` qua watcher chính để fetch summary/list, không còn state `selectedStores` trung gian khi page không có UI chọn store riêng.

### 9.7. Debug log đã được dọn ở summary flow

`useTicketReportSummary.js` đã bỏ debug log payload/error trong flow tải overview.

### 9.8. `hasTickets` export trong composable vẫn còn để dùng chung

`TicketManagementPage.vue` đã bỏ `tabTickets`/`hasTabTickets` trung gian và dùng trực tiếp `tickets` + computed cục bộ. `useTicketList()` vẫn export `hasTickets` như helper generic cho các màn dùng chung composable.

### 9.9. `fetchNextPage` tồn tại nhưng page đang dùng phân trang thường

`useTicketList()` có `fetchNextPage()` và `loadingMore`, phù hợp infinite scroll, nhưng màn hình quản lý hiện dùng pagination footer.

Đề xuất:

- Nếu không dùng infinite scroll ở page này, có thể tách composable hoặc bỏ export dư.
- Nếu dùng chung với inbox/mobile khác, nên ghi rõ mục đích trong code hoặc chỉ import ở nơi cần.

### 9.10. Filter/search/status đã reset page về 1 và đồng bộ URL

Khi query `date_from`, `date_to`, `store_ids`, `q`, `status` đổi, page hiện xoá `page` khỏi query nếu cần và fetch lại từ trang `1`. Khi chuyển trang, page ghi `page` lên query URL để có thể back/share link.

## 10. Đề xuất ưu tiên xử lý

### Ưu tiên cao

1. Chuẩn hoá wording backend/frontend nếu muốn toàn hệ thống dùng `ticket`.
2. Cân nhắc backend trả về `permissions` để UI không tự suy luận quyền.

### Ưu tiên trung bình

1. Rà các message backend nếu muốn bỏ hẳn `phiếu`/`yêu cầu`.
2. Modal confirm dùng chung đã thay thế native `window.confirm` trong frontend ticket flow.

### Ưu tiên thấp

1. Ghi chú dependency nếu filter store nằm ở layout/global filter.

## 11. Kết luận

Màn hình quản lý ticket hiện đã có đủ các chức năng cốt lõi để xem tổng quan, tìm kiếm, lọc trạng thái, phân trang và điều hướng xử lý ticket. API backend có RBAC tương đối rõ cho store/handler/admin. Các điểm cần cải thiện chủ yếu nằm ở tính nhất quán UI, wording, quyền action frontend so với backend và một số state/debug dư trong code.

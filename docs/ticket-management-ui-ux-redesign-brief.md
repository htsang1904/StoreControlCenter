# Ticket Management UI/UX Redesign Brief

## Mục tiêu

Redesign module quản lý ticket của Store Control Center theo hướng hiện đại, rõ vai trò, thao tác nhanh và vẫn giữ đầy đủ nghiệp vụ hiện có.

Module hiện có các route chính:

- `/ticket`: trang quản lý/tổng quan danh sách ticket.
- `/ticket/inbox`: workspace xử lý ticket dạng inbox/chat.
- `/ticket/add-ticket`: tạo ticket.
- `/ticket/:id`: xem chi tiết ticket.
- `/ticket/:id/edit`: chỉnh sửa ticket.

## Vai trò người dùng

### Store

Có thể:

- Tạo ticket.
- Xem ticket thuộc các store được gán.
- Sửa ticket nếu ticket còn mới và chưa có người xử lý.
- Xoá ticket của chính mình nếu được hệ thống cho phép.
- Gửi phản hồi trong ticket đang mở.
- Mở lại ticket đã xử lý.
- Upload ảnh đính kèm.

Không nên:

- Phân công handler.
- Đánh dấu ticket đã xử lý.
- Xem ticket ngoài store được gán.

### Handler

Có thể:

- Xem ticket thuộc bộ phận mình hoặc ticket được gán cho mình.
- Nhận xử lý ticket.
- Gửi phản hồi trong ticket đang mở.
- Upload ảnh phản hồi.
- Đánh dấu ticket đã xử lý nếu đã nhận ticket.

Không nên:

- Phân công handler khác nếu backend chỉ cho admin.
- Mở lại ticket đã resolved nếu backend không cho phép.
- Xử lý ticket không thuộc bộ phận/không được gán.

### Admin

Có thể:

- Xem tất cả ticket.
- Lọc/tìm kiếm toàn bộ ticket.
- Tạo ticket.
- Sửa ticket hợp lệ.
- Xoá ticket.
- Phân công handler.
- Nhận xử lý.
- Đánh dấu đã xử lý.
- Mở lại ticket.
- Từ chối ticket nếu có chức năng reject.
- Xem logs, assignees, attachments.

## Trạng thái ticket

UI cần hỗ trợ các trạng thái:

- `new`: ticket mới tạo, chưa được xử lý.
- `assigned`: đã được phân công.
- `in_progress`: đang xử lý.
- `resolved`: đã xử lý xong.
- `rejected`: bị từ chối.
- `closed`: đã đóng, nếu hệ thống có dùng.

Gợi ý badge màu:

- `new`: blue/indigo.
- `assigned`: amber/orange.
- `in_progress`: cyan/green.
- `resolved`: green/neutral.
- `rejected`: red/rose.
- `closed`: gray.

## Rule nghiệp vụ bắt buộc giữ nguyên

### Tạo ticket

- Endpoint tạo ticket: `POST /tickets/create`.
- Tất cả role đã đăng nhập có thể tạo ticket nếu backend cho phép.
- Role `store` chỉ được tạo ticket cho store nằm trong `store_ids` được gán.
- Ticket cần có cửa hàng, tiêu đề, mô tả, bộ phận phụ trách, loại ticket nếu có và ảnh đính kèm nếu có.

### Chỉnh sửa ticket

- Chỉ nên cho sửa khi ticket còn `new` và chưa có assignee.
- Store chỉ sửa ticket thuộc store được gán.
- Nếu đổi `store_id`, phải đảm bảo user có quyền với store mới.

### Phản hồi ticket

- Chỉ được phản hồi khi ticket có trạng thái `new`, `assigned`, `in_progress`.
- Không cho phản hồi khi ticket là `resolved`, `rejected`, `closed`.
- UI cần disable khung chat hoặc hiển thị thông báo rõ: “Ticket đã kết thúc, không thể phản hồi.”

### Nhận xử lý

- Role `handler` và `admin` có thể nhận xử lý ticket.
- Sau khi nhận xử lý, ticket chuyển sang `in_progress`.
- Handler cần nhận ticket trước khi đánh dấu đã xử lý.

### Phân công

- Chỉ admin được phân công handler nếu backend đang giới hạn như hiện tại.
- UI không nên hiện nút “Phân công” cho handler.
- Handler nên thấy nút “Nhận xử lý”.

### Đánh dấu đã xử lý

- Chỉ thực hiện khi ticket đang `in_progress`.
- Admin có thể đánh dấu đã xử lý.
- Handler chỉ được đánh dấu nếu là assignee của ticket.
- Store không được đánh dấu đã xử lý.

### Mở lại ticket

- Chỉ mở lại ticket đang `resolved`.
- Role được mở lại: `admin` hoặc `store`.
- Sau khi mở lại, ticket quay về `in_progress`.

### Upload ảnh

- Tối đa 5 ảnh/lần upload.
- Mỗi ảnh tối đa 5MB.
- Chỉ chấp nhận file ảnh.
- UI cần báo lỗi trước khi gửi nếu vượt số lượng/dung lượng.

## Trang `/ticket` — Ticket Management Dashboard

Đây là trang quản lý tổng quan. Nên thiết kế như dashboard + danh sách ticket.

### Header

Nên có:

- Tiêu đề: “Quản lý ticket”.
- Mô tả ngắn: “Theo dõi, lọc và xử lý yêu cầu từ cửa hàng.”
- Nút “Tạo ticket”.
- Nút “Mở inbox xử lý”.
- Nút refresh nếu cần.

### Summary cards

Hiển thị 4–6 card nhanh:

- Tổng ticket.
- Ticket mới.
- Đang xử lý.
- Chưa ai nhận.
- Đã xử lý.
- Cảnh báo/quá lâu chưa xử lý.

Mỗi card nên có số lượng, label, icon, màu trạng thái và có thể click để lọc nhanh.

### Filter bar

Bộ lọc nên có:

- Search theo mã ticket hoặc tiêu đề.
- Status multi-select.
- Store filter.
- Department filter.
- Date range.
- Assignee filter nếu là admin.
- Quick filters: “Tất cả”, “Cần xử lý”, “Của tôi”, “Chưa ai nhận”, “Đã xử lý”, “Quá hạn/cảnh báo”.

Trên mobile, filter nên thu gọn vào drawer hoặc bottom sheet.

### Ticket list

Có thể dùng card list thay vì table cứng. Mỗi ticket card cần có:

- Mã ticket.
- Tiêu đề.
- Mô tả ngắn.
- Status badge.
- Store.
- Bộ phận phụ trách.
- Người tạo.
- Người xử lý/assignee.
- Thời gian tạo.
- Thời gian cập nhật gần nhất.
- Cảnh báo thời gian xử lý nếu có.
- Số lượng phản hồi/ảnh nếu có.

Action trên mỗi ticket:

- “Xem”.
- “Mở trong inbox”.
- “Sửa” nếu được phép.
- “Mở lại” nếu được phép.
- “Xoá” nếu được phép.

Action chính nên là click card hoặc nút “Mở”.

### Empty/loading/error states

Cần có:

- Loading skeleton.
- Empty state khi chưa có ticket.
- Empty state khi filter không có kết quả.
- Error state khi API lỗi, có nút “Thử lại”.

## Trang `/ticket/inbox` — Ticket Workspace

Đây là màn xử lý chính, giống inbox/chat app.

### Layout desktop

Nên chia 2–3 cột:

- Cột trái: ticket sidebar.
- Khu vực chính: ticket detail + conversation.
- Cột phải hoặc drawer: metadata panel.

### Cột trái: Ticket sidebar

Bao gồm:

- Search ticket.
- Quick filter chips: “Tất cả”, “Mới”, “Đang xử lý”, “Của tôi”, “Chưa nhận”, “Đã xử lý”.
- Danh sách ticket dạng compact card.

Mỗi item sidebar nên có:

- Mã ticket.
- Tiêu đề.
- Status badge nhỏ.
- Store.
- Người gửi.
- Thời gian cập nhật.
- Assignee avatar nhỏ.
- Indicator nếu có phản hồi mới/cảnh báo.

### Khu vực chính: Detail + conversation

Header cố định trên cùng:

- Mã ticket.
- Tiêu đề.
- Status badge.
- Store.
- Bộ phận.
- Người xử lý/assignees.
- Thời gian tạo.
- SLA/cảnh báo nếu có.

Action bar theo role:

- Store: sửa nếu còn `new` và chưa có assignee, mở lại nếu `resolved`.
- Handler: nhận xử lý, đánh dấu đã xử lý nếu đủ điều kiện.
- Admin: phân công, nhận xử lý, đánh dấu đã xử lý, mở lại, xoá, từ chối nếu có.

Nếu action không hợp lệ:

- Không hiện action, hoặc hiện disabled kèm tooltip lý do.

Conversation timeline:

- Phân biệt message của store, handler/admin và system.
- System log là dòng nhỏ ở giữa timeline.
- Tin nhắn của user hiện tại có alignment riêng.
- Hiển thị tên người gửi, role, thời gian.
- Ảnh đính kèm hiển thị dạng thumbnail grid.
- Click ảnh mở preview modal/lightbox.

Reply composer:

- Textarea.
- Upload ảnh.
- Preview ảnh trước khi gửi.
- Nút gửi.
- Validation trước khi gửi:
  - Không gửi nếu không có nội dung và không có ảnh.
  - Không quá 5 ảnh.
  - Không ảnh nào quá 5MB.
  - Không gửi nếu ticket đã đóng/resolved/rejected.
- Khi gửi:
  - Disable button.
  - Hiện trạng thái đang gửi.
  - Nếu lỗi, giữ nội dung chưa gửi.

### Metadata panel

Có thể là panel phải hoặc drawer:

- Store.
- Người tạo.
- Bộ phận.
- Loại ticket.
- Ngày tạo.
- Ngày bắt đầu xử lý.
- Ngày resolved.
- Assignees.
- Attachments tổng hợp.
- Activity logs.
- Lịch sử trạng thái.

Trên mobile, panel này nên chuyển thành tab hoặc bottom sheet.

## Trang tạo/sửa ticket

### Form tạo ticket

Fields:

- Store.
- Tiêu đề.
- Bộ phận phụ trách.
- Loại ticket.
- Mô tả chi tiết.
- Ảnh đính kèm.

UX yêu cầu:

- Validate realtime.
- Store field chỉ hiện store user có quyền.
- Department bắt buộc.
- Upload ảnh có preview.
- Hiện giới hạn 5 ảnh/5MB.
- Sau khi tạo thành công, redirect tới `/ticket/inbox?ticket={id}` để user thấy ticket vừa tạo.

### Form sửa ticket

Chỉ cho sửa khi hợp lệ:

- Ticket `new`.
- Chưa có assignee.
- User có quyền.

Nếu không đủ điều kiện:

- Không nên cho vào form edit, hoặc hiển thị state: “Ticket đã có người xử lý nên không thể chỉnh sửa.”

## Action matrix theo role

| Action | Store | Handler | Admin |
|---|---:|---:|---:|
| Xem ticket của mình/store mình | Có | Theo bộ phận/assignee | Có |
| Tạo ticket | Có | Có nếu backend cho | Có |
| Sửa ticket mới chưa xử lý | Có | Không nên | Có |
| Xoá ticket | Có nếu là người tạo | Không | Có |
| Gửi phản hồi | Có nếu ticket mở | Có nếu ticket mở | Có nếu ticket mở |
| Upload ảnh | Có | Có | Có |
| Nhận xử lý | Không | Có | Có |
| Phân công handler | Không | Không | Có |
| Đánh dấu đã xử lý | Không | Có nếu là assignee | Có |
| Mở lại ticket resolved | Có | Không | Có |
| Từ chối ticket | Không | Không | Có nếu backend hỗ trợ |

## Vấn đề UX hiện tại cần giải quyết

### Hai màn `/ticket` và `/ticket/inbox` dễ gây nhầm

Cần làm rõ:

- `/ticket` là quản lý/tổng quan.
- `/ticket/inbox` là xử lý hội thoại.

Nên có CTA điều hướng qua lại rõ ràng.

### Action theo role cần chính xác hơn

Ví dụ:

- Handler không nên thấy “Phân công” nếu backend chỉ cho admin.
- Handler nên thấy “Nhận xử lý”.
- Store không nên thấy action xử lý nội bộ.

### Cần giải thích lý do action bị disable

Microcopy gợi ý:

- “Bạn cần nhận xử lý trước.”
- “Ticket đã resolved, không thể phản hồi.”
- “Chỉ admin được phân công.”
- “Ticket đã có người xử lý nên không thể sửa.”

### Cần tăng khả năng xử lý nhanh

Nên có:

- Quick filters.
- Open in inbox.
- Badge cảnh báo.
- Skeleton loading.
- Refresh.
- Pagination/load more rõ ràng.

### Chat/timeline cần trực quan hơn

Cần phân biệt:

- Store message.
- Handler/admin message.
- System log.
- Attachment.
- Status transition.

## Design direction

Phong cách phù hợp:

- Modern SaaS dashboard.
- Clean, professional, internal operations tool.
- Nhiều whitespace nhưng thông tin vẫn đủ dày.
- Card-based layout.
- Badge/status rõ.
- Sidebar inbox giống Slack/Linear/Intercom nhẹ.
- Không quá màu mè, ưu tiên tốc độ xử lý.

Visual system gợi ý:

- Primary: blue/indigo.
- Success: green.
- Warning: amber.
- Danger: rose/red.
- Neutral: slate/zinc.
- Background: light gray/off-white.
- Surface: white.
- Border: soft gray.

Components nên có:

- Status badge.
- User avatar/initial.
- Filter chips.
- Search input.
- Ticket card.
- Timeline item.
- Attachment preview.
- Action dropdown.
- Confirm dialog.
- Toast.
- Skeleton loader.
- Empty state.

## Responsive requirements

### Desktop

- `/ticket`: dashboard + filter + card/table list.
- `/ticket/inbox`: 2 hoặc 3 column layout.
- Sidebar ticket cố định, detail ở giữa.

### Tablet

- Sidebar có thể thu gọn.
- Metadata panel chuyển drawer.

### Mobile

- `/ticket`: card list, filter drawer.
- `/ticket/inbox`:
  - Mặc định hiện danh sách.
  - Khi chọn ticket, chuyển sang detail.
  - Có nút quay lại danh sách.
  - Composer luôn dễ bấm, không bị keyboard che.

## Acceptance criteria

Redesign được xem là đạt nếu:

- User mới vào hiểu ngay `/ticket` dùng để quản lý, `/ticket/inbox` dùng để xử lý.
- Mỗi role chỉ thấy action mình có thể làm.
- Không có action gây lỗi permission hiển nhiên do UI hiển thị sai.
- Tạo ticket nhanh và sau tạo mở đúng ticket vừa tạo.
- Handler có flow rõ: xem ticket, nhận xử lý, phản hồi, đánh dấu đã xử lý.
- Store có flow rõ: tạo ticket, theo dõi phản hồi, phản hồi thêm, mở lại nếu chưa hài lòng.
- Admin có flow rõ: lọc ticket, phân công/nhận xử lý, theo dõi tiến độ.
- Upload ảnh có preview và validation 5 ảnh/5MB.
- Ticket đã `resolved`, `rejected`, `closed` không cho reply, có thông báo rõ.
- Loading/empty/error states đầy đủ.
- Mobile dùng được tốt.

## Prompt dùng cho AI redesign

```text
Bạn là senior product designer + frontend architect. Hãy redesign UI/UX cho module Ticket Management của một internal SaaS tên Store Control Center.

Module có các route:
- /ticket: trang quản lý/tổng quan danh sách ticket
- /ticket/inbox: workspace xử lý ticket dạng inbox/chat
- /ticket/add-ticket: tạo ticket
- /ticket/:id: xem chi tiết ticket
- /ticket/:id/edit: chỉnh sửa ticket

Có 3 role chính:
1. Store: tạo ticket, xem ticket thuộc store được gán, sửa ticket mới chưa ai xử lý, phản hồi ticket đang mở, mở lại ticket đã resolved.
2. Handler: xem ticket thuộc bộ phận/được gán, nhận xử lý, phản hồi, upload ảnh, đánh dấu đã xử lý nếu là assignee.
3. Admin: xem tất cả, lọc, phân công handler, nhận xử lý, phản hồi, đánh dấu đã xử lý, mở lại, xoá, từ chối nếu có.

Ticket statuses:
- new
- assigned
- in_progress
- resolved
- rejected
- closed

Business rules:
- Tạo ticket dùng POST /tickets/create.
- Store chỉ tạo/sửa ticket trong store_ids được gán.
- Reply chỉ khi status là new, assigned, in_progress.
- Upload ảnh tối đa 5 ảnh/lần, mỗi ảnh tối đa 5MB.
- Handler cần nhận xử lý trước khi đánh dấu resolved.
- Chỉ admin được phân công handler.
- Chỉ admin/store được mở lại ticket resolved.
- Ticket đã có assignee hoặc không còn new thì không nên cho sửa.

Hãy đề xuất một UI mới hiện đại, rõ role/action, gồm:
- Information architecture
- Layout cho /ticket
- Layout cho /ticket/inbox
- Layout cho create/edit form
- Component list
- Action matrix theo role
- Empty/loading/error states
- Responsive behavior desktop/tablet/mobile
- Visual design direction
- UX microcopy cho tooltip/disabled action/error
- Acceptance criteria

Phong cách: modern SaaS dashboard, clean, professional, tối ưu cho vận hành nội bộ, giống Linear/Intercom/Slack inbox nhẹ. Không bỏ sót tính năng nghiệp vụ.
```

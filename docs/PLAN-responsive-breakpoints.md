# PLAN-responsive-breakpoints

## 1. Mục tiêu

Refactor toàn bộ frontend để responsive chỉ còn 3 trạng thái rõ ràng:

- `mobile`: layout mặc định
- `tablet`: layout trung gian
- `pc`: layout desktop

Mục tiêu chính là loại bỏ cảm giác "resize nhẹ là layout nhảy", do hiện tại dự án đang trộn nhiều breakpoint `sm / md / lg / xl` trong cùng một flow.

Plan này chỉ mô tả lộ trình refactor an toàn. Không bao gồm đổi framework, đổi dependency lớn, hay redesign giao diện ngoài yêu cầu responsive.

## 1.1. Trạng thái hiện tại

- Breakpoint chuẩn đã được đưa về:
  - `mobile`: `< 768px`
  - `tablet`: `768px - 1023px`
  - `pc`: `>= 1024px`
- Frontend shell và các page chính đã migrate sang `tablet:` và `pc:`.
- Đã bổ sung composable dùng chung:
  - `src/composables/useResponsive.js`
- Đã bổ sung guardrail tự động:
  - `scripts/check-responsive-breakpoints.sh`
- Guardrail sẽ fail nếu trong `src/` xuất hiện lại:
  - `sm:`, `md:`, `lg:`, `xl:`, `2xl:`, `3xl:`
  - prefix arbitrary kiểu `min-[...]` hoặc `max-[...]`
  - viewport logic JS rải rác ngoài `useResponsive.js`

## 2. Phạm vi

### Trong scope

- Frontend layout shell:
  - `src/layout/default.vue`
  - `src/layout/Sidebar.vue`
  - `src/layout/Header.vue`
  - `src/layout/HeaderDateControls.vue`
- Frontend pages và shared components có dùng breakpoint.
- Chuẩn hóa breakpoint cho cả:
  - utility classes
  - logic JS dựa trên viewport
  - CSS/media query rời rạc

### Ngoài scope

- Backend API.
- Đổi route flow.
- Thay thư viện UI hiện có.
- Tối ưu pixel-perfect từng màn ngoài phạm vi responsive.

## 3. Hiện trạng đã audit

### Dấu hiệu phân mảnh breakpoint

- Frontend đang dùng Tailwind v4 qua `@tailwindcss/vite`.
- Theme gốc đang đặt ở `src/assets/main.css`, nhưng chưa thấy breakpoint được chuẩn hóa tập trung.
- Có tổng cộng khoảng `240` lần dùng prefix responsive trong `src/`.
- Các prefix đang xuất hiện:
  - `sm:` khoảng `89`
  - `md:` khoảng `82`
  - `lg:` khoảng `21`
  - `xl:` khoảng `48`
- Có ít nhất `1` media query viết tay:
  - `src/components/WelcomeItem.vue`

### Điểm nóng cần ưu tiên

- `src/pages/TicketDetailPage.vue`: `27` lần dùng breakpoint
- `src/pages/AdminQcFormEditorPage.vue`: `17`
- `src/layout/Sidebar.vue`: `14`
- `src/pages/AddTicketPage.vue`: `13`
- `src/pages/TicketInboxPage.vue`: `11`
- `src/pages/LoginPage.vue`: `10`

### Coupling giữa CSS và JS

- `src/layout/default.vue` đang có `DRAWER_BREAKPOINT = 1024`.
- Điều này cho thấy sidebar đã có một breakpoint JS riêng, nhưng phần template/CSS lại vẫn dùng nhiều ngưỡng khác nhau.
- Kết quả là cùng một thao tác resize có thể kích hoạt nhiều kiểu đổi layout khác nhau ở shell, page, toolbar và content pane.

## 4. Responsive model đích

### Breakpoint chuẩn hóa đề xuất

- `mobile`: `< 768px`
- `tablet`: `>= 768px` và `< 1024px`
- `pc`: `>= 1024px`

### Quy ước code sau refactor

- Base class = `mobile`
- Chỉ dùng thêm đúng 2 prefix:
  - `tablet:`
  - `pc:`
- Không dùng lại `sm:`, `md:`, `lg:`, `xl:`, `2xl:` trong code mới

### Lý do chọn mốc này

1. Phù hợp với `DRAWER_BREAKPOINT = 1024` đang tồn tại ở shell.
2. Giảm số ngưỡng chuyển layout từ 4-5 mốc xuống còn 2 mốc thật sự.
3. Hạn chế việc laptop/desktop bị đổi bố cục chỉ vì resize nhẹ trong cùng vùng desktop.
4. Giảm effort migrate vì phần lớn layout hiện tại đã ngầm xoay quanh `md` và `lg`.

## 5. Nguyên tắc refactor

1. `Mobile-first` là mặc định cho mọi page và component.
2. Chỉ đổi layout ở mức cấu trúc khi qua `tablet` hoặc `pc`.
3. Không dùng breakpoint chỉ để chỉnh các thay đổi rất nhỏ như tăng giảm vài pixel padding nếu có thể giải quyết bằng giá trị fluid hoặc spacing thống nhất.
4. Mọi logic viewport trong JS phải đi qua một nguồn dùng chung, không hard-code rải rác.
5. Bảng dữ liệu, split-view, sidebar, drawer là các phần được phép đổi mode theo breakpoint.
6. Typography và spacing nên giữ mượt, tránh tạo thêm cảm giác "nhảy layout".
7. Refactor theo module nhỏ, không sửa toàn bộ tất cả page trong một PR.

## 6. Kiến trúc triển khai đề xuất

### A. Một nguồn sự thật cho breakpoint

Tạo một chuẩn breakpoint dùng chung cho toàn app:

- Theme breakpoint trong `src/assets/main.css` hoặc một file theme chuyên biệt.
- Hằng số JS dùng chung, ví dụ:
  - `src/constants/breakpoints.js`
  - hoặc composable `src/composables/useResponsive.js`

JS và template phải cùng bám một bộ giá trị `768 / 1024`.

### B. Phân loại pattern layout

Không migrate từng class một cách mù quáng. Trước hết gom UI về một số pattern chuẩn:

- `Shell layout`:
  - mobile/tablet = drawer
  - pc = sidebar cố định
- `Inbox / split workspace`:
  - mobile/tablet = một pane tại một thời điểm
  - pc = danh sách + detail song song
- `Dense data table`:
  - mobile/tablet = card list hoặc stacked rows
  - pc = bảng đầy đủ
- `Form editor`:
  - mobile = 1 cột
  - tablet = 1-2 cột tùy block
  - pc = 2 cột hoặc content + side panel
- `Stats dashboard`:
  - mobile = 1 cột
  - tablet = 2 cột
  - pc = 4 cột hoặc grid desktop

### C. Guardrail sau migrate

Sau mỗi phase, repo phải tiến gần về trạng thái:

- không còn `sm:`
- không còn `xl:`
- giảm dần `md:` và `lg:`
- không còn media query viết tay ngoài trường hợp thật sự đặc biệt

## 7. Phase triển khai

### Phase 0. Foundation

- Chốt spec breakpoint chính thức:
  - mobile `<768`
  - tablet `768-1023`
  - pc `>=1024`
- Khai báo breakpoint tập trung trong theme.
- Tạo helper/composable JS dùng chung cho viewport state.
- Viết guideline ngắn trong repo:
  - base = mobile
  - chỉ thêm `tablet:` và `pc:`
  - cấm class responsive ngoài chuẩn mới

Deliverable:

- breakpoint spec
- shared constants/composable
- guideline migrate

Risk:

- Nếu không khóa quy ước từ đầu, code mới sẽ tiếp tục thêm `sm/xl`

### Phase 1. Refactor shell và navigation

Ưu tiên xử lý các file đang quyết định cảm giác resize của toàn app:

- `src/layout/default.vue`
- `src/layout/Sidebar.vue`
- `src/layout/Header.vue`
- `src/layout/HeaderDateControls.vue`

Mục tiêu:

- Shell chỉ có 3 mode: mobile / tablet / pc
- Sidebar/drawer không đổi mode ngoài 2 ngưỡng 768 và 1024
- Header spacing và controls không đổi liên tục theo nhiều breakpoint nhỏ

Acceptance:

- Resize trong vùng `>=1024` không làm sidebar/layout nhảy mode
- Resize trong vùng `768-1023` không mở thêm mode trung gian lạ

### Phase 2. Ticket module

Nhóm file:

- `src/pages/TicketManagementPage.vue`
- `src/pages/TicketInboxPage.vue`
- `src/pages/TicketDetailPage.vue`
- `src/pages/AddTicketPage.vue`

Mục tiêu:

- Đồng bộ experience của ticket theo 3 mode duy nhất
- `TicketInboxPage` và `TicketDetailPage` dùng cùng rule split-pane
- Table/list của ticket chỉ chuyển mode ở `pc`
- Form tạo ticket không bị nhảy nhiều nấc vì `sm + lg + xl`

Acceptance:

- Inbox:
  - mobile/tablet = danh sách hoặc detail
  - pc = split view
- Ticket management:
  - mobile/tablet = card/list compact
  - pc = table đầy đủ
- Ticket detail:
  - side panel chỉ xuất hiện ở `pc`

### Phase 3. QC module và admin pages

Nhóm file:

- `src/pages/QCManagementPage.vue`
- `src/pages/QCStoreDetailPage.vue`
- `src/pages/QCCreateSessionPage.vue`
- `src/pages/AdminQcFormEditorPage.vue`
- `src/pages/AdminQcFormDetailPage.vue`
- `src/pages/AdminStoreSyncPage.vue`
- `src/pages/ToolsPage.vue`
- `src/pages/DashboardPage.vue`

Mục tiêu:

- Loại bỏ grid `md/xl` chồng nhau nếu không thật cần
- Chuẩn hóa stats grid, form editor, detail side panel
- Các màn QC dài và dày thông tin phải ổn định trên tablet trước, rồi mới mở layout rộng cho pc

Acceptance:

- Dashboard stats: `1 / 2 / 4` cột tương ứng mobile / tablet / pc
- Editor QC: không đổi 3-4 kiểu layout chỉ khi resize ngang nhỏ
- QC detail: side summary hoặc detail rail chỉ mở ở `pc`

### Phase 4. Shared components và cleanup

Nhóm file:

- `src/components/CommonModal.vue`
- `src/components/DateRangePicker.vue`
- `src/components/ReportPeriodDropdown.vue`
- `src/components/QCCriterionTreeItem.vue`
- `src/components/AdminQcCriterionBuilderItem.vue`
- `src/components/WelcomeItem.vue`

Mục tiêu:

- Dọn các responsive utility còn sót
- Xóa media query viết tay nếu không cần
- Chuẩn hóa modal, toolbar, dropdown, form controls theo 3 mode mới

Acceptance:

- Shared component không mang theo breakpoint cũ làm "rò" sang page mới

### Phase 5. Audit cuối và khóa chuẩn

- Search toàn repo để tìm breakpoint cũ còn sót
- Gắn checklist vào workflow review:
  - không thêm `sm/md/lg/xl`
  - không thêm `window.innerWidth` magic number
- Kiểm tra lại từng route chính

Deliverable:

- responsive audit pass
- checklist duy trì chuẩn mới

## 8. Task breakdown đề xuất theo PR

### PR1. Responsive foundation + shell

- Breakpoint theme
- Shared JS responsive helper
- `default.vue`
- `Sidebar.vue`
- `Header.vue`
- `HeaderDateControls.vue`

### PR2. Ticket flow responsive

- `TicketManagementPage.vue`
- `TicketInboxPage.vue`
- `TicketDetailPage.vue`
- `AddTicketPage.vue`

### PR3. QC/Admin responsive

- Dashboard, QC, tools, QC form editor/detail, store sync

### PR4. Shared component cleanup + final audit

- Shared components
- Remove legacy breakpoints
- Grep audit + manual QA

## 9. Quy tắc migrate class

### Mapping khái niệm

- `sm:` hiện tại:
  - đa số là tinh chỉnh spacing/text nhỏ
  - ưu tiên kéo về base hoặc `tablet:`
- `md:` hiện tại:
  - đa số map sang `tablet:`
- `lg:` hiện tại:
  - đa số map sang `pc:`
- `xl:` hiện tại:
  - phần lớn cần xem lại:
    - nếu là desktop thật sự, map sang `pc:`
    - nếu chỉ để "mở rộng thêm chút", bỏ hẳn

### Không migrate cơ học 1-1

Phải review theo intent:

- đổi cấu trúc?
- đổi mật độ?
- đổi mode điều hướng?
- hay chỉ là spacing tweak?

Nếu chỉ là spacing tweak, ưu tiên bỏ breakpoint thay vì đổi tên breakpoint.

## 10. Rủi ro chính

1. `TicketDetailPage.vue` đang vừa có split layout, vừa có chiều cao dựa trên `dvh`, nên dễ vỡ khi gộp breakpoint.
2. `Sidebar.vue` và `default.vue` đang coupled bằng JS viewport state, cần refactor cùng nhau.
3. `AdminQcFormEditorPage.vue` và `QCCreateSessionPage.vue` có nhiều form/grid lồng nhau, dễ bị vỡ layout tablet nếu migrate quá nhanh.
4. Preline hoặc dropdown/menu auto-init có thể phụ thuộc vào `hidden/block` và bị ảnh hưởng khi đổi class theo breakpoint.

## 11. Validate bắt buộc sau mỗi phase

### Validate kỹ thuật

- `node -v`
- `npm -v`
- `npm run build`

Lưu ý hiện repo yêu cầu Node `20.19+` hoặc `22.12+`.

### Validate thủ công theo viewport

Test tối thiểu ở các mốc:

- `390px` mobile
- `768px` tablet bắt đầu
- `820px` tablet phổ biến
- `1024px` pc bắt đầu
- `1280px` pc rộng

Test thêm ngay sát ngưỡng:

- `767px` / `768px`
- `1023px` / `1024px`

Mục tiêu:

- chỉ đổi layout khi băng qua đúng 2 ngưỡng chính
- không có thêm mode trung gian lạ

### Smoke routes tối thiểu

- `/dashboard`
- `/ticket`
- `/ticket/inbox`
- `/ticket/:id`
- `/ticket/add-ticket`
- `/QC`
- `/QC/store/:storeId`
- `/QC/store/:storeId/create`
- `/tools`
- `/tools/qc-forms/:id/edit`
- `/login`

## 12. Kết quả mong muốn sau refactor

- Người dùng chỉ cảm nhận 3 mode layout rõ ràng: mobile, tablet, pc.
- Resize trong desktop không còn làm UI nhảy liên tục giữa nhiều mode nhỏ.
- Code responsive dễ đọc hơn vì chỉ còn base + `tablet:` + `pc:`.
- Responsive logic của CSS và JS dùng chung cùng một bộ breakpoint.

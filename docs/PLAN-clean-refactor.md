# PLAN-clean-refactor

## 1. Mục tiêu

Lập lộ trình refactor dự án theo hướng:

- Giảm file quá tải trách nhiệm.
- Giảm logic lặp giữa frontend/backend.
- Tách legacy code khỏi luồng hiện tại.
- Giữ nguyên hành vi nghiệp vụ hiện có, đặc biệt ở ticket flow và QC flow.

Plan này chỉ phục vụ triển khai refactor an toàn theo từng phase. Không bao gồm thay đổi tính năng.

## 2. Phạm vi

### Trong scope

- Frontend shared helpers/composables.
- Frontend page/layout cleanup.
- Backend helper/domain extraction cho ticket.
- Dọn cấu trúc service QC.
- Chuẩn hóa checklist validate khi refactor.

### Ngoài scope

- Đổi framework.
- Thay dependency lớn.
- Viết lại toàn bộ ticket/QC flow.
- Đổi API contract nếu không thật sự cần.

## 3. Assumptions

- Ưu tiên giữ nguyên behavior trước, làm sạch cấu trúc sau.
- Refactor theo phase nhỏ, mỗi phase merge độc lập được.
- Các invariant trong `AGENTS.md` là nguồn sự thật cao hơn mọi quyết định refactor.
- Node cần chuyển sang `20.x` trước khi chạy validate chuẩn repo.

## 4. Nguyên tắc thực hiện

1. Mỗi phase chỉ xử lý một nhóm concern rõ ràng.
2. Không refactor frontend và backend domain lớn cùng lúc nếu không cần.
3. Sau mỗi phase phải có validate tối thiểu theo scope thay đổi.
4. Nếu phát hiện code legacy chưa thể xóa, phải cô lập và đánh dấu rõ vai trò.
5. Với ticket/QC, mọi thay đổi phải bám smoke test nghiệp vụ hiện có.

## 5. Ưu tiên theo Impact / Effort

### P1. Shared Date Range Helper

- Priority: P1
- Impact: Cao
- Effort: Thấp
- Lý do:
  - Logic date-range đang lặp ở nhiều nơi:
    - `src/pages/DashboardPage.vue`
    - `src/pages/TicketManagementPage.vue`
    - `src/pages/QCManagementPage.vue`
    - `src/layout/Header.vue`
- Mục tiêu:
  - Tạo composable/helper dùng chung cho:
    - `toIsoDate`
    - `shiftDays` hoặc tương đương
    - `isValidYmd`
    - `getDefaultRange`
    - `normalizeRangeFromQuery`
- Output mong muốn:
  - Một util/composable mới dùng chung.
  - Các page/layout trên chuyển sang dùng chung helper đó.
- Risk:
  - Sai khác behavior timezone nếu normalize không khớp implementation cũ.
- Verify:
  - Chuyển tab Dashboard / Ticket / QC vẫn giữ đúng query `date_from`, `date_to`.

### P2. Shared Ticket Permission / Visibility Helper

- Priority: P1
- Impact: Cao
- Effort: Trung bình
- Lý do:
  - Rule ticket đang lặp giữa:
    - `api/src/api/ticket/controllers/ticket.js`
    - `api/src/api/ticket-log/controllers/ticket-log.js`
  - Rủi ro drift rule rất cao.
- Mục tiêu:
  - Tách helper domain chung cho:
    - role helpers
    - store access
    - assignee checks
    - `canViewTicket`
    - `canReplyOnTicket`
    - `canManageAssignees`
- Output mong muốn:
  - 1 file helper domain dùng chung, ví dụ `api/src/utils/ticket-permissions.js`.
  - Controller ticket và ticket-log chỉ gọi helper chung.
- Risk:
  - Lệch behavior permission nếu gom hàm không đủ coverage.
- Verify:
  - Smoke test create/view/reply/claim/unassign/resolve/reopen theo role.

### P3. Tách Header Thành Component Con

- Priority: P1
- Impact: Trung bình
- Effort: Thấp đến Trung bình
- Lý do:
  - `src/layout/Header.vue` vẫn đang trộn:
    - route title logic
    - date filter logic
    - notification dropdown + polling
- Mục tiêu:
  - Tách ít nhất 2 component:
    - `HeaderDateControls`
    - `HeaderNotifications`
- Output mong muốn:
  - `Header.vue` chỉ còn layout/orchestration.
- Risk:
  - Event click outside hoặc polling cleanup bị lệch lifecycle.
- Verify:
  - Notification panel mở/đóng bình thường.
  - Date filter header vẫn update route query đúng.

### P4. Chia Nhỏ TicketManagementPage

- Priority: P2
- Impact: Cao
- Effort: Trung bình
- Lý do:
  - `src/pages/TicketManagementPage.vue` đang ôm nhiều concern:
    - list
    - report summary
    - filter state
    - pagination
    - UI formatters
    - ticket actions
- Mục tiêu:
  - Tách theo responsibility:
    - composable `useTicketList`
    - composable `useTicketReportSummary`
    - component toolbar/table/mobile card nếu cần
- Output mong muốn:
  - Page ngắn hơn, đọc được nhanh hơn.
  - Logic fetch/action testable hơn.
- Risk:
  - Nếu tách quá sớm có thể tăng số file mà chưa giảm độ phức tạp thực.
- Verify:
  - Search, filter status, pagination, delete, reopen vẫn hoạt động như cũ.

### P5. Tách `qc_service.js`

- Priority: P2
- Impact: Rất cao
- Effort: Cao
- Lý do:
  - `src/services/qc_service.js` đang là file quá tải nặng nhất frontend.
  - Có cả:
    - mock template data
    - session evaluation
    - API client
    - draft API
    - local storage legacy
    - migration/debug helpers
- Mục tiêu:
  - Tách thành các module rõ vai trò:
    - `qc_api.js`
    - `qc_draft_api.js`
    - `qc_evaluator.js`
    - `qc_legacy_storage.js`
    - hoặc xóa hẳn legacy nếu đã xác nhận không dùng
- Output mong muốn:
  - Không còn “god service” cho QC.
  - Dễ cô lập bug draft/session/score logic.
- Risk:
  - Đây là zone có khả năng vỡ behavior cao nhất phía frontend.
- Verify:
  - QC Management
  - QC Store Detail
  - QC Create Session
  - draft create/update/delete/restore

### P6. Tách Ticket Controller Backend

- Priority: P3
- Impact: Rất cao
- Effort: Rất cao
- Lý do:
  - `api/src/api/ticket/controllers/ticket.js` đang ôm toàn bộ domain ticket.
- Mục tiêu:
  - Chia controller thành lớp mỏng.
  - Tách service/domain helpers cho:
    - create/update validation
    - dashboard aggregation
    - state transition
    - notification side effects
    - attachment handling
- Output mong muốn:
  - Controller tập trung request/response.
  - Business rule nằm ở service/domain helper.
- Risk:
  - Dễ tạo breaking behavior nếu refactor quá rộng trong một nhánh.
- Verify:
  - Full smoke test ticket flow theo `AGENTS.md`.

## 6. Thứ tự triển khai đề xuất

### Phase 1: Quick Wins, rủi ro thấp

- P1 Shared Date Range Helper
- P3 Tách Header Thành Component Con

### Phase 2: Giảm duplication nghiệp vụ

- P2 Shared Ticket Permission / Visibility Helper

### Phase 3: Dọn page-level complexity

- P4 Chia Nhỏ TicketManagementPage

### Phase 4: Dọn domain frontend QC

- P5 Tách `qc_service.js`

### Phase 5: Dọn domain backend ticket

- P6 Tách Ticket Controller Backend

## 7. Dependency Graph

- Phase 1 không phụ thuộc phase khác.
- P2 nên làm trước P6 để tránh refactor ticket backend hai lần.
- P4 nên làm sau Phase 1 vì sẽ dùng shared helper date-range mới.
- P5 độc lập tương đối, nhưng nên làm sau khi frontend shared helper ổn định.
- P6 làm cuối vì impact lớn nhất.

## 8. Task Breakdown

### Task R1 - Audit shared date-range behavior

- Agent: `project-planner` / `frontend-specialist`
- Skills: `clean-code`, `architecture`
- Input:
  - Dashboard, TicketManagement, QCManagement, Header
- Output:
  - Danh sách helper chung cần trích xuất
- Verify:
  - Không bỏ sót chênh lệch timezone/default range

### Task R2 - Implement shared date-range helper

- Agent: `frontend-specialist`
- Skills: `clean-code`
- Dependencies:
  - R1
- Input:
  - Danh sách helper từ R1
- Output:
  - Shared util/composable + 4 nơi chuyển sang dùng chung
- Verify:
  - `npm run build`

### Task R3 - Split Header responsibilities

- Agent: `frontend-specialist`
- Skills: `clean-code`, `frontend-design`
- Dependencies:
  - R2 (khuyến nghị, không bắt buộc cứng)
- Input:
  - `src/layout/Header.vue`
- Output:
  - Header component nhỏ hơn, tách subcomponents
- Verify:
  - Notification + date filter hoạt động bình thường

### Task R4 - Extract shared ticket permission helper

- Agent: `backend-specialist`
- Skills: `clean-code`, `architecture`
- Dependencies:
  - Không phụ thuộc frontend tasks
- Input:
  - ticket controller
  - ticket-log controller
- Output:
  - Helper dùng chung cho permission/visibility
- Verify:
  - `npm --prefix api run build`
  - smoke test ticket permissions

### Task R5 - Refactor TicketManagement page

- Agent: `frontend-specialist`
- Skills: `clean-code`
- Dependencies:
  - R2
  - R3
- Input:
  - `src/pages/TicketManagementPage.vue`
- Output:
  - Page chia rõ phần state/fetch/view/action
- Verify:
  - Search, status filter, delete, reopen, pagination

### Task R6 - Split QC service by role

- Agent: `frontend-specialist`
- Skills: `clean-code`, `architecture`
- Dependencies:
  - R2
- Input:
  - `src/services/qc_service.js`
- Output:
  - Nhiều module nhỏ, ít concern hơn
- Verify:
  - QC pages chạy đúng

### Task R7 - Split ticket backend domain

- Agent: `backend-specialist`
- Skills: `clean-code`, `architecture`
- Dependencies:
  - R4
- Input:
  - `api/src/api/ticket/controllers/ticket.js`
- Output:
  - Controller mỏng + domain/service helpers
- Verify:
  - backend build
  - smoke test ticket flow

## 9. Rủi ro chính

### Rủi ro nghiệp vụ

- Ticket permission bị lệch khi gom helper.
- QC draft/session behavior bị đổi trong lúc tách `qc_service.js`.
- Header date-range thay đổi ngầm nếu util chung normalize khác implementation cũ.

### Rủi ro kỹ thuật

- Refactor nhiều file shared cùng lúc có thể tạo import cycle hoặc interface drift.
- Frontend và backend đều đang có file lớn; refactor mạnh một lần dễ vượt phạm vi review an toàn.

## 10. Validate Checklist Theo Phase

### Frontend phases

- `node -v`
- `npm -v`
- `npm run build`

### Backend phases

- `node -v`
- `npm -v`
- `npm --prefix api run build`

### Cross-check

- `./scripts/agent-check.sh auto`

### Ticket smoke test sau phase backend/domain

- Tạo ticket store hợp lệ
- Tạo ticket store không hợp lệ
- Edit ticket đổi `store_id`
- Claim / leave / resolve / reopen
- Reply theo role
- Upload ảnh quá số lượng / quá dung lượng

### QC smoke test sau phase QC

- List overview
- Vào store detail
- Tạo draft
- Khôi phục draft
- Tạo session
- Submit session

## 11. Definition of Done

- Không còn duplicate helper lớn ở frontend date-range.
- Permission ticket không còn bị lặp giữa controller ticket và ticket-log.
- `Header.vue` và `TicketManagementPage.vue` ngắn hơn, rõ responsibility hơn.
- `qc_service.js` không còn là file đa vai trò.
- Ticket controller backend được chia nhỏ theo domain concern.
- Mỗi phase đều có validate tương ứng và không làm đổi behavior nghiệp vụ đã cam kết.

## 12. Khuyến nghị triển khai thực tế

Nếu chỉ có thời gian cho 1 sprint ngắn, nên làm:

1. Shared date-range helper
2. Tách Header
3. Shared ticket permission helper

Nếu có 2 sprint:

1. Hoàn thành 3 mục trên
2. Refactor TicketManagementPage
3. Bắt đầu tách `qc_service.js`

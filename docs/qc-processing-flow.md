# QC Processing Flow

## 1) Mục tiêu
Tài liệu này mô tả luồng xử lý QC sau khi tách domain QC khỏi Ticket, theo hướng đơn giản, dễ dùng, nhưng đủ khả năng mở rộng.

## 2) Phạm vi
- Không ảnh hưởng flow Ticket hiện tại.
- QC chạy độc lập theo form/template version.
- Hỗ trợ:
  - nhiều biên bản QC khác nhau,
  - tiêu chí chấm `pass/fail` hoặc `point`,
  - tiêu chí không áp dụng theo cửa hàng,
  - tiêu chí chỉ chấm 1 lần/tuần.

## 3) Vai trò
- `QC Auditor`: tạo/đánh giá/submit phiên QC.
- `Store`: cập nhật khắc phục cho các lỗi.
- `QC Lead/Admin`: quản trị form/version/rule, xác nhận tái kiểm.

## 4) Data Model chính
- `qc_forms`: form gốc (master).
- `qc_form_versions`: version immutable của form.
- `qc_criteria`: thư viện tiêu chí dùng lại.
- `qc_form_criteria`: cấu hình tiêu chí trong từng version (mode, score, weight, critical, weekly_once...).
- `qc_store_criterion_rules`: rule theo cửa hàng (`is_applicable`, hiệu lực thời gian).
- `qc_sessions`: phiên QC tại cửa hàng.
- `qc_session_items`: kết quả chấm từng tiêu chí (snapshot).
- `qc_findings`: hạng mục cần khắc phục.

## 5) Trạng thái nghiệp vụ
### 5.1 Phiên QC (`qc_sessions.status`)
- `draft`: vừa tạo phiên, chưa submit.
- `submitted`: đã nộp kết quả (dùng khi cần tách bước).
- `needs_fix`: có tiêu chí fail cần khắc phục.
- `closed`: phiên đạt hoặc đã hoàn tất xử lý.

### 5.2 Kết quả tiêu chí (`qc_session_items.result`)
- `pending`: chưa chấm.
- `pass`: đạt.
- `fail`: không đạt.
- `na`: không áp dụng với cửa hàng.
- `skipped_weekly`: bỏ qua vì tiêu chí đã được chấm trong tuần.

### 5.3 Khắc phục (`qc_findings.status`)
- `open` -> `in_progress` -> `resolved` -> `verified`
- hoặc `rejected` nếu tái kiểm không đạt.

## 6) Luồng xử lý đề xuất
## 6.0 Luồng thao tác FE đề xuất (Draft-first)
1. User bấm `Tạo phiếu QC`.
2. Hệ thống tạo ngay `qc_session` trạng thái `draft` và trả về `session_id`.
3. User chỉnh tiêu chí bên trong phiếu.
4. FE autosave (debounce 1-2s) lên server theo `session_id`.
5. Nếu user thoát trang/reload, lần sau vào lại sẽ resume từ `draft` gần nhất.
6. User bấm `Submit` để chốt; server validate và chuyển trạng thái nghiệp vụ.

Lợi ích:
- Không mất dữ liệu khi back/reload/mạng chập chờn.
- User có thể quay lại chỉnh tiếp ở lần sau.
- Dễ mở rộng cơ chế phân quyền/duyệt/recheck sau này.

## Step A: Quản trị mẫu QC
1. Admin/QC Lead tạo `qc_form`.
2. Tạo `qc_form_version` (draft).
3. Gắn danh sách `qc_form_criteria`.
4. Publish version (`status=published`).

Kết quả: form version đã sẵn sàng để tạo phiên QC.

## Step B: Cấu hình theo cửa hàng
1. Với tiêu chí không áp dụng ở một số cửa hàng, tạo `qc_store_criterion_rule` với `is_applicable=false`.
2. Nếu cần hiệu lực theo thời gian, set `effective_from/effective_to`.

Kết quả: khi tạo phiên, hệ thống biết tiêu chí nào là `na`.

## Step C: Tạo phiên QC
1. Auditor chọn cửa hàng + form version.
2. Hệ thống tạo `qc_session` ở trạng thái `draft` (tạo trước để user chỉnh sửa trong phiên nháp).
3. Hệ thống generate `qc_session_items` từ `qc_form_criteria` (snapshot mode/max_score/weight/frequency...).
4. Áp dụng rule store:
   - `is_applicable=false` -> item = `na`.
5. Áp dụng `weekly_once`:
   - nếu tiêu chí đã chấm trong tuần hiện tại -> item = `skipped_weekly`.

Kết quả: phiên QC sẵn sàng để chấm, dữ liệu lịch sử không bị ảnh hưởng bởi thay đổi template sau này.

## Step D: Chấm điểm
1. Auditor cập nhật từng `qc_session_item`:
   - mode `pass_fail`: set `pass` hoặc `fail`.
   - mode `point`: nhập `score`.
2. Có thể thêm `note`, bằng chứng (giai đoạn sau dùng media/evidence riêng).
3. Dữ liệu được lưu theo cơ chế autosave khi session đang ở `draft`.

## Step E: Submit phiên
1. Validate: không còn item `pending` (trừ `na/skipped_weekly`).
2. Tính toán:
   - `total_score`, `max_score`.
   - `result` của session = `pass` hoặc `fail`.
3. Nếu `fail`:
   - session -> `needs_fix`.
   - tạo `qc_findings` cho các item fail.
4. Nếu `pass`:
   - session -> `closed`.

## Step F: Cửa hàng khắc phục
1. Store nhận danh sách `qc_findings`.
2. Cập nhật `corrective_action`, `corrective_note`, evidence.
3. Chuyển finding sang `resolved` khi hoàn tất.

## Step G: Tái kiểm (Recheck)
1. Auditor kiểm tra finding đã `resolved`.
2. Nếu đạt -> `verified`.
3. Nếu chưa đạt -> `rejected` hoặc quay lại `in_progress`.
4. Khi tất cả findings verified -> đóng phiên (`closed`) hoặc tạo session recheck mới theo policy.

## 7) Công thức chấm điểm (MVP)
- Bỏ khỏi mẫu số: `na`, `skipped_weekly`.
- `point`:
  - cộng `score` vào `total_score`,
  - cộng `max_score_snapshot` vào `max_score`.
- `pass_fail`:
  - quy đổi `pass=1`, `fail=0` (hoặc rule khác trong `pass_rule`).
- Session fail nếu:
  - có bất kỳ item `fail` critical, hoặc
  - không đạt rule pass trong `pass_rule`.

## 8) API mapping
## 8.1 Đã có trong code
- Core CRUD cho:
  - `/api/qc-forms`
  - `/api/qc-form-versions`
  - `/api/qc-criteria`
  - `/api/qc-form-criteria`
  - `/api/qc-store-criterion-rules`
  - `/api/qc-sessions`
  - `/api/qc-session-items`
  - `/api/qc-findings`
- Custom:
  - `POST /api/qc/sessions/create`
    - Khuyến nghị truyền `formVersionId`; nếu muốn cho phép tạo form/version tự động thì gửi `allowTemplateAutocreate=true`.
  - `GET /api/qc/sessions/overview`
  - `GET /api/qc/stores/overview`
  - `POST /api/qc/sessions/:id/submit`

## 8.2 Nên bổ sung tiếp (để chạy trọn luồng)
1. `POST /api/qc/sessions/init`
- Input: `store_id`, `form_version_id`, `audited_at`.
- Output: session + items snapshot đã apply rule `na/weekly_once`.

2. `POST /api/qc/sessions/:id/items/bulk-upsert`
- Upsert kết quả chấm nhiều tiêu chí một lần.

3. `GET /api/qc/sessions?status=draft&store_id=...`
- Lấy danh sách phiếu nháp để resume.

4. `POST /api/qc/findings/:id/resolve`
- Store cập nhật khắc phục + evidence.

5. `POST /api/qc/findings/:id/verify`
- Auditor xác nhận tái kiểm.

## 9) Quy tắc an toàn dữ liệu
- Không sửa item snapshot sau khi session đã submit (chỉ append log hoặc mở recheck).
- Mọi thay đổi trạng thái quan trọng nên có event log.
- Không sửa version đã publish; muốn đổi tiêu chí phải tạo version mới.

## 10) Roadmap triển khai ngắn
1. Bổ sung endpoint `init` + `bulk-upsert`.
2. FE Create Session gọi API thật thay mock.
3. Bổ sung flow finding resolve/verify.
4. Bổ sung dashboard tổng hợp theo store/form.

## 11) Trạng thái FE hiện tại (đã triển khai)
- FE đã có luồng `Draft-first` cho màn QC:
  - Tạo nháp từ màn chi tiết cửa hàng (`QCStoreDetailPage`).
  - Nếu vào thẳng màn tạo phiếu chưa có `draftId`, hệ thống sẽ tự tạo nháp khi người dùng bắt đầu chỉnh dữ liệu.
  - Mở lại nháp để chỉnh sửa (`QCCreateSessionPage?draftId=...`).
  - Autosave nháp bằng debounce trong lúc nhập/chấm.
  - Submit thành công sẽ xóa nháp.
- Nháp đã chuyển sang lưu backend qua API `qc-draft`:
  - `GET /api/qc/drafts?store_id=...&page=1&pageSize=...`
  - `GET /api/qc/drafts/:id`
  - `POST /api/qc/drafts`
  - `PUT /api/qc/drafts/:id`
  - `DELETE /api/qc/drafts/:id`
- FE session flow hiện tại đã chuyển sang API backend cho các màn:
  - Dashboard tổng quan QC.
  - QC Management (store overview).
  - QC Store Detail (list + summary phiên).
  - QC Create Session (submit session + kiểm tra weekly theo dữ liệu backend).
- Local helpers trong FE vẫn giữ lại ở dạng legacy để migration/debug, không dùng trong luồng chính.

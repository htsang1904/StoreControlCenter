# QC Implementation Plan

## 1) Mục tiêu

Triển khai hệ thống QC đáp ứng quy trình chính thức từ bộ phận đào tạo, nhưng vẫn tận dụng domain QC hiện có trong repo:

- hỗ trợ nhiều loại hình kiểm tra,
- áp dụng rule nghiệp vụ đặc biệt theo mã lỗi,
- lưu minh chứng ảnh/clip,
- quản lý khắc phục trong 24h,
- hỗ trợ lập biên bản và escalation,
- không phá flow Ticket hiện tại.

## 2) Phạm vi triển khai

### In scope

- Domain QC độc lập trên backend Strapi.
- Màn hình QC hiện có trên frontend Vue.
- Rule tính điểm và xử lý vi phạm theo loại kiểm tra.
- Quản lý finding, khắc phục, verify, overdue.
- Notification/escalation cho các case cần lập biên bản.

### Out of scope cho phase đầu

- Workflow phê duyệt biên bản phức tạp nhiều cấp.
- Tự động sync org chart PTCH/SM/AM từ hệ thống ngoài nếu chưa có API ổn định.
- OCR/AI phân tích hình ảnh/clip.

## 3) Quy trình nghiệp vụ cần đáp ứng

### 3.1 Loại kiểm tra

Hệ thống cần hỗ trợ ít nhất 6 loại:

1. `onsite_store_check`
2. `camera_check`
3. `mobile_daily_check`
4. `opening_check`
5. `handover_check`
6. `weekly_hygiene_check`

### 3.2 Rule đặc biệt

- `zero_session_score`
  Áp dụng cho lỗi kiểu `C1.7`, `C1.5`, lỗi nghiêm trọng lưu động.
  Khi vi phạm, toàn bộ phiên QC có `total_score = 0`, `result = fail`.

- `percentage_deduction`
  Áp dụng cho lỗi kiểu `B3.1`.
  Trừ theo phần trăm tổng điểm sau khi tính điểm tiêu chí.

- `observation_only`
  Ghi nhận theo dõi nhưng không trừ điểm.

- `minutes_required`
  Khi vi phạm rule nặng hoặc quá hạn khắc phục, tự động đánh dấu cần lập biên bản.

### 3.3 SLA khắc phục

- Store phải gửi minh chứng khắc phục trong `24h`.
- Quá hạn thì finding chuyển `overdue`.
- Hệ thống tạo escalation/biên bản cho PTCH/SM/AM.

## 4) Đánh giá hiện trạng repo

### Đã có

- `qc-session`, `qc-session-item`, `qc-finding`, `qc-draft`.
- QC draft-first, autosave, overview theo store.
- Hỗ trợ `point`, `pass_fail`.

### Chưa có

- inspection type/channel chính thức.
- rule engine theo mã lỗi.
- evidence media thật cho QC item/finding.
- auto create findings khi submit fail.
- workflow resolve/verify/reject finding.
- SLA 24h và escalation.
- entity riêng cho biên bản.

## 5) Kiến trúc đề xuất

### 5.1 Principle

- Không nhét logic nghiệp vụ QC vào frontend.
- Mọi rule tính điểm chạy ở backend.
- Frontend chỉ gửi payload chấm điểm + minh chứng.
- Criteria definition phải nằm ở backend, không phụ thuộc template tĩnh hardcode.

### 5.2 Tầng backend

- `qc-session`
  giữ phiên kiểm tra.

- `qc-session-item`
  giữ snapshot từng tiêu chí.

- `qc-finding`
  giữ lỗi cần khắc phục.

- `qc-inspection-rule` hoặc `meta rule` trong `qc-form-criterion`
  định nghĩa penalty đặc biệt.

- `qc-incident` hoặc `qc-minutes`
  ghi nhận biên bản/escalation.

### 5.3 Tầng frontend

- `QCManagementPage`
  overview theo loại kiểm tra, trạng thái khắc phục, overdue.

- `QCStoreDetailPage`
  lịch sử phiên, findings, overdue, biên bản.

- `QCCreateSessionPage`
  form chấm theo template/version backend, upload evidence, hiển thị warning rule đặc biệt.

## 6) Thay đổi schema đề xuất

### 6.1 `qc-session`

Thêm:

- `inspection_type` enum
- `inspection_channel` enum: `onsite | camera | upload`
- `minutes_required` boolean
- `minutes_status` enum: `none | pending | issued | acknowledged`
- `escalation_status` enum: `none | pending | escalated | closed`
- `rule_summary` json
- `evidence_summary` json

### 6.2 `qc-session-item`

Thêm:

- `criterion_group_code` string
- `penalty_rule` enum:
  `none | zero_session_score | percentage_deduction | observation_only`
- `penalty_value` decimal
- `tracking_only` boolean
- `evidence` json hoặc media relation
- `violation_code` string
- `severity` enum: `low | medium | high | critical`
- `requires_minutes` boolean

### 6.3 `qc-finding`

Giữ schema hiện có, mở rộng:

- `overdue_at` datetime
- `escalated_at` datetime
- `resolution_sla_hours` integer default `24`
- `owner_role` string
- `source_rule` json

### 6.4 Entity mới `qc-minutes`

Tạo mới để lưu biên bản:

- `code`
- `session`
- `finding`
- `store`
- `issued_to`
- `issued_roles`
- `reason`
- `status`
- `issued_at`
- `acknowledged_at`
- `attachments`
- `meta`

## 7) API design đề xuất

### 7.1 Session APIs

- `POST /api/qc/sessions/create`
  Mở rộng payload:
  - `inspectionType`
  - `inspectionChannel`
  - `criteria[]` có `violationCode`, `penaltyRule`, `penaltyValue`, `attachments`

- `POST /api/qc/sessions/:id/submit`
  Thực hiện:
  - validate pending,
  - tính điểm final,
  - áp rule đặc biệt,
  - tạo findings,
  - set `minutes_required`,
  - set `escalation_status`.

- `GET /api/qc/sessions/overview`
  Thêm filter:
  - `inspection_type`
  - `minutes_required`
  - `overdue_only`

- `GET /api/qc/stores/overview`
  Thêm số liệu:
  - `openFindings`
  - `overdueFindings`
  - `minutesCount`

### 7.2 Finding APIs

Custom APIs mới:

- `POST /api/qc/findings/:id/resolve`
- `POST /api/qc/findings/:id/verify`
- `POST /api/qc/findings/:id/reject`
- `POST /api/qc/findings/:id/escalate`
- `GET /api/qc/findings/my-queue`

### 7.3 Minutes APIs

- `POST /api/qc/minutes/create`
- `GET /api/qc/minutes`
- `GET /api/qc/minutes/:id`
- `POST /api/qc/minutes/:id/acknowledge`

### 7.4 Media APIs

- `POST /api/qc/upload-evidence`
  tách riêng khỏi ticket upload để không trộn domain.

## 8) Rule engine proposal

### 8.1 Input

- session metadata
- criteria snapshot
- inspection type
- rule metadata theo criterion

### 8.2 Output

- `total_score`
- `max_score`
- `score_rate`
- `result`
- `decision_reasons[]`
- `minutes_required`
- `findings[]`

### 8.3 Thứ tự tính

1. Normalize item results.
2. Tính điểm base.
3. Áp `zero_session_score` nếu có.
4. Áp `percentage_deduction`.
5. Bỏ qua `observation_only`.
6. Xác định `fail/pass`.
7. Tạo findings từ item cần khắc phục.
8. Set `minutes_required` nếu có lỗi nặng hoặc overdue escalation.

### 8.4 Mapping rule chính thức

- `C1.7`, `C1.5`
  `penalty_rule = zero_session_score`

- `B3.1`
  `penalty_rule = percentage_deduction`
  `penalty_value = 30`

- lỗi theo dõi
  `tracking_only = true`
  `penalty_rule = observation_only`

- lỗi mở cửa sau giờ
  `requires_minutes = true`

## 9) Frontend implementation plan

### 9.1 QCCreateSessionPage

- bỏ phụ thuộc chính vào `src/constants/qc_templates.js`
- load form/version từ backend
- hiển thị inspection type
- upload evidence thật cho từng criterion
- badge cảnh báo với rule đặc biệt:
  - `0 điểm toàn bài`
  - `trừ 30%`
  - `chỉ theo dõi`
  - `cần lập biên bản`

### 9.2 QCStoreDetailPage

- tab mới:
  - `Phiên QC`
  - `Lỗi cần khắc phục`
  - `Biên bản`
- hiển thị countdown SLA 24h
- action cho store/QC:
  - resolve
  - verify
  - reject

### 9.3 QCManagementPage

- bộ lọc theo `inspection_type`
- số liệu overdue/escalation
- export report theo loại kiểm tra

### 9.4 DashboardPage

- thêm KPI:
  - finding overdue
  - số biên bản
  - tỷ lệ khắc phục đúng hạn

## 10) Phase triển khai

### Phase 0: Chốt nghiệp vụ

Deliverables:

- bảng mapping mã lỗi -> rule
- bảng inspection type -> workflow
- danh sách vai trò nhận escalation
- format biên bản

Output bắt buộc:

- `docs/qc-rule-catalog.md`
- `docs/qc-role-mapping.md`

### Phase 1: Foundation backend

Mục tiêu:

- hoàn thiện schema, API và rule engine cơ bản.

Tasks:

- thêm field vào `qc-session`, `qc-session-item`, `qc-finding`
- tạo `qc-minutes`
- tạo `qc/upload-evidence`
- viết rule engine
- submit session sinh findings

Validation:

- tạo session cho từng inspection type
- test `C1.7/C1.5/B3.1/observation_only`
- test evidence upload

### Phase 2: Finding workflow

Mục tiêu:

- store có thể khắc phục và QC có thể verify.

Tasks:

- API resolve/verify/reject/escalate
- UI findings queue
- SLA 24h
- cron overdue scan

Validation:

- finding resolve trong 24h
- finding quá hạn
- verify pass / reject

### Phase 3: Minutes & escalation

Mục tiêu:

- tự động lập biên bản cho case cần xử lý.

Tasks:

- entity `qc-minutes`
- auto create minutes
- queue escalation PTCH/SM/AM
- notification

Validation:

- opening check vi phạm -> có biên bản
- mobile severe violation -> 0 điểm + biên bản
- quá hạn khắc phục -> escalation

### Phase 4: Frontend polish & reporting

Tasks:

- bỏ template hardcode khỏi luồng chính
- report theo loại kiểm tra
- dashboard KPI
- export CSV

Validation:

- toàn bộ FE chạy trên API thật
- không còn phụ thuộc local mock cho flow chính

## 11) Breakdown theo file/module

### Backend

- `api/src/api/qc-session/controllers/qc-session.js`
  refactor create/submit theo rule engine.

- `api/src/api/qc-finding/**`
  thêm custom routes/controller/service cho workflow.

- `api/src/api/qc-draft/**`
  giữ nguyên, chỉ mở rộng nếu cần save evidence metadata.

- `api/src/api/qc-form-criterion/**`
  thêm metadata rule.

- `api/src/api/qc-session-item/content-types/**`
  thêm fields evidence/rule.

- `api/config/cron-tasks.js`
  thêm job overdue SLA/escalation.

### Frontend

- `src/pages/QCCreateSessionPage.vue`
- `src/pages/QCStoreDetailPage.vue`
- `src/pages/QCManagementPage.vue`
- `src/pages/DashboardPage.vue`
- `src/services/qc_service.js`

## 12) Rủi ro kỹ thuật

### Rủi ro 1: hardcode template ở frontend

- Hiện FE còn phụ thuộc `src/constants/qc_templates.js`.
- Nếu quy trình thay đổi thường xuyên, sẽ lệch backend rất nhanh.

Mitigation:

- chuyển template/version/rule về backend làm single source of truth.

### Rủi ro 2: evidence clip nặng

- video/clip làm payload và storage tăng mạnh.

Mitigation:

- chỉ lưu metadata ở session/finding.
- file media lưu qua Strapi upload/provider.
- giới hạn mime/size theo loại evidence.

### Rủi ro 3: rule engine khó debug

- nhiều rule cộng dồn dễ sai điểm.

Mitigation:

- lưu `rule_summary` và `decision_reasons`.
- viết test matrix theo mã lỗi.

## 13) Test matrix bắt buộc

### Session scoring

- pass bình thường
- fail do threshold
- fail do có item không đạt
- zero toàn bài do `C1.7`
- zero toàn bài do `C1.5`
- trừ 30% do `B3.1`
- observation-only không trừ điểm

### Evidence

- ảnh hợp lệ
- clip hợp lệ
- vượt dung lượng
- sai mime

### Finding workflow

- resolve trong 24h
- resolve quá hạn
- verify thành công
- reject sau tái kiểm

### Escalation

- opening late -> minutes
- mobile severe violation -> minutes
- overdue -> escalation

## 14) Rollout strategy

1. Deploy schema mới nhưng chưa bật UI mới.
2. Seed form/rule catalog theo quy trình chính thức.
3. Bật backend rule engine dưới feature flag.
4. Migrate FE create session sang API rule thật.
5. Bật finding workflow.
6. Bật minutes/escalation.

## 15) Đề xuất thực hiện thực tế

Nếu làm theo thứ tự tối ưu cho repo hiện tại:

1. Chốt rule catalog và inspection types.
2. Làm backend Phase 1.
3. Làm finding workflow Phase 2.
4. Làm frontend create/detail.
5. Làm escalation và dashboard sau.

## 16) Deliverable cho sprint đầu

Sprint 1 nên chốt được:

- schema QC mở rộng,
- submit session có rule engine cơ bản,
- findings auto-create,
- evidence upload cho ảnh,
- FE tạo session dùng backend rule.

Đây là mốc tối thiểu để hệ thống bắt đầu phản ánh đúng quy trình thật.

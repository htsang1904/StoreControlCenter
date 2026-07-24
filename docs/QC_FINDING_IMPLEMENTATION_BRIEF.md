# QC Finding Implementation Brief

## 1. Mục tiêu

Tài liệu này mô tả yêu cầu triển khai luồng **Finding / Khắc phục sau QC** cho module Quản lý QC cửa hàng.

Mục tiêu chính:

- Khi một tiêu chí QC được chấm **Không đạt**, tiêu chí đó sẽ tương ứng với **1 Finding**.
- Finding chỉ được tạo chính thức khi người dùng **submit phiên QC**.
- Cửa hàng có thể xem Finding, thực hiện khắc phục và gửi nội dung/ảnh minh chứng.
- QC có thể kiểm tra kết quả khắc phục, xác nhận hoàn tất hoặc yêu cầu cửa hàng khắc phục lại.
- Có khu vực quản lý Finding riêng để QC theo dõi trạng thái, hạn xử lý và các Finding đang chờ xác nhận.
- Giữ được đầy đủ lịch sử trước/sau khắc phục để phục vụ audit.

---

## 2. Nguyên tắc nghiệp vụ quan trọng

### 2.1. Rule tạo Finding

Quy tắc chính:

> **1 tiêu chí được chấm `Không đạt` = 1 Finding.**

Không sử dụng điều kiện `requires_fix` để quyết định có tạo Finding hay không.

### 2.2. Không tạo Finding thật ngay khi đang chấm draft

Trong màn hình chấm QC, khi user chọn `Không đạt`, hệ thống chỉ xem đây là **Finding dự kiến**.

Lý do:

- User có thể đổi từ `Không đạt` sang `Đạt` trước khi submit.
- User có thể sửa ghi chú, thay ảnh hoặc thay điểm.
- Không nên tạo/xóa/update Finding liên tục trong quá trình autosave draft.

Finding chính thức chỉ được tạo khi submit phiên QC thành công.

Luồng:

```text
Draft QC
  ↓
Tiêu chí = Không đạt
  ↓
Finding dự kiến
  ↓
Submit phiên QC
  ↓
Tạo Finding chính thức
```

### 2.3. Quan hệ dữ liệu kỳ vọng

```text
QC Session
   │
   ├── QC Result #01 → Đạt
   ├── QC Result #02 → Đạt
   ├── QC Result #03 → Không đạt → Finding #001
   ├── QC Result #04 → Không đạt → Finding #002
   └── QC Result #05 → Không đạt → Finding #003
```

Finding cần truy vết ngược được về:

```text
Finding
  → QC Result
  → Criterion
  → Form Version
  → QC Session
  → Store
```

---

## 3. Flow tổng thể

```text
Tạo phiếu QC nháp
      ↓
Chấm tiêu chí
      ↓
Tiêu chí Đạt / Không đạt
      ↓
Submit phiên QC
      ↓
Tạo QC Session chính thức
      ↓
Mỗi tiêu chí Không đạt tạo 1 Finding
      ↓
Finding = Chờ khắc phục
      ↓
Cửa hàng xử lý
      ↓
Cửa hàng gửi nội dung + ảnh minh chứng
      ↓
Finding = Chờ QC xác nhận
      ↓
QC kiểm tra
  ┌───────────────┐
  ↓               ↓
Đạt           Chưa đạt
  ↓               ↓
Đã hoàn tất   Khắc phục chưa đạt
                  ↓
            Cửa hàng xử lý lại
                  ↓
            Chờ QC xác nhận
```

---

## 4. Trạng thái Finding

### 4.1. Trạng thái nghiệp vụ đề xuất

```text
open
in_progress
resolved
verified
rejected
```

Mapping UI:

| Backend status | UI label | Ý nghĩa |
| --- | --- | --- |
| `open` | Chờ khắc phục | Finding vừa được tạo, cửa hàng chưa bắt đầu xử lý |
| `in_progress` | Đang khắc phục | Cửa hàng đang xử lý Finding |
| `resolved` | Chờ QC xác nhận | Cửa hàng đã gửi kết quả khắc phục |
| `verified` | Đã hoàn tất | QC xác nhận khắc phục đạt yêu cầu |
| `rejected` | Khắc phục chưa đạt | QC trả lại cho cửa hàng xử lý tiếp |

### 4.2. Quá hạn không nên là lifecycle status

`Quá hạn` nên là trạng thái phụ được tính từ:

```text
now > dueDate && status != verified
```

Ví dụ UI:

```text
[Chờ khắc phục]   Quá hạn 2 ngày
```

---

## 5. Thay đổi trong màn Chấm phiếu QC

Route hiện tại:

```text
/QC/store/:storeId/create?draftId=...
```

### 5.1. Khi tiêu chí được chấm Không đạt

UI cần thể hiện rõ rằng Finding sẽ được tạo khi submit.

Ví dụ:

```text
QC-03
Nhân viên mang đồng phục đúng quy định

[Không đạt]

Finding sẽ được tạo khi hoàn tất phiên QC

Ghi chú
[2 nhân viên không đeo bảng tên]

Minh chứng
[Ảnh] [Ảnh]
```

Không cần checkbox `requires_fix`.

### 5.2. Summary bên phải

Bổ sung hoặc đổi summary:

```text
Đã chấm             18
Chưa chấm            6
Không đạt            4

Finding dự kiến      4
```

`Finding dự kiến` phải luôn bằng số lượng criterion result đang ở trạng thái `Không đạt` trong draft.

### 5.3. Không tạo Finding API trong autosave draft

Autosave chỉ lưu:

- result của tiêu chí
- điểm
- pass/fail/deduction
- ghi chú
- ảnh
- trạng thái draft

Không tạo Finding trong bước autosave.

---

## 6. Submit phiên QC

Khi submit:

### 6.1. Validation

Không cho submit nếu:

- còn tiêu chí chưa chấm
- draft không hợp lệ
- form version không tồn tại
- dữ liệu criterion result không hợp lệ

### 6.2. Transaction logic kỳ vọng

Ưu tiên xử lý theo transaction/atomic flow nếu backend hỗ trợ.

Pseudo flow:

```text
1. Validate draft
2. Create QC Session
3. Persist all QC Results
4. Find all results where final result = Không đạt
5. For each failed result:
   - create Finding
   - link finding to session/result/criterion/store/formVersion
6. Mark/remove draft as completed
7. Return session + created findings count
```

### 6.3. Response nên trả thêm

Ví dụ:

```json
{
  "sessionId": "...",
  "result": "FAIL",
  "score": 73,
  "findingCount": 4
}
```

### 6.4. Success UI sau submit

```text
Hoàn tất phiên QC

Điểm QC
73 / 100

Kết quả
KHÔNG ĐẠT

4 tiêu chí không đạt
Đã tạo 4 Finding cần khắc phục

[Xem Finding]
[Về chi tiết cửa hàng]
```

---

## 7. Module Quản lý Finding QC

### 7.1. Route đề xuất

```text
/QC/findings
/QC/findings/:findingId
```

Có thể triển khai page riêng hoặc list + detail master/detail trên desktop.

### 7.2. Navigation

Trong nhóm QC nên có:

```text
QC cửa hàng
Lịch sử QC
Finding / Khắc phục
Biểu mẫu QC
```

Tên hiển thị nên thống nhất một trong hai cách:

- `Finding / Khắc phục`
- `Cần khắc phục`

Khuyến nghị dùng:

> **Finding / Khắc phục**

để vừa đúng thuật ngữ nội bộ vừa dễ hiểu với user.

---

## 8. UI: Trang danh sách Finding

Route:

```text
/QC/findings
```

### 8.1. Mục tiêu

Cho QC xem nhanh:

- Finding đang mở
- Finding chờ QC xác nhận
- Finding quá hạn
- Finding đã hoàn tất
- Finding bị trả lại nhiều lần

### 8.2. KPI summary

Hiển thị:

```text
Finding đang mở
Chờ xác nhận
Quá hạn
Đã hoàn tất tháng này
```

### 8.3. Tabs / filters

```text
Tất cả
Chờ khắc phục
Đang khắc phục
Chờ QC xác nhận
Khắc phục chưa đạt
Đã hoàn tất
```

Bộ lọc bổ sung:

- Store
- Date range
- Due date
- Status
- Severity nếu có
- Assignee nếu có

### 8.4. Dữ liệu mỗi Finding item

Hiển thị tối thiểu:

- Finding code
- Tên lỗi / criterion title
- Store
- QC Session code
- Ngày phát hiện
- Hạn xử lý
- Người phụ trách cửa hàng
- Status
- Overdue indicator

Ví dụ:

```text
FD-2024-031
Nhân viên không đeo bảng tên

CH Nguyễn Trãi
Phiên QC: QC-2024-051

Hạn xử lý: 31/05/2024
Phụ trách: Trần Thị Mai

[Chờ QC xác nhận]
Quá hạn 1 ngày
```

---

## 9. UI: Chi tiết Finding phía QC

Route:

```text
/QC/findings/:findingId
```

### 9.1. Header

Hiển thị:

- Finding code
- Finding title
- Store
- QC Session
- Criterion path
- Status
- Due date

Ví dụ:

```text
FD-2024-031
Nhân viên không đeo bảng tên

CH Nguyễn Trãi
Phiên QC: QC-2024-051

Vận hành cửa hàng
> Khu vực phục vụ
> Đồng phục nhân viên
```

### 9.2. Section `QC phát hiện`

Hiển thị snapshot của lúc QC phát hiện lỗi:

- criterion title
- criterion description
- QC note
- QC images
- checked by
- detected at

Không được overwrite dữ liệu này bằng dữ liệu khắc phục sau này.

### 9.3. Section `Cửa hàng đã khắc phục`

Hiển thị:

- remediation note
- evidence images
- submitted by
- submitted at

### 9.4. Timeline xử lý

Ví dụ:

```text
QC tạo Finding
27/05/2024 09:15

↓

Cửa hàng bắt đầu xử lý
28/05/2024 10:00

↓

Cửa hàng gửi khắc phục
29/05/2024 16:20

↓

Chờ QC xác nhận
```

### 9.5. Action của QC

Nếu status = `resolved`:

```text
[Yêu cầu khắc phục lại]
[Xác nhận hoàn tất]
```

Action phụ:

```text
[Cập nhật hạn xử lý]
```

---

## 10. QC xác nhận Finding

### 10.1. Xác nhận hoàn tất

Khi QC bấm:

```text
Xác nhận hoàn tất
```

Finding chuyển:

```text
resolved → verified
```

Lưu thêm:

- verifiedBy
- verifiedAt
- optional verifyNote

### 10.2. Yêu cầu khắc phục lại

Bắt buộc nhập lý do.

Modal:

```text
Yêu cầu khắc phục lại

Lý do *
[Ảnh gửi chưa thể hiện rõ bảng tên của nhân viên...]

[Gửi lại cửa hàng]
```

Finding chuyển:

```text
resolved → rejected
```

Lưu:

- rejectedBy
- rejectedAt
- rejectionReason

Không overwrite remediation submission cũ.

---

## 11. UI phía cửa hàng

Cửa hàng cần có nơi xem các Finding thuộc store của mình.

Có thể dùng route:

```text
/QC/findings
/QC/findings/:findingId
```

và backend filter theo quyền/store.

### 11.1. Danh sách phía cửa hàng

Summary:

```text
Cần xử lý
Đang khắc phục
Chờ QC xác nhận
Quá hạn
```

Filters:

```text
Tất cả
Cần xử lý
Chờ xác nhận
Hoàn tất
```

### 11.2. Card Finding phía cửa hàng

```text
FD-2024-031
Nhân viên không đeo bảng tên

Phiên QC: QC-2024-051
Hạn xử lý: 03/06/2024

[Chờ khắc phục]

[Khắc phục ngay]
```

---

## 12. UI: Chi tiết Finding phía cửa hàng

### 12.1. Phần `QC phát hiện`

Read-only:

- lỗi được phát hiện
- ghi chú QC
- ảnh trước khắc phục
- ngày phát hiện
- hạn xử lý

### 12.2. Phần `Khắc phục`

Cho phép nhập:

- nội dung khắc phục
- ảnh minh chứng

Ví dụ:

```text
Nội dung khắc phục *
[Đã bổ sung bảng tên và nhắc nhở toàn bộ nhân viên...]

Minh chứng *
[+ Chụp ảnh]
[+ Upload ảnh]

[Ảnh] [Ảnh]
```

CTA:

```text
[Gửi QC xác nhận]
```

### 12.3. Khi gửi

Finding chuyển:

```text
open/in_progress/rejected → resolved
```

Lưu submission mới vào history.

---

## 13. Không overwrite lịch sử khắc phục

Đây là requirement quan trọng.

Nếu Finding bị QC reject, lần khắc phục tiếp theo phải tạo thêm một remediation attempt mới.

Không update đè attempt cũ.

Ví dụ:

```text
Attempt #1
- storeNote
- evidenceImages
- submittedAt
- QC rejected
- rejectionReason

Attempt #2
- storeNote
- evidenceImages
- submittedAt
- QC verified
```

Điều này giúp audit đầy đủ.

---

## 14. Data model đề xuất

Tên field có thể điều chỉnh theo backend hiện tại.

### 14.1. Finding

```ts
type FindingStatus =
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'verified'
  | 'rejected'

interface Finding {
  id: string
  code: string

  storeId: string
  qcSessionId: string
  qcResultId: string
  criterionId: string
  formVersionId: string

  title: string
  description?: string

  status: FindingStatus

  detectedNote?: string
  detectedImages?: string[]
  detectedBy: string
  detectedAt: string

  dueDate?: string
  assignedTo?: string

  verifiedBy?: string
  verifiedAt?: string
  verifyNote?: string

  createdAt: string
  updatedAt: string
}
```

### 14.2. Finding remediation attempt

```ts
interface FindingRemediation {
  id: string
  findingId: string

  attemptNo: number

  note: string
  evidenceImages: string[]

  submittedBy: string
  submittedAt: string

  qcDecision?: 'verified' | 'rejected'
  qcNote?: string
  reviewedBy?: string
  reviewedAt?: string
}
```

### 14.3. Finding activity / timeline

Nếu hệ thống cần audit rõ hơn:

```ts
interface FindingActivity {
  id: string
  findingId: string
  action: string
  actorId: string
  actorType: 'qc' | 'store' | 'system'
  payload?: Record<string, unknown>
  createdAt: string
}
```

---

## 15. API đề xuất

Có thể điều chỉnh theo convention backend hiện tại.

### QC / Store shared

```text
GET /qc/findings
GET /qc/findings/:id
```

### Store actions

```text
POST /qc/findings/:id/start
POST /qc/findings/:id/remediations
```

### QC actions

```text
POST /qc/findings/:id/verify
POST /qc/findings/:id/reject
PATCH /qc/findings/:id/due-date
```

### Query filters

```text
status
store_id
assignee_id
date_from
date_to
overdue
search
```

---

## 16. Permission

### QC/Admin

Có thể:

- xem Finding trong phạm vi quyền
- xem evidence trước/sau
- cập nhật hạn xử lý
- xác nhận hoàn tất
- yêu cầu khắc phục lại

### Store user

Chỉ có thể:

- xem Finding thuộc store được phép
- bắt đầu xử lý
- nhập nội dung khắc phục
- upload evidence
- gửi QC xác nhận

Store không được:

- tự đóng Finding
- tự chuyển Finding thành verified
- sửa nội dung QC phát hiện
- sửa evidence gốc của QC

---

## 17. Tích hợp với trang Chi tiết cửa hàng

Route hiện tại:

```text
/QC/store/:storeId
```

Thêm section/tab:

```text
Phiếu nháp
Lịch sử QC
Cần khắc phục
```

Tab `Cần khắc phục` hiển thị Finding của store.

Summary có thể thêm:

```text
Finding đang mở
Finding quá hạn
Chờ QC xác nhận
```

---

## 18. Tích hợp với Chi tiết phiên QC

Trong modal/page chi tiết phiên QC, thêm tab:

```text
Kết quả chấm
Finding phát sinh
```

Finding phát sinh chỉ gồm các Finding có:

```text
finding.qcSessionId === currentSessionId
```

Mỗi item cần link sang `/QC/findings/:findingId`.

---

## 19. Mobile behavior

### 19.1. Danh sách Finding

Desktop dùng table/master-detail tùy layout hiện tại.

Mobile ưu tiên card:

```text
FD-2024-031
Nhân viên không đeo bảng tên

CH Nguyễn Trãi
Hạn: 31/05/2024

[Chờ QC xác nhận]

[Xem chi tiết]
```

### 19.2. Chi tiết Finding

Mobile stack theo thứ tự:

```text
Thông tin Finding
↓
QC phát hiện
↓
Ảnh trước
↓
Cửa hàng khắc phục
↓
Ảnh sau
↓
Timeline
↓
Actions sticky bottom
```

QC actions nên sticky bottom:

```text
[Khắc phục lại]
[Xác nhận hoàn tất]
```

---

## 20. Empty / Loading / Error states

### Danh sách Finding

Cần có:

- loading
- empty toàn bộ
- empty theo filter
- API error

Empty state ví dụ:

```text
Chưa có Finding cần xử lý

Các tiêu chí Không đạt sau khi hoàn tất phiên QC sẽ xuất hiện tại đây.
```

### Chi tiết Finding

Cần xử lý:

- finding không tồn tại
- user không có quyền
- remediation chưa có
- lỗi upload evidence
- verify/reject error

---

## 21. Notification đề xuất

Có thể triển khai sau nếu chưa có notification infrastructure.

Các event nên notify:

### Cho cửa hàng

- Finding mới được tạo
- Finding sắp quá hạn
- Finding quá hạn
- QC yêu cầu khắc phục lại

### Cho QC

- Cửa hàng gửi khắc phục
- Finding đang chờ QC xác nhận
- Finding quá hạn

---

## 22. Phase triển khai đề xuất cho Codex

Không implement toàn bộ trong một prompt lớn.

### Phase 1 — Data flow + Finding creation

Mục tiêu:

- rà soát model hiện tại
- tạo/điều chỉnh Finding model
- khi submit QC, mỗi result Không đạt tạo 1 Finding
- link Finding với session/result/criterion/store/formVersion
- trả `findingCount` sau submit
- không tạo Finding khi autosave draft

Không làm UI quản lý Finding ở phase này.

### Phase 2 — Finding list

Mục tiêu:

- route `/QC/findings`
- API list + filters
- KPI cơ bản
- tabs status
- desktop table/list
- mobile card

Chưa làm verify/reject đầy đủ nếu muốn giảm scope.

### Phase 3 — Finding detail + Store remediation

Mục tiêu:

- route `/QC/findings/:id`
- hiển thị QC evidence
- form nội dung khắc phục
- upload evidence
- submit remediation
- status → `resolved`

### Phase 4 — QC verification

Mục tiêu:

- QC xem remediation
- `Xác nhận hoàn tất`
- `Yêu cầu khắc phục lại`
- rejection reason
- status verified/rejected
- lưu remediation history

### Phase 5 — Integration

Mục tiêu:

- tab Finding trong store detail
- Finding phát sinh trong QC session detail
- success state sau submit QC
- summary Finding dự kiến trong màn chấm

### Phase 6 — UX polish

Mục tiêu:

- loading/empty/error
- overdue indicators
- mobile sticky actions
- notification nếu có
- timeline/audit refinement

---

## 23. Acceptance Criteria

### Finding creation

- [ ] Không tạo Finding trong autosave draft.
- [ ] Khi submit QC, mỗi criterion result `Không đạt` tạo đúng 1 Finding.
- [ ] Submit lại không được tạo duplicate Finding cho cùng QC Result.
- [ ] Finding lưu được `qcSessionId`, `qcResultId`, `criterionId`, `storeId`, `formVersionId`.
- [ ] Finding snapshot được note và image tại thời điểm QC submit.

### Finding workflow

- [ ] Store thấy Finding thuộc phạm vi quyền.
- [ ] Store có thể bắt đầu xử lý.
- [ ] Store có thể gửi note + evidence.
- [ ] Gửi remediation chuyển Finding sang `resolved`.
- [ ] QC có thể verify → `verified`.
- [ ] QC có thể reject → `rejected`.
- [ ] Reject bắt buộc có lý do.
- [ ] Store có thể gửi remediation mới sau reject.
- [ ] Lịch sử remediation cũ không bị overwrite.

### UI

- [ ] Có trang danh sách Finding.
- [ ] Có trang/chi tiết Finding.
- [ ] Có filter theo status.
- [ ] Có overdue indicator.
- [ ] Có Before / After evidence rõ ràng.
- [ ] Có timeline hoặc activity history.
- [ ] Có mobile layout.
- [ ] Action QC rõ: `Yêu cầu khắc phục lại` / `Xác nhận hoàn tất`.

### Integration

- [ ] Màn chấm QC hiển thị Finding dự kiến.
- [ ] Sau submit hiển thị số Finding đã tạo.
- [ ] Store detail truy cập được các Finding của store.
- [ ] QC session detail truy cập được Finding phát sinh từ session.

---

## 24. Lưu ý khi Codex implement

- Trước khi sửa, phải đọc các model/service/API hiện tại của QC Session, QC Result, Draft và Finding nếu đã có.
- Không giả định schema mới nếu backend đã có cấu trúc tương đương.
- Ưu tiên reuse component, API client, permission và upload flow hiện tại.
- Không refactor rộng các module không liên quan.
- Mỗi phase chỉ sửa đúng phạm vi phase.
- Sau mỗi phase cần chạy build/typecheck/test phù hợp với repo.
- Không dùng Finding lifecycle để thay đổi kết quả lịch sử của QC Session. QC Session đã submit là immutable về mặt kết quả chấm.
- Finding là workflow hậu kiểm và khắc phục, không phải chỉnh sửa lại kết quả QC gốc.

---

## 25. Prompt mẫu cho Codex — Phase 1

```text
Đọc code hiện tại của module QC trước khi sửa, đặc biệt là QC draft, QC session, QC result và Finding nếu đã tồn tại.

Implement Phase 1 của QC Finding workflow theo tài liệu QC_FINDING_IMPLEMENTATION_BRIEF.md.

Yêu cầu chính:
- Không tạo Finding trong quá trình autosave draft.
- Khi submit QC session thành công, mỗi criterion result có kết quả Không đạt phải tạo đúng 1 Finding.
- 1 failed QC result = 1 Finding.
- Finding phải link được với store, QC session, QC result, criterion và form version.
- Snapshot lại note và evidence của QC result vào Finding để dữ liệu phát hiện ban đầu không bị thay đổi sau này.
- Chống duplicate Finding nếu cùng QC result bị xử lý submit lại do retry/idempotency.
- Response submit cần trả thêm findingCount.
- Không thay đổi UI Finding trong phase này, chỉ điều chỉnh tối thiểu success response nếu bắt buộc.
- Không refactor code ngoài phạm vi QC submit/Finding creation.

Sau khi implement, chạy build/typecheck/test phù hợp và báo lại:
1. file đã sửa,
2. flow sau khi sửa,
3. cách chống duplicate,
4. test/build result,
5. phần nào cần làm ở Phase 2.
```

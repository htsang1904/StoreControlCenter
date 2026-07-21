# QC Form Scoring V2

## 1. Mục tiêu

Tài liệu này mô tả cơ chế chấm điểm QC Form mới đã được thống nhất và triển khai trên frontend StoreControlCenter.

Mục tiêu của cơ chế mới:

- Đơn giản hóa cách quyết định phiếu QC Đạt/Không đạt.
- Loại bỏ các điều kiện đạt đang chồng chéo.
- Không để một tiêu chí thông thường tự động làm toàn bộ phiếu thất bại.
- Cho phép tiêu chí Đạt/Không đạt có trọng số khác nhau.
- Cho phép một số tiêu chí khấu trừ trực tiếp điểm phần trăm khỏi tỷ lệ tổng.
- Chỉ sử dụng một điều kiện đạt cấp form là `passThreshold`.

---

## 2. Phạm vi triển khai

Cơ chế mới liên quan đến frontend và backend FastAPI:

| Chức năng | File |
|---|---|
| Tạo và chỉnh sửa QC Form | `src/pages/AdminQcFormEditorPage.vue` |
| Builder tiêu chí | `src/components/AdminQcCriterionBuilderItem.vue` |
| Chi tiết QC Form | `src/pages/AdminQcFormDetailPage.vue` |
| Render tiêu chí khi chấm | `src/components/QCCriterionTreeItem.vue` |
| Thực hiện phiên QC | `src/pages/QCCreateSessionPage.vue` |
| Normalize dữ liệu quản trị | `src/services/admin_service.js` |
| Normalize template và evaluator | `src/services/qc_service.js` |
| Admin QC Form API | `python-api/app/api/routers/admin_qc.py` |
| Runtime QC API | `python-api/app/api/routers/qc.py` |
| QC models | `python-api/app/models/qc_form.py`, `python-api/app/models/qc_session.py` |

Backend hiện tại đã có contract cho `mode = deduction`, trọng số `pass_fail`, version nháp/phát hành, và công thức submit có khấu trừ. Khi thay đổi scoring, cần validate cả frontend build và backend compile/test.

---

## 3. Cơ chế tổng quát

Một QC Form gồm:

```text
QC Form
├── Thông tin chung
├── Ngưỡng đạt (%)
└── Cây nội dung
    ├── Nhóm
    │   ├── Nhóm con
    │   └── Tiêu chí
    └── Tiêu chí
```

### 3.1. Group

Group chỉ có vai trò:

- Phân loại nội dung.
- Tạo cấu trúc hiển thị.
- Chứa group con hoặc criterion.
- Không có điểm.
- Không trực tiếp tham gia tính kết quả.

### 3.2. Criterion

Criterion là node được đánh giá trong phiên QC.

Phase đầu quy định:

- Mọi criterion đều phải được đánh giá.
- Không sử dụng critical criterion.
- Không sử dụng điểm đạt riêng cho từng criterion.
- Không sử dụng tổng điểm đạt tối thiểu cố định.
- Không sử dụng N/A trong flow mới.

---

## 4. Ba kiểu tiêu chí

### 4.1. Chấm điểm — `point`

Dùng cho tiêu chí có nhiều mức độ hoàn thành.

#### Cấu hình

```json
{
  "nodeType": "criterion",
  "name": "Vệ sinh khu vực quầy",
  "description": "",
  "mode": "point",
  "maxScore": 20
}
```

#### Khi thực hiện QC

Người chấm nhập điểm từ `0` đến `maxScore`.

Ví dụ:

```text
Điểm tối đa: 20
Điểm thực tế: 18
Đóng góp vào tổng phiếu: 18/20
```

Criterion `point` không có `minPassScore` và không có kết quả fail riêng làm ảnh hưởng trực tiếp đến kết quả toàn phiếu.

Chỉ cần nhập một điểm hợp lệ thì criterion được xem là đã hoàn thành.

### 4.2. Đạt/Không đạt có trọng số — `pass_fail`

Dùng cho tiêu chí có hai kết quả rõ ràng.

#### Cấu hình

```json
{
  "nodeType": "criterion",
  "name": "Nhân viên mặc đúng đồng phục",
  "description": "",
  "mode": "pass_fail",
  "maxScore": 10
}
```

`maxScore` trong mode này được hiểu là trọng số.

#### Khi thực hiện QC

```text
Đạt       → nhận toàn bộ maxScore
Không đạt → nhận 0 điểm
```

Ví dụ:

```text
Trọng số: 10

Đạt       → 10/10
Không đạt → 0/10
```

Một criterion `pass_fail` Không đạt không tự động làm cả phiếu Không đạt. Nó chỉ làm giảm tổng điểm.

### 4.3. Khấu trừ phần trăm — `deduction`

Dùng cho tiêu chí không cộng điểm nhưng có thể trừ trực tiếp khỏi tỷ lệ tổng.

#### Cấu hình

```json
{
  "nodeType": "criterion",
  "name": "Không cập nhật nhật ký vận hành",
  "description": "",
  "mode": "deduction",
  "deductionPercent": 5
}
```

#### Khi thực hiện QC

```text
Đạt       → không khấu trừ
Không đạt → trừ deductionPercent điểm phần trăm
```

Ví dụ:

```text
Mức khấu trừ: 5 điểm %

Đạt       → -0 điểm %
Không đạt → -5 điểm %
```

Criterion `deduction`:

- Không có `maxScore`.
- Không tham gia tổng điểm tối đa.
- Không cộng điểm khi Đạt.
- Chỉ khấu trừ khi Không đạt.

Một criterion không được vừa tính điểm vừa khấu trừ để tránh phạt hai lần cho cùng một lỗi.

---

## 5. Công thức chính thức

### 5.1. Tổng điểm thực tế

```text
totalScore
= điểm của criterion point
+ điểm nhận được của criterion pass_fail
```

Criterion deduction không tham gia `totalScore`.

### 5.2. Tổng điểm tối đa

```text
maxScore
= maxScore của criterion point
+ maxScore/trọng số của criterion pass_fail
```

Criterion deduction không tham gia `maxScore`.

### 5.3. Tỷ lệ điểm gốc

```text
baseScoreRate = totalScore / maxScore × 100
```

Nếu `maxScore <= 0`, form không hợp lệ để đánh giá.

### 5.4. Tổng mức khấu trừ

```text
totalDeduction
= deductionPercent của mỗi criterion deduction bị Không đạt
```

Tổng khấu trừ được giới hạn tối đa ở `100` điểm phần trăm.

```text
totalDeduction = min(totalDeduction, 100)
```

### 5.5. Tỷ lệ cuối

```text
finalScoreRate = max(baseScoreRate - totalDeduction, 0)
```

### 5.6. Kết quả phiếu

```text
Nếu còn criterion chưa đánh giá:
→ Phiếu chưa hoàn thành.

Nếu finalScoreRate >= passThreshold:
→ PASSED.

Nếu finalScoreRate < passThreshold:
→ FAILED.
```

Pseudo code:

```js
if (hasIncompleteCriteria) {
  return 'incomplete'
}

if (maxScore <= 0) {
  return 'failed'
}

const baseScoreRate = (totalScore / maxScore) * 100
const totalDeduction = Math.min(calculatedDeduction, 100)
const finalScoreRate = Math.max(baseScoreRate - totalDeduction, 0)

return finalScoreRate >= passThreshold
  ? 'passed'
  : 'failed'
```

---

## 6. Ví dụ tính điểm

### 6.1. Cấu hình form

```text
Ngưỡng đạt: 80%
```

| Tiêu chí | Mode | Max/Khấu trừ | Kết quả | Điểm |
|---|---|---:|---|---:|
| Vệ sinh quầy | Point | 20 | 18 điểm | 18 |
| Trưng bày hàng hóa | Point | 20 | 16 điểm | 16 |
| Đồng phục | Pass/Fail | 10 | Đạt | 10 |
| Bảng giá | Pass/Fail | 10 | Không đạt | 0 |
| Nhật ký vận hành | Deduction | 5 điểm % | Không đạt | -5 điểm % |

### 6.2. Kết quả

```text
totalScore = 18 + 16 + 10 + 0 = 44
maxScore = 20 + 20 + 10 + 10 = 60

baseScoreRate = 44 / 60 × 100 = 73.33%
totalDeduction = 5 điểm %
finalScoreRate = 73.33% - 5% = 68.33%

68.33% < 80%
→ FAILED
```

### 6.3. Ví dụ đạt điểm gốc nhưng bị khấu trừ thành Không đạt

```text
baseScoreRate = 92%
totalDeduction = 15 điểm %
finalScoreRate = 77%
passThreshold = 80%

→ FAILED
```

### 6.4. Ví dụ pass/fail Không đạt nhưng phiếu vẫn Đạt

```text
Một criterion pass_fail Không đạt → nhận 0 điểm.
Không có quy tắc fail trực tiếp.

baseScoreRate = 90%
totalDeduction = 5 điểm %
finalScoreRate = 85%
passThreshold = 80%

→ PASSED
```

---

## 7. Những field đã bỏ khỏi cơ chế mới

### 7.1. `passScore` cấp form

Không còn cho admin nhập một tổng điểm đạt tối thiểu cố định.

Lý do:

- Trùng chức năng với `passThreshold`.
- Khi cùng tồn tại, người dùng không biết hệ thống ưu tiên điều kiện nào.
- Ngưỡng phần trăm dễ hiểu và không phụ thuộc tổng điểm tuyệt đối.

### 7.2. `minPassScore` cấp criterion

Criterion point không còn có điểm đạt riêng.

Lý do:

- Điểm criterion chỉ đóng góp vào tổng điểm.
- Một criterion điểm thấp không tự động làm cả phiếu thất bại.
- Loại bỏ tầng pass/fail criterion không cần thiết.

### 7.3. Critical criterion

Phase đầu không hỗ trợ critical criterion.

Không có tiêu chí nào được phép làm phiếu thất bại trực tiếp.

### 7.4. N/A

Phase đầu không sử dụng N/A trong flow mới.

Mọi criterion phải được đánh giá trước khi submit.

Code có thể tiếp tục đọc trạng thái N/A từ dữ liệu cũ để tránh làm hỏng lịch sử, nhưng UI tạo/chấm mới không nên tạo thêm N/A.

---

## 8. Validation khi tạo form

### 8.1. Form metadata

- Code bắt buộc.
- Code chỉ chứa chữ, số, `_` hoặc `-`.
- Code tối đa 50 ký tự.
- Tên bắt buộc.
- Mô tả bắt buộc theo validation hiện tại.
- `passThreshold` nằm trong `0–100`.

### 8.2. Cây tiêu chí

- Cây phải có node.
- Group phải có ít nhất một child.
- Tên group/criterion là bắt buộc.
- Ordering của node cùng cấp không được trùng.
- Ordering label chỉ chứa chữ và số.

### 8.3. Point criterion

```text
maxScore > 0
```

### 8.4. Pass/fail criterion

```text
maxScore > 0
```

`maxScore` được diễn giải là trọng số.

### 8.5. Deduction criterion

```text
0 < deductionPercent <= 100
```

### 8.6. Toàn form

Form phải có ít nhất một criterion tính điểm:

- `point`, hoặc
- `pass_fail`.

Form chỉ có criterion deduction không thể tạo ra `baseScoreRate` hợp lệ.

---

## 9. Dữ liệu frontend gửi khi lưu form

### 9.1. Metadata

```json
{
  "code": "FORM-STORE-01",
  "name": "Kiểm tra vận hành cửa hàng",
  "description": "Kiểm tra chất lượng vận hành định kỳ",
  "passThreshold": 80,
  "isActive": true,
  "status": "draft"
}
```

### 9.2. Point criterion

```json
{
  "nodeType": "criterion",
  "name": "Vệ sinh khu vực quầy",
  "description": "",
  "mode": "point",
  "maxScore": 20
}
```

### 9.3. Pass/fail criterion

```json
{
  "nodeType": "criterion",
  "name": "Nhân viên mặc đúng đồng phục",
  "description": "",
  "mode": "pass_fail",
  "maxScore": 10
}
```

### 9.4. Deduction criterion

```json
{
  "nodeType": "criterion",
  "name": "Không cập nhật nhật ký vận hành",
  "description": "",
  "mode": "deduction",
  "deductionPercent": 5
}
```

---

## 10. Contract backend hiện tại

### 10.1. Admin QC Form API

Các endpoint hiện được frontend sử dụng:

```text
GET    /api/admin/qc/forms
POST   /api/admin/qc/forms
GET    /api/admin/qc/forms/:id
PUT    /api/admin/qc/forms/:id
DELETE /api/admin/qc/forms/:id
```

Backend FastAPI cần tiếp tục giữ các invariant sau:

- Chấp nhận `mode = deduction`.
- Lưu và trả lại `deductionPercent` ở response frontend-facing; schema input nên tiếp tục chấp nhận alias snake/camel khi có.
- Không ép `pass_fail.maxScore` về `1`.
- Giữ nguyên trọng số `maxScore` của pass/fail.
- Không bắt buộc `minPassScore` với version mới.
- Không bắt buộc `passScore` cấp form với version mới.

Các endpoint version hiện có:

```text
GET    /api/admin/qc/forms/:id/versions
GET    /api/admin/qc/forms/:id/versions/:versionId
POST   /api/admin/qc/forms/:id/versions
PUT    /api/admin/qc/forms/:id/versions/:versionId
POST   /api/admin/qc/forms/:id/versions/:versionId/apply
DELETE /api/admin/qc/forms/:id/versions/:versionId
```

Rule chính:

- `PUT /forms/:id` chỉ cập nhật metadata form.
- Thay đổi cây tiêu chí hoặc `passThreshold` đi qua endpoint version.
- Chỉ version `draft` được sửa/xóa.
- Khi apply draft, published version cũ được chuyển sang `archived`.

### 10.2. Public QC Form API

Frontend tải template để thực hiện QC qua:

```text
GET /api/qc/forms/:id
```

Response cần trả:

```json
{
  "id": 1,
  "name": "Kiểm tra vận hành cửa hàng",
  "activeVersionId": 10,
  "version": "v1.1",
  "passThreshold": 80,
  "criteria": [
    {
      "id": 100,
      "mode": "deduction",
      "deductionPercent": 5
    }
  ]
}
```

Frontend cũng đọc được snake case:

```json
{
  "deduction_percent": 5
}
```

### 10.3. Session API

Khi tạo hoặc hoàn tất phiên QC, backend cần nhận hoặc tự snapshot:

```json
{
  "mode": "deduction",
  "deductionPercent": 5,
  "status": "fail"
}
```

Với pass/fail:

```json
{
  "mode": "pass_fail",
  "maxScore": 10,
  "status": "pass",
  "score": 10
}
```

### 10.4. Kết quả backend trả khi submit

```json
{
  "totalScore": 28,
  "maxScore": 30,
  "baseScoreRate": 93.33,
  "totalDeduction": 15,
  "score_rate": 78.33,
  "passThreshold": 80,
  "result": "failed"
}
```

Nếu backend vẫn tính bằng công thức cũ, frontend và backend có thể trả kết quả khác nhau.

---

## 11. UI đã triển khai

### 11.1. Editor

Select kiểu chấm có ba lựa chọn:

```text
Chấm điểm
Đạt / Không đạt
Khấu trừ phần trăm
```

#### Point

Hiển thị:

```text
Điểm tối đa
```

#### Pass/fail

Hiển thị:

```text
Trọng số
Đạt nhận toàn bộ trọng số, Không đạt nhận 0 điểm.
```

#### Deduction

Hiển thị:

```text
Mức khấu trừ khi Không đạt
Không cộng điểm; khi Không đạt sẽ trừ trực tiếp khỏi tỷ lệ tổng.
```

Editor cũng hiển thị:

- Tổng điểm tối đa.
- Tổng mức khấu trừ tối đa.

### 11.2. Màn thực hiện QC

- Point criterion hiển thị input điểm.
- Pass/fail criterion hiển thị nút Đạt/Không đạt.
- Deduction criterion hiển thị nút Đạt/Không đạt.
- Deduction hiển thị rõ mức trừ khi Không đạt.

### 11.3. Summary phiên QC

Summary hiện hiển thị:

- Tổng số criterion đã hoàn thành.
- Số criterion Đạt.
- Số criterion Không đạt/Lỗi.
- Tổng điểm thực tế/tối đa.
- Tỷ lệ điểm gốc.
- Tổng khấu trừ.
- Tỷ lệ cuối.

---

## 12. Checklist test end-to-end

### 12.1. Tạo form thử nghiệm

Tạo form:

```text
Ngưỡng đạt: 80%

Criterion A
- Mode: Point
- Max: 20

Criterion B
- Mode: Pass/Fail
- Trọng số: 10

Criterion C
- Mode: Deduction
- Khấu trừ: 5 điểm %
```

### 12.2. Test lưu nháp

- Lưu nháp thành công.
- Không có lỗi API enum mode.
- Refresh trang editor.
- Criterion A vẫn là `point`, max 20.
- Criterion B vẫn là `pass_fail`, trọng số 10.
- Criterion C vẫn là `deduction`, mức trừ 5.

Nếu pass/fail trở về 1 hoặc deduction mất sau refresh, backend chưa lưu đúng contract mới.

### 12.3. Test publish

- Publish thành công.
- Trang chi tiết hiển thị đúng ba mode.
- Public form API trả đúng cấu trúc.
- Form xuất hiện khi tạo phiếu QC mới.

### 12.4. Case Passed

```text
A: 18/20
B: Đạt → 10/10
C: Đạt → -0%

baseScoreRate = 28/30 = 93.33%
finalScoreRate = 93.33%
result = Passed
```

### 12.5. Case deduction nhưng vẫn Passed

```text
A: 20/20
B: Đạt → 10/10
C: Không đạt → -5%

baseScoreRate = 100%
finalScoreRate = 95%
result = Passed
```

### 12.6. Case deduction thành Failed

Sửa criterion C thành mức trừ 15:

```text
A: 18/20
B: Đạt → 10/10
C: Không đạt → -15%

baseScoreRate = 93.33%
finalScoreRate = 78.33%
result = Failed
```

### 12.7. Case pass/fail không fail trực tiếp

```text
A: 20/20
B: Không đạt → 0/10
C: Đạt → -0%

baseScoreRate = 66.67%
```

Kết quả phải chỉ dựa trên `passThreshold`, không dựa riêng vào việc B Không đạt.

### 12.8. Case incomplete

- Bỏ trống point criterion.
- Hoặc chưa chọn Đạt/Không đạt cho pass/fail.
- Hoặc chưa chọn Đạt/Không đạt cho deduction.

Kỳ vọng:

- Không thể submit.
- Summary hiển thị còn criterion chưa hoàn thành.

### 12.9. Case invalid form

- Form chỉ có deduction criterion.
- Không có point/pass_fail criterion.

Kỳ vọng:

- Không cho publish hoặc evaluator trả form không đủ tổng điểm để đánh giá.

---

## 13. Validate kỹ thuật đã thực hiện

- Vue SFC parser pass cho các file frontend đã sửa.
- `git diff --check` pass.
- Frontend production build pass với:

```text
Node: 20.20.1
NPM: 10.8.2
```

Lệnh build:

```bash
nvm use 20
npm run build
```

Build chỉ có warning chunk size đã tồn tại, không có lỗi compile.

---

## 14. Việc cần làm tiếp

### Ưu tiên 1 — Xác nhận backend contract

- Test POST/PUT form.
- Test GET detail sau refresh.
- Test public form API.
- Xác nhận backend không ép pass/fail về 1 điểm.
- Xác nhận backend lưu deduction percent.

### Ưu tiên 2 — Test full flow

```text
Tạo form
→ Lưu nháp
→ Refresh
→ Publish
→ Tạo phiếu QC
→ Chấm đủ ba mode
→ Submit
→ Mở lại chi tiết phiên
→ Kiểm tra báo cáo
```

### Ưu tiên 3 — Đồng bộ backend evaluator

Backend phải sử dụng cùng công thức:

```text
finalScoreRate
= totalScore / maxScore × 100
- totalDeduction
```

### Ưu tiên 4 — Kiểm tra dữ liệu lịch sử

- Không tự động tính lại phiếu đã hoàn thành.
- Không xóa field cũ khỏi database ngay.
- Kiểm tra form/version cũ vẫn đọc được.

### Ưu tiên 5 — Hoàn thiện UI

Sau khi backend và công thức hoạt động ổn định:

- Redesign editor.
- Làm rõ công thức bằng preview realtime.
- Hiển thị số criterion theo từng mode.
- Thêm confirmation khi publish.
- Thêm cảnh báo thay đổi chưa lưu.

---

## 15. Cơ chế chốt

```text
1. Group chỉ dùng để phân loại.
2. Criterion có ba mode:
   - point
   - pass_fail
   - deduction
3. Point:
   - Nhập điểm từ 0 đến maxScore.
4. Pass/fail:
   - Đạt = maxScore.
   - Không đạt = 0.
5. Deduction:
   - Đạt = không trừ.
   - Không đạt = trừ deductionPercent khỏi tỷ lệ tổng.
6. Mọi criterion phải được đánh giá.
7. Không có critical criterion.
8. Không có minPassScore.
9. Không có passScore tổng cố định.
10. Không dùng N/A trong flow mới.
11. Form phải có ít nhất một criterion tính điểm.
12. baseScoreRate = totalScore / maxScore × 100.
13. finalScoreRate = max(0, baseScoreRate - totalDeduction).
14. finalScoreRate >= passThreshold → Passed.
15. finalScoreRate < passThreshold → Failed.
```

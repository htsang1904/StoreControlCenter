# QC Form Creation Workflow

## 1. Mục tiêu

Tài liệu này mô tả quy trình tạo và quản lý biểu mẫu QC mới theo hướng:

- không cần thao tác trực tiếp trong Strapi dashboard,
- dễ dùng cho admin vận hành,
- giữ được version lịch sử,
- hỗ trợ cây tiêu chí có node cha và node lá,
- sẵn sàng dùng cho runtime QC ở màn chấm phiếu.

## 2. Phạm vi

Flow này áp dụng cho module quản trị biểu mẫu QC:

- danh sách biểu mẫu: `AdminQcFormsPage`
- tạo/chỉnh biểu mẫu: `AdminQcFormEditorPage`
- xem chi tiết biểu mẫu: `AdminQcFormDetailPage`
- backend admin API: `/api/admin/qc/forms`

Không bao gồm:

- flow tạo phiếu QC tại cửa hàng,
- flow finding/khắc phục,
- xóa biểu mẫu hoặc nhân bản biểu mẫu.

## 3. Bài toán cần giải quyết

Trước đây, để tạo một biểu mẫu QC đúng nghiệp vụ, user gần như phải hiểu và tự nối các entity trong Strapi:

- `qc-form`
- `qc-form-version`
- `qc-form-criterion`
- `qc-criterion`

Điều này không phù hợp cho vận hành. Flow mới chuyển toàn bộ việc tạo biểu mẫu sang custom UI của app, còn backend tự xử lý:

- version,
- hierarchy,
- snapshot tiêu chí,
- trạng thái draft/publish.

## 4. Trải nghiệm người dùng mong muốn

Admin chỉ cần làm 3 bước:

1. Khai báo metadata biểu mẫu.
2. Dựng cây tiêu chí bằng `Nhóm` và `Tiêu chí`.
3. Chọn `Lưu nháp` hoặc `Phát hành`.

Những thứ hệ thống tự làm:

- sinh version,
- sinh mã criterion snapshot theo version,
- lưu quan hệ cha/con,
- archive version cũ khi có version mới được phát hành.

## 5. Quy trình nghiệp vụ đề xuất

### Bước A. Tạo biểu mẫu mới

1. Admin vào `Quản lý biểu mẫu QC`.
2. Bấm `Tạo biểu mẫu`.
3. Nhập:
   - `Mã biểu mẫu`
   - `Tên biểu mẫu`
   - `Mô tả`
   - `Ngưỡng đạt`
   - `Kích hoạt`
4. Dựng cây tiêu chí.
5. Chọn:
   - `Lưu nháp`: tạo biểu mẫu với version đầu tiên là `v1.0`, trạng thái `draft`
   - `Phát hành`: tạo biểu mẫu với version đầu tiên là `v1.0`, trạng thái `published`

### Bước B. Dựng cây tiêu chí

Trong editor có 2 loại node:

- `Nhóm`
  - chỉ dùng để chia cấu trúc
  - không được chấm điểm
  - bắt buộc phải có ít nhất 1 node con
- `Tiêu chí`
  - chỉ node lá mới được chấm điểm
  - có các thuộc tính:
    - kiểu chấm
    - điểm tối đa
    - trọng số
    - tần suất
    - trọng yếu
    - bắt buộc

Rule chính:

- cây phải có ít nhất 1 node lá có thể chấm,
- nhóm trống không được lưu,
- `pass_fail` luôn quy đổi `maxScore = 1`,
- `point` phải có `maxScore > 0`.

### Bước C. Lưu nháp

Khi bấm `Lưu nháp`:

1. Backend validate metadata và cây tiêu chí.
2. Nếu là biểu mẫu mới:
   - tạo `qc-form`
   - tạo `qc-form-version` ở trạng thái `draft`
   - persist snapshot tiêu chí cho version này
3. Nếu là biểu mẫu đã có bản nháp mới nhất:
   - cập nhật lại chính draft đó
4. Nếu version mới nhất đang là `published`:
   - tạo version làm việc mới theo minor version kế tiếp
   - version mới này ở trạng thái `draft`

### Bước D. Phát hành

Khi bấm `Phát hành`:

1. Backend validate lại toàn bộ biểu mẫu.
2. Nếu đang sửa một draft:
   - publish ngay draft đó
3. Nếu đang sửa một biểu mẫu có latest version là `published`:
   - tạo version mới
   - ghi snapshot tiêu chí của version mới
   - set version mới thành `published`
   - archive các version `published` cũ

Kết quả:

- chỉ còn 1 version phát hành hiện hành,
- runtime QC luôn đọc từ latest published version,
- version cũ vẫn giữ lại để tra cứu lịch sử.

## 6. Quy tắc version

### 6.1 Khi tạo mới

- version đầu tiên luôn là `v1.0`

### 6.2 Khi chỉnh một draft

- tiếp tục dùng lại chính version draft hiện tại

### 6.3 Khi chỉnh một biểu mẫu đã phát hành

- hệ thống tự tạo minor version mới
- ví dụ:
  - `v1.0` -> `v1.1`
  - `v1.1` -> `v1.2`

### 6.4 Khi có version mới được phát hành

- version `published` cũ sẽ bị chuyển sang `archived`

## 7. Quy tắc dữ liệu quan trọng

### 7.1 Mã biểu mẫu

- nhập một lần khi tạo mới
- chỉ chấp nhận: chữ in hoa, số, `_`, `-`
- khi vào edit, mã biểu mẫu bị khóa để giữ định danh ổn định

### 7.2 Mã criterion

UI không bắt user nhập mã criterion nữa.

Backend tự sinh mã snapshot theo:

- `formCode`
- `versionNo`
- `ordering`

Ý nghĩa:

- mỗi version có snapshot tiêu chí riêng,
- tránh việc sửa version mới làm đè dữ liệu version cũ,
- runtime QC có thể đọc lại đúng cấu trúc đã phát hành ở từng thời điểm.

### 7.3 Ordering và hierarchy

Backend tự sinh:

- `ordering`: ví dụ `1`, `1.1`, `1.2`, `2.1`
- `level`
- `parent`

Node cha/con được khôi phục lại từ dữ liệu này khi:

- mở màn editor,
- xem trang detail,
- load runtime form để chấm QC.

### 7.4 Section name

Hiện tại `sectionName` được suy ra như sau:

- nếu node top-level là `group` thì lấy tên nhóm đó làm section,
- nếu node top-level là `criterion` thì fallback về `Tổng quát`.

Điểm này đang hợp lý cho MVP, nhưng nếu muốn giữ `section` như một field nghiệp vụ độc lập thì cần chốt thêm.

## 8. Hành vi UI của editor

## 8.1 Cột trái: Thiết lập biểu mẫu

Hiển thị các field:

- mã biểu mẫu
- tên biểu mẫu
- mô tả
- ngưỡng đạt
- kích hoạt

Và hiển thị thêm:

- trạng thái version hiện tại
- version làm việc
- tiến độ chuẩn bị
- số node cấu trúc
- số node chấm điểm

## 8.2 Cột phải: Dựng cây tiêu chí

Admin thao tác trực tiếp trên builder:

- thêm nhóm top-level
- thêm tiêu chí top-level
- thêm nhóm con
- thêm tiêu chí con
- đổi thứ tự lên/xuống
- xóa node

Chỉ nhóm mới có vùng quản lý `mục con`.

## 8.3 CTA chính

- `Lưu nháp`
- `Phát hành`

Không bắt user nhập:

- `versionNo`
- `status`
- `criterion code`

## 9. Hành vi UI của trang detail

Trang detail có 2 mục đích:

- cho admin nhìn lại version hiện hành,
- preview cấu trúc thực tế mà runtime QC sẽ dùng.

Trang này hiển thị:

- metadata biểu mẫu
- trạng thái version
- version hiện tại
- ngưỡng đạt
- tổng số node
- số node lá có thể chấm
- preview cây tiêu chí theo `ordering` và `level`

## 10. Contract API hiện tại

### 10.1 Tạo biểu mẫu

`POST /api/admin/qc/forms`

Payload FE gửi:

```json
{
  "code": "QC_STORE_STANDARD",
  "name": "QC cửa hàng chuẩn",
  "description": "Biểu mẫu QC chuẩn cho vận hành cửa hàng",
  "passThreshold": 80,
  "isActive": true,
  "status": "draft",
  "criteria": [
    {
      "nodeType": "group",
      "name": "Quy trình phục vụ",
      "description": "Nhóm tiêu chí phục vụ",
      "children": [
        {
          "nodeType": "criterion",
          "name": "Chào khách trong 5 giây",
          "description": "Quan sát trực tiếp tại quầy",
          "mode": "point",
          "maxScore": 10,
          "weight": 1,
          "frequency": "per_audit",
          "isCritical": true,
          "required": true
        }
      ]
    }
  ]
}
```

### 10.2 Cập nhật biểu mẫu

`PUT /api/admin/qc/forms/:id`

Payload giống create.

Backend sẽ tự quyết định:

- cập nhật draft hiện tại,
- hay tạo version mới,
- hay phát hành version mới.

### 10.3 Lấy chi tiết biểu mẫu

`GET /api/admin/qc/forms/:id`

Response đã normalize về:

- `latestVersion.versionNo`
- `latestVersion.status`
- `latestVersion.passThreshold`
- `latestVersion.criteria`
- `latestVersion.criteriaTree`
- `latestVersion.criteriaCount`
- `latestVersion.leafCriteriaCount`

## 11. Xử lý backend hiện tại

Backend hiện đang làm các việc sau:

1. Validate metadata biểu mẫu.
2. Validate tree tiêu chí.
3. Flatten tree thành danh sách có:
   - `ordering`
   - `level`
   - `parentCode`
   - `sortOrder`
4. Tự sinh snapshot criterion code theo version.
5. Tạo hoặc cập nhật `qc-criterion`.
6. Ghi lại quan hệ cha/con trên criterion snapshot.
7. Ghi `qc-form-criterion` cho version tương ứng.
8. Khi publish:
   - set version mới thành `published`
   - archive các published version cũ

## 12. Điểm hợp lý của flow hiện tại

- User không cần đụng Strapi dashboard.
- User không cần hiểu data model backend.
- Version được tự quản lý, giảm lỗi thao tác tay.
- Cây tiêu chí phản ánh đúng mental model nghiệp vụ QC.
- Runtime QC có thể phân biệt node cha và node lá.
- Lịch sử version không bị mất khi sửa biểu mẫu đã phát hành.

## 13. Điểm cần anh review thêm

Đây là các quyết định tôi đang tạm chốt theo hướng MVP, anh cần duyệt lại:

1. Policy version hiện tại chỉ tăng `minor`.
   - Nếu sau này cần breaking change lớn, có thể phải thêm rule tăng `major`.

2. `sectionName` đang suy ra từ top-level group.
   - Nếu nghiệp vụ cần một `section` độc lập với tên nhóm, nên tách field này.

3. Chưa có flow `duplicate form`.
   - Với user vận hành, đây có thể là tính năng cần làm sớm.

4. Chưa có flow `delete form/version`.
   - Hiện tại detail page mới chỉ để placeholder.

5. Chưa có lịch sử version ở UI.
   - Detail page đang chỉ xem latest version.

## 14. Acceptance Criteria đề xuất

Flow được xem là hợp lý nếu thỏa:

1. Admin tạo mới được một biểu mẫu mà không cần vào Strapi dashboard.
2. Admin có thể dựng cây tiêu chí nhiều cấp.
3. Chỉ node lá mới là node chấm điểm.
4. Lưu nháp xong mở lại vẫn thấy đúng cây đã tạo.
5. Phát hành xong runtime QC đọc đúng version phát hành mới nhất.
6. Chỉnh một biểu mẫu đang phát hành không làm mất dữ liệu version cũ.

## 15. Đề xuất bước tiếp theo

Nếu anh thấy flow này ổn, bước tiếp theo nên là:

1. Bổ sung màn lịch sử version trong trang detail.
2. Thêm `Duplicate biểu mẫu`.
3. Bổ sung test case backend cho:
   - create draft
   - publish create
   - edit draft
   - edit published -> create new version
   - hierarchy nhiều cấp

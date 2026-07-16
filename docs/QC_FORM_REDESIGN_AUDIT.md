# QC Form UI/UX Audit & Redesign Blueprint

## 1. Mục tiêu tài liệu

Tài liệu này tổng hợp toàn bộ thành phần UI, chức năng, luồng dữ liệu và ràng buộc nghiệp vụ liên quan đến hệ thống biểu mẫu QC trong StoreControlCenter.

Mục tiêu chính:

- Làm nguồn tham chiếu trước khi redesign trang quản lý biểu mẫu QC.
- Bảo đảm thiết kế mới không làm mất hoặc thay đổi nghiệp vụ hiện tại.
- Xác định những vấn đề UX đang tồn tại.
- Đề xuất kiến trúc màn hình và component phù hợp hơn với form builder phức tạp.
- Phân biệt thay đổi chỉ cần frontend với thay đổi cần backend hỗ trợ.
- Đưa ra roadmap triển khai theo mức độ rủi ro.

Tài liệu được xây dựng dựa trên workflow UI/UX của Antigravity Kit:

- `.agent/workflows/ui-ux-pro-max.md`
- `.agent/skills/frontend-design/SKILL.md`

---

## 2. Phạm vi QC Form

### 2.1. Các màn hình quản trị chính

| Màn hình | File | Vai trò |
|---|---|---|
| Danh sách biểu mẫu | `src/pages/AdminQcFormsPage.vue` | Tìm kiếm, lọc, xem và mở editor |
| Tạo/chỉnh sửa biểu mẫu | `src/pages/AdminQcFormEditorPage.vue` | Quản lý metadata, cấu trúc tiêu chí, validation và phát hành |
| Chi tiết biểu mẫu | `src/pages/AdminQcFormDetailPage.vue` | Xem thông tin, preview cấu trúc, sửa, nhân bản và xóa |
| Builder node tiêu chí | `src/components/AdminQcCriterionBuilderItem.vue` | Render và chỉnh sửa cây nhóm/tiêu chí dạng đệ quy |

### 2.2. Các điểm sử dụng biểu mẫu QC

| Chức năng | File | Vai trò |
|---|---|---|
| Khởi tạo phiếu QC | `src/components/CreateQcDraftModal.vue` | Chọn biểu mẫu khả dụng để tạo phiếu nháp |
| Thực hiện phiên QC | `src/pages/QCCreateSessionPage.vue` | Tải cấu trúc biểu mẫu và nhập kết quả chấm |
| API client và normalize dữ liệu | `src/services/admin_service.js` | Gọi API quản trị biểu mẫu và chuẩn hóa dữ liệu |
| Dữ liệu phiên QC | `src/services/qc_service.js` | Ánh xạ template/version vào phiên thực hiện QC |

### 2.3. Routes

Các route liên quan được khai báo trong `src/router/index.js`:

| Route | Tên route | Quyền truy cập |
|---|---|---|
| `/tools/qc-forms` | `Admin QC Forms` | Admin |
| `/tools/qc-forms/create` | `Admin QC Form Create` | Admin |
| `/tools/qc-forms/:id` | `Admin QC Form Detail` | Admin |
| `/tools/qc-forms/:id/edit` | `Admin QC Form Edit` | Admin |

Biểu mẫu QC cũng xuất hiện trong sidebar admin tại `src/layout/Sidebar.vue` và breadcrumb tại `src/layout/Header.vue`.

---

## 3. Mô hình dữ liệu frontend hiện tại

### 3.1. Dữ liệu biểu mẫu trong trang danh sách

Hàm normalize danh sách trong `src/services/admin_service.js` tạo ra cấu trúc gần tương đương:

```js
{
  id,
  code,
  name,
  description,
  isActive,
  hasLatestVersion,
  versionsCount,
  publishedVersionsCount,
  latestVersionNo,
  latestVersionStatus,
  updatedAt,
}
```

Ý nghĩa các trường:

- `id`: định danh biểu mẫu.
- `code`: mã nghiệp vụ của biểu mẫu.
- `name`: tên biểu mẫu.
- `description`: mô tả mục đích sử dụng.
- `isActive`: biểu mẫu đang được kích hoạt hay đã tắt.
- `hasLatestVersion`: biểu mẫu đã có version hay chưa.
- `versionsCount`: tổng số version.
- `publishedVersionsCount`: số version từng được phát hành.
- `latestVersionNo`: số version mới nhất, ví dụ `v1.0`.
- `latestVersionStatus`: trạng thái version mới nhất.
- `updatedAt`: thời gian cập nhật version mới nhất hoặc biểu mẫu.

### 3.2. Dữ liệu chi tiết biểu mẫu

Dữ liệu chi tiết được normalize thành:

```js
{
  id,
  code,
  name,
  description,
  isActive,
  latestVersion: {
    id,
    versionNo,
    status,
    passThreshold,
    criteria,
    criteriaTree,
    criteriaCount,
    leafCriteriaCount,
  },
}
```

### 3.3. Dữ liệu node trong editor

Node nhóm:

```js
{
  id,
  nodeType: 'group',
  orderingLabel,
  name,
  description,
  mode: 'point',
  maxScore: 0,
  children: [],
}
```

Node tiêu chí:

```js
{
  id,
  nodeType: 'criterion',
  name,
  description,
  mode: 'point' | 'pass_fail',
  maxScore,
  minPassScore,
  children: [],
}
```

### 3.4. Các khái niệm trạng thái cần phân biệt

Hệ thống hiện có ba khái niệm dễ bị nhầm lẫn:

1. **Form activation**
   - `Active`
   - `Inactive`

2. **Version status**
   - `draft`
   - `published`
   - `archived`

3. **Working state trên giao diện**
   - Chưa thay đổi.
   - Có thay đổi chưa lưu.
   - Đang lưu.
   - Lưu thành công.
   - Lưu thất bại.

Thiết kế mới phải thể hiện ba nhóm trạng thái này riêng biệt, không dùng chung một badge hoặc một nhãn mơ hồ.

---

## 4. Audit trang danh sách biểu mẫu

File hiện tại: `src/pages/AdminQcFormsPage.vue`.

### 4.1. Chức năng hiện có

- Tải danh sách biểu mẫu từ API theo trang.
- Hiển thị tối đa `20`, `50` hoặc `100` dòng mỗi trang.
- Tìm kiếm theo:
  - Mã biểu mẫu.
  - Tên biểu mẫu.
  - Mô tả.
  - Version mới nhất.
- Lọc theo trạng thái version:
  - Bản nháp.
  - Đang phát hành.
  - Lưu trữ.
  - Chưa có version.
- Hiển thị:
  - Mã biểu mẫu.
  - Tên và mô tả.
  - Version mới nhất.
  - Trạng thái version.
  - Tổng số version.
  - Ngày cập nhật.
- Hành động:
  - Xem chi tiết.
  - Chỉnh sửa.
  - Tạo biểu mẫu mới.
- Có loading state, error state và empty state.
- Sử dụng pagination dùng chung `AppPagination`.

### 4.2. Vấn đề chức năng

#### Search và filter chỉ chạy trên trang hiện tại

API hiện chỉ nhận:

```js
{
  page,
  pageSize,
}
```

Search và status filter được thực hiện bằng `computed` trên mảng dữ liệu của trang hiện tại. Điều này tạo ra các vấn đề:

- Người dùng có thể hiểu nhầm rằng search đang tìm trên toàn hệ thống.
- Một biểu mẫu nằm ở trang khác sẽ không xuất hiện trong kết quả.
- Tổng kết quả khi filter chỉ phản ánh dữ liệu đã tải.
- Pagination vẫn dựa trên tổng server nhưng nội dung được lọc local.

Đây là vấn đề ưu tiên cao. Thiết kế mới nên chọn một trong hai hướng:

1. Backend hỗ trợ `q`, `status`, `isActive` và `sort`.
2. Frontend tải toàn bộ dữ liệu trước khi filter, chỉ phù hợp khi tổng dữ liệu nhỏ.

Hướng 1 phù hợp hơn cho hệ thống quản trị lâu dài.

### 4.3. Vấn đề UI/UX

- Header chưa thể hiện rõ đây là thư viện quản lý checklist và version.
- Chưa có summary giúp admin hiểu trạng thái tổng thể.
- Trạng thái kích hoạt và trạng thái version chưa được tách rõ.
- Các nút `Xem` và `Sửa` dạng chữ làm bảng rộng và lặp lại nhiều.
- Thiếu menu hành động tổng hợp.
- Không có sort control.
- Không hiển thị người cập nhật gần nhất.
- Không hiển thị số nhóm và số tiêu chí.
- Không hiển thị biểu mẫu đang được bao nhiêu phiếu QC sử dụng.
- Không cho biết có draft mới hơn version đang live hay không.
- Trên mobile, bảng phải cuộn ngang và không tối ưu cho thao tác cảm ứng.

### 4.4. Kiến trúc màn hình đề xuất

#### Header

```text
Thư viện biểu mẫu QC
Quản lý checklist, version phát hành và trạng thái sử dụng.

[Nhập biểu mẫu] [Tạo biểu mẫu]
```

CTA `Tạo biểu mẫu` là primary. `Nhập biểu mẫu` chỉ bổ sung khi hệ thống hỗ trợ import.

#### Summary cards

- Tổng biểu mẫu.
- Đang phát hành.
- Draft cần hoàn thiện.
- Đã lưu trữ.

Các card nên có thể click để áp dụng filter tương ứng.

#### Toolbar

- Search toàn bộ dữ liệu server.
- Filter version status.
- Filter activation.
- Sort theo:
  - Cập nhật mới nhất.
  - Tên A–Z.
  - Số version.
- Tùy chọn Table/Card view nếu cần hỗ trợ tablet.

#### Cấu trúc bảng đề xuất

| Cột | Nội dung |
|---|---|
| Biểu mẫu | Code, name và description |
| Version live | Version đang published và ngày phát hành |
| Trạng thái | Draft, Published hoặc Archived |
| Kích hoạt | Active hoặc Inactive |
| Cấu trúc | Số nhóm và số tiêu chí lá |
| Cập nhật | Ngày và người cập nhật |
| Hành động | Menu ba chấm |

#### Menu hành động

- Xem chi tiết.
- Chỉnh sửa/Tạo version mới.
- Nhân bản.
- Lưu trữ.
- Bật hoặc tắt kích hoạt.
- Xóa.

Hành động nguy hiểm phải được tách khỏi các hành động thông thường bằng divider và màu cảnh báo.

#### Mobile

Trên màn hình nhỏ nên chuyển mỗi dòng thành card:

```text
FORM-STORE-01                    ⋯
Kiểm tra vận hành cửa hàng

Published v1.3     Active
24 tiêu chí        Cập nhật 15/07/2026
```

Không nên ép bảng nhiều cột cuộn ngang trên mobile.

---

## 5. Audit editor biểu mẫu QC

File hiện tại: `src/pages/AdminQcFormEditorPage.vue`.

### 5.1. Wizard hiện tại

Editor được tổ chức theo ba bước:

1. **Thiết lập**
   - Chốt metadata biểu mẫu.
2. **Cây tiêu chí**
   - Dựng nhóm và tiêu chí lá.
3. **Rà soát**
   - Kiểm tra trước khi phát hành.

Người dùng có thể quay lại bước trước. Muốn mở bước sau phải vượt qua validation của các bước trước đó.

### 5.2. Metadata hiện có

- Mã biểu mẫu.
- Tên biểu mẫu.
- Mô tả.
- Ngưỡng đạt phần trăm.
- Điểm đạt tối thiểu.
- Kích hoạt biểu mẫu.

Các quy tắc hiện tại:

- Mã biểu mẫu là bắt buộc.
- Mã biểu mẫu tối đa 50 ký tự.
- Tên biểu mẫu là bắt buộc.
- Mô tả được validate theo logic hiện có.
- Ngưỡng đạt phải nằm trong khoảng `0–100`.
- Điểm đạt tối thiểu không được âm.
- Điểm đạt tối thiểu không được vượt tổng điểm tối đa của các tiêu chí.

### 5.3. Cây tiêu chí hiện có

Builder hỗ trợ:

- Tạo nhóm cấp cao.
- Tạo tiêu chí cấp cao.
- Thêm nhóm con.
- Thêm tiêu chí con.
- Nhóm lồng nhiều cấp.
- Xóa node.
- Di chuyển node lên hoặc xuống trong cùng danh sách.
- Thu gọn hoặc mở rộng group.
- Tùy chỉnh ordering label cho group cấp cao.
- Hiển thị ordering đầy đủ dạng cây.

### 5.4. Kiểu chấm điểm

#### Chấm điểm

- `mode = point`.
- Có `maxScore`.
- Có `minPassScore`.
- `maxScore` phải lớn hơn 0.
- `minPassScore` không được âm.
- `minPassScore` không vượt `maxScore`.

#### Đạt/Không đạt

- `mode = pass_fail`.
- Luôn quy đổi thành 1 điểm.
- Điểm đạt tối thiểu mặc định là 1.
- Input điểm bị disable trên UI.

### 5.5. Validation cây tiêu chí

Validation hiện kiểm tra:

- Cây phải có ít nhất một node hợp lệ.
- Node phải có tên.
- Group phải có nội dung phù hợp.
- Ordering của các node cùng cấp không được trùng.
- Ordering label tùy chỉnh chỉ chứa chữ và số.
- Tiêu chí phải có mode hợp lệ.
- Điểm tối đa phải hợp lệ.
- Điểm đạt tối thiểu phải hợp lệ.
- Điểm đạt không vượt điểm tối đa.

Error được ánh xạ theo `node.id` để component builder hiển thị lỗi tại field tương ứng.

### 5.6. Versioning hiện tại

- Biểu mẫu mới bắt đầu từ `v1.0`.
- Nếu version hiện tại vẫn là draft, editor tiếp tục sửa version đó.
- Nếu version hiện tại đã published, editor tạo working version minor tiếp theo.
- Ví dụ: `v1.0 → v1.1`.
- Có hai hành động lưu riêng:
  - Lưu nháp.
  - Phát hành.

### 5.7. Payload lưu

Payload gửi từ editor gồm các nhóm dữ liệu chính:

```js
{
  code,
  name,
  description,
  isActive,
  versionNo,
  status,
  passThreshold,
  passScore,
  criteria,
}
```

`criteria` được serialize từ cây builder sang danh sách phẳng có ordering, level, parent và thông tin chấm điểm.

### 5.8. Vấn đề UX của editor hiện tại

#### Mật độ giao diện cao

- Mỗi node mở ra nhiều input cùng lúc.
- Các group lồng nhau tạo thành một trang rất dài.
- Người dùng khó nhận biết đang sửa node nào.
- Với biểu mẫu lớn, việc tìm lại một tiêu chí cụ thể mất nhiều thời gian.

#### Điều hướng trong cây hạn chế

- Không có outline tổng quát.
- Không có search node.
- Không có điều hướng nhanh đến node lỗi.
- Không có expand/collapse toàn bộ.
- Chỉ có di chuyển lên/xuống.
- Không hỗ trợ drag-and-drop.
- Không thể chuyển node sang group khác trực tiếp.

#### Thiếu thao tác năng suất

- Không có duplicate node.
- Không có duplicate group cùng toàn bộ children.
- Không có copy/paste cấu trúc.
- Không có template section thường dùng.
- Không có bulk collapse hoặc bulk delete.

#### Validation

- Error chủ yếu xuất hiện khi chuyển bước hoặc lưu.
- Thiếu error summary tổng quát.
- Không có danh sách node lỗi để click điều hướng.
- Error chưa được công bố qua `aria-live` hoặc `role="alert"`.
- Một số trạng thái vẫn phụ thuộc nhiều vào màu sắc.

#### Save và publish

- `Lưu nháp` nằm ở header.
- `Phát hành` nằm ở footer bước cuối.
- Hai hành động quan trọng bị tách thành hai khu vực.
- Không có trạng thái “có thay đổi chưa lưu”.
- Không cảnh báo khi rời trang.
- Không có autosave.
- Không có thông tin lần lưu gần nhất.
- Version chuẩn bị tạo chưa được giải thích đủ rõ.

#### Preview

- Bước review hiển thị cây nhưng chưa giống màn chấm QC thực tế.
- Không có preview mobile/desktop.
- Không kiểm tra được trải nghiệm người chấm trước khi publish.

---

## 6. Kiến trúc editor đề xuất

### 6.1. Builder workspace

Thay vì một form dài, nên chuyển sang bố cục ba vùng:

```text
┌──────────────────────────────────────────────────────────────┐
│ Breadcrumb | Form name | Draft v1.1 | Unsaved | Save/Publish │
├───────────────┬──────────────────────────┬───────────────────┤
│ Outline       │ Builder canvas           │ Inspector         │
│ Tree/search   │ Groups and criteria      │ Selected node     │
│ Error list    │ Insert/drag actions      │ Field editor      │
└───────────────┴──────────────────────────┴───────────────────┘
```

### 6.2. Header cố định

Header nên bao gồm:

- Nút quay lại.
- Mã và tên biểu mẫu.
- Working version.
- Version status.
- Saved/Unsaved state.
- Lần lưu gần nhất.
- `Lưu nháp`.
- `Preview`.
- `Phát hành`.
- Menu bổ sung.

Ví dụ:

```text
FORM-STORE-01 · Kiểm tra vận hành cửa hàng
v1.1 Draft · Có thay đổi chưa lưu

[Preview] [Lưu nháp] [Phát hành]
```

### 6.3. Outline sidebar

Outline bên trái nên có:

- Search theo tên hoặc ordering.
- Cây nhóm/tiêu chí dạng cô đọng.
- Icon phân biệt group và criterion.
- Badge lỗi trên node.
- Click để focus node trong canvas.
- Nút expand/collapse toàn bộ.
- Tổng số group.
- Tổng số tiêu chí.
- Tổng điểm tối đa.

Outline phải hỗ trợ keyboard navigation.

### 6.4. Builder canvas

Mỗi node trên canvas chỉ nên hiển thị summary:

- Drag handle.
- Ordering.
- Tên node.
- Loại node.
- Kiểu chấm.
- Điểm tối đa.
- Trạng thái validation.
- Menu hành động.

Không nên hiển thị toàn bộ input của mọi node cùng lúc.

Khi người dùng chọn node, Inspector mới hiển thị form chỉnh sửa.

#### Quick actions trên node

- Thêm group con.
- Thêm criterion con.
- Duplicate.
- Di chuyển lên/xuống.
- Chuyển sang group khác.
- Xóa.

#### Insert controls

Giữa hai node nên có điểm chèn:

```text
──────────── + Thêm mục tại đây ────────────
```

Điều này giúp người dùng kiểm soát chính xác vị trí node mới.

### 6.5. Inspector sidebar

Inspector bên phải hiển thị theo node đang chọn.

#### Khi chọn group

- Ordering label.
- Tên nhóm.
- Mô tả.
- Thống kê số child và số criterion lá.
- Thêm child.
- Duplicate group.
- Xóa group.

#### Khi chọn criterion

- Tên tiêu chí.
- Mô tả.
- Kiểu chấm.
- Điểm tối đa.
- Điểm đạt tối thiểu.
- Preview cách criterion xuất hiện khi chấm.
- Duplicate criterion.
- Xóa criterion.

Inspector nên sticky trên desktop. Trên tablet/mobile chuyển thành drawer hoặc bottom sheet.

### 6.6. Metadata

Metadata có thể đặt trong:

- Tab `Thông tin` riêng.
- Drawer cấu hình biểu mẫu.
- Panel đầu tiên của Outline.

Nên nhóm field thành:

1. **Nhận diện**
   - Code.
   - Name.
   - Description.

2. **Điều kiện đạt**
   - Pass threshold phần trăm.
   - Pass score.
   - Tổng điểm tối đa được tính tự động.

3. **Trạng thái sử dụng**
   - Active/Inactive.
   - Giải thích ảnh hưởng đến việc tạo phiếu QC.

### 6.7. Mobile/tablet

- Outline mở bằng drawer bên trái.
- Inspector mở bằng bottom sheet hoặc full-screen drawer.
- Canvas chỉ hiển thị card node cô đọng.
- Sticky bottom action bar chứa Save và Publish.
- Touch target tối thiểu 40–44px.
- Không dùng hover làm cách duy nhất để lộ hành động.

---

## 7. Redesign bước rà soát

### 7.1. Mục tiêu

Bước review không chỉ hiển thị dữ liệu đã nhập mà phải trả lời:

- Biểu mẫu đã hợp lệ chưa?
- Cấu trúc có dễ hiểu với người chấm không?
- Tổng điểm và điều kiện đạt có hợp lý không?
- Version nào sắp được phát hành?
- Việc phát hành sẽ ảnh hưởng gì?

### 7.2. Nội dung đề xuất

#### Validation summary

- Metadata hợp lệ.
- Ordering hợp lệ.
- Không có group rỗng.
- Tất cả criterion có kiểu chấm hợp lệ.
- Tổng điểm hợp lệ.
- Pass score hợp lệ.
- Ngưỡng phần trăm hợp lệ.

Nếu có lỗi, mỗi lỗi phải có link `Đi đến lỗi`.

#### Statistics

- Tổng group.
- Tổng criterion.
- Tổng điểm tối đa.
- Pass score.
- Pass threshold.
- Số criterion pass/fail.
- Số criterion chấm điểm.

#### Preview

- Preview giống màn thực hiện QC.
- Toggle desktop/mobile.
- Expand/collapse toàn bộ.
- Hiển thị input mẫu nhưng không cho submit.
- Link `Chỉnh sửa` tại từng group.

### 7.3. Publish confirmation

Khi nhấn phát hành, mở modal xác nhận:

```text
Phát hành version v1.1?

24 tiêu chí · Tổng 180 điểm
Ngưỡng đạt 80% · Điểm tối thiểu 144

Version đã phát hành sẽ được dùng khi tạo phiếu QC mới.
Các phiếu hiện tại vẫn giữ version đã chọn trước đó.

[Tiếp tục chỉnh sửa] [Phát hành v1.1]
```

Nội dung chính xác về ảnh hưởng đến phiếu hiện tại phải được xác nhận với backend trước khi hiển thị như một cam kết nghiệp vụ.

---

## 8. Audit trang chi tiết biểu mẫu

File hiện tại: `src/pages/AdminQcFormDetailPage.vue`.

### 8.1. Chức năng hiện có

- Tải thông tin biểu mẫu theo ID.
- Hiển thị code, name và description.
- Hiển thị trạng thái version mới nhất.
- Hiển thị activation.
- Hiển thị version hiện tại.
- Hiển thị pass threshold.
- Hiển thị tổng node.
- Hiển thị số criterion lá.
- Preview cấu trúc cây.
- Chỉnh sửa.
- Nhân bản.
- Xóa biểu mẫu có confirmation.

### 8.2. Vấn đề UI/UX

- Các metric card có trọng số thị giác ngang nhau.
- Chưa có lịch sử version.
- Không xem được version cũ.
- Không so sánh được hai version.
- Không biết version nào đang live nếu latest version là draft.
- Không biết form đang được dùng ở bao nhiêu phiếu QC.
- Không biết người tạo hoặc người cập nhật.
- Preview cây dùng indentation thủ công nên cây sâu dễ hẹp.
- Nút xóa nằm gần các hành động thông thường.
- “Nhân bản” cần xác nhận lại có thực sự copy dữ liệu hay chỉ mở trang tạo mới.

### 8.3. Kiến trúc đề xuất

#### Header

```text
FORM-STORE-01
Kiểm tra vận hành cửa hàng

Published v1.3 · Active

[Tạo version mới] [Nhân bản] [⋯]
```

#### Tabs

1. `Tổng quan`
2. `Cấu trúc`
3. `Lịch sử version`
4. `Đang sử dụng`

#### Tổng quan

- Metadata.
- Version live.
- Draft hiện có.
- Pass threshold.
- Pass score.
- Tổng điểm.
- Tổng group và criterion.
- Người cập nhật.
- Ngày cập nhật.

#### Cấu trúc

- Tree view có expand/collapse.
- Search node.
- Filter group/criterion.
- Summary điểm theo group.
- Preview dạng người chấm.

#### Lịch sử version

| Version | Status | Ngày tạo | Người tạo | Thay đổi | Hành động |
|---|---|---|---|---|---|
| v1.3 | Published | ... | ... | +3 tiêu chí | Xem |
| v1.2 | Archived | ... | ... | Điều chỉnh điểm | Xem |

#### Đang sử dụng

- Tổng phiếu QC sử dụng version.
- Phiếu đang mở.
- Phiếu hoàn tất.
- Các cửa hàng đang sử dụng.
- Link sang danh sách phiên QC.

Tab lịch sử version và usage có thể cần endpoint backend mới.

---

## 9. Điểm tiêu thụ biểu mẫu QC

### 9.1. Modal tạo phiếu QC

File: `src/components/CreateQcDraftModal.vue`.

Hiện tại modal hỗ trợ:

- Chọn cửa hàng.
- Chọn biểu mẫu QC khả dụng.
- Chọn thời điểm kiểm tra.
- Nhập ghi chú mở đầu.
- Empty state khi chưa có biểu mẫu.

Yêu cầu đối với redesign quản trị:

- Người quản trị phải hiểu biểu mẫu nào sẽ xuất hiện trong select này.
- UI phải giải thích rõ ảnh hưởng của `Active`, `Published` và `Archived`.
- Không nên cho phép hành động khiến select mất toàn bộ biểu mẫu khả dụng mà không cảnh báo.

### 9.2. Màn thực hiện QC

File: `src/pages/QCCreateSessionPage.vue`.

Màn hình này tải template/version đã gắn với phiếu nháp và khởi tạo state cho từng criterion có thể chấm.

Các state criterion điển hình:

```js
{
  status: 'pending',
  score: null,
  note: '',
  attachments: [],
}
```

Redesign editor nên có preview mô phỏng đúng trải nghiệm này để người tạo form hiểu biểu mẫu sẽ hoạt động như thế nào trong thực tế.

---

## 10. Ràng buộc nghiệp vụ không được phá

### 10.1. Cấu trúc cây

- Group chỉ dùng để gom nhóm.
- Group không trực tiếp tham gia chấm điểm.
- Criterion là node chấm điểm.
- Chỉ criterion lá được tính vào tổng điểm.
- Group có thể chứa group hoặc criterion.
- Ordering phải phản ánh đúng vị trí trong cây.
- Ordering của các node cùng cấp phải duy nhất.

### 10.2. Chấm điểm

- Criterion `point` có điểm tối đa.
- Criterion `point` có điểm đạt tối thiểu.
- Điểm đạt tối thiểu không vượt điểm tối đa.
- Criterion `pass_fail` luôn quy đổi thành 1 điểm.
- Pass score toàn form không vượt tổng điểm tối đa.
- Pass threshold nằm trong `0–100`.

### 10.3. Versioning

- Biểu mẫu mới bắt đầu từ `v1.0`.
- Draft hiện tại có thể tiếp tục chỉnh sửa.
- Version đã published không nên bị sửa trực tiếp.
- Chỉnh version đã published phải tạo version minor tiếp theo.
- Lưu draft và publish là hai hành động khác nhau.
- Phiếu QC phải giữ được version đã chọn tại thời điểm tạo.

### 10.4. Trạng thái

- `isActive` không đồng nghĩa với `published`.
- `draft`, `published` và `archived` là trạng thái của version.
- Active/inactive là trạng thái sử dụng của form.
- Thiết kế mới phải hiển thị riêng hai trạng thái này.

### 10.5. API contract hiện tại

Frontend hiện gọi:

```text
GET    /api/admin/qc/forms
POST   /api/admin/qc/forms
GET    /api/admin/qc/forms/:id
PUT    /api/admin/qc/forms/:id
DELETE /api/admin/qc/forms/:id
```

Repo hiện tại không có thư mục backend `api/`, vì vậy cần xác nhận API thực tế trước khi thay đổi contract.

---

## 11. Design system đề xuất

### 11.1. Định hướng

- B2B operations.
- Professional.
- Data-focused.
- Trust-oriented.
- Tối ưu cho màn hình làm việc dài và dữ liệu dày.
- Ưu tiên clarity hơn hiệu ứng trang trí.

### 11.2. Màu sắc

Recommendation tham khảo từ UI kit:

| Vai trò | Màu tham khảo |
|---|---|
| Primary text | `#0F172A` |
| Secondary text | `#334155` |
| CTA | `#0369A1` |
| Background | `#F8FAFC` |
| Strong text | `#020617` |

Khi triển khai nên ưu tiên CSS variables hiện có của dự án:

- `--primary`
- `--primary-strong`
- `--surface-muted`
- `--text-primary`
- `--text-secondary`
- `--stroke`
- `--stroke-strong`

Không nên hardcode một design system mới nếu chưa có yêu cầu đổi toàn bộ thương hiệu.

### 11.3. Visual hierarchy

- Dùng border và surface để phân vùng.
- Dùng shadow nhẹ cho sticky panel hoặc floating inspector.
- Không dùng shadow dày cho mọi card.
- Không dùng gradient tím/hồng.
- Không dùng glassmorphism.
- Không bo tròn mọi thành phần ở cùng một mức.
- CTA chính chỉ nên có một điểm nhấn màu mạnh trên mỗi vùng.

### 11.4. Spacing

- Theo hệ 8px.
- Khoảng cách nhỏ: 8px.
- Khoảng cách field: 16px.
- Khoảng cách section: 24–32px.
- Padding panel: 16–24px.

### 11.5. Typography

- UI dày dữ liệu nên dùng scale khoảng `1.125–1.2`.
- Body tối thiểu 14px cho desktop admin.
- Nội dung mô tả dài nên có line-height `1.5–1.6`.
- Label phải rõ hơn placeholder.
- Không sử dụng placeholder như label duy nhất.

### 11.6. Icons

- Tiếp tục sử dụng Material Symbols hiện có.
- Không thêm dependency icon mới nếu không cần thiết.
- Icon-only button phải có `aria-label`.
- Không dùng emoji thay icon chức năng.

---

## 12. Accessibility checklist

- Mọi input có label liên kết rõ ràng.
- Không dùng placeholder làm label duy nhất.
- Error summary dùng `role="alert"` hoặc `aria-live`.
- Error không chỉ biểu đạt bằng màu đỏ.
- Mỗi icon-only button có accessible name.
- Tab order theo đúng thứ tự thị giác.
- Outline và tree có thể điều hướng bằng keyboard.
- Focus state rõ ràng.
- Contrast chữ thường đạt tối thiểu 4.5:1.
- Touch target tối thiểu 40–44px.
- Không yêu cầu hover để truy cập hành động chính.
- Animation tuân thủ `prefers-reduced-motion`.
- Kiểm tra ít nhất tại các kích thước:
  - 375px.
  - 768px.
  - 1024px.
  - 1440px.

---

## 13. Component architecture đề xuất

### 13.1. Component dùng chung cho QC Form

```text
src/components/qc-form/
├── QcFormStatusBadge.vue
├── QcFormActivationBadge.vue
├── QcFormSummaryCard.vue
├── QcFormActionMenu.vue
├── QcFormVersionBadge.vue
├── QcFormOutline.vue
├── QcFormOutlineItem.vue
├── QcFormBuilderCanvas.vue
├── QcFormBuilderNode.vue
├── QcFormNodeInspector.vue
├── QcFormMetadataPanel.vue
├── QcFormValidationSummary.vue
├── QcFormScoreSummary.vue
├── QcFormPreview.vue
├── QcFormPublishDialog.vue
└── QcFormUnsavedChangesDialog.vue
```

Không bắt buộc tạo toàn bộ component ngay từ đầu. Chỉ tách khi component có trách nhiệm rõ ràng hoặc được dùng lại.

### 13.2. Composable đề xuất

```text
src/composables/
├── useQcFormBuilder.js
├── useQcFormValidation.js
├── useQcFormVersioning.js
└── useQcFormUnsavedChanges.js
```

#### `useQcFormBuilder`

- Tạo node.
- Tìm node.
- Thêm/xóa/duplicate.
- Di chuyển node.
- Flatten tree.
- Serialize tree.
- Tính ordering.

#### `useQcFormValidation`

- Metadata validation.
- Tree validation.
- Node error map.
- Error summary.
- Focus node lỗi đầu tiên.

#### `useQcFormVersioning`

- Parse version.
- Tính working version.
- Phân biệt draft/published.
- Chuẩn bị publish summary.

#### `useQcFormUnsavedChanges`

- Snapshot dữ liệu ban đầu.
- Detect dirty state.
- Cảnh báo route leave.
- Hiển thị lần lưu gần nhất.

### 13.3. Không thêm dependency khi chưa cần

UI kit đề xuất dùng VeeValidate hoặc FormKit cho form phức tạp. Tuy nhiên repo có quy tắc không tự ý đổi dependency hoặc kiến trúc.

Do đó:

- Giai đoạn đầu giữ validation hiện tại.
- Chỉ tách validation sang composable.
- Chỉ cân nhắc VeeValidate/FormKit nếu user phê duyệt thay đổi dependency.

---

## 14. Backend/API cần bổ sung nếu muốn đầy đủ tính năng

### 14.1. Search/filter server-side

Đề xuất API danh sách hỗ trợ:

```text
GET /api/admin/qc/forms
  ?page=1
  &pageSize=20
  &q=store
  &status=published
  &isActive=true
  &sort=updatedAt:desc
```

### 14.2. Version history

```text
GET /api/admin/qc/forms/:id/versions
GET /api/admin/qc/forms/:id/versions/:versionId
```

### 14.3. Compare version

```text
GET /api/admin/qc/forms/:id/compare
  ?fromVersionId=10
  &toVersionId=12
```

### 14.4. Usage statistics

```text
GET /api/admin/qc/forms/:id/usage
```

Dữ liệu mong muốn:

- Tổng phiên sử dụng.
- Phiên đang mở.
- Phiên hoàn tất.
- Cửa hàng sử dụng.
- Version được sử dụng nhiều nhất.

### 14.5. Duplicate

```text
POST /api/admin/qc/forms/:id/duplicate
```

Nếu không có endpoint duplicate, frontend có thể tải detail rồi tạo form mới, nhưng cần quy định rõ:

- Code mới được sinh như thế nào.
- Copy version nào.
- Copy trạng thái activation hay không.
- Bản copy bắt đầu từ version nào.

---

## 15. Roadmap triển khai

### Phase 1 — Redesign danh sách

Mức rủi ro: thấp.

- Redesign header.
- Thêm summary cards.
- Chuẩn hóa status/activation badge.
- Thêm action menu.
- Tối ưu mobile card.
- Giữ API hiện tại hoặc bổ sung server-side search nếu backend sẵn sàng.

### Phase 2 — Redesign trang chi tiết

Mức rủi ro: thấp đến trung bình.

- Redesign header và action hierarchy.
- Chuyển preview sang tree view tốt hơn.
- Tách danger zone.
- Chuẩn bị tab layout.
- Tab history/usage có thể để placeholder nếu backend chưa hỗ trợ.

### Phase 3 — Refactor logic editor

Mức rủi ro: trung bình.

- Tách builder logic sang composable.
- Tách validation logic.
- Tách metadata và score summary.
- Không thay API payload.
- Bổ sung unit test nếu repo có nền tảng test phù hợp.

### Phase 4 — Redesign builder workspace

Mức rủi ro: trung bình đến cao.

- Outline sidebar.
- Builder canvas.
- Inspector.
- Node summary card.
- Error navigation.
- Responsive drawer.

### Phase 5 — Productivity features

Mức rủi ro: cao hơn.

- Duplicate node/group.
- Drag-and-drop.
- Move giữa group.
- Autosave.
- Unsaved changes guard.
- Import/export cấu trúc.

### Phase 6 — Version intelligence

Phụ thuộc backend.

- Version history.
- Compare versions.
- Usage statistics.
- Publish impact preview.
- Restore/archive version.

---

## 16. Tiêu chí nghiệm thu redesign

### Danh sách

- Admin phân biệt được activation và version status.
- Search không gây hiểu nhầm về phạm vi dữ liệu.
- Hành động chính rõ ràng.
- Mobile không cần cuộn ngang để thực hiện hành động cơ bản.
- Pagination hoạt động với `20 / 50 / 100` dòng.

### Editor

- Có thể tìm và mở nhanh một node bất kỳ.
- Có thể nhận biết node đang được chỉnh sửa.
- Có thể điều hướng trực tiếp đến node lỗi.
- Cấu trúc lớn không tạo thành một form dài khó kiểm soát.
- Save và publish nằm trong action hierarchy nhất quán.
- Người dùng biết version nào đang được chỉnh.
- Người dùng biết dữ liệu đã lưu hay chưa.
- Payload API không thay đổi ngoài phạm vi được phê duyệt.

### Preview và publish

- Preview gần với trải nghiệm chấm QC thật.
- Publish confirmation hiển thị version, tổng criterion và điều kiện đạt.
- Không publish khi còn lỗi validation.
- Error có thể truy cập bằng keyboard và screen reader.

### Chi tiết

- Có thể hiểu form nào đang active và version nào đang live.
- Action nguy hiểm không đặt cạnh CTA chính.
- Cây tiêu chí dễ đọc ở desktop và mobile.
- Cấu trúc trang sẵn sàng mở rộng history và usage.

---

## 17. Các quyết định cần chốt trước khi implement

1. Có redesign riêng trang danh sách trước hay làm toàn flow cùng lúc?
2. Có backend hỗ trợ search/filter server-side không?
3. Active/inactive ảnh hưởng chính xác như thế nào đến form đã published?
4. Phiếu QC cũ có giữ nguyên version khi version mới được publish không?
5. Có được phép archive hoặc xóa form đang được sử dụng không?
6. Duplicate có copy toàn bộ version hay chỉ latest version?
7. Có cần drag-and-drop ngay trong phase đầu không?
8. Có cần autosave không?
9. Có được thêm dependency form hoặc drag-and-drop không?
10. Có cần version history và compare trong lần redesign đầu tiên không?
11. Có design reference hoặc brand guideline mới không?
12. Ưu tiên desktop admin hay phải hoàn thiện mobile đồng thời?

---

## 18. Khuyến nghị cuối cùng

Không nên redesign editor chỉ bằng cách đổi màu, border và spacing trên cấu trúc hiện tại. Vấn đề chính của editor là kiến trúc tương tác khi cây tiêu chí lớn, không chỉ là visual styling.

Hướng phù hợp nhất:

1. Biến trang danh sách thành thư viện biểu mẫu có trạng thái và version rõ ràng.
2. Biến editor thành workspace gồm Outline, Canvas và Inspector.
3. Giữ nguyên tree model, validation và payload hiện tại trong giai đoạn đầu.
4. Tách activation, version status và save state thành ba lớp trạng thái riêng.
5. Bổ sung preview giống trải nghiệm chấm QC thật.
6. Chỉ triển khai history, compare, usage và autosave sau khi xác nhận backend contract.

Thứ tự này tạo cải thiện UX lớn nhưng vẫn kiểm soát được rủi ro đối với nghiệp vụ QC và versioning.

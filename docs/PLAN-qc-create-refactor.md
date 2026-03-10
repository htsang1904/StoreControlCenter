# PLAN-qc-create-refactor

## 1. Mục tiêu

Refactor `QCCreateSessionPage` theo hướng:

- Đồng bộ UI với phong cách mới đang dùng ở `QCStoreDetailPage` và `CreateQcDraftModal`.
- Tách orchestration, scoring, autosave draft và presentation để page dễ đọc, dễ sửa.
- Chuẩn hóa luồng API theo contract backend hiện tại, tránh các nhánh gọi API sai ngữ nghĩa.
- Giữ nguyên nghiệp vụ QC hiện có, không đổi dependency và không mở rộng tính năng ngoài scope refactor.

Plan này chỉ phục vụ triển khai refactor an toàn theo phase. Không bao gồm rewrite toàn bộ QC flow.

## 2. Hiện trạng đã kiểm tra

### UI / cấu trúc

- `src/pages/QCCreateSessionPage.vue` đang ôm gần như toàn bộ concern của màn tạo phiếu:
  - load template
  - hydrate draft
  - autosave
  - weekly rule
  - scoring / evaluation
  - upload attachment
  - create finding
  - submit session
  - full page template
- Header và layout của page vẫn mang style cũ, chưa đồng bộ với pattern đang dùng ở `src/pages/QCStoreDetailPage.vue`.
- `src/components/QCCriterionTreeItem.vue` vẫn theo style cũ, có icon/bootstrap class lẫn với Tailwind hiện tại và đang gắn chặt vào event contract của parent.
- Page hiện vẫn cho sửa `Loại biên bản QC` và `Thời điểm kiểm tra`, nhưng theo flow hiện tại hai giá trị này đã được chọn ở bước tạo draft trước đó.
  - Ở màn create-session, hai trường này chỉ nên hiển thị dạng thông tin readonly lấy từ draft/context đã có.

### API / flow

- Restore draft đang có bug rõ ràng:
  - `src/pages/QCCreateSessionPage.vue` dùng `qcTemplates.some(...)` thay vì `qcTemplates.value.some(...)`.
  - Điều này có thể làm vỡ luồng mở lại draft ngay khi hydrate.
- Luồng tạo finding hiện không khớp backend:
  - frontend gửi `session_id: activeDraftId`
  - backend `api/src/api/qc-finding/controllers/qc-finding.js` yêu cầu `session` là QC session hợp lệ, không phải draft.
- Comment trong submit flow nói attachment của criterion chưa có nơi persist nên không xóa draft nếu có ảnh.
  - Backend `api/src/api/qc-session/controllers/qc-session.js` hiện đã nhận và lưu `attachments` ở session items.
  - Nghĩa là logic cleanup draft ở frontend đang lệch với contract hiện tại.

## 3. Scope

### Trong scope

- Refactor UI/UX của trang tạo phiếu QC.
- Tách page thành các block/component/composable nhỏ hơn.
- Chuẩn hóa luồng gọi API draft/template/session/finding cho đúng backend hiện có.
- Dọn các bug và mismatch dữ liệu đang ảnh hưởng trực tiếp tới màn này.

### Ngoài scope

- Đổi router hoặc điều hướng tổng của module QC.
- Viết lại backend QC session từ đầu.
- Đổi dependency UI.
- Mở rộng thêm nghiệp vụ finding nếu chưa thật sự cần.

## 4. Assumptions

- Nguồn tham chiếu UI chính là `src/pages/QCStoreDetailPage.vue` và các component QC mới sửa gần đây.
- Ưu tiên giữ contract backend hiện tại, chỉ đổi backend nếu có lý do nghiệp vụ rõ ràng.
- Với finding flow, hướng an toàn hơn là ràng lại frontend theo contract backend thay vì nới backend cho draft.
- `QCCreateSessionPage` là bước sau khi draft đã được tạo; `templateId` và `auditedAt` được xem là dữ liệu đầu vào đã chốt cho phiên hiện tại.
- Node cần nâng lên `20.19+` trước khi validate chuẩn frontend.

## 5. Nguyên tắc refactor

1. Tách theo concern, không tách cơ học.
2. Sửa bug contract trước khi polish UI.
3. Giữ API payload ổn định ở nhánh `createQcSession`, `createQcDraftSession`, `updateQcDraftSession`.
4. Nếu một luồng chưa được backend hỗ trợ thật sự, frontend phải phản ánh đúng trạng thái đó thay vì giả lập.
5. Mỗi phase phải merge độc lập được và có validate theo scope.

## 6. Kiến trúc đích đề xuất

### Page-level responsibilities

`QCCreateSessionPage.vue` sau refactor chỉ nên giữ:

- route/store context
- wire-up giữa các composable
- submit/cancel chính
- layout tổng của page

### Logic nên tách khỏi page

- `useQcCreateDraft`
  - tạo draft
  - hydrate draft
  - autosave
  - cleanup khi unmount / submit
- `useQcCreateTemplate`
  - lấy template detail theo `draft.templateId`
  - cung cấp metadata readonly để render phần thông tin phiên
- `useQcCreateEvaluation`
  - criteria state
  - weekly availability
  - payload normalize
  - evaluation summary
- `useQcCreateFinding`
  - modal state
  - rule enable/disable finding
  - submit finding theo contract hợp lệ

### UI blocks nên tách

- `QcCreatePageHeader`
- `QcCreateSessionMetaCard`
- `QcCreateSessionSummaryCard`
- refactor `QCCriterionTreeItem` để đồng bộ style mới

`QcCreateSessionMetaCard` nên hiển thị readonly:

- cửa hàng
- loại biên bản QC đã chọn từ bước trước
- thời điểm kiểm tra đã chọn từ bước trước
- trạng thái draft / thời điểm autosave gần nhất

Không nhất thiết phải tạo đúng tên file này, nhưng page cuối cùng phải đạt mức chia concern tương đương.

## 7. Phases đề xuất

### Phase 1. Audit và sửa mismatch contract trước

- Fix bug hydrate draft với `qcTemplates.value`.
- Bỏ khả năng chỉnh `Loại biên bản QC` và `Thời điểm kiểm tra` trong page.
- Chuyển hai trường này sang display readonly lấy từ draft/context.
- Xử lý finding flow theo một hướng rõ ràng.

Khuyến nghị:
- Tạm khóa hoặc ẩn nút tạo finding trong draft flow.
- Chỉ cho tạo finding sau khi session đã được tạo thật, hoặc chuyển finding sang bước follow-up sau submit.

Lý do:
- Đây là thay đổi ít rủi ro hơn so với nới backend để gắn finding vào draft.

Output mong muốn:
- Page không còn bug restore draft.
- Không còn editable field thừa so với flow tạo draft hiện tại.
- Không còn nhánh gọi finding API sai contract.

### Phase 2. Tách logic orchestration khỏi page

- Trích phần draft/template/evaluation thành composable riêng.
- Gom watchers trùng nhau, đặc biệt quanh:
  - `form.templateId`
  - `form.auditedAt`
  - `form.criteriaStates`
- Chuẩn hóa lifecycle:
  - init page
  - load template detail theo draft
  - hydrate draft
  - autosave debounce
  - cleanup khi unmount

Output mong muốn:
- `QCCreateSessionPage.vue` giảm mạnh kích thước.
- Mỗi nhánh logic có đầu vào/đầu ra rõ ràng.

### Phase 3. Refactor UI page cho đồng bộ module QC

- Thay header gradient cũ bằng page header cùng pattern với `QCStoreDetailPage`.
- Chia layout thành:
  - header/context
  - criteria workspace
  - summary sidebar
- Chuẩn hóa typography, spacing, card treatment, button hierarchy.
- Bổ sung empty/loading/error state rõ ràng hơn cho:
  - chưa có template
  - đang load template detail
  - lỗi restore draft

Output mong muốn:
- UI nhìn cùng họ với QC pages hiện tại.
- Summary panel rõ trạng thái draft, score, pending count, pass/fail reasons.

### Phase 4. Refactor `QCCriterionTreeItem`

- Chuẩn hóa giao diện non-leaf / leaf node.
- Tách controls cho `pass_fail` và `point`.
- Thay icon/bootstrap remnants bằng pattern icon hiện có trong repo.
- Rà lại hành vi note/attachment/finding trigger để child component chỉ emit intent rõ ràng.

Output mong muốn:
- Cây tiêu chí dễ scan hơn.
- Child component ít knowledge về business logic hơn.

### Phase 5. Chốt submit flow và draft cleanup

- Rà lại `criteriaPayload` với backend `createSession`.
- Xóa comment cũ về attachment persistence.
- Sau khi xác nhận attachment đã được persist ở session item, cleanup draft theo rule thống nhất.
- Chốt điều hướng sau submit và thông điệp lỗi/success.

Output mong muốn:
- Luồng submit không còn mang assumption cũ lệch backend.
- Draft không bị giữ lại sai lý do.

## 8. Task Breakdown

### Task QCR-1. Khóa bug và mismatch dữ liệu

- Files chính:
  - `src/pages/QCCreateSessionPage.vue`
  - `src/services/qc_service.js`
- Mục tiêu:
  - fix hydrate draft
  - bỏ editable controls của template/auditedAt trên page
  - quyết định handling finding trong draft flow
- Risk:
  - nếu sửa nóng ở page mà chưa cô lập state, dễ tạo side-effect autosave

### Task QCR-2. Tách composable cho draft/template/evaluation

- Files dự kiến:
  - `src/pages/QCCreateSessionPage.vue`
  - `src/composables/qc/*` hoặc thư mục tương đương
- Mục tiêu:
  - giảm page-level complexity
  - làm rõ dependency giữa draft, template detail và criteria state
- Risk:
  - watchers chạy sai thứ tự nếu chuyển nhiều logic cùng lúc

### Task QCR-3. Refactor UI page shell

- Files chính:
  - `src/pages/QCCreateSessionPage.vue`
  - component con mới nếu cần
- Mục tiêu:
  - đồng bộ visual language với `QCStoreDetailPage`
  - giảm cảm giác legacy/ghép vá ở header + summary

### Task QCR-4. Refactor criterion tree

- Files chính:
  - `src/components/QCCriterionTreeItem.vue`
- Mục tiêu:
  - làm component dễ đọc, dễ test hơn
  - giảm coupling với state shape của parent

### Task QCR-5. Final integration + smoke test

- Scope:
  - create draft
  - restore draft
  - autosave
  - submit session
  - weekly skip
  - attachment
  - finding action theo rule mới

## 9. Quyết định đề xuất cho finding flow

### Khuyến nghị chính

Không tạo finding ở draft stage.

### Lý do

- Backend hiện yêu cầu `session` thật.
- `activeDraftId` không đại diện cho `qc-session.id`.
- Nới backend cho finding-on-draft sẽ làm scope refactor phình ra khỏi nhu cầu UI hiện tại.

### Cách triển khai đề xuất

- Ẩn hoặc disable CTA `Khắc phục` trước khi session được tạo thật.
- Nếu nghiệp vụ vẫn cần, chuyển CTA này sang màn chi tiết session sau khi submit.
- Nếu user muốn giữ finding ngay tại màn create, cần mở task riêng cho backend hỗ trợ draft-linked finding.

## 10. Rủi ro chính

- Refactor watcher/autosave dễ gây duplicate request hoặc overwrite draft ngoài ý muốn.
- Refactor tree item nếu làm quá tay có thể ảnh hưởng trải nghiệm chấm điểm nhanh.
- Nếu thay đổi finding flow mà không thống nhất UX copywriting, user có thể tưởng là mất tính năng.

## 11. Validate đề xuất theo phase

### Frontend bắt buộc

- `node -v`
- `npm -v`
- `npm run build`
- `./scripts/agent-check.sh frontend`

### Nếu có chạm backend

- `npm --prefix api run build`
- `./scripts/agent-check.sh all`

### Smoke test nên chạy sau phase cuối

- Mở từ store detail vào create page.
- Tạo draft mới.
- Reload lại page bằng `draftId` để kiểm tra hydrate.
- Đổi template.
- Chấm một số tiêu chí point/pass-fail.
- Kiểm tra weekly skip.
- Upload/xóa ảnh minh chứng.
- Submit session thành công.
- Xác nhận draft được cleanup theo rule mới.
- Kiểm tra finding CTA theo quyết định cuối cùng.

## 12. Thứ tự triển khai khuyến nghị

1. Fix mismatch contract và bug restore draft.
2. Tách composable/state orchestration.
3. Refactor shell UI của page.
4. Refactor `QCCriterionTreeItem`.
5. Chốt submit flow, cleanup draft và smoke test.

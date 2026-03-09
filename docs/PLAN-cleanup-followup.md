# Cleanup Follow-up Plan

## Goal
Làm sạch các điểm nóng còn lại của codebase mà không đẩy `QC` vào refactor lớn quá sớm, đồng thời giữ an toàn cho `ticket` và tránh tạo thêm drift nghiệp vụ giữa frontend/backend.

## Current Focus
- `ticket` đã sạch hơn sau các phase trước, nhưng backend controller vẫn còn nặng.
- `QC` là vùng bẩn nhất hiện tại, nhưng nghiệp vụ vẫn chưa ổn định để tách lớn ngay.
- Ưu tiên trước mắt là `stabilize` và `cô lập` hơn là “refactor triệt để”.

## Tasks
- [ ] Task 1: Khóa scope cleanup hiện tại thành 3 track riêng `QC stabilization`, `QC refactor later`, `ticket backend later` trong tài liệu nội bộ. → Verify: plan này được chốt làm nguồn điều hướng, không còn nhập nhằng giữa roadmap ticket và QC.
- [ ] Task 2: Sửa lỗi mất attachment ở flow QC draft + submit, coi đây là bugfix bắt buộc trước mọi refactor lớn. → Verify: draft autosave không xóa `attachments`, submit session không overwrite `attachments: []`, reload draft vẫn thấy evidence đã lưu.
- [ ] Task 3: Audit và đánh dấu rõ các phần legacy/mock trong [qc_service.js](/Users/sanghuynh/Documents/GitHub/StoreControlCenter/src/services/qc_service.js) như `qcRepository`, `listQcSessions`, `getQcOverview`, `getQcStoreOverview`; chỉ xóa khi xác nhận không còn call site. → Verify: có danh sách “used / legacy / removable”, không có export/helper mồ côi không rõ vai trò.
- [ ] Task 4: Tách nhẹ `qc_service.js` theo boundary an toàn, chỉ gom utility thuần và API sống thật, chưa đụng evaluator nếu nghiệp vụ còn đổi. → Verify: tối thiểu có các nhóm file kiểu `qc_api`, `qc_draft_api`, `qc_template_api` hoặc tương đương; page QC vẫn chạy cùng contract cũ.
- [ ] Task 5: Giảm duplication rule QC giữa frontend và backend bằng cách chốt một nguồn sự thật cho scoring/normalization. Nếu chưa thể gom shared code, phải chốt rõ backend là source of truth và frontend chỉ tính preview. → Verify: tài liệu ghi rõ source of truth; code frontend không còn tự quyết kết quả cuối cùng khác backend.
- [ ] Task 6: Chia nhỏ [QCCreateSessionPage.vue](/Users/sanghuynh/Documents/GitHub/StoreControlCenter/src/pages/QCCreateSessionPage.vue) và [QCStoreDetailPage.vue](/Users/sanghuynh/Documents/GitHub/StoreControlCenter/src/pages/QCStoreDetailPage.vue) sau khi Task 2-5 ổn định. → Verify: draft handling, weekly criteria, template loading, summary/filter không còn dồn hết vào page component.
- [ ] Task 7: Sau khi QC ổn định, quay lại refactor backend [ticket.js](/Users/sanghuynh/Documents/GitHub/StoreControlCenter/api/src/api/ticket/controllers/ticket.js) thành controller mỏng + service/domain helper. → Verify: permission helper tiếp tục được tái dùng, controller không còn ôm dashboard, upload, transitions và notifications trong cùng một lớp lớn.
- [ ] Task 8: Verification luôn làm cuối mỗi track, không dồn đến cuối toàn bộ chương trình cleanup. → Verify: mỗi task hoàn thành đều có build/check đúng scope và smoke test nghiệp vụ tương ứng.

## Execution Order
1. `QC stabilization`
2. `QC boundary cleanup`
3. `QC page cleanup`
4. `ticket backend cleanup`

## Done When
- [ ] Attachment QC không còn bị mất ở draft và submit flow.
- [ ] `qc_service.js` không còn chứa đồng thời mock repository, draft API, template API và legacy helper trong cùng một khối không phân ranh giới.
- [ ] Rule QC có source of truth rõ ràng, không còn drift khó kiểm soát giữa frontend/backend.
- [ ] Page QC giảm đáng kể responsibility trước khi đụng tới refactor backend ticket lớn.
- [ ] `ticket.js` được lên kế hoạch refactor riêng sau khi QC đã qua giai đoạn dang dở.

## Notes
- Không triển khai full refactor `QC` khi nghiệp vụ còn thay đổi hàng ngày.
- Với `QC`, ưu tiên bugfix và boundary cleanup trước architectural cleanup.
- Với `ticket`, không mở lại refactor lớn cho tới khi track `QC stabilization` xong.

# UI Brief: Quản lý QC cửa hàng

Tài liệu này tổng hợp lại các màn hình, chức năng và trạng thái UI cần thiết cho cụm **Quản lý QC cửa hàng**. Mục tiêu là để designer có thể đọc nhanh luồng nghiệp vụ trước khi làm lại UI.

## 1. Bối cảnh nghiệp vụ

QC cửa hàng là luồng nhân sự kiểm tra chất lượng vận hành theo biểu mẫu QC đang áp dụng.

Biểu mẫu QC được quản lý ở khu vực Admin. Khi tạo phiếu QC cho cửa hàng, hệ thống chỉ dùng **version đang áp dụng** của biểu mẫu. Nếu người dùng tạo phiếu nháp, phiếu nháp phải ghi nhớ đúng `formVersionId` tại thời điểm khởi tạo để sau này mở lại không bị đổi cấu trúc nếu admin phát hành version mới.

Luồng chính:

1. Người dùng vào danh sách cửa hàng QC.
2. Chọn một cửa hàng để xem lịch sử QC và phiếu nháp.
3. Khởi tạo phiếu QC nháp bằng biểu mẫu đang áp dụng.
4. Mở phiếu nháp để chấm từng tiêu chí.
5. Hoàn tất toàn bộ tiêu chí rồi lưu thành phiên QC chính thức.
6. Hệ thống tính điểm, khấu trừ, kết luận đạt/không đạt và sinh finding nếu có lỗi.

## 2. Route và trang liên quan

| Route | File hiện tại | Vai trò |
| --- | --- | --- |
| `/QC` | `src/pages/QCManagementPage.vue` | Danh sách/tổng quan QC theo cửa hàng |
| `/QC/store/:storeId` | `src/pages/QCStoreDetailPage.vue` | Chi tiết QC của một cửa hàng, lịch sử phiên và phiếu nháp |
| `/QC/store/:storeId/create?draftId=...` | `src/pages/QCCreateSessionPage.vue` | Màn chấm phiếu QC từ phiếu nháp |
| Modal trong trang chi tiết | `src/components/CreateQcDraftModal.vue` | Khởi tạo phiếu nháp QC |

## 3. Nguyên tắc UI chung

- Ưu tiên thao tác vận hành, không làm kiểu landing page.
- Các trang cần đọc nhanh trên desktop và dùng được trên mobile.
- Những trạng thái quan trọng phải rõ: chưa kiểm tra, đạt, không đạt, phiếu nháp, đang chấm, đã chốt.
- UI phải làm rõ sự khác nhau giữa **biểu mẫu đang áp dụng** và **phiếu nháp đang chấm**.
- Không cần hiển thị quá nhiều thông tin kỹ thuật như `formVersionId`, nhưng phải hiển thị version biểu mẫu theo cách dễ hiểu khi cần.
- Các thao tác nguy hiểm hoặc mất dữ liệu cần confirm: xóa nháp, rời trang khi có thay đổi chưa lưu nếu sau này có thêm.
- Empty state cần chỉ rõ người dùng phải làm gì tiếp theo.

## 4. Trang `/QC`: Danh sách QC cửa hàng

### Mục tiêu trang

Giúp người quản lý xem nhanh tình trạng QC toàn bộ cửa hàng, tìm cửa hàng cần kiểm tra lại và đi vào chi tiết từng cửa hàng.

### Đối tượng sử dụng

- Admin hoặc người có quyền xem nhiều cửa hàng.
- Store/QC user chỉ thấy các cửa hàng được gán.

### Chức năng chính

- Xem danh sách cửa hàng trong phạm vi quyền.
- Xem thống kê QC tổng quan theo khoảng thời gian.
- Tìm kiếm cửa hàng.
- Sắp xếp theo tổng phiên, phiên đạt, phiên lỗi, điểm QC.
- Lọc theo danh sách cửa hàng từ query `store_ids`.
- Chọn khoảng ngày qua query `date_from`, `date_to`.
- Xuất báo cáo CSV.
- Bấm vào cửa hàng để vào trang chi tiết.

### Dữ liệu cần hiển thị

Phần tổng quan:

- Tổng số cửa hàng.
- QC score trung bình.
- Số cửa hàng cần kiểm tra lại.
- Tỷ lệ cửa hàng đã có QC.

Bảng/card cửa hàng:

- Mã cửa hàng.
- Tên/địa chỉ ngắn.
- Khu vực.
- Tổng phiên QC.
- Số phiên đạt.
- Số phiên lỗi.
- Điểm QC trung bình hoặc tỷ lệ điểm.
- Trạng thái sức khỏe QC: chưa kiểm tra, đạt tiêu chuẩn, cần nhắc nhở, vi phạm nghiêm trọng.
- Lần QC gần nhất.
- Kết quả lần QC gần nhất.

### Trạng thái UI cần có

- Loading danh sách.
- Empty state khi không có cửa hàng.
- Empty state khi search/filter không có kết quả.
- Error state khi không tải được thống kê.
- Trạng thái cửa hàng chưa từng QC.
- Trạng thái dữ liệu đang được lọc theo ngày/cửa hàng.

### Lưu ý cho designer

- Desktop nên ưu tiên bảng để so sánh nhiều cửa hàng.
- Mobile nên ưu tiên card gọn, mỗi card cần có action rõ để vào chi tiết.
- Không nên nhồi toàn bộ metric vào card mobile; chỉ giữ các tín hiệu quyết định: score, trạng thái, phiên lỗi, lần QC gần nhất.
- CSV export là chức năng phụ, không nên nổi hơn CTA xem chi tiết.

## 5. Trang `/QC/store/:storeId`: Chi tiết QC cửa hàng

### Mục tiêu trang

Cho biết lịch sử QC của một cửa hàng, phiếu nháp đang có, và cho phép khởi tạo/tiếp tục chấm QC.

### Chức năng chính

- Xem thông tin cửa hàng.
- Xem thống kê QC của cửa hàng theo bộ lọc.
- Lọc phiên QC theo trạng thái đạt/không đạt.
- Tìm kiếm phiên theo mã, ghi chú, biểu mẫu.
- Lọc theo khoảng ngày.
- Xem danh sách phiếu nháp.
- Tiếp tục chấm phiếu nháp.
- Xóa phiếu nháp.
- Khởi tạo phiếu QC mới qua modal.
- Xem chi tiết một phiên QC đã chốt trong modal.
- Quay lại danh sách cửa hàng QC.

### Dữ liệu cần hiển thị

Header:

- Tên/mã cửa hàng.
- Mô tả ngắn: đang xem QC, nháp, lịch sử.
- CTA chính: tạo phiếu QC mới.

Summary:

- Phiên đang hiển thị.
- Tỷ lệ đạt.
- Số phiên cần khắc phục.
- Điểm trung bình.

Danh sách phiên/nháp:

- Mã phiên hoặc mã nháp.
- Loại record: phiếu nháp hoặc phiên đã chốt.
- Biểu mẫu QC.
- Version biểu mẫu nếu có thể hiển thị gọn.
- Thời điểm kiểm tra.
- Người kiểm tra.
- Tổng điểm/tỷ lệ điểm.
- Kết quả: đạt, không đạt, đang chấm/nháp.
- Ghi chú ngắn.
- Lý do không đạt nếu có: chưa đạt ngưỡng, có tiêu chí không đạt, còn tiêu chí chưa chấm.

### Modal tạo phiếu nháp

Chức năng:

- Chọn biểu mẫu QC đang áp dụng.
- Chọn thời điểm kiểm tra.
- Nhập ghi chú mở đầu.
- Tạo phiếu nháp và chuyển sang màn chấm.

Thông tin cần truyền đạt:

- Chỉ hiển thị biểu mẫu có version đang áp dụng.
- Phiếu nháp sẽ dùng đúng version tại thời điểm tạo.
- Nếu chưa có biểu mẫu khả dụng, cần empty state hướng người dùng qua Admin QC Forms để phát hành và áp dụng biểu mẫu.

### Modal xem chi tiết phiên QC

Cần hiển thị:

- Mã phiên.
- Cửa hàng.
- Người kiểm tra.
- Biểu mẫu/version đã dùng.
- Ngày kiểm tra.
- Kết quả đạt/không đạt.
- Tổng điểm, điểm tối đa, tỷ lệ điểm.
- Danh sách tiêu chí đã chấm.
- Ghi chú và ảnh đính kèm theo tiêu chí nếu có.
- Finding/phần cần khắc phục nếu có.

### Trạng thái UI cần có

- Loading phiên QC.
- Loading danh sách nháp.
- Error khi không tải được session/draft.
- Empty state khi chưa có lịch sử QC.
- Empty state khi chưa có phiếu nháp.
- Confirm xóa phiếu nháp.
- Trạng thái record nháp dễ phân biệt với phiên đã chốt.

### Lưu ý cho designer

- Trang này là nơi user ra quyết định: tiếp tục nháp cũ hay tạo phiếu mới.
- Phiếu nháp nên được đặt dễ thấy nhưng không lẫn với lịch sử đã chốt.
- Khi có nhiều nháp, cần hiển thị ngày tạo/cập nhật và biểu mẫu để tránh mở nhầm.
- Không nên dùng quá nhiều badge nhỏ cạnh nhau; nên gom status thành cụm dễ đọc.

## 6. Trang `/QC/store/:storeId/create`: Chấm phiếu QC

### Mục tiêu trang

Giúp người dùng hoàn tất đánh giá QC theo biểu mẫu đã chọn, lưu nháp tự động và submit thành phiên QC chính thức.

Trang này luôn đi từ phiếu nháp. Nếu không có `draftId`, cần báo người dùng quay lại chi tiết cửa hàng để khởi tạo.

### Chức năng chính

- Load phiếu nháp theo `draftId`.
- Load đúng version biểu mẫu đã ghim trong nháp.
- Hiển thị cây tiêu chí theo nhóm.
- Chấm từng tiêu chí.
- Nhập điểm cho tiêu chí dạng điểm.
- Chọn đạt/không đạt cho tiêu chí dạng đạt/không đạt.
- Chọn đạt/không đạt cho tiêu chí dạng khấu trừ.
- Thêm ghi chú và ảnh cho từng tiêu chí.
- Autosave phiếu nháp.
- Lọc nhanh tiêu chí: tất cả, chưa chấm, không đạt.
- Nhảy tới tiêu chí lỗi/chưa hoàn tất.
- Xem tổng quan điểm và tiến độ.
- Submit khi đã hoàn tất toàn bộ tiêu chí.
- Sau khi submit thành công, xóa draft và quay lại chi tiết cửa hàng.

### Loại tiêu chí

**Point**

- User nhập điểm từ 0 đến điểm tối đa.
- Có điểm là xem như đã chấm.
- Điểm đóng góp trực tiếp vào tổng điểm gốc.

**Pass/Fail**

- User chọn đạt hoặc không đạt.
- Nếu đạt, cộng toàn bộ điểm của tiêu chí.
- Nếu không đạt, cộng 0 điểm và có thể sinh finding.

**Deduction**

- User chọn đạt hoặc không đạt.
- Nếu đạt, không trừ gì.
- Nếu không đạt, trừ theo `%` cấu hình của tiêu chí.
- Tổng khấu trừ được capped tối đa 100 điểm phần trăm.

### Dữ liệu cần hiển thị

Header:

- Tên cửa hàng.
- Tên biểu mẫu QC.
- Version biểu mẫu đang dùng.
- Trạng thái phiếu: phiếu nháp.
- Ngày tạo nháp.

Khu vực tiêu chí:

- Nhóm tiêu chí.
- Mã/thứ tự tiêu chí.
- Tên tiêu chí.
- Mô tả tiêu chí.
- Loại chấm và thang điểm/khấu trừ.
- Trạng thái: chưa chấm, đạt, không đạt, N/A nếu có.
- Ghi chú.
- Ảnh đính kèm.

Sidebar hoặc summary:

- Số tiêu chí đã hoàn tất.
- Số tiêu chí còn lại.
- Số tiêu chí không đạt.
- Điểm gốc.
- Tổng khấu trừ.
- Tỷ lệ điểm cuối.
- Ngưỡng đạt.
- Kết luận dự kiến: đạt/không đạt/chưa hoàn tất.

Footer/action:

- Quay lại.
- Lưu nháp hoặc trạng thái autosave.
- Submit/lưu phiên QC.

### Rules chức năng cần UI phản ánh

- Không cho submit nếu còn tiêu chí chưa chấm.
- Không cho submit nếu không có version biểu mẫu hợp lệ.
- Nếu autosave lỗi, cần báo nhẹ nhưng rõ.
- Nếu có tiêu chí không đạt, nên giúp user jump tới tiêu chí đó.
- Nếu điểm cuối dưới ngưỡng, hiển thị rõ lý do không đạt.
- Nếu user rời trang, hệ thống cố autosave draft.

### Trạng thái UI cần có

- Loading draft.
- Draft không tồn tại hoặc đã bị xóa.
- Draft không thuộc cửa hàng hiện tại.
- Draft chưa có biểu mẫu hợp lệ.
- Version biểu mẫu không tải được.
- Không có tiêu chí chấm.
- Autosaving/saved/error nếu designer muốn đưa vào.
- Submit loading.
- Submit error.
- Upload ảnh lỗi: sai định dạng, quá dung lượng, quá số lượng.

### Lưu ý cho designer

- Đây là màn hình thao tác dài, cần tối ưu cho việc chấm liên tục.
- Mobile cần có footer sticky cho action chính.
- Summary điểm nên luôn dễ nhìn nhưng không che nội dung chấm.
- Tiêu chí không đạt cần nổi bật hơn tiêu chí đã đạt.
- Ghi chú/ảnh không nên bung hết mặc định; chỉ bung khi tiêu chí fail hoặc đã có nội dung.

## 7. Finding/khắc phục

Hiện backend có thể sinh finding tự động khi submit phiên không đạt và tiêu chí fail có `requires_fix`.

UI hiện tại trong màn chấm chưa có luồng tạo/assign finding thủ công đầy đủ. Nếu designer làm lại, có thể cân nhắc tách thành giai đoạn sau.

Các hướng UI có thể cần:

- Badge số finding mở trên phiên QC.
- Tab hoặc section "Cần khắc phục" trong chi tiết phiên.
- Trạng thái finding: open, in_progress, resolved, verified, rejected.
- Người phụ trách.
- Hạn xử lý.
- Ghi chú khắc phục.
- Ảnh bằng chứng.
- Verify sau khi xử lý.

## 8. Liên kết với Admin Biểu mẫu QC

Designer cần biết các điểm sau để UI không mâu thuẫn:

- Danh sách biểu mẫu admin hiển thị bản đang áp dụng, không hiển thị draft làm mặc định.
- Một biểu mẫu có thể có nhiều version.
- Version `draft` dùng để chỉnh sửa, không dùng tạo phiếu QC.
- Version `published` hiện đang được hiểu là version đang áp dụng.
- Khi tạo nháp QC, hệ thống ghim `formVersionId`.
- Nếu admin áp dụng version mới, nháp cũ vẫn tiếp tục theo version cũ đã ghim.

## 9. Gợi ý phân nhóm lại navigation

Nhóm người dùng vận hành:

- QC cửa hàng
- Chi tiết cửa hàng
- Chấm phiếu
- Finding/khắc phục nếu bật

Nhóm admin cấu hình:

- Biểu mẫu QC
- Tạo/chỉnh version biểu mẫu
- Lịch sử version
- Áp dụng version

Hai nhóm này nên liên kết bằng wording thống nhất:

- "Biểu mẫu QC"
- "Version đang áp dụng"
- "Phiếu nháp"
- "Phiên QC"
- "Tiêu chí"
- "Khấu trừ"
- "Ngưỡng đạt"

## 10. Checklist cho bản thiết kế mới

- Có đủ desktop/tablet/mobile cho 3 trang chính.
- Có empty/loading/error states cho từng trang.
- Có modal tạo phiếu nháp.
- Có modal xem chi tiết phiên QC.
- Có confirm xóa nháp.
- Có trạng thái version biểu mẫu ở nơi cần thiết.
- Có trạng thái autosave hoặc ít nhất là feedback lưu nháp.
- Có cách hiển thị khấu trừ rõ ràng.
- Có cách hiển thị lý do không đạt.
- Có điều hướng rõ giữa danh sách cửa hàng, chi tiết cửa hàng và màn chấm.
- Không làm lẫn phiếu nháp với phiên QC đã chốt.


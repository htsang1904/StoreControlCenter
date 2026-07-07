# Tổng Hợp Dashboard

## 1. Mục Đích

Dashboard là màn hình tổng quan vận hành, dùng để theo dõi nhanh tình hình ticket và QC trong một khoảng thời gian.

Màn hình hiện tập trung vào các nhóm thông tin chính:

- Tổng quan số lượng ticket.
- Thời gian xử lý trung bình.
- Ticket đang xử lý và ticket sắp quá hạn.
- Tỷ lệ QC đạt.
- Top cửa hàng phát sinh nhiều ticket.
- Top cửa hàng có kết quả QC tốt.
- Danh sách ticket gần đây.

## 2. Vị Trí Chức Năng

- Frontend page: `src/pages/DashboardPage.vue`
- Frontend route: `/dashboard`
- Ticket service: `src/services/ticket_service.js`
- QC service: `src/services/qc_service.js`
- Backend API: `python-api/app/api/routers/dashboard.py`

## 3. Dữ Liệu Hiển Thị

### 3.1 KPI Chính

Dashboard đang hiển thị các chỉ số:

- `Tổng Ticket`: tổng ticket phát sinh trong kỳ.
- `TB Thời gian xử lý`: thời gian xử lý trung bình theo giờ.
- `Đang xử lý`: số ticket đang cần theo dõi.
- `Tỉ lệ QC đạt`: tỷ lệ phiên QC đạt trong kỳ.
- `Ticket sắp quá hạn`: ticket có hạn xử lý gần tới nhưng chưa hoàn tất.

### 3.2 Biểu Đồ Ticket

Biểu đồ chính thể hiện:

- Số lượng ticket theo thời gian.
- Thời gian hỗ trợ/xử lý trung bình.

Khoảng thời gian được gom nhóm tự động:

- Dưới hoặc bằng 14 ngày: theo ngày.
- Từ 15 đến 45 ngày: theo tuần.
- Trên 45 ngày: theo tháng.

### 3.3 Top Cửa Hàng Theo Ticket

Hiển thị top cửa hàng có nhiều ticket nhất trong kỳ, kèm:

- Tên/mã cửa hàng.
- Số lượng ticket.
- Thời gian xử lý trung bình.

### 3.4 Top Cửa Hàng Theo QC

Hiển thị top cửa hàng có tỷ lệ QC đạt cao, dựa trên dữ liệu QC overview.

Thông tin chính:

- Tên cửa hàng.
- Tỷ lệ đạt QC.
- Số phiên QC liên quan.

### 3.5 Ticket Gần Đây

Dashboard lấy danh sách ticket gần đây để hiển thị nhanh các ticket mới nhất, gồm:

- Mã/tên ticket.
- Cửa hàng.
- Trạng thái.
- Thời gian tạo tương đối.

## 4. Bộ Lọc Và Quyền Dữ Liệu

Dashboard sử dụng bộ lọc chính:

- Khoảng ngày từ query route.
- Bộ lọc cửa hàng từ `StoreFilterButton`.
- Danh sách cửa hàng theo user hiện tại.

Backend có xử lý giới hạn dữ liệu theo quyền:

- User role `store` chỉ thấy dữ liệu các cửa hàng được gán.
- Nếu truyền `store_ids`, backend lọc theo danh sách cửa hàng đó.

## 5. API Đang Sử Dụng

### 5.1 Ticket Dashboard Overview

Endpoint:

```http
POST /api/dashboard/overview
```

Payload chính:

```json
{
  "date_from": "YYYY-MM-DD",
  "date_to": "YYYY-MM-DD",
  "store_ids": [1, 2],
  "top_stores_limit": 5,
  "activity_limit": 8
}
```

Response chính:

- `summary`: tổng ticket, đang xử lý, đã xử lý, sắp quá hạn, thời gian xử lý trung bình.
- `status`: số lượng theo trạng thái.
- `top_stores`: top cửa hàng theo ticket.
- `activity_feed`: hoạt động gần đây.
- `chart_data`: dữ liệu biểu đồ ticket theo thời gian.

### 5.2 QC Stores Overview

Endpoint:

```http
GET /api/qc/stores/overview
```

Dùng để lấy dữ liệu tổng quan QC theo cửa hàng và tính top cửa hàng theo tỷ lệ đạt.

### 5.3 Recent Tickets

Endpoint:

```http
GET /api/tickets
```

Dùng để lấy danh sách ticket gần đây, dashboard chỉ hiển thị tối đa 6 ticket.

## 6. Trạng Thái Và Cảnh Báo Trên Dashboard

Dashboard đang chuẩn hóa trạng thái xử lý chính:

- `new`: Mới.
- `assigned` được gom về `in_progress`.
- `in_progress`: Đang xử lý.
- `resolved`: Đã xong.

Dashboard cũng hiển thị cảnh báo SLA riêng:

- `due_soon`: Sắp quá hạn, ticket chưa xong và hạn xử lý nằm trong 48 giờ tới.
- `overdue`: Đã quá hạn, ticket chưa xong và hạn xử lý đã nhỏ hơn thời điểm hiện tại.

## 7. Tình Trạng Hiện Tại

Phần Dashboard đã có đủ các thành phần chính để phục vụ báo cáo vận hành:

- Có KPI tổng quan.
- Có biểu đồ xu hướng ticket.
- Có top cửa hàng theo ticket và QC.
- Có danh sách ticket gần đây.
- Có lọc theo thời gian và cửa hàng.
- Có API backend riêng cho dashboard.

Mức độ hoàn thiện: phù hợp để đưa vào kiểm thử nội bộ/UAT sau khi dữ liệu thật và quyền user được xác nhận.

## 8. Rủi Ro / Điểm Cần Kiểm Tra Thêm

- Cần kiểm tra dữ liệu thực tế sau migration để đảm bảo KPI tính đúng.
- Cần xác nhận công thức `ticket sắp quá hạn` có đúng kỳ vọng nghiệp vụ hay không.
- Cần xác nhận ngưỡng `due_soon` 48 giờ có đúng SLA vận hành thực tế hay không.
- Cần kiểm tra quyền xem dữ liệu giữa các role, đặc biệt role `store`.
- Cần kiểm tra trường hợp không có dữ liệu để biểu đồ và KPI hiển thị thân thiện.
- Cần thống nhất port/API base URL khi chạy Docker để frontend gọi đúng backend.

## 9. Đề Xuất Tiếp Theo

- Chạy smoke test Dashboard với dữ liệu thật.
- Đối chiếu số liệu Dashboard với danh sách ticket/QC chi tiết.
- Bổ sung tiêu chí nghiệm thu cho từng KPI.
- Nếu cần báo cáo quản trị, có thể bổ sung export hoặc drill-down từ KPI sang danh sách chi tiết.

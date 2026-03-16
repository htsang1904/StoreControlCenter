# Minimal UI System

## Mục tiêu

Hệ thống này định nghĩa cách thiết kế và refactor giao diện theo hướng **tối giản, rõ ràng và tập trung vào tác vụ**.

Minimal UI **không có nghĩa là ít tính năng** và **không có nghĩa là chỉ dùng trắng đen**.  
Mục tiêu là **giảm nhiễu thị giác (visual noise) nhưng giữ nguyên toàn bộ capability của hệ thống**.

---

# Nguyên tắc cốt lõi

UI phải được thiết kế theo thứ tự ưu tiên:

content → action → hierarchy → layout → style

Không bắt đầu bằng màu sắc, card hoặc hiệu ứng.

---

# Quiet Interface

Giao diện phải giữ trạng thái trung tính và “im”.

Chỉ các yếu tố sau được phép nổi bật:

- primary action
- focus
- error
- success
- status có ý nghĩa

Các phần còn lại phải giữ tone trung tính.

---

# Chiến lược màu sắc

Minimal UI **không đồng nghĩa với grayscale**.

Màu sắc được sử dụng có chủ đích để:

- phân tách dữ liệu
- hiển thị trạng thái
- nhấn mạnh hành động quan trọng
- hỗ trợ scan nhanh

## Màu được phép dùng cho

- primary action
- trạng thái hệ thống
- KPI và data signal
- chart và data visualization
- active / focus state

## Không dùng màu cho

- icon trang trí
- badge không có ý nghĩa
- highlight ngẫu nhiên
- decoration

## Quy tắc

- nền và chrome phải trung tính
- chỉ có 1 primary accent cho action trong toàn app
- semantic color phải ổn định giữa các màn: info / success / warning / danger
- KPI và chart nên dùng palette giới hạn 3-5 tone dữ liệu, không mở rộng tùy hứng
- tránh nhiều accent cạnh tranh trong cùng viewport
- màu phải phục vụ thông tin, không phải trang trí

---

# Hierarchy

Mỗi màn hình chỉ nên có 3 cấp hierarchy:

1. primary content
2. secondary information
3. metadata

Hierarchy nên được tạo bằng:

- spacing
- typography
- alignment
- tone background

Không tạo hierarchy bằng:

- shadow mạnh
- nhiều card lồng nhau
- quá nhiều màu

---

# Layout

Ưu tiên layout đơn giản:

- list
- section
- divider
- inline action

Nếu list đủ rõ → không cần card.

Tránh:

- card trong card
- panel trong panel
- container lồng nhiều lớp

Content phải dẫn dắt layout.

---

# Component Rules

## Page Shell
- nền trung tính
- border nhẹ
- spacing nhất quán

## Card
- border nhẹ
- hover background subtle
- shadow rất nhẹ hoặc không dùng

Card chỉ dùng khi cần tách nhóm nội dung.

## KPI
- có thể dùng màu nhẹ để phân tách dữ liệu
- tránh mọi KPI đều nổi bật ngang nhau

### KPI Anatomy

- cấu trúc ưu tiên: `label → value → optional meta`
- `meta` là tùy chọn, chỉ dùng khi giúp scan nhanh hơn
- `meta` nên là nhãn ngắn hoặc con số ngắn, không viết thành câu hoàn chỉnh
- icon là optional; nếu có thì chỉ đóng vai trò signal
- nền KPI ưu tiên trung tính; màu nên tập trung ở icon, data signal hoặc chart
- không dùng dấu chấm trang trí, line trang trí, badge/pill không cần thiết trong KPI
- không để mọi KPI cùng một mức nhấn; luôn có KPI chính và KPI phụ

## Button

Primary  
- accent color  
- chỉ nên có 1 primary action trong 1 khu vực  

Secondary  
- border hoặc background trung tính  

Ghost  
- không border  
- hover nhẹ  

## Input

- chiều cao nhất quán
- focus ring đồng nhất
- filter nâng cao đưa vào panel hoặc popover

## Toolbar / Filter

- toolbar phải phục vụ scan và thao tác nhanh, không biến thành một hàng control dày đặc
- tối đa 1 primary action lộ rõ trong một khu vực
- search là control ưu tiên cao nhất nếu màn hình có nhu cầu tìm kiếm thường xuyên
- filter cơ bản có thể hiển thị trực tiếp; filter nâng cao đưa vào panel, popover hoặc dropdown
- nếu có hơn 3 secondary actions, cần gom lại vào menu
- thứ tự ưu tiên mặc định: title/context → search → filter → primary action → secondary action

## Table / List / Card Decision

- dùng `table` khi người dùng cần so sánh dữ liệu theo cột
- dùng `list` khi người dùng cần scan nhanh theo item
- dùng `card` khi cần tách nhóm nội dung hoặc thể hiện một block độc lập
- nếu `list` đã đủ rõ thì không card hóa thêm
- không bọc table trong nhiều lớp card/panel nếu section đã đủ tách biệt
- mobile/tablet ưu tiên list/card nếu table làm giảm khả năng scan

## Dashboard / Data Screen

- dashboard phải trả lời nhanh 3 câu hỏi:
  1. điều gì đang quan trọng nhất
  2. chỗ nào cần hành động
  3. xu hướng hoặc nhóm dữ liệu nào cần xem tiếp
- KPI chỉ nên là entry point, không phải nơi kể chuyện dài
- chart/progress phải giúp nhìn ra chênh lệch hoặc xu hướng, không chỉ để trang trí
- insight box chỉ giữ lại khi nó dẫn tới một hành động hoặc kết luận hữu ích
- tránh nhồi nhiều panel đồng mức khiến màn hình không có trọng tâm

---

# Typography & Spacing

Spacing scale:

4  
8  
12  
16  
24  
32  

Typography:

- heading ngắn và rõ
- body text dễ đọc
- metadata giữ vai trò phụ

Tránh uppercase quá nhiều trong dashboard.

## Copywriting Rules

- heading nên ngắn, trực tiếp, ưu tiên 3-6 từ
- KPI label phải là nhãn rõ nghĩa, không viết như tiêu đề báo cáo dài
- KPI meta tối đa khoảng 2-4 từ hoặc 1 cụm số liệu ngắn
- status label nên là 1-2 từ nếu có thể
- helper text chỉ xuất hiện khi thật sự giảm ambiguity
- tránh copy mang tính thuyết minh, marketing hoặc lặp lại thông tin đã thấy ở value

### Ví dụ

Tốt:

- `Hoàn tất 84%`
- `Toàn kỳ 126`
- `Sát SLA`
- `Cần ưu tiên`

Không tốt:

- `Tỷ lệ cửa hàng đã hoàn tất QC: 84%`
- `Đây là số lượng ticket đang nằm trong khoảng thời gian hiện tại`
- `Hệ thống hiện đang ghi nhận trạng thái xử lý tích cực`

---

# Interaction States

Các state bắt buộc:

- hover
- active
- focus
- disabled
- error
- success

Quy tắc:

Hover → thay đổi nhẹ background hoặc border  
Active → phản hồi nhanh và subtle  
Focus → focus ring thống nhất

---

# Motion

Animation chỉ dùng khi:

- state change
- navigation feedback
- confirmation feedback

Không dùng cho:

- decoration
- bounce
- parallax
- scale lớn

Timing khuyến nghị:

120–180ms  
ease-out

---

# Element Reduction Rule

Trước khi thêm hoặc giữ một UI element, cần hỏi:

1. Element này có cung cấp thông tin mới không?
2. Element này có giúp người dùng hiểu nhanh hơn không?
3. Element này có mở ra hành động cần thiết không?

Nếu không → loại bỏ.

Nếu loại bỏ làm feature khó tìm → di chuyển element sang menu hoặc panel.

---

# Anti Patterns

Tránh:

- nhiều accent color trong cùng màn
- spam badge / tag
- icon màu trang trí
- card lồng nhiều lớp
- shadow mạnh để tạo hierarchy
- UI chỉ toàn grayscale làm dữ liệu khó scan
- ẩn feature quá sâu
- biến KPI thành block vừa dài vừa nhiều chi tiết thừa
- dùng text phụ dài để giải thích thứ đã hiển thị bằng số
- tô màu toàn bộ card chỉ để tạo cảm giác "designed"
- để toolbar có quá nhiều nút ngang hàng khiến primary action bị chìm

---

# UI Refactor Workflow (cho agent)

Khi refactor UI, thực hiện theo thứ tự:

1. Identify features và giữ toàn bộ capability
2. Xác định primary user intent của màn hình
3. Audit toàn bộ UI elements
4. Loại bỏ element dư thừa
5. Simplify layout (ưu tiên list / section)
6. Group secondary actions vào menu
7. Rebuild hierarchy bằng spacing và typography
8. Áp dụng color discipline
9. Kiểm tra discoverability của actions

---

# Success Criteria

Sau khi refactor UI phải đạt:

- ít UI element hơn
- hierarchy rõ ràng
- layout đơn giản hơn
- màu sắc có chủ đích
- toàn bộ feature vẫn truy cập được

Minimal UI thành công khi giao diện:

- dễ scan
- ít nhiễu
- rõ hành động cần làm
- không làm mất capability của hệ thống

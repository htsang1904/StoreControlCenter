# Plan: Quản Lý Bộ Phận Và Quyền

## 1. Mục Tiêu

Triển khai 2 nhóm tính năng admin còn thiếu:

1. Quản lý bộ phận/phòng ban.
2. Quản lý quyền truy cập theo role, có khả năng mở rộng về sau.

Yêu cầu chính là mở rộng trên kiến trúc hiện tại, không phá flow đăng nhập SSO, ticket, QC và quản lý user đang có.

## 2. Hiện Trạng Liên Quan

### Backend

- Model `Department` đã có trong `python-api/app/models/org.py`.
- Model `User` đã có `role`, `department_id`, quan hệ `department`, `stores` trong `python-api/app/models/user.py`.
- API department hiện tại mới có list/read active tại `python-api/app/api/routers/departments.py`.
- Admin user hiện đã dùng department khi update/list user tại `python-api/app/api/routers/admin_users.py`.
- Ticket policy hiện hard-code role tại `python-api/app/services/ticket_policy.py`.

### Frontend

- Admin user page đã có chọn/filter department qua `src/pages/AdminUsersPage.vue` và `src/services/admin_service.js`.
- Sidebar/router hiện chủ yếu dùng `role` để ẩn/hiện admin menu.
- Chưa có page quản lý department riêng.
- Chưa có permission matrix hoặc permission-based route guard.

## 3. Nguyên Tắc Triển Khai

- Giữ role cũ: `admin`, `store`, `handler`, `qc` để tương thích.
- Không thay đổi rule nghiệp vụ ticket hiện có nếu chưa có yêu cầu riêng.
- Thêm permission layer theo hướng additive: role vẫn tồn tại, permission dùng để mở rộng admin/control.
- Ưu tiên soft-delete/toggle `is_active` cho department thay vì xoá cứng.
- Backend luôn enforce quyền; frontend chỉ ẩn/hiện UI, không thay thế bảo mật.

## 4. Phase 1: Quản Lý Bộ Phận Backend

### 4.1 API đề xuất

Tạo router admin riêng, ví dụ `python-api/app/api/routers/admin_departments.py`:

- `GET /admin/departments`
  - Query: `q`, `is_active`, `page`, `pageSize`.
  - Trả danh sách department có phân trang.
- `POST /admin/departments`
  - Body: `name`, `code`, `is_active`.
  - Validate `name`, `code` bắt buộc; `code` unique.
- `PUT /admin/departments/{id}`
  - Cho sửa `name`, `code`, `is_active`.
  - Validate không trùng code.
- `DELETE /admin/departments/{id}` hoặc `PATCH /admin/departments/{id}/deactivate`
  - Khuyến nghị soft-delete: set `is_active=false`.
  - Nếu delete cứng, phải chặn khi department đang có user/ticket.

### 4.2 Schema

Thêm hoặc mở rộng schema trong `python-api/app/schemas/org.py`:

- `DepartmentCreateRequest`
- `DepartmentUpdateRequest`
- `DepartmentListResponse`
- `DepartmentSingleResponse`

### 4.3 Quyền backend

Ban đầu dùng `admin` role guard để giảm scope:

- Chỉ admin được create/update/deactivate department.
- Sau khi permission framework có, đổi sang `departments.manage`.

## 5. Phase 2: Quản Lý Bộ Phận Frontend

### 5.1 Service

Mở rộng `src/services/admin_service.js`:

- `listAdminDepartments(params)`
- `createAdminDepartment(payload)`
- `updateAdminDepartment(id, payload)`
- `deleteAdminDepartment(id)` hoặc `deactivateAdminDepartment(id)`

### 5.2 Page

Tạo `src/pages/AdminDepartmentsPage.vue`:

- Table danh sách bộ phận.
- Search theo tên/code.
- Filter trạng thái active/inactive.
- Modal create/edit.
- Action bật/tắt trạng thái.
- Toast báo thành công/lỗi; không render lỗi thô lên UI.

### 5.3 Router và Sidebar

- Thêm route admin department trong `src/router/index.js`.
- Thêm menu trong `src/layout/Sidebar.vue`.
- Giai đoạn đầu dùng `meta.roles: ['admin']`.
- Sau Phase permission chuyển sang `meta.permissions: ['departments.manage']`.

## 6. Phase 3: Permission Framework Backend

### 6.1 Model đề xuất

Thêm models mới, ví dụ `python-api/app/models/permission.py`:

- `Permission`
  - `id`
  - `code` unique, ví dụ `users.read`, `departments.manage`
  - `name`
  - `group`
  - `description`
  - `is_active`
- `RolePermission`
  - `role`
  - `permission_code` hoặc `permission_id`

Tuỳ chọn cho giai đoạn sau:

- `UserPermissionOverride`
  - Cho phép cấp/chặn riêng từng user.
  - Không làm ở MVP nếu chưa cần.

### 6.2 Permission mặc định

Seed permission theo role:

- `admin`
  - `users.read`
  - `users.update`
  - `users.delete`
  - `departments.read`
  - `departments.manage`
  - `permissions.read`
  - `permissions.manage`
  - `stores.manage`
  - `qc.manage`
  - `tickets.manage`
- `handler`
  - `tickets.read`
  - `tickets.claim`
  - `tickets.reply`
  - `tickets.resolve`
- `store`
  - `tickets.create`
  - `tickets.read_own_store`
  - `tickets.reply`
  - `tickets.reopen`
- `qc`
  - `qc.read`
  - `qc.manage`
  - `tickets.read`

Danh sách này cần review trước khi implement chính thức.

### 6.3 Helper backend

Thêm helper trong `python-api/app/api/deps.py` hoặc service riêng:

- `get_current_user_permissions(user)`
- `has_permission(user, code)`
- `require_permission(code)`

Rule compatibility:

- `admin` luôn có toàn quyền nếu chưa seed permission đầy đủ.
- Nếu role chưa có permission record, fallback theo role cũ để tránh breaking production.

### 6.4 API quản lý quyền

Tạo router `python-api/app/api/routers/admin_permissions.py`:

- `GET /admin/permissions`
  - List toàn bộ permission theo group.
- `GET /admin/roles/permissions`
  - Trả matrix role -> permissions.
- `PUT /admin/roles/{role}/permissions`
  - Body: `permissions: string[]`.
  - Chặn xoá quyền critical khỏi admin, ví dụ `permissions.manage`.

## 7. Phase 4: Permission Frontend

### 7.1 Service

Mở rộng `src/services/admin_service.js`:

- `listAdminPermissions()`
- `listRolePermissions()`
- `updateRolePermissions(role, permissions)`

### 7.2 Page

Tạo `src/pages/AdminPermissionsPage.vue`:

- Tabs hoặc cột theo role.
- Group permission theo module: User, Department, Store, Ticket, QC, Permission.
- Checkbox bật/tắt permission.
- Confirm trước khi lưu thay đổi.
- Disable các permission critical của admin.

### 7.3 Auth state

Cập nhật backend `serialize_user()` để trả:

```json
{
  "role": "admin",
  "permissions": ["departments.manage", "permissions.manage"]
}
```

Frontend lưu vào `state.userInfo.permissions`.

### 7.4 Router guard

Cập nhật guard trong `src/main.js` hoặc router logic hiện có:

- Vẫn hỗ trợ `meta.roles`.
- Thêm `meta.permissions`.
- Nếu route có `meta.permissions`, user phải có ít nhất/mọi permission theo rule được chốt.

Đề xuất rule MVP:

- `meta.permissions` là danh sách OR: có một trong các quyền là được.
- Nếu cần AND sau này, thêm `meta.requireAllPermissions=true`.

## 8. Phase 5: Áp Dụng Permission Dần Dần

### MVP áp dụng ngay

- Department admin APIs: `departments.manage`.
- Permission admin APIs: `permissions.manage`.
- Admin user APIs: `users.read`, `users.update`, `users.delete`.
- Sidebar admin menu: check permission tương ứng.

### Chưa nên đổi ngay nếu không cần

- Ticket create flow.
- Store restrictions của role `store`.
- Ticket assign/claim/resolve/reopen policy.

Các rule ticket hiện tại đang là invariant nghiệp vụ, cần thay đổi thận trọng.

## 9. Phase 6: Migration/Seed

Nếu project chưa có migration framework rõ ràng:

- Tạo startup seed idempotent cho permissions mặc định.
- Hoặc tạo script riêng trong `python-api/scripts/seed_permissions.py`.

Yêu cầu seed idempotent:

- Chạy nhiều lần không duplicate permission.
- Không xoá permission custom.
- Không tự ý thay đổi role permission nếu production đã chỉnh, trừ khi có flag reset.

## 10. Validation Plan

### Backend

- Syntax:

```bash
python3 -m py_compile python-api/app/api/routers/*.py
```

- API smoke:

```bash
curl -i GET /api/admin/departments
curl -i POST /api/admin/departments
curl -i PUT /api/admin/departments/{id}
curl -i GET /api/admin/permissions
curl -i PUT /api/admin/roles/admin/permissions
```

- Permission smoke:

- Admin gọi được department APIs.
- Non-admin không có permission bị 403.
- User có permission tương ứng gọi được.

### Frontend

```bash
node -v
npm -v
npm run build
```

Smoke UI:

- Admin thấy menu Bộ phận và Quyền.
- User không có quyền không thấy menu.
- Tạo/sửa/tắt bộ phận thành công.
- Assign department mới cho user trong Admin Users.
- Chỉnh role permission và login lại hoặc refresh profile thấy quyền mới.

## 11. Rủi Ro Và Cách Giảm Thiểu

- Rủi ro lock admin khỏi trang quyền:
  - Luôn bảo vệ `admin` không mất `permissions.manage`.
- Rủi ro phá ticket flow:
  - Không đổi ticket policy trong MVP.
- Rủi ro route frontend chỉ ẩn UI nhưng API vẫn hở:
  - Backend phải enforce permission.
- Rủi ro permission chưa seed ở production:
  - Fallback admin full access; seed idempotent.
- Rủi ro xoá department gây mất liên kết user/ticket:
  - Dùng `is_active=false` thay vì delete cứng.

## 12. Thứ Tự Implement Khuyến Nghị

1. Backend admin departments.
2. Frontend admin departments.
3. Permission models + seed.
4. Backend admin permissions APIs.
5. Return permissions trong `/auth/me` và login response.
6. Frontend permission page.
7. Router/sidebar permission guard.
8. Apply permission checks vào admin user/store/department APIs.
9. Full validation và smoke test.

## 13. Open Questions

1. Permission quản lý theo role là đủ chưa, hay cần override riêng từng user?
2. Department có được xoá cứng không, hay chỉ active/inactive?
3. Role `qc` nên có quyền quản lý toàn bộ QC hay chỉ xem/thao tác phiên QC?
4. Khi đổi permission, có cần realtime refresh quyền cho user đang online không, hay yêu cầu login lại?

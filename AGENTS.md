# AI Agent Workflow For StoreControlCenter

File này là workflow chuẩn để AI agent làm việc nhất quán trong repo.

## 1) Hiểu task trước khi sửa

1. Đọc yêu cầu và chốt rõ `scope` (frontend, backend, hoặc full flow).
2. Kiểm tra ảnh hưởng theo module bằng `rg` trước khi sửa.
3. Không đổi kiến trúc hoặc dependency nếu user chưa yêu cầu.

## 2) Thu thập context tối thiểu

1. Frontend:
- `src/pages/*`, `src/components/*`, `src/services/*`, `src/router/index.js`.
2. Backend:
- `api/src/api/**/{controllers,routes,services}`, `api/config/*`.
3. Cấu hình:
- `package.json`, `api/package.json`, `.env`, `api/.env.example`, `vite.config.js`.

## 3) Quy tắc implement

1. Sửa ít nhất có thể để đạt yêu cầu.
2. Giữ naming và style hiện có của file.
3. Không revert các thay đổi user đang làm dở.
4. Nếu có rủi ro breaking behavior, ghi rõ trong báo cáo cuối.

## 4) Validate bắt buộc trước khi trả kết quả

Chạy kiểm tra theo phạm vi thay đổi:

- Frontend: `npm run build`
- Backend: `npm --prefix api run build`
- Tự chọn scope: `./scripts/agent-check.sh [auto|frontend|backend|all]`

Nếu môi trường local không đáp ứng (vd Node version), phải báo rõ lý do + lệnh khắc phục.

## 5) Format báo cáo cuối cho user

1. Kết quả chính (đã làm gì).
2. Danh sách file đã sửa.
3. Kết quả validate (pass/fail + lỗi chính).
4. Việc còn lại user cần chạy (nếu có).

## 6) Project map nhanh

- Frontend app: root (`src/`, Vite).
- Backend API: `api/` (Strapi 4).
- API client frontend: `src/services/http.js`.
- Route frontend: `src/router/index.js`.
- Biến môi trường frontend đang dùng:
  - `VITE_API_BASE_URL`
  - `VITE_AUTH_URL`

## 7) Cơ chế recap project theo lần lưu (on-save)

Script recap:

- Tạo/ghi đè file recap: `npm run recap`
- In recap ra terminal: `npm run recap:print`
- File recap: `.agent/PROJECT_RECAP.md` (đã ignore git)

Nếu muốn tự động recap mỗi lần Save trong VS Code, dùng extension `emeraldwalk.runonsave`
và thêm vào User/Workspace Settings:

```json
"emeraldwalk.runonsave": {
  "commands": [
    {
      "match": ".*",
      "cmd": "bash ${workspaceFolder}/scripts/project-recap.sh"
    }
  ]
}
```

## 8) Prerequisites môi trường (bắt buộc)

- Frontend build yêu cầu Node `20.19+` (hoặc `22.12+`).
- Backend Strapi đang chạy ổn với Node `<=20`.
- Trước khi validate, chạy:
  - `node -v`
  - `npm -v`
- Nếu sai version, ưu tiên: `nvm use 20`.

## 9) Invariant bảo mật

- Chỉ dùng header: `Authorization: Bearer <token>`.
- Không dùng `X-Authorization`.
- CORS không thay thế cho auth/permission. Không dùng CORS như cơ chế bảo mật chính.

## 10) Invariant nghiệp vụ ticket

- Giữ nguyên rule tạo phiếu: `POST /tickets/create` cho tất cả role đã đăng nhập (không role-guard).
- Với role `store`, chỉ được tạo/sửa ticket trong danh sách `store_ids` đã gán.
- Nếu ticket có `initialHandler` thì trạng thái phải là `in_progress`.
- Trả lời ticket chỉ khi trạng thái mở: `new | assigned | in_progress`.
- Upload ảnh: tối đa `5` ảnh/lần, mỗi ảnh tối đa `5MB`.

## 11) Smoke test tối thiểu sau khi sửa ticket flow

- Tạo ticket (store hợp lệ / store không hợp lệ).
- Chỉnh sửa ticket (đặc biệt `store_id`).
- Nhận xử lý / rời xử lý / đánh dấu đã xử lý / mở lại.
- Gửi phản hồi theo từng role (`store`, `handler`, `admin`).
- Upload ảnh với case vượt số lượng và vượt dung lượng.

## 12) Repo hygiene

- Không commit `dist/` hoặc file generated ngoài scope task.
- Không tự ý đổi giá trị môi trường production.

## 13) Ưu tiên Antigravity Kit trong `.agent`

Trước khi bắt đầu mỗi task, AI agent phải kiểm tra bộ kit trong `.agent` và ưu tiên dùng nó như workflow mặc định của repo.

Quy ước áp dụng:

1. Đọc `.agent/ARCHITECTURE.md` để xác định cấu trúc kit hiện có.
2. Nếu task khớp rõ với một workflow trong `.agent/workflows/*` hoặc một skill trong `.agent/skills/*`, ưu tiên dùng workflow/skill đó trước cách làm generic.
3. Khi đã chọn workflow/skill trong `.agent`, phải thông báo ngắn cho user biết đang dùng file nào của kit.
4. Chỉ đọc thêm đúng các file cần thiết trong `.agent`; không bulk-load toàn bộ kit nếu task không cần.
5. Nếu `.agent` không có workflow/skill phù hợp, fallback về workflow chuẩn trong file `AGENTS.md` này.
6. Nếu có xung đột giữa `.agent` và các invariant nghiệp vụ/bảo mật trong repo, ưu tiên invariant trong `AGENTS.md`.

Ví dụ mapping ưu tiên:

- Task debug/fix bug: ưu tiên `.agent/workflows/debug.md` hoặc `.agent/skills/systematic-debugging/SKILL.md`
- Task plan/recap/khảo sát: ưu tiên `.agent/workflows/plan.md`, `.agent/workflows/status.md`, `.agent/skills/architecture/SKILL.md`
- Task frontend/UI: ưu tiên `.agent/workflows/ui-ux-pro-max.md`, `.agent/skills/frontend-design/SKILL.md`, `.agent/skills/tailwind-patterns/SKILL.md`
- Task backend/API: ưu tiên `.agent/skills/api-patterns/SKILL.md`, `.agent/skills/nodejs-best-practices/SKILL.md`
- Task test/validate: ưu tiên `.agent/workflows/test.md`, `.agent/skills/testing-patterns/SKILL.md`, `.agent/skills/lint-and-validate/SKILL.md`

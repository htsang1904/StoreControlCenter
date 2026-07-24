# PLAN: Project Audit

## Muc tieu

Lap ke hoach ra soat toan bo StoreControlCenter de tim cac diem code lon xon, code du, behavior sai, permission/auth gap, UI/layout bat thuong, va cac file generated/ngoai scope dang nam trong worktree. Ke hoach nay chi de audit va bao cao, chua sua code.

## Pham vi

- Frontend: `src/pages`, `src/components`, `src/services`, `src/composables`, `src/plugins`, `src/layout`, `src/router`.
- Backend: `python-api/app/api/routers`, `python-api/app/services`, `python-api/app/models`, `python-api/app/schemas`, `python-api/app/core`.
- Config/build: `package.json`, `vite.config.js`, `python-api/requirements.txt`, env sample neu co, docker compose neu co.
- Repo hygiene: generated files, uploads, dist, cache, dirty files ngoai scope.
- Khong audit sau vao external Suite API neu khong co contract/documentation trong repo.

## Nguyen tac audit

- Khong sua code trong qua trinh audit tru khi co yeu cau rieng.
- Khong revert thay doi dang co trong worktree.
- Moi finding phai co file/line hoac command/pattern ro rang.
- Uu tien bug va regression thuc te hon style preference.
- Phan loai severity: `Critical`, `High`, `Medium`, `Low`.
- Doi voi nghi ngo khong du bang chung, ghi vao `Open questions` thay vi ket luan.

## Phase 0: Snapshot & Baseline

1. Chay `git status --short` de ghi nhan dirty files hien tai.
2. Chay `rg --files` de nam structure va generated/untracked candidates.
3. Doc `.agent/PROJECT_RECAP.md` neu can context nhanh.
4. Ghi lai Node/Python version:
   - `node -v`
   - `npm -v`
   - `python3 --version`

Deliverable: baseline worktree + moi truong validate.

## Phase 1: Auth & Session Audit

Tap trung cac bug dang anh huong thao tac API khi token het han.

Files chinh:
- `src/services/http.js`
- `src/plugins/app.js`
- `src/main.js`
- `src/router/index.js`
- `src/services/auth_service.js`
- `python-api/app/api/routers/auth.py`
- auth/security dependency trong `python-api/app/core` neu co

Checklist:
- Header chi dung `Authorization: Bearer <token>`.
- 401 tu API app clear frontend state, localStorage, realtime/push user, redirect login mot lan.
- Router guard chan token het han truoc khi vao protected route.
- Login/SSO/me/logout payload contract thong nhat.
- Khong de infinite redirect hoac duplicate toast.
- Khong logout khi goi API external suite login fail theo cach lam mat local app state sai thoi diem.

## Phase 2: Permission & Store Scope Audit

Tap trung invariant admin xem full store, store role chi xem store duoc gan.

Files chinh:
- `src/pages/QCManagementPage.vue`
- `src/pages/QCStoreDetailPage.vue`
- `src/pages/QCCreateSessionPage.vue`
- `src/pages/TicketManagementPage.vue`
- `src/pages/TicketDetailPage.vue`
- `src/services/qc_service.js`
- `src/services/ticket_service.js`
- `python-api/app/api/routers/qc.py`
- `python-api/app/api/routers/qc_findings.py`
- `python-api/app/api/routers/tickets.py`
- `python-api/app/services/ticket_policy.py`
- `python-api/app/services/qc_service.py`

Checklist:
- Admin khong bi filter bang `current_user.stores` ngoai tru khi query filter cu the.
- Store role bi gioi han dung store assigned khi create/edit/view QC/ticket.
- Handler/admin permission consistent giua frontend va backend.
- `POST /tickets/create` giu invariant khong role-guard cho user da login.
- Khong dua CORS vao auth/security decision.

## Phase 3: QC Flow Audit

Tap trung QC form/version, session, finding/remediation.

Files chinh:
- `src/pages/QCManagementPage.vue`
- `src/pages/QCStoreDetailPage.vue`
- `src/pages/QCCreateSessionPage.vue`
- `src/components/QCSessionRemediationPanel.vue`
- `src/services/qc_service.js`
- `python-api/app/api/routers/qc.py`
- `python-api/app/api/routers/qc_findings.py`
- `python-api/app/schemas/qc.py`
- `python-api/app/schemas/qc_finding.py`
- `python-api/app/models/qc_form.py`
- `python-api/app/models/qc_session.py`

Checklist:
- List overview tra dung `form_version.form.name/version_no`.
- Draft/session normalize khong fallback sai thanh `QC Form 1.0` khi co data that.
- Submitted/completed duration tinh dung tu audited/created den submitted.
- Finding count/remediation label dung nghia user-facing.
- Upload evidence gioi han size/count theo invariant neu flow ticket/QC dung chung.
- Delete session/draft action co permission va confirm hop ly.

## Phase 4: Ticket Flow Audit

Tap trung invariant nghiep vu ticket trong `AGENTS.md`.

Files chinh:
- `src/pages/TicketManagementPage.vue`
- `src/pages/TicketDetailPage.vue`
- `src/pages/AddTicketPage.vue`
- `src/composables/useTicketList.js`
- `src/composables/useTicketPresentation.js`
- `src/services/ticket_service.js`
- `python-api/app/api/routers/tickets.py`
- `python-api/app/api/routers/ticket_logs.py`
- `python-api/app/services/ticket_policy.py`

Checklist:
- Role `store` chi create/edit ticket trong assigned `store_ids`.
- Ticket co `initialHandler` thi status phai `in_progress`.
- Reply chi khi status mo: `new | assigned | in_progress`.
- Upload anh toi da 5 anh/lần, moi anh toi da 5MB.
- Claim/leave/resolve/reopen behavior khong bi regression.

## Phase 5: Frontend Layout & UX Integrity Audit

Tap trung cac loi scroll/layout, overlapping, text overflow.

Files chinh:
- `src/layout/default.vue`
- `src/layout/Header.vue`
- `src/layout/Sidebar.vue`
- `src/assets/main.css`
- cac page co table/list lon: QC, Ticket, Admin Users/Stores/Permissions, Dashboard

Checklist:
- Scroll container dung cap: page/content/list, khong keo mat header layout ngoai y muon.
- Table header sticky neu list co scroll noi bo.
- Khong co nested card/card hoac overflow tao scrollbars vo ly.
- Mobile card khong bi text/button overlap.
- Custom dropdown/menu khong bi cat boi overflow parent.
- `app-table-scroll` dung cho horizontal scroll dung noi, khong tao bug scroll noi bo sai.

## Phase 6: Service/API Contract Audit

Files chinh:
- `src/services/*.js`
- response schema trong `python-api/app/schemas/*`
- routers tuong ung

Checklist:
- Axios interceptor unwrap response thong nhat, service khong double-read sai `response.data.data`.
- Naming snake_case/camelCase normalize co fallback hop ly.
- Error message path thong nhat: `detail`, `message`, `error`.
- Pagination contract page/pageSize/total/pageCount consistent.
- Khong hardcode fallback gay sai du lieu thuc.

## Phase 7: Backend Quality & Data Integrity Audit

Files chinh:
- routers/services/models/schemas under `python-api/app`
- Alembic neu co migration lien quan

Checklist:
- Query filter admin/store/handler dung role.
- SQLAlchemy relationship load can thiet de schema khong mat data.
- No N+1 ro rang trong endpoint list lon.
- Delete cascade co chu y attachment/finding/session.
- Pydantic schema include fields can thiet cho frontend, khong expose secret.

## Phase 8: Repo Hygiene & Dead Code Audit

Commands/patterns:
- `git status --short`
- `rg -n "TODO|FIXME|console\.log|debugger|<<<<<<<|>>>>>>>" src python-api/app`
- `rg -n "X-Authorization|localStorage\.setItem\('token'|Authorization" src python-api/app`
- `rg --files | rg "(^dist/|__pycache__|\.pyc$|uploads|\.DS_Store)"`

Checklist:
- Generated files khong nen commit: `dist/`, cache, upload static ngoai scope.
- Console/debugger khong con trong production path tru khi co ly do.
- Dead helper/function imports ro rang.
- File da bi duplicate responsibility qua nhieu noi.

## Phase 9: Validation Plan

Chay theo scope phat hien:

- Frontend build: `source ~/.nvm/nvm.sh && nvm use 20 && npm run build`
- Backend compile: `PYTHONPYCACHEPREFIX="${TMPDIR:-/tmp}/agent-pycache" python3 -m compileall -q python-api/app`
- Repo script neu can: `./scripts/agent-check.sh auto`

Neu environment sai version:
- Node can `20.19+` hoac `22.12+`.
- Python can `3.12+`.
- Bao ro command khac phuc, uu tien `nvm use 20`.

## Report Format Sau Audit

Bao cao audit nen co format:

1. Findings theo severity, moi item gom:
   - Severity
   - File/line
   - Mo ta bug/risk
   - Ly do/co che loi
   - De xuat sua
2. Open questions/assumptions.
3. Validation da chay va ket qua.
4. Dirty/generated files can user quyet dinh.
5. Danh sach quick wins vs changes can can than.

## Suggested Execution Order

1. Phase 0 baseline.
2. Phase 1 auth/session.
3. Phase 2 permission/store scope.
4. Phase 3 QC flow.
5. Phase 4 ticket flow.
6. Phase 5 layout/UI.
7. Phase 6 service/API contract.
8. Phase 7 backend/data integrity.
9. Phase 8 repo hygiene.
10. Phase 9 validation and final report.

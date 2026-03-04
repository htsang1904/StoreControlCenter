# QC Refactor Plan (Ticket-Safe)

## Goal
Tách QC thành domain độc lập để scale và maintain, không thay đổi hành vi domain Ticket đang ổn định.

## Current State
- Ticket QC hiện tại bám vào `ticket_qc_reviews`.
- Frontend QC đang chạy mock service (`src/services/qc_service.js`).

## New QC Domain (added)
- `qc-form`
- `qc-form-version`
- `qc-criterion`
- `qc-form-criterion`
- `qc-store-criterion-rule`
- `qc-session`
- `qc-session-item`
- `qc-finding`

## New APIs (independent from Ticket)
- `GET /qc/sessions/overview`
- `POST /qc/sessions/:id/submit`

## Safety Rules
- Không sửa schema `ticket`.
- Không đổi endpoint Ticket hiện tại.
- Không đổi flow Ticket trên frontend.

## Migration Phases
1. Deploy schema QC mới (không cắt cũ).
2. Seed dữ liệu form/version/criterion cho QC.
3. Chuyển FE QC qua endpoint mới theo từng màn.
4. Ngưng dần `ticket_qc_reviews` khi không còn phụ thuộc.

## Notes
- Rule weekly-once và applicability theo store đã có cột schema, cần enforce thêm ở service khi tạo item/session.
- Nên thêm index DB cho:
  - `qc_sessions(store_id, audited_at)`
  - `qc_session_items(session_id, criterion_id)`
  - `qc_store_criterion_rules(store_id, criterion_id, effective_from, effective_to)`

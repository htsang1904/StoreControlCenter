# Business Flows & Invariants

> **Target Audience:** Future AI Agents and Human Developers
> **Purpose:** Document the necessary business logic invariants (Ticket rules, QC workflows) transplanted from the original System design (`AGENTS.md`) into the Python database.

## 1. Ticketing System Invariants

When working inside `app/api/routers/tickets.py` or building ticket logic in `app/services/`:

* **Ticket Creation Access**: The `POST /tickets/create` route MUST be accessible to all logged-in roles (Store, Handler, Admin, QC). No role-guard prevents ticket creation.
* **Store Role Scoping**: If the logged-in user has the `store` role, they MUST ONLY be able to view, edit, or create tickets mapped to the `store_id` existing in their assigned profile (`UserInfo.stores`).
* **Initial Status Rule**: If a ticket is created and explicitly passed an `initialHandler` (handler_id), the default ticket status must immediately become `in_progress` rather than `new`.
* **Reply Constraints**: A user (of any role) can only reply to a ticket (add a `TicketLog`) if the ticket's status is open: `new`, `assigned`, or `in_progress`.
* **File Upload Limits**: Ticket attachments are limited to at most **5 images per upload**, and each image must not exceed **5MB**.

## 2. QC (Quality Control) Workflow

When modifying QC Modules (`QCSession`, `QCForm`, `QCFinding`):

* **Immutable Form Versions**: A `QCForm` is a template. Whenever a form's schema or criteria change, a new `QCFormVersion` must be created. Existing `QCSession` records MUST remain linked to the older version to preserve historical integrity.
* **Scoring Calculation**:
  * Supported criterion modes are `point`, `pass_fail`, and `deduction`.
  * `point` contributes the entered score from `0` to `max_score`.
  * `pass_fail` uses `max_score` as weight: pass receives the full weight, fail receives `0`.
  * `deduction` does not add to `total_score` or `max_score`; when failed, it subtracts its configured percentage from the final score rate.
  * `na` and `skipped_weekly` items are excluded from the scoring denominator for compatibility with historical/runtime data.
  * Final pass/fail is based on `finalScoreRate >= passThreshold` from the form version `pass_rule`.
* **Finding Generation**: If a `QCSessionItem` is marked as `fail` and flags `requires_fix = True`, the system should automatically initialize a corrective `QCFinding`.
* **Finding Resolution Flow**:
  1. Finding is `open`.
  2. Store assignee adds `corrective_action` and evidence -> status moves to `in_progress` or `resolved`.
  3. QA/QC Auditor verifies the fix -> status moves to `verified` and `verified_at` timestamp is stamped.

## 3. Role Based Access (RBAC) Defaults
* `store`: Can only see data linked to their `store_id`.
* `handler`: Can view tickets assigned to their `department_id`.
* `qc`: Can view, draft, and submit QC forms across regional assigned stores.
* `admin`: Has global access. Can create Masters (Departments, Stores, Standard criteria).

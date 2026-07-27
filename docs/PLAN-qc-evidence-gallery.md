# PLAN: QC Evidence Gallery & Viewer

## 1. Objective

Triển khai hệ thống xem ảnh minh chứng QC theo đúng brief `docs/QC_EVIDENCE_GALLERY_IMPLEMENTATION_BRIEF.md`.

Gallery phải phục vụ 2 nhóm ảnh độc lập:

- `QC ghi nhận`: ảnh trước khắc phục.
- `Cửa hàng khắc phục`: ảnh sau khắc phục.

Không trộn 2 nhóm thành một gallery duy nhất. Người dùng phải luôn biết ảnh thuộc giai đoạn nào, ảnh thứ mấy, và nếu có dữ liệu thì biết thời điểm/người tạo/ghi chú.

## 2. Current State

Hiện tại đã có bước nền tảng:

- `src/components/ImagePreviewModal.vue`: modal preview ảnh dạng gallery cơ bản.
- `src/components/QCSessionRemediationPanel.vue`: đã mở ảnh QC và ảnh khắc phục bằng modal preview.

Nhưng implementation hiện tại chưa đạt đầy đủ brief:

- Chưa có component `EvidenceGallery` riêng cho thumbnail grid.
- Chưa có `EvidenceViewer` chuyên biệt theo source.
- Chưa có source tabs `QC ghi nhận` / `Cửa hàng khắc phục`.
- Chưa có compare mode trước/sau.
- Chưa có thumbnail strip, metadata đầy đủ, keyboard/swipe/zoom theo brief.
- Chưa tích hợp vào tab `Biên bản QC`.

## 3. Non-Goals

Không làm trong lần đầu nếu chưa được chỉ định:

- Không đổi schema backend nếu frontend có thể normalize được dữ liệu hiện tại.
- Không đổi business status backend từ `resolved` sang `waiting_verification`; chỉ map UI nếu cần.
- Không thêm dependency zoom/swipe nếu chưa thống nhất.
- Không refactor toàn bộ QC create page ngoài phạm vi evidence viewer.

## 4. Data Contract

Chuẩn hóa dữ liệu frontend về shape sau:

```js
{
  id: string,
  source: 'qc' | 'remediation',
  url: string,
  thumbnailUrl: string,
  name: string,
  createdAt: string | null,
  createdBy: { id?: string, name: string } | null,
  note: string,
}
```

Nguồn dữ liệu hiện tại:

- QC images: `finding.metaInfo.qc_attachments`.
- Remediation images: `finding.evidence` hoặc form evidence trong `ensureForm(finding).evidence`.
- QC note: `finding.metaInfo.qc_note`.
- Remediation note: `finding.correctiveNote` hoặc form `correctiveNote`.

Cần helper normalize:

- `normalizeEvidenceImage(image, source, fallbackIndex, context)`.
- `buildFindingEvidenceImages(finding, form)` trả về mảng gồm cả `qc` và `remediation` nhưng viewer phải filter theo source.

## 5. Component Plan

### 5.1. `EvidenceGallery.vue`

Responsibility:

- Render thumbnail grid cho một source ảnh hoặc một collection đã filter.
- Hiển thị title source, empty state, max preview và `+N`.
- Không tự mở modal nếu không có ảnh.
- Emit `open(image, index, source)`.

Props đề xuất:

```js
images: Array
source: 'qc' | 'remediation'
title: String
emptyText: String
maxPreview: Number // default 3
readonly: Boolean
```

Events:

```js
open({ image, index, source })
```

Acceptance:

- Nếu ảnh <= maxPreview: show đủ ảnh.
- Nếu ảnh > maxPreview: cell cuối hiển thị `+N` và mở viewer ở ảnh đầu tiên chưa hiện.
- Ảnh lỗi không làm crash UI.

### 5.2. `EvidenceViewer.vue`

Responsibility:

- Viewer chính chuyên cho evidence.
- Có tabs source: `QC ghi nhận (n)`, `Cửa hàng khắc phục (n)`.
- Navigation prev/next trong source hiện tại, không tự nhảy source.
- Metadata: source label, index, createdAt, createdBy, note nếu có.
- Empty state khi source không có ảnh.
- Optional compare mode.

Props đề xuất:

```js
modelValue: Boolean
images: Array
initialSource: 'qc' | 'remediation'
initialIndex: Number
title: String
enableCompare: Boolean
```

Events:

```js
update:modelValue(Boolean)
close()
```

Acceptance:

- Mở đúng source và index ảnh user bấm.
- Prev/next chỉ chạy trong source đang chọn.
- Disable tab source rỗng.
- Close bằng X, backdrop, Escape.

### 5.3. Compare Mode

Phase đầu có thể implement basic compare, sau đó nâng cấp.

Rules:

- Enable khi `qcImages.length > 0 && remediationImages.length > 0`.
- Desktop: 2 cột trước/sau.
- Mobile: stacked trước/sau.
- Mỗi panel có index và điều hướng riêng.
- Không ép cặp ảnh 1:1.

Acceptance:

- Người dùng có thể xem ảnh trước/sau cùng lúc.
- Điều hướng trước và sau độc lập.
- Không vỡ layout nếu số lượng ảnh 2 nhóm khác nhau.

## 6. Implementation Phases

### Phase 0: Baseline & Cleanup

- Read current `ImagePreviewModal.vue` and `QCSessionRemediationPanel.vue`.
- Decide whether to replace `ImagePreviewModal` or keep as generic lower-level viewer.
- Confirm all current build passes before replacing.

Validation:

```bash
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run build
```

### Phase 1: Data Normalization

Files likely touched:

- `src/components/QCSessionRemediationPanel.vue`
- optional: `src/utils/evidence.js` or local helpers first

Tasks:

- Normalize QC evidence and remediation evidence into common image shape.
- Preserve current upload/removal behavior.
- Make sure unsent local uploaded evidence can preview via `previewUrl`, `preview`, `dataUrl`, or `url`.

Acceptance:

- QC images and remediation images are separate arrays.
- Missing metadata displays cleanly as `--` or hides optional metadata.

### Phase 2: Build `EvidenceGallery.vue`

Files:

- `src/components/EvidenceGallery.vue`

Tasks:

- Thumbnail grid.
- Max preview and `+N`.
- Empty states.
- Emit open event.

Acceptance:

- Works for QC images.
- Works for remediation images.
- Does not open viewer for empty gallery.

### Phase 3: Build `EvidenceViewer.vue`

Files:

- `src/components/EvidenceViewer.vue`

Tasks:

- Source tabs.
- Main image.
- Prev/next.
- Index display.
- Metadata panel.
- Close handling.
- Keyboard Left/Right/Escape for desktop.

Acceptance:

- Opening QC thumbnail opens QC tab at correct image.
- Opening remediation thumbnail opens remediation tab at correct image.
- Source navigation stays within active source.

### Phase 4: Integrate Into Remediation Panel

Files:

- `src/components/QCSessionRemediationPanel.vue`

Tasks:

- Replace inline thumbnail markup with `EvidenceGallery` for QC ghi nhận.
- Replace remediation evidence thumbnail area with `EvidenceGallery`, while preserving add/remove upload UI.
- Use `EvidenceViewer` instead of `ImagePreviewModal` for this panel.

Acceptance:

- Click QC image opens evidence viewer.
- Click remediation image opens evidence viewer.
- Add/remove evidence still works.
- Submit remediation gating still works.

### Phase 5: Compare Mode

Files:

- `src/components/EvidenceViewer.vue`

Tasks:

- Add `So sánh` mode/tab/button.
- Desktop two-panel compare.
- Mobile stacked compare.
- Independent prev/next per source panel.

Acceptance:

- Compare disabled if either source empty.
- Different image counts are handled.
- No forced 1:1 pairing.

### Phase 6: Integrate Into QC Record View

Likely files:

- `src/pages/QCCreateSessionPage.vue`
- `src/components/QCCriterionTreeItem.vue`

Tasks:

- For readonly/submitted QC criteria, show evidence thumbnails with `EvidenceGallery`.
- Do not change scoring logic.
- Do not allow editing QC evidence after submitted unless current flow already allows it.

Acceptance:

- In tab `Biên bản QC`, clicking criterion evidence opens viewer.
- Viewer source should default to `QC ghi nhận`.

### Phase 7: Optional Wider Integration

Possible files:

- `src/pages/QCFindingManagementPage.vue`
- `src/pages/TicketDetailPage.vue` only if generalized later

Tasks:

- Replace duplicated image preview modal usage where evidence semantics match.
- Keep ticket attachment preview separate if not evidence-specific.

## 7. UX Rules To Preserve

- Evidence viewer must not hide source context.
- Images are primary content; metadata should be compact.
- Buttons should use existing icon style and Material Symbols/lucide conventions already present.
- Mobile viewer should be full-screen or near full-screen.
- Text must not overflow buttons/cards.
- Do not nest cards inside cards unnecessarily.

## 8. Permissions & Status Rules

Current UI mapping can remain:

```text
open        -> Chờ khắc phục
in_progress -> Đang khắc phục
resolved    -> Chờ admin duyệt / Chờ QC xác nhận
rejected    -> Chưa đạt
verified    -> Đã đạt / Đã hoàn tất
```

Evidence edit rules:

- QC images: view only in remediation flow.
- Store/admin can upload remediation evidence while status is `open`, `in_progress`, or `rejected`.
- Once status is `resolved` / waiting verification, evidence should be locked unless product decides otherwise.
- QC/admin can review resolved findings.

## 9. Verification Checklist

Run after each phase touching frontend:

```bash
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && node -v && npm -v && npm run build
```

Manual QA:

- Finding with no QC image.
- Finding with many QC images, no remediation images.
- Finding with remediation images, no QC images.
- Finding with both image groups.
- Click first/middle/last thumbnail.
- Click `+N` thumbnail.
- Prev/next wraps correctly.
- Source tabs disabled correctly.
- Compare mode only enabled when both sources have images.
- Mobile layout does not overflow horizontally.
- Remove remediation image does not open viewer.
- Upload image preview can open before/after save if local preview URL exists.

## 10. Suggested Commit Slices

1. `feat(qc): add reusable evidence gallery components`
2. `feat(qc): integrate evidence viewer into remediation findings`
3. `feat(qc): add evidence compare mode`
4. `feat(qc): use evidence gallery in QC record view`

## 11. Open Decisions

- Có cần pinch zoom mobile trong phase đầu không?
- Có cho thêm dependency zoom/swipe không, hay tự viết minimal?
- Metadata `createdBy/createdAt` cần backend bổ sung hay frontend hiển thị optional là đủ?
- Status text cuối cùng dùng `Chờ admin duyệt` hay `Chờ QC xác nhận`?
- Có cần migrate `ImagePreviewModal.vue` sang `EvidenceViewer` toàn bộ nơi khác không?

---

## 12. Brief Compliance Matrix

Bảng này dùng để kiểm tra plan có triển khai đủ theo brief hay chưa. Không đánh dấu phase complete nếu dòng tương ứng chưa đạt.

| Brief Section | Requirement | Implementation Target | Phase | Required |
| --- | --- | --- | --- | --- |
| 1 | Gallery phục vụ QC ảnh trước và Store ảnh sau | Normalize `source: qc/remediation` | Phase 1 | Yes |
| 2 | Evidence viewer phải cho biết giai đoạn, ai tạo, thời điểm | Viewer metadata panel | Phase 3 | Yes, metadata optional fallback |
| 3.1 | Tab Biên bản QC mở viewer từ evidence tiêu chí | Integrate into readonly QC record criteria | Phase 6 | Yes |
| 3.2 | Tab Khắc phục hiển thị ảnh trước/sau | Use `EvidenceGallery` for both sections | Phase 4 | Yes |
| 3.3 | Chi tiết Finding hiển thị note và ảnh trước/sau | Remediation detail modal uses gallery | Phase 4 | Yes |
| 4 | Component architecture reusable | `EvidenceGallery`, `EvidenceThumbnailGrid` optional internal, `EvidenceViewer` | Phase 2-3 | Yes |
| 5 | Data model has source/url/metadata | Normalizer returns common `EvidenceImage` | Phase 1 | Yes |
| 6 | Thumbnail grid max preview and `+N` | `EvidenceGallery.maxPreview` | Phase 2 | Yes |
| 7 | Desktop viewer source tabs, main image, nav, metadata, thumbnail strip | `EvidenceViewer` desktop layout | Phase 3 | Yes |
| 8 | Source tabs disabled if empty and navigation stays in source | Source-scoped navigation | Phase 3 | Yes |
| 9 | Prev/next, keyboard, index | Buttons, Left/Right, `x/y` | Phase 3 | Yes |
| 10 | Zoom desktop/mobile | Zoom in/out/reset first; pinch/double tap optional by decision | Phase 5B | Partial unless approved |
| 11 | Metadata | Source, createdAt, createdBy, note | Phase 3 | Yes with fallbacks |
| 12 | Compare mode | Desktop 2 panel, independent navigation | Phase 5 | Yes |
| 13 | Mobile viewer fullscreen | Mobile full-screen/near full-screen viewer | Phase 3 | Yes |
| 14 | Mobile compare stacked | Compare stacked layout | Phase 5 | Yes |
| 15 | Empty states | Source-specific empty text | Phase 2-3 | Yes |
| 16 | Loading/error | Image load skeleton/error with retry | Phase 3B | Yes |
| 17 | Upload preview status | Uploading/error per image | Phase 7 | Optional unless requested now |
| 18 | Permissions | QC/store permission behavior preserved | Phase 4/6 | Yes |
| 19 | Status mapping | UI maps current backend statuses | Phase 4 | Yes |
| 20 | Suggested API | Vue equivalent props/events | Phase 2-3 | Yes |
| 21 | Styling | Match current QC style | All phases | Yes |
| 22 | Responsive rules | Desktop/mobile validated | Phase 3/5/6 | Yes |

## 13. Definition Of Done

Implementation status: Phase 1-6 core flow has been implemented for remediation and readonly QC evidence. Remaining optional items include advanced zoom/pinch/swipe and per-image upload status.


Implementation chỉ được xem là hoàn tất khi đạt tất cả điều kiện sau:

- Có `EvidenceGallery.vue` dùng lại được, không hard-code riêng cho remediation panel.
- Có `EvidenceViewer.vue` chuyên cho evidence, không chỉ là image modal thường.
- Ảnh QC và ảnh khắc phục được tách source rõ ràng.
- Click ảnh QC mở viewer ở tab `QC ghi nhận` đúng index.
- Click ảnh khắc phục mở viewer ở tab `Cửa hàng khắc phục` đúng index.
- Prev/next không tự nhảy qua source khác.
- Source rỗng bị disabled và có empty state đúng text.
- Có compare mode khi cả 2 source có ảnh.
- Compare desktop hiển thị 2 panel song song.
- Compare mobile hiển thị stacked, không ép 2 cột nhỏ.
- Metadata hiển thị nếu có và fallback sạch nếu thiếu.
- Image load lỗi không crash viewer.
- Nút xóa ảnh khắc phục không mở viewer.
- Build frontend pass.
- Manual QA checklist ở mục 9 pass.

## 14. Mandatory Implementation Order

Không đảo thứ tự dưới đây trừ khi có lý do kỹ thuật rõ ràng:

1. Chuẩn hóa data evidence trước.
2. Build thumbnail gallery trước viewer.
3. Build viewer source tabs và navigation trước compare mode.
4. Integrate vào tab Khắc phục trước vì data trước/sau rõ nhất.
5. Sau khi Khắc phục ổn mới integrate vào tab Biên bản QC.
6. Compare mode chỉ làm khi source tabs và source-scoped navigation đã ổn.
7. Zoom/swipe chỉ làm sau khi viewer core và compare pass.

Lý do: nếu làm compare/zoom trước khi data source ổn sẽ dễ trộn ảnh QC và ảnh khắc phục, sai nguyên tắc chính của brief.

## 15. Detailed Phase Checklists

### Phase 1 Checklist: Data Normalization

- [x] Tạo helper normalize image source từ `url`, `previewUrl`, `preview`, `dataUrl`.
- [x] Tạo helper normalize image name fallback `Ảnh n`.
- [x] Tạo helper normalize metadata `createdAt`, `createdBy`, `note`.
- [x] Tạo helper build QC images từ `finding.metaInfo.qc_attachments`.
- [x] Tạo helper build remediation images từ `finding.evidence` hoặc form evidence.
- [x] Mỗi image có `source` chính xác.
- [x] Không mất preview ảnh local vừa upload.

### Phase 2 Checklist: EvidenceGallery

- [x] Props đủ: `images`, `source`, `title`, `emptyText`, `maxPreview`, `readonly`.
- [x] Render empty state nếu không có ảnh.
- [x] Render thumbnail grid responsive.
- [x] Nếu ảnh vượt `maxPreview`, cell cuối hiển thị `+N`.
- [x] Click thumbnail emit đúng index.
- [x] Click `+N` emit index ảnh đầu tiên bị ẩn.
- [ ] Thumbnail image error có fallback UI.

### Phase 3 Checklist: EvidenceViewer Core

- [x] Props đủ: `modelValue`, `images`, `initialSource`, `initialIndex`, `title`, `enableCompare`.
- [x] Split source images internally thành `qcImages` và `remediationImages`.
- [x] Source tabs có count.
- [x] Source tab rỗng disabled.
- [x] Initial source/index được resolve đúng.
- [x] Prev/next wrap trong source hiện tại.
- [x] Keyboard Left/Right hoạt động khi viewer mở.
- [x] Escape đóng viewer.
- [x] Metadata hiển thị gọn.
- [x] Loading/error image state có UI.
- [x] Mobile layout full-screen hoặc gần full-screen.

### Phase 4 Checklist: Remediation Integration

- [x] `QCSessionRemediationPanel.vue` dùng `EvidenceGallery` cho QC ghi nhận.
- [x] `QCSessionRemediationPanel.vue` dùng `EvidenceGallery` cho ảnh khắc phục.
- [x] Upload evidence vẫn hoạt động.
- [x] Remove evidence vẫn hoạt động và không mở viewer.
- [x] Submit gating `Đã khắc phục` vẫn hoạt động.
- [ ] Detail finding popup không bị overflow trên mobile.
- [x] Viewer mở đúng source từ từng gallery.

### Phase 5 Checklist: Compare Mode

- [x] Button/tab `So sánh` chỉ enable khi có cả QC và remediation images.
- [x] Desktop compare có 2 panel: trước/sau.
- [x] Mobile compare stacked.
- [x] Trước và sau có index riêng.
- [x] Prev/next từng panel độc lập.
- [x] Không pair ảnh 1:1.
- [x] Metadata từng panel hiển thị độc lập.

### Phase 6 Checklist: Biên Bản QC Integration

- [x] Xác định vị trí evidence trong `QCCreateSessionPage.vue`/`QCCriterionTreeItem.vue`.
- [x] Chỉ hiển thị gallery khi có ảnh evidence.
- [x] Readonly submitted session mở viewer được.
- [x] Không làm thay đổi scoring/status criteria.
- [x] Không cho sửa ảnh QC sau submit nếu flow hiện tại không cho.

### Phase 7 Checklist: Optional Upload Status

- [ ] Mỗi ảnh upload có `pending/uploading/uploaded/error` nếu cần.
- [ ] Upload lỗi có retry.
- [ ] Uploading skeleton không phá layout.

## 16. Data Examples For Current Code

### Finding With QC Images

```js
const qcImages = finding.metaInfo?.qc_attachments || []
```

Normalize thành:

```js
{
  id: image.id || `qc-${finding.id}-${index}`,
  source: 'qc',
  url: image.url || image.previewUrl || image.preview || image.dataUrl,
  thumbnailUrl: image.thumbnailUrl || image.url,
  name: image.name || `Ảnh QC ${index + 1}`,
  createdAt: image.createdAt || finding.metaInfo?.detected_at || finding.createdAt || null,
  createdBy: image.createdBy || finding.metaInfo?.auditor || null,
  note: image.note || finding.metaInfo?.qc_note || '',
}
```

### Finding With Remediation Images

```js
const remediationImages = ensureForm(finding).evidence || finding.evidence || []
```

Normalize thành:

```js
{
  id: image.id || `remediation-${finding.id}-${index}`,
  source: 'remediation',
  url: image.url || image.previewUrl || image.preview || image.dataUrl,
  thumbnailUrl: image.thumbnailUrl || image.url || image.previewUrl,
  name: image.name || `Ảnh khắc phục ${index + 1}`,
  createdAt: image.createdAt || image.created_at || null,
  createdBy: image.createdBy || null,
  note: image.note || finding.correctiveNote || '',
}
```

## 17. UX Copy

Source labels:

```text
qc -> QC ghi nhận
remediation -> Cửa hàng khắc phục
compare -> So sánh
```

Empty states:

```text
QC không có ảnh: Chưa có ảnh minh chứng từ QC.
Store chưa gửi ảnh: Cửa hàng chưa gửi minh chứng khắc phục.
Không có ảnh nào: Chưa có ảnh minh chứng.
```

Compare labels:

```text
TRƯỚC KHẮC PHỤC
SAU KHẮC PHỤC
```

## 18. Rollback Plan

Nếu viewer mới có lỗi lớn:

1. Giữ helpers normalize vì ít rủi ro.
2. Revert integration ở `QCSessionRemediationPanel.vue` về `ImagePreviewModal.vue` tạm thời.
3. Không revert upload/remediation submit logic nếu không liên quan.
4. Build lại và QA luồng khắc phục trước khi tiếp tục.

## 19. Implementation Notes

- Ưu tiên không thêm dependency trong Phase 1-5.
- Nếu cần pinch zoom/swipe chuyên nghiệp, quyết định dependency riêng trước khi làm Phase 5B.
- Có thể giữ `ImagePreviewModal.vue` làm fallback/simple viewer, nhưng evidence flow chính nên dùng `EvidenceViewer.vue`.
- Không dùng CSS global nặng nếu component scoped giải quyết được.
- Khi sửa ảnh upload/removal, luôn test `@click.stop` trên nút xóa.

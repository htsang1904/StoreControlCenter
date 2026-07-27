# QC Evidence Gallery & Viewer — Implementation Brief

## 1. Mục tiêu

Xây dựng UI gallery xem ảnh minh chứng cho luồng QC và khắc phục Finding.

Gallery phục vụ 2 nhóm ảnh:

1. **Ảnh QC ghi nhận** — trạng thái trước khắc phục.
2. **Ảnh cửa hàng khắc phục** — trạng thái sau khắc phục.

Không trộn hai nhóm ảnh thành một gallery duy nhất.

## 2. Nguyên tắc UX

Đây là Evidence Viewer, không phải gallery ảnh thông thường. Người dùng phải biết ảnh thuộc giai đoạn nào, ai tạo, thời điểm tạo và có thể so sánh trước/sau để hỗ trợ QC xác nhận Finding.

Không ép ảnh Before/After thành cặp 1:1. Ví dụ QC có 5 ảnh nhưng Store chỉ gửi 2 ảnh thì hai tập ảnh vẫn độc lập.

## 3. Vị trí sử dụng

### 3.1. Tab Biên bản QC

Trong tiêu chí đã chấm:

```text
QC-03
Nhân viên không đeo bảng tên

Kết quả: Không đạt

Ghi chú:
2 nhân viên không đeo bảng tên.

Minh chứng:
[Ảnh 1] [Ảnh 2] [+3]
```

Click ảnh mở Evidence Viewer.

### 3.2. Tab Khắc phục

Trong Finding:

```text
QC ghi nhận
[Ảnh trước]

Cửa hàng khắc phục
[Ảnh sau]
```

### 3.3. Chi tiết Finding

Hiển thị QC note, ảnh trước, nội dung khắc phục và ảnh sau.

## 4. Component Architecture

```text
EvidenceGallery
├── EvidenceThumbnailGrid
└── EvidenceViewer
    ├── ViewerHeader
    ├── EvidenceSourceTabs
    ├── MainImage
    ├── ViewerNavigation
    ├── ZoomControls
    ├── ThumbnailStrip
    ├── ImageMetadata
    └── CompareMode
        ├── BeforePanel
        └── AfterPanel
```

Không tạo gallery riêng cho Biên bản QC và Finding.

## 5. Data Model gợi ý

```ts
type EvidenceSource = 'qc' | 'remediation'

interface EvidenceImage {
  id: string
  url: string
  thumbnailUrl?: string
  source: EvidenceSource
  createdAt?: string
  createdBy?: {
    id?: string
    name: string
  }
  note?: string
}

interface EvidenceGalleryProps {
  images: EvidenceImage[]
  title?: string
  maxPreview?: number
  readonly?: boolean
  onOpen?: (image: EvidenceImage, index: number) => void
}
```

Finding có thể chứa:

```ts
interface Finding {
  id: string
  criterionId: string
  criterionName: string
  status: FindingStatus
  qcNote?: string
  remediationNote?: string
  evidence: EvidenceImage[]
}
```

Filter ảnh:

```ts
const qcImages = evidence.filter(x => x.source === 'qc')
const remediationImages = evidence.filter(x => x.source === 'remediation')
```

## 6. Thumbnail Grid

Desktop:

```text
Minh chứng trước khắc phục

┌──────────┐ ┌──────────┐ ┌──────────┐
│  Ảnh 1   │ │  Ảnh 2   │ │   +3     │
└──────────┘ └──────────┘ └──────────┘
```

Nếu vượt `maxPreview`, ảnh cuối hiển thị `+N`.

Click `+N` mở viewer ở ảnh đầu tiên chưa hiển thị.

## 7. Evidence Viewer — Desktop

```text
┌───────────────────────────────────────────────────────────┐
│ Minh chứng Finding FD-2024-031                       ✕    │
├───────────────────────────────────────────────────────────┤
│ [QC ghi nhận (5)] [Cửa hàng khắc phục (3)] [So sánh]    │
├───────────────────────────────────────────────────────────┤
│                                                           │
│   ‹                                                       │
│                  ┌──────────────────┐                     │
│                  │      IMAGE       │                     │
│                  └──────────────────┘                     │
│                                                       ›   │
├───────────────────────────────────────────────────────────┤
│ QC ghi nhận                                   2 / 5       │
│ 30/05/2024 09:15 · Nguyễn Văn An                         │
│ [thumb] [thumb] [thumb] [thumb] [thumb]                  │
└───────────────────────────────────────────────────────────┘
```

## 8. Source Tabs

Có 2 source:

```text
QC ghi nhận (5)
Cửa hàng khắc phục (3)
```

Mapping:

```ts
qc -> 'QC ghi nhận'
remediation -> 'Cửa hàng khắc phục'
```

Nếu source không có ảnh, ưu tiên disable tab.

Navigation chỉ chạy trong source hiện tại, không tự nhảy sang source khác.

## 9. Navigation

Hỗ trợ:

- Previous / Next.
- Keyboard Left/Right trên desktop.
- Swipe trái/phải trên mobile.
- Index `x / total`.

Ví dụ:

```text
2 / 5
```

## 10. Zoom

Desktop:

- zoom in;
- zoom out;
- reset zoom;
- mouse wheel optional.

Mobile:

- pinch to zoom;
- double tap to zoom.

Rotate chưa cần ở phase đầu.

## 11. Metadata

Hiển thị gọn:

```text
QC ghi nhận
30/05/2024 09:15
Nguyễn Văn An
```

Nếu có note:

```text
Ghi chú ảnh:
Nhân viên không đeo bảng tên tại khu vực quầy.
```

Ảnh vẫn phải là nội dung chính.

## 12. Compare Mode

Chỉ enable khi:

```text
qcImages.length > 0
AND
remediationImages.length > 0
```

Desktop:

```text
┌───────────────────────┬───────────────────────┐
│ TRƯỚC KHẮC PHỤC       │ SAU KHẮC PHỤC        │
│      [IMAGE]          │       [IMAGE]         │
├───────────────────────┼───────────────────────┤
│ QC                    │ Cửa hàng             │
│ 30/05/2024 09:15      │ 31/05/2024 14:20     │
│ 2 / 5                 │ 1 / 3                 │
└───────────────────────┴───────────────────────┘
```

Hai panel điều hướng độc lập. Không sync index bắt buộc.

## 13. Mobile Viewer

Mobile dùng full-screen viewer:

```text
←       Minh chứng                            ⋯

          QC ghi nhận
               2/5

        ┌───────────────┐
        │     IMAGE     │
        └───────────────┘

30/05/2024 09:15
Nguyễn Văn An

[ QC ghi nhận ] [ Sau khắc phục ]
```

Hỗ trợ:

- swipe trái/phải;
- pinch zoom;
- double tap zoom;
- nút back hoặc swipe down để đóng.

Không cần thumbnail strip trên mobile.

## 14. Mobile Compare

Không chia 2 cột nhỏ.

Dùng stacked:

```text
So sánh trước / sau

TRƯỚC KHẮC PHỤC
[IMAGE]
2 / 5

──────────────

SAU KHẮC PHỤC
[IMAGE]
1 / 3
```

## 15. Empty States

QC không có ảnh:

```text
Chưa có ảnh minh chứng từ QC.
```

Store chưa gửi ảnh:

```text
Cửa hàng chưa gửi minh chứng khắc phục.
```

Không có ảnh nào:

```text
Chưa có ảnh minh chứng.
```

Không mở viewer nếu gallery rỗng.

## 16. Loading / Error

Thumbnail dùng skeleton.

Viewer có spinner hoặc skeleton cho ảnh.

Nếu ảnh load lỗi:

```text
Không thể tải ảnh.

[Thử lại]
```

Không crash toàn gallery.

## 17. Upload Preview cho Store

```text
Minh chứng sau khắc phục

[preview] [preview] [ + thêm ảnh ]
```

Trạng thái upload:

```ts
type UploadStatus =
  | 'pending'
  | 'uploading'
  | 'uploaded'
  | 'error'
```

Nếu lỗi:

```text
Upload thất bại
[Thử lại]
```

## 18. Permission

### QC

Có thể:

- xem ảnh QC;
- xem ảnh Store;
- compare;
- verify Finding;
- reject Finding.

Không chỉnh/sửa ảnh QC sau khi session đã submit.

### Store

Có thể:

- xem ảnh QC;
- upload ảnh khắc phục;
- xem ảnh khắc phục của mình;
- gửi QC xác nhận.

Không xóa/sửa ảnh QC.

Khi Finding đang `waiting_verification`, nên khóa remediation evidence để tránh thay đổi sau khi đã gửi xác nhận.

## 19. Finding Status Mapping

```ts
type FindingStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_verification'
  | 'rejected'
  | 'verified'
```

UI:

```text
open                 -> Chờ khắc phục
in_progress          -> Đang khắc phục
waiting_verification -> Chờ QC xác nhận
rejected             -> Khắc phục chưa đạt
verified             -> Đã hoàn tất
```

## 20. Suggested Component API

```tsx
<EvidenceGallery
  images={finding.evidence}
  title="Minh chứng"
  maxPreview={3}
/>
```

Viewer:

```tsx
<EvidenceViewer
  images={finding.evidence}
  initialSource="qc"
  initialImageId={selectedImageId}
  enableCompare
  onClose={closeViewer}
/>
```

## 21. Styling

Theo style QC hiện tại:

- nền sáng;
- border nhẹ;
- radius vừa;
- shadow rất nhẹ;
- primary blue;
- red cho lỗi;
- green cho hoàn tất;
- orange cho pending.

Không dùng decoration quá mạnh trong viewer.

## 22. Responsive Rules

Desktop >= 1024px:

- modal lớn;
- thumbnail strip;
- compare 2 cột.

Tablet:

- modal gần full-screen;
- thumbnail strip scroll ngang.

Mobile:

- full-screen;
- không thumbnail strip;
- swipe;
- compare stacked.

## 23. Accessibility

Bắt buộc:

- ảnh có alt text;
- close button có aria-label;
- Previous/Next keyboard support;
- ESC đóng viewer desktop;
- focus trap trong modal;
- source tabs dùng button thật;
- không chỉ dùng màu để phân biệt trạng thái.

## 24. Không làm trong phase đầu

Không cần:

- annotation ảnh;
- crop;
- rotate;
- drawing;
- AI compare;
- pair mapping;
- comment per image;
- download ZIP;
- version ảnh.

## 25. Acceptance Criteria

### Gallery

- [ ] Hiển thị thumbnail đúng.
- [ ] Có `+N` khi vượt `maxPreview`.
- [ ] Click thumbnail mở đúng ảnh.
- [ ] Không trộn ảnh QC và remediation.

### Viewer

- [ ] Có source tabs.
- [ ] Có Previous/Next.
- [ ] Có `x / total`.
- [ ] Có metadata.
- [ ] Có zoom.
- [ ] ESC đóng được trên desktop.
- [ ] Swipe được trên mobile.

### Compare

- [ ] Chỉ enable khi có Before và After.
- [ ] Desktop hiển thị 2 cột.
- [ ] Mobile hiển thị stacked.
- [ ] Hai panel điều hướng độc lập.

### Error / Empty

- [ ] Image load lỗi không crash.
- [ ] Có retry.
- [ ] Empty state đúng source.
- [ ] Loading state rõ ràng.

## 26. Implementation Phases

### Phase 1 — Gallery Base

Build:

- `EvidenceGallery`;
- `EvidenceThumbnailGrid`;
- modal open/close;
- image navigation.

Chưa làm compare.

### Phase 2 — Evidence Viewer

Build:

- source tabs;
- metadata;
- zoom;
- keyboard navigation;
- responsive mobile.

### Phase 3 — Compare Mode

Build:

- Before/After;
- desktop 2 panel;
- mobile stacked;
- navigation độc lập.

### Phase 4 — Finding Integration

Tích hợp vào:

- Biên bản QC;
- tab Khắc phục;
- Finding detail drawer/modal.

### Phase 5 — Upload Integration

Build:

- Store upload remediation evidence;
- preview;
- retry;
- validation;
- submit Finding.

## 27. Prompt gợi ý cho Codex

```text
Hãy đọc tài liệu QC Evidence Gallery & Viewer Implementation Brief.

Mục tiêu:
Xây dựng gallery xem ảnh minh chứng dùng chung cho luồng QC và Finding.

Yêu cầu quan trọng:

1. Không tạo gallery riêng cho Biên bản QC và Finding.
2. Dùng chung EvidenceGallery + EvidenceViewer.
3. Tách ảnh theo source:
   - qc
   - remediation
4. Không ghép Before/After thành cặp 1:1.
5. Viewer desktop có:
   - source tabs
   - previous/next
   - thumbnail strip
   - metadata
   - zoom
6. Mobile dùng full-screen viewer:
   - swipe
   - pinch zoom nếu stack hiện tại hỗ trợ
   - không cần thumbnail strip.
7. Compare Mode chỉ bật khi cả 2 source đều có ảnh.
8. Không chỉnh sửa/xóa evidence QC sau khi session đã submit.
9. Không refactor các phần không liên quan.
10. Tái sử dụng component hiện có nếu phù hợp.

Triển khai theo từng phase.
Sau mỗi phase:
- kiểm tra build;
- kiểm tra lint/typecheck nếu project có;
- liệt kê file đã thay đổi;
- mô tả ngắn behavior đã hoàn thành.

Bắt đầu với Phase 1:
EvidenceGallery + EvidenceThumbnailGrid + viewer cơ bản.
```

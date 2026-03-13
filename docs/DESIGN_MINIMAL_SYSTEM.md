# Minimal Design System

Muc tieu cua UI nay la toi gian, de doc, de thao tac va giam toi da cam giac "lam qua tay". Huong tham chieu la tinh than Apple: trung tinh, co trat tu, uu tien noi dung va tac vu.

## Nguyen tac

- Uu tien border, spacing va typography truoc shadow va hieu ung.
- Chi dung 1 mau nhan chinh cho action quan trong; con lai giu palette trung tinh.
- Bo gradient trang tri, glow, blur manh, card shadow dam va animation khong can thiet.
- He thong can "im", chi trang thai active, focus, error, success moi duoc nhan manh.

## Foundation

- Font: system UI stack qua `--font-ui`
- Nen ung dung: `--app-bg`
- Surface: `--surface`
- Text chinh: `--text-primary`
- Text phu: `--text-secondary`
- Border: `--stroke`
- Accent/focus: `--ring`

## Quy tac component

- Page shell: nen sang, border nhe, khong dung card xep tang lop khong can thiet.
- Card/list item: uu tien border + doi nen nhe khi hover/active; shadow rat nhe hoac khong dung.
- Button:
  - Primary: mau accent, hinh khoi gon, khong them glow.
  - Secondary: border nhe, nen trang.
  - Ghost: khong border, chi doi nen nhe khi hover.
- Empty state: icon don gian + 1 headline + 1 dong huong dan. Khong dung minh hoa mau me.
- Table/card responsive: thong tin quan trong xuat hien ro truoc, khong chen nhieu badge.

## Spacing va typography

- Spacing uu tien theo nhom 4 / 8 / 12 / 16 / 24.
- Heading ngan, dam vua phai.
- Text phu dung mau xam, tranh dung nhieu cap mau xanh.
- Tieu de va meta can thang hang, khong "nhay nhac" theo viewport.

## Checklist truoc khi merge UI

- Co chi tiet nao chi de "dep" ma khong giup doc/nhan biet nhanh hon khong?
- Border da du de phan tach khoi thong tin chua? Neu roi, khong can them shadow.
- Empty state, loading state, error state da cung mot ngon ngu thiet ke chua?
- Hover/active/focus co tinh te va dong deu giua cac man chua?

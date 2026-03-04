export const QC_TEMPLATES = [
  {
    id: 'ticket_standard',
    name: 'QC Ticket chuẩn',
    version: 'v1.1',
    passThreshold: 7,
    description: 'Biên bản nhanh cho vận hành ticket, ưu tiên checklist đạt/không đạt.',
    categories: [
      {
        id: 'ops',
        name: 'Vận hành quầy',
        criteria: [
          { id: 'ops-1', name: 'Quầy sạch, không vật cản', mode: 'pass_fail', critical: true, frequency: 'per_audit' },
          { id: 'ops-2', name: 'Nhân sự đúng vị trí', mode: 'pass_fail', critical: false, frequency: 'per_audit' },
          { id: 'ops-3', name: 'Checklist mở ca đầy đủ', mode: 'pass_fail', critical: false, frequency: 'weekly_once' },
        ],
      },
      {
        id: 'service',
        name: 'Dịch vụ khách hàng',
        criteria: [
          { id: 'svc-1', name: 'Chào hỏi đúng quy trình', mode: 'point', maxScore: 10, passScore: 8, critical: false, frequency: 'per_audit' },
          { id: 'svc-2', name: 'Tư vấn đúng thông tin', mode: 'point', maxScore: 10, passScore: 9, critical: true, frequency: 'per_audit' },
          { id: 'svc-3', name: 'Xử lý khiếu nại tại quầy', mode: 'point', maxScore: 10, passScore: 8, critical: true, frequency: 'per_audit' },
        ],
      },
    ],
  },
  {
    id: 'food_safety',
    name: 'QC An toàn vệ sinh',
    version: 'v2.1',
    passThreshold: 38,
    description: 'Biên bản tập trung vào tiêu chuẩn vệ sinh, an toàn thực phẩm.',
    categories: [
      {
        id: 'hygiene',
        name: 'Vệ sinh khu vực',
        criteria: [
          { id: 'hyg-1', name: 'Sàn và bề mặt không bẩn', mode: 'point', maxScore: 10, passScore: 8, critical: true, frequency: 'per_audit' },
          { id: 'hyg-2', name: 'Dụng cụ vệ sinh đúng nơi', mode: 'point', maxScore: 8, passScore: 6, critical: false, frequency: 'per_audit' },
          { id: 'hyg-3', name: 'Thùng rác đúng quy chuẩn', mode: 'point', maxScore: 8, passScore: 7, critical: true, frequency: 'weekly_once' },
        ],
      },
      {
        id: 'storage',
        name: 'Bảo quản hàng',
        criteria: [
          { id: 'sto-1', name: 'Nhiệt độ tủ bảo quản đạt chuẩn', mode: 'point', maxScore: 10, passScore: 8, critical: true, frequency: 'per_audit' },
          { id: 'sto-2', name: 'Hàng hóa theo FIFO', mode: 'pass_fail', critical: false, frequency: 'per_audit' },
          { id: 'sto-3', name: 'Tem nhãn và hạn dùng rõ ràng', mode: 'pass_fail', critical: true, frequency: 'per_audit' },
        ],
      },
    ],
  },
  {
    id: 'visual_merch',
    name: 'QC Trưng bày hàng hóa',
    version: 'v1.4',
    passThreshold: 28,
    description: 'Biên bản cho trưng bày, POSM, trải nghiệm thị giác tại cửa hàng.',
    categories: [
      {
        id: 'display',
        name: 'Trưng bày chính',
        criteria: [
          { id: 'dis-1', name: 'Bố cục theo planogram', mode: 'point', maxScore: 10, passScore: 8, critical: true, frequency: 'per_audit' },
          { id: 'dis-2', name: 'Mặt hàng chủ lực đủ số lượng', mode: 'point', maxScore: 8, passScore: 6, critical: false, frequency: 'per_audit' },
          { id: 'dis-3', name: 'Giá kệ sạch và đồng bộ', mode: 'point', maxScore: 8, passScore: 6, critical: false, frequency: 'weekly_once' },
        ],
      },
      {
        id: 'branding',
        name: 'Nhận diện thương hiệu',
        criteria: [
          { id: 'bra-1', name: 'POSM đúng chuẩn chiến dịch', mode: 'pass_fail', critical: false, frequency: 'per_audit' },
          { id: 'bra-2', name: 'Biển hiệu đúng guideline', mode: 'pass_fail', critical: true, frequency: 'per_audit' },
          { id: 'bra-3', name: 'Không có vật phẩm sai quy chuẩn', mode: 'pass_fail', critical: true, frequency: 'per_audit' },
        ],
      },
    ],
  },
]

export const QC_TEMPLATE_OPTIONS = QC_TEMPLATES.map((item) => ({
  id: item.id,
  name: item.name,
  version: item.version,
}))

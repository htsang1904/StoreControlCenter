'use strict';

const Strapi = require('@strapi/strapi');

async function seed() {
    const strapi = await Strapi().load();

    console.log('Seeding QC Forms and Criteria...');

    const forms = [
        { code: 'OPS', name: 'QC Vận hành (Operations)', description: 'Chất lượng vận hành, nhân sự và vệ sinh tổng thể.' },
        { code: 'FOOD', name: 'QC ATVSTP (Food Safety)', description: 'An toàn vệ sinh thực phẩm và bảo quản.' },
        { code: 'SVC', name: 'QC Dịch vụ (Service)', description: 'Thái độ phục vụ và quy trình dịch vụ.' },
        { code: 'MERCH', name: 'QC Trưng bày (Merchandising)', description: 'Trưng bày hàng hóa và POSM.' },
        { code: 'TECH', name: 'QC Kỹ thuật (Technical)', description: 'Hệ thống kỹ thuật, PCCC và bảo trì.' },
    ];

    for (const formData of forms) {
        let form = await strapi.db.query('api::qc-form.qc-form').findOne({ where: { code: formData.code } });
        if (!form) {
            form = await strapi.db.query('api::qc-form.qc-form').create({ data: { ...formData, is_active: true } });
            console.log(`Created Form: ${form.name}`);
        } else {
            console.log(`Form already exists: ${form.name}`);
        }

        // Create Version 1.0
        let version = await strapi.db.query('api::qc-form-version.qc-form-version').findOne({
            where: { form: form.id, version_no: '1.0' }
        });
        if (!version) {
            version = await strapi.db.query('api::qc-form-version.qc-form-version').create({
                data: {
                    form: form.id,
                    version_no: '1.0',
                    status: 'published',
                    effective_from: new Date().toISOString(),
                    pass_rule: { threshold: 80 }
                }
            });
            console.log(`Created Version 1.0 for ${form.name}`);
        } else {
            console.log(`Version 1.0 already exists for ${form.name}`);
        }

        // Define Criteria for this version
        const criteriaSet = getCriteriaForForm(formData.code);
        await seedCriteriaRecursive(strapi, version.id, criteriaSet);
    }

    console.log('Seeding completed successfully.');
    process.exit(0);
}

function getCriteriaForForm(code) {
    if (code === 'OPS') {
        return [
            {
                code: 'OPS-A', name: 'Nhân sự', level: 1, ordering: 'A',
                children: [
                    {
                        code: 'OPS-A1', name: 'Diện mạo & Đồng phục', level: 2, ordering: 'A.1',
                        children: [
                            { code: 'OPS-A1.1', name: 'Đeo thẻ tên đúng quy định', level: 3, ordering: 'A.1.1', mode: 'pass_fail' },
                            { code: 'OPS-A1.2', name: 'Đồng phục sạch sẽ, đúng mẫu', level: 3, ordering: 'A.1.2', mode: 'pass_fail' }
                        ]
                    },
                    {
                        code: 'OPS-A2', name: 'Tác phong làm việc', level: 2, ordering: 'A.2',
                        children: [
                            { code: 'OPS-A2.1', name: 'Tư thế đứng, chào hỏi khách', level: 3, ordering: 'A.2.1', mode: 'pass_fail' },
                            { code: 'OPS-A2.2', name: 'Không sử dụng điện thoại riêng', level: 3, ordering: 'A.2.2', mode: 'pass_fail' }
                        ]
                    }
                ]
            },
            {
                code: 'OPS-B', name: 'Vệ sinh chung', level: 1, ordering: 'B',
                children: [
                    {
                        code: 'OPS-B1', name: 'Khu vực bán hàng', level: 2, ordering: 'B.1',
                        children: [
                            { code: 'OPS-B1.1', name: 'Sàn nhà sạch, không rác rưởi', level: 3, ordering: 'B.1.1', mode: 'point', maxScore: 10 },
                            { code: 'OPS-B1.2', name: 'Cửa kính sạch, không dấu vân tay', level: 3, ordering: 'B.1.2', mode: 'point', maxScore: 5 }
                        ]
                    }
                ]
            }
        ];
    }

    if (code === 'FOOD') {
        return [
            {
                code: 'FOOD-A', name: 'Kiểm soát hàng hóa', level: 1, ordering: 'A',
                children: [
                    {
                        code: 'FOOD-A1', name: 'Hạn sử dụng', level: 2, ordering: 'A.1',
                        children: [
                            { code: 'FOOD-A1.1', name: 'Không có hàng quá hạn trên kệ', level: 3, ordering: 'A.1.1', mode: 'pass_fail' },
                            { code: 'FOOD-A1.2', name: 'Thực hiện đúng quy tắc FIFO', level: 3, ordering: 'A.1.2', mode: 'pass_fail' }
                        ]
                    }
                ]
            },
            {
                code: 'FOOD-B', name: 'Nhiệt độ & Bảo quản', level: 1, ordering: 'B',
                children: [
                    {
                        code: 'FOOD-B1', name: 'Tủ mát/Tủ đông', level: 2, ordering: 'B.1',
                        children: [
                            { code: 'FOOD-B1.1', name: 'Nhiệt độ tủ mát đạt chuẩn (2-8°C)', level: 3, ordering: 'B.1.1', mode: 'point', maxScore: 10 },
                            { code: 'FOOD-B1.2', name: 'Vệ sinh đệm cao su tủ', level: 3, ordering: 'B.1.2', mode: 'pass_fail' }
                        ]
                    }
                ]
            }
        ];
    }

    if (code === 'SVC') {
        return [
            {
                code: 'SVC-A', name: 'Quy trình phục vụ', level: 1, ordering: 'A',
                children: [
                    {
                        code: 'SVC-A1', name: 'Tiếp đón khách', level: 2, ordering: 'A.1',
                        children: [
                            { code: 'SVC-A1.1', name: 'Chào khách trong vòng 5 giây', level: 3, ordering: 'A.1.1', mode: 'pass_fail' },
                            { code: 'SVC-A1.2', name: 'Ánh mắt thân thiện, nụ cười', level: 3, ordering: 'A.1.2', mode: 'pass_fail' }
                        ]
                    }
                ]
            }
        ];
    }

    if (code === 'MERCH') {
        return [
            {
                code: 'MERCH-A', name: 'Sắp xếp hàng hóa', level: 1, ordering: 'A',
                children: [
                    {
                        code: 'MERCH-A1', name: 'Planogram', level: 2, ordering: 'A.1',
                        children: [
                            { code: 'MERCH-A1.1', name: 'Đúng sơ đồ trưng bày đã phê duyệt', level: 3, ordering: 'A.1.1', mode: 'point', maxScore: 10 }
                        ]
                    }
                ]
            }
        ];
    }

    if (code === 'TECH') {
        return [
            {
                code: 'TECH-A', name: 'An toàn & Bảo trì', level: 1, ordering: 'A',
                children: [
                    {
                        code: 'TECH-A1', name: 'Phòng cháy chữa cháy', level: 2, ordering: 'A.1',
                        children: [
                            { code: 'TECH-A1.1', name: 'Bình chữa cháy còn hạn, đúng vị trí', level: 3, ordering: 'A.1.1', mode: 'pass_fail' }
                        ]
                    }
                ]
            }
        ];
    }

    return [];
}

async function seedCriteriaRecursive(strapi, versionId, criteria, parentId = null) {
    for (const c of criteria) {
        let criterion = await strapi.db.query('api::qc-criterion.qc-criterion').findOne({ where: { code: c.code } });
        if (!criterion) {
            criterion = await strapi.db.query('api::qc-criterion.qc-criterion').create({
                data: {
                    code: c.code,
                    name: c.name,
                    level: c.level,
                    ordering: c.ordering,
                    default_mode: c.mode || 'point',
                    default_max_score: c.maxScore || 1,
                    parent: parentId,
                    is_active: true
                }
            });
            console.log(`Created Criterion: ${c.code} - ${c.name}`);
        }

        // Link to form version
        const existingLink = await strapi.db.query('api::qc-form-criterion.qc-form-criterion').findOne({
            where: { form_version: versionId, criterion: criterion.id }
        });
        if (!existingLink) {
            await strapi.db.query('api::qc-form-criterion.qc-form-criterion').create({
                data: {
                    form_version: versionId,
                    criterion: criterion.id,
                    mode: c.mode || 'point',
                    max_score: parseFloat(c.maxScore) || 1,
                    sort_order: 1
                }
            });
            console.log(`Linked ${c.code} to Version`);
        }

        if (c.children && c.children.length > 0) {
            await seedCriteriaRecursive(strapi, versionId, c.children, criterion.id);
        }
    }
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});

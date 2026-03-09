'use strict';

const { ForbiddenError } = require('@strapi/utils').errors;

module.exports = {
    async beforeCreate(event) {
        const { data } = event.params;

        if (!data.finding_code) {
            data.finding_code = await generateFindingCode(strapi);
        }
    },
};

async function generateFindingCode(strapi) {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yy}${mm}${dd}`; // YYMMDD

    // Find the last code for today
    const lastFinding = await strapi.entityService.findMany('api::qc-finding.qc-finding', {
        filters: {
            finding_code: {
                $startsWith: `F-${dateStr}-`,
            },
        },
        sort: { finding_code: 'desc' },
        limit: 1,
    });

    let nextIndex = 1;
    if (lastFinding && lastFinding.length > 0) {
        const lastCode = lastFinding[0].finding_code;
        const lastIndexStr = lastCode.split('-').pop();
        const lastIndex = parseInt(lastIndexStr, 10);
        if (!isNaN(lastIndex)) {
            nextIndex = lastIndex + 1;
        }
    }

    const paddedIndex = String(nextIndex).padStart(3, '0');
    return `F-${dateStr}-${paddedIndex}`;
}

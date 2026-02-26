'use strict';

/**
 * department controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

const successResponse = (message, data = {}) => ({
  success: true,
  message,
  data,
});

module.exports = createCoreController('api::department.department', ({ strapi }) => ({
  async listActive(_ctx) {
    const departments = await strapi.entityService.findMany('api::department.department', {
      filters: { is_active: true },
      fields: ['id', 'name', 'code'],
      sort: { name: 'asc' },
    });

    return successResponse('Lấy danh sách bộ phận thành công', {
      departments,
    });
  },
}));

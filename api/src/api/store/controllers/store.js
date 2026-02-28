'use strict';

/**
 * store controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

const successResponse = (message, data = {}) => ({
  success: true,
  message,
  data,
});

const errorResponse = (ctx, status, message) => {
  ctx.status = status;
  return {
    success: false,
    message,
  };
};

module.exports = createCoreController('api::store.store', ({ strapi }) => ({
  async syncStores(ctx) {
    try {
      const result = await strapi.service('api::store.store').syncStores();
      return successResponse('Đồng bộ cửa hàng thành công', result);
    } catch (error) {
      strapi.log.error('Sync stores failed', error);
      return errorResponse(ctx, 500, 'Đồng bộ cửa hàng thất bại');
    }
  },
}));

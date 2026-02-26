'use strict';

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

module.exports = createCoreController('api::ticket-log.ticket-log', ({ strapi }) => ({
  async createLog(ctx) {
    const payload = ctx.request.body || {};
    const user = ctx.state.userDetail;

    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Không xác định được người gửi');
    }

    if (!payload.ticket_id || !payload.message) {
      return errorResponse(ctx, 400, 'Thiếu thông tin bắt buộc: ticket_id, message');
    }

    const ticketId = Number(payload.ticket_id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return errorResponse(ctx, 400, 'ticket_id không hợp lệ');
    }

    const ticket = await strapi.entityService.findOne('api::ticket.ticket', ticketId, {
      fields: ['id'],
    });

    if (!ticket) {
      return errorResponse(ctx, 404, 'Không tìm thấy phiếu');
    }

    const senderType = ['store', 'handler', 'system'].includes(payload.sender_type)
      ? payload.sender_type
      : 'store';

    const createdLog = await strapi.entityService.create('api::ticket-log.ticket-log', {
      data: {
        message: String(payload.message).trim(),
        attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
        sender_type: senderType,
        ticket: ticket.id,
        sender: user.id,
      },
      populate: {
        sender: {
          fields: ['id', 'name', 'email'],
        },
      },
    });

    return successResponse('Gửi trao đổi thành công', {
      log: createdLog,
    });
  },

  async listByTicket(ctx) {
    const ticketId = Number(ctx.params.ticketId);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return errorResponse(ctx, 400, 'ticketId không hợp lệ');
    }

    const ticket = await strapi.entityService.findOne('api::ticket.ticket', ticketId, {
      fields: ['id'],
    });
    if (!ticket) {
      return errorResponse(ctx, 404, 'Không tìm thấy phiếu');
    }

    const logs = await strapi.entityService.findMany('api::ticket-log.ticket-log', {
      filters: { ticket: { id: ticketId } },
      sort: { createdAt: 'asc' },
      populate: {
        sender: {
          fields: ['id', 'name', 'email'],
        },
      },
    });

    return successResponse('Lấy danh sách trao đổi thành công', {
      logs,
    });
  },
}));

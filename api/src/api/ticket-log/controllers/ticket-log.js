'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { createNotifications, loadTicketAudience } = require('../../../utils/notification');
const {
  canReplyOnTicket,
  canViewTicket,
  getRole,
} = require('../../../utils/ticket-permissions');

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
    const normalizedMessage = String(payload.message || '').trim();

    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Không xác định được người gửi');
    }

    if (!payload.ticket_id || !normalizedMessage) {
      return errorResponse(ctx, 400, 'Thiếu thông tin bắt buộc: ticket_id, message');
    }

    const ticketId = Number(payload.ticket_id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return errorResponse(ctx, 400, 'ticket_id không hợp lệ');
    }

    const ticket = await strapi.entityService.findOne('api::ticket.ticket', ticketId, {
      fields: ['id', 'store_id', 'requester_id', 'ticket_code', 'status', 'handler_id'],
      populate: {
        requester: { fields: ['id'] },
        assignees: { fields: ['id'] },
        handler: { fields: ['id'] },
        responsible_department: { fields: ['id'] },
      },
    });

    if (!ticket) {
      return errorResponse(ctx, 404, 'Không tìm thấy phiếu');
    }
    if (!canViewTicket(user, ticket)) {
      return errorResponse(ctx, 403, 'Bạn không có quyền trao đổi trên phiếu này');
    }
    if (!canReplyOnTicket(user, ticket)) {
      return errorResponse(ctx, 403, 'Bạn chưa có quyền phản hồi ticket này');
    }

    const senderType = getRole(user) === 'handler' || getRole(user) === 'admin' ? 'handler' : 'store';

    const createdLog = await strapi.entityService.create('api::ticket-log.ticket-log', {
      data: {
        message: normalizedMessage,
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
    try {
      const audience = await loadTicketAudience(strapi, ticket.id);
      await createNotifications(strapi, {
        recipientIds: audience?.recipientIds || [],
        title: `Phản hồi mới ${ticket.ticket_code || `#${ticket.id}`}`,
        message: `${user.name || 'Người dùng'} vừa phản hồi ticket ${ticket.ticket_code || `#${ticket.id}`}`,
        type: 'info',
        ticketId: ticket.id,
        actorId: user.id,
        excludeUserIds: [user.id],
        meta: {
          event: 'ticket_log_created',
          log_id: createdLog.id,
        },
      });
    } catch (notifyError) {
      strapi.log.warn('Create notification from ticket log failed', {
        ticketId: ticket.id,
        logId: createdLog.id,
        error: notifyError?.message || notifyError,
      });
    }

    return successResponse('Gửi trao đổi thành công', {
      log: createdLog,
    });
  },

  async listByTicket(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const ticketId = Number(ctx.params.ticketId);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return errorResponse(ctx, 400, 'ticketId không hợp lệ');
    }

    const ticket = await strapi.entityService.findOne('api::ticket.ticket', ticketId, {
      fields: ['id', 'store_id', 'requester_id', 'handler_id'],
      populate: {
        requester: { fields: ['id'] },
        assignees: { fields: ['id'] },
        handler: { fields: ['id'] },
        responsible_department: { fields: ['id'] },
      },
    });
    if (!ticket) {
      return errorResponse(ctx, 404, 'Không tìm thấy phiếu');
    }
    if (!canViewTicket(user, ticket)) {
      return errorResponse(ctx, 403, 'Bạn không có quyền xem trao đổi của phiếu này');
    }

    const includeSystem = String(ctx.query?.include_system || '').toLowerCase() === 'true';
    const filters = includeSystem
      ? { ticket: { id: ticketId } }
      : {
        ticket: { id: ticketId },
        sender_type: { $in: ['store', 'handler'] },
      };

    const logs = await strapi.entityService.findMany('api::ticket-log.ticket-log', {
      filters,
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

'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { createNotifications, loadTicketAudience } = require('../../../utils/notification');

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

const getRole = (user) => String(user?.role || '').toLowerCase();
const getRequesterId = (ticket) => Number(ticket?.requester?.id || ticket?.requester_id || 0);
const getTicketStoreId = (ticket) => Number(ticket?.store_id || 0);
const getTicketDepartmentId = (ticket) => Number(ticket?.responsible_department?.id || ticket?.responsible_department || 0);
const getUserDepartmentId = (user) => Number(user?.department?.id || user?.department_id || 0);
const getTicketAssigneeIds = (ticket) => (
  Array.isArray(ticket?.assignees)
    ? ticket.assignees
      .map((item) => Number(item?.id || item))
      .filter((item) => Number.isInteger(item) && item > 0)
    : []
);
const getUserStoreIds = (user) => (
  Array.isArray(user?.store_ids)
    ? user.store_ids
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0)
    : []
);

const canViewTicket = (user, ticket) => {
  if (!user || !ticket) return false;

  const role = getRole(user);
  if (role === 'admin' || role === 'qc') return true;
  if (role === 'handler') {
    const handlerDepartmentId = getUserDepartmentId(user);
    const ticketDepartmentId = getTicketDepartmentId(ticket);
    const isAssignee = getTicketAssigneeIds(ticket).includes(Number(user.id));
    if (isAssignee) return true;
    return handlerDepartmentId > 0 && ticketDepartmentId > 0 && handlerDepartmentId === ticketDepartmentId;
  }

  if (getRequesterId(ticket) === Number(user.id)) return true;

  const ticketStoreId = getTicketStoreId(ticket);
  if (!Number.isInteger(ticketStoreId) || ticketStoreId <= 0) return false;
  return getUserStoreIds(user).includes(ticketStoreId);
};

const canReplyOnTicket = (user, ticket) => {
  if (!user || !ticket) return false;

  const role = getRole(user);
  if (role === 'admin') return true;
  if (role === 'handler') {
    const isOpenStatus = ['new', 'assigned', 'in_progress'].includes(String(ticket?.status || '').toLowerCase());
    const isAssignee = getTicketAssigneeIds(ticket).includes(Number(user.id));
    return isOpenStatus && isAssignee;
  }
  if (role === 'store') {
    return getRequesterId(ticket) === Number(user.id);
  }
  return false;
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
      fields: ['id', 'store_id', 'requester_id', 'ticket_code', 'status'],
      populate: {
        requester: { fields: ['id'] },
        assignees: { fields: ['id'] },
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

    const senderType = ['store', 'handler'].includes(payload.sender_type)
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
      fields: ['id', 'store_id', 'requester_id'],
      populate: {
        requester: { fields: ['id'] },
        assignees: { fields: ['id'] },
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

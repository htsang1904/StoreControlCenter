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

const getTicketAssigneeIds = (ticket) => (
  Array.isArray(ticket?.assignees)
    ? ticket.assignees
      .map((item) => Number(item?.id || item))
      .filter((item) => Number.isInteger(item) && item > 0)
    : []
);

const parseDateBoundary = (value, mode) => {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;

  const date = mode === 'end'
    ? new Date(`${normalized}T23:59:59.999Z`)
    : new Date(`${normalized}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const createSystemTicketLog = async (strapi, { ticketId, senderId, message }) => {
  if (!ticketId || !senderId || !message) return;

  try {
    await strapi.entityService.create('api::ticket-log.ticket-log', {
      data: {
        message: String(message).trim(),
        attachments: [],
        sender_type: 'system',
        ticket: Number(ticketId),
        sender: Number(senderId),
      },
    });
  } catch (error) {
    strapi.log.warn('Create QC system ticket log failed', {
      ticketId,
      senderId,
      message,
      error: error?.message || error,
    });
  }
};

const notifyTicketAudience = async (
  strapi,
  { ticketId, actorId, title, message, type = 'info', excludeUserIds = [], meta = null }
) => {
  try {
    const audience = await loadTicketAudience(strapi, ticketId);
    if (!audience?.ticket || !Array.isArray(audience?.recipientIds) || !audience.recipientIds.length) {
      return;
    }

    await createNotifications(strapi, {
      recipientIds: audience.recipientIds,
      title,
      message,
      type,
      ticketId: Number(ticketId),
      actorId: Number(actorId) || null,
      excludeUserIds,
      meta,
    });
  } catch (error) {
    strapi.log.warn('Notify QC audience failed', {
      ticketId,
      actorId,
      error: error?.message || error,
    });
  }
};

const reviewPopulate = {
  reviewer: {
    fields: ['id', 'name', 'email', 'role'],
  },
  ticket: {
    fields: ['id', 'ticket_code', 'title', 'status', 'store_id', 'type'],
  },
};

const ticketPopulate = {
  store: {
    fields: ['id', 'storeId', 'code', 'address', 'shortAddress'],
  },
  requester: {
    fields: ['id', 'name', 'email', 'role'],
  },
  assignees: {
    fields: ['id', 'name', 'email', 'role'],
  },
  responsible_department: {
    fields: ['id', 'name', 'code'],
  },
};

module.exports = createCoreController('api::ticket-qc-review.ticket-qc-review', ({ strapi }) => ({
  async listQCTickets(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const query = ctx.query || {};
    const storeId = Number(query.store_id);
    if (!Number.isInteger(storeId) || storeId <= 0) {
      return errorResponse(ctx, 400, 'store_id không hợp lệ');
    }

    const page = Math.max(Number(query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 10, 1), 100);
    const start = (page - 1) * pageSize;

    const filters = {
      store_id: storeId,
      status: 'resolved',
    };

    if (query.type !== undefined && query.type !== null && String(query.type).trim()) {
      filters.type = String(query.type).trim();
    }

    if (query.department_id !== undefined && query.department_id !== null && String(query.department_id).trim() !== '') {
      const departmentId = Number(query.department_id);
      if (!Number.isInteger(departmentId) || departmentId <= 0) {
        return errorResponse(ctx, 400, 'department_id không hợp lệ');
      }
      filters.responsible_department = { id: departmentId };
    }

    if (query.handler_id !== undefined && query.handler_id !== null && String(query.handler_id).trim() !== '') {
      const handlerId = Number(query.handler_id);
      if (!Number.isInteger(handlerId) || handlerId <= 0) {
        return errorResponse(ctx, 400, 'handler_id không hợp lệ');
      }
      filters.assignees = { id: handlerId };
    }

    const dateFromIso = parseDateBoundary(query.date_from, 'start');
    const dateToIso = parseDateBoundary(query.date_to, 'end');
    if ((query.date_from && !dateFromIso) || (query.date_to && !dateToIso)) {
      return errorResponse(ctx, 400, 'Khoảng ngày không hợp lệ');
    }
    if (dateFromIso || dateToIso) {
      filters.updatedAt = {};
      if (dateFromIso) filters.updatedAt.$gte = dateFromIso;
      if (dateToIso) filters.updatedAt.$lte = dateToIso;
    }

    const [tickets, total] = await Promise.all([
      strapi.entityService.findMany('api::ticket.ticket', {
        filters,
        sort: { updatedAt: 'desc' },
        start,
        limit: pageSize,
        populate: ticketPopulate,
      }),
      strapi.db.query('api::ticket.ticket').count({ where: filters }),
    ]);

    const ticketList = Array.isArray(tickets) ? tickets : [];
    const ticketIds = ticketList.map((item) => Number(item?.id)).filter((id) => Number.isInteger(id) && id > 0);

    let latestReviewByTicketId = new Map();
    if (ticketIds.length) {
      const reviews = await strapi.entityService.findMany('api::ticket-qc-review.ticket-qc-review', {
        filters: {
          ticket: {
            id: { $in: ticketIds },
          },
        },
        sort: { createdAt: 'desc' },
        populate: reviewPopulate,
        start: 0,
        limit: ticketIds.length * 5,
      });

      latestReviewByTicketId = (Array.isArray(reviews) ? reviews : []).reduce((map, review) => {
        const key = Number(review?.ticket?.id || 0);
        if (!Number.isInteger(key) || key <= 0 || map.has(key)) return map;
        map.set(key, review);
        return map;
      }, new Map());
    }

    const rows = ticketList.map((ticket) => {
      const latestReview = latestReviewByTicketId.get(Number(ticket.id)) || null;
      const qcState = !latestReview
        ? 'pending'
        : (latestReview.decision === 'pass' ? 'passed' : 'failed');

      return {
        ...ticket,
        qc: {
          state: qcState,
          latest_review: latestReview,
        },
      };
    });

    return successResponse('Lấy danh sách ticket QC thành công', {
      filters: {
        store_id: storeId,
        type: query.type ? String(query.type).trim() : null,
        department_id: query.department_id ? Number(query.department_id) : null,
        handler_id: query.handler_id ? Number(query.handler_id) : null,
        date_from: query.date_from || null,
        date_to: query.date_to || null,
      },
      tickets: rows,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    });
  },

  async submitReview(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const ticketId = Number(ctx.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return errorResponse(ctx, 400, 'id ticket không hợp lệ');
    }

    const payload = ctx.request.body || {};
    const decision = String(payload.decision || '').trim().toLowerCase();
    if (decision !== 'pass' && decision !== 'fail') {
      return errorResponse(ctx, 400, 'decision phải là pass hoặc fail');
    }

    const comment = String(payload.comment || '').trim();
    if (decision === 'fail' && !comment) {
      return errorResponse(ctx, 400, 'Vui lòng nhập nhận xét khi đánh giá fail');
    }

    let checklist = null;
    if (payload.checklist !== undefined) {
      const validChecklist = typeof payload.checklist === 'object' && payload.checklist !== null;
      if (!validChecklist) {
        return errorResponse(ctx, 400, 'checklist phải là object hoặc array');
      }
      checklist = payload.checklist;
    }

    const ticket = await strapi.entityService.findOne('api::ticket.ticket', ticketId, {
      fields: ['id', 'ticket_code', 'title', 'status', 'store_id', 'type'],
      populate: {
        assignees: { fields: ['id', 'name'] },
      },
    });

    if (!ticket) {
      return errorResponse(ctx, 404, 'Không tìm thấy ticket');
    }

    if (String(ticket.status || '').toLowerCase() !== 'resolved') {
      return errorResponse(ctx, 400, 'Chỉ đánh giá QC cho ticket đã xử lý');
    }

    const createdReview = await strapi.entityService.create('api::ticket-qc-review.ticket-qc-review', {
      data: {
        decision,
        comment: comment || null,
        checklist,
        meta: {
          event: 'qc_review_submitted',
        },
        store_id: Number(ticket.store_id),
        ticket_type: ticket.type ? String(ticket.type).trim() : null,
        ticket: ticket.id,
        reviewer: user.id,
      },
      populate: reviewPopulate,
    });

    let updatedTicket = ticket;
    if (decision === 'fail') {
      const assigneeIds = getTicketAssigneeIds(ticket);
      const nextStatus = assigneeIds.length ? 'in_progress' : 'new';

      updatedTicket = await strapi.entityService.update('api::ticket.ticket', ticket.id, {
        data: {
          status: nextStatus,
        },
        populate: ticketPopulate,
      });

      await createSystemTicketLog(strapi, {
        ticketId: updatedTicket.id,
        senderId: user.id,
        message: `QC đánh giá chưa đạt ticket ${updatedTicket.ticket_code || `#${updatedTicket.id}`}. Ticket được mở lại để xử lý tiếp.`,
      });

      await notifyTicketAudience(strapi, {
        ticketId: updatedTicket.id,
        actorId: user.id,
        title: `QC chưa đạt ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
        message: `${user.name || 'QC'} đã đánh giá ticket chưa đạt và yêu cầu xử lý lại.`,
        type: 'warning',
        excludeUserIds: [user.id],
        meta: {
          event: 'qc_review_failed',
          review_id: createdReview.id,
        },
      });
    } else {
      await createSystemTicketLog(strapi, {
        ticketId: ticket.id,
        senderId: user.id,
        message: `QC đánh giá đạt ticket ${ticket.ticket_code || `#${ticket.id}`}.`,
      });

      await notifyTicketAudience(strapi, {
        ticketId: ticket.id,
        actorId: user.id,
        title: `QC đạt ${ticket.ticket_code || `#${ticket.id}`}`,
        message: `${user.name || 'QC'} đã xác nhận ticket đạt chất lượng xử lý.`,
        type: 'success',
        excludeUserIds: [user.id],
        meta: {
          event: 'qc_review_passed',
          review_id: createdReview.id,
        },
      });
    }

    return successResponse('Đánh giá QC thành công', {
      review: createdReview,
      ticket: updatedTicket,
    });
  },

  async listTicketReviews(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const ticketId = Number(ctx.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return errorResponse(ctx, 400, 'id ticket không hợp lệ');
    }

    const ticket = await strapi.entityService.findOne('api::ticket.ticket', ticketId, {
      fields: ['id', 'ticket_code', 'title', 'status', 'store_id', 'type'],
    });
    if (!ticket) {
      return errorResponse(ctx, 404, 'Không tìm thấy ticket');
    }

    const page = Math.max(Number(ctx.query?.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(ctx.query?.pageSize) || 10, 1), 100);
    const start = (page - 1) * pageSize;

    const reviewFilters = {
      ticket: {
        id: ticket.id,
      },
    };

    const [reviews, total] = await Promise.all([
      strapi.entityService.findMany('api::ticket-qc-review.ticket-qc-review', {
        filters: reviewFilters,
        sort: { createdAt: 'desc' },
        start,
        limit: pageSize,
        populate: reviewPopulate,
      }),
      strapi.db.query('api::ticket-qc-review.ticket-qc-review').count({
        where: reviewFilters,
      }),
    ]);

    return successResponse('Lấy lịch sử QC thành công', {
      ticket,
      reviews: Array.isArray(reviews) ? reviews : [],
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    });
  },
}));

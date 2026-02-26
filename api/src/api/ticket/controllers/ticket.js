'use strict';

const crypto = require('crypto');
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

const generateTicketCode = async (strapi) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const timePart = Date.now().toString(36).toUpperCase().slice(-6);
    const randomPart = crypto.randomInt(36 ** 2).toString(36).toUpperCase().padStart(2, '0');
    const ticketCode = `TK-${timePart}${randomPart}`;

    const existedTicket = await strapi.entityService.findMany('api::ticket.ticket', {
      filters: { ticket_code: ticketCode },
      fields: ['id'],
      limit: 1,
    });

    if (!existedTicket.length) {
      return ticketCode;
    }
  }

  throw new Error('TICKET_CODE_GENERATION_FAILED');
};

module.exports = createCoreController('api::ticket.ticket', ({ strapi }) => ({
  async createTicket(ctx) {
    const payload = ctx.request.body || {};

    if (!payload.title || !payload.description || !payload.store_id || !payload.responsible_department_id) {
      return errorResponse(
        ctx,
        400,
        'Thiếu thông tin bắt buộc: title, description, store_id, responsible_department_id'
      );
    }

    const storeId = Number(payload.store_id);
    if (!Number.isInteger(storeId) || storeId <= 0) {
      return errorResponse(ctx, 400, 'store_id không hợp lệ');
    }

    const responsibleDepartmentId = Number(payload.responsible_department_id);
    if (!Number.isInteger(responsibleDepartmentId) || responsibleDepartmentId <= 0) {
      return errorResponse(ctx, 400, 'responsible_department_id không hợp lệ');
    }

    const responsibleDepartment = await strapi.entityService.findOne(
      'api::department.department',
      responsibleDepartmentId,
      {
        fields: ['id', 'name', 'code', 'is_active'],
      }
    );

    if (!responsibleDepartment || responsibleDepartment.is_active === false) {
      return errorResponse(ctx, 400, 'Bộ phận xử lý không tồn tại hoặc đã bị vô hiệu hóa');
    }

    const requester = ctx.state.userDetail;
    if (!requester || !requester.id) {
      return errorResponse(ctx, 401, 'Không xác định được người tạo phiếu');
    }

    try {
      const ticketCode = await generateTicketCode(strapi);

      const createdTicket = await strapi.entityService.create('api::ticket.ticket', {
        data: {
          ticket_code: ticketCode,
          title: String(payload.title).trim(),
          description: String(payload.description).trim(),
          status: 'new',
          requester_id: requester.id,
          store_id: storeId,
          handler_id: payload.handler_id ? Number(payload.handler_id) : null,
          responsible_department: responsibleDepartment.id,
          ticket_category_id: payload.ticket_category_id ? Number(payload.ticket_category_id) : null,
          type: payload.type ? String(payload.type).trim() : null,
          start_date: new Date().toISOString(),
          end_date: payload.end_date || null,
          attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
        },
        populate: {
          responsible_department: {
            fields: ['id', 'name', 'code'],
          },
        },
      });

      return successResponse('Tạo phiếu thành công', {
        ticket: createdTicket,
      });
    } catch (error) {
      strapi.log.error('Create ticket failed', error);
      return errorResponse(ctx, 500, 'Tạo phiếu thất bại');
    }
  },

  async listTickets(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const query = ctx.query || {};
    const page = Math.max(Number(query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 10, 1), 100);
    const start = (page - 1) * pageSize;

    const filters = {};

    if (query.status) {
      const statuses = String(query.status)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      if (statuses.length === 1) {
        filters.status = statuses[0];
      } else if (statuses.length > 1) {
        filters.status = { $in: statuses };
      }
    }

    if (query.store_id) {
      const storeId = Number(query.store_id);
      if (!Number.isInteger(storeId) || storeId <= 0) {
        return errorResponse(ctx, 400, 'store_id không hợp lệ');
      }
      filters.store_id = storeId;
    }

    if (query.q) {
      const keyword = String(query.q).trim();
      if (keyword) {
        filters.$or = [{ title: { $containsi: keyword } }, { ticket_code: { $containsi: keyword } }];
      }
    }

    if (user.role === 'store') {
      filters.requester_id = user.id;
    }

    const [tickets, total] = await Promise.all([
      strapi.entityService.findMany('api::ticket.ticket', {
        filters,
        sort: { createdAt: 'desc' },
        start,
        limit: pageSize,
        populate: {
          responsible_department: {
            fields: ['id', 'name', 'code'],
          },
        },
      }),
      strapi.db.query('api::ticket.ticket').count({
        where: filters,
      }),
    ]);

    return successResponse('Lấy danh sách phiếu thành công', {
      tickets,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    });
  },

  async deleteTicket(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const ticketId = Number(ctx.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return errorResponse(ctx, 400, 'id ticket không hợp lệ');
    }

    const ticket = await strapi.entityService.findOne('api::ticket.ticket', ticketId, {
      fields: ['id', 'requester_id', 'status', 'handler_id'],
    });

    if (!ticket) {
      return errorResponse(ctx, 404, 'Không tìm thấy phiếu');
    }

    if (ticket.requester_id !== user.id) {
      return errorResponse(ctx, 403, 'Bạn không có quyền xóa phiếu này');
    }

    const isAcceptedByDepartment = ticket.status !== 'new' || Number(ticket.handler_id) > 0;
    if (isAcceptedByDepartment) {
      return errorResponse(ctx, 400, 'Phiếu đã được bộ phận phụ trách tiếp nhận, không thể xóa');
    }

    try {
      const logs = await strapi.entityService.findMany('api::ticket-log.ticket-log', {
        filters: { ticket: { id: ticket.id } },
        fields: ['id'],
      });

      await Promise.all(
        logs.map((log) => strapi.entityService.delete('api::ticket-log.ticket-log', log.id))
      );

      await strapi.entityService.delete('api::ticket.ticket', ticket.id);

      return successResponse('Xóa phiếu thành công');
    } catch (error) {
      strapi.log.error('Delete ticket failed', error);
      return errorResponse(ctx, 500, 'Xóa phiếu thất bại');
    }
  },
}));

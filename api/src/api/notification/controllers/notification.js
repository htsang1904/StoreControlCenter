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

const notificationPopulate = {
  ticket: {
    fields: ['id', 'ticket_code', 'title', 'status'],
  },
  actor: {
    fields: ['id', 'name', 'email', 'role'],
  },
};

const toUnreadOnly = (value) => {
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  return false;
};

module.exports = createCoreController('api::notification.notification', ({ strapi }) => ({
  async listMine(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const query = ctx.query || {};
    const page = Math.max(Number(query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 12, 1), 50);
    const start = (page - 1) * pageSize;
    const unreadOnly = toUnreadOnly(query.unread_only);

    const filters = {
      recipient: {
        id: Number(user.id),
      },
    };
    if (unreadOnly) {
      filters.is_read = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      strapi.entityService.findMany('api::notification.notification', {
        filters,
        sort: { createdAt: 'desc' },
        populate: notificationPopulate,
        start,
        limit: pageSize,
      }),
      strapi.db.query('api::notification.notification').count({
        where: filters,
      }),
      strapi.db.query('api::notification.notification').count({
        where: {
          recipient: {
            id: Number(user.id),
          },
          is_read: false,
        },
      }),
    ]);

    return successResponse('Lấy thông báo thành công', {
      notifications: Array.isArray(notifications) ? notifications : [],
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
      unread_count: Number(unreadCount || 0),
    });
  },

  async markRead(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const notificationId = Number(ctx.params.id);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return errorResponse(ctx, 400, 'id thông báo không hợp lệ');
    }

    const notification = await strapi.entityService.findOne('api::notification.notification', notificationId, {
      populate: {
        recipient: { fields: ['id'] },
      },
    });

    if (!notification) {
      return errorResponse(ctx, 404, 'Không tìm thấy thông báo');
    }

    if (Number(notification?.recipient?.id || 0) !== Number(user.id)) {
      return errorResponse(ctx, 403, 'Bạn không có quyền cập nhật thông báo này');
    }

    const updated = notification.is_read
      ? notification
      : await strapi.entityService.update('api::notification.notification', notification.id, {
        data: {
          is_read: true,
          read_at: new Date().toISOString(),
        },
        populate: notificationPopulate,
      });

    const unreadCount = await strapi.db.query('api::notification.notification').count({
      where: {
        recipient: {
          id: Number(user.id),
        },
        is_read: false,
      },
    });

    return successResponse('Đã cập nhật trạng thái thông báo', {
      notification: updated,
      unread_count: Number(unreadCount || 0),
    });
  },

  async markAllRead(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    await strapi.db.query('api::notification.notification').updateMany({
      where: {
        recipient: {
          id: Number(user.id),
        },
        is_read: false,
      },
      data: {
        is_read: true,
        read_at: new Date().toISOString(),
      },
    });

    return successResponse('Đã đánh dấu tất cả thông báo là đã đọc', {
      unread_count: 0,
    });
  },
}));

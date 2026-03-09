'use strict';

const crypto = require('crypto');
const { createCoreController } = require('@strapi/strapi').factories;
const { createNotifications, loadTicketAudience } = require('../../../utils/notification');
const {
  canManageAssignees,
  canManageTicket,
  canViewTicket,
  getHandlerId,
  getRequesterId,
  getRole,
  getTicketAssigneeIds,
  getTicketDepartmentId,
  getUserDepartmentId,
  getUserStoreIds,
  isAdmin,
} = require('../../../utils/ticket-permissions');
const MAX_UPLOAD_FILES_PER_REQUEST = 5;
const MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const DASHBOARD_TICKET_BATCH_SIZE = 1000;
const UNCONFIRMED_TICKET_ALERT_MINUTES = 2 * 60;
const CONFIRMED_TICKET_ALERT_MINUTES = 24 * 60;

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
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const suffix = crypto.randomInt(36 ** 2).toString(36).toUpperCase().padStart(2, '0');
    const ticketCode = `TK${yy}${MM}${dd}-${HH}${mm}${ss}-${suffix}`;

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

const ticketPopulate = {
  store: {
    fields: ['id', 'storeId', 'code', 'address', 'shortAddress'],
  },
  requester: {
    fields: ['id', 'name', 'email', 'role'],
  },
  handler: {
    fields: ['id', 'name', 'email', 'role'],
  },
  assignees: {
    fields: ['id', 'name', 'email', 'role'],
  },
  responsible_department: {
    fields: ['id', 'name', 'code'],
  },
  attachments_media: {
    fields: ['id', 'name', 'url', 'mime', 'size', 'ext', 'formats'],
  },
};

const normalizeAttachmentFileIds = (rawValue) => {
  if (rawValue === undefined) return null;
  if (!Array.isArray(rawValue)) return null;

  const normalized = [...new Set(rawValue.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0))];
  return normalized;
};

const normalizeAssigneeIds = (rawValue) => {
  if (rawValue === undefined) return null;
  if (!Array.isArray(rawValue)) return null;

  const normalized = [
    ...new Set(
      rawValue
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    ),
  ];
  return normalized;
};

const extractUploadFiles = (filesInput) => {
  if (!filesInput) return [];

  if (Array.isArray(filesInput)) {
    return filesInput.filter(Boolean);
  }

  if (filesInput.files) {
    const nested = Array.isArray(filesInput.files) ? filesInput.files : [filesInput.files];
    return nested.filter(Boolean);
  }

  return Object.values(filesInput)
    .flatMap((item) => (Array.isArray(item) ? item : [item]))
    .filter(Boolean);
};

const findStoreByBusinessId = async (strapi, storeId) => {
  const stores = await strapi.entityService.findMany('api::store.store', {
    filters: {
      storeId: String(storeId),
    },
    fields: ['id', 'storeId', 'code', 'address', 'shortAddress'],
    publicationState: 'preview',
    limit: 1,
  });

  return stores?.[0] || null;
};

const hydrateTicketUsers = async (strapi, ticketsInput) => {
  const tickets = Array.isArray(ticketsInput) ? ticketsInput : [ticketsInput];
  const missingUserIds = new Set();

  tickets.forEach((ticket) => {
    const requesterId = Number(ticket?.requester_id || 0);
    const handlerId = Number(ticket?.handler_id || 0);

    if (!ticket?.requester?.id && requesterId > 0) {
      missingUserIds.add(requesterId);
    }
    if (!ticket?.handler?.id && handlerId > 0) {
      missingUserIds.add(handlerId);
    }
  });

  if (!missingUserIds.size) {
    return decorateTicketProcessingMetrics(ticketsInput);
  }

  const users = await strapi.entityService.findMany('api::user-info.user-info', {
    filters: { id: { $in: Array.from(missingUserIds) } },
    fields: ['id', 'name', 'email', 'role'],
    limit: missingUserIds.size,
  });

  const userMap = new Map((users || []).map((user) => [Number(user.id), user]));

  const hydrated = tickets.map((ticket) => {
    const requesterId = Number(ticket?.requester_id || 0);
    const handlerId = Number(ticket?.handler_id || 0);

    return {
      ...ticket,
      requester: ticket?.requester?.id ? ticket.requester : (userMap.get(requesterId) || null),
      handler: ticket?.handler?.id ? ticket.handler : (userMap.get(handlerId) || null),
    };
  });

  return decorateTicketProcessingMetrics(Array.isArray(ticketsInput) ? hydrated : hydrated[0]);
};

const toIsoDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
};

const normalizeEndDateInput = (value) => {
  if (value === undefined) {
    return {
      hasValue: false,
      value: null,
    };
  }

  if (!value) {
    return {
      hasValue: true,
      value: null,
    };
  }

  const endDate = new Date(value);
  if (Number.isNaN(endDate.getTime())) {
    return {
      hasValue: true,
      error: 'end_date không hợp lệ',
    };
  }

  return {
    hasValue: true,
    value: endDate.toISOString(),
  };
};

const normalizeDateRange = (query = {}) => {
  const todayDate = new Date();
  const defaultTo = toIsoDate(todayDate);
  const defaultFromDate = new Date(todayDate);
  defaultFromDate.setDate(defaultFromDate.getDate() - 6);
  const defaultFrom = toIsoDate(defaultFromDate);

  const dateFrom = String(query.date_from || defaultFrom);
  const dateTo = String(query.date_to || defaultTo);

  const fromDate = new Date(`${dateFrom}T00:00:00.000Z`);
  const toDate = new Date(`${dateTo}T23:59:59.999Z`);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return null;
  }
  if (fromDate.getTime() > toDate.getTime()) {
    return null;
  }

  return {
    dateFrom,
    dateTo,
    fromIso: fromDate.toISOString(),
    toIso: toDate.toISOString(),
  };
};

const buildDashboardTicketFilters = (user, query = {}) => {
  const filters = {};

  const range = normalizeDateRange(query);
  if (!range) return { error: 'Khoảng thời gian không hợp lệ' };
  filters.createdAt = {
    $gte: range.fromIso,
    $lte: range.toIso,
  };

  if (query.store_id !== undefined && query.store_id !== null && query.store_id !== '') {
    const storeId = Number(query.store_id);
    if (!Number.isInteger(storeId) || storeId <= 0) {
      return { error: 'store_id không hợp lệ' };
    }
    filters.store_id = storeId;
  }

  if (query.department_id !== undefined && query.department_id !== null && query.department_id !== '') {
    const departmentId = Number(query.department_id);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      return { error: 'department_id không hợp lệ' };
    }
    filters.responsible_department = { id: departmentId };
  }

  if (user.role === 'store') {
    const scopedOrFilters = [{ requester: { id: user.id } }, { requester_id: user.id }];
    const scopedStoreIds = getUserStoreIds(user);
    if (scopedStoreIds.length) {
      scopedOrFilters.push({ store_id: { $in: scopedStoreIds } });
    }

    return {
      filters: {
        $and: [
          filters,
          {
            $or: scopedOrFilters,
          },
        ],
      },
      range,
    };
  }

  if (user.role === 'handler') {
    const departmentId = getUserDepartmentId(user);
    const visibilityOr = departmentId > 0
      ? [
        { responsible_department: { id: departmentId } },
        { assignees: { id: user.id } },
      ]
      : [{ assignees: { id: user.id } }];

    return {
      filters: {
        $and: [
          filters,
          {
            $or: visibilityOr,
          },
        ],
      },
      range,
    };
  }

  return { filters, range };
};

const normalizeDashboardStatus = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'assigned') return 'in_progress';
  return value;
};

const parseDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatProcessingDuration = (minutesInput) => {
  const totalMinutes = Math.max(0, Math.floor(Number(minutesInput) || 0));
  if (totalMinutes <= 0) return '0 phút';

  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (days > 0) parts.push(`${days} ngày`);
  if (hours > 0) parts.push(`${hours} giờ`);
  if (minutes > 0 && parts.length < 2) parts.push(`${minutes} phút`);

  return parts.length ? parts.join(' ') : '0 phút';
};

const decorateTicketProcessingMetrics = (ticketsInput) => {
  if (!ticketsInput) return ticketsInput;

  const tickets = Array.isArray(ticketsInput) ? ticketsInput : [ticketsInput];

  const decoratedTickets = tickets.map((ticket) => {
    if (!ticket || typeof ticket !== 'object') return ticket;

    const normalizedStatus = normalizeDashboardStatus(ticket?.status);
    const processingStart = parseDateTime(ticket?.start_date) || parseDateTime(ticket?.createdAt);
    const processingResolvedAt = parseDateTime(ticket?.resolved_at);

    let processingEnd = null;
    if (processingResolvedAt) {
      processingEnd = processingResolvedAt;
    } else if (!['resolved', 'closed', 'rejected'].includes(normalizedStatus)) {
      processingEnd = new Date();
    } else {
      processingEnd = parseDateTime(ticket?.updatedAt);
    }

    let processingDurationMinutes = null;
    if (processingStart && processingEnd && processingEnd.getTime() >= processingStart.getTime()) {
      processingDurationMinutes = Math.floor((processingEnd.getTime() - processingStart.getTime()) / 60000);
    }

    const isConfirmed = normalizedStatus !== 'new';
    const isTerminal = ['resolved', 'closed', 'rejected'].includes(normalizedStatus);
    let processingAlertLevel = 'none';
    let processingAlertReason = null;

    if (!isTerminal && processingDurationMinutes !== null) {
      if (!isConfirmed && processingDurationMinutes > UNCONFIRMED_TICKET_ALERT_MINUTES) {
        processingAlertLevel = 'danger';
        processingAlertReason = 'unconfirmed_over_2h';
      } else if (isConfirmed && processingDurationMinutes > CONFIRMED_TICKET_ALERT_MINUTES) {
        processingAlertLevel = 'danger';
        processingAlertReason = 'confirmed_over_24h';
      }
    }

    return {
      ...ticket,
      processing_is_confirmed: isConfirmed,
      processing_alert_level: processingAlertLevel,
      processing_alert_reason: processingAlertReason,
      processing_duration_minutes: processingDurationMinutes,
      processing_duration_label:
        processingDurationMinutes === null ? null : formatProcessingDuration(processingDurationMinutes),
    };
  });

  return Array.isArray(ticketsInput) ? decoratedTickets : decoratedTickets[0];
};

const formatActivityTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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
    strapi.log.warn('Create system ticket log failed', {
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
    strapi.log.warn('Notify ticket audience failed', {
      ticketId,
      actorId,
      error: error?.message || error,
    });
  }
};

const listDepartmentHandlers = async (strapi, departmentId) => {
  if (!Number.isInteger(Number(departmentId)) || Number(departmentId) <= 0) {
    return [];
  }

  const handlers = await strapi.entityService.findMany('api::user-info.user-info', {
    filters: {
      role: 'handler',
      is_active: true,
      department: { id: Number(departmentId) },
    },
    fields: ['id', 'name', 'email', 'role', 'is_active'],
    populate: {
      department: {
        fields: ['id', 'name', 'code'],
      },
    },
    sort: { name: 'asc' },
    limit: 200,
  });

  return Array.isArray(handlers) ? handlers : [];
};

const walkDashboardTickets = async (strapi, filters, onBatch) => {
  let start = 0;

  while (true) {
    const batch = await strapi.entityService.findMany('api::ticket.ticket', {
      filters,
      fields: ['id', 'ticket_code', 'status', 'store_id', 'end_date', 'createdAt'],
      populate: {
        store: {
          fields: ['id', 'storeId', 'code', 'shortAddress', 'address'],
        },
      },
      sort: { createdAt: 'desc' },
      start,
      limit: DASHBOARD_TICKET_BATCH_SIZE,
    });

    const normalizedBatch = Array.isArray(batch) ? batch : [];
    if (!normalizedBatch.length) {
      break;
    }

    await onBatch(normalizedBatch);
    if (normalizedBatch.length < DASHBOARD_TICKET_BATCH_SIZE) {
      break;
    }

    start += normalizedBatch.length;
  }

  return null;
};

module.exports = createCoreController('api::ticket.ticket', ({ strapi }) => ({
  async dashboardOverview(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const scoped = buildDashboardTicketFilters(user, ctx.query || {});
    if (scoped?.error) {
      return errorResponse(ctx, 400, scoped.error);
    }

    const topStoresLimit = Math.min(Math.max(Number(ctx.query?.top_stores_limit) || 5, 1), 20);
    const activityLimit = Math.min(Math.max(Number(ctx.query?.activity_limit) || 8, 1), 30);

    const ticketFilters = scoped.filters || {};

    const now = new Date();
    const soonThreshold = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    let totalTicketCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;
    let overdueSoonCount = 0;

    const statusCounter = {
      new: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0,
    };

    const storesMap = new Map();

    await walkDashboardTickets(strapi, ticketFilters, async (tickets) => {
      tickets.forEach((ticket) => {
        totalTicketCount += 1;
        const normalizedStatus = normalizeDashboardStatus(ticket?.status);
        if (normalizedStatus === 'in_progress') inProgressCount += 1;
        if (normalizedStatus === 'resolved') resolvedCount += 1;

        if (Object.prototype.hasOwnProperty.call(statusCounter, normalizedStatus)) {
          statusCounter[normalizedStatus] += 1;
        }

        const endDateRaw = ticket?.end_date;
        if (endDateRaw) {
          const endDate = new Date(endDateRaw);
          if (
            !Number.isNaN(endDate.getTime()) &&
            endDate.getTime() >= now.getTime() &&
            endDate.getTime() <= soonThreshold.getTime() &&
            normalizedStatus !== 'resolved' &&
            normalizedStatus !== 'closed' &&
            normalizedStatus !== 'rejected'
          ) {
            overdueSoonCount += 1;
          }
        }

        const storeId = Number(ticket?.store_id || 0);
        if (!Number.isInteger(storeId) || storeId <= 0) return;

        const existed = storesMap.get(storeId) || {
          store_id: storeId,
          count: 0,
          name: '',
        };
        existed.count += 1;
        existed.name =
          existed.name ||
          ticket?.store?.shortAddress ||
          ticket?.store?.address ||
          ticket?.store?.code ||
          `Store #${storeId}`;
        storesMap.set(storeId, existed);
      });
    });

    const topStores = Array.from(storesMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, topStoresLimit);

    const activityFilters = {
      createdAt: {
        $gte: scoped.range.fromIso,
        $lte: scoped.range.toIso,
      },
      ticket: ticketFilters,
    };

    const recentLogs = await strapi.entityService.findMany('api::ticket-log.ticket-log', {
      filters: activityFilters,
      fields: ['id', 'message', 'createdAt', 'sender_type'],
      sort: { createdAt: 'desc' },
      limit: activityLimit,
      populate: {
        sender: { fields: ['id', 'name'] },
        ticket: { fields: ['id', 'ticket_code'] },
      },
    });

    const activityFeed = (Array.isArray(recentLogs) ? recentLogs : []).map((item) => {
      const senderName = item?.sender?.name || (item?.sender_type === 'handler' ? 'Bộ phận xử lý' : 'Cửa hàng');
      const ticketCode = item?.ticket?.ticket_code || `#${item?.ticket?.id || '--'}`;
      const plainMessage = String(item?.message || '').replace(/\s+/g, ' ').trim();
      const shortMessage = plainMessage.length > 120 ? `${plainMessage.slice(0, 120)}...` : plainMessage;
      const isSystemLog = String(item?.sender_type || '').toLowerCase() === 'system';

      return {
        at: item?.createdAt || null,
        time: formatActivityTime(item?.createdAt),
        content: isSystemLog
          ? (shortMessage || `Ticket ${ticketCode} có cập nhật mới`)
          : `${senderName} phản hồi ticket ${ticketCode}: ${shortMessage || '(không có nội dung)'}`,
      };
    });

    return successResponse('Lấy dữ liệu dashboard thành công', {
      filters: {
        date_from: scoped.range.dateFrom,
        date_to: scoped.range.dateTo,
      },
      summary: {
        total_ticket: totalTicketCount,
        in_progress: inProgressCount,
        resolved: resolvedCount,
        overdue: overdueSoonCount,
      },
      status: [
        { key: 'new', label: 'Mới tạo', value: statusCounter.new },
        { key: 'in_progress', label: 'Đang xử lý', value: statusCounter.in_progress },
        { key: 'resolved', label: 'Đã xử lý', value: statusCounter.resolved },
        { key: 'rejected', label: 'Từ chối', value: statusCounter.rejected },
      ],
      top_stores: topStores,
      activity_feed: activityFeed,
    });
  },

  async uploadAttachments(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const files = extractUploadFiles(ctx.request.files);
    if (!files.length) {
      return errorResponse(ctx, 400, 'Không tìm thấy file upload');
    }
    if (files.length > MAX_UPLOAD_FILES_PER_REQUEST) {
      return errorResponse(ctx, 400, `Mỗi lần chỉ được tải tối đa ${MAX_UPLOAD_FILES_PER_REQUEST} ảnh`);
    }

    const hasInvalidFileType = files.some((file) => {
      const mimeType = String(file?.type || file?.mimetype || '');
      return !mimeType.startsWith('image/');
    });
    if (hasInvalidFileType) {
      return errorResponse(ctx, 400, 'Chỉ chấp nhận file hình ảnh');
    }

    const hasOversizedFile = files.some((file) => {
      const fileSize = Number(file?.size || 0);
      return Number.isFinite(fileSize) && fileSize > MAX_UPLOAD_FILE_SIZE_BYTES;
    });
    if (hasOversizedFile) {
      return errorResponse(ctx, 400, 'Mỗi ảnh không được vượt quá 5MB');
    }

    try {
      const uploadedFiles = await strapi.plugin('upload').service('upload').upload({
        data: {},
        files,
      });

      const normalized = (uploadedFiles || []).map((file) => ({
        id: file.id,
        name: file.name,
        url: file.url,
        mime: file.mime,
        size: file.size,
        ext: file.ext,
        formats: file.formats || null,
      }));

      return successResponse('Tải ảnh lên thành công', { files: normalized });
    } catch (error) {
      strapi.log.error('Upload attachments failed', error);
      return errorResponse(ctx, 500, 'Tải ảnh lên thất bại');
    }
  },

  async createTicket(ctx) {
    const payload = ctx.request.body || {};
    const normalizedTitle = String(payload.title || '').trim();
    const normalizedDescription = String(payload.description || '').trim();

    if (!normalizedTitle || !normalizedDescription || !payload.store_id || !payload.responsible_department_id) {
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

    const linkedStore = await findStoreByBusinessId(strapi, storeId);
    if (!linkedStore?.id) {
      return errorResponse(ctx, 400, 'Cửa hàng không tồn tại');
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

    let initialHandler = null;
    if (payload.handler_id !== undefined && payload.handler_id !== null && payload.handler_id !== '') {
      const handlerId = Number(payload.handler_id);
      if (!Number.isInteger(handlerId) || handlerId <= 0) {
        return errorResponse(ctx, 400, 'handler_id không hợp lệ');
      }

      initialHandler = await strapi.entityService.findOne('api::user-info.user-info', handlerId, {
        fields: ['id', 'role'],
        populate: {
          department: {
            fields: ['id'],
          },
        },
      });

      if (!initialHandler || !initialHandler.id) {
        return errorResponse(ctx, 400, 'handler không tồn tại');
      }

      const handlerRole = getRole(initialHandler);
      if (handlerRole !== 'handler' && handlerRole !== 'admin') {
        return errorResponse(ctx, 400, 'Người được gán phải có vai trò handler hoặc admin');
      }

      if (handlerRole !== 'admin') {
        const handlerDepartmentId = Number(initialHandler?.department?.id || 0);
        if (handlerDepartmentId <= 0 || handlerDepartmentId !== responsibleDepartment.id) {
          return errorResponse(ctx, 400, 'Handler không thuộc bộ phận xử lý của ticket');
        }
      }
    }

    const requester = ctx.state.userDetail;
    if (!requester || !requester.id) {
      return errorResponse(ctx, 401, 'Không xác định được người tạo phiếu');
    }
    if (getRole(requester) === 'store') {
      const requesterStoreIds = getUserStoreIds(requester);
      if (!requesterStoreIds.length) {
        return errorResponse(ctx, 403, 'Tài khoản của bạn chưa được gán cửa hàng hợp lệ');
      }
      if (!requesterStoreIds.includes(storeId)) {
        return errorResponse(ctx, 403, 'Bạn không có quyền tạo phiếu cho cửa hàng này');
      }
    }

    const attachmentFileIds = normalizeAttachmentFileIds(payload.attachment_file_ids);
    if (payload.attachment_file_ids !== undefined && attachmentFileIds === null) {
      return errorResponse(ctx, 400, 'attachment_file_ids phải là mảng số nguyên dương');
    }

    const normalizedEndDate = normalizeEndDateInput(payload.end_date);
    if (normalizedEndDate.error) {
      return errorResponse(ctx, 400, normalizedEndDate.error);
    }

    try {
      const ticketCode = await generateTicketCode(strapi);
      const nowIso = new Date().toISOString();

      const createdTicket = await strapi.entityService.create('api::ticket.ticket', {
        data: {
          ticket_code: ticketCode,
          title: normalizedTitle,
          description: normalizedDescription,
          status: initialHandler?.id ? 'in_progress' : 'new',
          requester: requester.id,
          requester_id: requester.id,
          store_id: storeId,
          store: linkedStore.id,
          handler: initialHandler?.id || null,
          handler_id: initialHandler?.id || null,
          assignees: initialHandler?.id ? [Number(initialHandler.id)] : [],
          responsible_department: responsibleDepartment.id,
          ticket_category_id: payload.ticket_category_id ? Number(payload.ticket_category_id) : null,
          type: payload.type ? String(payload.type).trim() : null,
          start_date: nowIso,
          processing_started_at: initialHandler?.id ? nowIso : null,
          resolved_at: null,
          end_date: normalizedEndDate.hasValue ? normalizedEndDate.value : null,
          attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
          attachments_media: attachmentFileIds || [],
        },
        populate: ticketPopulate,
      });

      const hydratedTicket = await hydrateTicketUsers(strapi, createdTicket);
      await createSystemTicketLog(strapi, {
        ticketId: createdTicket.id,
        senderId: requester.id,
        message: `${requester.name || 'Cửa hàng'} đã tạo ticket ${createdTicket.ticket_code || `#${createdTicket.id}`}`,
      });
      await notifyTicketAudience(strapi, {
        ticketId: createdTicket.id,
        actorId: requester.id,
        title: `Ticket mới ${createdTicket.ticket_code || `#${createdTicket.id}`}`,
        message: `${requester.name || 'Cửa hàng'} vừa tạo yêu cầu mới: ${createdTicket.title || 'Không có tiêu đề'}`,
        type: 'info',
        excludeUserIds: [requester.id],
        meta: { event: 'ticket_created' },
      });

      return successResponse('Tạo phiếu thành công', { ticket: hydratedTicket });
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

    let filters = {};

    if (query.status) {
      const statuses = String(query.status)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      // Backward compatibility: old records may still be "assigned"
      const normalizedStatuses = [
        ...new Set(
          statuses.flatMap((item) => (item === 'in_progress' ? ['in_progress', 'assigned'] : [item]))
        ),
      ];

      if (normalizedStatuses.length === 1) {
        filters.status = normalizedStatuses[0];
      } else if (normalizedStatuses.length > 1) {
        filters.status = { $in: normalizedStatuses };
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
      const scopedOrFilters = [
        { requester: { id: user.id } },
        { requester_id: user.id },
      ];
      const scopedStoreIds = getUserStoreIds(user);
      if (scopedStoreIds.length) {
        scopedOrFilters.push({ store_id: { $in: scopedStoreIds } });
      }

      filters = {
        $and: [
          filters,
          {
            $or: scopedOrFilters,
          },
        ],
      };
    } else if (user.role === 'handler') {
      const departmentId = getUserDepartmentId(user);
      const visibilityOr = departmentId > 0
        ? [
          { responsible_department: { id: departmentId } },
          { assignees: { id: user.id } },
        ]
        : [{ assignees: { id: user.id } }];

      filters = {
        $and: [
          filters,
          {
            $or: visibilityOr,
          },
        ],
      };
    }

    const [tickets, total] = await Promise.all([
      strapi.entityService.findMany('api::ticket.ticket', {
        filters,
        sort: { createdAt: 'desc' },
        start,
        limit: pageSize,
        populate: ticketPopulate,
      }),
      strapi.db.query('api::ticket.ticket').count({
        where: filters,
      }),
    ]);

    const hydratedTickets = await hydrateTicketUsers(strapi, tickets);

    return successResponse('Lấy danh sách phiếu thành công', {
      tickets: hydratedTickets,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    });
  },

  async getTicketById(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const ticketId = Number(ctx.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return errorResponse(ctx, 400, 'id ticket không hợp lệ');
    }

    const ticket = await strapi.entityService.findOne('api::ticket.ticket', ticketId, {
      populate: ticketPopulate,
    });

    if (!ticket) {
      return errorResponse(ctx, 404, 'Không tìm thấy phiếu');
    }

    if (!canViewTicket(user, ticket)) {
      return errorResponse(ctx, 403, 'Bạn không có quyền xem phiếu này');
    }

    const hydratedTicket = await hydrateTicketUsers(strapi, ticket);

    return successResponse('Lấy thông tin phiếu thành công', { ticket: hydratedTicket });
  },

  async updateTicket(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const ticketId = Number(ctx.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return errorResponse(ctx, 400, 'id ticket không hợp lệ');
    }

    const ticket = await strapi.entityService.findOne('api::ticket.ticket', ticketId, {
      fields: ['id', 'requester_id', 'status', 'handler_id', 'processing_started_at', 'resolved_at'],
      populate: {
        requester: { fields: ['id'] },
        handler: { fields: ['id'] },
        assignees: { fields: ['id'] },
        responsible_department: { fields: ['id'] },
      },
    });

    if (!ticket) {
      return errorResponse(ctx, 404, 'Không tìm thấy phiếu');
    }

    if (!canManageTicket(user, ticket)) {
      return errorResponse(ctx, 403, 'Bạn không có quyền chỉnh sửa phiếu này');
    }

    const isAcceptedByDepartment = ticket.status !== 'new' || getHandlerId(ticket) > 0;
    if (isAcceptedByDepartment) {
      return errorResponse(ctx, 400, 'Phiếu đã được bộ phận phụ trách tiếp nhận, không thể chỉnh sửa');
    }

    const payload = ctx.request.body || {};
    const updateData = {};

    if (Object.prototype.hasOwnProperty.call(payload, 'title')) {
      const title = String(payload.title || '').trim();
      if (!title) {
        return errorResponse(ctx, 400, 'Tiêu đề không được để trống');
      }
      updateData.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
      const description = String(payload.description || '').trim();
      if (!description) {
        return errorResponse(ctx, 400, 'Nội dung không được để trống');
      }
      updateData.description = description;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'store_id')) {
      const storeId = Number(payload.store_id);
      if (!Number.isInteger(storeId) || storeId <= 0) {
        return errorResponse(ctx, 400, 'store_id không hợp lệ');
      }

      const linkedStore = await findStoreByBusinessId(strapi, storeId);
      if (!linkedStore?.id) {
        return errorResponse(ctx, 400, 'Cửa hàng không tồn tại');
      }

      if (getRole(user) === 'store') {
        const requesterStoreIds = getUserStoreIds(user);
        if (!requesterStoreIds.length) {
          return errorResponse(ctx, 403, 'Tài khoản của bạn chưa được gán cửa hàng hợp lệ');
        }
        if (!requesterStoreIds.includes(storeId)) {
          return errorResponse(ctx, 403, 'Bạn không có quyền cập nhật phiếu cho cửa hàng này');
        }
      }

      updateData.store_id = storeId;
      updateData.store = linkedStore.id;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'responsible_department_id')) {
      const responsibleDepartmentId = Number(payload.responsible_department_id);
      if (!Number.isInteger(responsibleDepartmentId) || responsibleDepartmentId <= 0) {
        return errorResponse(ctx, 400, 'responsible_department_id không hợp lệ');
      }

      const responsibleDepartment = await strapi.entityService.findOne(
        'api::department.department',
        responsibleDepartmentId,
        {
          fields: ['id', 'is_active'],
        }
      );

      if (!responsibleDepartment || responsibleDepartment.is_active === false) {
        return errorResponse(ctx, 400, 'Bộ phận xử lý không tồn tại hoặc đã bị vô hiệu hóa');
      }

      updateData.responsible_department = responsibleDepartment.id;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'type')) {
      const type = payload.type ? String(payload.type).trim() : '';
      updateData.type = type || null;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'ticket_category_id')) {
      if (payload.ticket_category_id === null || payload.ticket_category_id === '') {
        updateData.ticket_category_id = null;
      } else {
        const ticketCategoryId = Number(payload.ticket_category_id);
        if (!Number.isInteger(ticketCategoryId) || ticketCategoryId <= 0) {
          return errorResponse(ctx, 400, 'ticket_category_id không hợp lệ');
        }
        updateData.ticket_category_id = ticketCategoryId;
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'end_date')) {
      const normalizedEndDate = normalizeEndDateInput(payload.end_date);
      if (normalizedEndDate.error) {
        return errorResponse(ctx, 400, normalizedEndDate.error);
      }
      updateData.end_date = normalizedEndDate.value;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'attachments')) {
      if (!Array.isArray(payload.attachments)) {
        return errorResponse(ctx, 400, 'attachments phải là mảng');
      }
      updateData.attachments = payload.attachments;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'attachment_file_ids')) {
      const attachmentFileIds = normalizeAttachmentFileIds(payload.attachment_file_ids);
      if (attachmentFileIds === null) {
        return errorResponse(ctx, 400, 'attachment_file_ids phải là mảng số nguyên dương');
      }
      updateData.attachments_media = attachmentFileIds;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'assignee_ids')) {
      const assigneeIds = normalizeAssigneeIds(payload.assignee_ids);
      if (assigneeIds === null) {
        return errorResponse(ctx, 400, 'assignee_ids phải là mảng số nguyên dương');
      }

      if (assigneeIds.length > 0) {
        const users = await strapi.entityService.findMany('api::user-info.user-info', {
          filters: { id: { $in: assigneeIds } },
          fields: ['id', 'role'],
          populate: {
            department: { fields: ['id'] },
          },
          limit: assigneeIds.length,
        });

        if (!Array.isArray(users) || users.length !== assigneeIds.length) {
          return errorResponse(ctx, 400, 'Có người xử lý không tồn tại');
        }

        const ticketDepartmentId = getTicketDepartmentId(ticket);
        const invalidAssignee = users.find((member) => {
          const memberRole = getRole(member);
          if (memberRole !== 'handler' && memberRole !== 'admin') return true;
          if (memberRole === 'admin') return false;
          const memberDepartmentId = Number(member?.department?.id || 0);
          return memberDepartmentId <= 0 || memberDepartmentId !== ticketDepartmentId;
        });

        if (invalidAssignee) {
          return errorResponse(ctx, 400, 'Danh sách người xử lý chứa người không thuộc bộ phận phụ trách');
        }
      }

      updateData.assignees = assigneeIds;
      updateData.handler_id = assigneeIds[0] || null;
      updateData.handler = assigneeIds[0] || null;
      if (!assigneeIds.length && ticket.status === 'assigned') {
        updateData.status = 'new';
      }
      if (!assigneeIds.length && ticket.status === 'in_progress') {
        updateData.status = 'new';
      }
      if (assigneeIds.length && (ticket.status === 'new' || ticket.status === 'assigned')) {
        updateData.status = 'in_progress';
      }
    }

    if (updateData.status === 'in_progress' && !ticket.processing_started_at) {
      updateData.processing_started_at = new Date().toISOString();
      updateData.resolved_at = null;
    }

    if (updateData.status === 'new' && Array.isArray(updateData.assignees) && !updateData.assignees.length) {
      updateData.processing_started_at = null;
      updateData.resolved_at = null;
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse(ctx, 400, 'Không có dữ liệu hợp lệ để cập nhật');
    }

    try {
      const updatedTicket = await strapi.entityService.update('api::ticket.ticket', ticket.id, {
        data: updateData,
        populate: ticketPopulate,
      });
      await notifyTicketAudience(strapi, {
        ticketId: updatedTicket.id,
        actorId: user.id,
        title: `Ticket cập nhật ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
        message: `${user.name || 'Người dùng'} đã cập nhật thông tin ticket ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
        type: 'info',
        excludeUserIds: [user.id],
        meta: {
          event: 'ticket_updated',
          changed_fields: Object.keys(updateData),
        },
      });

      const hydratedTicket = await hydrateTicketUsers(strapi, updatedTicket);
      return successResponse('Cập nhật phiếu thành công', { ticket: hydratedTicket });
    } catch (error) {
      strapi.log.error('Update ticket failed', error);
      return errorResponse(ctx, 500, 'Cập nhật phiếu thất bại');
    }
  },

  async listAssignableHandlers(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const ticketId = Number(ctx.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return errorResponse(ctx, 400, 'id ticket không hợp lệ');
    }

    const ticket = await strapi.entityService.findOne('api::ticket.ticket', ticketId, {
      fields: ['id', 'requester_id', 'store_id', 'status'],
      populate: {
        requester: { fields: ['id'] },
        assignees: { fields: ['id'] },
        responsible_department: { fields: ['id', 'name', 'code'] },
      },
    });

    if (!ticket) {
      return errorResponse(ctx, 404, 'Không tìm thấy phiếu');
    }

    if (!canManageAssignees(user, ticket)) {
      return errorResponse(ctx, 403, 'Bạn không có quyền phân công người xử lý');
    }

    const ticketDepartmentId = getTicketDepartmentId(ticket);
    if (ticketDepartmentId <= 0) {
      return successResponse('Lấy danh sách handler thành công', {
        handlers: [],
      });
    }

    const handlers = await listDepartmentHandlers(strapi, ticketDepartmentId);

    return successResponse('Lấy danh sách handler thành công', {
      handlers,
      department: ticket.responsible_department || null,
    });
  },

  async assignHandler(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const ticketId = Number(ctx.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return errorResponse(ctx, 400, 'id ticket không hợp lệ');
    }

    const ticket = await strapi.entityService.findOne('api::ticket.ticket', ticketId, {
      fields: ['id', 'requester_id', 'store_id', 'status', 'processing_started_at'],
      populate: {
        requester: { fields: ['id'] },
        assignees: { fields: ['id'] },
        responsible_department: { fields: ['id', 'name', 'code'] },
      },
    });

    if (!ticket) {
      return errorResponse(ctx, 404, 'Không tìm thấy phiếu');
    }

    if (!canManageAssignees(user, ticket)) {
      return errorResponse(ctx, 403, 'Bạn không có quyền phân công người xử lý');
    }

    const normalizedStatus = normalizeDashboardStatus(ticket.status);
    if (!['new', 'in_progress'].includes(normalizedStatus)) {
      return errorResponse(ctx, 400, 'Chỉ có thể phân công handler khi ticket đang mở');
    }

    const payload = ctx.request.body || {};
    const handlerId = Number(payload.handler_id);
    if (!Number.isInteger(handlerId) || handlerId <= 0) {
      return errorResponse(ctx, 400, 'handler_id không hợp lệ');
    }

    const assignedHandler = await strapi.entityService.findOne('api::user-info.user-info', handlerId, {
      fields: ['id', 'name', 'email', 'role', 'is_active'],
      populate: {
        department: {
          fields: ['id', 'name', 'code'],
        },
      },
    });

    if (!assignedHandler?.id || getRole(assignedHandler) !== 'handler' || assignedHandler.is_active === false) {
      return errorResponse(ctx, 400, 'Người được phân công phải là handler đang hoạt động');
    }

    const ticketDepartmentId = getTicketDepartmentId(ticket);
    const handlerDepartmentId = Number(assignedHandler?.department?.id || 0);
    if (ticketDepartmentId <= 0 || handlerDepartmentId <= 0 || ticketDepartmentId !== handlerDepartmentId) {
      return errorResponse(ctx, 400, 'Handler không thuộc bộ phận phụ trách của ticket');
    }

    const currentAssigneeIds = getTicketAssigneeIds(ticket);
    if (currentAssigneeIds.includes(handlerId)) {
      const refreshed = await strapi.entityService.findOne('api::ticket.ticket', ticket.id, {
        populate: ticketPopulate,
      });
      const hydratedTicket = await hydrateTicketUsers(strapi, refreshed);
      return successResponse('Handler đã nằm trong danh sách xử lý', {
        ticket: hydratedTicket,
      });
    }

    const nextAssigneeIds = [...currentAssigneeIds, handlerId];
    const updatedTicket = await strapi.entityService.update('api::ticket.ticket', ticket.id, {
      data: {
        assignees: nextAssigneeIds,
        status: normalizedStatus === 'new' ? 'in_progress' : ticket.status,
        handler_id: currentAssigneeIds[0] || handlerId,
        handler: currentAssigneeIds[0] || handlerId,
        processing_started_at: ticket.processing_started_at || new Date().toISOString(),
        resolved_at: null,
      },
      populate: ticketPopulate,
    });

    await createSystemTicketLog(strapi, {
      ticketId: updatedTicket.id,
      senderId: user.id,
      message: `${user.name || 'Admin'} đã phân công ${assignedHandler.name || 'handler'} xử lý ticket ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
    });
    await notifyTicketAudience(strapi, {
      ticketId: updatedTicket.id,
      actorId: user.id,
      title: `Ticket được phân công ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
      message: `${user.name || 'Admin'} đã phân công ${assignedHandler.name || 'handler'} vào ticket ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
      type: 'info',
      excludeUserIds: [user.id],
      meta: {
        event: 'ticket_assigned_handler',
        handler_id: handlerId,
      },
    });

    const hydratedTicket = await hydrateTicketUsers(strapi, updatedTicket);
    return successResponse('Phân công handler thành công', {
      ticket: hydratedTicket,
    });
  },

  async listAssignees(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const ticketId = Number(ctx.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return errorResponse(ctx, 400, 'id ticket không hợp lệ');
    }

    const ticket = await strapi.entityService.findOne('api::ticket.ticket', ticketId, {
      fields: ['id', 'requester_id', 'store_id'],
      populate: {
        requester: { fields: ['id'] },
        assignees: { fields: ['id', 'name', 'email', 'role'] },
        responsible_department: { fields: ['id'] },
      },
    });

    if (!ticket) {
      return errorResponse(ctx, 404, 'Không tìm thấy phiếu');
    }

    if (!canViewTicket(user, ticket)) {
      return errorResponse(ctx, 403, 'Bạn không có quyền xem danh sách xử lý của phiếu này');
    }

    return successResponse('Lấy danh sách người xử lý thành công', {
      assignees: Array.isArray(ticket.assignees) ? ticket.assignees : [],
    });
  },

  async assignMe(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const role = getRole(user);
    if (role !== 'handler' && role !== 'admin') {
      return errorResponse(ctx, 403, 'Chỉ handler hoặc admin mới có thể nhận xử lý phiếu');
    }

    const ticketId = Number(ctx.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return errorResponse(ctx, 400, 'id ticket không hợp lệ');
    }

    const ticket = await strapi.entityService.findOne('api::ticket.ticket', ticketId, {
      fields: ['id', 'requester_id', 'store_id', 'status', 'processing_started_at'],
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
      return errorResponse(ctx, 403, 'Bạn không có quyền nhận xử lý phiếu này');
    }

    if (role === 'handler') {
      const handlerDepartmentId = getUserDepartmentId(user);
      const ticketDepartmentId = getTicketDepartmentId(ticket);
      if (handlerDepartmentId <= 0 || ticketDepartmentId <= 0 || handlerDepartmentId !== ticketDepartmentId) {
        return errorResponse(ctx, 403, 'Bạn không thuộc bộ phận phụ trách của phiếu này');
      }
    }

    const currentAssigneeIds = getTicketAssigneeIds(ticket);
    if (currentAssigneeIds.includes(Number(user.id))) {
      const hasLegacyStatus = ticket.status === 'new' || ticket.status === 'assigned';
      const refreshed = hasLegacyStatus
        ? await strapi.entityService.update('api::ticket.ticket', ticket.id, {
          data: {
            status: 'in_progress',
            handler_id: currentAssigneeIds[0] || null,
            handler: currentAssigneeIds[0] || null,
            processing_started_at: ticket.processing_started_at || new Date().toISOString(),
            resolved_at: null,
          },
          populate: ticketPopulate,
        })
        : await strapi.entityService.findOne('api::ticket.ticket', ticket.id, {
          populate: ticketPopulate,
        });
      const hydratedTicket = await hydrateTicketUsers(strapi, refreshed);
      return successResponse('Bạn đã có trong danh sách xử lý', {
        ticket: hydratedTicket,
      });
    }

    const nextAssigneeIds = [...currentAssigneeIds, Number(user.id)];
    const assignData = {
      assignees: nextAssigneeIds,
      status: ticket.status === 'new' || ticket.status === 'assigned' ? 'in_progress' : ticket.status,
      handler_id: nextAssigneeIds[0] || null,
      handler: nextAssigneeIds[0] || null,
    };
    if (ticket.status === 'new' || ticket.status === 'assigned') {
      assignData.processing_started_at = ticket.processing_started_at || new Date().toISOString();
      assignData.resolved_at = null;
    }

    const updatedTicket = await strapi.entityService.update('api::ticket.ticket', ticket.id, {
      data: assignData,
      populate: ticketPopulate,
    });
    await createSystemTicketLog(strapi, {
      ticketId: updatedTicket.id,
      senderId: user.id,
      message: `${user.name || 'Handler'} đã nhận xử lý ticket ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
    });
    await notifyTicketAudience(strapi, {
      ticketId: updatedTicket.id,
      actorId: user.id,
      title: `Ticket đang xử lý ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
      message: `${user.name || 'Handler'} đã nhận xử lý ticket ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
      type: 'info',
      excludeUserIds: [user.id],
      meta: { event: 'ticket_assigned_me' },
    });
    const hydratedTicket = await hydrateTicketUsers(strapi, updatedTicket);

    return successResponse('Nhận xử lý phiếu thành công', {
      ticket: hydratedTicket,
    });
  },

  async unassignUser(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    return errorResponse(ctx, 400, 'Không hỗ trợ rời khỏi ticket sau khi đã nhận xử lý');
  },

  async resolveTicket(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const role = getRole(user);
    if (role !== 'handler' && role !== 'admin') {
      return errorResponse(ctx, 403, 'Chỉ handler hoặc admin mới có thể chuyển trạng thái hoàn tất');
    }

    const ticketId = Number(ctx.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return errorResponse(ctx, 400, 'id ticket không hợp lệ');
    }

    const ticket = await strapi.entityService.findOne('api::ticket.ticket', ticketId, {
      fields: ['id', 'requester_id', 'store_id', 'status', 'processing_started_at', 'resolved_at'],
      populate: {
        requester: { fields: ['id'] },
        assignees: { fields: ['id'] },
      },
    });

    if (!ticket) {
      return errorResponse(ctx, 404, 'Không tìm thấy phiếu');
    }

    if (!canViewTicket(user, ticket)) {
      return errorResponse(ctx, 403, 'Bạn không có quyền cập nhật phiếu này');
    }

    if (ticket.status === 'resolved') {
      const refreshed = await strapi.entityService.findOne('api::ticket.ticket', ticket.id, {
        populate: ticketPopulate,
      });
      const hydratedTicket = await hydrateTicketUsers(strapi, refreshed);
      return successResponse('Phiếu đã ở trạng thái đã xử lý', {
        ticket: hydratedTicket,
      });
    }

    if (ticket.status !== 'in_progress') {
      return errorResponse(ctx, 400, 'Chỉ có thể đánh dấu hoàn tất khi phiếu đang xử lý');
    }

    const currentAssigneeIds = getTicketAssigneeIds(ticket);
    if (!isAdmin(user) && !currentAssigneeIds.includes(Number(user.id))) {
      return errorResponse(ctx, 403, 'Chỉ người đang xử lý mới có thể hoàn tất phiếu');
    }

    const updatedTicket = await strapi.entityService.update('api::ticket.ticket', ticket.id, {
      data: {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      },
      populate: ticketPopulate,
    });
    await createSystemTicketLog(strapi, {
      ticketId: updatedTicket.id,
      senderId: user.id,
      message: `${user.name || 'Handler'} đã đánh dấu ticket ${updatedTicket.ticket_code || `#${updatedTicket.id}`} là đã xử lý`,
    });
    await notifyTicketAudience(strapi, {
      ticketId: updatedTicket.id,
      actorId: user.id,
      title: `Ticket đã xử lý ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
      message: `${user.name || 'Handler'} đã hoàn tất ticket ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
      type: 'success',
      excludeUserIds: [user.id],
      meta: { event: 'ticket_resolved' },
    });
    const hydratedTicket = await hydrateTicketUsers(strapi, updatedTicket);

    return successResponse('Đã chuyển phiếu sang trạng thái đã xử lý', {
      ticket: hydratedTicket,
    });
  },

  async reopenTicket(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const role = getRole(user);
    if (role !== 'store' && role !== 'admin') {
      return errorResponse(ctx, 403, 'Chỉ cửa hàng hoặc admin mới có thể mở lại phiếu');
    }

    const ticketId = Number(ctx.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return errorResponse(ctx, 400, 'id ticket không hợp lệ');
    }

    const ticket = await strapi.entityService.findOne('api::ticket.ticket', ticketId, {
      fields: ['id', 'requester_id', 'store_id', 'status'],
      populate: {
        requester: { fields: ['id'] },
        assignees: { fields: ['id'] },
      },
    });

    if (!ticket) {
      return errorResponse(ctx, 404, 'Không tìm thấy phiếu');
    }

    if (!canViewTicket(user, ticket)) {
      return errorResponse(ctx, 403, 'Bạn không có quyền mở lại phiếu này');
    }

    if (ticket.status !== 'resolved') {
      return errorResponse(ctx, 400, 'Chỉ có thể mở lại phiếu đã xử lý');
    }

    const assigneeIds = getTicketAssigneeIds(ticket);
    const nextStatus = assigneeIds.length ? 'in_progress' : 'new';
    const nowIso = new Date().toISOString();

    const updatedTicket = await strapi.entityService.update('api::ticket.ticket', ticket.id, {
      data: {
        status: nextStatus,
        processing_started_at: nextStatus === 'in_progress' ? nowIso : null,
        resolved_at: null,
      },
      populate: ticketPopulate,
    });
    await createSystemTicketLog(strapi, {
      ticketId: updatedTicket.id,
      senderId: user.id,
      message: `${user.name || 'Cửa hàng'} đã mở lại ticket ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
    });
    await notifyTicketAudience(strapi, {
      ticketId: updatedTicket.id,
      actorId: user.id,
      title: `Ticket mở lại ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
      message: `${user.name || 'Cửa hàng'} đã mở lại ticket ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
      type: 'warning',
      excludeUserIds: [user.id],
      meta: { event: 'ticket_reopened' },
    });
    const hydratedTicket = await hydrateTicketUsers(strapi, updatedTicket);

    return successResponse('Mở lại phiếu thành công', {
      ticket: hydratedTicket,
    });
  },

  async rejectTicket(ctx) {
    const user = ctx.state.userDetail;
    if (!user || !user.id) {
      return errorResponse(ctx, 401, 'Bạn chưa đăng nhập');
    }

    const role = getRole(user);
    if (role !== 'handler' && role !== 'admin') {
      return errorResponse(ctx, 403, 'Chỉ handler hoặc admin mới có thể từ chối phiếu');
    }

    const ticketId = Number(ctx.params.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return errorResponse(ctx, 400, 'id ticket không hợp lệ');
    }

    const ticket = await strapi.entityService.findOne('api::ticket.ticket', ticketId, {
      fields: ['id', 'requester_id', 'store_id', 'status'],
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
      return errorResponse(ctx, 403, 'Bạn không có quyền từ chối phiếu này');
    }

    if (ticket.status === 'rejected') {
      const refreshed = await strapi.entityService.findOne('api::ticket.ticket', ticket.id, {
        populate: ticketPopulate,
      });
      const hydratedTicket = await hydrateTicketUsers(strapi, refreshed);
      return successResponse('Phiếu đã ở trạng thái từ chối', { ticket: hydratedTicket });
    }

    if (ticket.status !== 'new' && ticket.status !== 'in_progress') {
      return errorResponse(ctx, 400, 'Chỉ có thể từ chối phiếu ở trạng thái mới hoặc đang xử lý');
    }

    if (role === 'handler') {
      const handlerDepartmentId = getUserDepartmentId(user);
      const ticketDepartmentId = getTicketDepartmentId(ticket);
      if (handlerDepartmentId <= 0 || ticketDepartmentId <= 0 || handlerDepartmentId !== ticketDepartmentId) {
        return errorResponse(ctx, 403, 'Bạn không thuộc bộ phận phụ trách của phiếu này');
      }
    }

    const payload = ctx.request.body || {};
    const reason = String(payload.reason || '').trim();

    const updatedTicket = await strapi.entityService.update('api::ticket.ticket', ticket.id, {
      data: {
        status: 'rejected',
      },
      populate: ticketPopulate,
    });
    await createSystemTicketLog(strapi, {
      ticketId: updatedTicket.id,
      senderId: user.id,
      message: reason
        ? `${user.name || 'Handler'} đã từ chối ticket ${updatedTicket.ticket_code || `#${updatedTicket.id}`}: ${reason}`
        : `${user.name || 'Handler'} đã từ chối ticket ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
    });
    await notifyTicketAudience(strapi, {
      ticketId: updatedTicket.id,
      actorId: user.id,
      title: `Ticket bị từ chối ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
      message: reason
        ? `${user.name || 'Handler'} đã từ chối ticket: ${reason}`
        : `${user.name || 'Handler'} đã từ chối ticket ${updatedTicket.ticket_code || `#${updatedTicket.id}`}`,
      type: 'warning',
      excludeUserIds: [user.id],
      meta: { event: 'ticket_rejected' },
    });
    const hydratedTicket = await hydrateTicketUsers(strapi, updatedTicket);

    return successResponse('Từ chối phiếu thành công', {
      ticket: hydratedTicket,
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
      populate: {
        requester: { fields: ['id'] },
        handler: { fields: ['id'] },
      },
    });

    if (!ticket) {
      return errorResponse(ctx, 404, 'Không tìm thấy phiếu');
    }

    if (!canManageTicket(user, ticket)) {
      return errorResponse(ctx, 403, 'Bạn không có quyền xóa phiếu này');
    }

    const isAcceptedByDepartment = ticket.status !== 'new' || getHandlerId(ticket) > 0;
    if (isAcceptedByDepartment) {
      return errorResponse(ctx, 400, 'Phiếu đã được bộ phận phụ trách tiếp nhận, không thể xóa');
    }

    try {
      await strapi.db.query('api::ticket-log.ticket-log').deleteMany({
        where: { ticket: { id: ticket.id } },
      });

      await strapi.entityService.delete('api::ticket.ticket', ticket.id);

      return successResponse('Xóa phiếu thành công');
    } catch (error) {
      strapi.log.error('Delete ticket failed', error);
      return errorResponse(ctx, 500, 'Xóa phiếu thất bại');
    }
  },
}));

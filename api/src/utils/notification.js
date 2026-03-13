'use strict';

const { getTicketAssigneeIds } = require('./ticket-permissions');

const toUniqueUserIds = (ids = []) => (
  Array.from(
    new Set(
      ids
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  )
);

const getRequesterId = (ticket) => Number(ticket?.requester?.id || ticket?.requester_id || 0);

const getTicketStoreId = (ticket) => Number(ticket?.store_id || 0);

const getStoreMemberIdsByStoreBusinessId = async (strapi, storeBusinessId) => {
  const normalizedStoreId = Number(storeBusinessId);
  if (!Number.isInteger(normalizedStoreId) || normalizedStoreId <= 0) return [];

  const users = await strapi.entityService.findMany('api::user-info.user-info', {
    filters: {
      is_active: true,
      stores: {
        storeId: String(normalizedStoreId),
      },
    },
    fields: ['id'],
    publicationState: 'preview',
    start: 0,
    limit: 2000,
  });

  return toUniqueUserIds((users || []).map((item) => item?.id));
};

const loadTicketAudience = async (strapi, ticketId) => {
  const normalizedTicketId = Number(ticketId);
  if (!Number.isInteger(normalizedTicketId) || normalizedTicketId <= 0) {
    return {
      ticket: null,
      recipientIds: [],
      requesterId: null,
      assigneeIds: [],
      storeMemberIds: [],
    };
  }

  const ticket = await strapi.entityService.findOne('api::ticket.ticket', normalizedTicketId, {
    fields: ['id', 'requester_id', 'store_id', 'ticket_code', 'title', 'status', 'handler_id'],
    populate: {
      requester: { fields: ['id', 'name'] },
      assignees: { fields: ['id', 'name'] },
      handler: { fields: ['id', 'name'] },
    },
  });

  if (!ticket) {
    return {
      ticket: null,
      recipientIds: [],
      requesterId: null,
      assigneeIds: [],
      storeMemberIds: [],
    };
  }

  const requesterId = getRequesterId(ticket);
  const assigneeIds = getTicketAssigneeIds(ticket);
  const storeMemberIds = await getStoreMemberIdsByStoreBusinessId(strapi, getTicketStoreId(ticket));
  const recipientIds = toUniqueUserIds([requesterId, ...assigneeIds, ...storeMemberIds]);

  return {
    ticket,
    recipientIds,
    requesterId: requesterId || null,
    assigneeIds,
    storeMemberIds,
  };
};

const createNotifications = async (
  strapi,
  {
    recipientIds = [],
    title = '',
    message = '',
    type = 'info',
    ticketId = null,
    actorId = null,
    excludeUserIds = [],
    meta = null,
  } = {}
) => {
  const normalizedTitle = String(title || '').trim();
  const normalizedMessage = String(message || '').trim();
  if (!normalizedTitle || !normalizedMessage) return [];

  const excludedIds = toUniqueUserIds(excludeUserIds);
  const finalRecipientIds = toUniqueUserIds(recipientIds).filter((id) => !excludedIds.includes(id));
  if (!finalRecipientIds.length) return [];

  const normalizedTicketId = Number(ticketId);
  const normalizedActorId = Number(actorId);
  const typeValue = ['info', 'success', 'warning', 'error'].includes(type) ? type : 'info';
  const normalizedMeta = meta && typeof meta === 'object' ? meta : null;

  const created = await Promise.all(
    finalRecipientIds.map((recipientId) =>
      strapi.entityService.create('api::notification.notification', {
        data: {
          title: normalizedTitle,
          message: normalizedMessage,
          type: typeValue,
          recipient: recipientId,
          is_read: false,
          read_at: null,
          ticket: Number.isInteger(normalizedTicketId) && normalizedTicketId > 0 ? normalizedTicketId : null,
          actor: Number.isInteger(normalizedActorId) && normalizedActorId > 0 ? normalizedActorId : null,
          meta: normalizedMeta,
        },
      })
    )
  );

  return created;
};

module.exports = {
  toUniqueUserIds,
  loadTicketAudience,
  createNotifications,
};

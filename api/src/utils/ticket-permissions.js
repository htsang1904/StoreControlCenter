'use strict';

const OPEN_TICKET_STATUSES = ['new', 'assigned', 'in_progress'];

const getRole = (user) => String(user?.role || '').toLowerCase();
const isAdmin = (user) => getRole(user) === 'admin';
const getRequesterId = (ticket) => Number(ticket?.requester?.id || ticket?.requester_id || 0);
const getTicketAssigneeEntries = (ticket) => {
  if (Array.isArray(ticket?.assignees) && ticket.assignees.length) {
    return ticket.assignees.filter(Boolean);
  }

  if (ticket?.handler?.id) {
    return [ticket.handler];
  }

  const handlerId = Number(ticket?.handler_id || 0);
  if (Number.isInteger(handlerId) && handlerId > 0) {
    return [{ id: handlerId }];
  }

  return [];
};
const getTicketAssigneeIds = (ticket) => (
  getTicketAssigneeEntries(ticket)
    .map((item) => Number(item?.id || item))
    .filter((item) => Number.isInteger(item) && item > 0)
);
const getTicketStoreId = (ticket) => Number(ticket?.store_id || 0);
const getTicketDepartmentId = (ticket) => Number(ticket?.responsible_department?.id || ticket?.responsible_department || 0);
const getUserDepartmentId = (user) => Number(user?.department?.id || user?.department_id || 0);
const getUserStoreIds = (user) => (
  Array.isArray(user?.store_ids)
    ? user.store_ids
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0)
    : []
);

const canAccessTicketStore = (user, ticket) => {
  const storeId = getTicketStoreId(ticket);
  if (!Number.isInteger(storeId) || storeId <= 0) return false;
  return getUserStoreIds(user).includes(storeId);
};

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

  return getRequesterId(ticket) === Number(user.id) || canAccessTicketStore(user, ticket);
};

const canManageTicket = (user, ticket) => {
  if (!user || !ticket) return false;
  if (isAdmin(user)) return true;
  return getRequesterId(ticket) === Number(user.id);
};

const canManageAssignees = (user, ticket) => {
  if (!user || !ticket) return false;
  const role = getRole(user);

  if (role === 'admin') return true;
  if (role === 'handler') {
    return getUserDepartmentId(user) > 0 && getUserDepartmentId(user) === getTicketDepartmentId(ticket);
  }

  return false;
};

const isOpenTicketStatus = (ticket) => OPEN_TICKET_STATUSES.includes(String(ticket?.status || '').toLowerCase());

const canReplyOnTicket = (user, ticket) => {
  if (!user || !ticket) return false;

  const isOpenStatus = isOpenTicketStatus(ticket);
  const role = getRole(user);

  if (role === 'admin') return isOpenStatus;
  if (role === 'handler') {
    return isOpenStatus && getTicketAssigneeIds(ticket).includes(Number(user.id));
  }
  if (role === 'store') {
    return isOpenStatus && getRequesterId(ticket) === Number(user.id);
  }

  return false;
};

module.exports = {
  canAccessTicketStore,
  canManageAssignees,
  canManageTicket,
  canReplyOnTicket,
  canViewTicket,
  getRequesterId,
  getRole,
  getTicketAssigneeEntries,
  getTicketAssigneeIds,
  getTicketDepartmentId,
  getTicketStoreId,
  getUserDepartmentId,
  getUserStoreIds,
  isAdmin,
  isOpenTicketStatus,
};

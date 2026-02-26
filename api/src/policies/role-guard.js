'use strict';

const { ForbiddenError, UnauthorizedError } = require('@strapi/utils').errors;

module.exports = async (policyContext, config) => {
  const user = policyContext.state.userDetail;
  if (!user) {
    throw new UnauthorizedError('Bạn chưa đăng nhập');
  }

  const allowedRoles = Array.isArray(config?.allow) ? config.allow : [];
  if (!allowedRoles.length) {
    return true;
  }

  const userRole = user.role || 'store';
  if (!allowedRoles.includes(userRole)) {
    throw new ForbiddenError('Bạn không có quyền thực hiện thao tác này');
  }

  return true;
};

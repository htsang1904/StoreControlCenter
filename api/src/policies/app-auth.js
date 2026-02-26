'use strict';

const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('@strapi/utils').errors;

module.exports = async (policyContext, _config, { strapi }) => {
  const authHeader =
    policyContext.request.headers.authorization ||
    policyContext.request.headers['x-authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Bạn chưa đăng nhập');
  }

  const token = authHeader.split(' ')[1];
  const secretKey = process.env.AUTH_SECRET_KEY;

  if (!secretKey) {
    strapi.log.error('AUTH_SECRET_KEY is missing');
    throw new UnauthorizedError('Không thể xác thực');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secretKey);
  } catch (_error) {
    throw new UnauthorizedError('Token không hợp lệ hoặc đã hết hạn');
  }

  if (decoded.type !== 'access' || !decoded.sub) {
    throw new UnauthorizedError('Access token không hợp lệ');
  }

  const user = await strapi.entityService.findOne('api::user-info.user-info', decoded.sub, {
    fields: ['id', 'name', 'email', 'is_active', 'role', 'token_version'],
  });

  if (!user) {
    throw new UnauthorizedError('Người dùng không tồn tại');
  }

  if (user.is_active === false) {
    throw new UnauthorizedError('Tài khoản đã bị vô hiệu hóa');
  }

  if ((user.token_version || 0) !== decoded.tokenVersion) {
    throw new UnauthorizedError('Phiên đăng nhập không hợp lệ');
  }

  policyContext.state.userDetail = {
    ...user,
    role: user.role || 'store',
  };
  return true;
};

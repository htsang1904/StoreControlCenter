const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('@strapi/utils').errors;

const SECRET_KEY = process.env.AUTH_SECRET_KEY;

module.exports = (_config, { strapi }) => {
  return async (ctx, next) => {
    const authHeader =
      ctx.request.headers.authorization || ctx.request.headers['x-authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Bạn chưa đăng nhập');
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, SECRET_KEY);
    } catch (_error) {
      throw new UnauthorizedError('Token không hợp lệ hoặc đã hết hạn');
    }

    if (decoded.type !== 'access' || !decoded.sub) {
      throw new UnauthorizedError('Access token không hợp lệ');
    }

    const user = await strapi.entityService.findOne('api::user-info.user-info', decoded.sub, {
      fields: ['id', 'name', 'email', 'is_active', 'role', 'token_version'],
    });

    if (!user || user.is_active === false) {
      throw new UnauthorizedError('Tài khoản không hợp lệ');
    }

    if ((user.token_version || 0) !== decoded.tokenVersion) {
      throw new UnauthorizedError('Phiên đăng nhập không hợp lệ');
    }

    ctx.state.userDetail = {
      ...user,
      role: user.role || 'store',
    };
    await next();
  };
};

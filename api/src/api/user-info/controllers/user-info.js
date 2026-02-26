'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { createCoreController } = require('@strapi/strapi').factories;

const publicKeyPath = path.join(process.cwd(), 'src/keys/oauth-public.key');
const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

const ACCESS_EXPIRES_IN = process.env.AUTH_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_IN = process.env.AUTH_REFRESH_EXPIRES_IN || '30d';
const REFRESH_EXPIRES_IN_MS = Number(process.env.AUTH_REFRESH_EXPIRES_IN_MS || 30 * 24 * 60 * 60 * 1000);
const REFRESH_TOKEN_SALT = process.env.AUTH_REFRESH_TOKEN_SALT || '';

const hashToken = (token) => crypto.createHash('sha256').update(`${token}${REFRESH_TOKEN_SALT}`).digest('hex');

const signAccessToken = (payload, secretKey) =>
  jwt.sign(
    {
      sub: payload.id,
      email: payload.email,
      tokenVersion: payload.tokenVersion,
      type: 'access',
    },
    secretKey,
    { expiresIn: ACCESS_EXPIRES_IN }
  );

const signRefreshToken = (payload, secretKey) =>
  jwt.sign(
    {
      sub: payload.id,
      tokenVersion: payload.tokenVersion,
      type: 'refresh',
    },
    secretKey,
    { expiresIn: REFRESH_EXPIRES_IN }
  );

const issueTokenPair = (user, secretKey) => {
  const tokenPayload = {
    id: user.id,
    email: user.email,
    tokenVersion: user.token_version || 0,
  };

  const accessToken = signAccessToken(tokenPayload, secretKey);
  const refreshToken = signRefreshToken(tokenPayload, secretKey);

  return { accessToken, refreshToken };
};

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  is_active: user.is_active,
});

const successResponse = (message, data = {}) => ({
  success: true,
  message,
  data,
});

module.exports = createCoreController('api::user-info.user-info', ({ strapi }) => ({
  async userLogin(ctx) {
    const secretKey = process.env.AUTH_SECRET_KEY;
    if (!secretKey) {
      ctx.status = 500;
      return { success: false, message: 'Thiếu cấu hình AUTH_SECRET_KEY' };
    }

    const data = ctx.request.body || {};
    const suiteUser = data.profile || {};

    if (!data.token || !suiteUser.email) {
      ctx.status = 400;
      return {
        success: false,
        message: 'Thiếu thông tin đăng nhập',
      };
    }

    try {
      jwt.verify(data.token, publicKey, {
        algorithms: ['RS256'],
        clockTolerance: 10,
      });
    } catch (_err) {
      ctx.status = 401;
      return {
        success: false,
        message: 'Thông tin đăng nhập không chính xác',
      };
    }

    try {
      const foundUsers = await strapi.entityService.findMany('api::user-info.user-info', {
        filters: { email: suiteUser.email },
        populate: '*',
      });

      let userRecord = foundUsers[0];
      if (!userRecord) {
        userRecord = await strapi.entityService.create('api::user-info.user-info', {
          data: {
            name: suiteUser.name || '',
            email: suiteUser.email,
            suite_token: data.token,
            token_version: 0,
          },
          populate: '*',
        });
      }

      const nextTokenVersion = (userRecord.token_version || 0) + 1;
      const userForToken = {
        id: userRecord.id,
        email: userRecord.email,
        token_version: nextTokenVersion,
      };

      const { accessToken, refreshToken } = issueTokenPair(userForToken, secretKey);

      await strapi.entityService.update('api::user-info.user-info', userRecord.id, {
        data: {
          token_version: nextTokenVersion,
          refresh_token_hash: hashToken(refreshToken),
          refresh_token_expires_at: new Date(Date.now() + REFRESH_EXPIRES_IN_MS).toISOString(),
          suite_token: data.token,
        },
        populate: '*',
      });

      const responseData = {
        tokenType: 'Bearer',
        accessToken,
        refreshToken,
      };

      return successResponse('Đăng nhập thành công', responseData);
    } catch (_error) {
      ctx.status = 500;
      return {
        success: false,
        message: 'Đăng nhập thất bại',
      };
    }
  },

  async refresh(ctx) {
    const secretKey = process.env.AUTH_SECRET_KEY;
    if (!secretKey) {
      ctx.status = 500;
      return { success: false, message: 'Thiếu cấu hình AUTH_SECRET_KEY' };
    }

    const { refreshToken } = ctx.request.body || {};
    if (!refreshToken) {
      ctx.status = 400;
      return { success: false, message: 'Thiếu refresh token' };
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, secretKey);
    } catch (_error) {
      ctx.status = 401;
      return { success: false, message: 'Refresh token không hợp lệ hoặc đã hết hạn' };
    }

    if (decoded.type !== 'refresh' || !decoded.sub) {
      ctx.status = 401;
      return { success: false, message: 'Refresh token không hợp lệ' };
    }

    const user = await strapi.entityService.findOne('api::user-info.user-info', decoded.sub, {
      fields: ['id', 'name', 'email', 'is_active', 'token_version', 'refresh_token_hash', 'refresh_token_expires_at'],
    });

    if (!user || user.is_active === false) {
      ctx.status = 401;
      return { success: false, message: 'Tài khoản không hợp lệ' };
    }

    if ((user.token_version || 0) !== decoded.tokenVersion) {
      ctx.status = 401;
      return { success: false, message: 'Phiên đăng nhập đã hết hiệu lực' };
    }

    if (!user.refresh_token_hash || user.refresh_token_hash !== hashToken(refreshToken)) {
      ctx.status = 401;
      return { success: false, message: 'Refresh token không hợp lệ' };
    }

    if (!user.refresh_token_expires_at || Date.parse(user.refresh_token_expires_at) <= Date.now()) {
      ctx.status = 401;
      return { success: false, message: 'Refresh token đã hết hạn' };
    }

    const { accessToken, refreshToken: rotatedRefreshToken } = issueTokenPair(user, secretKey);

    await strapi.entityService.update('api::user-info.user-info', user.id, {
      data: {
        refresh_token_hash: hashToken(rotatedRefreshToken),
        refresh_token_expires_at: new Date(Date.now() + REFRESH_EXPIRES_IN_MS).toISOString(),
      },
    });

    const responseData = {
      tokenType: 'Bearer',
      accessToken,
      refreshToken: rotatedRefreshToken,
    };

    return successResponse('Làm mới token thành công', responseData);
  },

  async me(ctx) {
    return successResponse('Lấy thông tin người dùng thành công', {
      user: sanitizeUser(ctx.state.userDetail),
    });
  },

  async logout(ctx) {
    const user = ctx.state.userDetail;

    await strapi.entityService.update('api::user-info.user-info', user.id, {
      data: {
        refresh_token_hash: null,
        refresh_token_expires_at: null,
        token_version: (user.token_version || 0) + 1,
      },
    });

    return successResponse('Đăng xuất thành công');
  },
}));

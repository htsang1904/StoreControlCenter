'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { URL } = require('url');
const { createCoreController } = require('@strapi/strapi').factories;

const publicKeyPath = path.join(process.cwd(), 'src/keys/oauth-public.key');
const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

const ACCESS_EXPIRES_IN = process.env.AUTH_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_IN = process.env.AUTH_REFRESH_EXPIRES_IN || '30d';
const REFRESH_EXPIRES_IN_MS = Number(process.env.AUTH_REFRESH_EXPIRES_IN_MS || 30 * 24 * 60 * 60 * 1000);
const REFRESH_TOKEN_SALT = process.env.AUTH_REFRESH_TOKEN_SALT || '';
const ALLOWED_ROLES = ['store', 'handler', 'qc', 'admin'];
const SUITE_API_BASE = process.env.SUITE_API;
const SUITE_LIST_STORE_PATH = '/v1/auth/list_store';

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

const requestJson = (urlString, options = {}, timeoutMs = 15000) =>
  new Promise((resolve, reject) => {
    const urlObject = new URL(urlString);
    const client = urlObject.protocol === 'https:' ? https : http;

    const req = client.request(
      {
        method: options.method || 'GET',
        hostname: urlObject.hostname,
        port: urlObject.port,
        path: `${urlObject.pathname}${urlObject.search}`,
        headers: options.headers || {},
      },
      (res) => {
        const statusCode = Number(res.statusCode || 0);
        let body = '';

        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          if (statusCode < 200 || statusCode >= 300) {
            const httpError = new Error(`SUITE_LIST_STORE_HTTP_${statusCode}`);
            httpError.statusCode = statusCode;
            return reject(httpError);
          }

          try {
            resolve(JSON.parse(body || '{}'));
          } catch (_error) {
            reject(new Error('SUITE_LIST_STORE_INVALID_JSON'));
          }
        });
      }
    );

    req.on('error', (error) => reject(error));
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('SUITE_LIST_STORE_TIMEOUT'));
    });

    req.end();
  });

const extractSuiteStoreIds = (payload) => {
  if (!payload || payload.success !== true) {
    return [];
  }

  // Expected contract:
  // { success: true, store_ids: [2, ...], stores: { "1": [{ id: 2, ... }] } }
  if (Array.isArray(payload.store_ids)) {
    return Array.from(
      new Set(
        payload.store_ids
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    );
  }

  if (payload.stores && typeof payload.stores === 'object' && !Array.isArray(payload.stores)) {
    const ids = [];
    for (const group of Object.values(payload.stores)) {
      if (!Array.isArray(group)) continue;
      for (const store of group) {
        const value = String(store?.id || '').trim();
        if (value) ids.push(value);
      }
    }
    return Array.from(new Set(ids));
  }

  return [];
};

const mapSuiteStoresToUser = async (strapi, userId, suiteToken) => {
  const endpoint = new URL(SUITE_LIST_STORE_PATH, SUITE_API_BASE).toString();
  const payload = await requestJson(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${suiteToken}`,
    },
  });

  const suiteStoreIds = extractSuiteStoreIds(payload);
  if (!suiteStoreIds.length) {
    await strapi.entityService.update('api::user-info.user-info', userId, {
      data: {
        stores: [],
      },
    });
    return [];
  }

  const matchedStores = await strapi.entityService.findMany('api::store.store', {
    filters: {
      storeId: {
        $in: suiteStoreIds,
      },
    },
    fields: ['id', 'storeId', 'code', 'address', 'shortAddress', 'brandId'],
    publicationState: 'preview',
    start: 0,
    limit: 10000,
  });

  await strapi.entityService.update('api::user-info.user-info', userId, {
    data: {
      stores: (matchedStores || []).map((store) => store.id),
    },
  });

  return matchedStores || [];
};

const getUserProfileWithStores = async (strapi, userId) => {
  return strapi.entityService.findOne('api::user-info.user-info', userId, {
    fields: ['id', 'name', 'email', 'is_active', 'role', 'suite_token'],
    populate: {
      stores: {
        fields: ['id', 'storeId', 'code', 'address', 'shortAddress', 'brandId'],
      },
      department: {
        fields: ['id', 'name', 'code'],
      },
    },
  });
};

const sanitizeUser = (user) => {
  const stores = Array.isArray(user?.stores)
    ? user.stores.map((store) => ({
      id: store.id,
      storeId: store.storeId,
      code: store.code || null,
      address: store.address || null,
      shortAddress: store.shortAddress || null,
      brandId: store.brandId || null,
    }))
    : [];

  const primaryStore = stores[0] || null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    is_active: user.is_active,
    role: user.role || 'store',
    department: user?.department
      ? {
        id: user.department.id,
        name: user.department.name || null,
        code: user.department.code || null,
      }
      : null,
    department_id: user?.department?.id || null,
    stores,
    store_id: primaryStore?.storeId || null,
    store_name: primaryStore?.shortAddress || primaryStore?.address || primaryStore?.code || null,
  };
};

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
        const assignedRole = ALLOWED_ROLES.includes(suiteUser.role) ? suiteUser.role : 'store';
        userRecord = await strapi.entityService.create('api::user-info.user-info', {
          data: {
            name: suiteUser.name || '',
            email: suiteUser.email,
            suite_token: data.token,
            token_version: 0,
            role: assignedRole,
            is_active: false,
          },
          populate: '*',
        });
      }

      if (userRecord.is_active === false) {
        ctx.status = 403;
        return {
          success: false,
          message: 'Tài khoản chưa được cấp quyền. Vui lòng liên hệ IT để được cấp quyền truy cập.',
        };
      }

      const nextTokenVersion = (userRecord.token_version || 0) + 1;
      const userForToken = {
        id: userRecord.id,
        email: userRecord.email,
        token_version: nextTokenVersion,
      };

      const { accessToken, refreshToken } = issueTokenPair(userForToken, secretKey);

      try {
        const mappedStores = await mapSuiteStoresToUser(strapi, userRecord.id, data.token);
        strapi.log.info(`[auth] mapped ${mappedStores.length} stores for user ${userRecord.id}`);
      } catch (syncError) {
        strapi.log.warn(`[auth] sync suite stores failed for user ${userRecord.id}: ${syncError.message}`);
      }

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
      fields: [
        'id',
        'name',
        'email',
        'is_active',
        'role',
        'token_version',
        'refresh_token_hash',
        'refresh_token_expires_at',
      ],
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
    const user = await getUserProfileWithStores(strapi, ctx.state.userDetail.id);

    if (!user) {
      ctx.status = 401;
      return { success: false, message: 'Người dùng không tồn tại' };
    }

    return successResponse('Lấy thông tin người dùng thành công', {
      user: sanitizeUser(user),
    });
  },

  async syncStores(ctx) {
    const authUser = ctx.state.userDetail;

    const user = await getUserProfileWithStores(strapi, authUser.id);
    if (!user) {
      ctx.status = 401;
      return { success: false, message: 'Người dùng không tồn tại' };
    }

    if (!user.suite_token) {
      ctx.status = 400;
      return { success: false, message: 'Không có suite token để đồng bộ cửa hàng' };
    }

    try {
      const stores = await mapSuiteStoresToUser(strapi, user.id, user.suite_token);
      const updatedUser = await getUserProfileWithStores(strapi, user.id);

      return successResponse('Đồng bộ cửa hàng thành công', {
        syncedStores: stores.length,
        user: sanitizeUser(updatedUser),
      });
    } catch (error) {
      strapi.log.warn(`[auth] sync stores failed for user ${user.id}: ${error.message}`);
      if (error?.statusCode === 401) {
        ctx.status = 400;
        return {
          success: false,
          message: 'Suite token đã hết hạn hoặc không hợp lệ, vui lòng đăng nhập lại',
        };
      }

      ctx.status = 502;
      return {
        success: false,
        message: 'Không thể đồng bộ cửa hàng từ Suite',
      };
    }
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

'use strict';

/**
 * store service
 */

const { createCoreService } = require('@strapi/strapi').factories;
const https = require('https');

const MAIN_STORE_SYNC_URL = process.env.MAIN_STORE_SYNC_URL || 'https://gapi.guta.asia/webapi/stores?all_stores=true';

const requestJson = (url, timeoutMs = 30000) =>
  new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const statusCode = Number(res.statusCode || 0);
      let body = '';

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        if (statusCode < 200 || statusCode >= 300) {
          return reject(new Error(`MAIN_STORE_API_HTTP_${statusCode}`));
        }

        try {
          const parsed = JSON.parse(body || '{}');
          resolve(parsed);
        } catch (_error) {
          reject(new Error('MAIN_STORE_API_INVALID_JSON'));
        }
      });
    });

    req.on('error', (error) => reject(error));
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('MAIN_STORE_API_TIMEOUT'));
    });
  });

const extractStoreList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.stores)) return payload.stores;
  if (Array.isArray(payload?.data?.stores)) return payload.data.stores;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const normalizeStoreItem = (item) => {
  const storeId = String(
    item?.storeId ||
      item?.store_id ||
      item?.id ||
      ''
  ).trim();

  if (!storeId) {
    return null;
  }

  const code = String(item?.code || item?.store_code || '').trim();
  const address = String(item?.address || '').trim();
  const shortAddress = String(item?.shortAddress || item?.short_address || '').trim();
  const brandId = String(item?.brandId || item?.brand_id || '').trim();

  return {
    storeId,
    code: code || null,
    address: address || null,
    shortAddress: shortAddress || null,
    brandId: brandId || null,
  };
};

module.exports = createCoreService('api::store.store', ({ strapi }) => ({
  async syncStores() {
    const payload = await requestJson(MAIN_STORE_SYNC_URL);
    const sourceStores = extractStoreList(payload);

    if (!sourceStores.length) {
      return {
        synced: 0,
        created: 0,
        updated: 0,
        skipped: 0,
      };
    }

    const normalizedStores = sourceStores
      .map(normalizeStoreItem)
      .filter(Boolean);

    const existingStores = await strapi.entityService.findMany('api::store.store', {
      fields: ['id', 'storeId', 'code', 'address', 'shortAddress', 'brandId', 'publishedAt'],
      start: 0,
      limit: 10000,
      publicationState: 'preview',
    });

    const existingMap = new Map(
      (existingStores || [])
        .filter((store) => store?.storeId)
        .map((store) => [String(store.storeId), store])
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const store of normalizedStores) {
      const existed = existingMap.get(store.storeId);

      if (!existed) {
        await strapi.entityService.create('api::store.store', {
          data: {
            ...store,
            publishedAt: new Date().toISOString(),
          },
        });
        created += 1;
        continue;
      }

      const hasChanged =
        (existed.code || null) !== (store.code || null) ||
        (existed.address || null) !== (store.address || null) ||
        (existed.shortAddress || null) !== (store.shortAddress || null) ||
        (existed.brandId || null) !== (store.brandId || null) ||
        !existed.publishedAt;

      if (!hasChanged) {
        skipped += 1;
        continue;
      }

      await strapi.entityService.update('api::store.store', existed.id, {
        data: {
          ...store,
          publishedAt: existed.publishedAt || new Date().toISOString(),
        },
      });
      updated += 1;
    }

    return {
      synced: normalizedStores.length,
      created,
      updated,
      skipped,
    };
  },
}));

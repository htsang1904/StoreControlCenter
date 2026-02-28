module.exports = {
  syncStoresAtMidnight: {
    task: async ({ strapi }) => {
      try {
        const result = await strapi.service('api::store.store').syncStores();
        strapi.log.info(`[StoreSync] Done: synced=${result.synced}, created=${result.created}, updated=${result.updated}, skipped=${result.skipped}`);
      } catch (error) {
        strapi.log.error('[StoreSync] Failed', error);
      }
    },
    options: {
      rule: '0 0 * * *',
      tz: process.env.CRON_TIMEZONE || 'Asia/Ho_Chi_Minh',
    },
  },
};

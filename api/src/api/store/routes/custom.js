module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/stores/sync',
      handler: 'store.syncStores',
      config: {
        auth: false,
        policies: [
          'global::app-auth',
          {
            name: 'global::role-guard',
            config: {
              allow: ['admin'],
            },
          },
        ],
      },
    },
  ],
};

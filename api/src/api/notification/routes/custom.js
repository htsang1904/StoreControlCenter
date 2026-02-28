module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/notifications',
      handler: 'notification.listMine',
      config: {
        auth: false,
        policies: [
          'global::app-auth',
          {
            name: 'global::role-guard',
            config: {
              allow: ['store', 'handler', 'qc', 'admin'],
            },
          },
        ],
      },
    },
    {
      method: 'PATCH',
      path: '/notifications/:id/read',
      handler: 'notification.markRead',
      config: {
        auth: false,
        policies: [
          'global::app-auth',
          {
            name: 'global::role-guard',
            config: {
              allow: ['store', 'handler', 'qc', 'admin'],
            },
          },
        ],
      },
    },
    {
      method: 'PATCH',
      path: '/notifications/read-all',
      handler: 'notification.markAllRead',
      config: {
        auth: false,
        policies: [
          'global::app-auth',
          {
            name: 'global::role-guard',
            config: {
              allow: ['store', 'handler', 'qc', 'admin'],
            },
          },
        ],
      },
    },
  ],
};


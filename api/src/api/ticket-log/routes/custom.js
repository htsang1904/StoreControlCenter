module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/ticket-logs/create',
      handler: 'ticket-log.createLog',
      config: {
        auth: false,
        policies: [
          'global::app-auth',
          {
            name: 'global::role-guard',
            config: {
              allow: ['store', 'handler', 'admin'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/tickets/:ticketId/logs',
      handler: 'ticket-log.listByTicket',
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

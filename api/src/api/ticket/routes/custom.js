module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/tickets',
      handler: 'ticket.listTickets',
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
      method: 'POST',
      path: '/tickets/create',
      handler: 'ticket.createTicket',
      config: {
        auth: false,
        policies: [
          'global::app-auth',
          {
            name: 'global::role-guard',
            config: {
              allow: ['store', 'admin'],
            },
          },
        ],
      },
    },
  ],
};

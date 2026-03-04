module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/qc/tickets',
      handler: 'ticket-qc-review.listQCTickets',
      config: {
        auth: false,
        policies: [
          'global::app-auth',
          {
            name: 'global::role-guard',
            config: {
              allow: ['qc', 'admin'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/qc/tickets/:id/review',
      handler: 'ticket-qc-review.submitReview',
      config: {
        auth: false,
        policies: [
          'global::app-auth',
          {
            name: 'global::role-guard',
            config: {
              allow: ['qc', 'admin'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/qc/tickets/:id/reviews',
      handler: 'ticket-qc-review.listTicketReviews',
      config: {
        auth: false,
        policies: [
          'global::app-auth',
          {
            name: 'global::role-guard',
            config: {
              allow: ['qc', 'admin'],
            },
          },
        ],
      },
    },
  ],
};

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/dashboard/overview',
      handler: 'ticket.dashboardOverview',
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
        ],
      },
    },
    {
      method: 'POST',
      path: '/tickets/upload-attachments',
      handler: 'ticket.uploadAttachments',
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
      method: 'DELETE',
      path: '/tickets/:id',
      handler: 'ticket.deleteTicket',
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
    {
      method: 'GET',
      path: '/tickets/:id',
      handler: 'ticket.getTicketById',
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
      method: 'GET',
      path: '/tickets/:id/assignees',
      handler: 'ticket.listAssignees',
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
      path: '/tickets/:id/assignees/me',
      handler: 'ticket.assignMe',
      config: {
        auth: false,
        policies: [
          'global::app-auth',
          {
            name: 'global::role-guard',
            config: {
              allow: ['handler', 'admin'],
            },
          },
        ],
      },
    },
    {
      method: 'DELETE',
      path: '/tickets/:id/assignees/:userId',
      handler: 'ticket.unassignUser',
      config: {
        auth: false,
        policies: [
          'global::app-auth',
          {
            name: 'global::role-guard',
            config: {
              allow: ['handler', 'admin'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/tickets/:id/resolve',
      handler: 'ticket.resolveTicket',
      config: {
        auth: false,
        policies: [
          'global::app-auth',
          {
            name: 'global::role-guard',
            config: {
              allow: ['handler', 'admin'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/tickets/:id/reopen',
      handler: 'ticket.reopenTicket',
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
    {
      method: 'PUT',
      path: '/tickets/:id',
      handler: 'ticket.updateTicket',
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

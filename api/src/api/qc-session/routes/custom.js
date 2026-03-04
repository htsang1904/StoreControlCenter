module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/qc/stores/overview',
      handler: 'qc-session.storeOverview',
      config: {
        auth: false,
        policies: [
          'global::app-auth',
          {
            name: 'global::role-guard',
            config: {
              allow: ['store', 'qc', 'admin'],
            },
          },
        ],
      },
    },
    {
      method: 'GET',
      path: '/qc/sessions/overview',
      handler: 'qc-session.overview',
      config: {
        auth: false,
        policies: [
          'global::app-auth',
          {
            name: 'global::role-guard',
            config: {
              allow: ['store', 'qc', 'admin'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/qc/sessions/create',
      handler: 'qc-session.createSession',
      config: {
        auth: false,
        policies: [
          'global::app-auth',
          {
            name: 'global::role-guard',
            config: {
              allow: ['store', 'qc', 'admin'],
            },
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/qc/sessions/:id/submit',
      handler: 'qc-session.submit',
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

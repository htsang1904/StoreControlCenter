module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/qc/findings',
      handler: 'qc-finding.listAppFindings',
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
      path: '/qc/findings',
      handler: 'qc-finding.createAppFinding',
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
      method: 'PUT',
      path: '/qc/findings/:id',
      handler: 'qc-finding.updateAppFinding',
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
  ],
};

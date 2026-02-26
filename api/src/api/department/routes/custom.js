module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/departments/active',
      handler: 'department.listActive',
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

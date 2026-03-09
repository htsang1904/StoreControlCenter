module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/qc/forms',
      handler: 'qc-form.listRuntimeForms',
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
      path: '/qc/forms/:id',
      handler: 'qc-form.getRuntimeForm',
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
      path: '/admin/qc/forms',
      handler: 'qc-form.listAdminForms',
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
    {
      method: 'POST',
      path: '/admin/qc/forms',
      handler: 'qc-form.createAdminForm',
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
    {
      method: 'GET',
      path: '/admin/qc/forms/:id',
      handler: 'qc-form.getAdminForm',
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
    {
      method: 'PUT',
      path: '/admin/qc/forms/:id',
      handler: 'qc-form.updateAdminForm',
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

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/qc/drafts',
      handler: 'qc-draft.listDrafts',
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
      path: '/qc/drafts/:id',
      handler: 'qc-draft.getDraft',
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
      path: '/qc/drafts',
      handler: 'qc-draft.createDraft',
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
      method: 'PUT',
      path: '/qc/drafts/:id',
      handler: 'qc-draft.updateDraft',
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
      method: 'DELETE',
      path: '/qc/drafts/:id',
      handler: 'qc-draft.deleteDraft',
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

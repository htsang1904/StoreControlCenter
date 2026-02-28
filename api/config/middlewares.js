module.exports = ({ env }) => {
  const corsOrigins = env('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [
    'strapi::logger',
    'strapi::errors',
    'strapi::security',
    {
      name: 'strapi::cors',
      config: {
        origin: corsOrigins,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        headers: [
          'Content-Type',
          'Authorization',
          'Origin',
          'Accept',
          'X-Requested-With',
        ],
        keepHeaderOnError: true,
      },
    },
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};

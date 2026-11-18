// دالة Netlify تغلّف تطبيق Express كاملًا. المسار /api/* يُحوَّل إليها من netlify.toml
const serverless = require('serverless-http');
const app = require('../../server');
const PREFIX = '/.netlify/functions/api';
const handler = serverless(app);
exports.handler = (event, context) => {
  if (event.path && event.path.startsWith(PREFIX)) event.path = '/api' + event.path.slice(PREFIX.length);
  return handler(event, context);
};

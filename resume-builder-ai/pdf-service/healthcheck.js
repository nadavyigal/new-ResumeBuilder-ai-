/**
 * Docker health check script
 * Calls /health endpoint and exits with appropriate code
 */

const http = require('http');

const PORT = process.env.PORT || 3001;

const options = {
  host: 'localhost',
  port: PORT,
  path: '/health',
  timeout: 5000,
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const health = JSON.parse(data);
        if (health.status === 'healthy') {
          console.log('Health check passed');
          process.exit(0);
        } else {
          console.error('Health check failed: unhealthy status');
          process.exit(1);
        }
      } catch (error) {
        console.error('Health check failed: invalid JSON', error);
        process.exit(1);
      }
    });
  } else {
    console.error(`Health check failed: HTTP ${res.statusCode}`);
    process.exit(1);
  }
});

req.on('error', (err) => {
  console.error('Health check failed:', err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Health check failed: timeout');
  req.destroy();
  process.exit(1);
});

req.end();

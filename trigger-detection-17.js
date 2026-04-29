require('dotenv').config({ path: './backend/.env' });
const http = require('http');

// Call the detect products API
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/notifications/17/detect-products',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Triggering product detection for notification 17...\n');

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
    
    if (res.statusCode === 200) {
      try {
        const json = JSON.parse(data);
        console.log('\nLinked products:', json.linkedProducts || 'N/A');
      } catch (e) {
        // Not JSON
      }
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.end();

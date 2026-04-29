const bcrypt = require('bcryptjs');

// Test password verification
const password = 'test123';
const hash = '$2a$10$Ct4XdaQG0dsh9otDqjC7TeECDJAgLS3EmfwstJ9gccY5XeJAVGNx6';

bcrypt.compare(password, hash).then(result => {
  console.log('Password verification result:', result);
  
  // Also test login via API
  const fetch = require('node-fetch');
  return fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@cartis.be', password: 'test123' })
  });
}).then(response => {
  console.log('Login response status:', response.status);
  return response.json();
}).then(data => {
  console.log('Login response:', JSON.stringify(data, null, 2));
  if (data.token) {
    console.log('\n✅ Login successful!');
    console.log('Token:', data.token);
    
    // Test authenticated endpoint
    return require('node-fetch')('http://localhost:3000/api/products', {
      headers: { 'Authorization': `Bearer ${data.token}` }
    });
  }
}).then(response => {
  if (response) {
    console.log('\n✅ Authenticated request status:', response.status);
    return response.json();
  }
}).then(data => {
  if (data) {
    console.log('Products response:', JSON.stringify(data, null, 2));
  }
}).catch(error => {
  console.error('Error:', error.message);
});

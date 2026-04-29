// Test updating product status via API
const axios = require('axios');

async function test() {
  try {
    // First login to get token
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'wesley@example.com',
      password: 'wesley123'
    });
    
    const token = loginResponse.data.token;
    console.log('Login successful, token:', token.substring(0, 20) + '...');
    
    // Try to update product status (task 23, product 56)
    const updateResponse = await axios.put(
      'http://localhost:3000/api/tasks/23/products/56',
      { status: 'in_inspectie' },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('Update successful:', updateResponse.data);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

test();

// Test script to verify coordinate data for notification 11
const axios = require('axios');

async function testCoordinateAPI() {
  try {
    // First, login to get a token
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'test@cartis.be',
      password: 'test123'
    });
    
    const token = loginResponse.data.token;
    console.log('✓ Login successful');
    
    // Then fetch coordinates for notification 11
    const coordsResponse = await axios.get('http://localhost:3000/api/notifications/11/coordinates', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('\n📍 Coordinates for notification 11:');
    console.log(JSON.stringify(coordsResponse.data, null, 2));
    
    if (coordsResponse.data.length === 0) {
      console.log('\n⚠ No coordinates found!');
    } else {
      coordsResponse.data.forEach(coord => {
        console.log(`\n  ID: ${coord.id}`);
        console.log(`  Latitude: ${coord.latitude} (type: ${typeof coord.latitude})`);
        console.log(`  Longitude: ${coord.longitude} (type: ${typeof coord.longitude})`);
        console.log(`  Label: ${coord.label || '(empty)'}`);
        console.log(`  Geometry: ${coord.geometry ? 'Present' : 'null'}`);
        console.log(`  truthy check: ${!!(coord.latitude && coord.longitude)}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testCoordinateAPI();

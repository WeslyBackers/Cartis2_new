const fetch = require('node-fetch');

async function testNotificationDetail() {
  try {
    // Login
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@cartis.be', password: 'test123' })
    });
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful!\n');
    
    // Get first notification detail
    const notifResponse = await fetch('http://localhost:3000/api/notifications/1', {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    
    const notification = await notifResponse.json();
    console.log(`📋 Notification Details:\n`);
    console.log(`ID: ${notification.id}`);
    console.log(`Code: ${notification.code}`);
    console.log(`Title: ${notification.title}`);
    console.log(`Status: ${notification.status}`);
    console.log(`\nGeometry:`);
    
    if (notification.geometry) {
      const geom = JSON.parse(notification.geometry);
      console.log(`  Type: ${geom.type}`);
      if (geom.type === 'Point') {
        console.log(`  Coordinates: ${geom.coordinates[1]}°N, ${geom.coordinates[0]}°E`);
      } else {
        console.log(`  Data:`, geom);
      }
    } else {
      console.log('  No geometry');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testNotificationDetail();

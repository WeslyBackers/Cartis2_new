const fetch = require('node-fetch');

async function testNotifications() {
  try {
    // Login
    console.log('Logging in...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@cartis.be', password: 'test123' })
    });
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful!\n');
    
    // Get notifications
    console.log('Fetching notifications...');
    const notifResponse = await fetch('http://localhost:3000/api/notifications', {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    
    console.log('Response status:', notifResponse.status);
    const response = await notifResponse.json();
    const notifications = response.data || [];
    
    console.log(`\n📋 Found ${notifications.length} notifications:\n`);
    
    notifications.forEach((notif, index) => {
      console.log(`${index + 1}. ${notif.code} - ${notif.title}`);
      console.log(`   Status: ${notif.status} | Source: ${notif.source_detail}`);
      console.log(`   Date: ${notif.notification_date.split('T')[0]}`);
      console.log(`   Content: ${notif.content.substring(0, 80)}...\n`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testNotifications();

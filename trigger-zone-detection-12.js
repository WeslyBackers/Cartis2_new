/**
 * Trigger zone detection for notification 12 via API
 */

const axios = require('axios');

async function triggerZoneDetection() {
  try {
    console.log('Triggering zone detection for notification 12...');
    
    // First, try to get the notification to see if it exists
    const getResponse = await axios.get('http://localhost:3000/api/notifications/12', {
      headers: {
        'Authorization': 'Bearer fake-token-for-testing'
      }
    }).catch(() => null);
    
    if (getResponse) {
      console.log('Notification 12 exists');
    }
    
    // Trigger the zone detection endpoint
    const response = await axios.post('http://localhost:3000/api/notifications/12/detect-zones', {}, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Zone detection triggered successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    if (error.response) {
      console.error('Error response:', error.response.status, error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('Backend server is not running on port 3000');
    } else {
      console.error('Error:', error.message);
    }
  }
}

triggerZoneDetection();

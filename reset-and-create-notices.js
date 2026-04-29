// Reset all notices and create 10 new ones
require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

async function resetAndCreateNotices() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('='.repeat(60));
    console.log('RESETTING DATABASE - REMOVING ALL NOTICES');
    console.log('='.repeat(60));
    console.log();
    
    // Step 1: Count current notices
    const countResult = await client.query('SELECT COUNT(*) as count FROM notifications');
    console.log(`Current notifications in database: ${countResult.rows[0].count}`);
    console.log();
    
    // Step 2: Delete all related data first (to avoid FK constraints)
    console.log('Step 1: Deleting notification coordinates...');
    const coordsResult = await client.query('DELETE FROM notification_coordinates');
    console.log(`  ✓ Deleted ${coordsResult.rowCount} coordinates`);
    
    console.log('Step 2: Deleting notification-product links...');
    const productsResult = await client.query('DELETE FROM notifications_products');
    console.log(`  ✓ Deleted ${productsResult.rowCount} product links`);
    
    console.log('Step 3: Deleting notification zones...');
    const zonesResult = await client.query('DELETE FROM notification_zones WHERE notification_id IS NOT NULL');
    console.log(`  ✓ Deleted ${zonesResult.rowCount} zone links`);
    
    console.log('Step 4: Deleting notification comments...');
    const commentsResult = await client.query('DELETE FROM notification_comments');
    console.log(`  ✓ Deleted ${commentsResult.rowCount} comments`);
    
    console.log('Step 5: Deleting attachments...');
    const attachmentsResult = await client.query('DELETE FROM attachments');
    console.log(`  ✓ Deleted ${attachmentsResult.rowCount} attachments`);
    
    console.log('Step 6: Deleting activity logs...');
    const activityResult = await client.query("DELETE FROM activity_log WHERE entity_type = 'notification'");
    console.log(`  ✓ Deleted ${activityResult.rowCount} activity log entries`);
    
    console.log('Step 7: Deleting all notifications...');
    const notificationsResult = await client.query('DELETE FROM notifications');
    console.log(`  ✓ Deleted ${notificationsResult.rowCount} notifications`);
    
    console.log();
    console.log('='.repeat(60));
    console.log('CREATING 10 NEW NOTICES');
    console.log('='.repeat(60));
    console.log();
    
    // Get a user ID for created_by (use first user)
    const userResult = await client.query('SELECT id FROM users LIMIT 1');
    const userId = userResult.rows[0]?.id || 1;
    
    // Sample locations in Belgian/Dutch waters
    const sampleLocations = [
      { lat: 51.3, lon: 3.2, area: 'Oostende' },
      { lat: 51.4, lon: 2.9, area: 'Nieuwpoort' },
      { lat: 51.5, lon: 3.5, area: 'Zeebrugge' },
      { lat: 51.2, lon: 2.7, area: 'Franse kust' },
      { lat: 51.6, lon: 3.8, area: 'Nederlandse kust' },
      { lat: 51.35, lon: 3.1, area: 'Westende' },
      { lat: 51.45, lon: 3.3, area: 'Blankenberge' },
      { lat: 51.25, lon: 2.8, area: 'Duinkerke gebied' },
      { lat: 51.55, lon: 3.6, area: 'Vlissingen gebied' },
      { lat: 51.4, lon: 3.4, area: 'De Haan' }
    ];
    
    const sources = ['AVURNAV', 'NOTMAR', 'EGC', 'NAVTEX'];
    const statuses = ['open', 'open', 'in_progress', 'open', 'open', 'open', 'in_progress', 'open', 'open', 'open'];
    
    for (let i = 1; i <= 10; i++) {
      const location = sampleLocations[i - 1];
      const source = sources[Math.floor(Math.random() * sources.length)];
      const status = statuses[i - 1];
      const year = 2026;
      const code = `${source}-${year}-${String(i).padStart(3, '0')}`;
      
      // Create GeoJSON Point geometry
      const geometry = {
        type: 'Point',
        coordinates: [location.lon, location.lat]
      };
      
      const title = `Navigatiewaarschuwing ${location.area} ${i}`;
      const content = `<p>Navigatiewaarschuwing voor gebied ${location.area}.</p><p>Dit is een testwaarschuwing nummer ${i}.</p>`;
      
      const notificationDate = new Date(2026, 2, i); // March 2026
      
      const result = await client.query(
        `INSERT INTO notifications 
          (code, title, content, source, status, notification_date, geometry, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, code`,
        [code, title, content, source, status, notificationDate, JSON.stringify(geometry), userId]
      );
      
      console.log(`  ✓ Created notification ${i}/10: ${result.rows[0].code} (ID: ${result.rows[0].id})`);
    }
    
    await client.query('COMMIT');
    
    console.log();
    console.log('='.repeat(60));
    console.log('✓ SUCCESSFULLY RESET AND CREATED 10 NEW NOTICES');
    console.log('='.repeat(60));
    console.log();
    console.log('Next steps:');
    console.log('1. Product detection will run automatically when you view/edit notices');
    console.log('2. Zone detection will run automatically as well');
    console.log('3. You can add coordinates to any notice to expand coverage');
    console.log();
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

resetAndCreateNotices().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

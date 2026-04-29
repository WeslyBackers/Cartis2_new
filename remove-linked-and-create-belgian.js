// Remove all notices with linked products and create 10 new Belgian Maritime Area notices
require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

async function removeLinkedAndCreateBelgian() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('='.repeat(70));
    console.log('STEP 1: REMOVING NOTICES WITH LINKED PRODUCTS');
    console.log('='.repeat(70));
    console.log();
    
    // Find all notifications that have product links
    const linkedNotifications = await client.query(`
      SELECT DISTINCT n.id, n.code, n.title
      FROM notifications n
      INNER JOIN notifications_products np ON n.id = np.notification_id
      ORDER BY n.id
    `);
    
    console.log(`Found ${linkedNotifications.rows.length} notifications with linked products`);
    console.log();
    
    if (linkedNotifications.rows.length > 0) {
      console.log('Notifications to be deleted:');
      linkedNotifications.rows.forEach(n => {
        console.log(`  - [${n.id}] ${n.code || 'NO-CODE'}: ${n.title?.substring(0, 50) || 'NO-TITLE'}...`);
      });
      console.log();
      
      const notificationIds = linkedNotifications.rows.map(n => n.id);
      
      // Delete related data first
      console.log('Deleting related data...');
      
      const coordsResult = await client.query(
        'DELETE FROM notification_coordinates WHERE notification_id = ANY($1)',
        [notificationIds]
      );
      console.log(`  ✓ Deleted ${coordsResult.rowCount} coordinates`);
      
      const productsResult = await client.query(
        'DELETE FROM notifications_products WHERE notification_id = ANY($1)',
        [notificationIds]
      );
      console.log(`  ✓ Deleted ${productsResult.rowCount} product links`);
      
      const zonesResult = await client.query(
        'DELETE FROM notification_zones WHERE notification_id = ANY($1)',
        [notificationIds]
      );
      console.log(`  ✓ Deleted ${zonesResult.rowCount} zone links`);
      
      const commentsResult = await client.query(
        'DELETE FROM notification_comments WHERE notification_id = ANY($1)',
        [notificationIds]
      );
      console.log(`  ✓ Deleted ${commentsResult.rowCount} comments`);
      
      const attachmentsResult = await client.query(
        'DELETE FROM attachments WHERE notification_id = ANY($1)',
        [notificationIds]
      );
      console.log(`  ✓ Deleted ${attachmentsResult.rowCount} attachments`);
      
      const activityResult = await client.query(
        "DELETE FROM activity_log WHERE entity_type = 'notification' AND entity_id = ANY($1)",
        [notificationIds]
      );
      console.log(`  ✓ Deleted ${activityResult.rowCount} activity log entries`);
      
      // Delete the notifications
      const deleteResult = await client.query(
        'DELETE FROM notifications WHERE id = ANY($1)',
        [notificationIds]
      );
      console.log(`  ✓ Deleted ${deleteResult.rowCount} notifications`);
    } else {
      console.log('No notifications with linked products found.');
    }
    
    console.log();
    console.log('='.repeat(70));
    console.log('STEP 2: CREATING 10 NEW BELGIAN MARITIME AREA NOTICES');
    console.log('='.repeat(70));
    console.log();
    
    // Get a user ID for created_by (use first user)
    const userResult = await client.query('SELECT id FROM users LIMIT 1');
    const userId = userResult.rows[0]?.id || 1;
    
    // Belgian Maritime Area - specific locations along Belgian coast and territorial waters
    const belgianLocations = [
      { lat: 51.3300, lon: 3.0500, area: 'Oostende Haven', details: 'Havengebied Oostende' },
      { lat: 51.3500, lon: 3.1800, area: 'Thorton Bank', details: 'Windmolenpark Thorton Bank' },
      { lat: 51.3800, lon: 2.9200, area: 'Nieuwpoort', details: 'Visserijzone Nieuwpoort' },
      { lat: 51.3200, lon: 3.2000, area: 'Oostende Ankergebied', details: 'Ankerplaats voor koopvaardijschepen' },
      { lat: 51.3600, lon: 3.2500, area: 'Bligh Bank', details: 'Zandbank Bligh Bank' },
      { lat: 51.3400, lon: 2.8500, area: 'Westdiep', details: 'Vaargeul Westdiep' },
      { lat: 51.3100, lon: 3.1500, area: 'Stroombank', details: 'Zandbank Stroombank' },
      { lat: 51.3700, lon: 3.0800, area: 'Wenduine Bank', details: 'Zandbank Wenduine' },
      { lat: 51.3900, lon: 3.3000, area: 'Oostende Buiten', details: 'Buitenwateren Oostende' },
      { lat: 51.3300, lon: 2.9800, area: 'Trapegeer', details: 'Vaargeul Trapegeer' }
    ];
    
    const sources = ['AVURNAV', 'NOTMAR', 'EGC', 'NAVTEX', 'MRCC'];
    const statuses = ['open', 'open', 'in_progress', 'open', 'open', 'pending', 'open', 'in_progress', 'open', 'open'];
    const noticeTypes = [
      'Navigationele waarschuwing',
      'Bathymetrische wijziging',
      'Tijdelijke obstructie',
      'Baggerwerken',
      'Militaire oefening',
      'Defect navigatiehulpmiddel',
      'Windparkwerkzaamheden',
      'Kabellegging',
      'Wrakverwijdering',
      'Visserijbeperking'
    ];
    
    const createdNotifications = [];
    
    for (let i = 1; i <= 10; i++) {
      const location = belgianLocations[i - 1];
      const source = sources[i % sources.length];
      const status = statuses[i - 1];
      const noticeType = noticeTypes[i - 1];
      const year = 2026;
      const code = `BE-${source}-${year}-${String(i).padStart(3, '0')}`;
      
      // Create GeoJSON Point geometry
      const geometry = {
        type: 'Point',
        coordinates: [location.lon, location.lat]
      };
      
      const title = `${noticeType} - ${location.area}`;
      const content = `<p><strong>Locatie:</strong> ${location.area} (${location.details})</p>
<p><strong>Positie:</strong> ${location.lat.toFixed(4)}°N, ${location.lon.toFixed(4)}°E</p>
<p><strong>Type waarschuwing:</strong> ${noticeType}</p>
<p><strong>Belgisch Maritiem Gebied</strong> - Dit bericht heeft betrekking op de Belgische territoriale wateren en aangrenzend continentaal plat.</p>
<p>Vaartuigen worden verzocht extra waakzaam te zijn in dit gebied en de gebruikelijke voorzorgsmaatregelen in acht te nemen.</p>`;
      
      // Create dates - spread across current month
      const notificationDate = new Date(2026, 2, i); // March 2026
      
      const result = await client.query(
        `INSERT INTO notifications 
          (code, title, content, source, status, notification_date, geometry, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        RETURNING id, code, title`,
        [code, title, content, source, status, notificationDate, JSON.stringify(geometry), userId]
      );
      
      createdNotifications.push(result.rows[0]);
      console.log(`  ✓ Created ${i}/10: ${result.rows[0].code}`);
      console.log(`     ${result.rows[0].title}`);
    }
    
    await client.query('COMMIT');
    
    console.log();
    console.log('='.repeat(70));
    console.log('✓ OPERATION COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log();
    console.log(`Summary:`);
    console.log(`  - Deleted: ${linkedNotifications.rows.length} notifications with linked products`);
    console.log(`  - Created: ${createdNotifications.length} new Belgian Maritime Area notifications`);
    console.log();
    console.log('New notification IDs:', createdNotifications.map(n => n.id).join(', '));
    console.log();
    console.log('Next steps:');
    console.log('  1. Product detection can be run to link relevant products');
    console.log('  2. Zone detection will automatically link Belgian zones');
    console.log('  3. View notifications in the application to verify');
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

removeLinkedAndCreateBelgian().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

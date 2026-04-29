const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

const notifications = [
  { code: 'MSI 001/26', title: 'Navigationele waarschuwing - Haven Antwerpen', content: 'Tijdelijke obstructie in het vaarwater nabij boei A12. Verminderde diepgang tot 8.5m.', source: 'API', source_detail: 'MRCC', days_ago: 0, status: 'pending' },
  { code: 'MSI 002/26', title: 'Baggerwerken Schelde', content: 'Baggerwerken tussen km 80 en km 85 van de Schelde. Verwachte duur 3 weken.', source: 'Mail', source_detail: 'Waterwegen', days_ago: 1, status: 'pending' },
  { code: 'BASS 001/26', title: 'Defecte boei Zeebrugge', content: 'Kardinale boei Z3 buiten werking. Vervanging gepland voor volgende week.', source: 'API', source_detail: 'BASS', days_ago: 0, status: 'pending' },
  { code: 'MSI 003/26', title: 'Nieuwe kabel op zeebodem', content: 'Installatie van onderzeese kabel tussen Nederland en UK. Positie opgenomen in chart.', source: 'Manual', source_detail: 'Manual Entry', days_ago: 2, status: 'processed' },
  { code: 'MSI 004/26', title: 'Wrakverwijdering Noordzee', content: 'Wrak op positie 51°20\'N 3°15\'E wordt verwijderd. Gebied afgezet.', source: 'API', source_detail: 'MRCC', days_ago: 0, status: 'pending' },
  { code: 'POAB 012/26', title: 'Nieuw steiger Port of Antwerp', content: 'Nieuwe aanlegsteiger operationeel in dok 7. Coördinaten bijgewerkt.', source: 'API', source_detail: 'POAB', days_ago: 1, status: 'pending' },
  { code: 'MSI 005/26', title: 'Defect licht toren Westerschelde', content: 'Licht op toren WS8 tijdelijk buiten dienst. Herstel binnen 48u verwacht.', source: 'Mail', source_detail: 'Kust', days_ago: 0, status: 'pending' },
  { code: 'BASS 002/26', title: 'Verplaatsing drijvende installatie', content: 'Olieplatform verplaatst naar nieuwe positie. Update vereist voor chart NL34.', source: 'API', source_detail: 'BASS', days_ago: 0, status: 'pending' },
  { code: 'MSI 006/26', title: 'Tijdelijk verboden gebied', content: 'Militaire oefening in gebied 51°30\'N tot 51°45\'N. Geldig tot einde maand.', source: 'API', source_detail: 'MRCC', days_ago: 3, status: 'processed' },
  { code: 'FLARIS 001/26', title: 'Update binnenvaart route', content: 'Wijziging in aanbevolen route Albert Kanaal. Nieuwe markering geplaatst.', source: 'API', source_detail: 'FLARIS', days_ago: 0, status: 'pending' }
];

async function createNotifications() {
  try {
    console.log('Creating 10 sample notifications...');
    
    for (const notif of notifications) {
      const result = await pool.query(
        `INSERT INTO notifications (code, title, content, source, source_detail, notification_date, status, created_by)
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE - INTERVAL '${notif.days_ago} days', $6, 4)
         RETURNING id, code, title`,
        [notif.code, notif.title, notif.content, notif.source, notif.source_detail, notif.status]
      );
      console.log(`✓ Created: ${result.rows[0].code} - ${result.rows[0].title}`);
    }
    
    // Show count
    const countResult = await pool.query('SELECT COUNT(*) as total FROM notifications');
    console.log(`\n✅ Total notifications in database: ${countResult.rows[0].total}`);
    
    // Show pending notifications
    const pendingResult = await pool.query(
      'SELECT id, code, title, status FROM notifications WHERE status = $1 ORDER BY notification_date DESC',
      ['pending']
    );
    console.log(`\n📋 Pending notifications: ${pendingResult.rows.length}`);
    pendingResult.rows.forEach(n => {
      console.log(`   ${n.code}: ${n.title}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating notifications:', error.message);
    process.exit(1);
  }
}

createNotifications();

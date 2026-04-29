// Remove all notices and create 10 new Belgian maritime notices with product detection
require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

// Belgian Maritime Notices with realistic content
const belgianNotices = [
  {
    area: 'Schelde',
    lat: 51.3667,
    lon: 4.1500,
    type: 'Baggerwerken',
    source: 'AVURNAV',
    status: 'open',
    title: 'Baggerwerken Schelde ter hoogte van Bath',
    content: `<p><strong>Gebied:</strong> Schelde - Bath</p>
<p><strong>Type:</strong> Baggerwerken</p>
<p><strong>Positie:</strong> 51°22'N 004°09'E</p>
<p><strong>Details:</strong> Onderhoudsbaggerwerken worden uitgevoerd in het vaarwater ter hoogte van Bath. 
Verminderde doorvaartbreedte. Scheepvaart dient rekening te houden met aanwezige baggervaartuigen en 
sleephopperzuigers.</p>
<p><strong>Duur:</strong> 3 weken (vanaf 1 maart 2026)</p>
<p><strong>Contact:</strong> Waterwegen en Zeekanaal NV</p>`
  },
  {
    area: 'Antwerpen Haven',
    lat: 51.2833,
    lon: 4.2833,
    type: 'Havenoperaties',
    source: 'NOTMAR',
    status: 'open',
    title: 'Nieuwe ligplaats operationeel - Deurganckdok',
    content: `<p><strong>Gebied:</strong> Haven Antwerpen - Deurganckdok</p>
<p><strong>Type:</strong> Nieuwe infrastructuur</p>
<p><strong>Positie:</strong> 51°17'N 004°17'E</p>
<p><strong>Details:</strong> Nieuwe containerligplaats aan de noordkade van het Deurganckdok is operationeel. 
Maximale scheepsafmetingen: 400m lengte, 59m breedte, 16.5m diepgang.</p>
<p><strong>Cartografische update vereist:</strong> Update voor producten Haven Antwerpen en Schelde nautische kaarten.</p>`
  },
  {
    area: 'Zeebrugge',
    lat: 51.3500,
    lon: 3.2000,
    type: 'Defect navigatiehulpmiddel',
    source: 'EGC',
    status: 'in_progress',
    title: 'Defect licht Zeebrugge Oostdam',
    content: `<p><strong>Gebied:</strong> Haven Zeebrugge - Oostdam</p>
<p><strong>Type:</strong> Defect licht</p>
<p><strong>Positie:</strong> 51°21'N 003°12'E</p>
<p><strong>Details:</strong> Het licht op de Oostdam (Fl.R.5s) is defect. Herstelwerkzaamheden zijn in uitvoering. 
Binnenvarende schepen dienen extra waakzaam te zijn.</p>
<p><strong>Verwachte hersteldatum:</strong> 5 maart 2026</p>
<p><strong>Verantwoordelijke:</strong> Vlaamse Hydrografie - DAB Vlaamse Waterweg</p>`
  },
  {
    area: 'Belgische kust',
    lat: 51.3300,
    lon: 3.0500,
    type: 'Wrakverwijdering',
    source: 'MRCC',
    status: 'open',
    title: 'Wrakverwijdering ten noorden van Oostende',
    content: `<p><strong>Gebied:</strong> Belgische territoriale wateren - Noordelijk van Oostende</p>
<p><strong>Type:</strong> Wrakverwijdering</p>
<p><strong>Positie:</strong> 51°19'48"N 002°53'00"E</p>
<p><strong>Details:</strong> Verwijdering van wrak op positie 51°19'48"N 002°53'00"E. 
Werkgebied afgezet met kardinale boeien. Vaarverbod binnen straal van 500 meter rond werkgebied.</p>
<p><strong>Periode:</strong> 1 maart t/m 15 maart 2026</p>
<p><strong>Betrokken schepen:</strong> Kraanschip "Rambiz" en bergingsvaartuigen</p>`
  },
  {
    area: 'Thorntonbank',
    lat: 51.5500,
    lon: 2.9333,
    type: 'Windparkwerkzaamheden',
    source: 'AVURNAV',
    status: 'open',
    title: 'Onderhoudswerkzaamheden Thorntonbank windpark',
    content: `<p><strong>Gebied:</strong> Thorntonbank windmolenpark</p>
<p><strong>Type:</strong> Onderhoudswerkzaamheden windturbines</p>
<p><strong>Positie:</strong> 51°33'N 002°56'E (centrum windpark)</p>
<p><strong>Details:</strong> Onderhoudswerkzaamheden aan windturbines C05 t/m C12. 
Jack-up platform "Zeebries" gestationeerd in het gebied. Scheepvaart dient veiligheidszone van 500m rond platform te respecteren.</p>
<p><strong>Duur:</strong> 1 t/m 20 maart 2026</p>
<p><strong>VHF contact:</strong> Kanaal 74 voor coördinatie</p>`
  },
  {
    area: 'Vlissingen-Terneuzen',
    lat: 51.4400,
    lon: 3.5800,
    type: 'Bathymetrische wijziging',
    source: 'NOTMAR',
    status: 'pending',
    title: 'Nieuwe dieptelodingen Pas van Terneuzen',
    content: `<p><strong>Gebied:</strong> Westerschelde - Pas van Terneuzen</p>
<p><strong>Type:</strong> Bathymetrische update</p>
<p><strong>Positie:</strong> 51°26'24"N 003°34'48"E</p>
<p><strong>Details:</strong> Nieuwe hydrografische opname toont verdieping van het vaarwater. 
Nieuwe minimum diepte: 16.8 meter (was 15.5 meter). Update voor Westerschelde kaarten vereist.</p>
<p><strong>Survey datum:</strong> 25 februari 2026</p>
<p><strong>Bronvermelding:</strong> Vlaamse Hydrografie</p>`
  },
  {
    area: 'Nieuwpoort',
    lat: 51.1667,
    lon: 2.7333,
    type: 'Havenoperaties',
    source: 'EGC',
    status: 'open',
    title: 'Tijdelijke havensluitingen Nieuwpoort wegens sluiswerkzaamheden',
    content: `<p><strong>Gebied:</strong> Haven Nieuwpoort - Noordelijke sluis</p>
<p><strong>Type:</strong> Sluiswerkzaamheden</p>
<p><strong>Positie:</strong> 51°10'N 002°44'E</p>
<p><strong>Details:</strong> Onderhoudswerkzaamheden aan noordelijke zeesluis. Haven ontoegankelijk tijdens volgende periodes:
- 3 maart: 06:00-12:00
- 5 maart: 08:00-14:00  
- 8 maart: 06:00-18:00 (volledige dag)</p>
<p><strong>Alternatieven:</strong> Zuidelijke sluis blijft operationeel (max. 80m LOA)</p>
<p><strong>Contact:</strong> Havenmeester Nieuwpoort VHF kanaal 69</p>`
  },
  {
    area: 'Blankenberge',
    lat: 51.3167,
    lon: 3.1333,
    type: 'Tijdelijke obstructie',
    source: 'NAVTEX',
    status: 'open',
    title: 'Drijvende constructie voor Blankenberge - nieuwe golfbreker',
    content: `<p><strong>Gebied:</strong> Voor de kust van Blankenberge</p>
<p><strong>Type:</strong> Constructiewerkzaamheden golfbreker</p>
<p><strong>Positie:</strong> 51°19'N 003°08'E</p>
<p><strong>Details:</strong> Aanleg nieuwe golfbreker. Werkgebied gemarkeerd met gele speciale boeien. 
Drijvende kraan en werkplatforms aanwezig. Scheepvaart dient gebied te mijden.</p>
<p><strong>Afmetingen werkgebied:</strong> 300m x 150m</p>
<p><strong>Periode:</strong> Maart-augustus 2026</p>
<p><strong>Verantwoordelijke:</strong> Afdeling Kust - Maritieme Dienstverlening</p>`
  },
  {
    area: 'Vlakte van de Raan',
    lat: 51.5000,
    lon: 3.2500,
    type: 'Militaire oefening',
    source: 'MRCC',
    status: 'open',
    title: 'Militaire oefening Vlakte van de Raan - Schietoefeningen',
    content: `<p><strong>Gebied:</strong> Vlakte van de Raan - Belgische territoriale wateren</p>
<p><strong>Type:</strong> Militaire oefening met scherpe munitie</p>
<p><strong>Centrum positie:</strong> 51°30'N 003°15'E</p>
<p><strong>Details:</strong> Marine schietoefeningen. Oefengebied afgebakend met tijdelijke gevaarboeien. 
VAARVERBOD binnen aangeduid gebied tijdens actieve oefeningen.</p>
<p><strong>Data en tijden:</strong>
- 4 maart: 09:00-17:00
- 6 maart: 09:00-17:00
- 11 maart: 09:00-17:00</p>
<p><strong>Waarschuwing:</strong> Nautische publicatie 3007 - Belgische gevarenzones</p>
<p><strong>Contact:</strong> Belgische Marine Operations - VHF kanaal 16/67</p>`
  },
  {
    area: 'Scheur',
    lat: 51.4167,
    lon: 3.4000,
    type: 'Kabellegging',
    source: 'AVURNAV',
    status: 'in_progress',
    title: 'Kabellegging Scheur - Energiekabel Nederland-België',
    content: `<p><strong>Gebied:</strong> Scheur vaargeul</p>
<p><strong>Type:</strong> Legging onderzeese energiekabel</p>
<p><strong>Traject:</strong> Van 51°25'N 003°24'E naar Nederlandse grens</p>
<p><strong>Details:</strong> Legging van 220kV energiekabel België-Nederland. Kabelleggingsschip "Living Stone" 
actief in gebied met begeleidingsvaartuigen. Manoeuvreerbaarheid beperkt - geef ruim vrij pad.</p>
<p><strong>Minimale doorvaarthoogte boven kabel:</strong> Kabel wordt begraven op 3 meter diepte</p>
<p><strong>Periode:</strong> 1 maart t/m 30 april 2026</p>
<p><strong>VHF monitoring:</strong> Kanaal 11 voor passage coördinatie</p>
<p><strong>Ankerverbod:</strong> Na voltooiing binnen 250m kabelcorridor</p>`
  }
];

async function resetAndCreateBelgianNotices() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('='.repeat(70));
    console.log('STEP 1: REMOVING ALL EXISTING NOTICES');
    console.log('='.repeat(70));
    console.log();
    
    // Count current notifications
    const countResult = await client.query('SELECT COUNT(*) as count FROM notifications');
    console.log(`Current notifications in database: ${countResult.rows[0].count}`);
    console.log();
    
    if (countResult.rows[0].count > 0) {
      // Delete all related data first (to avoid FK constraints)
      console.log('Deleting all notification-related data...');
      
      const coordsResult = await client.query('DELETE FROM notification_coordinates');
      console.log(`  ✓ Deleted ${coordsResult.rowCount} coordinates`);
      
      const productsResult = await client.query('DELETE FROM notifications_products');
      console.log(`  ✓ Deleted ${productsResult.rowCount} product links`);
      
      const zonesResult = await client.query('DELETE FROM notification_zones');
      console.log(`  ✓ Deleted ${zonesResult.rowCount} zone links`);
      
      const commentsResult = await client.query('DELETE FROM notification_comments');
      console.log(`  ✓ Deleted ${commentsResult.rowCount} comments`);
      
      const attachmentsResult = await client.query('DELETE FROM attachments');
      console.log(`  ✓ Deleted ${attachmentsResult.rowCount} attachments`);
      
      const activityResult = await client.query("DELETE FROM activity_log WHERE entity_type = 'notification'");
      console.log(`  ✓ Deleted ${activityResult.rowCount} activity log entries`);
      
      const notificationsResult = await client.query('DELETE FROM notifications');
      console.log(`  ✓ Deleted ${notificationsResult.rowCount} notifications`);
    } else {
      console.log('No notifications to delete.');
    }
    
    console.log();
    console.log('='.repeat(70));
    console.log('STEP 2: CREATING 10 NEW BELGIAN MARITIME NOTICES');
    console.log('='.repeat(70));
    console.log();
    
    // Get a user ID for created_by
    const userResult = await client.query('SELECT id FROM users LIMIT 1');
    const userId = userResult.rows[0]?.id || 1;
    
    const createdNotifications = [];
    const year = 2026;
    
    for (let i = 0; i < belgianNotices.length; i++) {
      const notice = belgianNotices[i];
      const sequenceNum = String(i + 1).padStart(3, '0');
      const code = `BE-${notice.source}-${year}-${sequenceNum}`;
      
      // Create GeoJSON Point geometry
      const geometry = {
        type: 'Point',
        coordinates: [notice.lon, notice.lat]
      };
      
      // Create notification date (1st to 10th of March)
      const notificationDate = new Date(2026, 2, i + 1); // March 2026
      
      const result = await client.query(
        `INSERT INTO notifications 
          (code, title, content, source, status, notification_date, geometry, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        RETURNING id, code, title`,
        [code, notice.title, notice.content, notice.source, notice.status, notificationDate, JSON.stringify(geometry), userId]
      );
      
      createdNotifications.push(result.rows[0]);
      console.log(`  ✓ [${result.rows[0].id}] ${result.rows[0].code}`);
      console.log(`     ${notice.type} - ${notice.area}`);
    }
    
    await client.query('COMMIT');
    
    console.log();
    console.log('='.repeat(70));
    console.log('STEP 3: DETECTING AFFECTED PRODUCTS');
    console.log('='.repeat(70));
    console.log();
    
    // Now detect products for each notification
    const plResult = await client.query(`
      SELECT id, code, name 
      FROM production_lines 
      WHERE is_active = true
      ORDER BY id
    `);
    const productionLines = plResult.rows;
    
    let totalProductLinks = 0;
    
    for (const notification of createdNotifications) {
      const notifDetail = await client.query(
        'SELECT id, code, title, geometry FROM notifications WHERE id = $1',
        [notification.id]
      );
      
      const notif = notifDetail.rows[0];
      console.log(`\n[${notif.id}] ${notif.code}`);
      
      let hasProducts = false;
      
      for (const pl of productionLines) {
        const productsResult = await client.query(`
          SELECT p.id, p.code, p.name
          FROM products p
          WHERE p.production_line_id = $1
            AND p.is_active = true
            AND p.geometry IS NOT NULL
            AND ST_Intersects(
              ST_GeomFromGeoJSON(p.geometry),
              ST_GeomFromGeoJSON($2)
            )
        `, [pl.id, notif.geometry]);
        
        if (productsResult.rows.length > 0) {
          hasProducts = true;
          console.log(`  ${pl.name}: ${productsResult.rows.length} product(s)`);
          
          for (const product of productsResult.rows) {
            await client.query(`
              INSERT INTO notifications_products (notification_id, product_id, is_relevant)
              VALUES ($1, $2, true)
            `, [notif.id, product.id]);
            
            totalProductLinks++;
            console.log(`    ✓ ${product.code} - ${product.name}`);
          }
        }
      }
      
      if (!hasProducts) {
        console.log('  ○ No intersecting products found');
      }
    }
    
    console.log();
    console.log('='.repeat(70));
    console.log('✓ OPERATION COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log();
    console.log(`Summary:`);
    console.log(`  - Removed: All existing notifications`);
    console.log(`  - Created: ${createdNotifications.length} new Belgian maritime notices`);
    console.log(`  - Product links: ${totalProductLinks} affected products detected`);
    console.log();
    console.log('Belgian Maritime Areas covered:');
    belgianNotices.forEach((n, i) => {
      console.log(`  ${i + 1}. ${n.area} - ${n.type}`);
    });
    console.log();
    console.log('Notice types distribution:');
    const typeCount = {};
    belgianNotices.forEach(n => {
      typeCount[n.type] = (typeCount[n.type] || 0) + 1;
    });
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });
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

resetAndCreateBelgianNotices().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

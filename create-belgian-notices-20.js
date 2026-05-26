require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

const notices = [
  {
    code: 'BE-AVURNAV-2026-001',
    title: 'Installatie nieuwe windturbines Bligh Bank - fase 3',
    source: 'AVURNAV',
    source_detail: 'Agentschap Maritieme Dienstverlening en Kust',
    date: '2026-04-01',
    lat: 51.633, lon: 2.817,
    content: `<p><strong>Gebied:</strong> Belgisch Continentaal Plat - Bligh Bank</p>
<p><strong>Type:</strong> Windturbine-installatie</p>
<p><strong>Positie (centrum):</strong> 51°38'N 002°49'E</p>
<p><strong>Details:</strong> Installatie van 9 offshore windturbines (Vestas V236-15MW) op de Bligh Bank. Jack-up platform "Innovation" en heavy lift vessel "Aeolus" actief in het gebied. Scheepvaart dient veiligheidszone van 500m rond elk werkplatform te respecteren. Begeleidingsvaartuigen aanwezig voor verkeersregeling.</p>
<p><strong>Periode:</strong> 1 april t/m 30 juni 2026</p>
<p><strong>VHF contact:</strong> Kanaal 74</p>`
  },
  {
    code: 'BE-AVURNAV-2026-002',
    title: 'Kabellegging exportkabel Princess Elisabeth Zone naar kust',
    source: 'AVURNAV',
    source_detail: 'Elia Grid International',
    date: '2026-04-15',
    lat: 51.533, lon: 2.617,
    content: `<p><strong>Gebied:</strong> Belgisch Continentaal Plat - Princess Elisabeth Zone</p>
<p><strong>Type:</strong> Legging onderzeese HV-exportkabel</p>
<p><strong>Traject:</strong> 51°32'N 002°37'E naar Zeebrugge (51°21'N 003°12'E)</p>
<p><strong>Details:</strong> Legging van 220kV HVAC exportkabel. Kabelleggingsschip "Living Stone" actief met begeleidingsvaartuigen. Begraving op minimaal 1,5m diepte. Na voltooiing ankerverbod binnen 250m van kabelcorridor.</p>
<p><strong>Periode:</strong> 15 april t/m 15 juni 2026</p>
<p><strong>VHF:</strong> Kanaal 16/11</p>`
  },
  {
    code: 'BE-NAVTEX-2026-003',
    title: 'Onderhoudswerkzaamheden Thornton Bank windpark - turbines C10 t/m C18',
    source: 'NAVTEX',
    source_detail: 'C-Power NV',
    date: '2026-05-20',
    lat: 51.550, lon: 2.933,
    content: `<p><strong>Gebied:</strong> Thornton Bank windmolenpark - Belgisch Continentaal Plat</p>
<p><strong>Type:</strong> Onderhoudswerkzaamheden</p>
<p><strong>Positie:</strong> 51°33'N 002°56'E</p>
<p><strong>Details:</strong> Grootschalig preventief onderhoud windturbines C10-C18. Jack-up platform "Sea Installer" aanwezig. Service Operations Vessel "Windea Leibniz" op permanente standby. Werkschepen actief rond individuele turbines. Veiligheidszone 500m rond elk werkschip.</p>
<p><strong>Duur:</strong> 20 mei t/m 10 juni 2026</p>
<p><strong>Contact:</strong> C-Power VHF kanaal 74</p>`
  },
  {
    code: 'BE-NOTMAR-2026-004',
    title: 'Seismisch onderzoek Akkaert Bank - geofysische bodemsurvey',
    source: 'NOTMAR',
    source_detail: 'KBIN Marinetechnisch Centrum',
    date: '2026-05-03',
    lat: 51.383, lon: 2.833,
    content: `<p><strong>Gebied:</strong> Akkaert Bank - Belgisch Continentaal Plat</p>
<p><strong>Type:</strong> Geofysisch onderzoek</p>
<p><strong>Centrum positie:</strong> 51°23'N 002°50'E</p>
<p><strong>Details:</strong> Offshore geofysische survey voor bodemkartering. Onderzoeksvaartuig "Flandria Octavia" actief met sleepkabels en hydrofoonstreamer tot 500m achter het vaartuig. Koerswijzigingen zijn beperkt mogelijk. Geef ruim vrij pad.</p>
<p><strong>Periode:</strong> 3 t/m 17 mei 2026</p>
<p><strong>Instelling:</strong> KBIN - Operationele Directie Natuurlijk Milieu</p>`
  },
  {
    code: 'BE-EGC-2026-005',
    title: 'Defect sectorlicht Zeebrugge Oostdam - Fl.R.5s buiten werking',
    source: 'EGC',
    source_detail: 'MDK Vlaamse Hydrografie',
    date: '2026-04-28',
    lat: 51.355, lon: 3.215,
    content: `<p><strong>Gebied:</strong> Haven Zeebrugge - Oostdam</p>
<p><strong>Type:</strong> Defect navigatiehulpmiddel</p>
<p><strong>Positie:</strong> 51°21'18"N 003°12'54"E</p>
<p><strong>Details:</strong> Het sectorlicht Fl.R.5s op de Oostdam van Zeebrugge is tijdelijk buiten werking. Tijdelijk vervangend licht (Iso.R.4s) is geplaatst op een nabijgelegen positie. Schepen dienen extra voorzichtig te naderen en de loodsorder te raadplegen.</p>
<p><strong>Verwacht herstel:</strong> 10 mei 2026</p>
<p><strong>Verantwoordelijke:</strong> MDK - Vlaamse Hydrografie</p>`
  },
  {
    code: 'BE-NOTMAR-2026-006',
    title: 'Nieuwe aanlegsteiger LNG-terminal Zeebrugge (Jetty 3) operationeel',
    source: 'NOTMAR',
    source_detail: 'Fluxys Belgium NV',
    date: '2026-05-01',
    lat: 51.365, lon: 3.220,
    content: `<p><strong>Gebied:</strong> Haven Zeebrugge - LNG terminal</p>
<p><strong>Type:</strong> Nieuwe infrastructuur - kaartcorrectie vereist</p>
<p><strong>Positie:</strong> 51°21'54"N 003°13'12"E</p>
<p><strong>Details:</strong> Derde LNG-aanlegsteiger (Jetty 3) is operationeel. Geschikt voor Q-Flex LNG carriers. Maximale scheepsafmetingen: 315m LOA, 50m breedte, 12,5m diepgang. Kaartcorrectie vereist voor ENC BE5VLBOR en gerelateerde producten.</p>
<p><strong>Operationeel vanaf:</strong> 1 mei 2026</p>
<p><strong>Beheerder:</strong> Fluxys Belgium NV</p>`
  },
  {
    code: 'BE-AVURNAV-2026-007',
    title: 'Onderhoudsbaggerwerken toegangsgeul Oostende - beperkte doorvaartbreedte',
    source: 'AVURNAV',
    source_detail: 'MDK Afdeling Kust',
    date: '2026-04-12',
    lat: 51.237, lon: 2.910,
    content: `<p><strong>Gebied:</strong> Haven Oostende - Toegangsgeul</p>
<p><strong>Type:</strong> Baggerwerken</p>
<p><strong>Positie:</strong> 51°14'12"N 002°54'36"E</p>
<p><strong>Details:</strong> Onderhoudsbaggerwerken in de toegangsgeul van Oostende. Sleephopperzuiger "Breughel" actief in de geul. Doorvaartbreedte tijdelijk beperkt tot 60m op aangewezen passageplaatsen. Scheepvaart dient instructies havenmeester op te volgen.</p>
<p><strong>Periode:</strong> 12 t/m 30 april 2026</p>
<p><strong>Havenmeester:</strong> VHF kanaal 09 / +32 59 34 07 11</p>`
  },
  {
    code: 'BE-MRCC-2026-008',
    title: 'Explosievenruiming WWII-wrak Middelkerke Bank - tijdelijk vaarverbod',
    source: 'MRCC',
    source_detail: 'Belgische Marine - EOD',
    date: '2026-04-20',
    lat: 51.283, lon: 2.750,
    content: `<p><strong>Gebied:</strong> Middelkerke Bank - Belgische territoriale wateren</p>
<p><strong>Type:</strong> Wrakverwijdering met explosievenruiming</p>
<p><strong>Positie:</strong> 51°17'00"N 002°45'00"E</p>
<p><strong>Details:</strong> Verwijdering van WWII wrak inclusief ruiming van explosieven. VAARVERBOD in straal van 1000m tijdens gecontroleerde explosies. Bergingsvaartuig "Orion" en EOD-team aanwezig. Werkgebied gemarkeerd met kardinale boeien.</p>
<p><strong>Datum explosies:</strong> 22, 23, 24 april 2026 (09:00-17:00)</p>
<p><strong>Coördinatie:</strong> MRCC Oostende VHF 16/67</p>`
  },
  {
    code: 'BE-EGC-2026-009',
    title: 'Renovatie zeesluis Nieuwpoort - haven tijdelijk beperkt toegankelijk',
    source: 'EGC',
    source_detail: 'Havenbestuur Nieuwpoort',
    date: '2026-05-04',
    lat: 51.162, lon: 2.730,
    content: `<p><strong>Gebied:</strong> Haven Nieuwpoort</p>
<p><strong>Type:</strong> Sluisrenovatiewerkzaamheden</p>
<p><strong>Positie:</strong> 51°09'42"N 002°43'48"E</p>
<p><strong>Details:</strong> Volledige renovatie van de grote zeesluis (100m x 13m). Haven bereikbaar via kleine sluis (max 35m LOA, 4,5m diepgang) tijdens renovatie. Doksluis beschikbaar als alternatief op aanvraag bij havenmeester.</p>
<p><strong>Fase 1 (sluis gesloten):</strong> 4 mei - 31 juli 2026</p>
<p><strong>Havenmeester:</strong> VHF kanaal 69 / +32 58 23 55 49</p>`
  },
  {
    code: 'BE-MRCC-2026-010',
    title: 'NAVO oefening "Sea Shield 26" - schietoefeningen Vlakte van de Raan',
    source: 'MRCC',
    source_detail: 'Belgische Marine Operations',
    date: '2026-05-06',
    lat: 51.500, lon: 3.250,
    content: `<p><strong>Gebied:</strong> Vlakte van de Raan - Belgische en Nederlandse territoriale wateren</p>
<p><strong>Type:</strong> Internationale marinejeoefening - schietoefeningen</p>
<p><strong>Centrum:</strong> 51°30'N 003°15'E</p>
<p><strong>Details:</strong> NAVO SNMG1-taakgroep voert gecombineerde oefeningen uit. Schietoefeningen met niet-explosieve munitie. Oefengebied: 51°25'N-51°35'N / 003°05'E-003°25'E. VAARVERBOD in aangeduid gebied tijdens actieve oefeningen.</p>
<p><strong>Data:</strong> 6, 7, 8 mei 2026 (09:00-18:00)</p>
<p><strong>Coördinatie:</strong> Belgische Marine Operations / VHF 16/67</p>`
  },
  {
    code: 'BE-NOTMAR-2026-011',
    title: 'Bathymetrische update Wielingen-vaargeul - nieuwe minimum diepten kaartcorrectie',
    source: 'NOTMAR',
    source_detail: 'Vlaamse Hydrografie',
    date: '2026-04-01',
    lat: 51.383, lon: 3.317,
    content: `<p><strong>Gebied:</strong> Wielingen-vaargeul</p>
<p><strong>Type:</strong> Bathymetrische wijziging - kaartcorrectie vereist</p>
<p><strong>Positie:</strong> 51°23'N 003°19'E</p>
<p><strong>Details:</strong> Nieuwe hydrografische opname (februari 2026) toont sedimentatie in de Wielingen. Nieuwe kritische diepte: 14,8m LAT (was 15,4m LAT) bij km 15,3-16,1. Update ENC BE5VLBNK en papieren kaart vereist. Diepstekende schepen dienen actuele getijcorrectie te gebruiken.</p>
<p><strong>Survey:</strong> MVX Hydrografie, 18 februari 2026</p>
<p><strong>Effectief per:</strong> 1 april 2026</p>`
  },
  {
    code: 'BE-AVURNAV-2026-012',
    title: 'Tijdelijke uitbreiding ankergebied Scheur-West wegens havencongestie Antwerpen',
    source: 'AVURNAV',
    source_detail: 'VTS Scheldt',
    date: '2026-04-15',
    lat: 51.417, lon: 3.367,
    content: `<p><strong>Gebied:</strong> Scheur - Westelijk ankergebied</p>
<p><strong>Type:</strong> Tijdelijke ankergebieduitbreiding</p>
<p><strong>Positie:</strong> 51°25'N 003°22'E</p>
<p><strong>Details:</strong> Wegens verhoogde scheepvaartdrukte in Antwerpen wordt het ankergebied tijdelijk uitgebreid. Bijkomende ankerplaatsen beschikbaar in sector H (diepte 16-18m). Max. ankerlengte: 10 sjakel. Tij- en stroomgegevens via VTS Scheldt RadarNet.</p>
<p><strong>Geldig:</strong> 15 april t/m 30 juni 2026</p>
<p><strong>VTS Scheldt:</strong> VHF kanaal 67</p>`
  },
  {
    code: 'BE-EGC-2026-013',
    title: 'Verlegging bebakening Pas van Terneuzen - boeien T11 en T12 nieuwe positie',
    source: 'EGC',
    source_detail: 'Rijkswaterstaat Zee & Delta',
    date: '2026-05-01',
    lat: 51.433, lon: 3.783,
    content: `<p><strong>Gebied:</strong> Westerschelde - Pas van Terneuzen</p>
<p><strong>Type:</strong> Wijziging bebakening</p>
<p><strong>Positie:</strong> 51°26'N 003°47'E</p>
<p><strong>Details:</strong> Verlegging boeien T11 en T12 na bathymetrische opname. T11 (N-cardinaal): verplaatst 120m in noordoostelijke richting. T12 (RB-lateraal): verplaatst 85m zuidwaarts. Nieuwe coördinaten conform bijgevoegd coördinatenschema.</p>
<p><strong>Effectief per:</strong> 1 mei 2026</p>
<p><strong>Bron:</strong> Rijkswaterstaat / Vlaamse Hydrografie</p>`
  },
  {
    code: 'BE-NOTMAR-2026-014',
    title: 'Verdieping Deurganckdok Antwerpen voltooid - toegangsgeulen op -17,8m TAW',
    source: 'NOTMAR',
    source_detail: 'Port of Antwerp-Bruges',
    date: '2026-04-01',
    lat: 51.283, lon: 4.283,
    content: `<p><strong>Gebied:</strong> Haven Antwerpen - Deurganckdok en toegangsgeulen</p>
<p><strong>Type:</strong> Verdiepingsbaggerwerken voltooid - kaartcorrectie vereist</p>
<p><strong>Positie:</strong> 51°17'N 004°17'E</p>
<p><strong>Details:</strong> Verdiepingsbaggerwerken toegangsgeul Deurganckdok voltooid. Nieuwe beschikbare diepte: -17,8m TAW (was -16,5m TAW). Ultra Large Container Vessels tot 24.000 TEU kunnen nu aanmeren. ENC-update vereist voor BE5VLBAB. Stortplaatsen actief in Schaar van de Spijkerplaat.</p>
<p><strong>Definitief per:</strong> 1 april 2026</p>
<p><strong>Uitvoerder:</strong> DEME NV i.o.v. Port of Antwerp-Bruges</p>`
  },
  {
    code: 'BE-NOTMAR-2026-015',
    title: 'Nieuwe RoRo-terminal Waaslandhaven Noord Antwerpen operationeel - kaartwijziging',
    source: 'NOTMAR',
    source_detail: 'Port of Antwerp-Bruges',
    date: '2026-03-15',
    lat: 51.317, lon: 4.267,
    content: `<p><strong>Gebied:</strong> Haven Antwerpen - Waaslandhaven Noord</p>
<p><strong>Type:</strong> Nieuwe infrastructuur - kaartcorrectie vereist</p>
<p><strong>Positie:</strong> 51°19'N 004°16'E</p>
<p><strong>Details:</strong> Nieuwe RoRo/car-carrier terminal (3 ligplaatsen) is volledig operationeel. Keerbak vergroot: radius 300m. Nieuwe bebakening geplaatst. Kaartupdate vereist voor ENC BE5VLBAB en aanliggende producten. Maximale scheepsdiepgang toegangsgeul: 12,0m TAW.</p>
<p><strong>Operationeel vanaf:</strong> 15 maart 2026</p>
<p><strong>Beheerder:</strong> Port of Antwerp-Bruges / Euroterminal</p>`
  },
  {
    code: 'BE-AVURNAV-2026-016',
    title: 'Grootschalige baggerwerken Schelde ter hoogte van Bath en Ballastplaat',
    source: 'AVURNAV',
    source_detail: 'Afdeling Maritieme Toegang',
    date: '2026-04-01',
    lat: 51.367, lon: 4.217,
    content: `<p><strong>Gebied:</strong> Westerschelde - Bath / Ballastplaat</p>
<p><strong>Type:</strong> Onderhoudsbaggerwerken</p>
<p><strong>Positie:</strong> 51°22'N 004°13'E</p>
<p><strong>Details:</strong> Onderhoudsbaggerwerken voor toegankelijkheid Antwerpen voor diepstekende schepen. Twee sleephopperzuigers ("Jan De Nul" en "Lange Wapper") continu actief. Doorvaartbreedte ter hoogte van werkgebied: minimaal 150m gegarandeerd. Bijzondere voorzichtigheid vereist bij laagwater.</p>
<p><strong>Periode:</strong> 1 april t/m 31 mei 2026</p>
<p><strong>Rapportage:</strong> VTS Scheldt RadarNet VHF 65</p>`
  },
  {
    code: 'BE-EGC-2026-017',
    title: 'Kabellegging hoogspanningskabel onder Zeekanaal Gent-Terneuzen - ankerverbod',
    source: 'EGC',
    source_detail: 'Elia Transmission Belgium',
    date: '2026-04-10',
    lat: 51.100, lon: 3.717,
    content: `<p><strong>Gebied:</strong> Zeekanaal Gent-Terneuzen - km 14,5-16,2</p>
<p><strong>Type:</strong> Kabellegging onderwater</p>
<p><strong>Positie:</strong> 51°06'N 003°43'E</p>
<p><strong>Details:</strong> Boring en legging van 150kV HV-kabel onder het kanaal via gerichte boring. Persboor-installatie op beide oevers. Ankerverbod km 14,3-16,5 tijdens werkzaamheden. Geen hinder voor scheepvaart maar eventuele korte oponthouden mogelijk.</p>
<p><strong>Periode:</strong> 10 t/m 28 april 2026 (dag en nacht)</p>
<p><strong>Uitvoerder:</strong> Elia Transmission Belgium</p>`
  },
  {
    code: 'BE-NAVTEX-2026-018',
    title: 'Nieuwe buitenhaven Blankenberge - gewijzigde bebakening en sectorlicht',
    source: 'NAVTEX',
    source_detail: 'MDK Afdeling Kust',
    date: '2026-04-20',
    lat: 51.317, lon: 3.133,
    content: `<p><strong>Gebied:</strong> Haven Blankenberge - buitenhaven</p>
<p><strong>Type:</strong> Infrastructuurwijziging - bijgewerkte bebakening</p>
<p><strong>Positie:</strong> 51°19'N 003°08'E</p>
<p><strong>Details:</strong> Nieuw oostelijk staketselpunt van de buitenhaven is afgerond. Bebakening gewijzigd: nieuw vast groen sectorlicht (Iso.G.4s) geplaatst op nieuwe kop. Oud tijdelijk licht verwijderd. Kaartcorrectie vereist voor ENC en papieren kaart.</p>
<p><strong>Effectief:</strong> 20 april 2026</p>
<p><strong>Verantwoordelijke:</strong> MDK Afdeling Kust / Haven Blankenberge</p>`
  },
  {
    code: 'BE-AVURNAV-2026-019',
    title: 'ROV-inspectie Interconnector gaspijpleiding BCP - beperkt manoeuvreerbaar vaartuig',
    source: 'AVURNAV',
    source_detail: 'Fluxys Belgium NV',
    date: '2026-05-08',
    lat: 51.467, lon: 2.633,
    content: `<p><strong>Gebied:</strong> Belgisch Continentaal Plat - Interconnector gaspijpleiding</p>
<p><strong>Type:</strong> Offshore pijpleiding inspectie</p>
<p><strong>Traject:</strong> 51°28'N 002°38'E naar 51°41'N 002°18'E</p>
<p><strong>Details:</strong> Jaarlijkse ROV-inspectie van de Interconnector gaspijpleiding (Belgisch segment). Inspectievaartuig "Olympic Intervention IV" actief met ROV-kabel tot 200m achter boeg. Beperkt manoeuvreerbaar. Geef ruim vrij pad. Aangeraden 500m klaring te houden.</p>
<p><strong>Periode:</strong> 8 t/m 22 mei 2026</p>
<p><strong>Operator:</strong> Fluxys Belgium NV</p>`
  },
  {
    code: 'BE-EGC-2026-020',
    title: 'AIS basisstation Oostende tijdelijk buiten werking - verminderde AIS-dekking kust',
    source: 'EGC',
    source_detail: 'MDK Vlaamse Hydrografie',
    date: '2026-05-05',
    lat: 51.232, lon: 2.900,
    content: `<p><strong>Gebied:</strong> Belgische kust - Oostende en omgeving</p>
<p><strong>Type:</strong> Defect radionavigatieapparatuur</p>
<p><strong>Positie:</strong> 51°13'54"N 002°54'00"E</p>
<p><strong>Details:</strong> AIS basisstation Oostende (MMSI 002059981) is buiten werking wegens geplande onderhoudswerkzaamheden. AIS-dekking in het gebied tijdelijk verminderd. Schepen dienen standaard VHF-wachtdienst aan te houden op kanaal 16. MRCC Oostende blijft operationeel.</p>
<p><strong>Periode:</strong> 5 t/m 9 mei 2026 (08:00-18:00 lokale tijd)</p>
<p><strong>Melding:</strong> MRCC Oostende VHF 16/67</p>`
  }
];

async function createNotices() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query('SELECT id FROM users LIMIT 1');
    const userId = userResult.rows[0]?.id || 1;

    console.log(`Creating 20 Belgian maritime notices (user id: ${userId})...\n`);

    const created = [];

    for (const n of notices) {
      const geometry = JSON.stringify({ type: 'Point', coordinates: [n.lon, n.lat] });

      const result = await client.query(
        `INSERT INTO notifications (code, title, content, source, source_detail, notification_date, geometry, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, code, title`,
        [n.code, n.title, n.content, n.source, n.source_detail, n.date, geometry, userId]
      );

      created.push(result.rows[0]);
      console.log(`  [${result.rows[0].id}] ${result.rows[0].code}`);
      console.log(`       ${n.title.substring(0, 70)}...`);
    }

    await client.query('COMMIT');

    console.log('\n--- Detecting intersecting products ---\n');

    const plResult = await client.query(
      `SELECT id, code, name FROM production_lines WHERE is_active = true ORDER BY id`
    );

    let totalLinks = 0;

    for (const notif of created) {
      const row = await client.query(
        'SELECT id, geometry FROM notifications WHERE id = $1',
        [notif.id]
      );
      const geom = row.rows[0].geometry;

      let found = false;
      for (const pl of plResult.rows) {
        const products = await client.query(
          `SELECT p.id, p.code, p.name
           FROM products p
           WHERE p.production_line_id = $1
             AND p.is_active = true
             AND p.geometry IS NOT NULL
             AND ST_Intersects(ST_GeomFromGeoJSON(p.geometry), ST_GeomFromGeoJSON($2))`,
          [pl.id, geom]
        );

        if (products.rows.length > 0) {
          found = true;
          for (const prod of products.rows) {
            await client.query(
              `INSERT INTO notifications_products (notification_id, product_id, is_relevant)
               VALUES ($1, $2, true) ON CONFLICT DO NOTHING`,
              [notif.id, prod.id]
            );
            totalLinks++;
          }
          console.log(`  [${notif.id}] ${pl.code}: ${products.rows.map(p => p.code).join(', ')}`);
        }
      }
      if (!found) console.log(`  [${notif.id}] No intersecting products found`);
    }

    console.log(`\n✓ Done: 20 notices created, ${totalLinks} product links detected.`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

createNotices().catch(err => {
  console.error(err);
  process.exit(1);
});

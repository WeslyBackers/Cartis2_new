require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');
const p = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});
p.query(`
  SELECT u.id, u.email, u.first_name, u.last_name,
    json_agg(json_build_object(
      'pl', pl.code,
      'view', r.can_view,
      'edit', r.can_edit,
      'publish', r.can_publish
    )) as rights
  FROM users u
  LEFT JOIN user_production_line_rights r ON u.id = r.user_id
  LEFT JOIN production_lines pl ON r.production_line_id = pl.id
  GROUP BY u.id
  ORDER BY u.id
`).then(r => {
  r.rows.forEach(u => {
    console.log(`\n${u.first_name} ${u.last_name} (${u.email}) [id: ${u.id}]`);
    u.rights.forEach(r => {
      if (r.pl) console.log(`  ${r.pl}: view=${r.view} edit=${r.edit} publish=${r.publish}`);
    });
  });
  p.end();
}).catch(e => { console.error(e); process.exit(1); });

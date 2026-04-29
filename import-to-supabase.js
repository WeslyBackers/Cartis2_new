#!/usr/bin/env node
/**
 * CARTIS 2.0 - Supabase Database Import Script (Node.js)
 * This script imports the CARTIS database schema and data into Supabase
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function questionWithDefault(label, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  return question(`${label}${suffix}: `).then((value) => {
    const trimmed = value.trim();
    return trimmed || defaultValue;
  });
}

function questionYesNo(label, defaultValue = true) {
  const suffix = defaultValue ? ' [Y/n]' : ' [y/N]';
  return question(`${label}${suffix}: `).then((value) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return defaultValue;
    }
    return normalized === 'y' || normalized === 'yes';
  });
}

async function main() {
  console.log('==================================');
  console.log('  CARTIS 2.0 Supabase Import');
  console.log('==================================');
  console.log('');

  // Get Supabase connection details
  console.log('Supabase Project Configuration:');
  console.log('You\'ll need your Supabase database connection details from https://app.supabase.com');
  console.log('');

  const defaultHost = process.env.SUPABASE_DB_HOST || process.env.DB_HOST || '';
  const defaultPort = process.env.SUPABASE_DB_PORT || process.env.DB_PORT || '5432';
  const defaultDatabase = process.env.SUPABASE_DB_NAME || process.env.DB_NAME || 'postgres';
  const defaultUser = process.env.SUPABASE_DB_USER || process.env.DB_USER || 'postgres';

  const dbHost = await questionWithDefault('Enter database host', defaultHost);
  if (!dbHost.trim()) {
    console.error('[ERROR] Database host is required!');
    rl.close();
    process.exit(1);
  }

  const dbPortRaw = await questionWithDefault('Enter database port', defaultPort);
  const dbPort = parseInt(dbPortRaw, 10);
  if (Number.isNaN(dbPort) || dbPort <= 0) {
    console.error('[ERROR] Database port must be a valid positive number!');
    rl.close();
    process.exit(1);
  }

  const dbName = await questionWithDefault('Enter database name', defaultDatabase);
  if (!dbName.trim()) {
    console.error('[ERROR] Database name is required!');
    rl.close();
    process.exit(1);
  }

  const dbUser = await questionWithDefault('Enter database user', defaultUser);
  if (!dbUser.trim()) {
    console.error('[ERROR] Database user is required!');
    rl.close();
    process.exit(1);
  }

  const dbPassword = await question('Enter your Supabase Database Password: ');
  if (!dbPassword.trim()) {
    console.error('[ERROR] Database password is required!');
    rl.close();
    process.exit(1);
  }

  const sslEnabled = await questionYesNo('Use SSL connection', true);

  rl.close();

  console.log('');
  console.log('Connection details:');
  console.log(`  Host: ${dbHost}`);
  console.log(`  Port: ${dbPort}`);
  console.log(`  Database: ${dbName}`);
  console.log(`  User: ${dbUser}`);
  console.log(`  SSL: ${sslEnabled ? 'enabled' : 'disabled'}`);
  console.log('');

  // Create database client
  const client = new Client({
    host: dbHost,
    port: dbPort,
    database: dbName,
    user: dbUser,
    password: dbPassword,
    ssl: sslEnabled
      ? {
          rejectUnauthorized: false // Supabase uses SSL with managed cert chain
        }
      : false
  });

  // Database files to import in order
  const sqlFiles = [
    'backend/database/schema.sql',
    'backend/database/add-product-version-attachments.sql',
    'backend/database/add-opmerkingen.sql',
    'backend/database/add-notification-comments.sql',
    'backend/database/add-notification-coordinates.sql',
    'backend/database/add-geometry-to-coordinates.sql',
    'backend/database/add-task-comments-and-workflow.sql',
    'backend/database/add-task-info-requests.sql',
    'backend/database/add-task-production-line-status.sql',
    'backend/database/add-wait-for-zk-to-task-production-line-status.sql',
    'backend/database/add-task-articles.sql',
    'backend/database/add-article-titles.sql',
    'backend/database/add-note-priority.sql',
    'backend/database/add-kml-coverages.sql',
    'backend/database/add-notification-zones.sql',
    'backend/database/add-hpd-projects.sql',
    'backend/database/enable-postgis.sql',
    'backend/database/remove-status-from-notifications.sql',
    'backend/database/update-task-product-default-status.sql',
    'backend/database/drop-problematic-indexes.sql',
    'backend/database/ensure-test-user.sql'
  ];

  try {
    console.log('Connecting to Supabase...');
    await client.connect();
    console.log('[OK] Connected successfully');
    console.log('');

    let successCount = 0;
    let failCount = 0;

    for (const sqlFile of sqlFiles) {
      const filePath = path.join(__dirname, sqlFile);

      if (!fs.existsSync(filePath)) {
        console.log(`[SKIP] ${sqlFile} - File not found`);
        continue;
      }

      console.log(`Importing: ${sqlFile}`);

      try {
        const sql = fs.readFileSync(filePath, 'utf8');
        await client.query(sql);
        console.log('  [OK] Successfully imported');
        successCount++;
      } catch (error) {
        console.error(`  [ERROR] ${error.message}`);
        failCount++;
      }

      console.log('');
    }

    console.log('==================================');
    console.log('Import Summary:');
    console.log(`  Successful: ${successCount}`);
    console.log(`  Failed: ${failCount}`);
    console.log('==================================');
    console.log('');

    if (failCount === 0) {
      console.log('[SUCCESS] Database import completed successfully!');
      console.log('');
      console.log('Default credentials created:');
      console.log('  Email: admin@cartis.be');
      console.log('  Password: admin123');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Update your .env file with Supabase connection details');
      console.log(`  2. Update DB_HOST=${dbHost}`);
      console.log(`  3. Update DB_PORT=${dbPort}`);
      console.log(`  4. Update DB_NAME=${dbName}`);
      console.log(`  5. Update DB_USER=${dbUser}`);
      console.log('  6. Update DB_PASSWORD=your-password');
      console.log(`  7. Update DB_SSL=${sslEnabled ? 'true' : 'false'}`);
    } else {
      console.log('[WARNING] Some imports failed. Check the output above for details.');
    }

    console.log('');

  } catch (error) {
    console.error('[ERROR] Connection failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);

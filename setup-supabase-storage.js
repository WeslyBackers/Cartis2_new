/**
 * Setup script for Supabase Storage bucket
 * Run this script to manually create the 'attachments' bucket if needed
 * 
 * Usage: node setup-supabase-storage.js
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: './backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SECRET_KEY must be set in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function setupStorage() {
  console.log('🔍 Checking Supabase Storage...');
  
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Error listing buckets:', listError.message);
      process.exit(1);
    }
    
    const bucketExists = buckets?.some(b => b.name === 'attachments');
    
    if (bucketExists) {
      console.log('✅ Bucket "attachments" already exists');
      
      // Get bucket details
      const bucket = buckets.find(b => b.name === 'attachments');
      console.log('   Public:', bucket.public);
      console.log('   File size limit:', bucket.file_size_limit ? `${bucket.file_size_limit / 1024 / 1024} MB` : 'No limit');
    } else {
      console.log('📦 Creating bucket "attachments"...');
      
      const { data, error: createError } = await supabase.storage.createBucket('attachments', {
        public: false,
        fileSizeLimit: 52428800, // 50MB
      });
      
      if (createError) {
        console.error('❌ Error creating bucket:', createError.message);
        process.exit(1);
      }
      
      console.log('✅ Bucket "attachments" created successfully');
      console.log('   Public: false');
      console.log('   File size limit: 10 MB');
    }
    
    console.log('\n✅ Supabase Storage setup complete!');
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

setupStorage();

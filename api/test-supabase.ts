/**
 * Test Supabase Storage connection
 * Access at: https://your-domain.vercel.app/api/test-supabase
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      VERCEL: process.env.VERCEL || 'not set',
      VERCEL_ENV: process.env.VERCEL_ENV || 'not set',
    },
    configuration: {
      SUPABASE_URL: process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing',
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ? '✅ Set' : '❌ Missing',
    },
  };

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return res.status(500).json({
      ...diagnostics,
      error: 'Missing Supabase credentials',
      message: 'Set SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel dashboard',
    });
  }

  diagnostics.configuration.SUPABASE_URL_VALUE = process.env.SUPABASE_URL;

  try {
    console.log('[test-supabase] Creating Supabase client...');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log('[test-supabase] Testing connection - listing buckets...');
    const startTime = Date.now();
    const { data: buckets, error } = await supabase.storage.listBuckets();
    const duration = Date.now() - startTime;

    diagnostics.test = {
      operation: 'listBuckets',
      duration: `${duration}ms`,
    };

    if (error) {
      console.error('[test-supabase] Error:', error);
      return res.status(500).json({
        ...diagnostics,
        error: 'Supabase Storage API call failed',
        details: {
          message: error.message,
          statusCode: (error as any).statusCode,
          error: JSON.stringify(error, null, 2),
        },
      });
    }

    console.log('[test-supabase] Success! Found buckets:', buckets?.map(b => b.name));

    const attachmentsBucket = buckets?.find(b => b.name === 'attachments');

    res.status(200).json({
      ...diagnostics,
      test: {
        ...diagnostics.test,
        status: '✅ Success',
      },
      storage: {
        bucketsFound: buckets?.length || 0,
        bucketNames: buckets?.map(b => b.name) || [],
        attachmentsBucket: attachmentsBucket ? {
          name: attachmentsBucket.name,
          public: attachmentsBucket.public,
          file_size_limit: attachmentsBucket.file_size_limit,
        } : '❌ Not found',
      },
    });
  } catch (err: any) {
    console.error('[test-supabase] Exception:', err);
    res.status(500).json({
      ...diagnostics,
      error: 'Exception during Supabase test',
      details: {
        message: err?.message || String(err),
        stack: err?.stack,
        cause: err?.cause,
      },
    });
  }
}

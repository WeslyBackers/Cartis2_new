// Must run before any imports that trigger TLS connections.
// Node.js v18+ native fetch uses undici; NODE_TLS_REJECT_UNAUTHORIZED is ignored by undici.
// Set the global dispatcher to accept corporate SSL inspection proxy certificates.
import { Agent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }));

import dotenv from 'dotenv';
dotenv.config();

import app from './app';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 CARTIS 2.0 Backend running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;



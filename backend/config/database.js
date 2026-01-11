import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Determine if this is a remote database connection (not localhost)
const isRemote = process.env.DB_HOST && 
  process.env.DB_HOST !== 'localhost' && 
  process.env.DB_HOST !== '127.0.0.1';

// Build SSL configuration
// SSL is required for remote connections (like picso102.sci.pitt.edu)
// For localhost, SSL is typically not needed
let sslConfig = false;

if (isRemote) {
  // Remote connections require SSL
  // Use rejectUnauthorized: false to allow self-signed certificates
  // Set DB_SSL_REJECT_UNAUTHORIZED=true if you want strict certificate validation
  sslConfig = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
  };
} else if (process.env.DB_SSL === 'true') {
  // Explicit SSL request for localhost (uncommon but possible)
  sslConfig = {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
  };
}

// Log SSL configuration for debugging (don't log sensitive info)
if (isRemote) {
  console.log(`[DB Config] Remote database detected (${process.env.DB_HOST}), SSL enabled:`, 
    sslConfig ? `rejectUnauthorized=${sslConfig.rejectUnauthorized}` : 'false');
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'civicwatch',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: sslConfig,
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10), // Increased for remote connections
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;


/**
 * Create Database Dump
 * 
 * Creates a PostgreSQL dump of the civicwatch database.
 * Uses environment variables from .env file.
 * 
 * Usage: node scripts/create_dump.js [output_file]
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

// Get database connection details
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5432';
const DB_NAME = process.env.DB_NAME || 'civicwatch';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

// Output file format: 'custom' (faster, compressed) or 'sql' (portable, readable)
// Custom format is ~3-5x faster for large databases and produces smaller files
const format = process.argv[2] || 'custom'; // 'custom' or 'sql'
const outputFile = process.argv[3] || (() => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
  const ext = format === 'custom' ? '.dump' : '.sql';
  return join(__dirname, '..', `civicwatch_dump_${timestamp}${ext}`);
})();

async function createDump() {
  console.log('='.repeat(70));
  console.log('CivicWatch Database Dump');
  console.log('='.repeat(70));
  console.log(`Database: ${DB_NAME}`);
  console.log(`Host:     ${DB_HOST}`);
  console.log(`Port:     ${DB_PORT}`);
  console.log(`User:     ${DB_USER}`);
  console.log(`Format:   ${format === 'custom' ? 'Custom (compressed, fast)' : 'SQL (portable, readable)'}`);
  console.log(`Output:   ${outputFile}`);
  console.log('');

  // Build pg_dump command
  const pgDumpCmd = [
    'pg_dump',
    `-h ${DB_HOST}`,
    `-p ${DB_PORT}`,
    `-U ${DB_USER}`,
    `-d ${DB_NAME}`,
    format === 'custom' ? '-F c' : '-F p', // Custom format or plain SQL
    '--no-owner',
    '--no-privileges',
    '--clean',
    '--if-exists',
    '--verbose',
    `-f "${outputFile}"`
  ].join(' ');

  // Set password in environment
  const env = { ...process.env, PGPASSWORD: DB_PASSWORD };

  console.log('Creating dump...');
  try {
    const { stdout, stderr } = await execAsync(pgDumpCmd, { env });
    
    if (stderr && !stderr.includes('NOTICE')) {
      console.warn('Warnings:', stderr);
    }
    
    console.log('');
    console.log('✓ Dump created successfully!');
    console.log('');
    console.log(`File: ${outputFile}`);
    
    // Get file size
    const stats = statSync(outputFile);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`Size: ${sizeMB} MB`);
    console.log('');
    console.log('To restore this dump, run:');
    if (format === 'custom') {
      console.log(`  npm run load-dump "${outputFile}"`);
      console.log('');
      console.log('Note: Custom format is faster and produces smaller files.');
      console.log('      For SQL format, use: npm run create-dump sql [output_file]');
    } else {
      console.log(`  npm run load-dump "${outputFile}"`);
      console.log('');
      console.log('Note: SQL format is portable and human-readable.');
      console.log('      For faster custom format, use: npm run create-dump custom [output_file]');
    }
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('');
    console.error('Error creating dump:', error.message);
    if (error.stderr) {
      console.error('Details:', error.stderr);
    }
    console.error('');
    console.error('Make sure:');
    console.error('  1. PostgreSQL is running');
    console.error('  2. pg_dump is installed and in your PATH');
    console.error('  3. Database credentials in .env are correct');
    console.error('  4. You have permission to access the database');
    process.exit(1);
  }
}

createDump().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

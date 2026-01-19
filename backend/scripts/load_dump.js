/**
 * Load Database Dump
 * 
 * Restores a PostgreSQL dump file into the civicwatch database.
 * Uses environment variables from .env file.
 * 
 * Usage: node scripts/load_dump.js <dump_file>
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import readline from 'readline';

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

async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function ensureDatabaseExists() {
  const env = { ...process.env, PGPASSWORD: DB_PASSWORD };
  
  // Check if database exists by connecting to postgres database
  const checkCmd = [
    'psql',
    `-h ${DB_HOST}`,
    `-p ${DB_PORT}`,
    `-U ${DB_USER}`,
    '-d postgres',
    '-t',
    `-c "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}';"`
  ].join(' ');
  
  try {
    const { stdout } = await execAsync(checkCmd, { env });
    const exists = stdout.trim() === '1';
    
    if (!exists) {
      console.log(`Database '${DB_NAME}' does not exist. Creating it...`);
      
      const createCmd = [
        'psql',
        `-h ${DB_HOST}`,
        `-p ${DB_PORT}`,
        `-U ${DB_USER}`,
        '-d postgres',
        `-c "CREATE DATABASE ${DB_NAME};"`
      ].join(' ');
      
      await execAsync(createCmd, { env });
      console.log(`✓ Database '${DB_NAME}' created successfully`);
      console.log('');
    } else {
      console.log(`Database '${DB_NAME}' already exists`);
      console.log('');
    }
  } catch (error) {
    // If postgres database doesn't exist, try template1
    try {
      const createCmd = [
        'psql',
        `-h ${DB_HOST}`,
        `-p ${DB_PORT}`,
        `-U ${DB_USER}`,
        '-d template1',
        `-c "CREATE DATABASE ${DB_NAME};"`
      ].join(' ');
      
      await execAsync(createCmd, { env });
      console.log(`✓ Database '${DB_NAME}' created successfully`);
      console.log('');
    } catch (err) {
      throw new Error(`Failed to create database: ${err.message}`);
    }
  }
}

async function loadDump() {
  const dumpFile = process.argv[2];
  
  if (!dumpFile) {
    console.error('Error: Please provide a dump file path');
    console.error('');
    console.error('Usage: node scripts/load_dump.js <dump_file>');
    console.error('');
    console.error('Example:');
    console.error('  npm run load-dump civicwatch_dump_20240116_120000.sql');
    process.exit(1);
  }
  
  const resolvedDumpFile = resolve(dumpFile);
  
  if (!existsSync(resolvedDumpFile)) {
    console.error(`Error: Dump file not found: ${resolvedDumpFile}`);
    process.exit(1);
  }
  
  console.log('='.repeat(70));
  console.log('CivicWatch Database Restore');
  console.log('='.repeat(70));
  console.log(`Dump file: ${resolvedDumpFile}`);
  console.log(`Database:  ${DB_NAME}`);
  console.log(`Host:      ${DB_HOST}`);
  console.log(`Port:      ${DB_PORT}`);
  console.log(`User:      ${DB_USER}`);
  console.log('');
  
  // Warning about data loss
  console.log('⚠️  WARNING: This will DROP and recreate all tables!');
  console.log('   All existing data in the civicwatch database will be lost.');
  console.log('');
  
  const confirmed = await confirm('Are you sure you want to continue?');
  
  if (!confirmed) {
    console.log('Restore cancelled.');
    process.exit(0);
  }
  
  console.log('');
  console.log('Checking database...');
  await ensureDatabaseExists();
  
  console.log('Restoring database...');
  console.log('');
  
  // Detect format: custom format (.dump) uses pg_restore, SQL format (.sql) uses psql
  const isCustomFormat = resolvedDumpFile.endsWith('.dump');
  const restoreTool = isCustomFormat ? 'pg_restore' : 'psql';
  const formatName = isCustomFormat ? 'custom (compressed)' : 'plain SQL';
  
  console.log(`Detected format: ${formatName}`);
  console.log(`Using tool: ${restoreTool}`);
  console.log('');
  
  // Build restore command based on format
  let restoreCmd;
  if (isCustomFormat) {
    // Custom format: use pg_restore (faster, supports parallel restore)
    restoreCmd = [
      'pg_restore',
      `-h ${DB_HOST}`,
      `-p ${DB_PORT}`,
      `-U ${DB_USER}`,
      `-d ${DB_NAME}`,
      '--no-owner',
      '--no-privileges',
      '--verbose',
      `"${resolvedDumpFile}"`
    ].join(' ');
  } else {
    // Plain SQL format: use psql
    restoreCmd = [
      'psql',
      `-h ${DB_HOST}`,
      `-p ${DB_PORT}`,
      `-U ${DB_USER}`,
      `-d ${DB_NAME}`,
      '-v ON_ERROR_STOP=1',
      `-f "${resolvedDumpFile}"`
    ].join(' ');
  }
  
  // Set password in environment
  const env = { ...process.env, PGPASSWORD: DB_PASSWORD };
  
  try {
    const { stdout, stderr } = await execAsync(restoreCmd, { env });
    
    if (stdout) {
      console.log(stdout);
    }
    
    if (stderr && !stderr.includes('NOTICE') && !stderr.includes('WARNING')) {
      console.warn('Warnings:', stderr);
    }
    
    console.log('');
    console.log('✓ Database restored successfully!');
    console.log('');
    console.log('Verifying restore...');
    
    // Verify by counting records
    const verifyCmd = [
      'psql',
      `-h ${DB_HOST}`,
      `-p ${DB_PORT}`,
      `-U ${DB_USER}`,
      `-d ${DB_NAME}`,
      '-t',  // tuples only
      '-c "SELECT COUNT(*) FROM posts;"'
    ].join(' ');
    
    const { stdout: countOutput } = await execAsync(verifyCmd, { env });
    const postCount = parseInt(countOutput.trim());
    
    console.log(`  Posts:       ${postCount.toLocaleString()}`);
    
    const { stdout: legCount } = await execAsync(
      verifyCmd.replace('posts', 'legislators'),
      { env }
    );
    console.log(`  Legislators: ${parseInt(legCount.trim()).toLocaleString()}`);
    
    const { stdout: topicCount } = await execAsync(
      verifyCmd.replace('posts', 'topics'),
      { env }
    );
    console.log(`  Topics:      ${parseInt(topicCount.trim()).toLocaleString()}`);
    
    console.log('');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('');
    console.error('Error restoring dump:', error.message);
    if (error.stderr) {
      console.error('Details:', error.stderr);
    }
    console.error('');
    console.error('Make sure:');
    console.error('  1. PostgreSQL is running');
    console.error(`  2. ${restoreTool} is installed and in your PATH`);
    console.error('  3. Database credentials in .env are correct');
    console.error('  4. You have permission to create databases');
    console.error('  5. You have permission to access the database');
    if (isCustomFormat) {
      console.error('  6. For custom format dumps, pg_restore is required');
    } else {
      console.error('  6. For SQL format dumps, psql is required');
    }
    process.exit(1);
  }
}

loadDump().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

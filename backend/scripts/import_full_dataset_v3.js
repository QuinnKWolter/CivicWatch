/**
 * CivicWatch Full Dataset Import v3 (Enhanced)
 * 
 * Changes from v2:
 * - Captures ALL meaningful fields from CSV and JSONL files
 * - Adds comprehensive toxicity sub-scores (severe_toxicity, obscene, threat, insult, identity_attack)
 * - Adds all engagement metrics (reply_count, quote_count, favorite_count)
 * - Captures topic assignment confidence (topic_probability)
 * - Captures misinformation score/flag (count_misinfo)
 * - Ignores duplicate/redundant fields (_id, id_str, etc.)
 * - Maintains all v2 functionality (auto-increment PK, nullable tweet_id, etc.)
 * 
 * Enhanced Metadata Integration:
 * - Loads official_data.csv and account.csv for complete legislator metadata
 * - Matches by author_id1 (official_data.csv) and twitter_authorid (account.csv)
 * - Populates name, party, chamber, state from official_data.csv
 * - Uses handle_1/handle_2 and twitter_handle as fallbacks
 * 
 * Usage: node scripts/import_full_dataset_v3.js
 */

import { createReadStream, readdirSync, existsSync } from 'fs';
import { createInterface } from 'readline';
import { parse } from 'csv-parse';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CSV_DIR = process.env.CSV_DIR || 'D:\\tweet_exports_cleaned';
const JSONL_DIR = process.env.JSONL_DIR || 'D:\\classified_tweets\\stage2_topic';
const OFFICIAL_DATA_CSV = process.env.OFFICIAL_DATA_CSV || join(__dirname, '..', '..', 'official_data.csv');
const ACCOUNT_CSV = process.env.ACCOUNT_CSV || join(__dirname, '..', '..', 'account.csv');
// Reduced batch size for v3 due to more fields (22 vs 12 in v2)
// PostgreSQL limit: 65,535 parameters per query
// 22 fields * 2000 posts = 44,000 parameters (safe margin)
const BATCH_SIZE = 2000;
const LOG_INTERVAL = 100000;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'civicwatch',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1'
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' }
    : false,
  max: 5,
});

// ============================================================================
// Schema DDL - V3 with comprehensive fields
// ============================================================================

const SCHEMA_DDL = `
-- Drop existing objects
DROP MATERIALIZED VIEW IF EXISTS topic_state_breakdown CASCADE;
DROP MATERIALIZED VIEW IF EXISTS topic_party_breakdown CASCADE;
DROP MATERIALIZED VIEW IF EXISTS topic_engagement_daily CASCADE;
DROP VIEW IF EXISTS legislator_summary CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS topics CASCADE;
DROP TABLE IF EXISTS legislators CASCADE;

-- Create legislators table (lid = author_id, always numeric)
-- Enhanced with comprehensive metadata from official_data.csv
CREATE TABLE legislators (
  lid TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  handle TEXT,
  state TEXT,
  chamber TEXT CHECK (chamber IS NULL OR chamber IN ('H', 'S')),
  party TEXT CHECK (party IS NULL OR party IN ('Democratic', 'Republican', 'Independent', 'Other')),
  
  -- Official identifiers
  official_id TEXT,
  author_id2 TEXT,
  
  -- Personal information
  firstname TEXT,
  lastname TEXT,
  gender TEXT,
  race TEXT,
  
  -- Electoral information
  district_num TEXT,
  district_num_sld TEXT,
  district_name TEXT,
  district_type TEXT,
  district_ocdid TEXT,
  yr_elected INTEGER,
  yr_left_office INTEGER,
  vote_pct DOUBLE PRECISION,
  yr_vote INTEGER,
  bp_url TEXT,
  
  -- Geographic identifiers
  state_fips TEXT,
  sld_fips TEXT,
  state_full TEXT,
  
  -- Office information
  office_name TEXT,
  office_level TEXT,
  office_branch TEXT,
  
  -- Social media handles
  handle_1 TEXT,
  handle_2 TEXT,
  camphand TEXT,
  offhand TEXT,
  perhand TEXT,
  
  -- Ideology and political metrics
  shor_ideo DOUBLE PRECISION,
  median_chamber DOUBLE PRECISION,
  dis_median DOUBLE PRECISION,
  median_party DOUBLE PRECISION,
  heterogeneity DOUBLE PRECISION,
  polarization DOUBLE PRECISION,
  mrp_ideology DOUBLE PRECISION,
  mrp_ideology_se DOUBLE PRECISION,
  boundaries_election_year INTEGER,
  demshare_pres DOUBLE PRECISION,
  
  -- Source information
  source_1 TEXT,
  source_2 TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_legislators_handle ON legislators(handle);
CREATE INDEX idx_legislators_state ON legislators(state);
CREATE INDEX idx_legislators_party ON legislators(party);

-- Create topics table
CREATE TABLE topics (
  topic TEXT PRIMARY KEY NOT NULL,
  topic_label TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create posts table with auto-increment PK and comprehensive fields
CREATE TABLE posts (
  id BIGSERIAL PRIMARY KEY,
  tweet_id TEXT,  -- Nullable, may be missing for some records
  
  -- Core post information
  lid TEXT NOT NULL REFERENCES legislators(lid) ON DELETE CASCADE,
  created_at DATE NOT NULL,
  text TEXT,
  
  -- Engagement metrics (all available)
  retweet_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  quote_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,  -- May be same as like_count, but capture if present
  
  -- Content classification
  topic TEXT NOT NULL REFERENCES topics(topic) ON DELETE RESTRICT,
  topic_probability DOUBLE PRECISION,  -- Confidence score for topic assignment (0-1)
  topic_confidence DOUBLE PRECISION,   -- Alias for topic_probability if provided separately
  
  -- Toxicity scores (comprehensive)
  tox_toxicity DOUBLE PRECISION,              -- Overall toxicity score
  tox_severe_toxicity DOUBLE PRECISION,       -- Severe toxicity sub-score
  tox_obscene DOUBLE PRECISION,               -- Obscene content score
  tox_threat DOUBLE PRECISION,                -- Threat detection score
  tox_insult DOUBLE PRECISION,                -- Insult detection score
  tox_identity_attack DOUBLE PRECISION,       -- Identity attack score
  
  -- Misinformation and credibility
  count_misinfo INTEGER DEFAULT 0,           -- Misinformation flag/count
  misinfo_score DOUBLE PRECISION,             -- Misinformation score if available
  
  -- Political classification
  political_score DOUBLE PRECISION,           -- Political content score
  is_political BOOLEAN,                       -- Binary political classification
  
  -- Metadata
  created_at_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_posts_tweet_id ON posts(tweet_id) WHERE tweet_id IS NOT NULL;
CREATE INDEX idx_posts_created_at ON posts(created_at);
CREATE INDEX idx_posts_lid ON posts(lid);
CREATE INDEX idx_posts_topic ON posts(topic);
CREATE INDEX idx_posts_lid_date ON posts(lid, created_at);
CREATE INDEX idx_posts_topic_probability ON posts(topic, topic_probability) WHERE topic_probability IS NOT NULL;
CREATE INDEX idx_posts_tox_toxicity ON posts(tox_toxicity) WHERE tox_toxicity IS NOT NULL;
CREATE INDEX idx_posts_tox_severe_toxicity ON posts(tox_severe_toxicity) WHERE tox_severe_toxicity IS NOT NULL;
CREATE INDEX idx_posts_count_misinfo ON posts(count_misinfo) WHERE count_misinfo > 0;

-- Create legislator_summary view
CREATE VIEW legislator_summary AS
SELECT 
  l.lid, l.name, l.handle, l.state, l.chamber, l.party,
  count(p.id) AS total_posts,
  sum(p.like_count) AS total_likes,
  sum(p.retweet_count) AS total_retweets,
  sum(p.reply_count) AS total_replies,
  sum(p.quote_count) AS total_quotes,
  min(p.created_at) AS first_post_date,
  max(p.created_at) AS last_post_date
FROM legislators l
LEFT JOIN posts p ON l.lid = p.lid
GROUP BY l.lid, l.name, l.handle, l.state, l.chamber, l.party;

-- Create materialized views
CREATE MATERIALIZED VIEW topic_engagement_daily AS
SELECT 
  p.created_at AS date,
  p.topic,
  t.topic_label,
  count(*) AS post_count,
  sum(p.like_count) AS total_likes,
  sum(p.retweet_count) AS total_retweets,
  sum(p.reply_count) AS total_replies,
  sum(p.quote_count) AS total_quotes
FROM posts p
JOIN topics t ON p.topic = t.topic
GROUP BY p.created_at, p.topic, t.topic_label
WITH NO DATA;

CREATE MATERIALIZED VIEW topic_party_breakdown AS
SELECT 
  p.topic,
  t.topic_label,
  l.party,
  count(*) AS post_count,
  sum(p.like_count) AS total_likes,
  sum(p.retweet_count) AS total_retweets,
  sum(p.reply_count) AS total_replies,
  sum(p.quote_count) AS total_quotes
FROM posts p
JOIN topics t ON p.topic = t.topic
JOIN legislators l ON p.lid = l.lid
WHERE l.party IS NOT NULL
GROUP BY p.topic, t.topic_label, l.party
WITH NO DATA;

CREATE MATERIALIZED VIEW topic_state_breakdown AS
SELECT 
  p.topic,
  t.topic_label,
  l.state,
  count(*) AS post_count,
  sum(p.like_count) AS total_likes,
  sum(p.retweet_count) AS total_retweets,
  sum(p.reply_count) AS total_replies,
  sum(p.quote_count) AS total_quotes
FROM posts p
JOIN topics t ON p.topic = t.topic
JOIN legislators l ON p.lid = l.lid
WHERE l.state IS NOT NULL
GROUP BY p.topic, t.topic_label, l.state
WITH NO DATA;
`;

// ============================================================================
// Utility Functions
// ============================================================================

function extractDateRange(filename) {
  const match = filename.match(/(\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function normalizeId(id) {
  if (!id) return null;
  let str = String(id).trim();
  if (!str) return null;
  // Handle scientific notation
  if (str.includes('e') || str.includes('E')) {
    try {
      str = BigInt(parseFloat(str)).toString();
    } catch {
      // Keep as-is
    }
  }
  // Remove decimal portion
  if (str.includes('.')) {
    str = str.split('.')[0];
  }
  // Remove 'i' prefix from account.csv twitter_authorid
  if (str.startsWith('i')) {
    str = str.substring(1);
  }
  return str || null;
}

function normalizeParty(party) {
  if (!party) return null;
  const p = String(party).trim();
  // Normalize party names
  if (p.toLowerCase().includes('democratic') || p.toLowerCase() === 'd') return 'Democratic';
  if (p.toLowerCase().includes('republican') || p.toLowerCase() === 'r') return 'Republican';
  if (p.toLowerCase().includes('independent')) return 'Independent';
  return 'Other';
}

function normalizeState(state) {
  if (!state) return null;
  const s = String(state).trim();
  // If it's already a 2-letter code, return as-is
  if (s.length === 2) return s.toUpperCase();
  // Map common state names to codes (basic mapping - can be expanded)
  const stateMap = {
    'new york': 'NY', 'california': 'CA', 'texas': 'TX', 'florida': 'FL',
    'illinois': 'IL', 'pennsylvania': 'PA', 'ohio': 'OH', 'georgia': 'GA',
    'north carolina': 'NC', 'michigan': 'MI', 'new jersey': 'NJ', 'virginia': 'VA',
    'washington': 'WA', 'arizona': 'AZ', 'massachusetts': 'MA', 'tennessee': 'TN',
    'indiana': 'IN', 'missouri': 'MO', 'maryland': 'MD', 'wisconsin': 'WI',
    'colorado': 'CO', 'minnesota': 'MN', 'south carolina': 'SC', 'alabama': 'AL',
    'louisiana': 'LA', 'kentucky': 'KY', 'oregon': 'OR', 'oklahoma': 'OK',
    'connecticut': 'CT', 'utah': 'UT', 'iowa': 'IA', 'nevada': 'NV',
    'arkansas': 'AR', 'mississippi': 'MS', 'kansas': 'KS', 'new mexico': 'NM',
    'nebraska': 'NE', 'west virginia': 'WV', 'idaho': 'ID', 'hawaii': 'HI',
    'new hampshire': 'NH', 'maine': 'ME', 'montana': 'MT', 'rhode island': 'RI',
    'delaware': 'DE', 'south dakota': 'SD', 'north dakota': 'ND', 'alaska': 'AK',
    'vermont': 'VT', 'wyoming': 'WY', 'district of columbia': 'DC'
  };
  return stateMap[s.toLowerCase()] || s.toUpperCase().substring(0, 2);
}

function parseJsonlLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function parseFloatSafe(value, defaultValue = null) {
  if (value === null || value === undefined || value === '') return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseIntSafe(value, defaultValue = 0) {
  if (value === null || value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

async function countCsvRecords(csvPath) {
  return new Promise((resolve) => {
    let count = 0;
    const parser = createReadStream(csvPath, { encoding: 'utf-8' })
      .pipe(parse({
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        skip_records_with_error: true,
        relax_quotes: true,
      }));
    parser.on('data', () => count++);
    parser.on('end', () => resolve(count));
    parser.on('error', () => resolve(count));
  });
}

async function countJsonlRecords(jsonlPath) {
  return new Promise((resolve) => {
    let count = 0;
    const rl = createInterface({
      input: createReadStream(jsonlPath, { encoding: 'utf-8' }),
      crlfDelay: Infinity
    });
    rl.on('line', (line) => { if (line.trim()) count++; });
    rl.on('close', () => resolve(count));
  });
}

async function loadJsonlToMap(jsonlPath) {
  const map = new Map();
  const rl = createInterface({
    input: createReadStream(jsonlPath, { encoding: 'utf-8' }),
    crlfDelay: Infinity
  });
  
  for await (const line of rl) {
    if (!line.trim()) continue;
    const record = parseJsonlLine(line);
    if (!record) continue;
    
    const tweetId = normalizeId(record.tweet_id);
    if (tweetId) {
      const topTopics = record.stage2_topic?.top_topics || [];
      map.set(tweetId, {
        topic: topTopics[0] || null,
        political_score: record.stage1_political?.political_score ?? null,
        is_political: record.stage1_political?.is_political ?? null
      });
    }
  }
  return map;
}

// ============================================================================
// Main Import Logic
// ============================================================================

async function main() {
  const client = await pool.connect();
  const startTime = Date.now();
  
  try {
    console.log('='.repeat(70));
    console.log('CivicWatch Full Dataset Import v3');
    console.log('='.repeat(70));
    console.log(`CSV Directory:   ${CSV_DIR}`);
    console.log(`JSONL Directory: ${JSONL_DIR}`);
    console.log('');
    
    // Get file lists
    const csvFiles = readdirSync(CSV_DIR).filter(f => f.endsWith('.csv')).sort();
    const jsonlFiles = readdirSync(JSONL_DIR).filter(f => f.endsWith('.jsonl')).sort();
    
    console.log(`Found ${csvFiles.length} CSV files`);
    console.log(`Found ${jsonlFiles.length} JSONL files`);
    console.log('');
    
    // ========================================================================
    // Phase 1: Count ALL records upfront
    // ========================================================================
    console.log('Phase 1: Counting all records (this may take a while)...');
    
    let totalCsvRecords = 0;
    let totalJsonlRecords = 0;
    
    for (let i = 0; i < csvFiles.length; i++) {
      const count = await countCsvRecords(join(CSV_DIR, csvFiles[i]));
      totalCsvRecords += count;
      if ((i + 1) % 20 === 0 || i === csvFiles.length - 1) {
        console.log(`  CSV files: ${i + 1}/${csvFiles.length} (${totalCsvRecords.toLocaleString()} records so far)`);
      }
    }
    
    for (let i = 0; i < jsonlFiles.length; i++) {
      const count = await countJsonlRecords(join(JSONL_DIR, jsonlFiles[i]));
      totalJsonlRecords += count;
    }
    
    console.log('');
    console.log(`  TOTAL CSV RECORDS:   ${totalCsvRecords.toLocaleString()}`);
    console.log(`  TOTAL JSONL RECORDS: ${totalJsonlRecords.toLocaleString()}`);
    console.log('');
    
    // ========================================================================
    // Phase 2: Create Schema
    // ========================================================================
    console.log('Phase 2: Creating database schema...');
    await client.query(SCHEMA_DDL);
    
    // Insert "Unclassified" topic for posts without JSONL match
    await client.query(`INSERT INTO topics (topic, topic_label) VALUES ('0', 'Unclassified')`);
    console.log('  Schema created, "Unclassified" topic added');
    console.log('');
    
    // ========================================================================
    // Phase 2.5: Load metadata files (official_data.csv and account.csv)
    // ========================================================================
    console.log('Phase 2.5: Loading metadata files...');
    
    const officialDataMap = new Map(); // Indexed by author_id1
    const accountDataMap = new Map();   // Indexed by twitter_authorid
    
    // Load official_data.csv
    if (existsSync(OFFICIAL_DATA_CSV)) {
      console.log(`  Loading ${basename(OFFICIAL_DATA_CSV)}...`);
      let officialCount = 0;
      
      await new Promise((resolve, reject) => {
        const parser = createReadStream(OFFICIAL_DATA_CSV, { encoding: 'utf-8' })
          .pipe(parse({
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true,
            skip_records_with_error: true,
            relax_quotes: true,
          }));
        
        parser.on('data', (record) => {
          const authorId1 = normalizeId(record.author_id1);
          const authorId2 = normalizeId(record.author_id2);
          const officialId = record.official_id?.trim();
          
          if (authorId1 || authorId2) {
            const entry = {
              official_id: officialId,
              author_id2: authorId2,
              name: record.name?.trim(),
              firstname: record.Firstname?.trim() || null,
              lastname: record.Lastname?.trim() || null,
              party: normalizeParty(record.party3?.trim() || record.Party?.trim()),
              chamber: record.chamber?.trim() || null,
              handle_1: record.handle_1?.trim() || null,
              handle_2: record.handle_2?.trim() || null,
              state: normalizeState(record.st?.trim() || record.State?.trim()),
              state_full: record.State?.trim() || null,
              gender: record.gender?.trim() || null,
              race: record.race?.trim() || null,
              district_num: record.district_num?.trim() || null,
              district_num_sld: record.district_num_sld?.trim() || null,
              district_name: record.District_name?.trim() || null,
              district_type: record.District_type?.trim() || null,
              district_ocdid: record.District_OCDID?.trim() || null,
              yr_elected: parseIntSafe(record.yr_elected, null),
              yr_left_office: parseIntSafe(record.yr_left_office, null),
              vote_pct: parseFloatSafe(record.vote_pct, null),
              yr_vote: parseIntSafe(record.yr_vote, null),
              bp_url: record.bp_url?.trim() || null,
              state_fips: record.state_fips?.trim() || null,
              sld_fips: record.sld_fips?.trim() || null,
              office_name: record.Office_name?.trim() || null,
              office_level: record.Office_level?.trim() || null,
              office_branch: record.Office_branch?.trim() || null,
              camphand: record.camphand?.trim() || null,
              offhand: record.offhand?.trim() || null,
              perhand: record.perhand?.trim() || null,
              shor_ideo: parseFloatSafe(record.shor_ideo, null),
              median_chamber: parseFloatSafe(record.median_chamber, null),
              dis_median: parseFloatSafe(record.dis_median, null),
              median_party: parseFloatSafe(record.median_party, null),
              heterogeneity: parseFloatSafe(record.heterogeneity, null),
              polarization: parseFloatSafe(record.polarization, null),
              mrp_ideology: parseFloatSafe(record.mrp_ideology, null),
              mrp_ideology_se: parseFloatSafe(record.mrp_ideology_se, null),
              boundaries_election_year: parseIntSafe(record.boundaries_election_year, null),
              demshare_pres: parseFloatSafe(record.demshare_pres, null),
              source_1: record.source_1?.trim() || null,
              source_2: record.source_2?.trim() || null,
            };
            
            // Index by author_id1 (primary)
            if (authorId1) {
              officialDataMap.set(authorId1, entry);
              officialCount++;
            }
            // Also index by author_id2 if different
            if (authorId2 && authorId2 !== authorId1) {
              officialDataMap.set(authorId2, entry);
            }
          }
        });
        
        parser.on('end', resolve);
        parser.on('error', reject);
      });
      
      console.log(`    Loaded ${officialCount.toLocaleString()} entries from official_data.csv`);
    } else {
      console.log(`  WARNING: ${basename(OFFICIAL_DATA_CSV)} not found, skipping metadata enrichment`);
    }
    
    // Load account.csv
    if (existsSync(ACCOUNT_CSV)) {
      console.log(`  Loading ${basename(ACCOUNT_CSV)}...`);
      let accountCount = 0;
      
      await new Promise((resolve, reject) => {
        const parser = createReadStream(ACCOUNT_CSV, { encoding: 'utf-8' })
          .pipe(parse({
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true,
            skip_records_with_error: true,
            relax_quotes: true,
          }));
        
        parser.on('data', (record) => {
          const twitterAuthorId = normalizeId(record.twitter_authorid);
          const twitterHandle = record.twitter_handle?.trim() || null;
          
          if (twitterAuthorId) {
            accountDataMap.set(twitterAuthorId, {
              official_id: record.official_id?.trim() || null,
              twitter_handle: twitterHandle,
            });
            accountCount++;
          }
        });
        
        parser.on('end', resolve);
        parser.on('error', reject);
      });
      
      console.log(`    Loaded ${accountCount.toLocaleString()} entries from account.csv`);
    } else {
      console.log(`  WARNING: ${basename(ACCOUNT_CSV)} not found, skipping account metadata`);
    }
    
    console.log(`  Total metadata entries: ${officialDataMap.size.toLocaleString()} (official) + ${accountDataMap.size.toLocaleString()} (account)`);
    console.log('');
    
    // ========================================================================
    // Phase 3: Scan for legislators and topics
    // ========================================================================
    console.log('Phase 3: Scanning for legislators and topics...');
    
    const legislatorsMap = new Map();
    const topicsMap = new Map();
    topicsMap.set('0', { topic: '0', topic_label: 'Unclassified' });
    
    // Scan CSVs for legislators (author_id + user_username)
    let scanCount = 0;
    for (const csvFile of csvFiles) {
      const csvPath = join(CSV_DIR, csvFile);
      
      await new Promise((resolve) => {
        const parser = createReadStream(csvPath, { encoding: 'utf-8' })
          .pipe(parse({
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true,
            skip_records_with_error: true,
            relax_quotes: true,
          }));
        
        parser.on('data', (record) => {
          scanCount++;
          
          const authorId = normalizeId(record.author_id);
          if (!authorId) return;
          
          const handle = record.user_username || null;
          
          // Check if we already have this legislator
          if (!legislatorsMap.has(authorId)) {
            // Try to get metadata from official_data.csv (primary source)
            const officialEntry = officialDataMap.get(authorId);
            
            // Fallback to account.csv if not in official_data
            const accountEntry = !officialEntry ? accountDataMap.get(authorId) : null;
            
            // Build legislator entry with priority: official_data > account > CSV
            // Initialize all fields to ensure complete structure
            const legEntry = {
              lid: authorId,
              name: officialEntry?.name || (handle ? `@${handle}` : `User ${authorId}`),
              handle: handle || officialEntry?.handle_1 || officialEntry?.handle_2 || accountEntry?.twitter_handle || null,
              state: officialEntry?.state || null,
              chamber: officialEntry?.chamber || null,
              party: officialEntry?.party || null,
              // Copy all other fields from officialEntry if available
              official_id: officialEntry?.official_id || null,
              author_id2: officialEntry?.author_id2 || null,
              firstname: officialEntry?.firstname || null,
              lastname: officialEntry?.lastname || null,
              gender: officialEntry?.gender || null,
              race: officialEntry?.race || null,
              district_num: officialEntry?.district_num || null,
              district_num_sld: officialEntry?.district_num_sld || null,
              district_name: officialEntry?.district_name || null,
              district_type: officialEntry?.district_type || null,
              district_ocdid: officialEntry?.district_ocdid || null,
              yr_elected: officialEntry?.yr_elected ?? null,
              yr_left_office: officialEntry?.yr_left_office ?? null,
              vote_pct: officialEntry?.vote_pct ?? null,
              yr_vote: officialEntry?.yr_vote ?? null,
              bp_url: officialEntry?.bp_url || null,
              state_fips: officialEntry?.state_fips || null,
              sld_fips: officialEntry?.sld_fips || null,
              state_full: officialEntry?.state_full || null,
              office_name: officialEntry?.office_name || null,
              office_level: officialEntry?.office_level || null,
              office_branch: officialEntry?.office_branch || null,
              handle_1: officialEntry?.handle_1 || null,
              handle_2: officialEntry?.handle_2 || null,
              camphand: officialEntry?.camphand || null,
              offhand: officialEntry?.offhand || null,
              perhand: officialEntry?.perhand || null,
              shor_ideo: officialEntry?.shor_ideo ?? null,
              median_chamber: officialEntry?.median_chamber ?? null,
              dis_median: officialEntry?.dis_median ?? null,
              median_party: officialEntry?.median_party ?? null,
              heterogeneity: officialEntry?.heterogeneity ?? null,
              polarization: officialEntry?.polarization ?? null,
              mrp_ideology: officialEntry?.mrp_ideology ?? null,
              mrp_ideology_se: officialEntry?.mrp_ideology_se ?? null,
              boundaries_election_year: officialEntry?.boundaries_election_year ?? null,
              demshare_pres: officialEntry?.demshare_pres ?? null,
              source_1: officialEntry?.source_1 || null,
              source_2: officialEntry?.source_2 || null,
            };
            
            legislatorsMap.set(authorId, legEntry);
          } else {
            // Update existing entry if we have new information
            const leg = legislatorsMap.get(authorId);
            
            // Ensure all fields exist (initialize if missing)
            if (leg.official_id === undefined) leg.official_id = null;
            if (leg.author_id2 === undefined) leg.author_id2 = null;
            if (leg.firstname === undefined) leg.firstname = null;
            if (leg.lastname === undefined) leg.lastname = null;
            if (leg.gender === undefined) leg.gender = null;
            if (leg.race === undefined) leg.race = null;
            if (leg.district_num === undefined) leg.district_num = null;
            if (leg.district_num_sld === undefined) leg.district_num_sld = null;
            if (leg.district_name === undefined) leg.district_name = null;
            if (leg.district_type === undefined) leg.district_type = null;
            if (leg.district_ocdid === undefined) leg.district_ocdid = null;
            if (leg.yr_elected === undefined) leg.yr_elected = null;
            if (leg.yr_left_office === undefined) leg.yr_left_office = null;
            if (leg.vote_pct === undefined) leg.vote_pct = null;
            if (leg.yr_vote === undefined) leg.yr_vote = null;
            if (leg.bp_url === undefined) leg.bp_url = null;
            if (leg.state_fips === undefined) leg.state_fips = null;
            if (leg.sld_fips === undefined) leg.sld_fips = null;
            if (leg.state_full === undefined) leg.state_full = null;
            if (leg.office_name === undefined) leg.office_name = null;
            if (leg.office_level === undefined) leg.office_level = null;
            if (leg.office_branch === undefined) leg.office_branch = null;
            if (leg.handle_1 === undefined) leg.handle_1 = null;
            if (leg.handle_2 === undefined) leg.handle_2 = null;
            if (leg.camphand === undefined) leg.camphand = null;
            if (leg.offhand === undefined) leg.offhand = null;
            if (leg.perhand === undefined) leg.perhand = null;
            if (leg.shor_ideo === undefined) leg.shor_ideo = null;
            if (leg.median_chamber === undefined) leg.median_chamber = null;
            if (leg.dis_median === undefined) leg.dis_median = null;
            if (leg.median_party === undefined) leg.median_party = null;
            if (leg.heterogeneity === undefined) leg.heterogeneity = null;
            if (leg.polarization === undefined) leg.polarization = null;
            if (leg.mrp_ideology === undefined) leg.mrp_ideology = null;
            if (leg.mrp_ideology_se === undefined) leg.mrp_ideology_se = null;
            if (leg.boundaries_election_year === undefined) leg.boundaries_election_year = null;
            if (leg.demshare_pres === undefined) leg.demshare_pres = null;
            if (leg.source_1 === undefined) leg.source_1 = null;
            if (leg.source_2 === undefined) leg.source_2 = null;
            
            // Update handle if missing and we have one
            if (!leg.handle) {
              leg.handle = handle || 
                           officialDataMap.get(authorId)?.handle_1 || 
                           officialDataMap.get(authorId)?.handle_2 ||
                           accountDataMap.get(authorId)?.twitter_handle || 
                           null;
            }
            
            // Update name if it's still a placeholder
            if (leg.name.startsWith('User ') || leg.name.startsWith('@')) {
              const officialEntry = officialDataMap.get(authorId);
              if (officialEntry?.name) {
                leg.name = officialEntry.name;
              } else if (handle && !leg.name.startsWith('@')) {
                leg.name = `@${handle}`;
              }
            }
            
            // Fill in missing metadata from official_data
            const officialEntry = officialDataMap.get(authorId);
            if (officialEntry) {
              // Core fields
              if (!leg.state && officialEntry.state) leg.state = officialEntry.state;
              if (!leg.chamber && officialEntry.chamber) leg.chamber = officialEntry.chamber;
              if (!leg.party && officialEntry.party) leg.party = officialEntry.party;
              
              // Fill in all other fields if missing
              if (!leg.official_id && officialEntry.official_id) leg.official_id = officialEntry.official_id;
              if (!leg.author_id2 && officialEntry.author_id2) leg.author_id2 = officialEntry.author_id2;
              if (!leg.firstname && officialEntry.firstname) leg.firstname = officialEntry.firstname;
              if (!leg.lastname && officialEntry.lastname) leg.lastname = officialEntry.lastname;
              if (!leg.gender && officialEntry.gender) leg.gender = officialEntry.gender;
              if (!leg.race && officialEntry.race) leg.race = officialEntry.race;
              if (!leg.district_num && officialEntry.district_num) leg.district_num = officialEntry.district_num;
              if (!leg.district_num_sld && officialEntry.district_num_sld) leg.district_num_sld = officialEntry.district_num_sld;
              if (!leg.district_name && officialEntry.district_name) leg.district_name = officialEntry.district_name;
              if (!leg.district_type && officialEntry.district_type) leg.district_type = officialEntry.district_type;
              if (!leg.district_ocdid && officialEntry.district_ocdid) leg.district_ocdid = officialEntry.district_ocdid;
              if (leg.yr_elected === null && officialEntry.yr_elected !== null) leg.yr_elected = officialEntry.yr_elected;
              if (leg.yr_left_office === null && officialEntry.yr_left_office !== null) leg.yr_left_office = officialEntry.yr_left_office;
              if (leg.vote_pct === null && officialEntry.vote_pct !== null) leg.vote_pct = officialEntry.vote_pct;
              if (leg.yr_vote === null && officialEntry.yr_vote !== null) leg.yr_vote = officialEntry.yr_vote;
              if (!leg.bp_url && officialEntry.bp_url) leg.bp_url = officialEntry.bp_url;
              if (!leg.state_fips && officialEntry.state_fips) leg.state_fips = officialEntry.state_fips;
              if (!leg.sld_fips && officialEntry.sld_fips) leg.sld_fips = officialEntry.sld_fips;
              if (!leg.state_full && officialEntry.state_full) leg.state_full = officialEntry.state_full;
              if (!leg.office_name && officialEntry.office_name) leg.office_name = officialEntry.office_name;
              if (!leg.office_level && officialEntry.office_level) leg.office_level = officialEntry.office_level;
              if (!leg.office_branch && officialEntry.office_branch) leg.office_branch = officialEntry.office_branch;
              if (!leg.handle_1 && officialEntry.handle_1) leg.handle_1 = officialEntry.handle_1;
              if (!leg.handle_2 && officialEntry.handle_2) leg.handle_2 = officialEntry.handle_2;
              if (!leg.camphand && officialEntry.camphand) leg.camphand = officialEntry.camphand;
              if (!leg.offhand && officialEntry.offhand) leg.offhand = officialEntry.offhand;
              if (!leg.perhand && officialEntry.perhand) leg.perhand = officialEntry.perhand;
              if (leg.shor_ideo === null && officialEntry.shor_ideo !== null) leg.shor_ideo = officialEntry.shor_ideo;
              if (leg.median_chamber === null && officialEntry.median_chamber !== null) leg.median_chamber = officialEntry.median_chamber;
              if (leg.dis_median === null && officialEntry.dis_median !== null) leg.dis_median = officialEntry.dis_median;
              if (leg.median_party === null && officialEntry.median_party !== null) leg.median_party = officialEntry.median_party;
              if (leg.heterogeneity === null && officialEntry.heterogeneity !== null) leg.heterogeneity = officialEntry.heterogeneity;
              if (leg.polarization === null && officialEntry.polarization !== null) leg.polarization = officialEntry.polarization;
              if (leg.mrp_ideology === null && officialEntry.mrp_ideology !== null) leg.mrp_ideology = officialEntry.mrp_ideology;
              if (leg.mrp_ideology_se === null && officialEntry.mrp_ideology_se !== null) leg.mrp_ideology_se = officialEntry.mrp_ideology_se;
              if (leg.boundaries_election_year === null && officialEntry.boundaries_election_year !== null) leg.boundaries_election_year = officialEntry.boundaries_election_year;
              if (leg.demshare_pres === null && officialEntry.demshare_pres !== null) leg.demshare_pres = officialEntry.demshare_pres;
              if (!leg.source_1 && officialEntry.source_1) leg.source_1 = officialEntry.source_1;
              if (!leg.source_2 && officialEntry.source_2) leg.source_2 = officialEntry.source_2;
            }
          }
          
          if (scanCount % 500000 === 0) {
            console.log(`  Scanned ${scanCount.toLocaleString()} CSV records (${legislatorsMap.size} legislators)`);
          }
        });
        
        parser.on('end', resolve);
        parser.on('error', resolve);
      });
    }
    
    // Scan JSONLs for topics
    for (const jsonlFile of jsonlFiles) {
      const jsonlPath = join(JSONL_DIR, jsonlFile);
      const rl = createInterface({
        input: createReadStream(jsonlPath, { encoding: 'utf-8' }),
        crlfDelay: Infinity
      });
      
      for await (const line of rl) {
        if (!line.trim()) continue;
        const record = parseJsonlLine(line);
        if (!record?.stage2_topic?.top_topics) continue;
        
        for (const t of record.stage2_topic.top_topics) {
          const topicId = String(t.id);
          if (!topicsMap.has(topicId)) {
            topicsMap.set(topicId, {
              topic: topicId,
              topic_label: t.label || `Topic ${t.id}`
            });
          }
        }
      }
    }
    
    console.log(`  Found ${legislatorsMap.size.toLocaleString()} unique legislators`);
    console.log(`  Found ${topicsMap.size.toLocaleString()} unique topics`);
    console.log('');
    
    // ========================================================================
    // Phase 4: Insert legislators and topics
    // ========================================================================
    console.log('Phase 4: Inserting legislators and topics...');
    
    await client.query('BEGIN');
    
    // Insert legislators with full metadata
    // Calculate field count: 45 fields total
    const FIELD_COUNT = 45;
    const LEGISLATOR_BATCH_SIZE = Math.floor(65000 / FIELD_COUNT); // Stay under PostgreSQL parameter limit (~1444 per batch)
    const legislators = Array.from(legislatorsMap.values());
    
    for (let i = 0; i < legislators.length; i += LEGISLATOR_BATCH_SIZE) {
      const batch = legislators.slice(i, i + LEGISLATOR_BATCH_SIZE);
      const values = [];
      const placeholders = [];
      
      batch.forEach((leg, j) => {
        const offset = j * FIELD_COUNT;
        // Generate placeholder for 45 fields
        const fieldPlaceholders = Array.from({ length: FIELD_COUNT }, (_, idx) => `$${offset + idx + 1}`).join(', ');
        placeholders.push(`(${fieldPlaceholders})`);
        values.push(
          leg.lid,
          leg.name,
          leg.handle,
          leg.state,
          leg.chamber,
          leg.party,
          leg.official_id,
          leg.author_id2,
          leg.firstname,
          leg.lastname,
          leg.gender,
          leg.race,
          leg.district_num,
          leg.district_num_sld,
          leg.district_name,
          leg.district_type,
          leg.district_ocdid,
          leg.yr_elected,
          leg.yr_left_office,
          leg.vote_pct,
          leg.yr_vote,
          leg.bp_url,
          leg.state_fips,
          leg.sld_fips,
          leg.state_full,
          leg.office_name,
          leg.office_level,
          leg.office_branch,
          leg.handle_1,
          leg.handle_2,
          leg.camphand,
          leg.offhand,
          leg.perhand,
          leg.shor_ideo,
          leg.median_chamber,
          leg.dis_median,
          leg.median_party,
          leg.heterogeneity,
          leg.polarization,
          leg.mrp_ideology,
          leg.mrp_ideology_se,
          leg.boundaries_election_year,
          leg.demshare_pres,
          leg.source_1,
          leg.source_2
        );
      });
      
      await client.query(
        `INSERT INTO legislators (
          lid, name, handle, state, chamber, party, official_id, author_id2,
          firstname, lastname, gender, race, district_num, district_num_sld,
          district_name, district_type, district_ocdid, yr_elected, yr_left_office,
          vote_pct, yr_vote, bp_url, state_fips, sld_fips, state_full,
          office_name, office_level, office_branch, handle_1, handle_2,
          camphand, offhand, perhand, shor_ideo, median_chamber, dis_median,
          median_party, heterogeneity, polarization, mrp_ideology, mrp_ideology_se,
          boundaries_election_year, demshare_pres, source_1, source_2
        ) VALUES ${placeholders.join(', ')}
         ON CONFLICT (lid) DO UPDATE SET
           name = EXCLUDED.name,
           handle = COALESCE(EXCLUDED.handle, legislators.handle),
           state = COALESCE(EXCLUDED.state, legislators.state),
           chamber = COALESCE(EXCLUDED.chamber, legislators.chamber),
           party = COALESCE(EXCLUDED.party, legislators.party),
           official_id = COALESCE(EXCLUDED.official_id, legislators.official_id),
           author_id2 = COALESCE(EXCLUDED.author_id2, legislators.author_id2),
           firstname = COALESCE(EXCLUDED.firstname, legislators.firstname),
           lastname = COALESCE(EXCLUDED.lastname, legislators.lastname),
           gender = COALESCE(EXCLUDED.gender, legislators.gender),
           race = COALESCE(EXCLUDED.race, legislators.race),
           district_num = COALESCE(EXCLUDED.district_num, legislators.district_num),
           district_num_sld = COALESCE(EXCLUDED.district_num_sld, legislators.district_num_sld),
           district_name = COALESCE(EXCLUDED.district_name, legislators.district_name),
           district_type = COALESCE(EXCLUDED.district_type, legislators.district_type),
           district_ocdid = COALESCE(EXCLUDED.district_ocdid, legislators.district_ocdid),
           yr_elected = COALESCE(EXCLUDED.yr_elected, legislators.yr_elected),
           yr_left_office = COALESCE(EXCLUDED.yr_left_office, legislators.yr_left_office),
           vote_pct = COALESCE(EXCLUDED.vote_pct, legislators.vote_pct),
           yr_vote = COALESCE(EXCLUDED.yr_vote, legislators.yr_vote),
           bp_url = COALESCE(EXCLUDED.bp_url, legislators.bp_url),
           state_fips = COALESCE(EXCLUDED.state_fips, legislators.state_fips),
           sld_fips = COALESCE(EXCLUDED.sld_fips, legislators.sld_fips),
           state_full = COALESCE(EXCLUDED.state_full, legislators.state_full),
           office_name = COALESCE(EXCLUDED.office_name, legislators.office_name),
           office_level = COALESCE(EXCLUDED.office_level, legislators.office_level),
           office_branch = COALESCE(EXCLUDED.office_branch, legislators.office_branch),
           handle_1 = COALESCE(EXCLUDED.handle_1, legislators.handle_1),
           handle_2 = COALESCE(EXCLUDED.handle_2, legislators.handle_2),
           camphand = COALESCE(EXCLUDED.camphand, legislators.camphand),
           offhand = COALESCE(EXCLUDED.offhand, legislators.offhand),
           perhand = COALESCE(EXCLUDED.perhand, legislators.perhand),
           shor_ideo = COALESCE(EXCLUDED.shor_ideo, legislators.shor_ideo),
           median_chamber = COALESCE(EXCLUDED.median_chamber, legislators.median_chamber),
           dis_median = COALESCE(EXCLUDED.dis_median, legislators.dis_median),
           median_party = COALESCE(EXCLUDED.median_party, legislators.median_party),
           heterogeneity = COALESCE(EXCLUDED.heterogeneity, legislators.heterogeneity),
           polarization = COALESCE(EXCLUDED.polarization, legislators.polarization),
           mrp_ideology = COALESCE(EXCLUDED.mrp_ideology, legislators.mrp_ideology),
           mrp_ideology_se = COALESCE(EXCLUDED.mrp_ideology_se, legislators.mrp_ideology_se),
           boundaries_election_year = COALESCE(EXCLUDED.boundaries_election_year, legislators.boundaries_election_year),
           demshare_pres = COALESCE(EXCLUDED.demshare_pres, legislators.demshare_pres),
           source_1 = COALESCE(EXCLUDED.source_1, legislators.source_1),
           source_2 = COALESCE(EXCLUDED.source_2, legislators.source_2),
           updated_at = CURRENT_TIMESTAMP`,
        values
      );
    }
    
    // Report statistics
    const withParty = legislators.filter(l => l.party).length;
    const withChamber = legislators.filter(l => l.chamber).length;
    const withState = legislators.filter(l => l.state).length;
    const withHandle = legislators.filter(l => l.handle).length;
    
    console.log(`  Inserted ${legislators.length.toLocaleString()} legislators`);
    console.log(`    With party: ${withParty.toLocaleString()} (${((withParty/legislators.length)*100).toFixed(1)}%)`);
    console.log(`    With chamber: ${withChamber.toLocaleString()} (${((withChamber/legislators.length)*100).toFixed(1)}%)`);
    console.log(`    With state: ${withState.toLocaleString()} (${((withState/legislators.length)*100).toFixed(1)}%)`);
    console.log(`    With handle: ${withHandle.toLocaleString()} (${((withHandle/legislators.length)*100).toFixed(1)}%)`);
    
    // Insert topics
    const topics = Array.from(topicsMap.values());
    for (const t of topics) {
      await client.query(
        `INSERT INTO topics (topic, topic_label) VALUES ($1, $2) ON CONFLICT (topic) DO NOTHING`,
        [t.topic, t.topic_label]
      );
    }
    console.log(`  Inserted ${topics.length.toLocaleString()} topics`);
    
    await client.query('COMMIT');
    console.log('');
    
    // ========================================================================
    // Phase 5: Insert posts with comprehensive field capture
    // ========================================================================
    console.log('Phase 5: Inserting posts (comprehensive field capture)...');
    
    let totalPosts = 0;
    let postsWithTweetId = 0;
    let postsWithoutTweetId = 0;
    let postsWithTopic = 0;
    let postsUnclassified = 0;
    let skippedNoAuthor = 0;
    let skippedNoDate = 0;
    
    for (let fileIdx = 0; fileIdx < csvFiles.length; fileIdx++) {
      const csvFile = csvFiles[fileIdx];
      const csvPath = join(CSV_DIR, csvFile);
      const dateRange = extractDateRange(csvFile);
      
      // Load JSONL map for this date range
      const jsonlName = `legislator_tweets_${dateRange}_topic.jsonl`;
      const jsonlPath = join(JSONL_DIR, jsonlName);
      const jsonlMap = existsSync(jsonlPath) ? await loadJsonlToMap(jsonlPath) : new Map();
      
      const posts = [];
      
      await new Promise((resolve) => {
        const parser = createReadStream(csvPath, { encoding: 'utf-8' })
          .pipe(parse({
            columns: true,
            skip_empty_lines: true,
            relax_column_count: true,
            skip_records_with_error: true,
            relax_quotes: true,
          }));
        
        parser.on('data', (record) => {
          // Get author_id (required)
          const authorId = normalizeId(record.author_id);
          if (!authorId) {
            skippedNoAuthor++;
            return;
          }
          
          // Get date (required)
          let createdAt = record.created_date || record.created_at;
          if (createdAt && typeof createdAt === 'string' && createdAt.includes('T')) {
            try {
              createdAt = new Date(createdAt).toISOString().split('T')[0];
            } catch {
              createdAt = null;
            }
          }
          if (!createdAt) {
            skippedNoDate++;
            return;
          }
          
          // Get tweet_id (optional) - ignore _id, id_str duplicates
          const tweetId = normalizeId(record.id) || null;
          if (tweetId) {
            postsWithTweetId++;
          } else {
            postsWithoutTweetId++;
          }
          
          // Get topic from JSONL (or default to Unclassified)
          let topic = '0';
          let topicProb = null;
          let topicConf = null;
          let politicalScore = null;
          let isPolitical = null;
          
          if (tweetId && jsonlMap.has(tweetId)) {
            const jsonlData = jsonlMap.get(tweetId);
            if (jsonlData.topic) {
              topic = String(jsonlData.topic.id);
              topicProb = jsonlData.topic.confidence || null;
              topicConf = topicProb; // Use same value if confidence provided separately
              postsWithTopic++;
            } else {
              postsUnclassified++;
            }
            politicalScore = jsonlData.political_score;
            isPolitical = jsonlData.is_political;
          } else {
            postsUnclassified++;
          }
          
          // Build comprehensive post object with all meaningful fields
          posts.push({
            tweet_id: tweetId,
            lid: authorId,
            created_at: createdAt,
            text: record.text || record.hydrated_text || record.full_text || null,
            
            // Engagement metrics - capture all available
            retweet_count: parseIntSafe(record.retweet_count),
            like_count: parseIntSafe(record.like_count || record.favorite_count), // favorite_count may be alias
            reply_count: parseIntSafe(record.reply_count),
            quote_count: parseIntSafe(record.quote_count),
            favorite_count: parseIntSafe(record.favorite_count), // Capture separately if exists
            
            // Topic classification
            topic: topic,
            topic_probability: topicProb,
            topic_confidence: topicConf,
            
            // Comprehensive toxicity scores
            tox_toxicity: parseFloatSafe(record.toxicity_score || record.tox_toxicity),
            tox_severe_toxicity: parseFloatSafe(record.tox_severe_toxicity || record.severe_toxicity_score),
            tox_obscene: parseFloatSafe(record.tox_obscene || record.obscene_score),
            tox_threat: parseFloatSafe(record.tox_threat || record.threat_score),
            tox_insult: parseFloatSafe(record.tox_insult || record.insult_score),
            tox_identity_attack: parseFloatSafe(record.tox_identity_attack || record.identity_attack_score),
            
            // Misinformation
            count_misinfo: parseIntSafe(record.count_misinfo),
            misinfo_score: parseFloatSafe(record.misinfo_score || record.misinformation_score),
            
            // Political classification
            political_score: politicalScore,
            is_political: isPolitical
          });
        });
        
        parser.on('end', resolve);
        parser.on('error', resolve);
      });
      
      // Insert all posts for this file
      await client.query('BEGIN');
      
      for (let i = 0; i < posts.length; i += BATCH_SIZE) {
        const batch = posts.slice(i, i + BATCH_SIZE);
        const values = [];
        const placeholders = [];
        
        batch.forEach((post, j) => {
          const offset = j * 22; // 22 fields total
          placeholders.push(
            `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, ` +
            `$${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, ` +
            `$${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, ` +
            `$${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20}, ` +
            `$${offset + 21}, $${offset + 22})`
          );
          // Push all 22 values in order
          values.push(
            post.tweet_id,                    // 1
            post.lid,                        // 2
            post.created_at,                 // 3
            post.text,                       // 4
            post.retweet_count,              // 5
            post.like_count,                 // 6
            post.reply_count,                // 7
            post.quote_count,                // 8
            post.favorite_count,             // 9
            post.topic,                      // 10
            post.topic_probability,          // 11
            post.topic_confidence,            // 12
            post.tox_toxicity,               // 13
            post.tox_severe_toxicity,        // 14
            post.tox_obscene,                // 15
            post.tox_threat,                 // 16
            post.tox_insult,                 // 17
            post.tox_identity_attack,        // 18
            post.count_misinfo,              // 19
            post.misinfo_score,              // 20
            post.political_score,            // 21
            post.is_political                // 22
          );
        });
        
        // Validate that placeholders and values match
        const expectedParams = batch.length * 22;
        if (values.length !== expectedParams) {
          throw new Error(`Parameter mismatch: expected ${expectedParams} values, got ${values.length} (batch size: ${batch.length})`);
        }
        
        if (placeholders.length > 0 && values.length > 0) {
          await client.query(
            `INSERT INTO posts (
              tweet_id, lid, created_at, text,
              retweet_count, like_count, reply_count, quote_count, favorite_count,
              topic, topic_probability, topic_confidence,
              tox_toxicity, tox_severe_toxicity, tox_obscene,
              tox_threat, tox_insult, tox_identity_attack,
              count_misinfo, misinfo_score,
              political_score, is_political
            ) VALUES ${placeholders.join(', ')}`,
            values
          );
        }
      }
      
      await client.query('COMMIT');
      totalPosts += posts.length;
      
      if (totalPosts % LOG_INTERVAL < posts.length || fileIdx === csvFiles.length - 1) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(`  [${elapsed}s] ${totalPosts.toLocaleString()} posts (file ${fileIdx + 1}/${csvFiles.length})`);
      }
    }
    
    console.log('');
    console.log('  Post statistics:');
    console.log(`    Total inserted:      ${totalPosts.toLocaleString()}`);
    console.log(`    With tweet_id:       ${postsWithTweetId.toLocaleString()}`);
    console.log(`    Without tweet_id:    ${postsWithoutTweetId.toLocaleString()}`);
    console.log(`    With topic:          ${postsWithTopic.toLocaleString()}`);
    console.log(`    Unclassified:        ${postsUnclassified.toLocaleString()}`);
    console.log(`    Skipped (no author): ${skippedNoAuthor.toLocaleString()}`);
    console.log(`    Skipped (no date):   ${skippedNoDate.toLocaleString()}`);
    console.log('');
    
    // ========================================================================
    // Phase 6: Verify counts
    // ========================================================================
    console.log('Phase 6: Verifying database counts...');
    
    const dbLegislators = (await client.query('SELECT COUNT(*) FROM legislators')).rows[0].count;
    const dbTopics = (await client.query('SELECT COUNT(*) FROM topics')).rows[0].count;
    const dbPosts = (await client.query('SELECT COUNT(*) FROM posts')).rows[0].count;
    
    console.log(`  DB Legislators: ${parseInt(dbLegislators).toLocaleString()}`);
    console.log(`  DB Topics:      ${parseInt(dbTopics).toLocaleString()}`);
    console.log(`  DB Posts:       ${parseInt(dbPosts).toLocaleString()}`);
    console.log('');
    
    // ========================================================================
    // Phase 7: Refresh materialized views
    // ========================================================================
    console.log('Phase 7: Refreshing materialized views...');
    await client.query('REFRESH MATERIALIZED VIEW topic_engagement_daily');
    await client.query('REFRESH MATERIALIZED VIEW topic_party_breakdown');
    await client.query('REFRESH MATERIALIZED VIEW topic_state_breakdown');
    console.log('  Done');
    console.log('');
    
    // ========================================================================
    // Final Summary
    // ========================================================================
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('='.repeat(70));
    console.log('Import Complete!');
    console.log('='.repeat(70));
    console.log(`  Expected CSV records: ${totalCsvRecords.toLocaleString()}`);
    console.log(`  Actual posts in DB:   ${parseInt(dbPosts).toLocaleString()}`);
    console.log(`  Match: ${totalPosts === totalCsvRecords - skippedNoAuthor - skippedNoDate ? 'YES' : 'NO (check skipped counts)'}`);
    console.log('');
    console.log(`  Legislators: ${parseInt(dbLegislators).toLocaleString()}`);
    console.log(`  Topics:      ${parseInt(dbTopics).toLocaleString()}`);
    console.log(`  Posts:       ${parseInt(dbPosts).toLocaleString()}`);
    console.log(`  Duration:    ${duration}s (${(parseInt(dbPosts) / parseFloat(duration) * 60).toFixed(0)} posts/min)`);
    console.log('='.repeat(70));
    
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Import failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

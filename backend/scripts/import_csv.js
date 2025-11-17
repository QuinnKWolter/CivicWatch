import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import pool from '../config/database.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to CSV file (adjust as needed)
const CSV_PATH = process.env.CSV_PATH || join(__dirname, '../../frontend/public/data/full_topics.csv');

const BATCH_SIZE = 10000; // Process in batches of 10k

async function importCSV() {
  const client = await pool.connect();
  
  try {
    const startTime = Date.now();
    console.log('🚀 Starting CSV import...');
    console.log(`📁 Reading from: ${CSV_PATH}`);
    
    // Begin transaction
    await client.query('BEGIN');
    console.log('✓ Transaction started');
    
    // Track unique legislators and topics
    const legislatorsMap = new Map();
    const topicsMap = new Map();
    
    console.log('\n📋 Phase 1: Collecting unique legislators and topics...');
    let scanCount = 0;
    
    // FIRST PASS: Collect all unique legislators and topics
    const parser1 = createReadStream(CSV_PATH, { encoding: 'utf-8' })
      .pipe(parse({
        columns: true,
        skip_empty_lines: true,
        trim: true
      }));
    
    for await (const record of parser1) {
      scanCount++;
      
      // Track unique legislators
      if (record.lid && !legislatorsMap.has(record.lid)) {
        // Ensure name is not null (required by schema) - use lid as fallback if name is missing
        const name = record.name && record.name.trim() ? record.name.trim() : `Legislator ${record.lid}`;
        legislatorsMap.set(record.lid, {
          lid: record.lid,
          name: name,
          handle: record.handle || null,
          state: record.state || null,
          chamber: record.chamber || null,
          party: record.party || null
        });
      }
      
      // Track unique topics
      if (record.topic && !topicsMap.has(record.topic)) {
        topicsMap.set(record.topic, {
          topic: record.topic,
          topic_label: record.topic_label || record.topic
        });
      }
      
      if (scanCount % 100000 === 0) {
        console.log(`   Scanned ${scanCount.toLocaleString()} records... (${legislatorsMap.size} legislators, ${topicsMap.size} topics found)`);
      }
    }
    
    console.log(`✓ First pass complete: ${scanCount.toLocaleString()} records scanned`);
    console.log(`   Found ${legislatorsMap.size.toLocaleString()} unique legislators`);
    console.log(`   Found ${topicsMap.size.toLocaleString()} unique topics`);
    
    // Insert all unique legislators FIRST (before posts)
    console.log(`\n📊 Phase 2: Inserting ${legislatorsMap.size.toLocaleString()} unique legislators...`);
    await insertLegislators(client, Array.from(legislatorsMap.values()));
    console.log(`✓ Legislators inserted`);
    
    // Insert all unique topics SECOND (before posts)
    console.log(`📊 Phase 3: Inserting ${topicsMap.size.toLocaleString()} unique topics...`);
    await insertTopics(client, Array.from(topicsMap.values()));
    console.log(`✓ Topics inserted`);
    
    // SECOND PASS: Insert posts (now that legislators and topics exist)
    console.log(`\n📊 Phase 4: Inserting posts...`);
    let recordCount = 0;
    let batch = [];
    
    const parser2 = createReadStream(CSV_PATH, { encoding: 'utf-8' })
      .pipe(parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: (value, context) => {
          // Custom casting for specific columns
          if (context.column === 'retweet_count' || context.column === 'like_count' || 
              context.column === 'count_misinfo') {
            return parseInt(value) || 0;
          }
          if (context.column === 'interaction_score' || context.column === 'overperforming_score') {
            return parseFloat(value) || null;
          }
          if (context.column === 'topic_probability' || context.column === 'civility_score') {
            // Clamp values to [0, 1] range to satisfy check constraints
            const num = parseFloat(value);
            if (isNaN(num)) return null;
            // Clamp to [0, 1] range
            return Math.max(0, Math.min(1, num));
          }
          if (context.column === 'created_at') {
            // Handle date format YYYY-MM-DD
            return value || null;
          }
          return value || null;
        }
      }));
    
    // Process records as they come in
    for await (const record of parser2) {
      recordCount++;
      
      // Add to batch
      batch.push(record);
      
      // Process batch when it reaches BATCH_SIZE
      if (batch.length >= BATCH_SIZE) {
        await processBatch(client, batch);
        batch = [];
        console.log(`✓ Processed ${recordCount.toLocaleString()} posts (${Math.round(recordCount / 1000)}k)...`);
      }
    }
    
    // Process remaining records
    if (batch.length > 0) {
      await processBatch(client, batch);
      console.log(`✓ Processed final batch: ${recordCount.toLocaleString()} total posts`);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ Import complete!`);
    console.log(`   - Legislators: ${legislatorsMap.size.toLocaleString()}`);
    console.log(`   - Topics: ${topicsMap.size.toLocaleString()}`);
    console.log(`   - Posts: ${recordCount.toLocaleString()}`);
    console.log(`   - Duration: ${duration}s (${(recordCount / (duration / 60)).toFixed(0)} records/min)`);
    
    // Refresh materialized views
    console.log('\n🔄 Refreshing materialized views...');
    await client.query('REFRESH MATERIALIZED VIEW topic_engagement_daily');
    console.log('   ✓ topic_engagement_daily refreshed');
    await client.query('REFRESH MATERIALIZED VIEW topic_party_breakdown');
    console.log('   ✓ topic_party_breakdown refreshed');
    await client.query('REFRESH MATERIALIZED VIEW topic_state_breakdown');
    console.log('   ✓ topic_state_breakdown refreshed');
    console.log('✅ All materialized views refreshed!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function insertLegislators(client, legislators) {
  if (legislators.length === 0) return;
  
  for (let i = 0; i < legislators.length; i += BATCH_SIZE) {
    const batch = legislators.slice(i, i + BATCH_SIZE);
    const values = [];
    const placeholders = [];
    
    for (let j = 0; j < batch.length; j++) {
      const leg = batch[j];
      const offset = j * 6; // 6 columns: lid, name, handle, state, chamber, party
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`);
      values.push(
        leg.lid,
        leg.name,
        leg.handle,
        leg.state,
        leg.chamber,
        leg.party
      );
    }
    
    await client.query(
      `INSERT INTO legislators (lid, name, handle, state, chamber, party) 
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (lid) DO UPDATE SET
         name = EXCLUDED.name,
         handle = EXCLUDED.handle,
         state = EXCLUDED.state,
         chamber = EXCLUDED.chamber,
         party = EXCLUDED.party`,
      values
    );
  }
}

async function insertTopics(client, topics) {
  if (topics.length === 0) return;
  
  for (let i = 0; i < topics.length; i += BATCH_SIZE) {
    const batch = topics.slice(i, i + BATCH_SIZE);
    const values = [];
    const placeholders = [];
    
    for (let j = 0; j < batch.length; j++) {
      const topic = batch[j];
      const offset = j * 2;
      placeholders.push(`($${offset + 1}, $${offset + 2})`);
      values.push(topic.topic, topic.topic_label);
    }
    
    await client.query(
      `INSERT INTO topics (topic, topic_label) 
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (topic) DO UPDATE SET
         topic_label = EXCLUDED.topic_label`,
      values
    );
  }
}

async function processBatch(client, batch) {
  if (batch.length === 0) return;
  
  // Process in smaller sub-batches to avoid parameter limits (PostgreSQL has a limit of ~65k parameters)
  const SUB_BATCH_SIZE = 5000; // 5000 records * 13 columns = 65k parameters (safe limit)
  
  for (let subStart = 0; subStart < batch.length; subStart += SUB_BATCH_SIZE) {
    const subBatch = batch.slice(subStart, subStart + SUB_BATCH_SIZE);
    const values = [];
    const placeholders = [];
    
    for (let j = 0; j < subBatch.length; j++) {
      const record = subBatch[j];
      const offset = j * 13; // 13 columns for posts
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13})`
      );
      // Helper function to clamp probability/score values to [0, 1]
      const clamp01 = (val) => {
        const num = parseFloat(val);
        if (isNaN(num)) return null;
        return Math.max(0, Math.min(1, num));
      };
      
      values.push(
        record.id,
        record.lid,
        record.created_at,
        record.text || null,
        record.attachment || null,
        parseInt(record.retweet_count) || 0,
        parseInt(record.like_count) || 0,
        parseInt(record.count_misinfo) || 0,
        parseFloat(record.interaction_score) || null,
        parseFloat(record.overperforming_score) || null,
        clamp01(record.civility_score), // Clamp to [0, 1]
        record.topic,
        clamp01(record.topic_probability) // Clamp to [0, 1]
      );
    }
    
    try {
      await client.query(
        `INSERT INTO posts (
          id, lid, created_at, text, attachment,
          retweet_count, like_count, count_misinfo,
          interaction_score, overperforming_score, civility_score,
          topic, topic_probability
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (id) DO UPDATE SET
          lid = EXCLUDED.lid,
          created_at = EXCLUDED.created_at,
          text = EXCLUDED.text,
          attachment = EXCLUDED.attachment,
          retweet_count = EXCLUDED.retweet_count,
          like_count = EXCLUDED.like_count,
          count_misinfo = EXCLUDED.count_misinfo,
          interaction_score = EXCLUDED.interaction_score,
          overperforming_score = EXCLUDED.overperforming_score,
          civility_score = EXCLUDED.civility_score,
          topic = EXCLUDED.topic,
          topic_probability = EXCLUDED.topic_probability`,
        values
      );
    } catch (err) {
      console.error(`❌ Error inserting sub-batch (${subStart} to ${subStart + subBatch.length}):`, err.message);
      throw err;
    }
  }
}

// Run import
importCSV().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

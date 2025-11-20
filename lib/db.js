// lib/db.js - Database utility for Vercel Postgres
const { sql } = require('@vercel/postgres');

// Initialize database table if it doesn't exist
async function initDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS trustpilot_data (
        id SERIAL PRIMARY KEY,
        score DECIMAL(3,1) NOT NULL,
        review_count INTEGER NOT NULL,
        max_score INTEGER DEFAULT 5,
        reviews JSONB NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    // Create index on timestamp for faster queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_timestamp ON trustpilot_data(timestamp DESC);
    `;
    
    console.log('✓ Database initialized');
  } catch (error) {
    console.error('✗ Error initializing database:', error);
    throw error;
  }
}

// Save data to database
async function saveData(data) {
  try {
    await initDatabase();
    
    await sql`
      INSERT INTO trustpilot_data (score, review_count, max_score, reviews, timestamp, url)
      VALUES (${data.score}, ${data.reviewCount}, ${data.maxScore || 5}, ${JSON.stringify(data.reviews)}, ${data.timestamp || new Date().toISOString()}, ${data.url || ''})
    `;
    
    console.log('✓ Data saved to database');
    return true;
  } catch (error) {
    console.error('✗ Error saving data:', error);
    throw error;
  }
}

// Load the most recent data from database
async function loadData() {
  try {
    await initDatabase();
    
    const result = await sql`
      SELECT 
        score,
        review_count as "reviewCount",
        max_score as "maxScore",
        reviews,
        timestamp,
        url
      FROM trustpilot_data
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      score: parseFloat(row.score),
      reviewCount: parseInt(row.reviewCount),
      maxScore: parseInt(row.maxScore) || 5,
      reviews: row.reviews,
      timestamp: row.timestamp,
      url: row.url
    };
  } catch (error) {
    console.error('✗ Error loading data:', error);
    return null;
  }
}

// Get data history (optional, for debugging)
async function getDataHistory(limit = 10) {
  try {
    await initDatabase();
    
    const result = await sql`
      SELECT 
        id,
        score,
        review_count as "reviewCount",
        max_score as "maxScore",
        reviews,
        timestamp,
        url
      FROM trustpilot_data
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;
    
    return result.rows.map(row => ({
      id: row.id,
      score: parseFloat(row.score),
      reviewCount: parseInt(row.reviewCount),
      maxScore: parseInt(row.maxScore) || 5,
      reviews: row.reviews,
      timestamp: row.timestamp,
      url: row.url
    }));
  } catch (error) {
    console.error('✗ Error loading data history:', error);
    return [];
  }
}

module.exports = {
  initDatabase,
  saveData,
  loadData,
  getDataHistory
};


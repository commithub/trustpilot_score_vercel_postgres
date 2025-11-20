// api/trustpilot.js - API endpoint to get cached Trustpilot data
const { loadData } = require('../lib/db');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const data = await loadData();
    
    if (data) {
      res.status(200).json(data);
    } else {
      res.status(404).json({ error: 'No data available yet' });
    }
  } catch (error) {
    console.error('Error loading Trustpilot data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// api/refresh.js - Manual refresh endpoint
const { updateTrustpilotData } = require('../lib/trustpilot');
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
    await updateTrustpilotData();
    const data = await loadData();
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error refreshing Trustpilot data:', error);
    res.status(500).json({ error: error.message });
  }
};


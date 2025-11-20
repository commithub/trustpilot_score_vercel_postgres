// api/cron/update-trustpilot.js - Daily cron job to update Trustpilot data
const { updateTrustpilotData } = require('../../lib/trustpilot');

module.exports = async (req, res) => {
  // Vercel automatically adds 'x-vercel-cron' header for cron jobs
  // Optional: Add additional authentication if CRON_SECRET is set
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'];
  
  // If CRON_SECRET is set, require authentication
  if (cronSecret) {
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  try {
    console.log('🔄 Running daily Trustpilot update cron job...');
    const data = await updateTrustpilotData();
    console.log('✓ Cron job completed successfully');
    
    res.status(200).json({ 
      success: true, 
      message: 'Trustpilot data updated successfully',
      timestamp: new Date().toISOString(),
      data: {
        score: data.score,
        reviewCount: data.reviewCount
      }
    });
  } catch (error) {
    console.error('✗ Cron job failed:', error);
    res.status(500).json({ 
      error: 'Cron job failed', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};


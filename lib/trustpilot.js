// lib/trustpilot.js - Trustpilot data fetching utilities
const https = require('https');

const TRUSTPILOT_URL = 'https://se.trustpilot.com/review/www.sporttema.se?languages=all&stars=4&stars=5';

// Extract reviews from HTML (4-5 stars only)
function extractReviews(html) {
  const reviews = [];
  
  try {
    // Method 1: Extract from __NEXT_DATA__ script tag (Next.js format)
    const nextDataMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
    
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        
        // Extract reviews from props.reviews array
        const reviewsArray = nextData?.props?.reviews || nextData?.props?.pageProps?.reviews || [];
        
        if (Array.isArray(reviewsArray)) {
          for (const review of reviewsArray) {
            // Only process 4-5 star reviews
            const rating = parseFloat(review.rating || 0);
            if (rating >= 4 && rating <= 5) {
              reviews.push({
                id: review.id || '',
                rating: rating,
                text: review.text || '',
                title: review.title || '',
                publishedDate: review.dates?.publishedDate || review.dates?.published || '',
                consumerDisplayName: review.consumer?.displayName || '',
                consumerIsVerified: review.consumer?.isVerified || false,
                consumerId: review.consumer?.id || ''
              });
            }
          }
        }
        
      } catch (parseError) {
        console.error('Error parsing __NEXT_DATA__:', parseError);
      }
    }
    
  } catch (error) {
    console.error('Error extracting reviews:', error);
  }
  
  // Remove duplicates based on review id
  const uniqueReviews = [];
  const seenIds = new Set();
  for (const review of reviews) {
    const reviewId = review.id || '';
    if (reviewId && !seenIds.has(reviewId)) {
      seenIds.add(reviewId);
      uniqueReviews.push(review);
    } else if (!reviewId) {
      // If no id, use text as fallback for duplicate detection
      const textKey = (review.text || review.title || '').substring(0, 50).toLowerCase();
      if (textKey && !seenIds.has(textKey)) {
        seenIds.add(textKey);
        uniqueReviews.push(review);
      }
    }
  }
  
  // Sort by publishedDate (most recent first), then by rating (highest first)
  uniqueReviews.sort((a, b) => {
    const dateA = new Date(a.publishedDate || 0).getTime();
    const dateB = new Date(b.publishedDate || 0).getTime();
    if (dateB !== dateA) {
      return dateB - dateA; // Most recent first
    }
    return b.rating - a.rating; // Higher rating first
  });
  
  // Return top 15 reviews
  return uniqueReviews.slice(0, 15);
}

// Fetch Trustpilot score
function fetchTrustpilotScore() {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    https.get(TRUSTPILOT_URL, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          // Extract reviews first (4-5 stars only)
          const reviews = extractReviews(data);
          
          // Method 1: Extract JSON-LD structured data (multiple script tags)
          const jsonLdMatches = data.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
          
          for (const match of jsonLdMatches) {
            try {
              const structuredData = JSON.parse(match[1]);
              
              // Check if it's an Organization or LocalBusiness with aggregateRating
              if (structuredData.aggregateRating || (structuredData['@type'] && structuredData.aggregateRating)) {
                const rating = structuredData.aggregateRating || structuredData;
                if (rating.ratingValue) {
                  resolve({
                    score: parseFloat(rating.ratingValue),
                    reviewCount: parseInt(rating.reviewCount) || 0,
                    maxScore: parseInt(rating.bestRating) || 5,
                    reviews: reviews,
                    timestamp: new Date().toISOString(),
                    url: TRUSTPILOT_URL
                  });
                  return;
                }
              }
              
              // Check if it's an array
              if (Array.isArray(structuredData)) {
                for (const item of structuredData) {
                  if (item.aggregateRating && item.aggregateRating.ratingValue) {
                    resolve({
                      score: parseFloat(item.aggregateRating.ratingValue),
                      reviewCount: parseInt(item.aggregateRating.reviewCount) || 0,
                      maxScore: parseInt(item.aggregateRating.bestRating) || 5,
                      reviews: reviews,
                      timestamp: new Date().toISOString(),
                      url: TRUSTPILOT_URL
                    });
                    return;
                  }
                }
              }
            } catch (parseError) {
              // Continue to next match
              continue;
            }
          }

          // Method 2: Extract from data attributes or inline JSON
          const dataPropsMatch = data.match(/"ratingValue":\s*"([\d.]+)"/);
          const reviewCountMatch = data.match(/"reviewCount":\s*"(\d+)"/);
          
          if (dataPropsMatch) {
            resolve({
              score: parseFloat(dataPropsMatch[1]),
              reviewCount: reviewCountMatch ? parseInt(reviewCountMatch[1]) : null,
              maxScore: 5,
              reviews: reviews,
              timestamp: new Date().toISOString(),
              url: TRUSTPILOT_URL
            });
            return;
          }

          // Method 3: Parse from page title (Swedish format)
          const titleMatch = data.match(/bedömdes som "([^"]+)" med ([\d,]+) \/ (\d+)/);
          
          if (titleMatch) {
            resolve({
              rating: titleMatch[1],
              score: parseFloat(titleMatch[2].replace(',', '.')),
              maxScore: parseInt(titleMatch[3]),
              reviewCount: reviewCountMatch ? parseInt(reviewCountMatch[1]) : null,
              reviews: reviews,
              timestamp: new Date().toISOString(),
              url: TRUSTPILOT_URL
            });
            return;
          }

          // Method 4: Try to find rating in various formats
          const ratingPatterns = [
            /ratingValue["']?\s*[:=]\s*["']?([\d.]+)/i,
            /"rating":\s*"([\d.]+)"/i,
            /data-rating=["']([\d.]+)["']/i,
            /class="[^"]*rating[^"]*"[^>]*>([\d.]+)/i
          ];

          for (const pattern of ratingPatterns) {
            const match = data.match(pattern);
            if (match) {
              const score = parseFloat(match[1]);
              if (score > 0 && score <= 5) {
                resolve({
                  score: score,
                  reviewCount: reviewCountMatch ? parseInt(reviewCountMatch[1]) : null,
                  maxScore: 5,
                  reviews: reviews,
                  timestamp: new Date().toISOString(),
                  url: TRUSTPILOT_URL
                });
                return;
              }
            }
          }

          // If all methods fail, log a snippet for debugging
          console.error('Could not extract data. HTML snippet (first 2000 chars):', data.substring(0, 2000));
          reject(new Error('Could not extract Trustpilot data - page structure may have changed'));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// Update Trustpilot data and save to database
async function updateTrustpilotData() {
  console.log('Fetching Trustpilot score...');
  try {
    const { saveData } = require('./db');
    const data = await fetchTrustpilotScore();
    await saveData(data);
    console.log('✓ Score updated successfully');
    return data;
  } catch (error) {
    console.error('✗ Error fetching score:', error.message);
    throw error;
  }
}

module.exports = {
  fetchTrustpilotScore,
  updateTrustpilotData,
  extractReviews
};


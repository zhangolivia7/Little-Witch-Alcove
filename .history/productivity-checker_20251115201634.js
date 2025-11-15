// Productivity checker using Google Gemini API
// This file demonstrates how to check if a user's tab is productive

// IMPORTANT: Get your API key from https://aistudio.google.com/app/apikey
// Store it securely - never commit it to version control!
// For production, consider using chrome.storage.local to store the API key

const GEMINI_API_KEY = 'YOUR_API_KEY_HERE'; // Replace with your actual API key
// Using v1 API with gemini-pro model (stable and widely available)
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent';

/**
 * Check if the current active tab is productive using Gemini API
 * @returns {Promise<{isProductive: boolean, reason: string}>}
 */
async function checkTabProductivity() {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url) {
      return { isProductive: false, reason: 'No active tab found' };
    }

    // Skip chrome:// and extension pages
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return { isProductive: false, reason: 'Chrome internal page' };
    }

    // Prepare the prompt for Gemini
    const prompt = `Analyze if this website is productive for focused work. Consider:
- Educational content (courses, tutorials, documentation)
- Work-related tools (email, project management, coding platforms)
- Professional development resources
- Research and learning materials

NOT productive:
- Social media (Facebook, Twitter, Instagram, TikTok, Reddit for entertainment)
- Entertainment sites (YouTube for non-educational content, Netflix, games)
- Shopping sites (unless work-related)
- News sites (unless for professional research)

URL: ${tab.url}
Title: ${tab.title || 'No title'}

Respond with ONLY a JSON object in this exact format:
{
  "isProductive": true or false,
  "reason": "brief explanation"
}`;

    // Call Gemini API
    const apiUrl = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
    console.log('Calling Gemini API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });
    
    console.log('Gemini API response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch (e) {
        console.error('Gemini API error response:', errorText);
      }
      console.error('Gemini API error:', errorMessage);
      return { isProductive: false, reason: errorMessage };
    }

    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;
    
    // Parse the JSON response
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : responseText;
      const result = JSON.parse(jsonText);
      
      return {
        isProductive: result.isProductive === true,
        reason: result.reason || 'No reason provided'
      };
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      // Fallback: check if response contains "true" or "false"
      const isProductive = responseText.toLowerCase().includes('"isProductive": true') || 
                          responseText.toLowerCase().includes('"isproductive": true');
      return {
        isProductive,
        reason: 'Parsed from response text'
      };
    }
  } catch (error) {
    console.error('Error checking tab productivity:', error);
    return { isProductive: false, reason: `Error: ${error.message}` };
  }
}

/**
 * Check productivity periodically and pause timer if unproductive
 * This can be called from the background script
 */
async function monitorProductivity() {
  const result = await checkTabProductivity();
  
  chrome.storage.local.get(['timerStartTime', 'timerPaused', 'productivityMonitoring'], (storage) => {
    // Only monitor if timer is running and monitoring is enabled
    if (!storage.timerStartTime || storage.timerPaused || !storage.productivityMonitoring) {
      return;
    }

    if (!result.isProductive) {
      // Tab is unproductive - you could pause the timer automatically
      // or just log it for now
      console.log('Unproductive tab detected:', result.reason);
      
      // Optional: Auto-pause timer when unproductive
      // Uncomment the following to enable auto-pause:
      /*
      chrome.storage.local.get(['timerPaused', 'timerPausedTime', 'timerTotalPausedTime'], (pauseResult) => {
        if (!pauseResult.timerPaused) {
          const pausedTime = Date.now();
          chrome.storage.local.set({
            timerPaused: true,
            timerPausedTime: pausedTime
          });
        }
      });
      */
    } else {
      // Tab is productive - resume if it was auto-paused
      console.log('Productive tab:', result.reason);
    }
  });
}

// Export functions for use in background.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkTabProductivity, monitorProductivity };
}


// Productivity checker using Google Gemini API
// This file demonstrates how to check if a user's tab is productive

// IMPORTANT: Get your API key from https://aistudio.google.com/app/apikey
// Store it securely - never commit it to version control!
// For production, consider using chrome.storage.local to store the API key

const GEMINI_API_KEY = 'YOUR_API_KEY_HERE'; // Replace with your actual API key

/**
 * List available models to find one that works
 */
async function listAvailableModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
    if (response.ok) {
      const data = await response.json();
      console.log('Available models:', data.models?.map(m => m.name) || []);
      return data.models || [];
    }
  } catch (error) {
    console.error('Error listing models:', error);
  }
  return [];
}

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

    // Try different API endpoints - using the format that works with the API key
    // The correct format is: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
    const apiEndpoints = [
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent'
    ];

    let lastError = null;
    
    for (const endpoint of apiEndpoints) {
      try {
        const apiUrl = `${endpoint}?key=${GEMINI_API_KEY}`;
        console.log('Trying Gemini API:', endpoint);
        
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

        // Check if response is a redirect (3xx status codes)
        if (response.redirected || response.status >= 300 && response.status < 400) {
          const redirectUrl = response.url || 'unknown';
          console.error('Gemini API redirected to:', redirectUrl);
          lastError = `API redirected (likely invalid API key or endpoint). Status: ${response.status}`;
          continue; // Try next endpoint
        }

        if (response.ok) {
          // Check if response is actually JSON
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const textResponse = await response.text();
            console.error('Gemini API returned non-JSON response:', textResponse.substring(0, 200));
            lastError = `API returned non-JSON response. Content-Type: ${contentType}`;
            continue; // Try next endpoint
          }
          
          // Success! Parse the response
          const data = await response.json();
          
          // Check if response has expected structure
          if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error('Gemini API returned unexpected response structure:', data);
            lastError = 'API returned unexpected response structure';
            continue; // Try next endpoint
          }
          
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
        } else {
          // Not OK, try next endpoint
          const errorText = await response.text();
          let errorMessage = `API error: ${response.status}`;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorMessage;
          } catch (e) {
            // Keep the default error message
          }
          lastError = errorMessage;
          console.log(`Endpoint ${endpoint} failed:`, errorMessage);
          continue; // Try next endpoint
        }
      } catch (fetchError) {
        lastError = fetchError.message;
        console.log(`Endpoint ${endpoint} threw error:`, fetchError);
        continue; // Try next endpoint
      }
    }
    
    // All predefined endpoints failed - try to list available models and use one
    console.log('All predefined endpoints failed. Attempting to list available models...');
    const availableModels = await listAvailableModels();
    
    if (availableModels.length > 0) {
      // Try the first available model that supports generateContent
      for (const model of availableModels) {
        const modelName = model.name.replace('models/', ''); // Remove 'models/' prefix if present
        const supportedMethods = model.supportedGenerationMethods || [];
        
        if (supportedMethods.includes('generateContent')) {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
          console.log('Trying available model:', endpoint);
          
          try {
            const apiUrl = `${endpoint}?key=${GEMINI_API_KEY}`;
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
            
            if (response.ok) {
              const data = await response.json();
              const responseText = data.candidates[0].content.parts[0].text;
              
              try {
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                const jsonText = jsonMatch ? jsonMatch[0] : responseText;
                const result = JSON.parse(jsonText);
                
                console.log('Successfully used model:', modelName);
                return {
                  isProductive: result.isProductive === true,
                  reason: result.reason || 'No reason provided'
                };
              } catch (parseError) {
                const isProductive = responseText.toLowerCase().includes('"isProductive": true') || 
                                responseText.toLowerCase().includes('"isproductive": true');
                return {
                  isProductive,
                  reason: 'Parsed from response text'
                };
              }
            }
          } catch (error) {
            console.log(`Model ${modelName} failed:`, error);
            continue;
          }
        }
      }
    }
    
    // All endpoints failed
    console.error('All Gemini API endpoints failed. Last error:', lastError);
    return { isProductive: false, reason: lastError || 'All API endpoints failed. Please check your API key and model availability.' };

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


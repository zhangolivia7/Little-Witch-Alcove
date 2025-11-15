// Productivity checker using Google Gemini API
// Checks if the current tab is productive for focused work

// API key is stored in chrome.storage.local (see API_KEY_SETUP.md)

/**
 * Gets the Gemini API key from Chrome storage
 */
async function getGeminiApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      resolve(result.geminiApiKey || null);
    });
  });
}

/**
 * Lists available Gemini models
 */
async function listAvailableModels() {
  try {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      console.error('No Gemini API key found. Please set it in chrome.storage.local');
      return [];
    }
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (response.ok) {
      const data = await response.json();
      return data.models || [];
    }
  } catch (error) {
    console.error('Error listing models:', error);
  }
  return [];
}

/**
 * Checks if the current tab is productive using Gemini API
 * @returns {Promise<{isProductive: boolean, reason: string}>}
 */
async function checkTabProductivity() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url) {
      return { isProductive: false, reason: 'No active tab found' };
    }

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return { isProductive: false, reason: 'Chrome internal page' };
    }
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

    const apiEndpoints = [
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
      'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent'
    ];

    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
      return { 
        isProductive: false, 
        reason: 'No Gemini API key found. See API_KEY_SETUP.md for setup instructions.' 
      };
    }

    let lastError = null;
    
    for (const endpoint of apiEndpoints) {
      try {
        const apiUrl = `${endpoint}?key=${apiKey}`;
        
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

        if (response.redirected || response.status >= 300 && response.status < 400) {
          console.error('Gemini API redirected to:', response.url || 'unknown');
          lastError = `API redirected (likely invalid API key or endpoint). Status: ${response.status}`;
          continue;
        }

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const textResponse = await response.text();
            console.error('Gemini API returned non-JSON response:', textResponse.substring(0, 200));
            lastError = `API returned non-JSON response. Content-Type: ${contentType}`;
            continue;
          }
          
          const data = await response.json();
          
          if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error('Gemini API returned unexpected response structure:', data);
            lastError = 'API returned unexpected response structure';
            continue;
          }
          
          const responseText = data.candidates[0].content.parts[0].text;
          
          try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            const jsonText = jsonMatch ? jsonMatch[0] : responseText;
            const result = JSON.parse(jsonText);
            
            return {
              isProductive: result.isProductive === true,
              reason: result.reason || 'No reason provided'
            };
          } catch (parseError) {
            console.error('Failed to parse Gemini response:', parseError);
            const isProductive = responseText.toLowerCase().includes('"isProductive": true') || 
                                responseText.toLowerCase().includes('"isproductive": true');
            return {
              isProductive,
              reason: 'Parsed from response text'
            };
          }
        } else {
          let errorText = '';
          let errorMessage = `API error: ${response.status}`;
          try {
            errorText = await response.text();
            if (errorText.includes('<html') || errorText.includes('<!DOCTYPE')) {
              errorMessage = `API returned HTML page (likely redirect). Check API key. Status: ${response.status}`;
              console.error(`Endpoint ${endpoint} returned HTML instead of JSON`);
            } else {
              try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error?.message || errorMessage;
              } catch (e) {
                errorMessage = `API error ${response.status}: ${errorText.substring(0, 100)}`;
              }
            }
          } catch (e) {
            errorMessage = `API error ${response.status}: Could not read response`;
          }
          lastError = errorMessage;
          continue;
        }
      } catch (fetchError) {
        lastError = fetchError.message;
        continue; // Try next endpoint
      }
    }
    
    const availableModels = await listAvailableModels();
    
    if (availableModels.length > 0) {
      for (const model of availableModels) {
        const modelName = model.name.replace('models/', '');
        const supportedMethods = model.supportedGenerationMethods || [];
        
        if (supportedMethods.includes('generateContent')) {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
          
          try {
            const apiUrl = `${endpoint}?key=${apiKey}`;
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
            continue;
          }
        }
      }
    }
    
    console.error('All Gemini API endpoints failed. Last error:', lastError);
    return { isProductive: false, reason: lastError || 'All API endpoints failed. Please check your API key and model availability.' };

  } catch (error) {
    console.error('Error checking tab productivity:', error);
    return { isProductive: false, reason: `Error: ${error.message}` };
  }
}

/**
 * Monitors productivity and can pause timer if unproductive
 * Called periodically from background.js
 */
async function monitorProductivity() {
  const result = await checkTabProductivity();
  
  chrome.storage.local.get(['timerStartTime', 'timerPaused', 'productivityMonitoring'], (storage) => {
    if (!storage.timerStartTime || storage.timerPaused || !storage.productivityMonitoring) {
      return;
    }

    if (!result.isProductive) {
      // Timer will be paused automatically by background.js
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkTabProductivity, monitorProductivity };
}


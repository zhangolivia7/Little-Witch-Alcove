// Background worker for persistent timer
importScripts('productivity-checker.js');

// Cache to avoid checking same tab multiple times quickly
const productivityCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 min

// Track API failures to disable monitoring if API broken
let apiFailureCount = 0;
const MAX_API_FAILURES = 3; // Disable after 3 consecutive failures

// Listen for timer start/stop/pause events
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startTimer') {
    const startTime = Date.now();
    chrome.storage.local.set({
      timerStartTime: startTime,
      timerPaused: false,
      timerPausedTime: 0,
      timerTotalPausedTime: 0,
      lastAwardedMinute: 0,
      productivityMonitoring: true,
      hadUnproductivePause: false
    });
    
    // alarm to award potions every minute
    chrome.alarms.create('awardPotion', { periodInMinutes: 1 });
    
    // monitor productivity every 30 seconds
    chrome.alarms.create('checkProductivity', { periodInMinutes: 0.5 });
    
    // check immediately when timer start
    checkCurrentTabProductivity();
  } else if (request.action === 'pauseTimer') {
    chrome.storage.local.get(['timerPaused', 'timerPausedTime', 'timerTotalPausedTime'], (result) => {
      if (!result.timerPaused) {
        // pausing now - record pause time (manual pause, not bc unproductive tab)
        const pausedTime = Date.now();
        chrome.storage.local.set({
          timerPaused: true,
          timerPausedTime: pausedTime,
          pausedByUnproductive: false,
          unproductiveReason: null
        });
      }
    });
  } else if (request.action === 'resumeTimer') {
    chrome.storage.local.get(['timerPausedTime', 'timerTotalPausedTime'], (result) => {
      if (result.timerPausedTime) {
        // resuming - add paused duration to total paused time
        const pausedDuration = Date.now() - result.timerPausedTime;
        const newTotalPausedTime = (result.timerTotalPausedTime || 0) + pausedDuration;
        chrome.storage.local.set({
          timerPaused: false,
          timerPausedTime: 0,
          timerTotalPausedTime: newTotalPausedTime,
          pausedByUnproductive: false,
          unproductiveReason: null
        });
      }
    });
  } else if (request.action === 'stopTimer') {
    chrome.storage.local.remove(['timerStartTime', 'timerPaused', 'timerPausedTime', 'timerTotalPausedTime', 'lastAwardedMinute', 'productivityMonitoring', 'pausedByUnproductive', 'unproductiveReason', 'hadUnproductivePause']);
    chrome.alarms.clear('awardPotion');
    chrome.alarms.clear('checkProductivity');
  }
});

// Award potion every minute
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'awardPotion') {
    chrome.storage.local.get(['timerStartTime', 'timerPaused', 'timerPausedTime', 'timerTotalPausedTime', 'lastAwardedMinute'], (result) => {
      // Only award if timer is running and not paused
      if (result.timerStartTime && !result.timerPaused) {
        const currentTime = Date.now();
        const elapsed = currentTime - result.timerStartTime - (result.timerTotalPausedTime || 0);
        const minutes = Math.floor(elapsed / 60000);
        const lastAwarded = result.lastAwardedMinute || 0;
        
        // Award one potion for each new minute that has passed
        if (minutes > lastAwarded) {
          chrome.storage.local.get(['potionCount'], (potionResult) => {
            const currentCount = potionResult.potionCount || 0;
            chrome.storage.local.set({
              potionCount: currentCount + 1,
              lastAwardedMinute: minutes
            });
          });
        }
      }
    });
  } else if (alarm.name === 'checkProductivity') {
    checkCurrentTabProductivity();
  }
});

// Monitor tab changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  checkCurrentTabProductivity();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    checkCurrentTabProductivity();
  }
});

/**
 * Check current tab productivity and show warning if unproductive
 */
async function checkCurrentTabProductivity() {
  chrome.storage.local.get(['timerStartTime', 'timerPaused', 'productivityMonitoring', 'pausedByUnproductive'], async (storage) => {
    // Only check if timer is running and monitoring is enabled
    if (!storage.timerStartTime || !storage.productivityMonitoring) {
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) return;

      // Skip chrome:// and extension pages
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        return;
      }

      // Check cache first
      const cacheKey = tab.url;
      const cached = productivityCache.get(cacheKey);
      let result;
      
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        result = cached.result;
      } else {
        // Check productivity
        try {
          result = await checkTabProductivity();
          // Cache the result
          productivityCache.set(cacheKey, { result, timestamp: Date.now() });
          // Reset failure count on success
          apiFailureCount = 0;
        } catch (error) {
          // API failed - increment failure count
          apiFailureCount++;
          console.error('Productivity check failed:', error);
          
          // Disable monitoring if API fails too many times
          if (apiFailureCount >= MAX_API_FAILURES) {
            console.warn('Disabling productivity monitoring due to repeated API failures');
            chrome.storage.local.set({ productivityMonitoring: false });
            chrome.alarms.clear('checkProductivity');
            return; // Stop checking
          }
          
          // Return default (assume productive to avoid false positives)
          result = { isProductive: true, reason: 'API unavailable' };
        }
      }
      
      // Handle productivity-based pause/resume
      if (!result.isProductive) {
        showUnproductiveWarning(tab.id, result.reason);
        
        // Auto-pause if timer is running and not already paused
        if (!storage.timerPaused) {
          const pausedTime = Date.now();
          chrome.storage.local.set({
            timerPaused: true,
            timerPausedTime: pausedTime,
            pausedByUnproductive: true,
            unproductiveReason: result.reason,
            hadUnproductivePause: true
          });
        } else if (storage.pausedByUnproductive) {
          // Update reason if already paused by unproductive tab
          chrome.storage.local.set({
            unproductiveReason: result.reason
          });
        }
      } else {
        // Remove warning if tab is productive
        chrome.tabs.sendMessage(tab.id, { action: 'hideProductivityWarning' }).catch(() => {});
        
        // Auto-resume if paused due to unproductive tab
        if (storage.timerPaused && storage.pausedByUnproductive) {
          chrome.storage.local.get(['timerPausedTime', 'timerTotalPausedTime'], (pauseResult) => {
            if (pauseResult.timerPausedTime) {
              const pausedDuration = Date.now() - pauseResult.timerPausedTime;
              const newTotalPausedTime = (pauseResult.timerTotalPausedTime || 0) + pausedDuration;
              chrome.storage.local.set({
                timerPaused: false,
                timerPausedTime: 0,
                timerTotalPausedTime: newTotalPausedTime,
                pausedByUnproductive: false,
                unproductiveReason: null
              });
              
              // Show green resume banner
              chrome.tabs.sendMessage(tab.id, { action: 'showResumeBanner' }).catch(() => {});
            }
          });
        }
      }
    } catch (error) {
      console.error('Error checking productivity:', error);
    }
  });
}

/**
 * Show warning notification and inject warning banner
 */
function showUnproductiveWarning(tabId, reason) {
  // Show Chrome notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('Assets/Witch 48.png'),
    title: 'Little Witch Alcove',
    message: `You're on an unproductive tab! ${reason}`,
    priority: 2
  });

  // Inject warning banner into the page
  chrome.tabs.sendMessage(tabId, {
    action: 'showProductivityWarning',
    reason: reason
  }).catch((error) => {
    // Content script might not be ready, that's okay
    console.log('Could not send warning to content script:', error);
  });
}


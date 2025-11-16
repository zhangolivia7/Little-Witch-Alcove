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
    
    // monitor productivity every 30 seconds (normal mode)
    chrome.alarms.create('checkProductivity', { periodInMinutes: 0.5 });
    chrome.storage.local.set({ fastProductivityCheck: false });
    
    // check immediately when timer start
    checkCurrentTabProductivity();
    
    // notify all tabs to enter study state
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: 'startFocus' }).catch(() => {});
      });
    });
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
    chrome.storage.local.remove(['timerStartTime', 'timerPaused', 'timerPausedTime', 'timerTotalPausedTime', 'lastAwardedMinute', 'productivityMonitoring', 'pausedByUnproductive', 'unproductiveReason', 'hadUnproductivePause', 'fastProductivityCheck']);
    chrome.alarms.clear('awardPotion');
    chrome.alarms.clear('checkProductivity');
    
    // notify all tabs to exit study state
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: 'stopFocus' }).catch(() => {});
      });
    });
  }
});

// potion every min
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'awardPotion') {
    chrome.storage.local.get(['timerStartTime', 'timerPaused', 'timerPausedTime', 'timerTotalPausedTime', 'lastAwardedMinute'], (result) => {
      // only award if timer running and not paused
      if (result.timerStartTime && !result.timerPaused) {
        const currentTime = Date.now();
        const elapsed = currentTime - result.timerStartTime - (result.timerTotalPausedTime || 0);
        const minutes = Math.floor(elapsed / 60000);
        const lastAwarded = result.lastAwardedMinute || 0;
        
        // award one potion for each new minute that has passed
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
 * Check curr tab productivity and show warning if unproductive
 */
async function checkCurrentTabProductivity() {
  chrome.storage.local.get(['timerStartTime', 'timerPaused', 'productivityMonitoring', 'pausedByUnproductive'], async (storage) => {
    if (!storage.timerStartTime || !storage.productivityMonitoring) {
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) return;

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        return;
      }

      // check cache first
      const cacheKey = tab.url;
      const cached = productivityCache.get(cacheKey);
      let result;
      
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        result = cached.result;
      } else {
        // check productivity
        try {
          result = await checkTabProductivity();
          // cache result
          productivityCache.set(cacheKey, { result, timestamp: Date.now() });
          // reset fail count on success
          apiFailureCount = 0;
        } catch (error) {
          // API failed - increment failure count :(
          apiFailureCount++;
          console.error('Productivity check failed:', error);
          
          // we wanna disable monitoring if API fails too many times
          if (apiFailureCount >= MAX_API_FAILURES) {
            console.warn('Disabling productivity monitoring due to repeated API failures');
            chrome.storage.local.set({ productivityMonitoring: false });
            chrome.alarms.clear('checkProductivity');
            return;
          }
          
          // return default (assume productive to avoid FP)
          result = { isProductive: true, reason: 'API unavailable' };
        }
      }
      
      // handle productivity-based pause/resume
      if (!result.isProductive) {
        showUnproductiveWarning(tab.id, result.reason);
        
        // Switch to fast checking (10 seconds) when unproductive tab detected
        chrome.storage.local.get(['fastProductivityCheck'], (fastCheck) => {
          if (!fastCheck.fastProductivityCheck) {
            chrome.alarms.clear('checkProductivity');
            chrome.alarms.create('checkProductivity', { periodInMinutes: 10 / 60 }); // 10 seconds
            chrome.storage.local.set({ fastProductivityCheck: true });
          }
        });
        
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
          // Update reason if alr paused by unproductive tab
          chrome.storage.local.set({
            unproductiveReason: result.reason
          });
        }
      } else {
        // remove warning if tab productive
        chrome.tabs.sendMessage(tab.id, { action: 'hideProductivityWarning' }).catch(() => {});
        
        // Switch back to normal checking (30 seconds) when productive tab detected
        chrome.storage.local.get(['fastProductivityCheck'], (fastCheck) => {
          if (fastCheck.fastProductivityCheck) {
            chrome.alarms.clear('checkProductivity');
            chrome.alarms.create('checkProductivity', { periodInMinutes: 0.5 }); // 30 seconds
            chrome.storage.local.set({ fastProductivityCheck: false });
          }
        });
        
        // auto-res if paused bc unproductive tab
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
              
              // show green resume banner so they know they're locked in
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
 * Show warning notif + inject warning banner
 */
function showUnproductiveWarning(tabId, reason) {
  // Show Chrome notif
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('Assets/Witch 48.png'),
    title: 'Little Witch Alcove',
    message: `You're on an unproductive tab! ${reason}`,
    priority: 2
  });

  //inject warning banner into the page
  chrome.tabs.sendMessage(tabId, {
    action: 'showProductivityWarning',
    reason: reason
  }).catch((error) => {
    console.log('Could not send warning to content script:', error);
  });
}


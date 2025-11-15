let timerInterval = null;
let isPaused = false;

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getPotionCount() {
  return parseInt(document.getElementById("potion-count").textContent) || 0;
}

function setPotionCount(count) {
  document.getElementById("potion-count").textContent = count;
  // Save to storage whenever potion count changes
  chrome.storage.local.set({ potionCount: count });
}

function loadPotionCount() {
  chrome.storage.local.get(['potionCount'], function(result) {
    const savedCount = result.potionCount || 0;
    document.getElementById("potion-count").textContent = savedCount;
  });
}

function calculateElapsedTime() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['timerStartTime', 'timerPaused', 'timerPausedTime', 'timerTotalPausedTime'], (result) => {
      if (!result.timerStartTime) {
        resolve(0);
        return;
      }
      
      if (result.timerPaused) {
        // Timer is paused, calculate up to pause time
        const pausedAt = result.timerPausedTime || Date.now();
        const elapsed = pausedAt - result.timerStartTime - (result.timerTotalPausedTime || 0);
        resolve(Math.max(0, Math.floor(elapsed / 1000)));
      } else {
        // Timer is running, calculate current elapsed time
        const currentTime = Date.now();
        const elapsed = currentTime - result.timerStartTime - (result.timerTotalPausedTime || 0);
        resolve(Math.max(0, Math.floor(elapsed / 1000)));
      }
    });
  });
}

function updateTimerDisplay() {
  calculateElapsedTime().then((seconds) => {
    document.getElementById("timer-text").textContent = formatTime(seconds);
  });
}

function startTimer() {
  if (timerInterval) return;
  
  // Send message to background script to start timer
  chrome.runtime.sendMessage({ action: 'startTimer' });
  
  // Update UI
  document.getElementById("focus-btn").style.display = "none";
  document.getElementById("timer-controls").style.display = "flex";
  document.getElementById("aura-overlay").style.display = "flex";
  
  // Start local interval to update display
  timerInterval = setInterval(() => {
    updateTimerDisplay();
    loadPotionCount(); // Refresh potion count in case background script updated it
  }, 1000);
  
  updateTimerDisplay();
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // Send message to background script to stop timer
  chrome.runtime.sendMessage({ action: 'stopTimer' });
  
  // Update UI
  document.getElementById("focus-btn").style.display = "block";
  document.getElementById("timer-controls").style.display = "none";
  document.getElementById("aura-overlay").style.display = "none";
  document.getElementById("timer-text").textContent = "00:00";
  isPaused = false;
  hideUnproductiveWarning();
  const pauseBtn = document.getElementById("pause-btn");
  pauseBtn.innerHTML = '<img src="Assets/Icons/Pause.svg" alt="Pause">';
}

function loadTimerState() {
  chrome.storage.local.get(['timerStartTime', 'timerPaused', 'pausedByUnproductive', 'unproductiveReason'], (result) => {
    if (result.timerStartTime) {
      // Timer is running, restore UI
      isPaused = result.timerPaused || false;
      document.getElementById("focus-btn").style.display = "none";
      document.getElementById("timer-controls").style.display = "flex";
      document.getElementById("aura-overlay").style.display = "flex";
      
      const pauseBtn = document.getElementById("pause-btn");
      if (isPaused) {
        pauseBtn.innerHTML = '<img src="Assets/Icons/Play.svg" alt="Play">';
      } else {
        pauseBtn.innerHTML = '<img src="Assets/Icons/Pause.svg" alt="Pause">';
      }
      
      // Show unproductive warning if paused due to unproductive tab
      if (result.pausedByUnproductive && result.unproductiveReason) {
        showUnproductiveWarning(result.unproductiveReason);
      } else {
        hideUnproductiveWarning();
      }
      
      // Start updating display
      if (!timerInterval) {
        timerInterval = setInterval(() => {
          updateTimerDisplay();
          loadPotionCount(); // Refresh potion count in case background script updated it
          checkUnproductiveState(); // Check if still paused by unproductive tab
        }, 1000);
      }
      
      updateTimerDisplay();
    }
  });
}

function showUnproductiveWarning(reason) {
  const warningDiv = document.getElementById("unproductive-warning");
  const messageP = document.getElementById("unproductive-message");
  messageP.textContent = `Timer paused: ${reason}`;
  warningDiv.style.display = "block";
}

function hideUnproductiveWarning() {
  document.getElementById("unproductive-warning").style.display = "none";
}

function checkUnproductiveState() {
  chrome.storage.local.get(['timerPaused', 'pausedByUnproductive', 'unproductiveReason'], (result) => {
    if (result.pausedByUnproductive && result.unproductiveReason) {
      showUnproductiveWarning(result.unproductiveReason);
    } else {
      hideUnproductiveWarning();
    }
  });
}

document.getElementById("focus-btn").addEventListener("click", () => {
  startTimer();
});

document.getElementById("pause-btn").addEventListener("click", () => {
  isPaused = !isPaused;
  const pauseBtn = document.getElementById("pause-btn");
  
  if (isPaused) {
    chrome.runtime.sendMessage({ action: 'pauseTimer' });
    pauseBtn.innerHTML = '<img src="Assets/Icons/Play.svg" alt="Play">';
  } else {
    chrome.runtime.sendMessage({ action: 'resumeTimer' });
    pauseBtn.innerHTML = '<img src="Assets/Icons/Pause.svg" alt="Pause">';
  }
});

document.getElementById("stop-btn").addEventListener("click", () => {
  stopTimer();
  hideUnproductiveWarning();
});

document.getElementById("resume-anyway-btn").addEventListener("click", () => {
  // Resume timer even if on unproductive tab
  chrome.runtime.sendMessage({ action: 'resumeTimer' });
  hideUnproductiveWarning();
  isPaused = false;
  const pauseBtn = document.getElementById("pause-btn");
  pauseBtn.innerHTML = '<img src="Assets/Icons/Pause.svg" alt="Pause">';
});

// Listen for storage changes to update unproductive warning
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.pausedByUnproductive || changes.unproductiveReason) {
      checkUnproductiveState();
    }
  }
});

// Load saved potion count and timer state when popup opens
loadPotionCount();
loadTimerState();

// Handle witch toggle
function loadWitchToggle() {
  chrome.storage.local.get(['witchEnabled'], function(result) {
    const enabled = result.witchEnabled || false;
    document.getElementById("witch-toggle").checked = enabled;
  });
}

function saveWitchToggle(enabled) {
  chrome.storage.local.set({ witchEnabled: enabled });
  // Send message to content script to show/hide witch
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0]) {
      // Check if it's a valid web page (not chrome:// or extension pages)
      if (tabs[0].url && (tabs[0].url.startsWith('http://') || tabs[0].url.startsWith('https://'))) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: enabled ? 'showWitch' : 'hideWitch' 
        }).catch((error) => {
          console.log('Little Witch Alcove: Could not send message to content script:', error);
          // Content script might not be ready yet, that's okay
          // It will check storage on load
        });
      } else {
        console.log('Little Witch Alcove: Cannot inject on this page type:', tabs[0].url);
      }
    }
  });
}

document.getElementById("witch-toggle").addEventListener("change", function() {
  const enabled = this.checked;
  saveWitchToggle(enabled);
});

// Load toggle state when popup opens
loadWitchToggle();

// Handle customization item selection
function saveCustomization() {
  const hatRow = document.querySelector('.category-row:first-of-type .items-scroll');
  const robeRow = document.querySelector('.category-row:last-of-type .items-scroll');
  
  let selectedHat = 1; // Default
  let selectedRobe = 1; // Default
  
  if (hatRow) {
    const selectedHatSlot = hatRow.querySelector('.item-slot.selected');
    if (selectedHatSlot) {
      const hatIndex = Array.from(hatRow.querySelectorAll('.item-slot')).indexOf(selectedHatSlot);
      selectedHat = hatIndex + 1; // 1-indexed
    }
  }
  
  if (robeRow) {
    const selectedRobeSlot = robeRow.querySelector('.item-slot.selected');
    if (selectedRobeSlot) {
      const robeIndex = Array.from(robeRow.querySelectorAll('.item-slot')).indexOf(selectedRobeSlot);
      selectedRobe = robeIndex + 1; // 1-indexed
    }
  }
  
  chrome.storage.local.set({
    selectedHat: selectedHat,
    selectedRobe: selectedRobe
  });
  
  // Notify content script to update witch appearance
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0] && (tabs[0].url.startsWith('http://') || tabs[0].url.startsWith('https://'))) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'updateCustomization',
        hat: selectedHat,
        robe: selectedRobe
      }).catch(() => {});
    }
  });
}

function loadCustomization() {
  chrome.storage.local.get(['selectedHat', 'selectedRobe'], function(result) {
    const hatIndex = (result.selectedHat || 1) - 1; // Convert to 0-indexed
    const robeIndex = (result.selectedRobe || 1) - 1;
    
    const hatRow = document.querySelector('.category-row:first-of-type .items-scroll');
    const robeRow = document.querySelector('.category-row:last-of-type .items-scroll');
    
    if (hatRow) {
      const hatSlots = hatRow.querySelectorAll('.item-slot');
      hatSlots.forEach((slot, index) => {
        slot.classList.toggle('selected', index === hatIndex);
      });
    }
    
    if (robeRow) {
      const robeSlots = robeRow.querySelectorAll('.item-slot');
      robeSlots.forEach((slot, index) => {
        slot.classList.toggle('selected', index === robeIndex);
      });
    }
    
    // Update preview after loading customization
    updateWitchPreview();
  });
}

// Purchase system
let pendingPurchase = null;

function loadUnlockedItems() {
  chrome.storage.local.get(['unlockedItems'], function(result) {
    let unlockedItems = result.unlockedItems || { hat: [1], robe: [1] }; // Default: only first items unlocked
    
    // Ensure first items are always unlocked
    if (!unlockedItems.hat || !unlockedItems.hat.includes(1)) {
      if (!unlockedItems.hat) unlockedItems.hat = [];
      if (!unlockedItems.hat.includes(1)) unlockedItems.hat.push(1);
    }
    if (!unlockedItems.robe || !unlockedItems.robe.includes(1)) {
      if (!unlockedItems.robe) unlockedItems.robe = [];
      if (!unlockedItems.robe.includes(1)) unlockedItems.robe.push(1);
    }
    
    // Save back to ensure consistency
    saveUnlockedItems(unlockedItems);
    
    // Update UI based on unlocked items
    document.querySelectorAll('.item-slot').forEach(slot => {
      const itemType = slot.getAttribute('data-item-type');
      const itemIndex = parseInt(slot.getAttribute('data-item-index'));
      const isUnlocked = unlockedItems[itemType] && unlockedItems[itemType].includes(itemIndex);
      
      if (isUnlocked) {
        slot.classList.remove('locked');
        slot.setAttribute('data-unlocked', 'true');
        // Remove lock overlay if it exists
        const overlay = slot.querySelector('.lock-overlay');
        if (overlay) overlay.remove();
      } else {
        slot.classList.add('locked');
        slot.setAttribute('data-unlocked', 'false');
      }
    });
  });
}

function saveUnlockedItems(unlockedItems) {
  chrome.storage.local.set({ unlockedItems: unlockedItems });
}

function showPurchaseModal(slot) {
  const cost = parseInt(slot.getAttribute('data-cost'));
  const itemType = slot.getAttribute('data-item-type');
  const itemIndex = parseInt(slot.getAttribute('data-item-index'));
  const currentPotions = getPotionCount();
  
  document.getElementById('modal-cost').textContent = cost;
  const confirmBtn = document.getElementById('confirm-purchase-btn');
  
  // Disable confirm button if not enough potions
  if (currentPotions < cost) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Not Enough Potions';
  } else {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm';
  }
  
  pendingPurchase = { slot, cost, itemType, itemIndex };
  document.getElementById('purchase-modal').style.display = 'flex';
}

function hidePurchaseModal() {
  document.getElementById('purchase-modal').style.display = 'none';
  pendingPurchase = null;
}

function confirmPurchase() {
  if (!pendingPurchase) return;
  
  const { slot, cost, itemType, itemIndex } = pendingPurchase;
  const currentPotions = getPotionCount();
  
  if (currentPotions < cost) {
    alert('Not enough potions!');
    return;
  }
  
  // Deduct potions
  const newPotionCount = currentPotions - cost;
  setPotionCount(newPotionCount);
  
  // Unlock item
  chrome.storage.local.get(['unlockedItems'], function(result) {
    const unlockedItems = result.unlockedItems || { hat: [1], robe: [1] };
    
    if (!unlockedItems[itemType]) {
      unlockedItems[itemType] = [];
    }
    if (!unlockedItems[itemType].includes(itemIndex)) {
      unlockedItems[itemType].push(itemIndex);
    }
    
    saveUnlockedItems(unlockedItems);
    
    // Update UI
    slot.classList.remove('locked');
    slot.setAttribute('data-unlocked', 'true');
    const overlay = slot.querySelector('.lock-overlay');
    if (overlay) overlay.remove();
    
    hidePurchaseModal();
  });
}

// Modal event listeners
document.getElementById('confirm-purchase-btn').addEventListener('click', confirmPurchase);
document.getElementById('cancel-purchase-btn').addEventListener('click', hidePurchaseModal);
// Use event delegation for overlay since it might not exist when script runs
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    hidePurchaseModal();
  }
});

// Item slot click handlers
document.querySelectorAll('.item-slot').forEach(slot => {
  slot.addEventListener('click', function() {
    const isUnlocked = this.getAttribute('data-unlocked') === 'true';
    
    if (!isUnlocked) {
      // Show purchase modal for locked items
      showPurchaseModal(this);
      return;
    }
    
    // Handle selection for unlocked items
    const categoryRow = this.closest('.category-row');
    if (categoryRow) {
      // Remove selected class from all items in this row
      categoryRow.querySelectorAll('.item-slot').forEach(item => {
        item.classList.remove('selected');
      });
      // Add selected class to clicked item
      this.classList.add('selected');
      // Save customization
      saveCustomization();
    }
  });
});

// Load customization when popup opens
loadCustomization();
loadUnlockedItems();

// Update witch preview in popup
function updateWitchPreview() {
  chrome.storage.local.get(['selectedHat', 'selectedRobe'], function(result) {
    const hat = result.selectedHat || 1;
    const robe = result.selectedRobe || 1;
    
    // Use idle state for preview
    const state = 'Idle';
    const headPath = `Assets/Witch/${state}/${state} Head ${hat}.svg`;
    const bodyPath = `Assets/Witch/${state}/${state} Body ${robe}.svg`;
    
    const headImg = document.getElementById('witch-preview-head');
    const bodyImg = document.getElementById('witch-preview-body');
    
    const headWidth = 130; // Popup head size
    const bodyWidth = 72.8; // 28px/50px * 130px for idle state
    
    if (headImg) {
      headImg.src = chrome.runtime.getURL(headPath);
      
      // Function to calculate and set body position
      const updateBodyPosition = function() {
        if (headImg.naturalHeight && headImg.naturalWidth) {
          const headHeight = (headImg.naturalHeight / headImg.naturalWidth) * headWidth;
          const bodyTop = headHeight * 0.7; // Position body at 70% of head height
          if (bodyImg) {
            bodyImg.style.top = `${bodyTop}px`;
          }
        }
      };
      
      // Calculate body position when head loads
      headImg.onload = updateBodyPosition;
      
      // If head is already loaded, calculate position immediately
      if (headImg.complete && headImg.naturalHeight) {
        updateBodyPosition();
      }
    }
    
    if (bodyImg) {
      bodyImg.src = chrome.runtime.getURL(bodyPath);
      // Idle body is smaller: 28px at 50px head = 72.8px at 130px head
      bodyImg.style.width = `${bodyWidth}px`;
      // Center body horizontally: (130 - 72.8) / 2 = 28.6px
      bodyImg.style.left = `${(headWidth - bodyWidth) / 2}px`;
      // Top position will be set when head loads
    }
  });
}

// Update preview when customization changes
const originalSaveCustomization = saveCustomization;
saveCustomization = function() {
  originalSaveCustomization();
  updateWitchPreview();
};

// Load witch preview when popup opens
updateWitchPreview();
  
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
  // save to storage whenever potion count changes
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
        // timer paused, calc up to pause time
        const pausedAt = result.timerPausedTime || Date.now();
        const elapsed = pausedAt - result.timerStartTime - (result.timerTotalPausedTime || 0);
        resolve(Math.max(0, Math.floor(elapsed / 1000)));
      } else {
        // timer running, calc curr elapsed time
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
  
  showHexActivation();
  
  chrome.runtime.sendMessage({ action: 'startTimer' });
  
  document.getElementById("focus-btn").style.display = "none";
  document.getElementById("timer-controls").style.display = "flex";
  document.getElementById("aura-overlay").style.display = "flex";
  
  // Update witch preview to show Study state
  updateWitchPreview();
  
  // start local interval to update display
  timerInterval = setInterval(() => {
    updateTimerDisplay();
    loadPotionCount();
  }, 1000);
  
  updateTimerDisplay();
}

function showHexActivation() {
  const container = document.getElementById('celebration-container');
  if (!container) return;
  
  const message = document.createElement('div');
  message.className = 'hex-activation-message';
  message.innerHTML = 'Hex of Concentration<br>Activated!';
  
  const animName = `hexActivation${Date.now()}`;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ${animName} {
      0% {
        transform: translate(-50%, -50%) scale(0.8);
        opacity: 0;
      }
      15% {
        transform: translate(-50%, -50%) scale(1.05);
        opacity: 1;
      }
      25% {
        transform: translate(-50%, -50%) scale(1);
      }
      75% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
      }
      100% {
        transform: translate(-50%, -50%) scale(0.95);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
  
  message.style.cssText = `
    position: fixed;
    top: 35%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-family: 'QuiteMagical';
    font-size: 36px;
    font-weight: bold;
    color: #CAAFE5;
    text-shadow: 0 0 20px #CAAFE5, 0 0 40px #CAAFE5, 0 0 60px #CAAFE5, 2px 2px 4px rgba(0, 0, 0, 0.5);
    z-index: 10001;
    pointer-events: none;
    text-align: center;
    line-height: 1.3;
    white-space: pre-line;
    animation: ${animName} 2.5s ease-out forwards;
  `;
  
  container.appendChild(message);
  
  setTimeout(() => {
    if (message.parentNode) message.remove();
    if (style.parentNode) style.remove();
  }, 2500);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // check if we should celebrate before stopping
  chrome.storage.local.get(['timerStartTime', 'timerTotalPausedTime', 'hadUnproductivePause'], (result) => {
    if (result.timerStartTime) {
      const sessionDuration = Date.now() - result.timerStartTime - (result.timerTotalPausedTime || 0);
      const sessionSeconds = Math.floor(sessionDuration / 1000);
      const sessionMinutes = Math.floor(sessionSeconds / 60);
      
      // celebrate if session > 1 minute + no unproductive tabs
      if (sessionMinutes >= 1 && !result.hadUnproductivePause) {
        triggerCelebration();
      }
    }
  });
  
  // send msg to bg script to stop timer
  chrome.runtime.sendMessage({ action: 'stopTimer' });
  
  // update UI
  document.getElementById("focus-btn").style.display = "block";
  document.getElementById("timer-controls").style.display = "none";
  document.getElementById("aura-overlay").style.display = "none";
  document.getElementById("timer-text").textContent = "00:00";
  isPaused = false;
  hideUnproductiveWarning();
  const pauseBtn = document.getElementById("pause-btn");
  pauseBtn.innerHTML = '<img src="Assets/Icons/Pause.svg" alt="Pause">';
  
  // Update witch preview to show Idle state
  updateWitchPreview();
}

function loadTimerState() {
  chrome.storage.local.get(['timerStartTime', 'timerPaused', 'pausedByUnproductive', 'unproductiveReason'], (result) => {
    if (result.timerStartTime) {
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
      
      // show unproductive warning if paused bc of unproductive tab
      if (result.pausedByUnproductive && result.unproductiveReason) {
        showUnproductiveWarning(result.unproductiveReason);
      } else {
        hideUnproductiveWarning();
      }
      
      if (!timerInterval) {
        timerInterval = setInterval(() => {
          updateTimerDisplay();
          loadPotionCount();
          checkUnproductiveState();
        }, 1000);
      }
      
      updateTimerDisplay();
      
      // Update witch preview to show correct state (Study if running, Idle if paused)
      updateWitchPreview();
    }
  });
}

function showUnproductiveWarning(reason) {
  const overlay = document.getElementById("unproductive-overlay");
  const reasonText = document.getElementById("pause-reason-text");
  if (overlay && reasonText) {
    reasonText.textContent = reason || "You're on an unproductive tab";
    overlay.style.display = "flex";
  }
}

function hideUnproductiveWarning() {
  const overlay = document.getElementById("unproductive-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
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
  
  // Update witch preview based on pause state
  updateWitchPreview();
});

document.getElementById("stop-btn").addEventListener("click", () => {
  stopTimer();
  hideUnproductiveWarning();
});

// Llsten for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.pausedByUnproductive || changes.unproductiveReason) {
      checkUnproductiveState();
    }
  }
});

// load saved potion count and timer state when popup opens
loadPotionCount();
loadTimerState();

// witch toggle
function loadWitchToggle() {
  chrome.storage.local.get(['witchEnabled'], function(result) {
    const enabled = result.witchEnabled || false;
    document.getElementById("witch-toggle").checked = enabled;
  });
}

function saveWitchToggle(enabled) {
  chrome.storage.local.set({ witchEnabled: enabled });
  // Send msg to content script to show/hide witch
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0]) {
      // check if valid web page
      if (tabs[0].url && (tabs[0].url.startsWith('http://') || tabs[0].url.startsWith('https://'))) {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: enabled ? 'showWitch' : 'hideWitch' 
        }).catch((error) => {
          console.log('Little Witch Alcove: Could not send message to content script:', error);
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

loadWitchToggle();

// handle customization item selection
function saveCustomization() {
  const hatRow = document.querySelector('.category-row:first-of-type .items-scroll');
  const robeRow = document.querySelector('.category-row:last-of-type .items-scroll');
  
  let selectedHat = 1; 
  let selectedRobe = 1;
  
  if (hatRow) {
    const selectedHatSlot = hatRow.querySelector('.item-slot.selected');
    if (selectedHatSlot) {
      const hatIndex = Array.from(hatRow.querySelectorAll('.item-slot')).indexOf(selectedHatSlot);
      selectedHat = hatIndex + 1; 
    }
  }
  
  if (robeRow) {
    const selectedRobeSlot = robeRow.querySelector('.item-slot.selected');
    if (selectedRobeSlot) {
      const robeIndex = Array.from(robeRow.querySelectorAll('.item-slot')).indexOf(selectedRobeSlot);
      selectedRobe = robeIndex + 1;
    }
  }
  
  chrome.storage.local.set({
    selectedHat: selectedHat,
    selectedRobe: selectedRobe
  });
  
  // tell content script to update witch appearance
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
    const hatIndex = (result.selectedHat || 1) - 1;
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
    
    updateWitchPreview();
  });
}

// shop system
let pendingPurchase = null;

function loadUnlockedItems() {
  chrome.storage.local.get(['unlockedItems'], function(result) {
    let unlockedItems = result.unlockedItems || { hat: [1], robe: [1] };
    
    if (!unlockedItems.hat || !unlockedItems.hat.includes(1)) {
      if (!unlockedItems.hat) unlockedItems.hat = [];
      if (!unlockedItems.hat.includes(1)) unlockedItems.hat.push(1);
    }
    if (!unlockedItems.robe || !unlockedItems.robe.includes(1)) {
      if (!unlockedItems.robe) unlockedItems.robe = [];
      if (!unlockedItems.robe.includes(1)) unlockedItems.robe.push(1);
    }
    
    // save back to ensure consistency
    saveUnlockedItems(unlockedItems);
    
    document.querySelectorAll('.item-slot').forEach(slot => {
      const itemType = slot.getAttribute('data-item-type');
      const itemIndex = parseInt(slot.getAttribute('data-item-index'));
      const isUnlocked = unlockedItems[itemType] && unlockedItems[itemType].includes(itemIndex);
      
      if (isUnlocked) {
        slot.classList.remove('locked');
        slot.setAttribute('data-unlocked', 'true');
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
  
  // sub potions
  const newPotionCount = currentPotions - cost;
  setPotionCount(newPotionCount);
  
  // unlock item
  chrome.storage.local.get(['unlockedItems'], function(result) {
    const unlockedItems = result.unlockedItems || { hat: [1], robe: [1] };
    
    if (!unlockedItems[itemType]) {
      unlockedItems[itemType] = [];
    }
    if (!unlockedItems[itemType].includes(itemIndex)) {
      unlockedItems[itemType].push(itemIndex);
    }
    
    saveUnlockedItems(unlockedItems);
    
    // update ui
    slot.classList.remove('locked');
    slot.setAttribute('data-unlocked', 'true');
    const overlay = slot.querySelector('.lock-overlay');
    if (overlay) overlay.remove();
    
    hidePurchaseModal();
  });
}

// event listeners
document.getElementById('confirm-purchase-btn').addEventListener('click', confirmPurchase);
document.getElementById('cancel-purchase-btn').addEventListener('click', hidePurchaseModal);
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    hidePurchaseModal();
  }
});

// item slot click handlers
document.querySelectorAll('.item-slot').forEach(slot => {
  slot.addEventListener('click', function() {
    // Prevent clicking on "coming soon" items
    if (this.classList.contains('coming-soon')) {
      return;
    }
    
    const isUnlocked = this.getAttribute('data-unlocked') === 'true';
    
    if (!isUnlocked) {
      showPurchaseModal(this);
      return;
    }
    
    // handle selection for unlocked items
    const categoryRow = this.closest('.category-row');
    if (categoryRow) {
      categoryRow.querySelectorAll('.item-slot').forEach(item => {
        item.classList.remove('selected');
      });
      this.classList.add('selected');
      saveCustomization();
    }
  });
});

loadCustomization();
loadUnlockedItems();

// celebration system
function triggerCelebration() {
  const container = document.getElementById('celebration-container');
  if (!container) return;
  
  // success message
  createSuccessMessage(container);
  
  // magical floating particles
  const particleCount = 30;
  const colors = ['#CAAFE5', '#b89dd4', '#937640', '#ffffff'];
  
  for (let i = 0; i < particleCount; i++) {
    setTimeout(() => {
      createFloatingParticle(container, colors, i);
    }, i * 30);
  }
  
  for (let i = 0; i < 15; i++) {
    setTimeout(() => {
      createCenterSparkle(container, i);
    }, i * 60);
  }
}

function createSuccessMessage(container) {
  const message = document.createElement('div');
  message.className = 'celebration-message';
  message.textContent = 'Hex Successful!';
  
  const animName = `successMessage${Date.now()}`;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ${animName} {
      0% {
        transform: translate(-50%, -50%) scale(0.5);
        opacity: 0;
      }
      20% {
        transform: translate(-50%, -50%) scale(1.1);
        opacity: 1;
      }
      30% {
        transform: translate(-50%, -50%) scale(1);
      }
      80% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
      }
      100% {
        transform: translate(-50%, -50%) scale(0.9);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
  
  message.style.cssText = `
    position: fixed;
    top: 35%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-family: 'QuiteMagical';
    font-size: 48px;
    font-weight: bold;
    color: #CAAFE5;
    text-shadow: 0 0 25px #CAAFE5, 0 0 50px #CAAFE5, 0 0 75px #CAAFE5, 2px 2px 4px rgba(0, 0, 0, 0.5);
    z-index: 10001;
    pointer-events: none;
    white-space: nowrap;
    text-align: center;
    animation: ${animName} 3s ease-out forwards;
  `;
  
  container.appendChild(message);
  
  setTimeout(() => {
    if (message.parentNode) message.remove();
    if (style.parentNode) style.remove();
  }, 3000);
}

function createFloatingParticle(container, colors, index) {
  const particle = document.createElement('div');
  particle.className = 'celebration-particle';
  
  const size = Math.random() * 6 + 3;
  const color = colors[Math.floor(Math.random() * colors.length)];
  const startX = Math.random() * 400;
  const startY = 500;
  const endX = startX + (Math.random() - 0.5) * 150;
  const endY = -50;
  const duration = 3 + Math.random() * 1;
  const delay = (index / 30) * 0.5;
  const rotation = 360 + Math.random() * 360;
  
  const animName = `float${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
  
  // make keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ${animName} {
      0% {
        transform: translate(0, 0) rotate(0deg) scale(0.8);
        opacity: 0;
      }
      10% {
        opacity: 1;
      }
      90% {
        opacity: 1;
      }
      100% {
        transform: translate(${endX - startX}px, ${endY - startY}px) rotate(${rotation}deg) scale(1.2);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
  
  particle.style.cssText = `
    position: fixed;
    width: ${size}px;
    height: ${size}px;
    background: radial-gradient(circle, ${color} 0%, ${color}dd 100%);
    border-radius: 50%;
    left: ${startX}px;
    top: ${startY}px;
    pointer-events: none;
    z-index: 10000;
    box-shadow: 0 0 ${size * 1.5}px ${color}, 0 0 ${size * 3}px ${color}88;
    animation: ${animName} ${duration}s cubic-bezier(0.4, 0, 0.2, 1) ${delay}s forwards;
  `;
  
  container.appendChild(particle);
  
  // clean up after animation
  setTimeout(() => {
    if (particle.parentNode) particle.remove();
    if (style.parentNode) style.remove();
  }, (duration + delay) * 1000);
}

function createCenterSparkle(container, index) {
  const sparkle = document.createElement('div');
  sparkle.className = 'celebration-sparkle';
  
  const centerX = 200;
  const centerY = 250;
  const angle = (index / 15) * Math.PI * 2;
  const distance = 100 + Math.random() * 150;
  const endX = centerX + Math.cos(angle) * distance;
  const endY = centerY + Math.sin(angle) * distance;
  const duration = 2 + Math.random() * 0.5;
  const size = 6 + Math.random() * 4;
  
  const animName = `sparkle${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ${animName} {
      0% {
        transform: translate(0, 0) scale(0) rotate(0deg);
        opacity: 0;
      }
      20% {
        opacity: 1;
      }
      80% {
        opacity: 1;
      }
      100% {
        transform: translate(${endX - centerX}px, ${endY - centerY}px) scale(1.5) rotate(720deg);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
  
  sparkle.style.cssText = `
    position: fixed;
    width: ${size}px;
    height: ${size}px;
    left: ${centerX}px;
    top: ${centerY}px;
    pointer-events: none;
    z-index: 10000;
    background: linear-gradient(45deg, #CAAFE5, #ffffff);
    clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
    filter: drop-shadow(0 0 ${size / 2}px #CAAFE5) drop-shadow(0 0 ${size}px #CAAFE5);
    animation: ${animName} ${duration}s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  `;
  
  container.appendChild(sparkle);
  
  setTimeout(() => {
    if (sparkle.parentNode) sparkle.remove();
    if (style.parentNode) style.remove();
  }, duration * 1000);
}

// Update witch preview in popup
function updateWitchPreview() {
  chrome.storage.local.get(['selectedHat', 'selectedRobe', 'timerStartTime', 'timerPaused'], function(result) {
    const hat = result.selectedHat || 1;
    const robe = result.selectedRobe || 1;
    
    // Use Study state if timer is running and not paused
    const isFocusing = result.timerStartTime && !result.timerPaused;
    const state = isFocusing ? 'Study' : 'Idle';
    const headPath = `Assets/Witch/${state}/${state} Head ${hat}.png`;
    const bodyPath = `Assets/Witch/${state}/${state} Body ${robe}.png`;
    
    const headImg = document.getElementById('witch-preview-head');
    const bodyImg = document.getElementById('witch-preview-body');
    
    // Make preview bigger - scale up from 75px to ~200px (about 2.67x)
    const headWidth = 200;
    const bodyWidth = isFocusing ? 160 : 160; // Same size for both states
    
    if (headImg) {
      headImg.src = chrome.runtime.getURL(headPath);
      headImg.style.width = `${headWidth}px`;
      // Adjust head position based on state
      if (isFocusing) {
        headImg.style.top = '-27px'; // Study state: -8px scaled up (2.67x ≈ 21px, but using -27px for consistency)
      } else {
        headImg.style.top = '-27px'; // Idle state: -10px scaled up (2.67x)
      }
      
      // calc body position when head loads
      headImg.onload = function() {
        if (bodyImg) {
          bodyImg.style.width = `${bodyWidth}px`;
          bodyImg.style.left = `${(headWidth - bodyWidth) / 2}px`;
          bodyImg.style.top = '0px'; // Stack directly on top like free form mode
        }
      };
      
      if (headImg.complete) {
        headImg.onload();
      }
    }
    
    if (bodyImg) {
      bodyImg.src = chrome.runtime.getURL(bodyPath);
      bodyImg.style.width = `${bodyWidth}px`;
      bodyImg.style.left = `${(headWidth - bodyWidth) / 2}px`;
      bodyImg.style.top = '0px'; // Stack directly on top like free form mode
    }
  });
}

const originalSaveCustomization = saveCustomization;
saveCustomization = function() {
  originalSaveCustomization();
  updateWitchPreview();
};

updateWitchPreview();
  
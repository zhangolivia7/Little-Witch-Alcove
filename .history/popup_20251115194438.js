let timerInterval = null;
let seconds = 0;
let isPaused = false;
let lastAwardedMinute = -1;

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

function awardPotion() {
  const currentCount = getPotionCount();
  setPotionCount(currentCount + 1);
}

function startTimer() {
  if (timerInterval) return;
  lastAwardedMinute = 0; // Reset when starting a new session
  
  timerInterval = setInterval(() => {
    if (!isPaused) {
      seconds++;
      document.getElementById("timer-text").textContent = formatTime(seconds);
      
      // Award potion every minute (only when a full minute has passed)
      if (seconds % 60 === 0 && seconds > 0) {
        const currentMinute = Math.floor(seconds / 60);
        if (currentMinute > lastAwardedMinute) {
          lastAwardedMinute = currentMinute;
          awardPotion();
        }
      }
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  seconds = 0;
  isPaused = false;
  lastAwardedMinute = 0;
  document.getElementById("timer-text").textContent = "00:00";
}

document.getElementById("focus-btn").addEventListener("click", () => {
  document.getElementById("focus-btn").style.display = "none";
  document.getElementById("timer-controls").style.display = "flex";
  document.getElementById("aura-overlay").style.display = "flex";
  startTimer();
});

document.getElementById("pause-btn").addEventListener("click", () => {
  isPaused = !isPaused;
  const pauseBtn = document.getElementById("pause-btn");
  if (isPaused) {
    pauseBtn.innerHTML = '<img src="Assets/Icons/Play.svg" alt="Play">';
  } else {
    pauseBtn.innerHTML = '<img src="Assets/Icons/Pause.svg" alt="Pause">';
  }
});

document.getElementById("stop-btn").addEventListener("click", () => {
  stopTimer();
  document.getElementById("focus-btn").style.display = "block";
  document.getElementById("timer-controls").style.display = "none";
  const pauseBtn = document.getElementById("pause-btn");
  pauseBtn.innerHTML = '<img src="Assets/Icons/Pause.svg" alt="Pause">';
});

// Load saved potion count when popup opens
loadPotionCount();

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
document.querySelectorAll('.item-slot').forEach(slot => {
  slot.addEventListener('click', function() {
    // Find the parent category row
    const categoryRow = this.closest('.category-row');
    if (categoryRow) {
      // Remove selected class from all items in this row
      categoryRow.querySelectorAll('.item-slot').forEach(item => {
        item.classList.remove('selected');
      });
      // Add selected class to clicked item
      this.classList.add('selected');
    }
  });
});
  
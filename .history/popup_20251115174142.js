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
}

function awardPotion() {
  const currentCount = getPotionCount();
  setPotionCount(currentCount + 1);
}

function startTimer() {
  if (timerInterval) return;
  lastAwardedMinute = -1; // Reset when starting a new session
  
  timerInterval = setInterval(() => {
    if (!isPaused) {
      seconds++;
      document.getElementById("timer-text").textContent = formatTime(seconds);
      
      // Award potion every minute
      const currentMinute = Math.floor(seconds / 60);
      if (currentMinute > lastAwardedMinute) {
        lastAwardedMinute = currentMinute;
        awardPotion();
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
  document.getElementById("timer-text").textContent = "00:00";
}

document.getElementById("focus-btn").addEventListener("click", () => {
  document.getElementById("focus-btn").style.display = "none";
  document.getElementById("timer-controls").style.display = "flex";
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
  
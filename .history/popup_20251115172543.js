let timerInterval = null;
let seconds = 0;
let isPaused = false;

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function startTimer() {
  if (timerInterval) return;
  
  timerInterval = setInterval(() => {
    if (!isPaused) {
      seconds++;
      document.getElementById("timer-text").textContent = formatTime(seconds);
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
  
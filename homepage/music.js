const MUSIC_SRC = '/homepage/title.wav';
const TIME_KEY = 'ks_music_time';

const music = new Audio(MUSIC_SRC);
music.loop = true;
music.volume = 0.6;

// Resume where the last page left off
const savedTime = parseFloat(sessionStorage.getItem(TIME_KEY));
if (!isNaN(savedTime)) {
  music.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(music.duration) && music.duration > 0) {
      music.currentTime = savedTime % music.duration;
    }
  }, { once: true });
}

function startMusic() {
  music.play().catch(err => console.warn('Music blocked until user interaction:', err));
}

// Try immediately (works if the browser allows it), then fall back to first interaction
startMusic();
['click', 'keydown', 'touchstart'].forEach(evt =>
  // Capture before page scripts handle a click and navigate away.
  document.addEventListener(evt, startMusic, { once: true, capture: true })
);

// Save position so the next page continues the track
function saveTime() {
  sessionStorage.setItem(TIME_KEY, music.currentTime);
}
window.addEventListener('pagehide', saveTime);
setInterval(saveTime, 1000);

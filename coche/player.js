import { CANCIONES } from '../canciones.js';

const tracks = CANCIONES.filter((song) => song.audio).map((song) => ({
  ...song,
  url: new URL(`../${song.audio}`, import.meta.url).href,
}));

const audio = document.querySelector('#audio');
const playButton = document.querySelector('#play');
const playSymbol = document.querySelector('#play-symbol');
const playLabel = document.querySelector('#play-label');
const previousButton = document.querySelector('#previous');
const nextButton = document.querySelector('#next');
const progress = document.querySelector('#progress');
const currentTime = document.querySelector('#current-time');
const totalTime = document.querySelector('#total-time');
const trackCounter = document.querySelector('#track-counter');
const trackTitle = document.querySelector('#track-title');
const trackFrase = document.querySelector('#track-frase');
const status = document.querySelector('#player-status');
const trackList = document.querySelector('#track-list');

let currentIndex = 0;
let isScrubbing = false;

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function setStatus(message, state = 'ready') {
  status.textContent = message;
  status.dataset.state = state;
}

function normalizeIndex(index) {
  return (index + tracks.length) % tracks.length;
}

function renderTrackList() {
  const fragment = document.createDocumentFragment();

  tracks.forEach((track, index) => {
    const row = document.createElement('li');
    row.className = 'track-row';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'track-select';
    button.dataset.trackIndex = String(index);
    button.setAttribute('aria-label', `reproducir ${track.n}, ${track.t}`);

    const number = document.createElement('span');
    number.className = 'track-number';
    number.textContent = track.n;

    const name = document.createElement('span');
    name.className = 'track-name';
    name.textContent = track.t;

    const duration = document.createElement('span');
    duration.className = 'track-duration';
    duration.textContent = track.dur;

    button.append(number, name, duration);
    row.append(button);
    fragment.append(row);
  });

  trackList.replaceChildren(fragment);
}

function updateActiveTrack() {
  trackList.querySelectorAll('.track-select').forEach((button, index) => {
    if (index === currentIndex) {
      button.setAttribute('aria-current', 'true');
    } else {
      button.removeAttribute('aria-current');
    }
  });
}

function updateMediaMetadata(track) {
  if (!('mediaSession' in navigator) || !('MediaMetadata' in window)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.t,
    artist: 'el arca de noé',
    album: 'trece canciones · enero–octubre de 2002',
  });
}

function updatePositionState() {
  if (!('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== 'function') return;
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;

  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate,
      position: Math.min(Math.max(audio.currentTime, 0), audio.duration),
    });
  } catch {
    // Algunos navegadores muestran los controles multimedia pero no aceptan el estado de posición.
  }
}

function updateTrackDetails() {
  const track = tracks[currentIndex];
  trackCounter.textContent = `${track.n} / ${String(tracks.length).padStart(2, '0')}`;
  trackTitle.textContent = track.t;
  trackFrase.textContent = track.frase;
  totalTime.textContent = track.dur;
  currentTime.textContent = '0:00';
  progress.value = '0';
  progress.style.setProperty('--progress', '0%');
  progress.setAttribute('aria-valuetext', `0:00 de ${track.dur}`);
  document.title = `${track.t} — modo coche`;
  updateActiveTrack();
  updateMediaMetadata(track);
}

async function safePlay() {
  try {
    await audio.play();
  } catch {
    setStatus('toca reproducir para continuar', 'error');
  }
}

function loadTrack(index, { autoplay = false } = {}) {
  currentIndex = normalizeIndex(index);
  const track = tracks[currentIndex];
  const changed = audio.dataset.trackIndex !== String(currentIndex);

  if (changed) {
    audio.dataset.trackIndex = String(currentIndex);
    audio.src = track.url;
    audio.load();
  }

  updateTrackDetails();
  setStatus(autoplay ? 'cargando la cinta…' : 'lista para sonar', autoplay ? 'loading' : 'ready');

  if (autoplay) safePlay();
}

function selectNext() {
  loadTrack(currentIndex + 1, { autoplay: true });
}

function selectPrevious() {
  loadTrack(currentIndex - 1, { autoplay: true });
}

function togglePlayback() {
  if (audio.paused) {
    if (audio.ended) audio.currentTime = 0;
    safePlay();
  } else {
    audio.pause();
  }
}

function updatePlayButton() {
  const playing = !audio.paused && !audio.ended;
  playSymbol.textContent = playing ? '⏸' : '▶';
  playLabel.textContent = playing ? 'pausar' : 'reproducir';
  playButton.setAttribute('aria-label', playing ? 'pausar' : 'reproducir');
  playButton.classList.toggle('is-playing', playing);

  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    } catch {
      // El reproductor sigue funcionando aunque el sistema no exponga este estado.
    }
  }
}

function updateProgress() {
  if (isScrubbing) return;

  const duration = audio.duration;
  const position = audio.currentTime;
  const ratio = Number.isFinite(duration) && duration > 0 ? position / duration : 0;
  const sliderValue = Math.round(Math.min(Math.max(ratio, 0), 1) * 1000);

  progress.value = String(sliderValue);
  progress.style.setProperty('--progress', `${sliderValue / 10}%`);
  currentTime.textContent = formatTime(position);

  const readableDuration = Number.isFinite(duration) ? formatTime(duration) : tracks[currentIndex].dur;
  progress.setAttribute('aria-valuetext', `${formatTime(position)} de ${readableDuration}`);
  updatePositionState();
}

function seekFromSlider() {
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
  const ratio = Number(progress.value) / 1000;
  audio.currentTime = ratio * audio.duration;
  progress.style.setProperty('--progress', `${ratio * 100}%`);
  currentTime.textContent = formatTime(audio.currentTime);
  progress.setAttribute('aria-valuetext', `${formatTime(audio.currentTime)} de ${formatTime(audio.duration)}`);
}

function seekBy(seconds) {
  if (!Number.isFinite(audio.duration)) return;
  audio.currentTime = Math.min(Math.max(audio.currentTime + seconds, 0), audio.duration);
}

function installMediaSessionControls() {
  if (!('mediaSession' in navigator)) return;

  const actions = {
    play: () => safePlay(),
    pause: () => audio.pause(),
    previoustrack: selectPrevious,
    nexttrack: selectNext,
    seekbackward: (details) => seekBy(-(details.seekOffset || 10)),
    seekforward: (details) => seekBy(details.seekOffset || 10),
    seekto: (details) => {
      if (!Number.isFinite(details.seekTime)) return;
      if (details.fastSeek && typeof audio.fastSeek === 'function') {
        audio.fastSeek(details.seekTime);
      } else {
        audio.currentTime = details.seekTime;
      }
    },
    stop: () => {
      audio.pause();
      audio.currentTime = 0;
    },
  };

  Object.entries(actions).forEach(([action, handler]) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // No todos los sistemas del coche exponen todos los mandos.
    }
  });
}

playButton.addEventListener('click', togglePlayback);
previousButton.addEventListener('click', selectPrevious);
nextButton.addEventListener('click', selectNext);

trackList.addEventListener('click', (event) => {
  const button = event.target.closest('.track-select');
  if (!button) return;
  loadTrack(Number(button.dataset.trackIndex), { autoplay: true });
});

progress.addEventListener('pointerdown', () => {
  isScrubbing = true;
});

progress.addEventListener('input', seekFromSlider);

progress.addEventListener('change', () => {
  seekFromSlider();
  isScrubbing = false;
  updateProgress();
});

progress.addEventListener('pointerup', () => {
  isScrubbing = false;
  updateProgress();
});

progress.addEventListener('pointercancel', () => {
  isScrubbing = false;
  updateProgress();
});

audio.addEventListener('play', () => {
  updatePlayButton();
  setStatus('reproduciendo · después sonará la siguiente', 'playing');
});

audio.addEventListener('pause', () => {
  updatePlayButton();
  if (!audio.ended) setStatus('en pausa', 'paused');
});

audio.addEventListener('waiting', () => {
  setStatus('cargando la cinta…', 'loading');
});

audio.addEventListener('playing', () => {
  setStatus('reproduciendo · después sonará la siguiente', 'playing');
});

audio.addEventListener('loadedmetadata', () => {
  if (Number.isFinite(audio.duration)) totalTime.textContent = formatTime(audio.duration);
  updateProgress();
});

audio.addEventListener('durationchange', () => {
  if (Number.isFinite(audio.duration)) totalTime.textContent = formatTime(audio.duration);
});

audio.addEventListener('timeupdate', updateProgress);

audio.addEventListener('ended', selectNext);

audio.addEventListener('error', () => {
  updatePlayButton();
  setStatus('no se pudo cargar esta canción', 'error');
});

renderTrackList();
loadTrack(0);
updatePlayButton();
installMediaSessionControls();

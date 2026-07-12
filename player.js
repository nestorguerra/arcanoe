import { CANCIONES } from './canciones.js';

const tracks = CANCIONES.filter((song) => song.audio);
const audio = document.querySelector('[data-global-player]') || new Audio();
audio.preload = 'metadata';

let currentIndex = -1;
let listenAllActive = false;
let scrubbing = false;
let mediaMetadataIndex = -1;

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
};

const currentTrack = () => tracks[currentIndex] || null;

const isPlaying = () => !audio.paused && !audio.ended && currentIndex >= 0;

const updateMediaSession = () => {
  const track = currentTrack();
  if (!track || !('mediaSession' in navigator) || !('MediaMetadata' in window)) return;
  if (mediaMetadataIndex === currentIndex) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.t,
    artist: 'el arca de noé',
    album: 'madrid · 1999–2000',
  });
  mediaMetadataIndex = currentIndex;
};

const updateListenAllButton = () => {
  document.documentElement.classList.toggle('playlist-active', listenAllActive);

  const button = document.querySelector('.listen-all');
  if (!button) return;

  button.setAttribute('aria-pressed', listenAllActive ? 'true' : 'false');
  const count = button.querySelector('[data-playlist-count]');

  if (count) {
    const shownIndex = currentIndex >= 0 ? currentIndex + 1 : 1;
    count.textContent = `${String(shownIndex).padStart(2, '0')}/${tracks.length}`;
  }

  button.setAttribute(
    'aria-label',
    listenAllActive && currentTrack()
      ? `Detener escucha completa. Sonando ${currentTrack().t}`
      : 'Escuchar las trece canciones seguidas',
  );
};

const updateInlinePlayers = () => {
  const playing = isPlaying();
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  const progress = duration ? Math.min(100, (audio.currentTime / duration) * 100) : 0;

  document.querySelectorAll('[data-song-play]').forEach((button) => {
    const index = Number(button.getAttribute('data-track-index'));
    const active = index === currentIndex;
    const activeAndPlaying = active && playing;
    const icon = button.querySelector('[data-song-icon]');
    const action = button.querySelector('[data-song-action]');
    const fill = button.querySelector('[data-song-progress]');

    button.classList.toggle('is-active', active);
    button.classList.toggle('is-playing', activeAndPlaying);
    button.setAttribute('aria-pressed', activeAndPlaying ? 'true' : 'false');

    if (icon) icon.textContent = activeAndPlaying ? 'Ⅱ' : '▶';
    if (action) action.textContent = active ? (activeAndPlaying ? 'pausar' : 'continuar') : 'reproducir';
    if (fill) fill.style.width = active ? `${progress}%` : '0%';

    const track = tracks[index];
    if (track) button.setAttribute('aria-label', `${activeAndPlaying ? 'Pausar' : 'Reproducir'} ${track.t}`);
  });
};

const updateStickyPlayer = () => {
  const root = document.querySelector('[data-sticky-player]');
  if (!root) return;

  const track = currentTrack();
  const hasTrack = Boolean(track);
  const playing = isPlaying();
  const duration = hasTrack && Number.isFinite(audio.duration) ? audio.duration : 0;
  const currentTime = hasTrack && Number.isFinite(audio.currentTime) ? audio.currentTime : 0;

  root.dataset.active = hasTrack ? 'true' : 'false';
  root.classList.toggle('is-playing', playing);

  const title = root.querySelector('[data-player-title]');
  const meta = root.querySelector('[data-player-meta]');
  const current = root.querySelector('[data-player-current]');
  const total = root.querySelector('[data-player-duration]');
  const seek = root.querySelector('[data-player-seek]');
  const toggle = root.querySelector('[data-player-action="toggle"]');
  const previous = root.querySelector('[data-player-action="previous"]');
  const next = root.querySelector('[data-player-action="next"]');

  if (title) title.textContent = track ? track.t : 'elige una canción';
  if (meta) {
    meta.textContent = track
      ? `${String(currentIndex + 1).padStart(2, '0')} / ${tracks.length} · ${track.idioma}`
      : `archivo completo · ${tracks.length} canciones`;
  }
  if (current) current.textContent = formatTime(currentTime);
  if (total) total.textContent = duration ? formatTime(duration) : (track?.dur || '0:00');

  if (seek && !scrubbing) {
    seek.disabled = !hasTrack || !duration;
    seek.value = duration ? String(Math.min(1000, Math.round((currentTime / duration) * 1000))) : '0';
    seek.setAttribute('aria-valuetext', `${formatTime(currentTime)} de ${formatTime(duration)}`);
  }

  if (toggle) {
    toggle.textContent = playing ? 'Ⅱ' : '▶';
    toggle.setAttribute('aria-label', playing ? 'Pausar' : (hasTrack ? 'Reproducir' : 'Escuchar las trece canciones'));
  }
  if (previous) previous.disabled = !hasTrack;
  if (next) next.disabled = !hasTrack;

  updateMediaSession();
};

const updateAllPlayers = () => {
  updateListenAllButton();
  updateInlinePlayers();
  updateStickyPlayer();
};

const playAt = (index, { keepListenAll = false } = {}) => {
  if (index < 0 || index >= tracks.length) {
    listenAllActive = false;
    updateAllPlayers();
    return;
  }

  if (!keepListenAll) listenAllActive = false;
  currentIndex = index;
  audio.src = new URL(tracks[index].audio, document.baseURI).href;
  audio.load();
  updateAllPlayers();

  audio.play().catch(() => updateAllPlayers());
};

const togglePlayback = () => {
  if (currentIndex < 0) {
    listenAllActive = true;
    playAt(0, { keepListenAll: true });
    return;
  }

  if (audio.ended) audio.currentTime = 0;
  if (audio.paused) audio.play().catch(() => updateAllPlayers());
  else audio.pause();
};

const moveTrack = (direction) => {
  if (currentIndex < 0) {
    listenAllActive = true;
    playAt(0, { keepListenAll: true });
    return;
  }

  if (direction < 0 && audio.currentTime > 4) {
    audio.currentTime = 0;
    updateAllPlayers();
    return;
  }

  const target = (currentIndex + direction + tracks.length) % tracks.length;
  playAt(target, { keepListenAll: listenAllActive });
};

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;

  const listenAll = event.target.closest('.listen-all');
  if (listenAll) {
    if (listenAllActive) {
      listenAllActive = false;
      audio.pause();
      updateAllPlayers();
    } else {
      listenAllActive = true;
      playAt(0, { keepListenAll: true });
    }
    return;
  }

  const songButton = event.target.closest('[data-song-play]');
  if (songButton) {
    const index = Number(songButton.getAttribute('data-track-index'));
    listenAllActive = false;

    if (index === currentIndex) togglePlayback();
    else playAt(index);
    return;
  }

  const control = event.target.closest('[data-player-action]');
  if (!control) return;

  const action = control.getAttribute('data-player-action');
  if (action === 'toggle') togglePlayback();
  if (action === 'previous') moveTrack(-1);
  if (action === 'next') moveTrack(1);
});

document.addEventListener('pointerdown', (event) => {
  if (event.target instanceof HTMLInputElement && event.target.matches('[data-player-seek]')) scrubbing = true;
});

document.addEventListener('pointerup', () => {
  scrubbing = false;
  updateStickyPlayer();
});

document.addEventListener('pointercancel', () => {
  scrubbing = false;
  updateStickyPlayer();
});

document.addEventListener('input', (event) => {
  if (!(event.target instanceof HTMLInputElement) || !event.target.matches('[data-player-seek]')) return;
  if (!Number.isFinite(audio.duration) || !audio.duration) return;

  audio.currentTime = (Number(event.target.value) / 1000) * audio.duration;
  const current = document.querySelector('[data-player-current]');
  if (current) current.textContent = formatTime(audio.currentTime);
  event.target.setAttribute('aria-valuetext', `${formatTime(audio.currentTime)} de ${formatTime(audio.duration)}`);
});

for (const eventName of ['play', 'pause', 'timeupdate', 'loadedmetadata', 'durationchange']) {
  audio.addEventListener(eventName, updateAllPlayers);
}

audio.addEventListener('ended', () => {
  if (currentIndex + 1 < tracks.length) {
    playAt(currentIndex + 1, { keepListenAll: listenAllActive });
    return;
  }

  listenAllActive = false;
  updateAllPlayers();
});

if ('mediaSession' in navigator) {
  const handlers = {
    play: () => {
      if (currentIndex < 0) {
        listenAllActive = true;
        playAt(0, { keepListenAll: true });
      } else if (audio.paused) {
        audio.play().catch(() => updateAllPlayers());
      }
    },
    pause: () => audio.pause(),
    previoustrack: () => moveTrack(-1),
    nexttrack: () => moveTrack(1),
  };

  for (const [action, handler] of Object.entries(handlers)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      // Algunos navegadores no ofrecen todos los controles multimedia.
    }
  }
}

const componentObserver = new MutationObserver((mutations) => {
  const addedPlayerUi = mutations.some(({ addedNodes }) => Array.from(addedNodes).some((node) => (
    node instanceof Element
    && (
      node.matches('[data-song-play], [data-sticky-player], .listen-all')
      || node.querySelector('[data-song-play], [data-sticky-player], .listen-all')
    )
  )));

  if (addedPlayerUi) updateAllPlayers();
});
componentObserver.observe(document.body, { childList: true, subtree: true });

updateAllPlayers();

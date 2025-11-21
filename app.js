/* Core state */
const audio = document.getElementById('audio');
const trackListEl = document.getElementById('trackList');
const playlistListEl = document.getElementById('playlistList');
const nowTitle = document.getElementById('nowTitle');
const nowArtist = document.getElementById('nowArtist');
const coverImg = document.getElementById('cover');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const repeatBtn = document.getElementById('repeatBtn');
const volumeRange = document.getElementById('volume');
const muteBtn = document.getElementById('muteBtn');
const seek = document.getElementById('seek');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const filePicker = document.getElementById('filePicker');
const addSongsBtn = document.getElementById('addSongs');
const visualizer = document.getElementById('visualizer');
const ctx2d = visualizer ? visualizer.getContext('2d') : null;
// view toggle
const playerView = document.getElementById('playerView');
const libraryView = document.getElementById('libraryView');
const playerChip = document.getElementById('playerChip');
const libraryChip = document.getElementById('libraryChip');
const libraryGrid = document.getElementById('libraryGrid');
const librarySearch = document.getElementById('librarySearch');

/* Simple in-memory library */
let playlists = [
  { id: 'fav', name: 'My Favorites', tracks: [] },
];
let currentPlaylistId = 'fav';
let currentIndex = -1;
let isRepeat = false;
let isShuffle = false;

const defaultCover = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=256&auto=format&fit=crop';

/* Persistence */
const STORAGE_KEY = 'music_playlists_v1';
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists)); } catch (e) { console.warn('save failed', e); }
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) playlists = data;
    }
  } catch (e) { console.warn('load failed', e); }
}

/* IndexedDB for local file persistence */
const DB_NAME = 'music_idb_v1';
const STORE = 'tracks';
let idbPromise;
function openDB() {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return idbPromise;
}
async function idbPut(key, blob) {
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  } catch (e) { console.warn('idb put failed', e); }
}
async function idbGet(key) {
  try {
    const db = await openDB();
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const get = tx.objectStore(STORE).get(key);
      get.onsuccess = () => res(get.result || null);
      get.onerror = () => rej(get.error);
    });
  } catch (e) { console.warn('idb get failed', e); return null; }
}
async function rehydrateUrls() {
  const tasks = [];
  playlists.forEach(p => {
    p.tracks.forEach(t => {
      if (t && t.fp) {
        tasks.push((async () => {
          const blob = await idbGet(t.fp);
          if (blob) {
            try { t.url = URL.createObjectURL(blob); } catch (e) { /* ignore */ }
          }
        })());
      }
    });
  });
  await Promise.all(tasks);
}

/* UI builders */
function renderPlaylists() {
  if (!playlistListEl) return;
  playlistListEl.innerHTML = '';
  playlists.forEach(p => {
    const item = document.createElement('div');
    item.className = 'playlist-item' + (p.id === currentPlaylistId ? ' active' : '');
    item.innerHTML = `
      <div class="pi-left"><span>🎧</span> <strong>${p.name}</strong></div>
      <div class="row-actions">
        <button class="mini-btn" data-act="rename">Rename</button>
        <button class="mini-btn" data-act="delete">🗑</button>
      </div>`;
    item.addEventListener('click', (e) => {
      if (e.target.closest('.row-actions')) return; // actions handled below
      currentPlaylistId = p.id; currentIndex = -1; renderPlaylists(); renderTracks();
    });
    item.querySelector('[data-act="rename"]').addEventListener('click', () => {
      const name = prompt('Rename playlist:', p.name);
      if (name && name.trim()) { p.name = name.trim(); saveState(); renderPlaylists(); renderTracks(); }
    });
    item.querySelector('[data-act="delete"]').addEventListener('click', () => {
      if (playlists.length <= 1) { alert('At least one playlist is required.'); return; }
      if (confirm('Delete playlist and all its tracks?')) {
        const idx = playlists.findIndex(x => x.id === p.id);
        playlists.splice(idx, 1);
        if (currentPlaylistId === p.id) { currentPlaylistId = playlists[0].id; currentIndex = -1; }
        saveState(); renderPlaylists(); renderTracks();
      }
    });
    playlistListEl.appendChild(item);
  });
}

/* Library rendering */
function flattenTracks() {
  // returns array of {pId, index, title, artist, url, cover, duration}
  const res = [];
  playlists.forEach(p => {
    p.tracks.forEach((t, i) => res.push({ ...t, pId: p.id, index: i }));
  });
  return res;
}

let libraryFilter = '';
function renderLibrary() {
  const all = flattenTracks().filter(t =>
    (t.title || '').toLowerCase().includes(libraryFilter) ||
    (t.artist || '').toLowerCase().includes(libraryFilter)
  );
  if (!libraryGrid) return;
  libraryGrid.innerHTML = '';
  all.forEach(t => {
    const card = document.createElement('button');
    card.className = 'card';
    card.innerHTML = `
      <img class="thumb" src="${t.cover || defaultCover}" alt="cover"/>
      <div class="meta">
        <div class="title">${t.title || 'Untitled'}</div>
        <div class="artist">${t.artist || 'Unknown'}</div>
        <div class="len">${t.duration || ''}</div>
      </div>`;
    card.addEventListener('click', () => {
      // If an audio element exists on this page (e.g., library.html), play directly
      if (audio) {
        currentPlaylistId = t.pId;
        // Refresh track list if present to reflect active item state
        renderTracks();
        playAt(t.index);
        if (playerView) { switchView('player'); }
        return;
      }
      // Otherwise persist a play request and navigate to the player page
      try {
        localStorage.setItem('play_request', JSON.stringify({ pId: t.pId, index: t.index }));
      } catch (e) { /* ignore */ }
      window.location.href = 'index.html';
    });
    libraryGrid.appendChild(card);
  });
}

function switchView(view) {
  if (!playerView || !libraryView) return;
  const toPlayer = view === 'player';
  playerView.classList.toggle('hidden', !toPlayer);
  libraryView.classList.toggle('hidden', toPlayer);
  if (playerChip) playerChip.classList.toggle('active', toPlayer);
  if (libraryChip) libraryChip.classList.toggle('active', !toPlayer);
}

function formatTime(sec) {
  if (!isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function renderTracks() {
  if (!trackListEl) return;
  const plist = playlists.find(p => p.id === currentPlaylistId);
  const nameEl = document.getElementById('currentPlaylistName');
  if (nameEl) nameEl.textContent = plist.name;
  trackListEl.innerHTML = '';
  plist.tracks.forEach((t, i) => {
    const li = document.createElement('li');
    li.className = 'track' + (i === currentIndex ? ' active' : '');
    li.innerHTML = `
      <div class="meta">
        <img src="${t.cover || defaultCover}" alt="cover" />
        <div>
          <div class="title">${t.title || 'Untitled'}</div>
          <div class="artist">${t.artist || 'Unknown'}</div>
        </div>
      </div>
      <div></div>
      <div class="len">${t.duration || ''}</div>
      <div class="row-actions">
        <button class="mini-btn" data-act="rename">Rename</button>
        <button class="mini-btn" data-act="delete">🗑</button>
      </div>`;
    li.addEventListener('click', () => playAt(i));
    li.querySelector('[data-act="rename"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const title = prompt('Rename track title:', t.title || '');
      if (title !== null) { t.title = title.trim() || t.title; saveState(); renderTracks(); renderLibrary(); }
    });
    li.querySelector('[data-act="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Delete this track?')) {
        plist.tracks.splice(i, 1);
        if (i === currentIndex) { audio.pause(); currentIndex = -1; }
        saveState(); renderTracks(); renderLibrary();
      }
    });
    trackListEl.appendChild(li);
  });
}

/* Player logic */
function loadTrack(i) {
  const plist = playlists.find(p => p.id === currentPlaylistId);
  const t = plist.tracks[i];
  if (!t) return;
  currentIndex = i;
  audio.src = t.url;
  nowTitle.textContent = t.title || 'Untitled';
  nowArtist.textContent = t.artist || 'Unknown';
  coverImg.src = t.cover || defaultCover;
  document.querySelectorAll('.track').forEach((el, idx) => {
    el.classList.toggle('active', idx === i);
  });
}

async function playAt(i) {
  loadTrack(i);
  try { await audio.play(); } catch (err) { console.warn(err); }
}

function playPause() {
  if (audio.paused) { audio.play(); }
  else { audio.pause(); }
}

function next() {
  const plist = playlists.find(p => p.id === currentPlaylistId);
  if (!plist || plist.tracks.length === 0) return;
  if (isShuffle) {
    playAt(Math.floor(Math.random() * plist.tracks.length));
    return;
  }
  const lastIndex = plist.tracks.length - 1;
  let i = currentIndex + 1;
  if (i > lastIndex) {
    if (isRepeat) { i = 0; }
    else { return; }
  }
  playAt(i);
}

function prev() {
  const plist = playlists.find(p => p.id === currentPlaylistId);
  let i = currentIndex - 1; if (i < 0) i = plist.tracks.length - 1; playAt(i);
}

/* Ranges */
volumeRange.addEventListener('input', () => { audio.volume = parseFloat(volumeRange.value); });
seek.addEventListener('input', () => {
  if (isFinite(audio.duration)) audio.currentTime = (seek.value / 1000) * audio.duration;
});

muteBtn.addEventListener('click', () => { audio.muted = !audio.muted; muteBtn.textContent = audio.muted ? '🔇' : '🔊'; });
playPauseBtn.addEventListener('click', playPause);
nextBtn.addEventListener('click', next);
prevBtn.addEventListener('click', prev);
repeatBtn.addEventListener('click', () => { isRepeat = !isRepeat; repeatBtn.style.opacity = isRepeat ? 1 : 0.6; });

/* Time update */
audio.addEventListener('timeupdate', () => {
  currentTimeEl.textContent = formatTime(audio.currentTime);
  durationEl.textContent = formatTime(audio.duration || 0);
  if (isFinite(audio.duration)) seek.value = Math.floor((audio.currentTime / audio.duration) * 1000);
});

audio.addEventListener('ended', next);
audio.addEventListener('play', () => { if (playPauseBtn) playPauseBtn.textContent = '⏸'; });
audio.addEventListener('pause', () => { if (playPauseBtn) playPauseBtn.textContent = '▶'; });
audio.addEventListener('error', () => {
  const src = audio.currentSrc || '';
  const isBlob = src.startsWith('blob:');
  const msg = isBlob
    ? 'This local file is unavailable after a page reload. Please re-add the song.'
    : 'Unable to load this track. Please verify the file or source URL.';
  alert(msg);
});

/* Add songs (local files) */
// Enable adding songs on both Player and Library pages
if (addSongsBtn && filePicker) {
  addSongsBtn.addEventListener('click', () => {
    // Reset to ensure change event fires even if selecting same files again
    try { filePicker.value = ''; } catch (e) { /* ignore */ }
    filePicker.click();
  });
  filePicker.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) { return; }
    let plist = playlists.find(p => p.id === currentPlaylistId);
    if (!plist) {
      // Fallback: ensure there is at least one playlist
      playlists.push({ id: 'fav', name: 'My Favorites', tracks: [] });
      currentPlaylistId = 'fav';
      plist = playlists[0];
    }
    // Build set of existing fingerprints across all tracks
    const existing = new Set(flattenTracks().map(t => t.fp).filter(Boolean));
    const dupes = [];
    files.forEach(async f => {
      const url = URL.createObjectURL(f);
      const fp = `${f.name}|${f.size}|${f.lastModified}`;
      if (existing.has(fp)) { dupes.push(f.name); return; }
      existing.add(fp);
      plist.tracks.push({ title: f.name.replace(/\.[^/.]+$/, ''), artist: 'Local File', url, cover: defaultCover, fp });
      await idbPut(fp, f);
    });
    renderTracks();
    renderLibrary();
    saveState();
    // Clear selection so same files can be selected again
    try { e.target.value = ''; } catch (e2) { /* ignore */ }
    if (playerView && currentIndex === -1 && plist.tracks.length) playAt(0);
    if (dupes.length) { alert(`Skipped duplicates:\n${dupes.join('\n')}`); }
  });
}

/* Visualizer */
let audioCtx, srcNode, analyser, dataArray;
let pendingAutoPlay = false;
function setupAnalyser() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  srcNode = audioCtx.createMediaElementSource(audio);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  srcNode.connect(analyser);
  analyser.connect(audioCtx.destination);
}

function draw() {
  requestAnimationFrame(draw);
  if (!analyser) return;
  analyser.getByteFrequencyData(dataArray);
  const w = visualizer.width = visualizer.clientWidth; // keep crisp
  const h = visualizer.height;
  ctx2d.clearRect(0, 0, w, h);
  const bars = 80;
  const step = Math.floor(dataArray.length / bars);
  for (let i = 0; i < bars; i++) {
    const v = dataArray[i * step] / 255;
    const bh = v * h * 0.9 + 2;
    const x = (w / bars) * i + 2;
    const barW = (w / bars) - 4;
    const grad = ctx2d.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ec4899');
    grad.addColorStop(1, '#a855f7');
    ctx2d.fillStyle = grad;
    const y = h - bh;
    roundRect(ctx2d, x, y, barW, bh, 3);
    ctx2d.fill();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* Boot */
loadState();
// Rehydrate blobs, then render and handle any pending play request
rehydrateUrls().then(() => {
  renderPlaylists();
  renderTracks();
  // Handle cross-page play requests (from library.html) BEFORE loading any default track
  let handledPlayRequest = false;
  try {
    const pr = localStorage.getItem('play_request');
    if (pr) {
      const req = JSON.parse(pr);
      const plist = playlists.find(p => p.id === req.pId);
      if (plist && Number.isInteger(req.index) && req.index >= 0 && req.index < plist.tracks.length) {
        currentPlaylistId = req.pId;
        // Load immediately, attempt to play; if blocked, mark for auto play on first gesture
        loadTrack(req.index);
        audio.play().catch(() => { pendingAutoPlay = true; });
        handledPlayRequest = true;
      }
      localStorage.removeItem('play_request');
    }
  } catch (e) { /* ignore */ }
  // Fallback to first track if nothing requested
  if (!handledPlayRequest && playlists[0].tracks.length) { loadTrack(0); }
  // Initial library render (after rehydration)
  renderLibrary();
});

// Web Audio context must be created after user gesture
['click', 'keydown', 'touchstart'].forEach(evt => {
  window.addEventListener(evt, () => {
    if (!audioCtx) { setupAnalyser(); draw(); }
    if (pendingAutoPlay) {
      pendingAutoPlay = false;
      audio.play().catch(() => {/* still blocked or failed */ });
    }
  }, { once: true });
});

// View toggle events
if (playerChip) playerChip.addEventListener('click', () => switchView('player'));
if (libraryChip) libraryChip.addEventListener('click', () => { renderLibrary(); switchView('library'); });

// Search
if (librarySearch) librarySearch.addEventListener('input', (e) => { libraryFilter = (e.target.value || '').toLowerCase().trim(); renderLibrary(); });

// Initialize volume and mute icon state
if (volumeRange) { audio.volume = parseFloat(volumeRange.value || '1'); }
if (muteBtn) { muteBtn.textContent = audio.muted ? '🔇' : '🔊'; }


/* compact app.js — ~95 lines */
const $ = id => document.getElementById(id);
const audio = $('audio'), trackListEl = $('trackList'), playlistListEl = $('playlistList'),
  nowTitle = $('nowTitle'), nowArtist = $('nowArtist'), cover = $('cover'),
  playBtn = $('playPauseBtn'), prevBtn = $('prevBtn'), nextBtn = $('nextBtn'),
  repeatBtn = $('repeatBtn'), vol = $('volume'), muteBtn = $('muteBtn'),
  seek = $('seek'), curT = $('currentTime'), durT = $('duration'),
  filePicker = $('filePicker'), addSongsBtn = $('addSongs'), createPlaylistBtn = $('createPlaylist'),
  visualizer = $('visualizer'), ctx2d = visualizer?.getContext('2d'),
  playerView = $('playerView'), libraryView = $('libraryView'),
  playerChip = $('playerChip'), libraryChip = $('libraryChip'),
  libraryGrid = $('libraryGrid'), librarySearch = $('librarySearch');

const STORAGE_KEY = 'music_playlists_v2', DB_NAME = 'music_idb_v2', STORE = 'tracks', BACKUP_KEY = 'music_backup_v1';
let playlists = [{ id: 'fav', name: 'My Favorites', tracks: [] }], curPid = 'fav', idx = -1, isRepeat = false, audioCtx, srcNode, analyser, dataArr, pendingAuto = false;
const defaultCover = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=256&auto=format&fit=crop';

try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const d = JSON.parse(raw); if (Array.isArray(d)) playlists = d; } } catch (e) { console.warn(e) }

class StorageManager {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return this.db;
    
    try {
      this.db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE);
          }
          
          if (!db.objectStoreNames.contains('metadata')) {
            const metaStore = db.createObjectStore('metadata', { keyPath: 'key' });
            metaStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
        
        request.onsuccess = () => {
          this.isInitialized = true;
          resolve(request.result);
        };
        
        request.onerror = () => reject(request.error);
      });
      
      return this.db;
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      throw error;
    }
  }

  async put(key, data) {
    try {
      const db = await this.init();
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE], 'readwrite');
        const store = transaction.objectStore(STORE);
        const request = store.put(data, key);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to put data:', error);
      throw error;
    }
  }

  async get(key) {
    try {
      const db = await this.init();
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE], 'readonly');
        const store = transaction.objectStore(STORE);
        const request = store.get(key);
        
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to get data:', error);
      return null;
    }
  }

  async delete(key) {
    try {
      const db = await this.init();
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE], 'readwrite');
        const store = transaction.objectStore(STORE);
        const request = store.delete(key);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to delete data:', error);
      throw error;
    }
  }

  async clear() {
    try {
      const db = await this.init();
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE], 'readwrite');
        const store = transaction.objectStore(STORE);
        const request = store.clear();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to clear store:', error);
      throw error;
    }
  }

  async getStorageUsage() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          quota: estimate.quota,
          usage: estimate.usage,
          usageDetails: estimate.usageDetails,
          available: estimate.quota - estimate.usage,
          percentage: ((estimate.usage / estimate.quota) * 100).toFixed(2)
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get storage estimate:', error);
      return null;
    }
  }

  async cleanup() {
    try {
      const db = await this.init();
      const allKeys = await new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE], 'readonly');
        const store = transaction.objectStore(STORE);
        const request = store.getAllKeys();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      const playlistFingerprints = new Set();
      playlists.forEach(pl => {
        pl.tracks.forEach(track => {
          if (track.fp) playlistFingerprints.add(track.fp);
        });
      });
      
      const orphanedKeys = allKeys.filter(key => !playlistFingerprints.has(key));
      
      if (orphanedKeys.length > 0) {
        console.log(`Cleaning up ${orphanedKeys.length} orphaned files`);
        for (const key of orphanedKeys) {
          await this.delete(key);
        }
        return orphanedKeys.length;
      }
      
      return 0;
    } catch (error) {
      console.error('Cleanup failed:', error);
      return 0;
    }
  }
}

const storageManager = new StorageManager();

async function rehydrate() {
  const tasks = [];
  playlists.forEach(p => p.tracks.forEach(t => {
    if (t?.fp) tasks.push((async () => {
      try {
        const blob = await storageManager.get(t.fp);
        if (blob) {
          if (t.url) URL.revokeObjectURL(t.url);
          t.url = URL.createObjectURL(blob);
        } else {
          console.warn(`Missing blob for track: ${t.title}`);
        }
      } catch (error) {
        console.error(`Failed to rehydrate track ${t.title}:`, error);
      }
    })());
  }));
  await Promise.all(tasks);
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
    
    if (playlists.length > 0) {
      const backup = {
        timestamp: Date.now(),
        version: 'v2',
        playlists: playlists
      };
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
    }
  } catch (error) {
    console.error('Failed to save playlists:', error);
    if (error.name === 'QuotaExceededError') {
      alert('Storage quota exceeded. Please remove some tracks or clear browser data.');
    }
  }
}

function restoreFromBackup() {
  try {
    const backup = localStorage.getItem(BACKUP_KEY);
    if (backup) {
      const data = JSON.parse(backup);
      if (data.playlists && Array.isArray(data.playlists)) {
        playlists = data.playlists;
        console.log(`Restored backup from ${new Date(data.timestamp).toLocaleString()}`);
        return true;
      }
    }
  } catch (error) {
    console.error('Failed to restore backup:', error);
  }
  return false;
}

async function exportPlaylists() {
  try {
    const exportData = {
      version: 'v2',
      timestamp: Date.now(),
      playlists: playlists.map(pl => ({
        ...pl,
        tracks: pl.tracks.map(t => ({
          title: t.title,
          artist: t.artist,
          duration: t.duration,
          cover: t.cover,
          fp: t.fp
        }))
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `music-playlists-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Export failed:', error);
    return false;
  }
}

async function importPlaylists(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (!data.playlists || !Array.isArray(data.playlists)) {
      throw new Error('Invalid playlist file format');
    }
    
    const importedCount = data.playlists.length;
    playlists = [...playlists, ...data.playlists];
    
    save();
    renderPlaylists();
    renderTracks();
    renderLibrary();
    
    return importedCount;
  } catch (error) {
    console.error('Import failed:', error);
    throw error;
  }
}

function flatten() { return playlists.flatMap(p => p.tracks.map((t, i) => ({ ...t, pId: p.id, index: i }))); }

function renderPlaylists() {
  if (!playlistListEl) return;
  playlistListEl.innerHTML = '';
  playlists.forEach(p => {
    const div = document.createElement('div'); div.className = 'playlist-item' + (p.id === curPid ? ' active' : '');
    div.innerHTML = `<div class="pi-left">🎧 <strong>${p.name}</strong></div><div class="row-actions"><button data-act="rename" class="mini-btn">Rename</button><button data-act="delete" class="mini-btn">🗑</button></div>`;
    div.addEventListener('click', e => { if (e.target.closest('.row-actions')) return; curPid = p.id; idx = -1; renderPlaylists(); renderTracks(); });
    div.querySelector('[data-act="rename"]').addEventListener('click', e => { e.stopPropagation(); const n = prompt('Rename playlist:', p.name); if (n?.trim()) { p.name = n.trim(); save(); renderPlaylists(); renderTracks() } });
    div.querySelector('[data-act="delete"]').addEventListener('click', e => { e.stopPropagation(); if (playlists.length <= 1) { alert('At least one playlist required'); return } if (confirm('Delete playlist and tracks?')) { const i = playlists.findIndex(x => x.id === p.id); playlists.splice(i, 1); if (curPid === p.id) { curPid = playlists[0].id; idx = -1 } save(); renderPlaylists(); renderTracks(); } });
    playlistListEl.appendChild(div);
  });
}

function renderTracks() {
  if (!trackListEl) return;
  const pl = playlists.find(p => p.id === curPid) || playlists[0];
  $('currentPlaylistName') && ($('currentPlaylistName').textContent = pl.name);
  trackListEl.innerHTML = '';
  pl.tracks.forEach((t, i) => {
    const li = document.createElement('li'); li.className = 'track' + (i === idx ? ' active' : '');
    li.innerHTML = `<div class="meta"><img src="${t.cover || defaultCover}"><div><div class="title">${t.title || 'Untitled'}</div><div class="artist">${t.artist || 'Unknown'}</div></div></div><div class="len">${t.duration || ''}</div><div class="row-actions"><button data-act="rename" class="mini-btn">Rename</button><button data-act="delete" class="mini-btn">🗑</button></div>`;
    li.addEventListener('click', () => playAt(i));
    li.querySelector('[data-act="rename"]').addEventListener('click', e => { e.stopPropagation(); const name = prompt('Rename track:', t.title || ''); if (name !== null) { t.title = name.trim() || t.title; save(); renderTracks(); renderLibrary() } });
    li.querySelector('[data-act="delete"]').addEventListener('click', e => { e.stopPropagation(); if (confirm('Delete this track?')) { pl.tracks.splice(i, 1); if (i === idx) { audio.pause(); idx = -1 } save(); renderTracks(); renderLibrary(); } });
    trackListEl.appendChild(li);
  });
}

function renderLibrary(filter = '') {
  if (!libraryGrid) return;
  const all = flatten().filter(t => (t.title || '').toLowerCase().includes(filter) || (t.artist || '').toLowerCase().includes(filter));
  libraryGrid.innerHTML = '';
  all.forEach(t => {
    const b = document.createElement('button'); b.className = 'card';
    b.innerHTML = `<img class="thumb" src="${t.cover || defaultCover}"/><div class="meta"><div class="title">${t.title || 'Untitled'}</div><div class="artist">${t.artist || 'Unknown'}</div><div class="len">${t.duration || ''}</div></div>`;
    b.addEventListener('click', () => {
      if (audio) { curPid = t.pId; renderTracks(); playAt(t.index); playerView && switchView('player'); return; }
      try { localStorage.setItem('play_request', JSON.stringify({ pId: t.pId, index: t.index })); } catch (e) { }
      location.href = 'index.html';
    });
    libraryGrid.appendChild(b);
  });
}

function switchView(v) { if (!playerView || !libraryView) return; const toPlayer = v === 'player'; playerView.classList.toggle('hidden', !toPlayer); libraryView.classList.toggle('hidden', toPlayer); playerChip?.classList.toggle('active', toPlayer); libraryChip?.classList.toggle('active', !toPlayer); }

function formatTime(s) { if (!isFinite(s)) return '0:00'; const m = Math.floor(s / 60), sec = String(Math.floor(s % 60)).padStart(2, '0'); return `${m}:${sec}`; }

function loadTrack(i) { const pl = playlists.find(p => p.id === curPid); const t = pl?.tracks[i]; if (!t) return; idx = i; audio.src = t.url; nowTitle.textContent = t.title || 'Untitled'; nowArtist.textContent = t.artist || 'Unknown'; cover.src = t.cover || defaultCover; document.querySelectorAll('.track').forEach((el, ii) => el.classList.toggle('active', ii === i)); }

async function playAt(i) { loadTrack(i); try { await audio.play(); } catch (e) { pendingAuto = true; } }

function next() { const pl = playlists.find(p => p.id === curPid); if (!pl || !pl.tracks.length) return; let i = (idx + 1) % pl.tracks.length; if (i === 0 && !isRepeat && idx === pl.tracks.length - 1) return; playAt(i); }
function prev() { const pl = playlists.find(p => p.id === curPid); if (!pl) return; let i = idx - 1; if (i < 0) i = pl.tracks.length - 1; playAt(i); }


vol?.addEventListener('input', () => audio.volume = parseFloat(vol.value));
seek?.addEventListener('input', () => { if (isFinite(audio.duration)) audio.currentTime = (seek.value / 1000) * audio.duration; });
muteBtn?.addEventListener('click', () => { audio.muted = !audio.muted; muteBtn.textContent = audio.muted ? '🔇' : '🔊'; });
playBtn?.addEventListener('click', () => audio.paused ? audio.play() : audio.pause());
nextBtn?.addEventListener('click', next);
prevBtn?.addEventListener('click', prev);
repeatBtn?.addEventListener('click', () => { isRepeat = !isRepeat; repeatBtn.style.opacity = isRepeat ? 1 : 0.6; });

createPlaylistBtn?.addEventListener('click', () => {
  const name = prompt('Enter playlist name:');
  if (name?.trim()) {
    const newPlaylist = {
      id: 'pl_' + Date.now(),
      name: name.trim(),
      tracks: []
    };
    playlists.push(newPlaylist);
    curPid = newPlaylist.id;
    idx = -1;
    save();
    renderPlaylists();
    renderTracks();
  }
});

function addStorageControls() {
  if (!playlistListEl) return;
  
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'storage-controls';
  controlsDiv.innerHTML = `
    <div class="storage-info">
      <button id="exportBtn" class="mini-btn" title="Export playlists">📤 Export</button>
      <button id="importBtn" class="mini-btn" title="Import playlists">📥 Import</button>
      <button id="cleanupBtn" class="mini-btn" title="Clean up storage">🧹 Cleanup</button>
      <button id="storageInfoBtn" class="mini-btn" title="Storage info">💾 Info</button>
    </div>
    <input id="importFilePicker" type="file" accept=".json" hidden />
  `;
  
  playlistListEl.parentNode.insertBefore(controlsDiv, playlistListEl.nextSibling);
  
  const exportBtn = $('exportBtn');
  const importBtn = $('importBtn');
  const importFilePicker = $('importFilePicker');
  const cleanupBtn = $('cleanupBtn');
  const storageInfoBtn = $('storageInfoBtn');
  
  exportBtn?.addEventListener('click', async () => {
    const success = await exportPlaylists();
    if (success) {
      alert('Playlists exported successfully!');
    } else {
      alert('Export failed. Please try again.');
    }
  });
  
  importBtn?.addEventListener('click', () => importFilePicker?.click());
  
  importFilePicker?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const count = await importPlaylists(file);
      alert(`Successfully imported ${count} playlist(s)!`);
    } catch (error) {
      alert('Import failed: ' + error.message);
    }
    
    e.target.value = '';
  });
  
  cleanupBtn?.addEventListener('click', async () => {
    const cleaned = await storageManager.cleanup();
    if (cleaned > 0) {
      alert(`Cleaned up ${cleaned} orphaned files.`);
    } else {
      alert('No orphaned files found.');
    }
  });
  
  storageInfoBtn?.addEventListener('click', async () => {
    const usage = await storageManager.getStorageUsage();
    if (usage) {
      const message = `Storage Usage:\n` +
        `Used: ${(usage.usage / 1024 / 1024).toFixed(2)} MB\n` +
        `Available: ${(usage.available / 1024 / 1024).toFixed(2)} MB\n` +
        `Total: ${(usage.quota / 1024 / 1024).toFixed(2)} MB\n` +
        `Percentage: ${usage.percentage}%`;
      alert(message);
    } else {
      alert('Storage information not available in this browser.');
    }
  });
}

audio.addEventListener('timeupdate', () => { curT.textContent = formatTime(audio.currentTime); durT.textContent = formatTime(audio.duration || 0); if (isFinite(audio.duration)) seek.value = Math.floor((audio.currentTime / audio.duration) * 1000); });
audio.addEventListener('ended', next);
audio.addEventListener('play', () => playBtn.textContent = '⏸');
audio.addEventListener('pause', () => playBtn.textContent = '▶');
audio.addEventListener('error', () => { const src = audio.currentSrc || ''; alert(src.startsWith('blob:') ? 'Local file unavailable after reload — re-add it.' : 'Unable to load track.'); });

if (addSongsBtn && filePicker) {
  addSongsBtn.addEventListener('click', () => filePicker.click());
  filePicker.addEventListener('change', async e => {
    const files = Array.from(e.target.files || []); 
    const pl = playlists.find(p => p.id === curPid); 
    console.log('Adding songs to playlist:', pl?.name, 'ID:', curPid); // Debug log
    if (!pl) {
      console.error('Playlist not found for current ID:', curPid);
      return;
    }
    // Check for duplicates only within current playlist, not all playlists
    const existing = new Set(pl.tracks.map(t => t.fp).filter(Boolean)); 
    const dupes = [];
    for (const f of files) { 
      const fp = `${f.name}|${f.size}|${f.lastModified}`; 
      if (existing.has(fp)) { 
        dupes.push(f.name); 
        continue 
      } 
      existing.add(fp); 
      const url = URL.createObjectURL(f); 
      pl.tracks.push({ title: f.name.replace(/\.[^/.]+$/, ''), artist: 'Local File', url, cover: defaultCover, fp }); 
      await storageManager.put(fp, f); 
    }
    console.log('Added', files.length - dupes.length, 'songs to', pl.name); // Debug log
    renderTracks(); renderLibrary(); save(); 
    if (idx === -1 && pl.tracks.length) playAt(0); 
    if (dupes.length) alert('Skipped duplicates:\\n' + dupes.join('\\n'));
  });
}

function setupAnalyser() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  srcNode = audioCtx.createMediaElementSource(audio);
  analyser = audioCtx.createAnalyser(); analyser.fftSize = 256; dataArr = new Uint8Array(analyser.frequencyBinCount);
  srcNode.connect(analyser); analyser.connect(audioCtx.destination);
  (function draw() {
    requestAnimationFrame(draw); if (!analyser || !ctx2d) return; analyser.getByteFrequencyData(dataArr); const w = visualizer.width = visualizer.clientWidth, h = visualizer.height; ctx2d.clearRect(0, 0, w, h); const bars = 80, step = Math.floor(dataArr.length / bars);
    for (let i = 0; i < bars; i++) { const v = dataArr[i * step] / 255, bh = v * h * 0.9 + 2, x = (w / bars) * i + 2, barW = (w / bars) - 4; const grad = ctx2d.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, '#ec4899'); grad.addColorStop(1, '#a855f7'); ctx2d.fillStyle = grad; ctx2d.beginPath(); const y = h - bh, r = 3; ctx2d.moveTo(x + r, y); ctx2d.arcTo(x + barW, y, x + barW, y + bh, r); ctx2d.arcTo(x + barW, y + bh, x, y + bh, r); ctx2d.arcTo(x, y + bh, x, y, r); ctx2d.arcTo(x, y, x + barW, y, r); ctx2d.closePath(); ctx2d.fill(); }
  })();
}

rehydrate().then(() => {
  renderPlaylists(); 
  addStorageControls();
  renderTracks(); 
  renderLibrary();
  
  try {
    const pr = localStorage.getItem('play_request'); 
    if (pr) { 
      const req = JSON.parse(pr); 
      const pl = playlists.find(p => p.id === req.pId); 
      if (pl && Number.isInteger(req.index) && req.index >= 0 && req.index < pl.tracks.length) { 
        curPid = req.pId; 
        loadTrack(req.index); 
        audio.play().catch(() => pendingAuto = true); 
      } 
      localStorage.removeItem('play_request'); 
    }
  } catch (e) { }
  
  if (!playlists.find(p => p.id === curPid)?.tracks.length && playlists[0].tracks.length) loadTrack(0);
  
  storageManager.cleanup();
});

['click', 'keydown', 'touchstart'].forEach(evt => window.addEventListener(evt, () => { if (!audioCtx) setupAnalyser(); if (pendingAuto) { pendingAuto = false; audio.play().catch(() => { }); } }, { once: true }));

playerChip?.addEventListener('click', () => switchView('player'));
libraryChip?.addEventListener('click', () => { renderLibrary(); switchView('library'); });
librarySearch?.addEventListener('input', e => renderLibrary((e.target.value || '').toLowerCase().trim()));
if (vol) audio.volume = parseFloat(vol.value || '1');
if (muteBtn) muteBtn.textContent = audio.muted ? '🔇' : '🔊';

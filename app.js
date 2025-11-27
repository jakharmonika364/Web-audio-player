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

const STORAGE_KEY = 'music_playlists_v1', DB_NAME = 'music_idb_v1', STORE = 'tracks';
let playlists = [{ id: 'fav', name: 'My Favorites', tracks: [] }], curPid = 'fav', idx = -1, isRepeat = false, audioCtx, srcNode, analyser, dataArr, pendingAuto = false;
const defaultCover = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=256&auto=format&fit=crop';

try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const d = JSON.parse(raw); if (Array.isArray(d)) playlists = d; } } catch (e) { console.warn(e) }

const idbOpen = (() => { let p; return () => p || (p = new Promise((res, rej) => { const r = indexedDB.open(DB_NAME, 1); r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE) }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); })();

async function idbPut(k, blob) { try { const db = await idbOpen(); await new Promise((r, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(blob, k); tx.oncomplete = r; tx.onerror = () => rej(tx.error) }); } catch (e) { console.warn(e) } }
async function idbGet(k) { try { const db = await idbOpen(); return await new Promise((r, rej) => { const tx = db.transaction(STORE, 'readonly'); const g = tx.objectStore(STORE).get(k); g.onsuccess = () => r(g.result || null); g.onerror = () => rej(g.error) }); } catch (e) { console.warn(e); return null } }

async function rehydrate() { const tasks = []; playlists.forEach(p => p.tracks.forEach(t => { if (t?.fp) tasks.push((async () => { const b = await idbGet(t.fp); if (b) t.url = URL.createObjectURL(b); })()); })); await Promise.all(tasks); }

function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists)); } catch (e) { console.warn(e) } }

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

audio.addEventListener('timeupdate', () => { curT.textContent = formatTime(audio.currentTime); durT.textContent = formatTime(audio.duration || 0); if (isFinite(audio.duration)) seek.value = Math.floor((audio.currentTime / audio.duration) * 1000); });
audio.addEventListener('ended', next);
audio.addEventListener('play', () => playBtn.textContent = '⏸');
audio.addEventListener('pause', () => playBtn.textContent = '▶');
audio.addEventListener('error', () => { const src = audio.currentSrc || ''; alert(src.startsWith('blob:') ? 'Local file unavailable after reload — re-add it.' : 'Unable to load track.'); });

if (addSongsBtn && filePicker) {
  addSongsBtn.addEventListener('click', () => filePicker.click());
  filePicker.addEventListener('change', async e => {
    const files = Array.from(e.target.files || []); const pl = playlists.find(p => p.id === curPid); const existing = new Set(flatten().map(t => t.fp).filter(Boolean)); const dupes = [];
    for (const f of files) { const fp = `${f.name}|${f.size}|${f.lastModified}`; if (existing.has(fp)) { dupes.push(f.name); continue } existing.add(fp); const url = URL.createObjectURL(f); pl.tracks.push({ title: f.name.replace(/\.[^/.]+$/, ''), artist: 'Local File', url, cover: defaultCover, fp }); await idbPut(fp, f); }
    renderTracks(); renderLibrary(); save(); if (idx === -1 && pl.tracks.length) playAt(0); if (dupes.length) alert('Skipped duplicates:\\n' + dupes.join('\\n'));
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
  renderPlaylists(); renderTracks(); renderLibrary();
  try {
    const pr = localStorage.getItem('play_request'); if (pr) { const req = JSON.parse(pr); const pl = playlists.find(p => p.id === req.pId); if (pl && Number.isInteger(req.index) && req.index >= 0 && req.index < pl.tracks.length) { curPid = req.pId; loadTrack(req.index); audio.play().catch(() => pendingAuto = true); } localStorage.removeItem('play_request'); }
  } catch (e) { }
  if (!playlists.find(p => p.id === curPid)?.tracks.length && playlists[0].tracks.length) loadTrack(0);
});

['click', 'keydown', 'touchstart'].forEach(evt => window.addEventListener(evt, () => { if (!audioCtx) setupAnalyser(); if (pendingAuto) { pendingAuto = false; audio.play().catch(() => { }); } }, { once: true }));

playerChip?.addEventListener('click', () => switchView('player'));
libraryChip?.addEventListener('click', () => { renderLibrary(); switchView('library'); });
librarySearch?.addEventListener('input', e => renderLibrary((e.target.value || '').toLowerCase().trim()));
if (vol) audio.volume = parseFloat(vol.value || '1');
if (muteBtn) muteBtn.textContent = audio.muted ? '🔇' : '🔊';

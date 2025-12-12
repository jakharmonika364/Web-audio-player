export default class UIController {
    constructor(eventBus, i18nManager) {
        this.eventBus = eventBus;
        this.i18n = i18nManager;
        this.elements = {
            playPauseBtn: document.getElementById('playPauseBtn'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn'),
            muteBtn: document.getElementById('muteBtn'),
            repeatBtn: document.getElementById('repeatBtn'),
            volumeSlider: document.getElementById('volume'),
            speedSelect: document.getElementById('speedSelect'),
            seekSlider: document.getElementById('seek'),
            currentTime: document.getElementById('currentTime'),
            duration: document.getElementById('duration'),
            trackList: document.getElementById('trackList'),
            libraryGrid: document.getElementById('libraryGrid'),
            filePicker: document.getElementById('filePicker'),
            addSongsBtn: document.getElementById('addSongs'),
            nowTitle: document.getElementById('nowTitle'),
            nowArtist: document.getElementById('nowArtist'),
            cover: document.getElementById('cover'),
            snackbar: document.getElementById('snackbar'),
            snackbarMsg: document.getElementById('snackbarMsg'),
            createPlaylistBtn: document.getElementById('createPlaylist'),
            playlistList: document.getElementById('playlistList'),
            currentPlaylistName: document.getElementById('currentPlaylistName'),
            importPlaylistBtn: document.getElementById('importPlaylistBtn'),
            exportPlaylistBtn: document.getElementById('exportPlaylistBtn'),
            playlistImportPicker: document.getElementById('playlistImportPicker'),
            playerView: document.getElementById('playerView'),
            libraryView: document.getElementById('libraryView'),
            navPlayer: document.getElementById('navPlayer'),
            navLibrary: document.getElementById('navLibrary'),
            snackbarUndo: document.getElementById('snackbarUndo'),
            libPrevBtn: document.getElementById('libPrevBtn'),
            libNextBtn: document.getElementById('libNextBtn'),
            libPageInfo: document.getElementById('libPageInfo'),
            languageSelect: document.getElementById('languageSelect')
        };

        this.initEventListeners();
        this.bindLibraryEvents();
        this.bindPlaylistEvents();

        if (this.elements.languageSelect) {
            this.elements.languageSelect.addEventListener('change', (e) => {
                this.i18n.setLocale(e.target.value);
            });
        }
    }

    bindPlaylistEvents() {
        if (this.elements.createPlaylistBtn) {
            this.elements.createPlaylistBtn.addEventListener('click', () => {
                const name = prompt(this.i18n.t('enterPlaylistName'));
                if (name && name.trim()) {
                    this.eventBus.emit('CREATE_PLAYLIST', name.trim());
                }
            });
        }

        if (this.elements.exportPlaylistBtn) {
            this.elements.exportPlaylistBtn.addEventListener('click', () => {
                this.eventBus.emit('EXPORT_PLAYLIST');
            });
        }

        if (this.elements.importPlaylistBtn && this.elements.playlistImportPicker) {
            this.elements.importPlaylistBtn.addEventListener('click', () => {
                this.elements.playlistImportPicker.click();
            });

            this.elements.playlistImportPicker.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.eventBus.emit('IMPORT_PLAYLIST', e.target.files[0]);
                    e.target.value = ''; // Reset
                }
            });
        }

        if (this.elements.snackbarUndo) {
            this.elements.snackbarUndo.addEventListener('click', () => {
                this.eventBus.emit('UNDO');
                this.elements.snackbar.style.display = 'none';
            });
        }
    }

    renderPlaylistSidebar(playlists, activeId) {
        if (!this.elements.playlistList) return;
        this.elements.playlistList.innerHTML = '';

        playlists.forEach(playlist => {
            const div = document.createElement('div');
            div.className = `playlist-item ${playlist.id === activeId ? 'active' : ''}`;
            div.innerHTML = `
                <span>${playlist.name}</span>
                <div class="row-actions">
                    <button class="mini-btn rename-pl-btn" title="Rename">✎</button>
                    <button class="mini-btn delete-pl-btn" title="Delete">✕</button>
                </div>
            `;

            div.setAttribute('role', 'button');
            div.setAttribute('tabindex', '0');
            div.setAttribute('aria-label', `Playlist ${playlist.name}`);

            div.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-pl-btn') && !e.target.classList.contains('rename-pl-btn')) {
                    this.eventBus.emit('SELECT_PLAYLIST', playlist.id);
                }
            });

            div.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target === div) {
                    e.preventDefault();
                    this.eventBus.emit('SELECT_PLAYLIST', playlist.id);
                }
            });

            div.querySelector('.rename-pl-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const newName = prompt(this.i18n.t('enterPlaylistName'), playlist.name);
                if (newName && newName.trim()) {
                    this.eventBus.emit('RENAME_PLAYLIST', { id: playlist.id, name: newName.trim() });
                }
            });

            div.querySelector('.delete-pl-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(this.i18n.t('deletePlaylistConfirm', { name: playlist.name }))) {
                    this.eventBus.emit('DELETE_PLAYLIST', playlist.id);
                }
            });

            this.elements.playlistList.appendChild(div);
        });

        const activePlaylist = playlists.find(p => p.id === activeId);
        if (activePlaylist && this.elements.currentPlaylistName) {
            this.elements.currentPlaylistName.textContent = activePlaylist.name;
        }
    }

    initEventListeners() {
        // Playback Controls
        if (this.elements.playPauseBtn) {
            this.elements.playPauseBtn.addEventListener('click', () => this.eventBus.emit('TOGGLE_PLAY'));
        }
        if (this.elements.prevBtn) {
            this.elements.prevBtn.addEventListener('click', () => this.eventBus.emit('PREV_TRACK'));
        }
        if (this.elements.nextBtn) {
            this.elements.nextBtn.addEventListener('click', () => this.eventBus.emit('NEXT_TRACK'));
        }
        if (this.elements.muteBtn) {
            this.elements.muteBtn.addEventListener('click', () => this.eventBus.emit('TOGGLE_MUTE'));
        }
        if (this.elements.repeatBtn) {
            this.elements.repeatBtn.addEventListener('click', () => this.eventBus.emit('TOGGLE_REPEAT'));
        }

        // Sliders
        if (this.elements.volumeSlider) {
            this.updateVolumeFill();
            this.elements.volumeSlider.addEventListener('input', (e) => {
                this.updateVolumeFill();
                this.eventBus.emit('VOLUME_CHANGED', parseFloat(e.target.value));
            });
        }
        if (this.elements.speedSelect) {
            this.elements.speedSelect.addEventListener('change', (e) => {
                this.eventBus.emit('SPEED_CHANGED', parseFloat(e.target.value));
            });
        }
        if (this.elements.seekSlider) {
            this.elements.seekSlider.addEventListener('input', (e) => {
                this.eventBus.emit('SEEK_CHANGED', parseFloat(e.target.value));
            });
        }

        // File Import (Player View)
        if (this.elements.addSongsBtn && this.elements.filePicker) {
            this.elements.addSongsBtn.addEventListener('click', () => {
                if (document.getElementById('playerView')) {
                    this.showAddOptions();
                }
            });

            this.elements.filePicker.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.eventBus.emit('FILES_SELECTED', e.target.files);
                }
            });
        }

        // Global Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            // Ignore if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.eventBus.emit('TOGGLE_PLAY');
                    break;
                case 'ArrowLeft':
                    this.eventBus.emit('SEEK_CHANGED', Math.max(0, parseFloat(this.elements.seekSlider.value) - 5));
                    break;
                case 'ArrowRight':
                    this.eventBus.emit('SEEK_CHANGED', Math.min(parseFloat(this.elements.seekSlider.max), parseFloat(this.elements.seekSlider.value) + 5));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (this.elements.volumeSlider) {
                        const newVolUp = Math.min(1, parseFloat(this.elements.volumeSlider.value) + 0.05);
                        this.elements.volumeSlider.value = newVolUp;
                        this.updateVolumeFill();
                        this.eventBus.emit('VOLUME_CHANGED', newVolUp);
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (this.elements.volumeSlider) {
                        const newVolDown = Math.max(0, parseFloat(this.elements.volumeSlider.value) - 0.05);
                        this.elements.volumeSlider.value = newVolDown;
                        this.updateVolumeFill();
                        this.eventBus.emit('VOLUME_CHANGED', newVolDown);
                    }
                    break;
                case 'KeyM':
                    this.eventBus.emit('TOGGLE_MUTE');
                    break;
                case 'KeyN':
                    this.eventBus.emit('NEXT_TRACK');
                    break;
                case 'KeyP':
                    this.eventBus.emit('PREV_TRACK');
                    break;
                case 'KeyL':
                    this.eventBus.emit('TOGGLE_REPEAT');
                    break;
            }
        });
    }

    showAddOptions() {
        const menu = document.createElement('div');
        menu.className = 'ctx-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-modal', 'true');
        menu.style.display = 'block';
        menu.style.position = 'absolute';
        const rect = this.elements.addSongsBtn.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 5}px`;
        menu.style.left = `${rect.left}px`;

        menu.innerHTML = `
      <div class="ctx-item" id="addFromDevice" role="menuitem" tabindex="0">📂 From Device</div>
      <div class="ctx-item" id="addFromLibrary" role="menuitem" tabindex="0">🎵 From Library</div>
    `;

        document.body.appendChild(menu);

        // Focus first item
        const firstItem = menu.querySelector('.ctx-item');
        if (firstItem) firstItem.focus();

        const closeMenu = (e) => {
            if (!menu.contains(e.target) && e.target !== this.elements.addSongsBtn) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
                document.removeEventListener('keydown', handleKey);
                this.elements.addSongsBtn.focus(); // Return focus
            }
        };

        const handleKey = (e) => {
            if (e.key === 'Escape') {
                menu.remove();
                document.removeEventListener('click', closeMenu);
                document.removeEventListener('keydown', handleKey);
                this.elements.addSongsBtn.focus();
            }
        };

        setTimeout(() => document.addEventListener('click', closeMenu), 0);
        document.addEventListener('keydown', handleKey);

        const deviceBtn = menu.querySelector('#addFromDevice');
        const libBtn = menu.querySelector('#addFromLibrary');

        const trigger = (btn, action) => {
            btn.addEventListener('click', action);
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    action();
                }
            });
        };

        trigger(deviceBtn, () => {
            this.elements.filePicker.click();
            menu.remove();
        });

        trigger(libBtn, () => {
            this.eventBus.emit('SHOW_LIBRARY_PICKER');
            menu.remove();
        });
    }

    bindLibraryEvents() {
        const clearBtn = document.getElementById('clearLibraryBtn');
        const searchInput = document.getElementById('librarySearch');
        const sortSelect = document.getElementById('librarySort');

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm(this.i18n.t('deleteLibraryConfirm'))) {
                    this.eventBus.emit('CLEAR_LIBRARY');
                }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.eventBus.emit('SEARCH_LIBRARY', e.target.value);
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.eventBus.emit('SORT_LIBRARY', e.target.value);
            });
        }

        if (this.elements.libPrevBtn) {
            this.elements.libPrevBtn.addEventListener('click', () => {
                this.eventBus.emit('PREV_LIBRARY_PAGE');
            });
        }

        if (this.elements.libNextBtn) {
            this.elements.libNextBtn.addEventListener('click', () => {
                this.eventBus.emit('NEXT_LIBRARY_PAGE');
            });
        }
    }

    renderPlaylist(playlist, currentTrack) {
        if (!this.elements.trackList) return;

        this.elements.trackList.innerHTML = '';
        playlist.forEach((track, index) => {
            const li = document.createElement('li');
            li.className = `track ${currentTrack && currentTrack.id === track.id ? 'active' : ''}`;
            li.innerHTML = `
        <div class="meta">
          <div class="title">${track.title}</div>
          <div class="artist">${track.artist}</div>
        </div>
        <button class="icon-btn rename-btn" data-index="${index}" title="Rename" aria-label="Rename track">✎</button>
        <button class="icon-btn remove-btn" data-index="${index}" title="Remove" aria-label="Remove track">✕</button>
      `;

            li.setAttribute('role', 'listitem');
            li.setAttribute('tabindex', '0');
            li.setAttribute('aria-label', `${track.title} by ${track.artist}`);

            li.draggable = true;
            li.dataset.index = index;

            li.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index);
                li.classList.add('dragging');
            });

            li.addEventListener('dragend', () => {
                li.classList.remove('dragging');
                this.elements.trackList.querySelectorAll('.track').forEach(el => el.classList.remove('drag-over'));
            });

            li.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                li.classList.add('drag-over');
            });

            li.addEventListener('dragleave', () => {
                li.classList.remove('drag-over');
            });

            li.addEventListener('drop', (e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = index;

                if (fromIndex !== toIndex) {
                    this.eventBus.emit('REORDER_PLAYLIST', { fromIndex, toIndex });
                }
            });

            li.addEventListener('click', (e) => {
                if (!e.target.classList.contains('remove-btn') && !e.target.classList.contains('rename-btn')) {
                    this.eventBus.emit('PLAY_TRACK', index);
                }
            });

            li.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target === li) {
                    e.preventDefault();
                    this.eventBus.emit('PLAY_TRACK', index);
                }
            });

            li.querySelector('.remove-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.eventBus.emit('REMOVE_TRACK', index);
            });

            li.querySelector('.rename-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const newTitle = prompt(this.i18n.t('enterNewTitle'), track.title);
                if (newTitle && newTitle.trim() !== '') {
                    this.eventBus.emit('RENAME_TRACK', { index, title: newTitle.trim() });
                }
            });

            this.elements.trackList.appendChild(li);
        });
    }

    renderLibrary(data) {
        if (!this.elements.libraryGrid) return;

        let tracks = [];
        let pagination = null;

        if (Array.isArray(data)) {
            tracks = data;
        } else {
            tracks = data.tracks;
            pagination = data.pagination;
        }

        this.elements.libraryGrid.innerHTML = '';
        tracks.forEach(track => {
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
        <img class="thumb" src="assets/default-cover.png" alt="${track.title}" loading="lazy">
        <div class="meta">
          <div class="title">${track.title}</div>
          <div class="artist">${track.artist}</div>
        </div>
      `;
            div.setAttribute('role', 'button');
            div.setAttribute('tabindex', '0');
            div.setAttribute('aria-label', `Play ${track.title} by ${track.artist}`);

            div.addEventListener('click', () => {
                this.eventBus.emit('PLAY_LIBRARY_TRACK', track);
            });

            div.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.eventBus.emit('PLAY_LIBRARY_TRACK', track);
                }
            });

            this.elements.libraryGrid.appendChild(div);
        });

        if (pagination) {
            this.updatePaginationControls(pagination);
        }
    }

    updatePaginationControls(pagination) {
        if (this.elements.libPageInfo) {
            this.elements.libPageInfo.textContent = `${this.i18n.t('page')} ${pagination.currentPage} ${this.i18n.t('of')} ${pagination.totalPages}`;
        }
        if (this.elements.libPrevBtn) {
            this.elements.libPrevBtn.disabled = pagination.currentPage <= 1;
            this.elements.libPrevBtn.textContent = this.i18n.t('previous');
        }
        if (this.elements.libNextBtn) {
            this.elements.libNextBtn.disabled = pagination.currentPage >= pagination.totalPages;
            this.elements.libNextBtn.textContent = this.i18n.t('next');
        }
    }

    updateNowPlaying(track) {
        if (track) {
            this.elements.nowTitle.textContent = track.title;
            this.elements.nowArtist.textContent = track.artist;
            this.elements.playPauseBtn.textContent = '⏸';
            if (this.elements.cover) this.elements.cover.src = 'assets/default-cover.png';
        } else {
            this.elements.nowTitle.textContent = '—';
            this.elements.nowArtist.textContent = '—';
            this.elements.playPauseBtn.textContent = '▶';
            if (this.elements.cover) this.elements.cover.src = 'assets/default-cover.png';
        }
    }

    updateProgress(currentTime, duration) {
        if (this.elements.currentTime) this.elements.currentTime.textContent = this.formatTime(currentTime);
        if (this.elements.duration) this.elements.duration.textContent = this.formatTime(duration);

        if (this.elements.seekSlider && duration > 0) {
            this.elements.seekSlider.max = duration;
            this.elements.seekSlider.value = currentTime;
        }
    }

    updatePlayPauseBtn(isPlaying) {
        if (this.elements.playPauseBtn) {
            this.elements.playPauseBtn.textContent = isPlaying ? '⏸' : '▶';
        }
    }

    updateMuteBtn(isMuted) {
        if (this.elements.muteBtn) {
            this.elements.muteBtn.classList.toggle('active', isMuted);
            this.elements.muteBtn.textContent = isMuted ? '🔇' : '🔊';
        }
    }

    updateRepeatBtn(mode) {
        if (this.elements.repeatBtn) {
            this.elements.repeatBtn.classList.toggle('active', mode !== 0);
            if (mode === 2) {
                this.elements.repeatBtn.textContent = '🔂';
                this.elements.repeatBtn.title = 'Repeat One';
            } else {
                this.elements.repeatBtn.textContent = '🔁';
                this.elements.repeatBtn.title = mode === 1 ? 'Repeat All' : 'Repeat Off';
            }
        }
    }

    showSnackbar(msg) {
        if (!this.elements.snackbar) return;
        this.elements.snackbarMsg.textContent = msg;
        this.elements.snackbar.style.display = 'flex';
        setTimeout(() => {
            this.elements.snackbar.style.display = 'none';
        }, 3000);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    showLibraryPicker(tracks) {
        const modal = document.createElement('div');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'libPickerTitle');
        modal.style.cssText = `
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8); z-index: 2000;
          display: flex; justify-content: center; align-items: center;
      `;

        const content = document.createElement('div');
        content.className = 'library-selection-modal';
        content.style.cssText = `
          background: #121826; padding: 20px; border-radius: 12px;
          width: 90%; max-width: 500px; max-height: 80vh; overflow-y: auto;
          border: 1px solid #1f2937;
      `;

        const title = document.createElement('h2');
        title.id = 'libPickerTitle';
        title.textContent = 'Select Songs from Library';
        title.style.marginTop = '0';

        const list = document.createElement('ul');
        list.className = 'track-list';

        tracks.forEach(track => {
            const li = document.createElement('li');
            li.className = 'track';
            li.innerHTML = `
            <div class="meta">
              <div class="title">${track.title}</div>
              <div class="artist">${track.artist}</div>
            </div>
            <button class="btn mini-btn" aria-label="Add ${track.title}">Add</button>
          `;
            li.querySelector('button').addEventListener('click', () => {
                this.eventBus.emit('ADD_FROM_LIBRARY', track);
            });
            list.appendChild(li);
        });

        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn';
        closeBtn.textContent = 'Done';
        closeBtn.style.marginTop = '10px';
        closeBtn.style.width = '100%';

        const closeModal = () => {
            modal.remove();
            this.elements.addSongsBtn.focus(); // Return focus
        };

        closeBtn.addEventListener('click', closeModal);

        content.appendChild(title);
        content.appendChild(list);
        content.appendChild(closeBtn);
        modal.appendChild(content);
        document.body.appendChild(modal);

        // Trap focus
        const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            } else if (e.key === 'Escape') {
                closeModal();
            }
        });

        if (firstElement) firstElement.focus();
    }

    updateVolumeFill() {
        const slider = this.elements.volumeSlider;
        if (!slider) return;
        const val = parseFloat(slider.value);
        const min = parseFloat(slider.min || 0);
        const max = parseFloat(slider.max || 1);
        const percent = ((val - min) / (max - min)) * 100;
        slider.style.setProperty('--volume-percent', `${percent}%`);
    }

    showPlayer() {
        if (this.elements.playerView) this.elements.playerView.classList.remove('hidden');
        if (this.elements.libraryView) this.elements.libraryView.classList.add('hidden');
        if (this.elements.navPlayer) this.elements.navPlayer.classList.add('active');
        if (this.elements.navLibrary) this.elements.navLibrary.classList.remove('active');
    }

    showLibrary() {
        if (this.elements.playerView) this.elements.playerView.classList.add('hidden');
        if (this.elements.libraryView) this.elements.libraryView.classList.remove('hidden');
        if (this.elements.navPlayer) this.elements.navPlayer.classList.remove('active');
        if (this.elements.navLibrary) this.elements.navLibrary.classList.add('active');
    }
    updateTranslations() {
        if (this.elements.navPlayer) this.elements.navPlayer.textContent = this.i18n.t('player');
        if (this.elements.navLibrary) this.elements.navLibrary.textContent = this.i18n.t('library');
        if (this.elements.importPlaylistBtn) this.elements.importPlaylistBtn.title = this.i18n.t('importPlaylist');
        if (this.elements.exportPlaylistBtn) this.elements.exportPlaylistBtn.title = this.i18n.t('exportPlaylist');
        if (this.elements.createPlaylistBtn) this.elements.createPlaylistBtn.title = this.i18n.t('newPlaylist');
        if (this.elements.currentPlaylistName && this.elements.currentPlaylistName.textContent === 'All Songs') {
            this.elements.currentPlaylistName.textContent = this.i18n.t('allSongs');
        }
        if (this.elements.addSongsBtn) {
            this.elements.addSongsBtn.innerHTML = `<span class="icon">☰</span> ${this.i18n.t('addSongs')}`;
        }
        const searchInput = document.getElementById('librarySearch');
        if (searchInput) searchInput.placeholder = this.i18n.t('searchPlaceholder');

        const clearBtn = document.getElementById('clearLibraryBtn');
        if (clearBtn) clearBtn.textContent = this.i18n.t('clearLibrary');

        if (this.elements.snackbarUndo) this.elements.snackbarUndo.textContent = this.i18n.t('undo');
    }
}

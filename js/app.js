import EventBus from './modules/EventBus.js';
import StorageManager from './modules/StorageManager.js';
import AudioController from './modules/AudioController.js';
import PlaylistManager from './modules/PlaylistManager.js';
import LibraryManager from './modules/LibraryManager.js';
import WaveformVisualizer from './modules/WaveformVisualizer.js';
import UIController from './modules/UIController.js';
import I18nManager from './modules/I18nManager.js';

class App {
    constructor() {
        this.eventBus = new EventBus();
        this.storageManager = new StorageManager();
        this.i18nManager = new I18nManager(this.eventBus);
        this.audioController = new AudioController(this.eventBus);
        this.playlistManager = new PlaylistManager(this.eventBus, this.storageManager);
        this.libraryManager = new LibraryManager(this.eventBus, this.storageManager);
        this.uiController = new UIController(this.eventBus, this.i18nManager);
        this.visualizer = null;

        if (document.getElementById('visualizer')) {
            this.visualizer = new WaveformVisualizer('visualizer', this.audioController);
        }

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.storageManager.init();
        await this.playlistManager.init();

        window.addEventListener('hashchange', () => this.handleRouting());
        this.handleRouting();

        // Register Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('SW Registered'))
                .catch(err => console.error('SW Fail', err));
        }
    }

    handleRouting() {
        const hash = window.location.hash;
        if (hash === '#library') {
            this.uiController.showLibrary();
            this.libraryManager.loadLibrary();
        } else {
            this.uiController.showPlayer();
        }
    }

    bindEvents() {
        this.undoStack = [];

        // UI -> Logic
        this.eventBus.on('TOGGLE_PLAY', () => {
            if (this.audioController.isPlaying) {
                this.audioController.pause();
            } else {
                this.audioController.play();
            }
        });

        this.eventBus.on('TOGGLE_MUTE', () => {
            const isMuted = this.audioController.toggleMute();
            this.uiController.updateMuteBtn(isMuted);
        });

        this.eventBus.on('TOGGLE_REPEAT', () => {
            const repeatMode = this.playlistManager.toggleRepeat();
            this.uiController.updateRepeatBtn(repeatMode);
        });

        this.eventBus.on('PREV_TRACK', () => this.playlistManager.prev());
        this.eventBus.on('NEXT_TRACK', () => this.playlistManager.next(false));

        this.eventBus.on('FILES_SELECTED', (files) => this.libraryManager.importFiles(files));

        this.eventBus.on('PLAY_TRACK', (index) => this.playlistManager.playTrack(index));

        this.eventBus.on('REMOVE_TRACK', (index) => {
            const track = this.playlistManager.playlist[index];
            if (track) {
                this.undoStack.push({ type: 'ADD_TRACK', track });
                this.uiController.showSnackbar('Track removed');
                // Show undo button logic is handled in UIController by default for snackbar, 
                // but we need to ensure the button triggers UNDO event.
                // UIController.showSnackbar shows the button.
            }
            this.playlistManager.removeTrack(index);
        });

        this.eventBus.on('UNDO', async () => {
            const action = this.undoStack.pop();
            if (!action) return;

            if (action.type === 'ADD_TRACK') {
                await this.playlistManager.addTrack(action.track);
                this.uiController.showSnackbar('Undone');
            }
        });

        this.eventBus.on('RENAME_TRACK', ({ ind5ex, title }) => this.playlistManager.renameTrack(index, title));
        this.eventBus.on('REORDER_PLAYLIST', ({ fromIndex, toIndex }) => this.playlistManager.reorderPlaylist(fromIndex, toIndex));

        this.eventBus.on('CREATE_PLAYLIST', (name) => this.playlistManager.createPlaylist(name));
        this.eventBus.on('SELECT_PLAYLIST', (id) => this.playlistManager.selectPlaylist(id));
        this.eventBus.on('RENAME_PLAYLIST', ({ id, name }) => this.playlistManager.renamePlaylist(id, name));
        this.eventBus.on('DELETE_PLAYLIST', (id) => this.playlistManager.deletePlaylist(id));

        this.eventBus.on('EXPORT_PLAYLIST', () => this.playlistManager.exportPlaylist());
        this.eventBus.on('IMPORT_PLAYLIST', async (file) => {
            const result = await this.playlistManager.importPlaylist(file);
            if (result.success) {
                this.uiController.showSnackbar(`Imported ${result.count} songs`);
            } else {
                this.uiController.showSnackbar(`Import failed: ${result.error}`);
            }
        });

        this.eventBus.on('SEEK_CHANGED', (time) => this.audioController.seek(time));
        this.eventBus.on('VOLUME_CHANGED', (val) => this.audioController.setVolume(val));

        this.eventBus.on('SHOW_LIBRARY_PICKER', async () => {
            const tracks = await this.storageManager.getAllTracks();
            this.uiController.showLibraryPicker(tracks);
        });

        this.eventBus.on('ADD_FROM_LIBRARY', (track) => {
            if (this.playlistManager.addTrack(track)) {
                this.uiController.showSnackbar(`Added ${track.title}`);
            } else {
                this.uiController.showSnackbar(`${track.title} is already in the playlist!`);
            }
        });

        this.eventBus.on('CLEAR_LIBRARY', async () => {
            await this.libraryManager.clearLibrary();
            this.uiController.showSnackbar('Library cleared');
        });

        // Logic -> UI/Audio
        this.eventBus.on('TRACKS_IMPORTED', (tracks) => {
            let addedCount = 0;
            tracks.forEach(track => {
                if (this.playlistManager.addTrack(track)) {
                    addedCount++;
                }
            });
            if (addedCount > 0) {
                this.uiController.showSnackbar(`Added ${addedCount} songs to playlist`);
            } else if (tracks.length > 0) {
                this.uiController.showSnackbar(`Selected songs are already in the playlist`);
            }
        });

        this.eventBus.on('LIBRARY_UPDATED', (tracks) => {
            this.uiController.renderLibrary(tracks);
        });

        this.eventBus.on('SEARCH_LIBRARY', (query) => this.libraryManager.search(query));
        this.eventBus.on('SORT_LIBRARY', (sortValue) => this.libraryManager.sort(sortValue));
        this.eventBus.on('PREV_LIBRARY_PAGE', () => this.libraryManager.prevPage());
        this.eventBus.on('NEXT_LIBRARY_PAGE', () => this.libraryManager.nextPage());

        this.eventBus.on('LOCALE_CHANGED', () => {
            this.uiController.updateTranslations();
            // Re-render components that might contain text
            this.uiController.renderPlaylistSidebar(this.playlistManager.playlists, this.playlistManager.activePlaylistId);
            this.uiController.renderPlaylist(this.playlistManager.playlist, this.playlistManager.currentTrack);
            this.libraryManager.applyFilters(); // Re-render library
        });

        this.eventBus.on('PLAY_LIBRARY_TRACK', async (track) => {
            let index = this.playlistManager.playlist.findIndex(t => t.id === track.id);
            if (index === -1) {
                await this.playlistManager.addTrack(track);
                // Re-find index as it was just added
                index = this.playlistManager.playlist.findIndex(t => t.id === track.id);
                this.uiController.showSnackbar(`Added ${track.title} to playlist`);
            }
            this.playlistManager.playTrack(index);
        });

        this.eventBus.on('PLAYLISTS_CHANGED', ({ playlists, activeId }) => {
            this.uiController.renderPlaylistSidebar(playlists, activeId);
        });

        this.eventBus.on('PLAYLIST_UPDATED', (playlist) => {
            this.uiController.renderPlaylist(playlist, this.playlistManager.currentTrack);
        });

        this.eventBus.on('TRACK_CHANGED', async (track) => {
            if (track) {
                // Load audio from File object stored in IDB
                const arrayBuffer = await track.file.arrayBuffer();
                await this.audioController.load(arrayBuffer);
                this.audioController.play();
                this.uiController.updateNowPlaying(track);
                if (this.visualizer) this.visualizer.start();
            } else {
                this.audioController.reset();
                this.uiController.updateNowPlaying(null);
                if (this.visualizer) this.visualizer.stop();
            }
            this.uiController.renderPlaylist(this.playlistManager.playlist, track);
        });

        this.eventBus.on('PLAYBACK_STARTED', () => {
            this.uiController.updatePlayPauseBtn(true);
            this.startProgressLoop();
        });

        this.eventBus.on('PLAYBACK_PAUSED', () => {
            this.uiController.updatePlayPauseBtn(false);
            this.stopProgressLoop();
        });

        this.eventBus.on('AUDIO_ENDED', () => {
            this.playlistManager.next(true);
        });
    }

    startProgressLoop() {
        if (this.progressInterval) clearInterval(this.progressInterval);
        this.progressInterval = setInterval(() => {
            const time = this.audioController.getCurrentTime();
            const duration = this.audioController.duration;
            this.uiController.updateProgress(time, duration);
        }, 500);
    }

    stopProgressLoop() {
        if (this.progressInterval) clearInterval(this.progressInterval);
    }
}

// Initialize
window.app = new App();

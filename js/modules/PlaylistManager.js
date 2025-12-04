export default class PlaylistManager {
    constructor(eventBus, storageManager) {
        this.eventBus = eventBus;
        this.storageManager = storageManager;
        this.playlists = [];
        this.activePlaylistId = null;
        this.currentIndex = -1;
        this.isShuffle = false;
        this.repeatMode = 0; // 0: Off, 1: All, 2: One
    }

    // ... (init, getters, etc - assumed unchanged)

    next(isAuto = false) {
        const tracks = this.playlist;
        if (tracks.length === 0) return;

        if (isAuto && this.repeatMode === 2) {
            this.eventBus.emit('TRACK_CHANGED', this.currentTrack);
            return;
        }

        if (this.isShuffle) {
            this.currentIndex = Math.floor(Math.random() * tracks.length);
        } else {
            this.currentIndex++;
            if (this.currentIndex >= tracks.length) {
                if (this.repeatMode !== 0) {
                    this.currentIndex = 0;
                } else {
                    this.currentIndex = -1;
                }
            }
        }
        this.eventBus.emit('TRACK_CHANGED', this.currentTrack);
    }

    prev() {
        const tracks = this.playlist;
        if (tracks.length === 0) return;

        if (this.isShuffle) {
            this.currentIndex = Math.floor(Math.random() * tracks.length);
        } else {
            this.currentIndex--;
            if (this.currentIndex < 0) {
                this.currentIndex = this.repeatMode !== 0 ? tracks.length - 1 : 0;
            }
        }
        this.eventBus.emit('TRACK_CHANGED', this.currentTrack);
    }

    toggleShuffle() {
        this.isShuffle = !this.isShuffle;
        return this.isShuffle;
    }

    toggleRepeat() {
        this.repeatMode = (this.repeatMode + 1) % 3;
        return this.repeatMode;
    }

    async init() {
        if (!this.storageManager) return;
        this.playlists = await this.storageManager.getAllPlaylists();
        if (this.playlists.length === 0) {
            await this.createPlaylist('My Playlist');
        } else {
            // Default to first playlist
            this.activePlaylistId = this.playlists[0].id;
            this.emitUpdate();
        }
    }

    get currentPlaylist() {
        return this.playlists.find(p => p.id === this.activePlaylistId);
    }

    get playlist() {
        return this.currentPlaylist ? this.currentPlaylist.tracks : [];
    }

    get currentTrack() {
        const tracks = this.playlist;
        return this.currentIndex >= 0 && tracks[this.currentIndex] ? tracks[this.currentIndex] : null;
    }

    async createPlaylist(name) {
        const newPlaylist = {
            id: Date.now().toString(), // Simple ID generation
            name: name,
            tracks: []
        };
        this.playlists.push(newPlaylist);
        await this.storageManager.savePlaylist(newPlaylist);

        // Switch to new playlist
        this.selectPlaylist(newPlaylist.id);
    }

    selectPlaylist(id) {
        if (this.playlists.some(p => p.id === id)) {
            this.activePlaylistId = id;
            this.currentIndex = -1; // Reset playback state for new playlist
            this.emitUpdate();
            this.eventBus.emit('TRACK_CHANGED', null); // Stop current playback
        }
    }

    async renamePlaylist(id, newName) {
        const playlist = this.playlists.find(p => p.id === id);
        if (playlist) {
            playlist.name = newName;
            await this.storageManager.savePlaylist(playlist);
            this.emitUpdate();
        }
    }

    async deletePlaylist(id) {
        if (this.playlists.length <= 1) return; // Prevent deleting the last playlist

        const index = this.playlists.findIndex(p => p.id === id);
        if (index !== -1) {
            this.playlists.splice(index, 1);
            await this.storageManager.deletePlaylist(id);

            if (this.activePlaylistId === id) {
                this.activePlaylistId = this.playlists[0].id;
                this.currentIndex = -1;
                this.eventBus.emit('TRACK_CHANGED', null);
            }
            this.emitUpdate();
        }
    }

    async addTrack(track) {
        const current = this.currentPlaylist;
        if (!current) return false;

        if (current.tracks.some(t => t.id === track.id)) {
            return false;
        }

        current.tracks.push(track);
        await this.savePlaylists();
        this.emitUpdate();

        // If it's the first track, set it as current but don't auto-play
        if (current.tracks.length === 1) {
            this.currentIndex = 0;
            this.eventBus.emit('TRACK_CHANGED', this.currentTrack);
        }
        return true;
    }

    async removeTrack(index) {
        const current = this.currentPlaylist;
        if (!current) return;
        if (index < 0 || index >= current.tracks.length) return;

        current.tracks.splice(index, 1);
        await this.savePlaylists();

        if (index === this.currentIndex) {
            if (current.tracks.length === 0) {
                this.currentIndex = -1;
                this.eventBus.emit('TRACK_CHANGED', null);
            } else {
                this.currentIndex = index < current.tracks.length ? index : current.tracks.length - 1;
                this.eventBus.emit('TRACK_CHANGED', this.currentTrack);
            }
        } else if (index < this.currentIndex) {
            this.currentIndex--;
        }

        this.emitUpdate();
    }

    async renameTrack(index, newTitle) {
        const current = this.currentPlaylist;
        if (!current) return;

        if (index >= 0 && index < current.tracks.length) {
            current.tracks[index].title = newTitle;
            await this.savePlaylists();
            this.emitUpdate();

            if (index === this.currentIndex) {
                this.eventBus.emit('TRACK_CHANGED', this.currentTrack);
            }
        }
    }

    async reorderPlaylist(fromIndex, toIndex) {
        const current = this.currentPlaylist;
        if (!current) return;

        if (fromIndex < 0 || fromIndex >= current.tracks.length || toIndex < 0 || toIndex >= current.tracks.length) return;

        const [movedTrack] = current.tracks.splice(fromIndex, 1);
        current.tracks.splice(toIndex, 0, movedTrack);
        await this.savePlaylists();

        if (this.currentIndex === fromIndex) {
            this.currentIndex = toIndex;
        } else if (this.currentIndex > fromIndex && this.currentIndex <= toIndex) {
            this.currentIndex--;
        } else if (this.currentIndex < fromIndex && this.currentIndex >= toIndex) {
            this.currentIndex++;
        }

        this.emitUpdate();
    }

    playTrack(index) {
        const current = this.currentPlaylist;
        if (current && index >= 0 && index < current.tracks.length) {
            this.currentIndex = index;
            this.eventBus.emit('TRACK_CHANGED', this.currentTrack);
        }
    }



    exportPlaylist() {
        const current = this.currentPlaylist;
        if (!current) return;

        const data = {
            name: current.name,
            tracks: current.tracks.map(t => ({
                title: t.title,
                artist: t.artist,
                duration: t.duration
            }))
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${current.name}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async importPlaylist(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.name || !Array.isArray(data.tracks)) {
                throw new Error('Invalid playlist format');
            }

            // Create new playlist
            const newId = Date.now().toString();
            const newPlaylist = {
                id: newId,
                name: data.name + ' (Imported)',
                tracks: []
            };

            // Match tracks
            for (const t of data.tracks) {
                const match = await this.storageManager.findTrackByTitleAndArtist(t.title, t.artist);
                if (match) {
                    newPlaylist.tracks.push(match);
                }
            }

            this.playlists.push(newPlaylist);
            await this.storageManager.savePlaylist(newPlaylist);
            this.selectPlaylist(newId);

            return { success: true, count: newPlaylist.tracks.length, total: data.tracks.length };
        } catch (err) {
            console.error(err);
            return { success: false, error: err.message };
        }
    }

    async savePlaylists() {
        if (this.currentPlaylist) {
            await this.storageManager.savePlaylist(this.currentPlaylist);
        }
    }

    emitUpdate() {
        this.eventBus.emit('PLAYLIST_UPDATED', this.playlist);
        this.eventBus.emit('PLAYLISTS_CHANGED', {
            playlists: this.playlists,
            activeId: this.activePlaylistId
        });
    }
}

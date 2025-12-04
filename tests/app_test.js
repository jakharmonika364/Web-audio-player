import EventBus from '../js/modules/EventBus.js';
import PlaylistManager from '../js/modules/PlaylistManager.js';
import LibraryManager from '../js/modules/LibraryManager.js';
import I18nManager from '../js/modules/I18nManager.js';

// Mock StorageManager
class MockStorageManager {
    constructor() {
        this.tracks = [];
        this.playlists = [];
    }
    async init() { }
    async saveTrack(track) { this.tracks.push(track); }
    async getAllTracks() { return this.tracks; }
    async findTrackByTitleAndArtist(title, artist) { return this.tracks.find(t => t.title === title && t.artist === artist); }
    async savePlaylist(playlist) { this.playlists.push(playlist); }
    async getAllPlaylists() { return this.playlists; }
    async savePlaylists(playlists) { this.playlists = playlists; }
    async deletePlaylist(id) { this.playlists = this.playlists.filter(p => p.id !== id); }
    async clearAllTracks() { this.tracks = []; }
}

const resultsDiv = document.getElementById('results');
const summaryDiv = document.getElementById('summary');
let passed = 0;
let failed = 0;

function assert(condition, message) {
    const div = document.createElement('div');
    div.className = `test-case ${condition ? 'pass' : 'fail'}`;
    div.textContent = `${condition ? '✔' : '✘'} ${message}`;
    resultsDiv.appendChild(div);
    if (condition) passed++; else failed++;
}

async function runTests() {
    const eventBus = new EventBus();
    const storageManager = new MockStorageManager();

    // --- EventBus Tests ---
    resultsDiv.innerHTML += '<h2>EventBus</h2>';
    let eventFired = false;
    eventBus.on('TEST_EVENT', () => eventFired = true);
    eventBus.emit('TEST_EVENT');
    assert(eventFired, 'EventBus should emit and listen to events');

    // --- PlaylistManager Tests ---
    resultsDiv.innerHTML += '<h2>PlaylistManager</h2>';
    const playlistManager = new PlaylistManager(eventBus, storageManager);
    await playlistManager.init();

    assert(playlistManager.playlists.length > 0, 'Should initialize with default playlist');
    assert(playlistManager.playlists[0].name === 'My Playlist', 'Default playlist name should be "My Playlist"');

    await playlistManager.createPlaylist('New List');
    assert(playlistManager.playlists.length === 2, 'Should create a new playlist');
    assert(playlistManager.playlists[1].name === 'New List', 'New playlist should have correct name');

    // --- LibraryManager Tests ---
    resultsDiv.innerHTML += '<h2>LibraryManager</h2>';
    const libraryManager = new LibraryManager(eventBus, storageManager);

    // Mock file import
    libraryManager.allTracks = Array.from({ length: 25 }, (_, i) => ({ title: `Song ${i}`, artist: 'Artist', dateAdded: Date.now() }));

    // Check pagination event
    let paginationData = null;
    eventBus.on('LIBRARY_UPDATED', (data) => {
        paginationData = data;
    });

    libraryManager.applyFilters();

    if (paginationData) {
        assert(paginationData.tracks.length === 12, 'Should return 12 tracks per page');
        assert(paginationData.pagination.currentPage === 1, 'Should start on page 1');
        assert(paginationData.pagination.totalPages === 3, 'Should have 3 total pages for 25 items');

        libraryManager.nextPage();
        assert(paginationData.pagination.currentPage === 2, 'Should move to page 2');

        libraryManager.setPage(3);
        assert(paginationData.tracks.length === 1, 'Page 3 should have 1 track');
    } else {
        assert(false, 'LIBRARY_UPDATED event did not fire');
    }

    // --- I18nManager Tests ---
    resultsDiv.innerHTML += '<h2>I18nManager</h2>';
    const i18n = new I18nManager(eventBus);

    assert(i18n.t('player') === 'Player', 'Should return English translation by default');

    i18n.setLocale('es');
    assert(i18n.t('player') === 'Reproductor', 'Should return Spanish translation after locale change');

    assert(i18n.t('deletePlaylistConfirm', { name: 'Test' }) === '¿Eliminar lista "Test"?', 'Should handle interpolation');


    // Summary
    summaryDiv.textContent = `Tests Completed: ${passed} Passed, ${failed} Failed`;
    summaryDiv.style.color = failed === 0 ? '#4ade80' : '#f87171';
}

runTests().catch(err => {
    console.error(err);
    const div = document.createElement('div');
    div.className = 'test-case fail';
    div.textContent = `Test Runner Error: ${err.message}`;
    resultsDiv.appendChild(div);
});

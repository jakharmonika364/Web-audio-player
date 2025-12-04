export default class LibraryManager {
    constructor(eventBus, storageManager) {
        this.eventBus = eventBus;
        this.storageManager = storageManager;
        this.allTracks = [];
        this.currentSearch = '';
        this.currentSort = 'dateAdded-desc';
        this.currentPage = 1;
        this.itemsPerPage = 6;
    }

    async importFiles(fileList) {
        const newTracks = [];

        for (const file of fileList) {
            if (!file.type.startsWith('audio/')) continue;

            try {
                const arrayBuffer = await file.arrayBuffer();
                const metadata = await this.extractMetadata(file);

                const title = metadata.title || file.name.replace(/\.[^/.]+$/, "");
                const artist = metadata.artist || 'Unknown Artist';

                // Check for duplicate
                const existingTrack = await this.storageManager.findTrackByTitleAndArtist(title, artist);
                if (existingTrack) {
                    console.log('Skipping duplicate:', title);
                    newTracks.push(existingTrack);
                    continue;
                }

                const track = {
                    id: crypto.randomUUID(),
                    title: title,
                    artist: artist,
                    duration: metadata.duration || 0,
                    file: file, // Store File object (Blob) directly in IndexedDB
                    dateAdded: Date.now()
                };

                await this.storageManager.saveTrack(track);
                newTracks.push(track);
            } catch (err) {
                console.error('Error importing file:', file.name, err);
            }
        }

        if (newTracks.length > 0) {
            // Refresh full list for search/sort
            this.allTracks = await this.storageManager.getAllTracks();
            this.applyFilters();
            this.eventBus.emit('TRACKS_IMPORTED', newTracks);
        }
    }

    async loadLibrary() {
        this.allTracks = await this.storageManager.getAllTracks();
        this.applyFilters();
    }

    search(query) {
        this.currentSearch = query.toLowerCase();
        this.currentPage = 1; // Reset to first page on search
        this.applyFilters();
    }

    sort(sortValue) {
        this.currentSort = sortValue;
        this.applyFilters();
    }

    setPage(page) {
        this.currentPage = page;
        this.applyFilters();
    }

    nextPage() {
        this.currentPage++;
        this.applyFilters();
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.applyFilters();
        }
    }

    applyFilters() {
        let filtered = this.allTracks;

        // Search
        if (this.currentSearch) {
            filtered = filtered.filter(t =>
                t.title.toLowerCase().includes(this.currentSearch) ||
                t.artist.toLowerCase().includes(this.currentSearch)
            );
        }

        // Sort
        filtered.sort((a, b) => {
            const [field, direction] = this.currentSort.split('-');
            const valA = a[field] || '';
            const valB = b[field] || '';

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        // Pagination
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage) || 1;

        if (this.currentPage > totalPages) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const paginated = filtered.slice(start, end);

        this.eventBus.emit('LIBRARY_UPDATED', {
            tracks: paginated,
            pagination: {
                currentPage: this.currentPage,
                totalPages: totalPages,
                totalItems: totalItems
            }
        });
    }

    async clearLibrary() {
        await this.storageManager.clearAllTracks();
        this.eventBus.emit('LIBRARY_UPDATED', []);
    }

    // Basic metadata extraction (placeholder for more advanced parsing)
    async extractMetadata(file) {
        // In a real app, use 'music-metadata-browser' or similar.
        // Here we just return basic info.
        return {
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: 'Unknown Artist'
        };
    }
}

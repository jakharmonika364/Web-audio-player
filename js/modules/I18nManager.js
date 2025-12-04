export default class I18nManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.locale = 'en';
        this.translations = {
            en: {
                appTitle: 'Music Player',
                player: 'Player',
                library: 'Library',
                playlist: 'Playlist',
                importPlaylist: 'Import Playlist',
                exportPlaylist: 'Export Playlist',
                newPlaylist: 'New Playlist',
                allSongs: 'All Songs',
                addSongs: 'Add Songs',
                searchPlaceholder: 'Search tracks, artists...',
                recentlyAdded: 'Recently Added',
                az: 'A-Z',
                za: 'Z-A',
                artist: 'Artist',
                clearLibrary: 'Clear Library',
                previous: 'Previous',
                next: 'Next',
                page: 'Page',
                of: 'of',
                undo: 'Undo',
                trackRemoved: 'Track removed',
                undone: 'Undone',
                libraryCleared: 'Library cleared',
                addedToPlaylist: 'Added to playlist',
                alreadyInPlaylist: 'is already in the playlist!',
                deletePlaylistConfirm: 'Delete playlist "{name}"?',
                deleteLibraryConfirm: 'Are you sure you want to delete all songs from the library? This cannot be undone.',
                enterPlaylistName: 'Enter playlist name:',
                enterNewTitle: 'Enter new title:',
                selectSongs: 'Select Songs from Library',
                done: 'Done',
                add: 'Add'
            },
            es: {
                appTitle: 'Reproductor de Música',
                player: 'Reproductor',
                library: 'Biblioteca',
                playlist: 'Lista de reproducción',
                importPlaylist: 'Importar lista',
                exportPlaylist: 'Exportar lista',
                newPlaylist: 'Nueva lista',
                allSongs: 'Todas las canciones',
                addSongs: 'Añadir canciones',
                searchPlaceholder: 'Buscar pistas, artistas...',
                recentlyAdded: 'Recientemente añadido',
                az: 'A-Z',
                za: 'Z-A',
                artist: 'Artista',
                clearLibrary: 'Borrar biblioteca',
                previous: 'Anterior',
                next: 'Siguiente',
                page: 'Página',
                of: 'de',
                undo: 'Deshacer',
                trackRemoved: 'Pista eliminada',
                undone: 'Deshecho',
                libraryCleared: 'Biblioteca borrada',
                addedToPlaylist: 'Añadido a la lista',
                alreadyInPlaylist: '¡ya está en la lista!',
                deletePlaylistConfirm: '¿Eliminar lista "{name}"?',
                deleteLibraryConfirm: '¿Estás seguro de que quieres borrar todas las canciones? Esto no se puede deshacer.',
                enterPlaylistName: 'Introduce el nombre de la lista:',
                enterNewTitle: 'Introduce el nuevo título:',
                selectSongs: 'Seleccionar canciones de la biblioteca',
                done: 'Hecho',
                add: 'Añadir'
            }
        };
    }

    setLocale(locale) {
        if (this.translations[locale]) {
            this.locale = locale;
            this.eventBus.emit('LOCALE_CHANGED', locale);
        }
    }

    t(key, params = {}) {
        let str = this.translations[this.locale][key] || key;
        for (const [k, v] of Object.entries(params)) {
            str = str.replace(`{${k}}`, v);
        }
        return str;
    }
}

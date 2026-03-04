# Web Audio Player

## 1. Project Overview

This project aims to create a browser-based audio player that works offline, supports playlists, and provides an improved user experience using waveform visualization and local caching.

### Problem Statement (In Simple Words)

Most audio players require internet connectivity or backend support. This project solves that problem by creating a fully frontend-powered music player that:

- Works offline
- Manages playlists
- Visualizes audio waveforms
- Saves user preferences locally

## 2. Functional Scope

### Must-Have Features

- Play, pause, skip, repeat and seek through songs
- Waveform scrubber using Canvas API
- Playlist management (Add/Remove tracks, sorting, pagination)
- Responsive UI (Mobile + Desktop)

### Stretch Goals

- Undo/Redo with toast notifications
- Theme switcher (Dark/Light)
- Playback speed & volume controls
- Export/Import playlists as JSON

## 3. Tech Stack

### Frontend

- HTML5
- CSS3 (Flexbox, Grid, Animations)
- JavaScript (ES6+ modules)
- Canvas API – Waveform drawing
- Web Audio API – Playback + Visualization
- ARIA roles + keyboard navigation

### Backend (Optional / Final Choice)

- Node.js + Express + JSON file database

### Tools used

- Multer (file upload)
- Helmet + CORS (security)
- Postman (API testing)

### Browser Storage

- IndexedDB → Cache playlists, metadata, waveforms
- localStorage → UI preferences
- Cache API → Offline assets

### Offline Support

- Service Worker (PWA-like behavior)

### Dev Tools

- Lighthouse
- GitHub
- Vercel / Netlify / GitHub Pages

## 4. System Flow

1. User Input (Search / Play / Select)
2. Fetch or Load Playlist JSON
3. Decode Audio via Web Audio API
4. Render Waveform on Canvas
5. Playback Controls (Play/Pause/Seek)
6. Save Data to IndexedDB / localStorage
7. Output: Offline-ready responsive audio player

## 5. Key Data Structures & Algorithms

- Arrays & Objects for track + playlist storage
- IndexedDB for waveform & metadata caching
- Debounce technique for search optimization
- Pub-Sub architecture for modular event flow

## 6. Testing Strategy

### Functional Testing

- Play / Pause / Skip
- Playlist CRUD
- Waveform scrubber
- Search, sort, pagination

### Performance Testing

- Lighthouse
- Waveform rendering speed
- Bundle size optimization

### Accessibility Testing

- ARIA labels
- Screen-reader support
- Keyboard navigation

### Offline Testing

- Disable WiFi → Player should still:
  - Load pages
  - Load IndexedDB playlist
  - Serve cached files via Service Worker

### Cross-Browser Tests

- Chrome, Firefox, Edge, Safari

## 7. Folder Structure

```
/project-root
│
├── frontend/
│   ├── index.html
│   ├── assets/
│   ├── js/
│   ├── css/
│
├── server/
│   ├── server.js
│   ├── db.json
│   ├── routes/
│   │     ├── playlists.js
│   │     └── tracks.js
│   ├── uploads/
│   ├── package.json
│   └── README-backend.md
│
└── README.md

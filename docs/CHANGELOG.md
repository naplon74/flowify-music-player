# Changelog
## [0.0.4] - 2025-10-29

### Added
- Spanish (es) and Italian (it) translations across the app
- Onboarding language selector updated with Spanish and Italian flag buttons
- Language switcher in Settings (dropdown) with instant UI updates and persistence
- Window Button Style toggle (Windows/macOS) with correct order and colors
- Import/Export profile
- Mini player
- Statistics tabs
- Added a sleep timer, crossfade, audio visualizer and Equalizer
- Lyrics support

### Fixed
- Duplicate Discord RPC logs by guarding connection attempts and properly resetting flags

### Known issues
- Albums and Artists are broken. Hopefully they'll be fixed for 0.0.5
- Lyrics aren't sinced with the song timestamp

# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning when possible.

## [0.0.3] - 2025-10-24

### Added
- **YouTube Music API Integration**: Experimental support for YouTube Music as an alternative music source
  - Dual API system: Digger API (default, recommended) and YouTube Music API (experimental)
  - Automatic client fallback system (IOS → TVHTML5) for better stream URL retrieval
  - InnerTube API implementation with proper search and player endpoints
  - Settings UI to switch between music APIs with clear warnings
- **Media Session API**: Full Windows 11 media controls integration
  - Play/pause, next/previous track controls
  - Album art and track metadata display in Windows media overlay
  - Playlist name shown in media controls
  - Synchronized playback state
- **Performance Optimizations**:
  - Lazy loading for images and album covers
  - Conditional debug logging (only in development mode)
  - DOM element caching to reduce repeated queries
  - Passive event listeners for better scroll performance
  - ASAR compression for faster app loading

### Changed
- DevTools now disabled by default in production builds
- Music API selector moved to Settings with clear recommendations
- Improved onboarding name input reliability with multiple fallback fixes
- Enhanced error messages for YouTube Music playback issues

### Fixed
- **Onboarding name input** permanently fixed with multiple layers:
  - Inline styles with `!important` to prevent CSS conflicts
  - JavaScript event handlers to force input activation
  - Increased z-index and pointer-events enforcement
  - Click listener to re-enable input on every interaction
- YouTube Music stream URL 403 errors with client fallback system
- Media Session pause state synchronization
- Input field clickability issues in Electron frameless windows

### Technical Details
- Implemented YouTube InnerTube API with WEB_REMIX client for search
- Multi-client fallback system (IOS, TVHTML5) for stream URLs without authentication
- Added comprehensive error handling for YouTube Music playback failures
- Improved CORS handling for YouTube video streams

## [0.0.2] - 2025-10-23

### Added
- New "Discover" tab (renamed from "Search").
- Trending Songs section on Discover with animated header.
- New "Customize" page in the sidebar with:
  - Theme switch (Dark/Light) that applies immediately.
  - Toggle to show/hide Trending Songs.
  - Toggle to enable/disable Discord Rich Presence.
- Image flags for language selection (`assets/flag-gb.png`, `assets/flag-fr.png`).
- French and English translations for new navigation and sections.

### Changed
- Made track grid denser (more cards per row), reduced cover size for better information density.
- Updated Discord RPC implementation to official `discord-rpc` and improved presence update handling.
- Search UX: robust Enter handling (keypress + keydown) for better reliability in Electron.
- Onboarding kept as a single, reliable step; name input focus and typing hardened for frameless windows.

### Fixed
- Search input and other inputs could become unclickable due to draggable regions; enforced `-webkit-app-region: no-drag` on interactive elements and welcome overlay.
- Navigation tabs not translating: added `data-i18n` attributes and ensured UI refresh on language change.
- Trending visibility now respects the user preference everywhere (on startup, switching tabs, clearing search, etc.).
- Replaced unsupported browser `prompt()` with a custom Change Name modal and ESC-to-close behavior.

## [0.0.1] - 2025-10-22

### Added
- Initial beta release of Flowify.
- Onboarding with language selection and name input.
- Core playback, search, playlists, downloads, liked songs, and theming.
- Discord Rich Presence (basic), tray controls, and auto-updater.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning when possible.

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

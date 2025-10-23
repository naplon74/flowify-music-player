# 🎵 Flowify Music Player - Beta

<div align="center">

![Version](https://img.shields.io/badge/version-0.0.2-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

**A free, privacy-focused music player built with Electron**

*No account required • No tracking • No ads*

[Download Latest Release](https://github.com/naplon74/flowify-music-player/releases) • [Report Bug](https://github.com/naplon74/flowify-music-player/issues) • [Request Feature](https://github.com/naplon74/flowify-music-player/issues)

</div>

---

## ✨ Features

### 🎧 Core Functionality
- **High-Quality Streaming** - Stream music in lossless quality (FLAC/LOSSLESS)
- **Smart Search** - Find any track, artist, or album instantly
- **Custom Playlists** - Create, edit, and manage your music collections
- **Liked Songs** - Build your personal favorites library
- **Offline Downloads** - Download tracks for offline listening
- **Artist Pages** - Explore full artist discographies

### 🎨 User Experience
- **Modern UI** - Clean, intuitive interface with smooth animations
- **Dark & Light Themes** - Choose your preferred visual style
- **Custom Window Controls** - Frameless design with integrated controls
- **System Tray Integration** - Minimize to tray and control playback
- **Discord Rich Presence** - Show what you're listening to on Discord
- **Auto-Updates** - Seamless background updates via GitHub releases

### 🔒 Privacy First
- **No Account Required** - Start listening immediately
- **No Tracking** - Your listening history stays on your device
- **No Ads** - Uninterrupted music experience
- **Local Storage** - All preferences and playlists stored locally

### 🎛️ Audio Controls
- **Playback Controls** - Play, pause, skip, shuffle, repeat
- **Volume Control** - Smooth volume adjustment with memory
- **Progress Seeking** - Jump to any point in a track
- **Queue Management** - View and control your play queue

---

## 📸 Screenshots

![Preview](assets/screenshots/screenshot1.png)
<div align="center">
   
   **Setup page (For V0.02 and newer)**
</div>

![Preview](assets/screenshots/screenshot2.png)
<div align="center">

   **Discord rpc**
</div>
---

## 🎮 Usage

### Basic Controls
- **Play/Pause**: Spacebar or player button
- **Next Track**: Right Arrow or skip button
- **Previous Track**: Left Arrow or back button
- **Search**: Click search bar and type
- **Volume**: Drag volume slider or use volume buttons

### Creating Playlists
1. Click **Playlists** in the sidebar
2. Click **+ Create Playlist**
3. Enter a name and description
4. Add songs by clicking the **+** button on any track

### Editing Playlists
1. Open any playlist
2. Click the **Edit** button
3. Modify the name or description
4. Click **Save**

### Downloading Music
1. Find any track you want to download
2. Click the **download** icon
3. Tracks are saved locally for offline playback
4. Access downloads from the **Downloads** section

### Discord Integration
1. Go to **Settings** (gear icon)
2. Toggle **Discord Rich Presence**
3. Your currently playing track will appear on your Discord profile

---

## 🛠️ Tech Stack

### Core Technologies
- **[Electron](https://www.electronjs.org/)** - Cross-platform desktop framework
- **JavaScript** - Application logic
- **HTML5 & CSS3** - User interface
- **Node.js** - Backend runtime

### Key Libraries
- **[electron-updater](https://www.electron.build/auto-update)** - Automatic updates
- **[discord-rich-presence](https://www.npmjs.com/package/discord-rich-presence)** - Discord integration
- **[electron-builder](https://www.electron.build/)** - Application packaging

### Architecture
- **Main Process** (`main.js`) - Electron main process, window management, IPC
- **Renderer Process** (`script.js`) - UI logic, playback control
- **Preload Script** (`preload.js`) - Secure IPC bridge
- **Local Storage** - Persistent data (playlists, preferences)

---

## 📦 Project Structure

```
flowify-music-player/
├── assets/              # Icons and static resources
├── dist/                # Build output (generated)
├── main.js              # Electron main process
├── preload.js           # Preload script for IPC
├── index.html           # Main UI markup
├── script.js            # Renderer process logic
├── styles.css           # Application styles
├── package.json         # Dependencies and scripts
└── electron-builder.json # Build configuration
```

---

## 🔄 Auto-Update System

Flowify includes a seamless auto-update system:

1. **Silent Check** - App checks for updates on launch
2. **Notification** - Only notifies if an update is available
3. **User Control** - You decide when to download and install
4. **Background Download** - Updates download without interrupting playback
5. **Install on Quit** - Updates install when you close the app

### For Developers: Publishing Updates
1. Update version in `package.json`
2. Build the app: `npm run build:win`
3. Create a GitHub release with tag `vX.X.X`
4. Upload both the installer and `latest.yml` file
5. Users will automatically be notified of the update

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Reporting Bugs
1. Check if the bug has already been reported
2. Open a [new issue](https://github.com/naplon74/flowify-music-player/issues/new)
3. Include:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)
   - OS and app version

### Suggesting Features
1. Open a [feature request](https://github.com/naplon74/flowify-music-player/issues/new)
2. Describe the feature and its use case
3. Explain why it would benefit users

### Pull Requests
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Test on multiple platforms if possible
- Update documentation for new features
- Keep commits atomic and well-described

---

- Album artwork from **TIDAL Resources**
- Icons from **[Font Awesome](https://fontawesome.com/)**
- Built with ❤️ by Naplon_

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/naplon74/flowify-music-player/issues)
- **Discussions**: [GitHub Discussions](https://github.com/naplon74/flowify-music-player/discussions)

---

## 🗺️ Roadmap

### Upcoming Features
- [ ] Lyrics support
- [ ] Equalizer and audio effects
- [ ] Last.fm scrobbling
- [ ] Keyboard shortcuts customization
- [ ] Import/export playlists
- [ ] Cloud sync (optional)
- [ ] Mini player mode
- [ ] Visualizer

### Known Issues
- See [Issues](https://github.com/naplon74/flowify-music-player/issues) for current bugs and feature requests

---

<div align="center">

**Made with ❤️ for music lovers**

⭐ Star this repo if you like Flowify! ⭐

**Flowify is intended for educational and legal use only. You are solely responsible for the content you access.**

[Report Bug](https://github.com/naplon74/flowify-music-player/issues) • [Request Feature](https://github.com/naplon74/flowify-music-player/issues) • [Contribute](#-contributing)

</div>

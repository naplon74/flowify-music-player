// ============================================
// NEW FEATURES IMPLEMENTATION
// ============================================

// Feature States
let equalizerEnabled = JSON.parse(localStorage.getItem('equalizerEnabled') || 'false');
let crossfadeEnabled = JSON.parse(localStorage.getItem('crossfadeEnabled') || 'false');
let crossfadeDuration = parseFloat(localStorage.getItem('crossfadeDuration') || '3');
let visualizerEnabled = JSON.parse(localStorage.getItem('visualizerEnabled') || 'false');
let sleepTimerMinutes = 0;
let sleepTimerTimeout = null;
let shuffleHistory = JSON.parse(localStorage.getItem('shuffleHistory') || '[]');
let keyboardShortcuts = JSON.parse(localStorage.getItem('keyboardShortcuts') || '{}');

// Audio Context for Equalizer and Visualizer
let audioContext = null;
let audioSource = null;
let equalizer = null;
let analyzer = null;
let eqBands = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
let eqGains = new Array(eqBands.length).fill(0);

// EQ Presets
const EQ_PRESETS = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  rock: [5, 4, 3, 1, -1, -2, 0, 2, 3, 4],
  pop: [1, 2, 3, 3, 2, 0, -1, -1, 1, 2],
  jazz: [4, 3, 2, 1, -1, -2, 0, 1, 3, 4],
  classical: [5, 4, 3, 2, -1, -2, -1, 2, 3, 4],
  bass: [8, 6, 4, 2, 0, -1, -2, -2, -1, 0],
  treble: [0, -1, -2, -1, 0, 2, 4, 6, 7, 8],
  vocal: [2, 3, 2, 1, 3, 4, 3, 2, 1, 0]
};

// Default Keyboard Shortcuts
const DEFAULT_SHORTCUTS = {
  'playPause': 'Space',
  'nextTrack': 'ArrowRight',
  'previousTrack': 'ArrowLeft',
  'volumeUp': 'ArrowUp',
  'volumeDown': 'ArrowDown',
  'toggleShuffle': 'KeyS',
  'toggleRepeat': 'KeyR',
  'likeTrack': 'KeyL',
  'showQueue': 'KeyQ',
  'showLyrics': 'KeyY',
  'openEqualizer': 'KeyE'
};

if (Object.keys(keyboardShortcuts).length === 0) {
  keyboardShortcuts = { ...DEFAULT_SHORTCUTS };
  localStorage.setItem('keyboardShortcuts', JSON.stringify(keyboardShortcuts));
}

// ============================================
// EQUALIZER FUNCTIONS
// ============================================

function initializeAudioContext() {
  if (!audioContext && player) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioSource = audioContext.createMediaElementSource(player);
      
      // Create equalizer (biquad filters)
      equalizer = eqBands.map((freq, index) => {
        const filter = audioContext.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1;
        filter.gain.value = eqGains[index];
        return filter;
      });
      
      // Create analyzer for visualizer
      analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
      
      // Connect the chain
      let previousNode = audioSource;
      equalizer.forEach(filter => {
        previousNode.connect(filter);
        previousNode = filter;
      });
      previousNode.connect(analyzer);
      analyzer.connect(audioContext.destination);
      
      console.log('Audio context initialized');
    } catch (error) {
      console.error('Error initializing audio context:', error);
    }
  }
}

function openEqualizer() {
  initializeAudioContext();
  
  const modal = document.getElementById('equalizerModal');
  if (modal) {
    modal.style.display = 'flex';
    
    // Generate EQ sliders
    const container = document.getElementById('eqSliders');
    if (container && container.children.length === 0) {
      eqBands.forEach((freq, index) => {
        const div = document.createElement('div');
        div.className = 'eq-slider-container';
        div.innerHTML = `
          <input type="range" min="-12" max="12" step="0.5" value="${eqGains[index]}" 
                 class="eq-slider" id="eqSlider${index}" orient="vertical"
                 oninput="updateEQBand(${index}, this.value)">
          <span class="eq-label">${freq < 1000 ? freq : (freq/1000).toFixed(1) + 'k'}Hz</span>
        `;
        container.appendChild(div);
      });
    }
    
    // Generate visualizer bars
    const vizContainer = document.getElementById('eqVisualizer');
    if (vizContainer && vizContainer.children.length === 0) {
      for (let i = 0; i < 10; i++) {
        const bar = document.createElement('div');
        bar.className = 'eq-bar';
        bar.style.height = '20px';
        bar.id = `eqBar${i}`;
        vizContainer.appendChild(bar);
      }
      animateEQVisualizer();
    }
  }
}

function updateEQBand(index, value) {
  eqGains[index] = parseFloat(value);
  if (equalizer && equalizer[index]) {
    equalizer[index].gain.value = parseFloat(value);
  }
  localStorage.setItem('eqGains', JSON.stringify(eqGains));
}

function applyEQPreset(presetName) {
  const preset = EQ_PRESETS[presetName];
  if (preset) {
    preset.forEach((gain, index) => {
      eqGains[index] = gain;
      const slider = document.getElementById(`eqSlider${index}`);
      if (slider) slider.value = gain;
      if (equalizer && equalizer[index]) {
        equalizer[index].gain.value = gain;
      }
    });
    localStorage.setItem('eqGains', JSON.stringify(eqGains));
  }
}

function resetEqualizer() {
  applyEQPreset('flat');
  const select = document.getElementById('eqPresetSelect');
  if (select) select.value = 'flat';
}

function closeEqualizerModal(event) {
  const modal = document.getElementById('equalizerModal');
  if (modal && (!event || event.target === modal)) {
    modal.style.display = 'none';
  }
}

function animateEQVisualizer() {
  if (!analyzer) return;
  
  const bufferLength = analyzer.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  function draw() {
    if (!document.getElementById('equalizerModal') || 
        document.getElementById('equalizerModal').style.display === 'none') {
      return;
    }
    
    requestAnimationFrame(draw);
    analyzer.getByteFrequencyData(dataArray);
    
    for (let i = 0; i < 10; i++) {
      const bar = document.getElementById(`eqBar${i}`);
      if (bar) {
        const value = dataArray[Math.floor(i * bufferLength / 10)];
        const height = Math.max(5, (value / 255) * 80);
        bar.style.height = height + 'px';
      }
    }
  }
  
  draw();
}

// ============================================
// QUEUE MANAGEMENT
// ============================================

function loadQueue() {
  const queueList = document.getElementById('queueList');
  if (!queueList) return;
  
  if (currentPlaylist.length === 0) {
    queueList.innerHTML = '<div class="empty-state"><h3>Queue is empty</h3><p>Play a song to start the queue</p></div>';
    return;
  }
  
  queueList.innerHTML = currentPlaylist.map((track, index) => {
    const isCurrentTrack = index === currentIndex;
    return `
      <div class="queue-item ${isCurrentTrack ? 'playing' : ''}" draggable="true" data-index="${index}">
        <span class="queue-item-drag-handle"><i class="fas fa-grip-vertical"></i></span>
        <div class="queue-item-info">
          <div class="queue-item-title">${track.title}</div>
          <div class="queue-item-artist">${track.artist?.name || 'Unknown Artist'}</div>
        </div>
        <div class="queue-item-actions">
          ${!isCurrentTrack ? `<button class="btn btn-small" onclick="playQueueIndex(${index})"><i class="fas fa-play"></i></button>` : ''}
          <button class="btn btn-small btn-secondary" onclick="removeFromQueue(${index})"><i class="fas fa-times"></i></button>
        </div>
      </div>
    `;
  }).join('');
  
  // Add drag and drop
  setupQueueDragDrop();
}

function setupQueueDragDrop() {
  const items = document.querySelectorAll('.queue-item');
  let draggedElement = null;
  
  items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedElement = item;
      item.style.opacity = '0.5';
    });
    
    item.addEventListener('dragend', (e) => {
      item.style.opacity = '1';
    });
    
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      if (draggedElement !== item) {
        const fromIndex = parseInt(draggedElement.dataset.index);
        const toIndex = parseInt(item.dataset.index);
        
        // Reorder playlist
        const [moved] = currentPlaylist.splice(fromIndex, 1);
        currentPlaylist.splice(toIndex, 0, moved);
        
        // Update current index
        if (currentIndex === fromIndex) {
          currentIndex = toIndex;
        } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
          currentIndex--;
        } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
          currentIndex++;
        }
        
        loadQueue();
      }
    });
  });
}

function playQueueIndex(index) {
  currentIndex = index;
  const track = currentPlaylist[index];
  if (track) {
    playTrack(track.id, track);
  }
}

function removeFromQueue(index) {
  currentPlaylist.splice(index, 1);
  if (currentIndex > index) {
    currentIndex--;
  } else if (currentIndex === index && currentIndex >= currentPlaylist.length) {
    currentIndex = currentPlaylist.length - 1;
  }
  loadQueue();
}

function clearQueue() {
  if (confirm('Clear the entire queue?')) {
    currentPlaylist = [];
    currentIndex = 0;
    loadQueue();
  }
}

function shuffleQueue() {
  const currentTrackId = currentTrack?.id;
  const tempPlaylist = [...currentPlaylist];
  
  // Fisher-Yates shuffle
  for (let i = tempPlaylist.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tempPlaylist[i], tempPlaylist[j]] = [tempPlaylist[j], tempPlaylist[i]];
  }
  
  currentPlaylist = tempPlaylist;
  currentIndex = currentPlaylist.findIndex(t => t.id === currentTrackId);
  if (currentIndex === -1) currentIndex = 0;
  
  loadQueue();
}

function saveQueueAsPlaylist() {
  if (currentPlaylist.length === 0) {
    alert('Queue is empty');
    return;
  }
  
  const name = prompt('Enter playlist name:', 'Queue Snapshot');
  if (name) {
    const newPlaylist = {
      id: Date.now(),
      name: name,
      description: 'Saved from queue',
      songs: [...currentPlaylist],
      createdAt: new Date().toISOString()
    };
    playlists.push(newPlaylist);
    localStorage.setItem('playlists', JSON.stringify(playlists));
    showNotification('Success', 'Queue saved as playlist', 'success');
    loadPlaylists();
  }
}

// ============================================
// LYRICS FUNCTIONS
// ============================================

let lyricsUpdateInterval = null;
let currentLyricsLines = [];

async function openLyrics() {
  if (!currentTrack) {
    alert('No track playing');
    return;
  }
  
  // Open fullscreen lyrics view instead of modal
  openFullscreenLyrics();
}

async function openFullscreenLyrics() {
  if (!currentTrack) return;
  
  const fullscreenView = document.getElementById('fullscreenLyrics');
  const titleEl = document.getElementById('fullscreenLyricsTitle');
  const artistEl = document.getElementById('fullscreenLyricsArtist');
  const contentEl = document.getElementById('fullscreenLyricsContent');
  
  if (!fullscreenView || !contentEl) return;
  
  // Set track info
  if (titleEl) titleEl.textContent = currentTrack.title;
  if (artistEl) artistEl.textContent = currentTrack.artist?.name || 'Unknown Artist';
  
  // Show fullscreen view immediately
  fullscreenView.style.display = 'flex';
  contentEl.innerHTML = '<div class="lyrics-loading"><i class="fas fa-spinner fa-spin"></i> Fetching lyrics...</div>';
  
  try {
    // Add timeout to fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const lyrics = await fetchLyricsWithTimeout(
      currentTrack.title, 
      currentTrack.artist?.name || '',
      controller.signal
    );
    
    clearTimeout(timeoutId);
    
    if (lyrics) {
      const lines = lyrics.split('\n').filter(line => line.trim() !== '');
      currentLyricsLines = lines;
      
      // Render lyrics lines with data attributes for syncing
      contentEl.innerHTML = lines.map((line, index) => 
        `<div class="lyrics-line" data-line-index="${index}">${line}</div>`
      ).join('');
      
      // Start syncing lyrics with playback
      startLyricsSync();
    } else {
      contentEl.innerHTML = '<div class="lyrics-error"><i class="fas fa-exclamation-circle"></i> Lyrics not found for this song</div>';
    }
  } catch (error) {
    console.error('[Lyrics] Error:', error);
    if (error.name === 'AbortError') {
      contentEl.innerHTML = '<div class="lyrics-error"><i class="fas fa-exclamation-triangle"></i> Request timeout - lyrics service is slow</div>';
    } else {
      contentEl.innerHTML = '<div class="lyrics-error"><i class="fas fa-times-circle"></i> Error loading lyrics</div>';
    }
  }
}

async function fetchLyricsWithTimeout(title, artist, signal) {
  // Clean up artist and title for better matching
  const cleanArtist = artist.replace(/\s*\(.*?\)\s*/g, '').trim();
  const cleanTitle = title.replace(/\s*\(.*?\)\s*/g, '').trim();
  
  // Try multiple APIs in order
  const apis = [
    {
      name: 'lrclib.net',
      url: `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`,
      parser: (data) => data.plainLyrics || data.syncedLyrics?.replace(/\[\d{2}:\d{2}\.\d{2}\]/g, '').trim()
    },
    {
      name: 'lyrics.ovh',
      url: `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`,
      parser: (data) => data.lyrics
    }
  ];
  
  for (const api of apis) {
    try {
      console.log(`[Lyrics] Trying ${api.name}:`, cleanArtist, '-', cleanTitle);
      
      const response = await fetch(api.url, { 
        signal,
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        console.warn(`[Lyrics] ${api.name} returned:`, response.status);
        continue;
      }
      
      const data = await response.json();
      const lyrics = api.parser(data);
      
      if (lyrics) {
        console.log(`[Lyrics] Found lyrics from ${api.name}!`);
        return lyrics;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }
      console.warn(`[Lyrics] ${api.name} error:`, error.message);
      continue;
    }
  }
  
  console.warn('[Lyrics] No lyrics found from any source');
  return null;
}

function startLyricsSync() {
  // Clear any existing interval
  if (lyricsUpdateInterval) {
    clearInterval(lyricsUpdateInterval);
  }
  
  // Update lyrics highlighting based on song progress
  lyricsUpdateInterval = setInterval(() => {
    if (!player || !currentTrack || !currentLyricsLines.length) return;
    
    const currentTime = player.currentTime || 0;
    const duration = player.duration || currentTrack.duration || 1;
    
    if (duration <= 0) return;
    
    // Calculate which line should be active based on progress
    // Add offset to sync lyrics better (advance lyrics by 2.5 seconds)
    const lyricsOffset = 2.5; // Advance lyrics display by this many seconds
    const adjustedTime = Math.max(0, currentTime + lyricsOffset);
    const progressRatio = adjustedTime / duration;
    const totalLines = currentLyricsLines.length;
    
    // Better distribution: account for intro and outro sections
    // Assume 10% intro, 10% outro, 80% lyrics
    let activeLineIndex;
    if (progressRatio < 0.1) {
      // Intro - show first line dimmed
      activeLineIndex = 0;
    } else if (progressRatio > 0.9) {
      // Outro - show last line
      activeLineIndex = totalLines - 1;
    } else {
      // Main lyrics section (10%-90% of song)
      const lyricsProgress = (progressRatio - 0.1) / 0.8;
      activeLineIndex = Math.floor(lyricsProgress * totalLines);
      activeLineIndex = Math.max(0, Math.min(totalLines - 1, activeLineIndex));
    }
    
    // Update line highlighting
    const lines = document.querySelectorAll('.fullscreen-lyrics-content .lyrics-line');
    lines.forEach((line, index) => {
      line.classList.remove('active', 'near-active');
      
      if (index === activeLineIndex) {
        line.classList.add('active');
        // Auto-scroll disabled - user can scroll manually
      } else if (Math.abs(index - activeLineIndex) === 1) {
        line.classList.add('near-active');
      }
    });
  }, 300); // Update more frequently for smoother sync
}

function closeFullscreenLyrics() {
  const fullscreenView = document.getElementById('fullscreenLyrics');
  if (fullscreenView) {
    fullscreenView.style.display = 'none';
  }
  
  // Stop syncing
  if (lyricsUpdateInterval) {
    clearInterval(lyricsUpdateInterval);
    lyricsUpdateInterval = null;
  }
  
  currentLyricsLines = [];
}

async function fetchLyrics(title, artist) {
  try {
    // Use lyrics.ovh API - free and simple
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    console.log('[Lyrics] Fetching from:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn('[Lyrics] API returned:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.lyrics) {
      console.log('[Lyrics] Found lyrics!');
      return data.lyrics;
    } else {
      console.warn('[Lyrics] No lyrics in response');
      return null;
    }
  } catch (error) {
    console.error('[Lyrics] Fetch error:', error);
    return null;
  }
}

function closeLyricsModal(event) {
  const modal = document.getElementById('lyricsModal');
  if (modal && (!event || event.target === modal)) {
    modal.style.display = 'none';
  }
}

// ============================================
// CROSSFADE FUNCTIONS
// ============================================

function initializeCrossfade() {
  const toggle = document.getElementById('crossfadeToggle');
  const slider = document.getElementById('crossfadeDuration');
  const valueDisplay = document.getElementById('crossfadeValue');
  
  if (toggle) {
    toggle.checked = crossfadeEnabled;
    toggle.onchange = (e) => {
      crossfadeEnabled = e.target.checked;
      localStorage.setItem('crossfadeEnabled', JSON.stringify(crossfadeEnabled));
    };
  }
  
  if (slider) {
    slider.value = crossfadeDuration;
    slider.oninput = (e) => {
      crossfadeDuration = parseFloat(e.target.value);
      if (valueDisplay) valueDisplay.textContent = crossfadeDuration + 's';
      localStorage.setItem('crossfadeDuration', crossfadeDuration);
    };
  }
}

// ============================================
// SLEEP TIMER
// ============================================

function setSleepTimer() {
  const select = document.getElementById('sleepTimerSelect');
  if (!select) return;
  
  const minutes = parseInt(select.value);
  
  // Clear existing timer
  if (sleepTimerTimeout) {
    clearTimeout(sleepTimerTimeout);
    sleepTimerTimeout = null;
  }
  
  // Remove indicator
  const existingIndicator = document.querySelector('.sleep-timer-active');
  if (existingIndicator) existingIndicator.remove();
  
  if (minutes === 0) {
    sleepTimerMinutes = 0;
    showNotification('Sleep Timer', 'Timer cancelled', 'info');
    return;
  }
  
  sleepTimerMinutes = minutes;
  const endTime = Date.now() + (minutes * 60 * 1000);
  
  // Create timer indicator
  const indicator = document.createElement('div');
  indicator.className = 'sleep-timer-active';
  indicator.innerHTML = `
    <i class="fas fa-moon"></i>
    <span id="sleepTimerCountdown">${minutes} min</span>
    <button class="btn btn-small" onclick="setSleepTimer(); document.getElementById('sleepTimerSelect').value='0';" style="padding: 4px 8px;">
      <i class="fas fa-times"></i>
    </button>
  `;
  document.body.appendChild(indicator);
  
  // Update countdown
  const updateCountdown = setInterval(() => {
    const remaining = Math.ceil((endTime - Date.now()) / 1000 / 60);
    const countdownEl = document.getElementById('sleepTimerCountdown');
    if (countdownEl) {
      countdownEl.textContent = remaining + ' min';
    }
  }, 10000);
  
  // Set timeout
  sleepTimerTimeout = setTimeout(() => {
    if (player && isPlaying) {
      // Fade out
      const originalVolume = player.volume;
      let currentVolume = originalVolume;
      const fadeInterval = setInterval(() => {
        currentVolume -= originalVolume / 20;
        if (currentVolume <= 0) {
          clearInterval(fadeInterval);
          player.pause();
          player.volume = originalVolume;
        } else {
          player.volume = currentVolume;
        }
      }, 100);
    }
    
    clearInterval(updateCountdown);
    if (existingIndicator) existingIndicator.remove();
    showNotification('Sleep Timer', 'Music paused', 'info');
  }, minutes * 60 * 1000);
  
  showNotification('Sleep Timer', `Set for ${minutes} minutes`, 'success');
}

// ============================================
// VISUALIZER
// ============================================

function initializeVisualizer() {
  const toggle = document.getElementById('visualizerToggle');
  if (toggle) {
    toggle.checked = visualizerEnabled;
    toggle.onchange = (e) => {
      visualizerEnabled = e.target.checked;
      localStorage.setItem('visualizerEnabled', JSON.stringify(visualizerEnabled));
      toggleVisualizer();
    };
  }
}

function toggleVisualizer() {
  const overlay = document.getElementById('visualizerOverlay');
  if (!overlay) return;
  
  if (visualizerEnabled && isPlaying) {
    overlay.style.display = 'block';
    startVisualizer();
  } else {
    overlay.style.display = 'none';
  }
}

function startVisualizer() {
  initializeAudioContext();
  if (!analyzer) return;
  
  const canvas = document.getElementById('visualizerCanvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  
  const bufferLength = analyzer.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  function draw() {
    if (!visualizerEnabled || !isPlaying) return;
    
    requestAnimationFrame(draw);
    analyzer.getByteFrequencyData(dataArray);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * canvas.height;
      
      const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
      gradient.addColorStop(0, '#2d8659');
      gradient.addColorStop(1, '#3aa66f');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      
      x += barWidth + 1;
    }
  }
  
  draw();
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

function openShortcutsEditor() {
  const modal = document.getElementById('shortcutsModal');
  const list = document.getElementById('shortcutsList');
  
  if (modal && list) {
    modal.style.display = 'flex';
    
    list.innerHTML = Object.entries(keyboardShortcuts).map(([action, key]) => {
      const actionName = action.replace(/([A-Z])/g, ' $1').trim();
      return `
        <div class="shortcut-item">
          <span class="shortcut-action">${actionName.charAt(0).toUpperCase() + actionName.slice(1)}</span>
          <span class="shortcut-key" onclick="editShortcut('${action}')">${key}</span>
        </div>
      `;
    }).join('');
  }
}

function editShortcut(action) {
  showNotification('Press a key', 'Press any key to set shortcut', 'info');
  
  const handler = (e) => {
    e.preventDefault();
    const key = e.code;
    keyboardShortcuts[action] = key;
    localStorage.setItem('keyboardShortcuts', JSON.stringify(keyboardShortcuts));
    openShortcutsEditor(); // Refresh list
    document.removeEventListener('keydown', handler);
  };
  
  document.addEventListener('keydown', handler, { once: true });
}

function resetShortcuts() {
  keyboardShortcuts = { ...DEFAULT_SHORTCUTS };
  localStorage.setItem('keyboardShortcuts', JSON.stringify(keyboardShortcuts));
  openShortcutsEditor();
}

function closeShortcutsModal(event) {
  const modal = document.getElementById('shortcutsModal');
  if (modal && (!event || event.target === modal)) {
    modal.style.display = 'none';
  }
}

// ============================================
// PLAYLIST IMPORT
// ============================================

function openPlaylistImporter() {
  const modal = document.getElementById('playlistImportModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

async function importPlaylistFromURL() {
  const input = document.getElementById('importPlaylistURL');
  if (!input || !input.value) {
    showNotification('Error', 'Please enter a URL', 'error');
    return;
  }
  
  const url = input.value.trim();
  
  try {
    let playlistData = null;
    
    if (url.includes('music.apple.com')) {
      playlistData = await importAppleMusicPlaylist(url);
    } else if (url.endsWith('.m3u') || url.endsWith('.m3u8')) {
      playlistData = await importM3UPlaylist(url);
    } else {
      showNotification('Error', 'Unsupported URL format. Use Spotify, Apple Music, or M3U links.', 'error');
      return;
    }
    
    if (playlistData && playlistData.songs && playlistData.songs.length > 0) {
      playlists.push(playlistData);
      localStorage.setItem('playlists', JSON.stringify(playlists));
      loadPlaylists();
      input.value = ''; // Clear input
      closePlaylistImportModal();
      // Don't show duplicate notification - importSpotifyPlaylist already shows one
    } else if (playlistData === null) {
      // User cancelled or error already shown
      return;
    } else {
      showNotification('Error', 'Playlist is empty or import failed', 'error');
    }
  } catch (error) {
    console.error('Import error:', error);
    showNotification('Error', 'Failed to import: ' + error.message, 'error');
  }
}


async function importAppleMusicPlaylist(url) {
  // Similar to Spotify
  showNotification('Coming Soon', 'Apple Music import requires API setup', 'info');
  return null;
}

async function importM3UPlaylist(url) {
  const response = await fetch(url);
  const text = await response.text();
  
  // Parse M3U
  const lines = text.split('\n');
  const songs = [];
  let currentTitle = '';
  
  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      const match = line.match(/,(.+)$/);
      if (match) currentTitle = match[1];
    } else if (line.trim() && !line.startsWith('#')) {
      songs.push({
        id: Date.now() + Math.random(),
        title: currentTitle || 'Unknown',
        artist: { name: 'Unknown' },
        url: line.trim()
      });
      currentTitle = '';
    }
  }
  
  return {
    id: Date.now(),
    name: 'Imported M3U Playlist',
    description: 'Imported from M3U file',
    songs: songs,
    createdAt: new Date().toISOString()
  };
}

function closePlaylistImportModal(event) {
  const modal = document.getElementById('playlistImportModal');
  if (modal) {
    // Only close if clicking the backdrop or no event (direct call)
    if (!event || event.target === modal) {
      modal.style.display = 'none';
      // Clear the input
      const input = document.getElementById('importPlaylistURL');
      if (input) input.value = '';
    }
  }
}

// ============================================
// SMART PLAYLISTS
// ============================================

async function createSmartPlaylists() {
  // Daily Mix based on listening history
  const listeningHistory = JSON.parse(localStorage.getItem('listeningHistory') || '[]');
  
  if (listeningHistory.length > 10) {
    // Create Daily Mix
    const uniqueTracks = [...new Map(listeningHistory.map(t => [t.id, t])).values()];
    const randomTracks = uniqueTracks.sort(() => 0.5 - Math.random()).slice(0, 30);
    
    const dailyMix = {
      id: 'daily-mix-' + Date.now(),
      name: '🎵 Daily Mix',
      description: 'Based on your listening history',
      songs: randomTracks,
      smart: true,
      createdAt: new Date().toISOString()
    };
    
    // Add or update
    const existing = playlists.findIndex(p => p.name === '🎵 Daily Mix');
    if (existing >= 0) {
      playlists[existing] = dailyMix;
    } else {
      playlists.push(dailyMix);
    }
    
    localStorage.setItem('playlists', JSON.stringify(playlists));
    loadPlaylists();
  }
}

// ============================================
// SHUFFLE HISTORY
// ============================================

function improvedShuffle(playlist) {
  if (playlist.length <= 1) return playlist;
  
  const shuffled = [];
  const available = [...playlist];
  
  // Avoid recently played from history
  const recentlyPlayed = shuffleHistory.slice(-10);
  
  while (available.length > 0) {
    let index;
    let attempts = 0;
    
    do {
      index = Math.floor(Math.random() * available.length);
      attempts++;
    } while (
      attempts < 10 &&
      recentlyPlayed.includes(available[index]?.id) &&
      available.length > recentlyPlayed.length
    );
    
    const track = available.splice(index, 1)[0];
    shuffled.push(track);
    shuffleHistory.push(track.id);
  }
  
  // Keep history reasonable size
  if (shuffleHistory.length > 50) {
    shuffleHistory = shuffleHistory.slice(-50);
  }
  
  localStorage.setItem('shuffleHistory', JSON.stringify(shuffleHistory));
  return shuffled;
}

// ============================================
// EXPORT ENHANCEMENTS
// ============================================

function enhancedExportPlaylist(playlist, format = 'm3u8') {
  if (!playlist || !playlist.songs) return;
  
  if (format === 'm3u8') {
    let content = '#EXTM3U\n\n';
    playlist.songs.forEach(song => {
      content += `#EXTINF:-1,${song.artist?.name || 'Unknown'} - ${song.title}\n`;
      content += (song.url || '#') + '\n\n';
    });
    
    const blob = new Blob([content], { type: 'audio/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${playlist.name}.m3u8`;
    a.click();
    URL.revokeObjectURL(url);
  } else if (format === 'json') {
    const json = JSON.stringify(playlist, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${playlist.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// ============================================
// INITIALIZATION
// ============================================

function initializeNewFeatures() {
  // Initialize crossfade
  initializeCrossfade();
  
  // Initialize visualizer
  initializeVisualizer();
  
  // Load saved EQ gains
  const savedGains = localStorage.getItem('eqGains');
  if (savedGains) {
    eqGains = JSON.parse(savedGains);
  }
  
  // Load queue when section is shown
  if (document.getElementById('queue')) {
    loadQueue();
  }
  
  // Create smart playlists periodically
  setInterval(createSmartPlaylists, 30 * 60 * 1000); // Every 30 minutes
  
  console.log('New features initialized');
}

// Call initialization after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeNewFeatures);
} else {
  initializeNewFeatures();
}

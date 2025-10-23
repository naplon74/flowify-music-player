// Global variables
let currentTrack = null;
let isPlaying = false;
let isShuffled = false;
let repeatMode = 0; // 0: no repeat, 1: repeat all, 2: repeat one
let currentPlaylist = [];
let currentIndex = 0;
let likedSongs = JSON.parse(localStorage.getItem('likedSongs') || '[]');
let playlists = JSON.parse(localStorage.getItem('playlists') || '[]');
let downloads = JSON.parse(localStorage.getItem('downloads') || '[]');
let audioQuality = localStorage.getItem('audioQuality') || 'LOSSLESS';
let currentTheme = localStorage.getItem('theme') || 'dark';
let discordRPCEnabled = JSON.parse(localStorage.getItem('discordRPCEnabled') || 'true');
let navigationHistory = [];
let currentArtistId = null;
let cachedVolume = parseFloat(localStorage.getItem('volume') || '0.3');
let cachedProgress = parseFloat(localStorage.getItem('lastProgress') || '0');

let player = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  // Set theme
  document.body.setAttribute('data-theme', currentTheme);
  updateThemeButtons();
  updateDiscordRPCButtons();
  
  // Initialize audio player
  player = document.getElementById('player');
  if (!player) {
    player = document.createElement('audio');
    player.id = 'player';
    player.style.display = 'none';
    document.body.appendChild(player);
  }
  
  // Add event listeners to player
  player.addEventListener('timeupdate', updateProgress);
  player.addEventListener('ended', nextTrack);
  player.addEventListener('loadedmetadata', updateDuration);
  player.addEventListener('error', handleAudioError);
  player.addEventListener('canplay', handleAudioReady);
  player.addEventListener('volumechange', cacheVolume);
  
  // Set cached volume after a short delay to ensure DOM is ready
  setTimeout(() => {
    player.volume = cachedVolume;
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      volumeSlider.value = cachedVolume * 100;
    }
    console.log('Volume restored to:', cachedVolume);
  }, 100);
  
  // Load saved data
  loadPlaylists();
  loadLikedSongs();
  loadDownloads();
  loadSuggestions();
  
  // Setup event listeners
  setupEventListeners();
  
  // Show search bar by default (search section is active by default)
  const searchBar = document.getElementById('searchBar');
  if (searchBar) searchBar.style.display = 'flex';
  
  // Initialize Discord RPC
  if (window.electronAPI && discordRPCEnabled) {
    console.log('Initializing Discord RPC...');
    window.electronAPI.updateDiscordRPC({
      details: 'Browsing music',
      state: 'In main menu',
      startTimestamp: Date.now()
    });
  } else {
    console.log('Discord RPC not initialized:', !window.electronAPI ? 'No electronAPI' : 'RPC disabled');
  }
  
  // Setup debug console listener
  if (window.electronAPI && window.electronAPI.onDebugLog) {
    window.electronAPI.onDebugLog((event, data) => {
      addDebugLog(data.message, data.type);
    });
  }
  
  // Setup update status listener
  if (window.electronAPI && window.electronAPI.onUpdateStatus) {
    window.electronAPI.onUpdateStatus((event, data) => {
      handleUpdateStatus(data);
    });
  }
});

// Setup all event listeners
function setupEventListeners() {
  // Search on Enter
  const queryInput = document.getElementById('query');
  if (queryInput) {
    queryInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        search();
      }
    });
  }

  // Artist search on Enter
  const artistQueryInput = document.getElementById('artistQuery');
  if (artistQueryInput) {
    artistQueryInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        searchArtist();
      }
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT') return;
    
    switch(e.code) {
      case 'Space':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowRight':
        e.preventDefault();
        nextTrack();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        previousTrack();
        break;
    }
  });

  // Close modal on outside click
  const modal = document.getElementById('createPlaylistModal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        closeCreatePlaylistModal();
      }
    });
  }
}

// Navigation
function showSection(sectionName, skipHistory = false) {
  // Add to history if not skipping (skip when using back button)
  if (!skipHistory && sectionName !== 'artist') {
    navigationHistory.push(sectionName);
    if (navigationHistory.length > 10) navigationHistory.shift(); // Keep last 10
  }
  
  // Hide all sections
  document.querySelectorAll('.section').forEach(section => {
    section.classList.remove('active');
  });
  
  // Remove active class from nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Show selected section
  const targetSection = document.getElementById(sectionName);
  if (targetSection) {
    targetSection.classList.add('active');
  }
  
  // Add active class to clicked nav item
  const navItem = document.querySelector(`[data-section="${sectionName}"]`);
  if (navItem) {
    navItem.classList.add('active');
  }
  
  // Update navbar title
  const navbarTitle = document.getElementById('navbarTitle');
  const navBackBtn = document.getElementById('navBackBtn');
  
  if (sectionName === 'artist') {
    if (navBackBtn) navBackBtn.style.display = 'flex';
  } else {
    if (navBackBtn) navBackBtn.style.display = 'none';
    if (navbarTitle) {
      const titles = {
        search: '<i class="fas fa-music"></i> Flowify',
        playlists: '<i class="fas fa-list"></i> Playlists',
        liked: '<i class="fas fa-heart"></i> Liked Songs',
        downloads: '<i class="fas fa-download"></i> Downloads'
      };
      navbarTitle.innerHTML = titles[sectionName] || '<i class="fas fa-music"></i> Flowify';
    }
  }
  
  // Control header visibility based on section
  const searchBar = document.getElementById('searchBar');
  const playlistControls = document.getElementById('playlistControls');
  
  // Hide all controls first
  if (searchBar) searchBar.style.display = 'none';
  if (playlistControls) playlistControls.style.display = 'none';
  
  // Show controls based on section
  if (sectionName === 'search') {
    if (searchBar) searchBar.style.display = 'flex';
    // Clear search input and results when switching to search tab
    const queryInput = document.getElementById('query');
    if (queryInput) queryInput.value = '';
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) resultsDiv.innerHTML = '';
    const searchResultsTitle = document.getElementById('searchResultsTitle');
    if (searchResultsTitle) searchResultsTitle.style.display = 'none';
    const emptyDiv = document.getElementById('searchEmpty');
    if (emptyDiv) emptyDiv.style.display = 'block';
    const suggestionsSection = document.getElementById('suggestions');
    if (suggestionsSection) suggestionsSection.style.display = 'block';
  } else if (sectionName === 'playlists') {
    if (playlistControls) playlistControls.style.display = 'block';
  }
}

// Back navigation
function goBack() {
  if (navigationHistory.length > 0) {
    const lastSection = navigationHistory.pop();
    showSection(lastSection, true);
  } else {
    showSection('search', true);
  }
}

// Search functionality
async function search() {
  const queryInput = document.getElementById('query');
  if (!queryInput) return;
  
  const query = queryInput.value.trim();
  if (!query) return;
  
  const resultsDiv = document.getElementById('results');
  const emptyDiv = document.getElementById('searchEmpty');
  
  if (!resultsDiv) return;
  
  try {
    console.log('Searching for:', query);
    
    // Show loading state
    resultsDiv.innerHTML = '<div class="empty-state"><h3>🔍 Searching...</h3><p>Finding your music...</p></div>';
    
    const res = await fetch(`https://hifi.401658.xyz/search/?s=${encodeURIComponent(query)}`);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    console.log('Search response:', data);

    resultsDiv.innerHTML = '';

    if (data.items && data.items.length > 0) {
      if (emptyDiv) emptyDiv.style.display = 'none';
      const searchResultsTitle = document.getElementById('searchResultsTitle');
      if (searchResultsTitle) searchResultsTitle.style.display = 'block';
      const suggestionsSection = document.getElementById('suggestions');
      if (suggestionsSection) suggestionsSection.style.display = 'none';
      
      data.items.forEach(item => {
        console.log('Creating card for item:', item);
        const trackCard = createTrackCard(item);
        resultsDiv.appendChild(trackCard);
      });
    } else {
      resultsDiv.innerHTML = '';
      const searchResultsTitle = document.getElementById('searchResultsTitle');
      if (searchResultsTitle) searchResultsTitle.style.display = 'none';
      if (emptyDiv) {
        emptyDiv.innerHTML = '<div class="empty-state"><h3>No results found</h3><p>Try searching for your favorite songs or artists</p></div>';
        emptyDiv.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('Search error:', error);
    resultsDiv.innerHTML = '<div class="empty-state"><h3><i class="fas fa-exclamation-circle"></i> Search failed</h3><p>Please check your internet connection and try again</p></div>';
  }
}

// Create track card
function createTrackCard(item) {
  const div = document.createElement('div');
  div.className = 'track-card';
  
  // Fix image URL format
  let imageUrl = '';
  if (item.album && item.album.cover) {
    imageUrl = `https://resources.tidal.com/images/${item.album.cover.replace(/-/g, '/')}/320x320.jpg`;
  }
  
  const isLiked = likedSongs.some(song => song.id === item.id);
  const isDownloaded = downloads.some(song => song.id === item.id);
  
  div.innerHTML = `
    <img class="track-image" src="${imageUrl}" alt="${item.title}" 
         onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjNDQ0Ii8+PHRleHQgeD0iMTAwIiB5PSIxMDAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmb250LXNpemU9IjE0IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+4pmrPC90ZXh0Pjwvc3ZnPg=='; this.style.backgroundColor='#444';">
    <div class="track-title">${item.title}</div>
    <div class="track-artist" onclick="openArtistPage('${item.artist.name.replace(/'/g, "\\'")}')" style="cursor: pointer; transition: color 0.2s ease;" title="View artist" onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">
      <i class="fas fa-user-music"></i> ${item.artist.name}
    </div>
    <div class="track-actions">
      <button class="btn btn-small" onclick="playTrack(${item.id}, ${JSON.stringify(item).replace(/"/g, '&quot;')})">
        <i class="fas fa-play"></i> Play
      </button>
      <button class="btn btn-small ${isLiked ? 'btn-secondary' : ''}" onclick="toggleLike(${item.id}, ${JSON.stringify(item).replace(/"/g, '&quot;')})" id="like-${item.id}">
        <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
      </button>
      <button class="btn btn-small ${isDownloaded ? 'btn-secondary' : ''}" onclick="downloadTrackOffline(${item.id}, ${JSON.stringify(item).replace(/"/g, '&quot;')})">
        <i class="fas fa-${isDownloaded ? 'check' : 'download'}"></i>
      </button>
      <button class="btn btn-small" onclick="addToPlaylist(${JSON.stringify(item).replace(/"/g, '&quot;')})">
        <i class="fas fa-plus"></i>
      </button>
    </div>
  `;
  
  return div;
}

// Audio error handling
function handleAudioError(e) {
  console.error('Audio error:', e);
  console.error('Error details:', player.error);
  
  let errorMessage = 'Audio playback failed. ';
  
  if (player.error) {
    switch (player.error.code) {
      case 1:
        errorMessage += 'The audio download was aborted.';
        break;
      case 2:
        errorMessage += 'A network error occurred.';
        break;
      case 3:
        errorMessage += 'The audio file appears to be corrupted.';
        break;
      case 4:
        errorMessage += 'The audio format is not supported.';
        break;
      default:
        errorMessage += 'An unknown error occurred.';
    }
  }
  
  alert(errorMessage + ' Please try another song.');
  resetPlayButtons();
}

function handleAudioReady() {
  console.log('Audio ready to play');
  resetPlayButtons();
}

function resetPlayButtons() {
  document.querySelectorAll('button[onclick*="playTrack"]').forEach(btn => {
    if (btn.innerHTML.includes('Loading') || btn.innerHTML.includes('spinner')) {
      btn.innerHTML = '<i class="fas fa-play"></i> Play';
      btn.disabled = false;
    }
  });
}

// Play track
async function playTrack(id, trackData) {
  try {
    // Show loading state
    const playButtons = document.querySelectorAll(`button[onclick*="playTrack(${id}"]`);
    playButtons.forEach(btn => {
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
      btn.disabled = true;
    });
    
    console.log('Fetching track data for ID:', id);
    const res = await fetch(`https://hifi.401658.xyz/track/?id=${id}&quality=${audioQuality}`);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    console.log('Track response:', data);
    
    const trackUrl = data.find(obj => obj.OriginalTrackUrl)?.OriginalTrackUrl;
    console.log('Track URL:', trackUrl);

    if (trackUrl) {
      currentTrack = { ...trackData, url: trackUrl };
      
      // Stop current playback
      player.pause();
      player.currentTime = 0;
      
      // Set new source
      player.src = trackUrl;
      player.load();
      
      // Try to play
      try {
        await player.play();
        isPlaying = true;
        console.log('Audio playing successfully');
        
        updateNowPlaying();
        updatePlayButton();
        
        // Update currentPlaylist and index
        if (currentPlaylist.length === 0) {
          // No playlist context, create one with just this track
          currentPlaylist = [currentTrack];
          currentIndex = 0;
        } else {
          // Update index to match current track in playlist
          const trackIndex = currentPlaylist.findIndex(t => t.id === currentTrack.id);
          if (trackIndex !== -1) {
            currentIndex = trackIndex;
          }
        }
        
        // Reset button states
        playButtons.forEach(btn => {
          btn.innerHTML = '▶️ Play';
          btn.disabled = false;
        });
        
      } catch (playError) {
        console.error('Play error:', playError);
        
        // Reset button states
        playButtons.forEach(btn => {
          btn.innerHTML = '▶️ Play';
          btn.disabled = false;
        });
        
        throw playError;
      }
    } else {
      console.error('No stream URL found in response');
      alert('Stream URL not found for this track.');
      
      // Reset button states
      playButtons.forEach(btn => {
        btn.innerHTML = '▶️ Play';
        btn.disabled = false;
      });
    }
  } catch (error) {
    console.error('Fetch/Play error:', error);
    alert('Failed to play track. Please check your internet connection and try again.');
    
    // Reset button states
    const playButtons = document.querySelectorAll(`button[onclick*="playTrack(${id}"]`);
    playButtons.forEach(btn => {
      btn.innerHTML = '▶️ Play';
      btn.disabled = false;
    });
  }
}

// Player controls
function togglePlay() {
  if (!currentTrack || !player) return;
  
  if (isPlaying) {
    player.pause();
    isPlaying = false;
  } else {
    player.play().catch(error => {
      console.error('Play error:', error);
      alert('Failed to resume playback.');
    });
    isPlaying = true;
  }
  updatePlayButton();
  updateDiscordPresence();
}

function nextTrack() {
  if (currentPlaylist.length === 0) return;
  
  if (repeatMode === 2) {
    // Repeat current track
    player.currentTime = 0;
    player.play();
    return;
  }
  
  if (isShuffled) {
    currentIndex = Math.floor(Math.random() * currentPlaylist.length);
  } else {
    currentIndex = (currentIndex + 1) % currentPlaylist.length;
  }
  
  const nextTrack = currentPlaylist[currentIndex];
  if (nextTrack) {
    playTrack(nextTrack.id, nextTrack);
  }
}

function previousTrack() {
  if (currentPlaylist.length === 0) return;
  
  if (isShuffled) {
    currentIndex = Math.floor(Math.random() * currentPlaylist.length);
  } else {
    currentIndex = currentIndex > 0 ? currentIndex - 1 : currentPlaylist.length - 1;
  }
  
  const prevTrack = currentPlaylist[currentIndex];
  if (prevTrack) {
    playTrack(prevTrack.id, prevTrack);
  }
}

function toggleShuffle() {
  isShuffled = !isShuffled;
  const shuffleBtn = document.getElementById('shuffleBtn');
  const shuffleControlBtn = document.getElementById('shuffleControlBtn');
  
  const activeStyle = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  const inactiveStyle = 'rgba(255, 255, 255, 0.08)';
  
  if (isShuffled) {
    if (shuffleBtn) shuffleBtn.style.background = activeStyle;
    if (shuffleControlBtn) shuffleControlBtn.style.background = 'rgba(102, 126, 234, 0.3)';
  } else {
    if (shuffleBtn) shuffleBtn.style.background = inactiveStyle;
    if (shuffleControlBtn) shuffleControlBtn.style.background = inactiveStyle;
  }
}

function toggleRepeat() {
  repeatMode = (repeatMode + 1) % 3;
  const repeatBtn = document.getElementById('repeatBtn');
  
  if (repeatBtn) {
    const icon = repeatBtn.querySelector('i');
    switch(repeatMode) {
      case 0:
        if (icon) icon.className = 'fas fa-redo';
        repeatBtn.style.background = 'rgba(255, 255, 255, 0.08)';
        break;
      case 1:
        if (icon) icon.className = 'fas fa-redo';
        repeatBtn.style.background = 'rgba(102, 126, 234, 0.3)';
        break;
      case 2:
        if (icon) icon.className = 'fas fa-redo-alt';
        repeatBtn.style.background = 'rgba(102, 126, 234, 0.3)';
        break;
    }
  }
}

// Update UI elements
function updateNowPlaying() {
  if (!currentTrack) return;
  
  const titleEl = document.getElementById('currentTitle');
  const artistEl = document.getElementById('currentArtist');
  const imageEl = document.getElementById('currentImage');
  const likeIcon = document.getElementById('currentLikeIcon');
  
  if (titleEl) titleEl.textContent = currentTrack.title;
  if (artistEl) artistEl.textContent = currentTrack.artist.name;
  
  // Update like button state
  if (likeIcon) {
    const isLiked = likedSongs.some(song => song.id === currentTrack.id);
    likeIcon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
  }
  
  // Update download button state
  const downloadIcon = document.getElementById('currentDownloadIcon');
  if (downloadIcon) {
    const isDownloaded = downloads.some(song => song.id === currentTrack.id);
    downloadIcon.className = isDownloaded ? 'fas fa-check' : 'fas fa-download';
  }
  
  if (imageEl && currentTrack.album && currentTrack.album.cover) {
    const imageUrl = `https://resources.tidal.com/images/${currentTrack.album.cover.replace(/-/g, '/')}/320x320.jpg`;
    imageEl.src = imageUrl;
    imageEl.style.display = 'block';
    imageEl.onerror = function() {
      this.onerror = null;
      this.style.display = 'none';
    };
    
    if (isPlaying) {
      imageEl.classList.add('playing-animation');
    } else {
      imageEl.classList.remove('playing-animation');
    }
  }
  
  // Update Discord RPC
  updateDiscordPresence();
}

function updateDiscordPresence() {
  if (!window.electronAPI || !discordRPCEnabled) return;
  
  if (currentTrack && isPlaying) {
    window.electronAPI.updateDiscordRPC({
      details: currentTrack.title,
      state: `by ${currentTrack.artist.name}`,
      startTimestamp: Date.now()
    });
  } else if (currentTrack) {
    window.electronAPI.updateDiscordRPC({
      details: currentTrack.title,
      state: `by ${currentTrack.artist.name} (Paused)`
    });
  } else {
    window.electronAPI.updateDiscordRPC({
      details: 'Browsing music',
      state: 'In main menu'
    });
  }
}

function likeCurrentTrack() {
  if (!currentTrack) return;
  
  const index = likedSongs.findIndex(song => song.id === currentTrack.id);
  const likeIcon = document.getElementById('currentLikeIcon');
  
  if (index === -1) {
    // Add to liked songs
    likedSongs.push(currentTrack);
    if (likeIcon) {
      likeIcon.className = 'fas fa-heart';
    }
  } else {
    // Remove from liked songs
    likedSongs.splice(index, 1);
    if (likeIcon) {
      likeIcon.className = 'far fa-heart';
    }
  }
  
  localStorage.setItem('likedSongs', JSON.stringify(likedSongs));
  loadLikedSongs();
  loadSuggestions(); // Reload suggestions when liked songs change
  
  // Update any visible like buttons for this track
  const likeBtn = document.getElementById(`like-${currentTrack.id}`);
  if (likeBtn) {
    const isLiked = likedSongs.some(song => song.id === currentTrack.id);
    const icon = likeBtn.querySelector('i');
    if (icon) {
      icon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
    }
    if (isLiked) {
      likeBtn.classList.add('btn-secondary');
    } else {
      likeBtn.classList.remove('btn-secondary');
    }
  }
}

function downloadCurrentTrack() {
  if (!currentTrack) return;
  downloadTrackOffline(currentTrack.id, currentTrack);
}

function updatePlayButton() {
  const playBtn = document.getElementById('playBtn');
  if (playBtn) {
    const icon = playBtn.querySelector('i');
    if (icon) {
      icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
    }
  }
}

function updateProgress() {
  if (!player || !player.duration) return;
  
  const progress = (player.currentTime / player.duration) * 100;
  const progressBar = document.getElementById('progressBar');
  if (progressBar) {
    progressBar.style.width = progress + '%';
  }
  
  const currentTimeEl = document.getElementById('currentTime');
  if (currentTimeEl) {
    currentTimeEl.textContent = formatTime(player.currentTime);
  }
  
  // Cache progress every 5 seconds
  if (Math.floor(player.currentTime) % 5 === 0) {
    localStorage.setItem('lastProgress', player.currentTime.toString());
  }
}

function cacheVolume() {
  if (player) {
    localStorage.setItem('volume', player.volume.toString());
  }
}

function updateDuration() {
  const totalTimeEl = document.getElementById('totalTime');
  if (totalTimeEl && player && player.duration) {
    totalTimeEl.textContent = formatTime(player.duration);
  }
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function seekTo(event) {
  if (!player || !player.duration) return;
  
  const progressContainer = event.currentTarget;
  const clickX = event.offsetX;
  const width = progressContainer.offsetWidth;
  const percentage = clickX / width;
  
  player.currentTime = percentage * player.duration;
}

function setVolume(value) {
  if (player) {
    player.volume = value / 100;
  }
}

// Like functionality
function toggleLike(id, trackData) {
  const index = likedSongs.findIndex(song => song.id === id);
  const likeBtn = document.getElementById(`like-${id}`);
  
  if (index === -1) {
    likedSongs.push(trackData);
    if (likeBtn) {
      const icon = likeBtn.querySelector('i');
      if (icon) icon.className = 'fas fa-heart';
      likeBtn.classList.add('btn-secondary');
    }
  } else {
    likedSongs.splice(index, 1);
    if (likeBtn) {
      const icon = likeBtn.querySelector('i');
      if (icon) icon.className = 'far fa-heart';
      likeBtn.classList.remove('btn-secondary');
    }
  }
  
  localStorage.setItem('likedSongs', JSON.stringify(likedSongs));
  loadLikedSongs();
}

function loadLikedSongs() {
  const container = document.getElementById('likedSongs');
  const emptyDiv = document.getElementById('likedEmpty');
  
  if (!container) return;
  
  container.innerHTML = '';
  
  if (likedSongs.length === 0) {
    if (emptyDiv) emptyDiv.style.display = 'block';
    return;
  }
  
  if (emptyDiv) emptyDiv.style.display = 'none';
  
  likedSongs.forEach((song, index) => {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    
    let imageUrl = '';
    if (song.album && song.album.cover) {
      imageUrl = `https://resources.tidal.com/images/${song.album.cover.replace(/-/g, '/')}/320x320.jpg`;
    }
    
    const isDownloaded = downloads.some(d => d.id === song.id);
    
    item.innerHTML = `
      <div class="playlist-number">${index + 1}</div>
      <img src="${imageUrl}" width="40" height="40" style="border-radius: 4px; background: #444;" 
           onerror="this.style.display='none';" alt="">
      <div class="playlist-info">
        <div class="playlist-title">${song.title}</div>
        <div class="playlist-artist">${song.artist.name}</div>
      </div>
      <button class="btn btn-small" onclick="playFromLikedSongs(${index})">
        <i class="fas fa-play"></i>
      </button>
      <button class="btn btn-small btn-secondary" onclick="toggleLike(${song.id}, ${JSON.stringify(song).replace(/"/g, '&quot;')})">
        <i class="fas fa-heart"></i>
      </button>
      <button class="btn btn-small" title="Add to playlist" onclick="addToPlaylist(${JSON.stringify(song).replace(/"/g, '&quot;')})">
        <i class="fas fa-plus"></i>
      </button>
      <button class="btn btn-small ${isDownloaded ? 'btn-secondary' : ''}" onclick="downloadTrackOffline(${song.id}, ${JSON.stringify(song).replace(/"/g, '&quot;')})">
        <i class="fas fa-${isDownloaded ? 'check' : 'download'}"></i>
      </button>
    `;
    container.appendChild(item);
  });
}

// Play from liked songs
function playFromLikedSongs(index) {
  if (likedSongs.length === 0) return;
  
  // Set the current playlist to all liked songs
  currentPlaylist = [...likedSongs];
  currentIndex = index;
  
  const track = likedSongs[index];
  playTrack(track.id, track);
}

// Download functionality
async function downloadTrack(id, trackData) {
  try {
    const res = await fetch(`https://hifi.401658.xyz/track/?id=${id}&quality=LOSSLESS`);
    const data = await res.json();
    const trackUrl = data.find(obj => obj.OriginalTrackUrl)?.OriginalTrackUrl;

    if (trackUrl) {
      // Create download link
      const link = document.createElement('a');
      link.href = trackUrl;
      link.download = `${trackData.artist.name} - ${trackData.title}.mp3`;
      link.click();
      
      // Add to downloads list
      if (!downloads.some(song => song.id === id)) {
        downloads.push({ ...trackData, downloadedAt: new Date().toISOString() });
        localStorage.setItem('downloads', JSON.stringify(downloads));
        loadDownloads();
      }
    } else {
      alert('Download URL not found.');
    }
  } catch (error) {
    console.error('Download error:', error);
    alert('Failed to download track. Please try again.');
  }
}

function loadDownloads() {
  const container = document.getElementById('downloadsList');
  const emptyDiv = document.getElementById('downloadsEmpty');
  
  if (!container) return;
  
  container.innerHTML = '';
  
  if (downloads.length === 0) {
    if (emptyDiv) emptyDiv.style.display = 'block';
    return;
  }
  
  if (emptyDiv) emptyDiv.style.display = 'none';
  
  downloads.forEach((song, index) => {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    
    let imageUrl = '';
    if (song.album && song.album.cover) {
      imageUrl = `https://resources.tidal.com/images/${song.album.cover.replace(/-/g, '/')}/320x320.jpg`;
    }
    
    item.innerHTML = `
      <div class="playlist-number">${index + 1}</div>
      <img src="${imageUrl}" width="40" height="40" style="border-radius: 4px; background: #444;" 
           onerror="this.style.display='none';" alt="">
      <div class="playlist-info">
        <div class="playlist-title">${song.title}</div>
        <div class="playlist-artist">${song.artist.name}</div>
      </div>
      <div class="playlist-duration">${new Date(song.downloadedAt).toLocaleDateString()}</div>
      <button class="btn btn-small" onclick="playFromDownloads(${index})">
        <i class="fas fa-play"></i>
      </button>
    `;
    container.appendChild(item);
  });
}

// Play from downloads
function playFromDownloads(index) {
  if (downloads.length === 0) return;
  
  // Set the current playlist to all downloads
  currentPlaylist = [...downloads];
  currentIndex = index;
  
  const track = downloads[index];
  playTrack(track.id, track);
}

// Load suggestions based on liked songs
async function loadSuggestions() {
  const suggestionsSection = document.getElementById('suggestions');
  const suggestionsGrid = document.getElementById('suggestionsGrid');
  
  if (!suggestionsSection || !suggestionsGrid) return;
  
  // Only show suggestions if user has liked songs
  if (likedSongs.length === 0) {
    suggestionsSection.style.display = 'none';
    return;
  }
  
  try {
    suggestionsSection.style.display = 'block';
    suggestionsGrid.innerHTML = '<div class="empty-state"><h3><i class="fas fa-spinner loading-spinner"></i> Loading recommendations...</h3></div>';
    
    // Get random liked artist to base suggestions on
    const randomLiked = likedSongs[Math.floor(Math.random() * likedSongs.length)];
    const artistName = randomLiked.artist.name;
    
    // Search for similar songs by the same artist
    const res = await fetch(`https://hifi.401658.xyz/search/?s=${encodeURIComponent(artistName)}`);
    const data = await res.json();
    
    if (data.items && data.items.length > 0) {
      suggestionsGrid.innerHTML = '';
      
      // Filter out already liked songs and limit to 6 suggestions
      const suggestions = data.items
        .filter(item => !likedSongs.some(song => song.id === item.id))
        .slice(0, 6);
      
      if (suggestions.length > 0) {
        suggestions.forEach(item => {
          const trackCard = createTrackCard(item);
          suggestionsGrid.appendChild(trackCard);
        });
      } else {
        suggestionsSection.style.display = 'none';
      }
    } else {
      suggestionsSection.style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to load suggestions:', error);
    suggestionsSection.style.display = 'none';
  }
}

// Playlist functionality
function showCreatePlaylistModal() {
  const modal = document.getElementById('createPlaylistModal');
  const nameInput = document.getElementById('playlistName');
  
  if (modal) modal.style.display = 'block';
  if (nameInput) nameInput.focus();
}

function closeCreatePlaylistModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById('createPlaylistModal');
  const nameInput = document.getElementById('playlistName');
  const descInput = document.getElementById('playlistDescription');
  
  if (modal) modal.style.display = 'none';
  if (nameInput) nameInput.value = '';
  if (descInput) descInput.value = '';
}

function createPlaylist() {
  const nameInput = document.getElementById('playlistName');
  const descInput = document.getElementById('playlistDescription');
  
  if (!nameInput) return;
  
  const name = nameInput.value.trim();
  const description = descInput ? descInput.value.trim() : '';
  
  if (!name) {
    alert('Please enter a playlist name');
    return;
  }
  
  const playlist = {
    id: Date.now(),
    name,
    description,
    songs: [],
    createdAt: new Date().toISOString()
  };
  
  playlists.push(playlist);
  localStorage.setItem('playlists', JSON.stringify(playlists));
  loadPlaylists();
  closeCreatePlaylistModal();
}

function loadPlaylists() {
  const container = document.getElementById('playlistsList');
  const emptyDiv = document.getElementById('playlistsEmpty');
  
  if (!container) return;
  
  container.innerHTML = '';
  
  if (playlists.length === 0) {
    if (emptyDiv) emptyDiv.style.display = 'block';
    return;
  }
  
  if (emptyDiv) emptyDiv.style.display = 'none';
  
  playlists.forEach(playlist => {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.innerHTML = `
      <div class="playlist-number"><i class="fas fa-list"></i></div>
      <div class="playlist-info" onclick="viewPlaylist(${playlist.id})" style="cursor: pointer; flex: 1;">
        <div class="playlist-title">${playlist.name}</div>
        <div class="playlist-artist">${playlist.songs.length} songs • ${playlist.description || 'No description'}</div>
      </div>
      <button class="btn btn-small" onclick="playPlaylist(${playlist.id})">
        <i class="fas fa-play"></i> Play
      </button>
      <button class="btn btn-small btn-secondary" onclick="deletePlaylist(${playlist.id})">
        <i class="fas fa-trash"></i>
      </button>
    `;
    container.appendChild(item);
  });
}

function addToPlaylist(trackData) {
  // Store track data temporarily
  window.tempTrackToAdd = trackData;
  
  // Show modal with playlist selection
  const modal = document.getElementById('addToPlaylistModal');
  const listContainer = document.getElementById('playlistSelectionList');
  
  if (!modal || !listContainer) return;
  
  listContainer.innerHTML = '';
  
  if (playlists.length === 0) {
    listContainer.innerHTML = '<div class="empty-state"><p>No playlists yet. Create one below!</p></div>';
  } else {
    playlists.forEach(playlist => {
      const item = document.createElement('div');
      item.className = 'playlist-selection-item';
      item.onclick = () => addTrackToPlaylist(playlist.id);
      item.innerHTML = `
        <i class="fas fa-list"></i>
        <div class="playlist-selection-info">
          <h4>${playlist.name}</h4>
          <p>${playlist.songs.length} songs</p>
        </div>
      `;
      listContainer.appendChild(item);
    });
  }
  
  modal.style.display = 'flex';
}

function addTrackToPlaylist(playlistId) {
  const playlist = playlists.find(p => p.id === playlistId);
  const trackData = window.tempTrackToAdd;
  
  if (!playlist || !trackData) return;
  
  if (!playlist.songs.some(song => song.id === trackData.id)) {
    playlist.songs.push(trackData);
    localStorage.setItem('playlists', JSON.stringify(playlists));
    loadPlaylists(); // Refresh the playlist view to update song count
    closeAddToPlaylistModal();
    
    // Show success message
    const successMsg = document.createElement('div');
    successMsg.textContent = `Added to "${playlist.name}"`;
    successMsg.style.cssText = 'position: fixed; top: 80px; right: 20px; background: var(--accent-green); color: white; padding: 15px 20px; border-radius: 8px; z-index: 3000; animation: fadeIn 0.3s ease;';
    document.body.appendChild(successMsg);
    setTimeout(() => successMsg.remove(), 2000);
  } else {
    alert('Song already in playlist');
  }
}

function closeAddToPlaylistModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById('addToPlaylistModal');
  if (modal) modal.style.display = 'none';
  window.tempTrackToAdd = null;
}

function showCreatePlaylistFromAdd() {
  closeAddToPlaylistModal();
  showCreatePlaylistModal();
}

let currentViewingPlaylist = null;

function viewPlaylist(playlistId) {
  const playlist = playlists.find(p => p.id === playlistId);
  if (!playlist) return;
  
  currentViewingPlaylist = playlistId;
  
  // Update header info
  document.getElementById('playlistDetailName').textContent = playlist.name;
  document.getElementById('playlistDetailDesc').textContent = playlist.description || 'No description';
  document.getElementById('playlistDetailCount').textContent = `${playlist.songs.length} song${playlist.songs.length !== 1 ? 's' : ''}`;
  
  // Display tracks
  const tracksContainer = document.getElementById('playlistDetailTracks');
  tracksContainer.innerHTML = '';
  
  if (playlist.songs.length === 0) {
    tracksContainer.innerHTML = '<div class="empty-state"><h3>No songs in this playlist</h3><p>Add songs to get started</p></div>';
  } else {
    playlist.songs.forEach((track, index) => {
      const row = createPlaylistRow(track, index, playlistId);
      tracksContainer.appendChild(row);
    });
  }
  
  // Navigate to playlist detail section
  showSection('playlist-detail');
}

function removeFromPlaylist(playlistId, trackId) {
  const playlist = playlists.find(p => p.id === playlistId);
  if (!playlist) return;
  
  playlist.songs = playlist.songs.filter(song => song.id !== trackId);
  localStorage.setItem('playlists', JSON.stringify(playlists));
  loadPlaylists(); // Update the playlist count in the main view
  
  // Refresh the view
  viewPlaylist(playlistId);
}

function playCurrentPlaylistView() {
  if (currentViewingPlaylist) {
    playPlaylist(currentViewingPlaylist);
  }
}

function deleteCurrentPlaylist() {
  if (currentViewingPlaylist && confirm('Are you sure you want to delete this playlist?')) {
    deletePlaylist(currentViewingPlaylist);
    showSection('playlists');
  }
}

function backToPlaylists() {
  showSection('playlists');
  currentViewingPlaylist = null;
}

// Edit playlist: show modal pre-filled with current values
function showEditPlaylistModal() {
  if (!currentViewingPlaylist) return;
  const playlist = playlists.find(p => p.id === currentViewingPlaylist);
  if (!playlist) return;
  const modal = document.getElementById('editPlaylistModal');
  const nameInput = document.getElementById('editPlaylistName');
  const descInput = document.getElementById('editPlaylistDescription');
  if (nameInput) nameInput.value = playlist.name || '';
  if (descInput) descInput.value = playlist.description || '';
  if (modal) modal.style.display = 'flex';
}

function closeEditPlaylistModal(event) {
  const modal = document.getElementById('editPlaylistModal');
  if (!modal) return;
  if (!event || event.target === modal) {
    modal.style.display = 'none';
  }
}

function applyEditPlaylist() {
  if (!currentViewingPlaylist) return;
  const playlist = playlists.find(p => p.id === currentViewingPlaylist);
  if (!playlist) return;
  const nameInput = document.getElementById('editPlaylistName');
  const descInput = document.getElementById('editPlaylistDescription');
  const newName = (nameInput?.value || '').trim();
  const newDesc = (descInput?.value || '').trim();
  if (newName.length === 0) {
    alert('Please enter a playlist name.');
    return;
  }
  playlist.name = newName;
  playlist.description = newDesc;
  localStorage.setItem('playlists', JSON.stringify(playlists));
  // Update header immediately
  const nameEl = document.getElementById('playlistDetailName');
  const descEl = document.getElementById('playlistDetailDesc');
  if (nameEl) nameEl.textContent = playlist.name;
  if (descEl) descEl.textContent = playlist.description || 'No description';
  closeEditPlaylistModal();
  // Refresh list counts if needed
  loadPlaylists();
}

function playPlaylist(playlistId) {
  const playlist = playlists.find(p => p.id === playlistId);
  if (!playlist || playlist.songs.length === 0) {
    alert('Playlist is empty');
    return;
  }
  
  currentPlaylist = [...playlist.songs];
  currentIndex = 0;
  
  const firstTrack = currentPlaylist[0];
  playTrack(firstTrack.id, firstTrack);
}

function deletePlaylist(playlistId) {
  if (confirm('Are you sure you want to delete this playlist?')) {
    playlists = playlists.filter(p => p.id !== playlistId);
    localStorage.setItem('playlists', JSON.stringify(playlists));
    loadPlaylists();
  }
}

// Theme functions
function setTheme(theme) {
  currentTheme = theme;
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  updateThemeButtons();
}

function updateThemeButtons() {
  document.querySelectorAll('.theme-btn[data-theme]').forEach(btn => {
    if (btn.getAttribute('data-theme') === currentTheme) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Discord RPC toggle
function toggleDiscordRPC(enabled) {
  discordRPCEnabled = enabled;
  localStorage.setItem('discordRPCEnabled', JSON.stringify(enabled));
  updateDiscordRPCButtons();
  
  console.log('Discord RPC toggled:', enabled);
  
  if (window.electronAPI) {
    if (enabled) {
      // Update with current state
      if (currentTrack && isPlaying) {
        window.electronAPI.updateDiscordRPC({
          details: currentTrack.title,
          state: `by ${currentTrack.artist.name}`,
          startTimestamp: Date.now()
        });
      } else if (currentTrack) {
        window.electronAPI.updateDiscordRPC({
          details: currentTrack.title,
          state: `by ${currentTrack.artist.name} (Paused)`
        });
      } else {
        window.electronAPI.updateDiscordRPC({
          details: 'Browsing music',
          state: 'In main menu',
          startTimestamp: Date.now()
        });
      }
    } else {
      // Set Discord RPC to idle state
      window.electronAPI.updateDiscordRPC({
        details: 'Browsing music',
        state: 'Idle in main menu'
      });
    }
  }
}

function updateDiscordRPCButtons() {
  document.querySelectorAll('.theme-btn[data-rpc]').forEach(btn => {
    const isOn = btn.getAttribute('data-rpc') === 'on';
    if (isOn === discordRPCEnabled) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Quality settings
function updateQuality(quality) {
  audioQuality = quality;
  localStorage.setItem('audioQuality', quality);
}

// Clear downloads
function clearDownloads() {
  if (confirm('Are you sure you want to clear all downloads?')) {
    downloads = [];
    localStorage.setItem('downloads', JSON.stringify(downloads));
    loadDownloads();
  }
}

// Settings modal functions
function showSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeSettingsModal(event) {
  const modal = document.getElementById('settingsModal');
  if (modal && (!event || event.target === modal)) {
    modal.style.display = 'none';
  }
}

// Window control functions
function minimizeWindow() {
  if (window.electronAPI && window.electronAPI.minimizeWindow) {
    window.electronAPI.minimizeWindow();
  }
}

function maximizeWindow() {
  if (window.electronAPI && window.electronAPI.maximizeWindow) {
    window.electronAPI.maximizeWindow();
  }
}

function closeWindow() {
  if (window.electronAPI && window.electronAPI.closeWindow) {
    window.electronAPI.closeWindow();
  }
}

// Offline download function
async function downloadTrackOffline(id, trackData) {
  try {
    const res = await fetch(`https://hifi.401658.xyz/track/?id=${id}&quality=${audioQuality}`);
    const data = await res.json();
    const trackUrl = data.find(obj => obj.OriginalTrackUrl)?.OriginalTrackUrl;

    if (trackUrl && window.electronAPI) {
      // Show downloading status
      const downloadBtn = document.querySelector(`button[onclick*="downloadTrackOffline(${id}"]`);
      if (downloadBtn) {
        const icon = downloadBtn.querySelector('i');
        if (icon) icon.className = 'fas fa-spinner fa-spin';
        downloadBtn.disabled = true;
      }
      
      // Download to app directory
      const filename = `${trackData.artist.name.replace(/[/\\?%*:|"<>]/g, '-')} - ${trackData.title.replace(/[/\\?%*:|"<>]/g, '-')}.mp3`;
      const filePath = await window.electronAPI.downloadFile(trackUrl, filename);
      
      // Add to downloads list
      if (!downloads.some(song => song.id === id)) {
        downloads.push({ 
          ...trackData, 
          downloadedAt: new Date().toISOString(),
          filePath: filePath
        });
        localStorage.setItem('downloads', JSON.stringify(downloads));
        loadDownloads();
      }
      
      // Update button
      if (downloadBtn) {
        downloadBtn.classList.add('btn-secondary');
        const icon = downloadBtn.querySelector('i');
        if (icon) icon.className = 'fas fa-check';
        downloadBtn.disabled = false;
      }
      
      // Update current download button in player if this is the current track
      if (currentTrack && currentTrack.id === id) {
        const currentDownloadIcon = document.getElementById('currentDownloadIcon');
        if (currentDownloadIcon) {
          currentDownloadIcon.className = 'fas fa-check';
        }
      }
      
      console.log('Downloaded to:', filePath);
    } else {
      alert('Download failed. Please try again.');
    }
  } catch (error) {
    console.error('Download error:', error);
    alert('Failed to download track. Please try again.');
    
    // Reset button
    const downloadBtn = document.querySelector(`button[onclick*="downloadTrackOffline(${id}"]`);
    if (downloadBtn) {
      const icon = downloadBtn.querySelector('i');
      if (icon) icon.className = 'fas fa-download';
      downloadBtn.disabled = false;
    }
  }
}

// Artist search functions
async function searchArtist(artistName) {
  const artistHeader = document.getElementById('artistHeader');
  const artistTracks = document.getElementById('artistTracks');
  const navbarTitle = document.getElementById('navbarTitle');
  
  try {
    if (artistTracks) artistTracks.innerHTML = '<div class="empty-state"><h3><i class="fas fa-spinner fa-spin"></i> Loading...</h3></div>';
    
    // Search for artist
    const searchRes = await fetch(`https://hifi.401658.xyz/search/?s=${encodeURIComponent(artistName)}`);
    const searchData = await searchRes.json();
    
    if (searchData.items && searchData.items.length > 0) {
      // Filter tracks by exact artist name match (case-insensitive)
      const filteredTracks = searchData.items.filter(item => 
        item.artist.name.toLowerCase() === artistName.toLowerCase()
      );
      
      if (filteredTracks.length === 0) {
        // If no exact match, try to find tracks by the artist
        const partialMatch = searchData.items.filter(item => 
          item.artist.name.toLowerCase().includes(artistName.toLowerCase())
        );
        
        if (partialMatch.length === 0) {
          if (artistTracks) {
            artistTracks.innerHTML = '<div class="empty-state"><h3>Artist not found</h3><p>Try searching for a different artist</p></div>';
          }
          return;
        }
        
        filteredTracks.push(...partialMatch);
      }
      
      const firstTrack = filteredTracks[0];
      const displayArtistName = firstTrack.artist.name;
      currentArtistId = firstTrack.artist.id;
      
      // Get artist image from album cover
      let artistImageUrl = '';
      if (firstTrack.album && firstTrack.album.cover) {
        artistImageUrl = `https://resources.tidal.com/images/${firstTrack.album.cover.replace(/-/g, '/')}/640x640.jpg`;
      }
      
      // Update artist header
      if (artistHeader) {
        const artistImageEl = document.getElementById('artistImage');
        if (artistImageEl) {
          artistImageEl.src = artistImageUrl;
          artistImageEl.alt = displayArtistName;
          artistImageEl.onerror = function() {
            this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjNDQ0Ii8+PHRleHQgeD0iMTAwIiB5PSIxMDAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmb250LXNpemU9IjYwIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+4pmrPC90ZXh0Pjwvc3ZnPg==';
          };
        }
        document.getElementById('artistName').textContent = displayArtistName;
        document.getElementById('artistBio').textContent = `Top tracks by ${displayArtistName}`;
        artistHeader.style.display = 'flex';
      }
      
      // Update navbar title
      if (navbarTitle) {
        navbarTitle.innerHTML = `<i class="fas fa-user-music"></i> ${displayArtistName}`;
      }
      
      displayArtistTracks(filteredTracks);
    } else {
      if (artistTracks) {
        artistTracks.innerHTML = '<div class="empty-state"><h3>Artist not found</h3><p>Try searching for a different artist</p></div>';
      }
    }
  } catch (error) {
    console.error('Artist search error:', error);
    if (artistTracks) {
      artistTracks.innerHTML = '<div class="empty-state"><h3>Search failed</h3><p>Please try again</p></div>';
    }
  }
}

function openArtistPage(artistName) {
  // Add current section to history before navigating to artist
  const currentSection = document.querySelector('.section.active')?.id || 'search';
  if (currentSection !== 'artist') {
    navigationHistory.push(currentSection);
  }
  
  // Switch to artist section
  showSection('artist', true); // Skip adding to history since we did it manually
  
  // Search for artist
  searchArtist(artistName);
}

function displayArtistTracks(tracks) {
  const container = document.getElementById('artistTracks');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (tracks.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>No tracks found</h3></div>';
    return;
  }
  
  tracks.forEach(track => {
    const trackCard = createTrackCard(track);
    container.appendChild(trackCard);
  });
}

// Debug Console Functions
function addDebugLog(message, type = 'info') {
  const debugConsole = document.getElementById('debugConsole');
  if (!debugConsole) return;
  
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  
  const time = new Date().toLocaleTimeString();
  const timeSpan = document.createElement('span');
  timeSpan.className = 'log-time';
  timeSpan.textContent = `[${time}]`;
  
  const messageSpan = document.createElement('span');
  messageSpan.className = `log-${type}`;
  messageSpan.textContent = message;
  
  logEntry.appendChild(timeSpan);
  logEntry.appendChild(messageSpan);
  debugConsole.appendChild(logEntry);
  
  // Auto-scroll to bottom
  debugConsole.scrollTop = debugConsole.scrollHeight;
  
  // Limit to last 100 entries
  const entries = debugConsole.querySelectorAll('.log-entry');
  if (entries.length > 100) {
    entries[0].remove();
  }
}

function clearDebugConsole() {
  const debugConsole = document.getElementById('debugConsole');
  if (debugConsole) {
    debugConsole.innerHTML = '';
    addDebugLog('Console cleared', 'info');
  }
}

// Update Functions
function checkForUpdates() {
  if (window.electronAPI && window.electronAPI.checkForUpdates) {
    window.electronAPI.checkForUpdates();
    const updateInfo = document.getElementById('updateInfo');
    if (updateInfo) {
      updateInfo.innerHTML = '<p style="color: var(--accent-green);"><i class="fas fa-spinner fa-spin"></i> Checking for updates...</p>';
    }
  }
}

function handleUpdateStatus(data) {
  const updateInfo = document.getElementById('updateInfo');
  if (!updateInfo) return;
  
  switch(data.status) {
    case 'checking':
      updateInfo.innerHTML = '<p style="color: var(--accent-green);"><i class="fas fa-spinner fa-spin"></i> Checking for updates...</p>';
      break;
      
    case 'available':
      updateInfo.innerHTML = `
        <div class="update-info-box">
          <h4><i class="fas fa-download"></i> Update Available: v${data.version}</h4>
          <p>A new version is available!</p>
          <button class="btn" onclick="downloadUpdate()" style="margin-top: 10px;">
            <i class="fas fa-download"></i> Download Update
          </button>
        </div>
      `;
      break;
      
    case 'not-available':
      updateInfo.innerHTML = '<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> You are using the latest version!</p>';
      setTimeout(() => {
        updateInfo.innerHTML = '';
      }, 5000);
      break;
      
    case 'downloading':
      const percent = Math.round(data.percent);
      updateInfo.innerHTML = `
        <div class="update-info-box">
          <h4><i class="fas fa-download"></i> Downloading Update</h4>
          <p>Downloading... ${percent}%</p>
          <div class="update-progress">
            <div class="update-progress-bar">
              <div class="update-progress-fill" style="width: ${percent}%"></div>
            </div>
          </div>
        </div>
      `;
      break;
      
    case 'downloaded':
      updateInfo.innerHTML = `
        <div class="update-info-box">
          <h4><i class="fas fa-check-circle"></i> Update Downloaded!</h4>
          <p>Version ${data.version} is ready to install.</p>
          <p style="font-size: 13px; margin-top: 10px;">The update will be installed when you restart the app.</p>
          <button class="btn" onclick="installUpdate()" style="margin-top: 10px;">
            <i class="fas fa-sync-alt"></i> Restart and Install
          </button>
        </div>
      `;
      break;
      
    case 'error':
      updateInfo.innerHTML = `<p style="color: #ff4444;"><i class="fas fa-exclamation-circle"></i> Error: ${data.message}</p>`;
      break;
  }
}

function downloadUpdate() {
  if (window.electronAPI && window.electronAPI.downloadUpdate) {
    window.electronAPI.downloadUpdate();
  }
}

function installUpdate() {
  if (window.electronAPI && window.electronAPI.installUpdate) {
    if (confirm('The app will restart to install the update. Continue?')) {
      window.electronAPI.installUpdate();
    }
  }
}

// Create a compact horizontal row for playlist view
function createPlaylistRow(track, index, playlistId) {
  const item = document.createElement('div');
  item.className = 'playlist-item';
  
  let imageUrl = '';
  if (track.album && track.album.cover) {
    imageUrl = `https://resources.tidal.com/images/${track.album.cover.replace(/-/g, '/')}/320x320.jpg`;
  }
  
  const isDownloaded = downloads.some(d => d.id === track.id);
  const isLiked = likedSongs.some(s => s.id === track.id);
  
  item.innerHTML = `
    <div class="playlist-number">${index + 1}</div>
    <img src="${imageUrl}" width="72" height="72" style="border-radius: 10px; background: #444; object-fit: cover;" 
         onerror="this.style.display='none';" alt="">
    <div class="playlist-info" style="min-width:0;">
      <div class="playlist-title" style="font-weight:600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.title}</div>
      <div class="playlist-artist" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.artist?.name || ''}</div>
    </div>
    <button class="btn btn-small" onclick='playTrack(${track.id}, ${JSON.stringify(track).replace(/"/g, '&quot;')})'>
      <i class="fas fa-play"></i>
    </button>
    <button class="btn btn-small ${isLiked ? 'btn-secondary' : ''}" onclick='toggleLike(${track.id}, ${JSON.stringify(track).replace(/"/g, '&quot;')})'>
      <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
    </button>
    <button class="btn btn-small ${isDownloaded ? 'btn-secondary' : ''}" onclick='downloadTrackOffline(${track.id}, ${JSON.stringify(track).replace(/"/g, '&quot;')})'>
      <i class="fas fa-${isDownloaded ? 'check' : 'download'}"></i>
    </button>
    <button class="btn btn-small" onclick='removeFromPlaylist(${playlistId}, ${track.id})'>
      <i class="fas fa-times"></i>
    </button>
  `;
  
  return item;
}
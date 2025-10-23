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

// Special playlist IDs
const LIKED_SONGS_PLAYLIST_ID = '__liked_songs__';

// Suggestions infinite scroll state
let suggestionsPool = [];
let displayedSuggestions = 0;
let isLoadingMoreSuggestions = false;

let player = null;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  // Check if first time user
  const isFirstTime = !localStorage.getItem('onboardingComplete');
  if (isFirstTime) {
    showWelcomeScreen();
    return; // Don't initialize the rest until onboarding is complete
  }
  
  // Initialize app
  initializeApp();
});

function showWelcomeScreen() {
  const welcomeScreen = document.getElementById('welcomeScreen');
  if (welcomeScreen) {
    welcomeScreen.style.display = 'flex';
    
    // Initialize with current language
    currentLanguage = selectedLanguage;
    updateUILanguage();
    
    // Setup name input
    const nameInput = document.getElementById('welcomeNameInput');
    if (nameInput) {
      // Explicitly ensure input is editable
      nameInput.removeAttribute('readonly');
      nameInput.removeAttribute('disabled');
      nameInput.disabled = false;
      nameInput.readOnly = false;
      
      // Allow Enter key to submit
      nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          completeOnboarding();
        }
      });
      
      // Add input event for debugging
      nameInput.addEventListener('input', (e) => {
        console.log('Input value changed:', e.target.value);
      });
      
      // Focus on name input after animation
      setTimeout(() => {
        nameInput.focus();
        console.log('Name input focused. Editable:', !nameInput.readOnly && !nameInput.disabled);
      }, 1000);
    }
  }
}

let selectedLanguage = localStorage.getItem('language') || 'en';

function selectLanguage(lang) {
  selectedLanguage = lang;
  currentLanguage = lang; // Update current language immediately
  
  // Update button states
  document.querySelectorAll('.language-btn').forEach(btn => {
    if (btn.getAttribute('data-lang') === lang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update all translated text on the welcome screen
  updateUILanguage();
}

function completeOnboarding() {
  const nameInput = document.getElementById('welcomeNameInput');
  const userName = nameInput ? nameInput.value.trim() : '';
  
  if (!userName) {
    // Shake animation for empty name
    nameInput.style.animation = 'shake 0.5s';
    setTimeout(() => {
      nameInput.style.animation = '';
    }, 500);
    return;
  }
  
  // Save onboarding data
  localStorage.setItem('onboardingComplete', 'true');
  localStorage.setItem('userName', userName);
  localStorage.setItem('language', selectedLanguage);
  
  // Apply language
  currentLanguage = selectedLanguage;
  
  // Hide welcome screen with animation
  const welcomeScreen = document.getElementById('welcomeScreen');
  if (welcomeScreen) {
    welcomeScreen.style.animation = 'welcomeExit 0.5s ease-out forwards';
    setTimeout(() => {
      welcomeScreen.style.display = 'none';
      initializeApp();
    }, 500);
  }
}

function setTheme(theme) {
  currentTheme = theme;
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  updateThemeButtons();
}

function initializeApp() {
  // Load and apply language
  currentLanguage = localStorage.getItem('language') || 'en';
  updateUILanguage();
  
  // Set theme
  document.body.setAttribute('data-theme', currentTheme);
  updateThemeButtons();
  updateDiscordRPCButtons();
  
  // Initialize custom theme
  initializeCustomTheme();
  
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
  
  // Initialize special playlists and migrate data
  initializeSpecialPlaylists();
  
  // Load saved data
  loadPlaylists();
  loadSuggestions();
  // Honor trending preference
  const trendingPref = localStorage.getItem('showTrending');
  if (trendingPref === null || trendingPref === 'true') {
    loadTrendingSongs();
    const tSec = document.getElementById('trendingSection');
    if (tSec) tSec.style.display = 'block';
  } else {
    const tSec = document.getElementById('trendingSection');
    if (tSec) tSec.style.display = 'none';
  }
  
  // Setup event listeners
  setupEventListeners();

  // Initialize Customize page toggles
  initializeCustomizePage();
  
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
}

// Setup all event listeners
function setupEventListeners() {
  // Search on Enter
  const queryInput = document.getElementById('query');
  if (queryInput) {
    // Support both keypress and keydown to be safe across environments
    const searchEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } };
    queryInput.addEventListener('keypress', searchEnter);
    queryInput.addEventListener('keydown', searchEnter);

    // Toggle trending visibility while typing
    queryInput.addEventListener('input', function(e) {
      const val = e.target.value.trim();
      const trendingSection = document.getElementById('trendingSection');
      const searchResultsTitle = document.getElementById('searchResultsTitle');
      const resultsDiv = document.getElementById('results');
      const emptyDiv = document.getElementById('searchEmpty');
      const trendingPref = (localStorage.getItem('showTrending') ?? 'true') === 'true';

      if (val.length > 0) {
        if (trendingSection) trendingSection.style.display = 'none';
      } else {
        // When cleared, restore trending and clear search results UI
        if (trendingSection) trendingSection.style.display = trendingPref ? 'block' : 'none';
        if (searchResultsTitle) searchResultsTitle.style.display = 'none';
        if (resultsDiv) resultsDiv.innerHTML = '';
        if (emptyDiv) emptyDiv.style.display = 'none';
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

function initializeCustomizePage() {
  const trendingToggle = document.getElementById('custToggleTrending');
  const discordToggle = document.getElementById('custToggleDiscord');
  const theme = localStorage.getItem('theme') || currentTheme || 'dark';
  // Theme button active state
  const darkBtn = document.getElementById('custThemeDark');
  const lightBtn = document.getElementById('custThemeLight');
  if (darkBtn && lightBtn) {
    if (theme === 'dark') { darkBtn.classList.add('btn-secondary'); lightBtn.classList.remove('btn-secondary'); }
    else { lightBtn.classList.add('btn-secondary'); darkBtn.classList.remove('btn-secondary'); }
  }
  if (trendingToggle) {
    const pref = localStorage.getItem('showTrending');
    trendingToggle.checked = (pref === null || pref === 'true');
    trendingToggle.onchange = (e) => {
      const enabled = e.target.checked;
      localStorage.setItem('showTrending', enabled ? 'true' : 'false');
      const tSec = document.getElementById('trendingSection');
      if (tSec) tSec.style.display = enabled ? 'block' : 'none';
      if (enabled) loadTrendingSongs();
    };
  }
  if (discordToggle) {
    const pref = localStorage.getItem('discordRPCEnabled');
    const enabled = pref === null ? true : pref === 'true';
    discordToggle.checked = enabled;
    discordToggle.onchange = (e) => {
      const en = e.target.checked;
      localStorage.setItem('discordRPCEnabled', en ? 'true' : 'false');
      // Update RPC state if API exposed
      try {
        if (window.electronAPI && window.electronAPI.send) {
          if (!en) {
            window.electronAPI.send('update-discord-rpc', { details: '', state: '' });
          }
        }
      } catch {}
    };
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
    if (emptyDiv) emptyDiv.style.display = 'none';
    const suggestionsSection = document.getElementById('suggestions');
    if (suggestionsSection) suggestionsSection.style.display = 'block';
    const trendingSection = document.getElementById('trendingSection');
    const trendingPref = (localStorage.getItem('showTrending') ?? 'true') === 'true';
    if (trendingSection) trendingSection.style.display = trendingPref ? 'block' : 'none';
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
  if (!query) {
    // If empty query, just restore trending per preference and exit
    const trendingSection = document.getElementById('trendingSection');
    const trendingPref = (localStorage.getItem('showTrending') ?? 'true') === 'true';
    if (trendingSection) trendingSection.style.display = trendingPref ? 'block' : 'none';
    return;
  }
  
  const resultsDiv = document.getElementById('results');
  const emptyDiv = document.getElementById('searchEmpty');
  const trendingSection = document.getElementById('trendingSection');
  
  if (!resultsDiv) return;
  
  try {
    console.log('Searching for:', query);
    
    // Show loading state
    resultsDiv.innerHTML = '<div class="empty-state"><h3>🔍 Searching...</h3><p>Finding your music...</p></div>';
    
  // Hide trending while searching
  if (trendingSection) trendingSection.style.display = 'none';

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
  if (trendingSection) trendingSection.style.display = 'none';
      
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
  
  // Check if liked from the Liked Songs playlist
  const likedPlaylist = playlists.find(p => p.id === LIKED_SONGS_PLAYLIST_ID);
  const isLiked = likedPlaylist ? likedPlaylist.songs.some(song => song.id === item.id) : false;
  
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
  
  // Find the Liked Songs playlist
  let likedPlaylist = playlists.find(p => p.id === LIKED_SONGS_PLAYLIST_ID);
  if (!likedPlaylist) return;
  
  const index = likedPlaylist.songs.findIndex(song => song.id === currentTrack.id);
  const likeIcon = document.getElementById('currentLikeIcon');
  
  if (index === -1) {
    // Add to liked songs playlist
    likedPlaylist.songs.push(currentTrack);
    likedSongs.push(currentTrack); // Keep in sync for suggestions
    if (likeIcon) {
      likeIcon.className = 'fas fa-heart';
    }
  } else {
    // Remove from liked songs playlist
    likedPlaylist.songs.splice(index, 1);
    const likedIndex = likedSongs.findIndex(song => song.id === currentTrack.id);
    if (likedIndex !== -1) likedSongs.splice(likedIndex, 1);
    if (likeIcon) {
      likeIcon.className = 'far fa-heart';
    }
  }
  
  localStorage.setItem('playlists', JSON.stringify(playlists));
  localStorage.setItem('likedSongs', JSON.stringify(likedSongs));
  loadSuggestions(); // Reload suggestions when liked songs change
  
  // Refresh current view if viewing the Liked Songs playlist
  const currentSection = document.querySelector('.section.active');
  if (currentSection && currentSection.id === 'playlist-detail') {
    const currentViewingPlaylist = playlists.find(p => p.id === window.currentViewingPlaylistId);
    if (currentViewingPlaylist && currentViewingPlaylist.id === LIKED_SONGS_PLAYLIST_ID) {
      viewPlaylist(LIKED_SONGS_PLAYLIST_ID);
    }
  }
  
  // Update any visible like buttons for this track
  const likeBtn = document.getElementById(`like-${currentTrack.id}`);
  if (likeBtn) {
    const isLiked = likedPlaylist.songs.some(song => song.id === currentTrack.id);
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
  // Find the Liked Songs playlist
  let likedPlaylist = playlists.find(p => p.id === LIKED_SONGS_PLAYLIST_ID);
  if (!likedPlaylist) return;
  
  const index = likedPlaylist.songs.findIndex(song => song.id === id);
  const likedSongsIndex = likedSongs.findIndex(song => song.id === id);
  
  if (index === -1) {
    // Add to liked songs playlist
    likedPlaylist.songs.push(trackData);
    if (likedSongsIndex === -1) {
      likedSongs.push(trackData);
    }
  } else {
    // Remove from liked songs playlist
    likedPlaylist.songs.splice(index, 1);
    if (likedSongsIndex !== -1) {
      likedSongs.splice(likedSongsIndex, 1);
    }
  }
  
  // Save to localStorage
  localStorage.setItem('playlists', JSON.stringify(playlists));
  localStorage.setItem('likedSongs', JSON.stringify(likedSongs));
  loadSuggestions(); // Refresh suggestions
  
  // Update all visible like buttons for this track
  document.querySelectorAll(`button[onclick*="toggleLike(${id}"]`).forEach(btn => {
    const isLiked = likedPlaylist.songs.some(song => song.id === id);
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
    }
    if (isLiked) {
      btn.classList.add('btn-secondary');
    } else {
      btn.classList.remove('btn-secondary');
    }
  });
  
  // Update current track like button if this is the current track
  if (currentTrack && currentTrack.id === id) {
    const currentLikeIcon = document.getElementById('currentLikeIcon');
    if (currentLikeIcon) {
      const isLiked = likedPlaylist.songs.some(song => song.id === id);
      currentLikeIcon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
    }
  }
  
  // Refresh current view if viewing the Liked Songs playlist
  if (window.currentViewingPlaylistId === LIKED_SONGS_PLAYLIST_ID) {
    viewPlaylist(LIKED_SONGS_PLAYLIST_ID);
  }
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
  
  // Show personalized greeting
  showGreeting();
  
  // Only show suggestions if user has liked songs
  if (likedSongs.length === 0) {
    suggestionsSection.style.display = 'none';
    return;
  }
  
  try {
    suggestionsSection.style.display = 'block';
    suggestionsGrid.innerHTML = '<div class="empty-state"><h3><i class="fas fa-spinner loading-spinner"></i> Loading recommendations...</h3></div>';
    
    // Reset suggestions state
    suggestionsPool = [];
    displayedSuggestions = 0;
    
    // Get multiple random liked artists to base suggestions on
    const shuffledLiked = [...likedSongs].sort(() => Math.random() - 0.5);
    const artistsToSearch = shuffledLiked.slice(0, Math.min(5, likedSongs.length));
    
    let allSuggestions = [];
    
    // Search for similar songs from multiple artists
    for (const likedSong of artistsToSearch) {
      try {
        const res = await fetch(`https://hifi.401658.xyz/search/?s=${encodeURIComponent(likedSong.artist.name)}`);
        const data = await res.json();
        
        if (data.items && data.items.length > 0) {
          // Filter out already liked songs
          const newTracks = data.items.filter(item => 
            !likedSongs.some(song => song.id === item.id) &&
            !allSuggestions.some(existing => existing.id === item.id)
          );
          allSuggestions.push(...newTracks);
        }
      } catch (err) {
        console.error(`Failed to fetch suggestions for ${likedSong.artist.name}:`, err);
      }
    }
    
    if (allSuggestions.length > 0) {
      suggestionsGrid.innerHTML = '';
      
      // Shuffle all suggestions and store them
      suggestionsPool = allSuggestions.sort(() => Math.random() - 0.5);
      console.log(`Initial suggestions pool loaded: ${suggestionsPool.length} tracks`);
      
      // Display first 20
      displayMoreSuggestions();
      
      // Setup infinite scroll
      setupSuggestionsInfiniteScroll();
    } else {
      suggestionsSection.style.display = 'none';
    }
  } catch (error) {
    console.error('Failed to load suggestions:', error);
    suggestionsSection.style.display = 'none';
  }
}

// Load trending songs
async function loadTrendingSongs() {
  const trendingSection = document.getElementById('trendingSection');
  const trendingGrid = document.getElementById('trendingGrid');
  
  if (!trendingSection || !trendingGrid) return;
  
  try {
    trendingSection.style.display = 'block';
    trendingGrid.innerHTML = '<div class="empty-state"><h3><i class="fas fa-spinner loading-spinner"></i> Loading trending...</h3></div>';
    
    // Search multiple popular artists to diversify trending content
    const trendingQueries = [
      'Drake', 'Taylor Swift', 'The Weeknd', 'Ed Sheeran', 'Ariana Grande',
      'Bad Bunny', 'Billie Eilish', 'Post Malone', 'Olivia Rodrigo', 'Doja Cat'
    ];

    // Limit concurrent requests to avoid hammering the endpoint
    const sampleQueries = trendingQueries.sort(() => Math.random() - 0.5).slice(0, 5);
    const results = await Promise.allSettled(
      sampleQueries.map(q => fetch(`https://hifi.401658.xyz/search/?s=${encodeURIComponent(q)}`)
        .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    );

    // Collect items from successful queries
    let combined = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value && Array.isArray(r.value.items)) {
        combined.push(...r.value.items);
      }
    }

    // Filter to track-like items with required fields
    combined = combined.filter(it => it && it.id && it.title && it.artist && it.artist.name && it.album && it.album.cover);

    // Deduplicate by track id
    const seen = new Set();
    const deduped = [];
    for (const item of combined) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        deduped.push(item);
      }
    }

    // Shuffle to mix artists, then take top N
    for (let i = deduped.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deduped[i], deduped[j]] = [deduped[j], deduped[i]];
    }

    const topN = deduped.slice(0, 12);

    if (topN.length > 0) {
      trendingGrid.innerHTML = '';
      topN.forEach(item => {
        const trackCard = createTrackCard(item);
        trendingGrid.appendChild(trackCard);
      });
    } else {
      trendingGrid.innerHTML = '<div class="empty-state"><h3>No trending songs available</h3></div>';
    }
  } catch (error) {
    console.error('Failed to load trending songs:', error);
    trendingSection.style.display = 'none';
  }
}

// Display more suggestions from the pool
function displayMoreSuggestions() {
  const suggestionsGrid = document.getElementById('suggestionsGrid');
  if (!suggestionsGrid) {
    console.log('No suggestions grid found');
    return;
  }
  
  console.log(`displayMoreSuggestions called - displayed: ${displayedSuggestions}, pool: ${suggestionsPool.length}, loading: ${isLoadingMoreSuggestions}`);
  
  const batchSize = 20;
  
  // If we've reached the end of the current pool, fetch more
  if (displayedSuggestions >= suggestionsPool.length) {
    console.log('Reached end of pool, fetching more...');
    if (likedSongs.length > 0 && !isLoadingMoreSuggestions) {
      loadMoreSuggestionsFromNewArtists();
    }
    return;
  }
  
  const endIndex = Math.min(displayedSuggestions + batchSize, suggestionsPool.length);
  
  for (let i = displayedSuggestions; i < endIndex; i++) {
    const trackCard = createTrackCard(suggestionsPool[i]);
    suggestionsGrid.appendChild(trackCard);
  }
  
  displayedSuggestions = endIndex;
  console.log(`Displayed ${displayedSuggestions} of ${suggestionsPool.length} suggestions`);
}

// Load suggestions from additional artists when reaching the end
async function loadMoreSuggestionsFromNewArtists() {
  if (isLoadingMoreSuggestions) return;
  isLoadingMoreSuggestions = true;
  
  console.log('Fetching more suggestions from new artists...');
  
  try {
    // Get random liked artists we haven't used yet
    const shuffledLiked = [...likedSongs].sort(() => Math.random() - 0.5);
    const artistsToSearch = shuffledLiked.slice(0, Math.min(3, likedSongs.length));
    
    let newSuggestions = [];
    
    for (const likedSong of artistsToSearch) {
      try {
        const res = await fetch(`https://hifi.401658.xyz/search/?s=${encodeURIComponent(likedSong.artist.name)}`);
        const data = await res.json();
        
        if (data.items && data.items.length > 0) {
          const newTracks = data.items.filter(item => 
            !likedSongs.some(song => song.id === item.id) &&
            !suggestionsPool.some(existing => existing.id === item.id) &&
            !newSuggestions.some(existing => existing.id === item.id)
          );
          newSuggestions.push(...newTracks);
        }
      } catch (err) {
        console.error(`Failed to fetch more suggestions for ${likedSong.artist.name}:`, err);
      }
    }
    
    if (newSuggestions.length > 0) {
      // Add to pool and shuffle
      const shuffledNew = newSuggestions.sort(() => Math.random() - 0.5);
      suggestionsPool.push(...shuffledNew);
      console.log(`Added ${shuffledNew.length} new suggestions. Pool now has ${suggestionsPool.length} total.`);
      
      // Display the newly added suggestions
      displayMoreSuggestions();
    }
  } catch (error) {
    console.error('Failed to load more suggestions:', error);
  } finally {
    isLoadingMoreSuggestions = false;
  }
}

// Setup infinite scroll for suggestions
function setupSuggestionsInfiniteScroll() {
  const contentArea = document.querySelector('.content-area');
  if (!contentArea) return;
  
  // Remove old listener if exists
  if (contentArea.suggestionsScrollHandler) {
    contentArea.removeEventListener('scroll', contentArea.suggestionsScrollHandler);
  }
  
  // Create new scroll handler
  contentArea.suggestionsScrollHandler = function() {
    const suggestionsSection = document.getElementById('suggestions');
    const searchSection = document.getElementById('search');
    
    // Only load more if on search section and suggestions are visible
    if (!suggestionsSection || !searchSection) return;
    if (!searchSection.classList.contains('active')) return;
    if (suggestionsSection.style.display === 'none') return;
    
    const scrollPosition = contentArea.scrollTop + contentArea.clientHeight;
    const scrollHeight = contentArea.scrollHeight;
    const distanceFromBottom = scrollHeight - scrollPosition;
    
    // Load more when user is 300px from bottom (reduced from 500px for better detection)
    if (distanceFromBottom < 300 && !isLoadingMoreSuggestions) {
      console.log('Scroll trigger:', { 
        scrollTop: contentArea.scrollTop,
        clientHeight: contentArea.clientHeight, 
        scrollHeight,
        distanceFromBottom,
        displayedSuggestions, 
        poolLength: suggestionsPool.length 
      });
      displayMoreSuggestions();
    }
  };
  
  contentArea.addEventListener('scroll', contentArea.suggestionsScrollHandler);
  console.log('Infinite scroll setup complete for suggestions');
}

// Playlist functionality
function showCreatePlaylistModal() {
  const modal = document.getElementById('createPlaylistModal');
  const nameInput = document.getElementById('playlistName');
  
  if (modal) modal.style.display = 'block';
  if (nameInput) nameInput.focus();
  
  // Add ESC key listener
  document.addEventListener('keydown', handleCreatePlaylistEscKey);
}

function handleCreatePlaylistEscKey(event) {
  if (event.key === 'Escape') {
    closeCreatePlaylistModal();
  }
}

function closeCreatePlaylistModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById('createPlaylistModal');
  const nameInput = document.getElementById('playlistName');
  const descInput = document.getElementById('playlistDescription');
  
  if (modal) modal.style.display = 'none';
  if (nameInput) nameInput.value = '';
  if (descInput) descInput.value = '';
  
  // Remove ESC key listener
  document.removeEventListener('keydown', handleCreatePlaylistEscKey);
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

// Initialize special playlists (Liked Songs)
function initializeSpecialPlaylists() {
  // Create or update Liked Songs playlist
  let likedPlaylist = playlists.find(p => p.id === LIKED_SONGS_PLAYLIST_ID);
  
  if (!likedPlaylist) {
    // Migrate old liked songs to new playlist
    likedPlaylist = {
      id: LIKED_SONGS_PLAYLIST_ID,
      name: 'Liked Songs',
      description: 'Your favorite tracks',
      songs: [...likedSongs],
      createdAt: new Date().toISOString(),
      isSpecial: true
    };
    playlists.unshift(likedPlaylist); // Add at the beginning
  } else {
    // Update with current liked songs
    likedPlaylist.songs = [...likedSongs];
  }
  
  // Remove old Downloads playlist if it exists
  playlists = playlists.filter(p => p.id !== '__downloads__');
  
  localStorage.setItem('playlists', JSON.stringify(playlists));
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
    
    const isSpecial = playlist.isSpecial || playlist.id === LIKED_SONGS_PLAYLIST_ID;
    const icon = playlist.id === LIKED_SONGS_PLAYLIST_ID ? 'fas fa-heart' : 'fas fa-list';
    
    // Count downloaded songs in this playlist
    const downloadedCount = playlist.songs.filter(song => downloads.some(d => d.id === song.id)).length;
    const hasOffline = downloadedCount > 0;
    
    item.innerHTML = `
      <div class="playlist-number"><i class="${icon}"></i></div>
      <div class="playlist-info" onclick="viewPlaylist('${playlist.id}')" style="cursor: pointer; flex: 1;">
        <div class="playlist-title">
          ${playlist.name}
          ${hasOffline ? '<span style="margin-left: 8px; font-size: 12px; background: var(--accent-green); padding: 2px 8px; border-radius: 4px;">📥 Offline</span>' : ''}
        </div>
        <div class="playlist-artist">${playlist.songs.length} songs • ${playlist.description || 'No description'}</div>
      </div>
      <button class="btn btn-small" onclick="playPlaylist('${playlist.id}')">
        <i class="fas fa-play"></i> Play
      </button>
      ${!isSpecial ? `<button class="btn btn-small btn-secondary" onclick="deletePlaylist(${playlist.id})">
        <i class="fas fa-trash"></i>
      </button>` : ''}
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
  
  modal.style.display = 'block';
  
  // Add ESC key listener
  document.addEventListener('keydown', handleAddToPlaylistEscKey);
  
  listContainer.innerHTML = '';
  
  if (playlists.length === 0) {
    listContainer.innerHTML = '<div class="empty-state"><p>No playlists yet. Create one below!</p></div>';
  } else {
    // Filter out Liked Songs playlist - users should use the heart button instead
    const selectablePlaylists = playlists.filter(p => p.id !== LIKED_SONGS_PLAYLIST_ID);
    
    if (selectablePlaylists.length === 0) {
      listContainer.innerHTML = '<div class="empty-state"><p>No playlists yet. Create one below!</p></div>';
    } else {
      selectablePlaylists.forEach(playlist => {
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

function handleAddToPlaylistEscKey(event) {
  if (event.key === 'Escape') {
    closeAddToPlaylistModal();
  }
}

function closeAddToPlaylistModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById('addToPlaylistModal');
  if (modal) modal.style.display = 'none';
  window.tempTrackToAdd = null;
  
  // Remove ESC key listener
  document.removeEventListener('keydown', handleAddToPlaylistEscKey);
}

function showCreatePlaylistFromAdd() {
  closeAddToPlaylistModal();
  showCreatePlaylistModal();
}

let currentViewingPlaylist = null;

function viewPlaylist(playlistId) {
  // Ensure we're comparing the same types
  const playlist = playlists.find(p => String(p.id) === String(playlistId));
  if (!playlist) {
    console.error('Playlist not found:', playlistId, 'Available:', playlists.map(p => p.id));
    return;
  }
  
  window.currentViewingPlaylistId = playlist.id;
  currentViewingPlaylist = playlist.id;
  
  const isSpecial = playlist.isSpecial || playlist.id === LIKED_SONGS_PLAYLIST_ID;
  
  // Update header info
  document.getElementById('playlistDetailName').textContent = playlist.name;
  document.getElementById('playlistDetailDesc').textContent = playlist.description || 'No description';
  document.getElementById('playlistDetailCount').textContent = `${playlist.songs.length} song${playlist.songs.length !== 1 ? 's' : ''}`;
  
  // Update button visibility based on playlist type
  const editBtn = document.querySelector('.playlist-detail-actions button[onclick="showEditPlaylistModal()"]');
  const deleteBtn = document.querySelector('.playlist-detail-actions button[onclick="deleteCurrentPlaylist()"]');
  const downloadBtn = document.querySelector('.playlist-detail-actions button[onclick="downloadPlaylist()"]');
  
  if (editBtn) editBtn.style.display = isSpecial ? 'none' : 'inline-flex';
  if (deleteBtn) deleteBtn.style.display = isSpecial ? 'none' : 'inline-flex';
  // Show download button for all playlists (including special ones)
  if (downloadBtn) downloadBtn.style.display = 'inline-flex';
  
  // Display tracks
  const tracksContainer = document.getElementById('playlistDetailTracks');
  tracksContainer.innerHTML = '';
  
  if (playlist.songs.length === 0) {
    tracksContainer.innerHTML = '<div class="empty-state"><h3>No songs in this playlist</h3><p>Add songs to get started</p></div>';
  } else {
    playlist.songs.forEach((track, index) => {
      const row = createPlaylistRow(track, index, playlist.id);
      tracksContainer.appendChild(row);
    });
  }
  
  // Navigate to playlist detail section
  showSection('playlist-detail');
}

function removeFromPlaylist(playlistId, trackId) {
  const playlist = playlists.find(p => String(p.id) === String(playlistId));
  if (!playlist) return;
  
  playlist.songs = playlist.songs.filter(song => song.id !== trackId);
  
  // If removing from Liked Songs, also remove from likedSongs array
  if (String(playlistId) === String(LIKED_SONGS_PLAYLIST_ID)) {
    likedSongs = likedSongs.filter(song => song.id !== trackId);
    localStorage.setItem('likedSongs', JSON.stringify(likedSongs));
    loadSuggestions(); // Refresh suggestions
  }
  
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
  
  // Prevent editing special playlists
  if (playlist.isSpecial || playlist.id === LIKED_SONGS_PLAYLIST_ID) {
    alert('Cannot edit special playlists');
    return;
  }
  
  const modal = document.getElementById('editPlaylistModal');
  const nameInput = document.getElementById('editPlaylistName');
  const descInput = document.getElementById('editPlaylistDescription');
  if (nameInput) nameInput.value = playlist.name || '';
  if (descInput) descInput.value = playlist.description || '';
  if (modal) modal.style.display = 'flex';
  
  // Add ESC key listener
  document.addEventListener('keydown', handleEditPlaylistEscKey);
}

function handleEditPlaylistEscKey(event) {
  if (event.key === 'Escape') {
    closeEditPlaylistModal();
  }
}

function closeEditPlaylistModal(event) {
  const modal = document.getElementById('editPlaylistModal');
  if (!modal) return;
  if (!event || event.target === modal) {
    modal.style.display = 'none';
    
    // Remove ESC key listener
    document.removeEventListener('keydown', handleEditPlaylistEscKey);
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

// Export playlist to M3U format
function exportPlaylistM3U() {
  if (!currentViewingPlaylist) return;
  const playlist = playlists.find(p => p.id === currentViewingPlaylist);
  if (!playlist || playlist.songs.length === 0) {
    alert('Playlist is empty. Cannot export.');
    return;
  }

  // Build M3U content with embedded track data
  let m3uContent = '#EXTM3U\n';
  m3uContent += `#PLAYLIST:${playlist.name}\n`;
  
  playlist.songs.forEach(song => {
    // Add metadata line: #EXTINF:duration,Artist - Title
    const artistName = song.artist?.name || 'Unknown Artist';
    const title = song.title || 'Unknown Title';
    const duration = song.duration || -1; // M3U uses seconds, -1 if unknown
    
    m3uContent += `#EXTINF:${duration},${artistName} - ${title}\n`;
    
    // Store full track data as a JSON comment for reliable import
    m3uContent += `#FLOWIFYDATA:${JSON.stringify(song)}\n`;
    
    // Add the track URL or identifier
    m3uContent += `flowify://track/${song.id}\n`;
  });

  // Create a downloadable file
  const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${playlist.name.replace(/[^a-z0-9]/gi, '_')}.m3u`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Show success message
  const successMsg = document.createElement('div');
  successMsg.textContent = `Exported "${playlist.name}" to M3U`;
  successMsg.style.cssText = 'position: fixed; top: 80px; right: 20px; background: var(--accent-green); color: white; padding: 15px 20px; border-radius: 8px; z-index: 3000; animation: fadeIn 0.3s ease;';
  document.body.appendChild(successMsg);
  setTimeout(() => successMsg.remove(), 2500);
}

// Download all tracks in the current playlist
async function downloadPlaylist() {
  if (!currentViewingPlaylist) {
    alert('No playlist selected');
    return;
  }
  
  const playlist = playlists.find(p => String(p.id) === String(currentViewingPlaylist));
  if (!playlist || playlist.songs.length === 0) {
    alert('Playlist is empty');
    return;
  }
  
  if (!confirm(`Download all ${playlist.songs.length} tracks in "${playlist.name}"? This may take a while.`)) {
    return;
  }
  
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;
  
  // Show progress message
  const progressMsg = document.createElement('div');
  progressMsg.id = 'downloadProgress';
  progressMsg.style.cssText = 'position: fixed; top: 80px; right: 20px; background: var(--accent-green); color: white; padding: 15px 20px; border-radius: 8px; z-index: 3000; animation: fadeIn 0.3s ease;';
  progressMsg.textContent = `Downloading playlist: 0/${playlist.songs.length}`;
  document.body.appendChild(progressMsg);
  
  for (let i = 0; i < playlist.songs.length; i++) {
    const track = playlist.songs[i];
    
    // Update progress
    progressMsg.textContent = `Downloading: ${i + 1}/${playlist.songs.length} - ${track.title}`;
    
    // Skip if already downloaded
    if (downloads.some(d => d.id === track.id)) {
      skippedCount++;
      continue;
    }
    
    try {
      await downloadTrackOffline(track.id, track);
      successCount++;
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to download ${track.title}:`, error);
      failCount++;
    }
  }
  
  // Remove progress and show final result
  progressMsg.remove();
  
  const msg = document.createElement('div');
  msg.textContent = `Download complete: ${successCount} new${skippedCount > 0 ? `, ${skippedCount} already downloaded` : ''}${failCount > 0 ? `, ${failCount} failed` : ''}`;
  msg.style.cssText = 'position: fixed; top: 80px; right: 20px; background: var(--accent-green); color: white; padding: 15px 20px; border-radius: 8px; z-index: 3000; animation: fadeIn 0.3s ease;';
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 4000);
  
  // Refresh playlist view to show offline badge
  loadPlaylists();
}

// Import playlist from M3U file
function importPlaylistM3U() {
  // Create a hidden file input
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.m3u,.m3u8';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const lines = text.split('\n').map(line => line.trim()).filter(line => line);
      
      let playlistName = file.name.replace(/\.m3u8?$/i, '');
      const tracks = [];
      let currentTrackData = null;
      
      // Parse M3U file
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check for playlist name
        if (line.startsWith('#PLAYLIST:')) {
          playlistName = line.substring('#PLAYLIST:'.length).trim();
        }
        
        // Check for embedded track data (our custom format)
        if (line.startsWith('#FLOWIFYDATA:')) {
          try {
            const jsonData = line.substring('#FLOWIFYDATA:'.length);
            currentTrackData = JSON.parse(jsonData);
          } catch (err) {
            console.error('Failed to parse track data:', err);
          }
        }
        
        // Check for track URL/ID
        if (line.startsWith('flowify://track/')) {
          const trackId = parseInt(line.substring('flowify://track/'.length));
          
          if (!isNaN(trackId)) {
            // If we have embedded data, use it
            if (currentTrackData && currentTrackData.id === trackId) {
              tracks.push(currentTrackData);
              currentTrackData = null;
            } else {
              // Fallback: try to find the track locally
              let track = likedSongs.find(s => s.id === trackId);
              
              if (!track) {
                // Search through all playlists
                for (const pl of playlists) {
                  track = pl.songs.find(s => s.id === trackId);
                  if (track) break;
                }
              }
              
              if (track) {
                tracks.push(track);
              } else {
                console.warn(`Track ID ${trackId} not found and no embedded data available`);
              }
            }
          }
        }
      }
      
      if (tracks.length === 0) {
        alert('No valid tracks found in M3U file. The file may be from a different music player or corrupted.');
        return;
      }
      
      // Prompt user for playlist name with original name as default
      const userPlaylistName = prompt(`Enter a name for this playlist:`, playlistName);
      if (!userPlaylistName || !userPlaylistName.trim()) {
        // User cancelled or entered empty name
        return;
      }
      
      // Create new playlist
      const newPlaylist = {
        id: Date.now(),
        name: userPlaylistName.trim(),
        description: `Imported from ${file.name} (original: ${playlistName})`,
        songs: tracks
      };
      
      playlists.push(newPlaylist);
      localStorage.setItem('playlists', JSON.stringify(playlists));
      loadPlaylists();
      
      // Show success message
      const successMsg = document.createElement('div');
      successMsg.textContent = `Imported "${userPlaylistName.trim()}" with ${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;
      successMsg.style.cssText = 'position: fixed; top: 80px; right: 20px; background: var(--accent-green); color: white; padding: 15px 20px; border-radius: 8px; z-index: 3000; animation: fadeIn 0.3s ease;';
      document.body.appendChild(successMsg);
      setTimeout(() => successMsg.remove(), 3000);
      
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import M3U file. Please make sure it\'s a valid M3U file.');
    }
  };
  
  input.click();
}

function playPlaylist(playlistId) {
  const playlist = playlists.find(p => String(p.id) === String(playlistId));
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
  // Prevent deleting special playlists
  if (playlistId === LIKED_SONGS_PLAYLIST_ID) {
    alert('Cannot delete special playlists');
    return;
  }
  
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

// Language change function
function changeLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    
    // Update the select element
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
      languageSelect.value = lang;
    }
    
    // Update all UI text with translations
    updateUILanguage();
    
    // Update greeting if it's visible
    showGreeting();
    
    // Show success message with translated text
    const successMsg = document.createElement('div');
    successMsg.textContent = 'Language updated!';
    successMsg.style.cssText = 'position: fixed; top: 80px; right: 20px; background: var(--accent-green); color: white; padding: 15px 20px; border-radius: 8px; z-index: 3000; animation: fadeIn 0.3s ease;';
    document.body.appendChild(successMsg);
    setTimeout(() => successMsg.remove(), 2000);
  }
}

// Initialize language select on settings open
function initializeLanguageSelect() {
  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) {
    languageSelect.value = currentLanguage;
  }
}

// Change user name function
function changeUserName() {
  const currentName = localStorage.getItem('userName') || '';
  const modal = document.getElementById('changeNameModal');
  const input = document.getElementById('newUserName');
  
  if (modal && input) {
    input.value = currentName;
    modal.style.display = 'flex';
    
    // Focus the input after a short delay
    setTimeout(() => {
      input.focus();
      input.select();
    }, 100);
    
    // Add ESC key listener
    document.addEventListener('keydown', handleChangeNameEscKey);
    
    // Allow Enter key to save
    input.onkeypress = (e) => {
      if (e.key === 'Enter') {
        saveNewUserName();
      }
    };
  }
}

function handleChangeNameEscKey(event) {
  if (event.key === 'Escape') {
    closeChangeNameModal();
  }
}

function closeChangeNameModal(event) {
  const modal = document.getElementById('changeNameModal');
  if (event && event.target !== modal && event !== undefined) return;
  
  if (modal) {
    modal.style.display = 'none';
    // Remove ESC key listener
    document.removeEventListener('keydown', handleChangeNameEscKey);
  }
}

function saveNewUserName() {
  const input = document.getElementById('newUserName');
  const newName = input ? input.value.trim() : '';
  
  if (newName) {
    localStorage.setItem('userName', newName);
    showGreeting();
    closeChangeNameModal();
    
    // Show success message
    const successMsg = document.createElement('div');
    successMsg.textContent = `Name updated to "${newName}"`;
    successMsg.style.cssText = 'position: fixed; top: 80px; right: 20px; background: var(--accent-green); color: white; padding: 15px 20px; border-radius: 8px; z-index: 3000; animation: fadeIn 0.3s ease;';
    document.body.appendChild(successMsg);
    setTimeout(() => successMsg.remove(), 2000);
  } else {
    // Shake the input if empty
    const input = document.getElementById('newUserName');
    if (input) {
      input.style.animation = 'shake 0.5s';
      setTimeout(() => {
        input.style.animation = '';
      }, 500);
    }
  }
}

// Reset app function
function resetApp() {
  const confirmed = confirm(
    '⚠️ WARNING: This will delete ALL your data including:\n\n' +
    '• Playlists\n' +
    '• Liked songs\n' +
    '• Downloads\n' +
    '• Settings\n' +
    '• Custom theme\n\n' +
    'Are you sure you want to reset the app?'
  );
  
  if (confirmed) {
    const doubleConfirm = confirm('This action cannot be undone. Are you absolutely sure?');
    
    if (doubleConfirm) {
      // Clear all localStorage
      localStorage.clear();
      
      // Show message and reload
      alert('App reset complete! The page will now reload.');
      
      // Reload the page to start fresh
      window.location.reload();
    }
  }
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
    loadPlaylists(); // Refresh playlists to update offline badges
  }
}

// Settings modal functions
function showSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.style.display = 'flex';
    // Initialize language select to current language
    initializeLanguageSelect();
    
    // Add ESC key listener
    document.addEventListener('keydown', handleSettingsEscKey);
  }
}

function handleSettingsEscKey(event) {
  if (event.key === 'Escape') {
    closeSettingsModal();
  }
}

function closeSettingsModal(event) {
  const modal = document.getElementById('settingsModal');
  if (modal && (!event || event.target === modal)) {
    modal.style.display = 'none';
    // Remove ESC key listener when modal closes
    document.removeEventListener('keydown', handleSettingsEscKey);
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

// Download all tracks in the Downloads playlist
async function downloadAllPlaylistTracks() {
  const downloadsPlaylist = playlists.find(p => p.id === DOWNLOADS_PLAYLIST_ID);
  if (!downloadsPlaylist || downloadsPlaylist.songs.length === 0) {
    alert('No songs in Downloads playlist');
    return;
  }
  
  if (!confirm(`Download all ${downloadsPlaylist.songs.length} tracks? This may take a while.`)) {
    return;
  }
  
  let successCount = 0;
  let failCount = 0;
  
  for (const track of downloadsPlaylist.songs) {
    // Skip if already downloaded
    if (downloads.some(d => d.id === track.id)) {
      successCount++;
      continue;
    }
    
    try {
      await downloadTrackOffline(track.id, track);
      successCount++;
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed to download ${track.title}:`, error);
      failCount++;
    }
  }
  
  const msg = document.createElement('div');
  msg.textContent = `Download complete: ${successCount} succeeded${failCount > 0 ? `, ${failCount} failed` : ''}`;
  msg.style.cssText = 'position: fixed; top: 80px; right: 20px; background: var(--accent-green); color: white; padding: 15px 20px; border-radius: 8px; z-index: 3000; animation: fadeIn 0.3s ease;';
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 4000);
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
  
  // Check if liked from the Liked Songs playlist
  const likedPlaylist = playlists.find(p => p.id === LIKED_SONGS_PLAYLIST_ID);
  const isLiked = likedPlaylist ? likedPlaylist.songs.some(s => s.id === track.id) : false;
  
  // For Liked Songs playlist, removing is the same as unliking
  const isLikedSongsPlaylist = playlistId === LIKED_SONGS_PLAYLIST_ID;
  const removeAction = isLikedSongsPlaylist 
    ? `toggleLike(${track.id}, ${JSON.stringify(track).replace(/"/g, '&quot;')})` 
    : `removeFromPlaylist('${playlistId}', ${track.id})`;
  
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
    <button class="btn btn-small" onclick='${removeAction}'>
      <i class="fas fa-times"></i>
    </button>
  `;
  
  return item;
}

// Custom Theme Editor Functions
const defaultTheme = {
  bgGradientStart: '#0d3d2e',
  bgGradientMid: '#1a5943',
  bgGradientEnd: '#0f4d38',
  sidebarBg: '#0a1e14',
  cardBg: '#0f281e',
  cardHoverBg: '#143223',
  textPrimary: '#e8f5e9',
  textSecondary: '#c8ffd2',
  accentGreen: '#2d8659',
  accentGreenHover: '#3aa66f'
};

function openCustomThemeEditor() {
  const modal = document.getElementById('customThemeModal');
  if (modal) {
    modal.style.display = 'flex';
    loadCustomThemeValues();
    
    // Add ESC key listener
    document.addEventListener('keydown', handleThemeEditorEscKey);
  }
}

function handleThemeEditorEscKey(event) {
  if (event.key === 'Escape') {
    closeCustomThemeEditor();
  }
}

function closeCustomThemeEditor(event) {
  const modal = document.getElementById('customThemeModal');
  if (event && event.target !== modal && event !== undefined) return;
  if (modal) {
    modal.style.display = 'none';
    // Remove ESC key listener when modal closes
    document.removeEventListener('keydown', handleThemeEditorEscKey);
  }
}

function loadCustomThemeValues() {
  const savedTheme = JSON.parse(localStorage.getItem('customTheme') || '{}');
  const theme = { ...defaultTheme, ...savedTheme };
  
  Object.keys(theme).forEach(key => {
    const input = document.getElementById(key);
    if (input) {
      input.value = theme[key];
    }
  });
}

function applyCustomTheme() {
  const theme = {};
  Object.keys(defaultTheme).forEach(key => {
    const input = document.getElementById(key);
    if (input) {
      theme[key] = input.value;
    }
  });
  
  // Apply CSS variables
  const root = document.documentElement;
  root.style.setProperty('--bg-gradient-start', theme.bgGradientStart);
  root.style.setProperty('--bg-gradient-mid', theme.bgGradientMid);
  root.style.setProperty('--bg-gradient-end', theme.bgGradientEnd);
  root.style.setProperty('--sidebar-bg', theme.sidebarBg);
  root.style.setProperty('--card-bg', theme.cardBg);
  root.style.setProperty('--card-hover-bg', theme.cardHoverBg);
  root.style.setProperty('--text-primary', theme.textPrimary);
  root.style.setProperty('--text-secondary', theme.textSecondary);
  root.style.setProperty('--accent-green', theme.accentGreen);
  root.style.setProperty('--accent-green-hover', theme.accentGreenHover);
  
  // Save to localStorage
  localStorage.setItem('customTheme', JSON.stringify(theme));
  
  showMessage('Theme applied successfully!');
}

function resetCustomTheme() {
  // Clear custom theme from localStorage
  localStorage.removeItem('customTheme');
  
  // Reset to default values
  const root = document.documentElement;
  Object.keys(defaultTheme).forEach(key => {
    const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
    root.style.removeProperty(cssVar);
  });
  
  // Reload default values in inputs
  loadCustomThemeValues();
  
  showMessage('Theme reset to default');
}

function exportCustomTheme() {
  const savedTheme = JSON.parse(localStorage.getItem('customTheme') || '{}');
  const theme = { ...defaultTheme, ...savedTheme };
  
  const dataStr = JSON.stringify(theme, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  
  const exportFileDefaultName = 'flowify-theme.json';
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
  
  showMessage('Theme exported successfully!');
}

function importCustomTheme() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const theme = JSON.parse(event.target.result);
        
        // Validate theme has required properties
        const hasAllKeys = Object.keys(defaultTheme).every(key => key in theme);
        if (!hasAllKeys) {
          showMessage('Invalid theme file', 'error');
          return;
        }
        
        // Save and apply
        localStorage.setItem('customTheme', JSON.stringify(theme));
        loadCustomThemeValues();
        applyCustomTheme();
        
        showMessage('Theme imported successfully!');
      } catch (error) {
        showMessage('Failed to import theme file', 'error');
        console.error('Theme import error:', error);
      }
    };
    
    reader.readAsText(file);
  };
  
  input.click();
}

// Load custom theme on startup
function initializeCustomTheme() {
  const savedTheme = localStorage.getItem('customTheme');
  if (savedTheme) {
    try {
      const theme = JSON.parse(savedTheme);
      const root = document.documentElement;
      
      Object.keys(theme).forEach(key => {
        const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
        root.style.setProperty(cssVar, theme[key]);
      });
    } catch (error) {
      console.error('Failed to load custom theme:', error);
    }
  }
}

// Show personalized greeting based on time of day
function showGreeting() {
  const greetingElement = document.getElementById('userGreeting');
  const greetingText = document.getElementById('greetingText');
  
  if (!greetingElement || !greetingText) return;
  
  const userName = localStorage.getItem('userName');
  if (!userName) return;
  
  // Get current hour
  const hour = new Date().getHours();
  let greeting;
  
  // Determine greeting based on time
  if (hour >= 5 && hour < 12) {
    greeting = t('greeting.morning');
  } else if (hour >= 12 && hour < 17) {
    greeting = t('greeting.afternoon');
  } else if (hour >= 17 && hour < 22) {
    greeting = t('greeting.evening');
  } else {
    greeting = t('greeting.night');
  }
  
  greetingText.textContent = `${greeting}, ${userName}`;
  greetingElement.style.display = 'block';
}

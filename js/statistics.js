// ============================================
// STATISTICS & PROFILE MANAGEMENT
// ============================================

// Statistics Data Structure
let statisticsData = JSON.parse(localStorage.getItem('statistics') || JSON.stringify({
  totalPlays: 0,
  totalListeningTime: 0, // in seconds
  songPlays: {}, // { songId: { count, title, artist, lastPlayed, totalTime } }
  artistPlays: {}, // { artistName: count }
  dailyStats: {}, // { 'YYYY-MM-DD': { plays, time } }
  firstPlayDate: null
}));

// Track when a song starts playing
function trackSongPlay(track) {
  if (!track || !track.id) return;
  
  const now = new Date();
  const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Initialize if first time
  if (!statisticsData.firstPlayDate) {
    statisticsData.firstPlayDate = now.toISOString();
  }
  
  // Track total plays
  statisticsData.totalPlays++;
  
  // Track song-specific plays
  if (!statisticsData.songPlays[track.id]) {
    statisticsData.songPlays[track.id] = {
      count: 0,
      title: track.title || 'Unknown',
      artist: track.artist?.name || 'Unknown Artist',
      lastPlayed: null,
      totalTime: 0
    };
  }
  statisticsData.songPlays[track.id].count++;
  statisticsData.songPlays[track.id].lastPlayed = now.toISOString();
  
  // Track artist plays
  const artistName = track.artist?.name || 'Unknown Artist';
  if (!statisticsData.artistPlays[artistName]) {
    statisticsData.artistPlays[artistName] = {
      count: 0,
      picture: track.artist?.picture || null
    };
  }
  statisticsData.artistPlays[artistName].count++;
  // Update picture if we have one and didn't before
  if (track.artist?.picture && !statisticsData.artistPlays[artistName].picture) {
    statisticsData.artistPlays[artistName].picture = track.artist.picture;
  }
  
  // Track daily stats
  if (!statisticsData.dailyStats[dateKey]) {
    statisticsData.dailyStats[dateKey] = { plays: 0, time: 0 };
  }
  statisticsData.dailyStats[dateKey].plays++;
  
  saveStatistics();
}

// Track listening time (called periodically during playback)
function trackListeningTime(track, seconds) {
  if (!track || !track.id) return;
  
  const dateKey = new Date().toISOString().split('T')[0];
  
  statisticsData.totalListeningTime += seconds;
  console.log('[Statistics] Total listening time now:', statisticsData.totalListeningTime.toFixed(2), 'seconds');
  
  if (statisticsData.songPlays[track.id]) {
    statisticsData.songPlays[track.id].totalTime += seconds;
  }
  
  if (statisticsData.dailyStats[dateKey]) {
    statisticsData.dailyStats[dateKey].time += seconds;
  }
  
  saveStatistics();
}

// Save statistics to localStorage
function saveStatistics() {
  localStorage.setItem('statistics', JSON.stringify(statisticsData));
}

// Get top songs
function getTopSongs(limit = 10) {
  return Object.entries(statisticsData.songPlays)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([id, data]) => ({ id, ...data }));
}

// Get top artists
function getTopArtists(limit = 10) {
  return Object.entries(statisticsData.artistPlays)
    .sort((a, b) => {
      const countA = typeof a[1] === 'object' ? a[1].count : a[1];
      const countB = typeof b[1] === 'object' ? b[1].count : b[1];
      return countB - countA;
    })
    .slice(0, limit)
    .map(([name, data]) => {
      if (typeof data === 'object') {
        return { name, count: data.count, picture: data.picture };
      }
      // Legacy format compatibility
      return { name, count: data, picture: null };
    });
}

// Get recent activity (last 7 days)
function getRecentActivity(days = 7) {
  const result = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    
    result.unshift({
      date: dateKey,
      plays: statisticsData.dailyStats[dateKey]?.plays || 0,
      time: statisticsData.dailyStats[dateKey]?.time || 0
    });
  }
  
  return result;
}

// Format seconds to readable time
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// ============================================
// STATISTICS UI
// ============================================

function openStatistics() {
  // Now handled by showSection('statistics')
  if (typeof showSection === 'function') {
    showSection('statistics');
  }
}

function closeStatistics() {
  // Not needed anymore since it's a section, not a modal
  // Keep for backward compatibility
}

function updateStatisticsDisplay() {
  // Update overview stats
  document.getElementById('statTotalPlays').textContent = statisticsData.totalPlays.toLocaleString();
  document.getElementById('statTotalTime').textContent = formatTime(statisticsData.totalListeningTime);
  document.getElementById('statTopSong').textContent = getTopSongs(1)[0]?.title || 'None yet';
  document.getElementById('statTopArtist').textContent = getTopArtists(1)[0]?.name || 'None yet';
  
  // Update top songs list
  const topSongsList = document.getElementById('topSongsList');
  const topSongs = getTopSongs(10);
  topSongsList.innerHTML = topSongs.map((song, index) => `
    <div class="stat-item">
      <div class="stat-rank">#${index + 1}</div>
      <div class="stat-info">
        <div class="stat-title">${song.title}</div>
        <div class="stat-subtitle">${song.artist}</div>
      </div>
      <div class="stat-value">${song.count} plays</div>
    </div>
  `).join('');
  
  // Update top artists list
  const topArtistsList = document.getElementById('topArtistsList');
  const topArtists = getTopArtists(10);
  topArtistsList.innerHTML = topArtists.map((artist, index) => {
    let artistImage = '';
    if (artist.picture) {
      // TIDAL format artist picture
      artistImage = `https://resources.tidal.com/images/${artist.picture.replace(/-/g, '/')}/320x320.jpg`;
    }
    
    return `
      <div class="stat-item">
        <div class="stat-rank">#${index + 1}</div>
        ${artistImage ? `<img src="${artistImage}" alt="${artist.name}" class="stat-image" onerror="this.style.display='none'" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; margin-right: 10px;">` : ''}
        <div class="stat-info" style="flex: 1;">
          <div class="stat-title">${artist.name}</div>
        </div>
        <div class="stat-value">${artist.count} plays</div>
      </div>
    `;
  }).join('');
  
  // Update recent activity chart
  const recentActivity = getRecentActivity(7);
  const chartContainer = document.getElementById('activityChart');
  const maxPlays = Math.max(...recentActivity.map(d => d.plays), 1);
  
  chartContainer.innerHTML = recentActivity.map(day => {
    const height = (day.plays / maxPlays) * 100;
    const date = new Date(day.date);
    const dayName = date.toLocaleDateString('en', { weekday: 'short' });
    
    return `
      <div class="chart-bar">
        <div class="chart-bar-fill" style="height: ${height}%;" title="${day.plays} plays"></div>
        <div class="chart-label">${dayName}</div>
      </div>
    `;
  }).join('');
}

// ============================================
// PROFILE EXPORT/IMPORT
// ============================================

function exportProfile() {
  try {
    const profile = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      userName: localStorage.getItem('userName') || 'Flowify User',
      
      // Settings
      settings: {
        theme: localStorage.getItem('theme') || 'dark',
        language: localStorage.getItem('language') || 'en',
        audioQuality: localStorage.getItem('audioQuality') || '128',
        discordEnabled: localStorage.getItem('discordEnabled') || 'false',
        equalizerEnabled: localStorage.getItem('equalizerEnabled') || 'false',
        crossfadeEnabled: localStorage.getItem('crossfadeEnabled') || 'false',
        crossfadeDuration: localStorage.getItem('crossfadeDuration') || '3',
        visualizerEnabled: localStorage.getItem('visualizerEnabled') || 'false'
      },
      
      // User data
      likedSongs: JSON.parse(localStorage.getItem('likedSongs') || '[]'),
      playlists: JSON.parse(localStorage.getItem('playlists') || '[]'),
      listeningHistory: JSON.parse(localStorage.getItem('listeningHistory') || '[]'),
      
      // Statistics
      statistics: statisticsData
    };
    
    // Create download
    const dataStr = JSON.stringify(profile, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowify-profile-${profile.userName.replace(/\s+/g, '-')}-${Date.now()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    showNotification('Profile exported successfully!', 'success');
  } catch (error) {
    console.error('Error exporting profile:', error);
    showNotification('Failed to export profile', 'error');
  }
}

function importProfile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      
      const text = await file.text();
      const profile = JSON.parse(text);
      
      // Validate profile
      if (!profile.version || !profile.exportDate) {
        throw new Error('Invalid profile file');
      }
      
      // Confirm import
      if (!confirm(`Import profile from ${new Date(profile.exportDate).toLocaleDateString()}?\n\nThis will replace your current settings, playlists, and liked songs.`)) {
        return;
      }
      
      // Import settings
      Object.entries(profile.settings).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
      // Import user data
      localStorage.setItem('userName', profile.userName);
      localStorage.setItem('likedSongs', JSON.stringify(profile.likedSongs || []));
      localStorage.setItem('playlists', JSON.stringify(profile.playlists || []));
      localStorage.setItem('listeningHistory', JSON.stringify(profile.listeningHistory || []));
      
      // Import statistics
      if (profile.statistics) {
        statisticsData = profile.statistics;
        saveStatistics();
      }
      
      showNotification('Profile imported successfully! Refreshing...', 'success');
      
      // Reload app to apply changes
      setTimeout(() => {
        location.reload();
      }, 1500);
      
    } catch (error) {
      console.error('Error importing profile:', error);
      showNotification('Failed to import profile: ' + error.message, 'error');
    }
  };
  
  input.click();
}

// ============================================
// AUTO-TRACKING INTEGRATION
// ============================================

// Track playback time every 30 seconds
let trackingInterval = null;
let lastTrackingTime = 0;

function startPlaybackTracking(track) {
  if (trackingInterval) {
    clearInterval(trackingInterval);
  }
  
  lastTrackingTime = Date.now();
  trackSongPlay(track);
  
  console.log('[Statistics] Started tracking:', track.title);
  
  // Track listening time every 5 seconds for more accuracy
  trackingInterval = setInterval(() => {
    const now = Date.now();
    const elapsed = (now - lastTrackingTime) / 1000; // seconds
    lastTrackingTime = now;
    
    // Access player from global window scope
    const audioPlayer = window.player || document.getElementById('player');
    
    if (track && audioPlayer && !audioPlayer.paused) {
      console.log('[Statistics] Tracking time:', elapsed.toFixed(2), 'seconds');
      trackListeningTime(track, elapsed);
    } else {
      console.log('[Statistics] Not tracking - paused or no player');
    }
  }, 5000); // Every 5 seconds for better accuracy
}

function stopPlaybackTracking() {
  if (trackingInterval) {
    // Track any remaining time before stopping
    const audioPlayer = window.player || document.getElementById('player');
    
    if (lastTrackingTime > 0 && window.currentTrack && audioPlayer && !audioPlayer.paused) {
      const now = Date.now();
      const elapsed = (now - lastTrackingTime) / 1000;
      console.log('[Statistics] Final tracking before stop:', elapsed.toFixed(2), 'seconds');
      trackListeningTime(window.currentTrack, elapsed);
    }
    
    console.log('[Statistics] Stopped tracking');
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
}

// Albums functionality for Flowify

let currentAlbumData = null;
let albumSearchResults = [];

/**
 * Search for albums using the TIDAL API
 */
async function searchAlbums() {
  const query = document.getElementById('albumSearchInput').value.trim();
  
  if (!query) {
    showNotification('Please enter a search term', 'warning');
    return;
  }

  try {
    showNotification('Searching for albums...', 'info');
    
    const response = await fetch(`${HIFI_BASES[currentHifiIndex]}/search?type=album&query=${encodeURIComponent(query)}&limit=50`);
    
    if (!response.ok) {
      throw new Error('Failed to search albums');
    }

    const data = await response.json();
    
    console.log('Album search response:', data);
    
    if (data.albums && data.albums.length > 0) {
      albumSearchResults = data.albums;
      console.log('First album structure:', data.albums[0]);
      displayAlbums(data.albums);
      showNotification(`Found ${data.albums.length} albums`, 'success');
    } else {
      albumSearchResults = [];
      document.getElementById('albumsGrid').innerHTML = '';
      document.getElementById('albumsEmpty').style.display = 'flex';
      showNotification('No albums found', 'warning');
    }
  } catch (error) {
    console.error('Error searching albums:', error);
    showNotification('Failed to search albums', 'error');
    document.getElementById('albumsEmpty').style.display = 'flex';
  }
}

/**
 * Display albums in a grid layout
 */
function displayAlbums(albums) {
  const albumsGrid = document.getElementById('albumsGrid');
  const albumsEmpty = document.getElementById('albumsEmpty');
  
  if (!albums || albums.length === 0) {
    albumsGrid.innerHTML = '';
    albumsEmpty.style.display = 'flex';
    return;
  }

  albumsEmpty.style.display = 'none';
  
  albumsGrid.innerHTML = albums.map(album => {
    const coverUrl = album.cover 
      ? `https://resources.tidal.com/images/${album.cover.replace(/-/g, '/')}/640x640.jpg`
      : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjNDQ0Ii8+PHRleHQgeD0iMTAwIiB5PSIxMDAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmb250LXNpemU9IjE0IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+4pmrPC90ZXh0Pjwvc3ZnPg==';
    
    const artistName = album.artist?.name || 'Unknown Artist';
    const year = album.releaseDate ? new Date(album.releaseDate).getFullYear() : '';
    const trackCount = album.numberOfTracks || 0;
    
    return `
      <div class="album-card" onclick="openAlbum('${album.id}')" data-album-id="${album.id}">
        <div class="album-card-cover">
          <img src="${coverUrl}" alt="${album.title}" loading="lazy" 
               onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjNDQ0Ii8+PHRleHQgeD0iMTAwIiB5PSIxMDAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmb250LXNpemU9IjE0IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+4pmrPC90ZXh0Pjwvc3ZnPg=='; this.style.backgroundColor='#444';" />
          <div class="album-card-overlay">
            <button class="album-play-btn" onclick="event.stopPropagation(); playAlbumById('${album.id}')">
              <i class="fas fa-play"></i>
            </button>
          </div>
        </div>
        <div class="album-card-info">
          <h3 class="album-card-title" title="${album.title}">${album.title}</h3>
          <p class="album-card-artist" title="${artistName}">${artistName}</p>
          <p class="album-card-meta">${year ? year + ' • ' : ''}${trackCount} tracks</p>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Open album detail view
 */
async function openAlbum(albumId, albumTitle = null) {
  try {
    if (!albumId) {
      showNotification('Album information not available', 'warning');
      return;
    }
    
    console.log('Loading album with ID:', albumId);
    showNotification('Loading album...', 'info');
    
    // First check if we have this album in search results
    let albumData = albumSearchResults.find(a => String(a.id) === String(albumId));
    
    if (albumData) {
      console.log('Found album in search results:', albumData);
      // If album has tracks already, use it directly
      if (albumData.tracks && albumData.tracks.length > 0) {
        console.log('Album already has tracks');
        currentAlbumData = albumData;
        displayAlbumDetails(albumData);
        return;
      }
    }
    
    // Otherwise try to fetch album details from the TIDAL proxy API
    // These HIFI_BASES servers ARE the "Digger API" - they proxy TIDAL data
    let response;
    
    try {
      const url = `${HIFI_BASES[currentHifiIndex]}/album/?id=${albumId}`;
      console.log('Fetching album from TIDAL proxy:', url);
      response = await fetch(url);
      
      if (response.ok) {
        albumData = await response.json();
        console.log('Album data received:', albumData);
      } else {
        console.log('TIDAL proxy returned status:', response.status);
        // Try next endpoint
        if (rotateHifiEndpoint()) {
          console.log('Retrying with next TIDAL proxy server...');
          return openAlbum(albumId, albumTitle);
        }
      }
    } catch (e) {
      console.log('Failed to fetch album:', e);
    }
    
    // If we still don't have valid data, use what we have from search
    if (!albumData || (!albumData.tracks && !albumData.items)) {
      albumData = albumSearchResults.find(a => String(a.id) === String(albumId));
      if (!albumData) {
        throw new Error('Album not found in search results and API fetch failed');
      }
      console.log('Using album from search results (no tracks available from API)');
    }
    
    currentAlbumData = albumData;
    displayAlbumDetails(albumData);
    
  } catch (error) {
    console.error('Error loading album:', error);
    showNotification('Failed to load album', 'error');
  }
}

/**
 * Display album details in the UI
 */
function displayAlbumDetails(albumData) {
  const finalData = albumData;
  
  console.log('Displaying album details:', finalData);
  
  // Update album detail UI
  const coverUrl = finalData.cover 
    ? `https://resources.tidal.com/images/${finalData.cover.replace(/-/g, '/')}/1280x1280.jpg`
    : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjNDQ0Ii8+PHRleHQgeD0iMTAwIiB5PSIxMDAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmb250LXNpemU9IjE0IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+4pmrPC90ZXh0Pjwvc3ZnPg==';
    
    const albumCoverImg = document.getElementById('albumDetailCover');
    albumCoverImg.src = coverUrl;
    albumCoverImg.onerror = function() {
      this.onerror = null;
      this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjNDQ0Ii8+PHRleHQgeD0iMTAwIiB5PSIxMDAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmb250LXNpemU9IjE0IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+4pmrPC90ZXh0Pjwvc3ZnPg==';
      this.style.backgroundColor = '#444';
    };
    document.getElementById('albumDetailTitle').textContent = finalData.title || 'Unknown Album';
    document.getElementById('albumDetailArtist').textContent = finalData.artist?.name || 'Unknown Artist';
    document.getElementById('albumDetailArtist').style.cursor = 'pointer';
    document.getElementById('albumDetailArtist').onclick = () => {
      if (finalData.artist?.id) {
        openArtistPage(finalData.artist.id);
      }
    };
    
    const year = finalData.releaseDate ? new Date(finalData.releaseDate).getFullYear() : '';
    const duration = finalData.duration ? formatDuration(finalData.duration) : '';
    document.getElementById('albumDetailYear').textContent = year || '';
    document.getElementById('albumDetailCount').textContent = `${finalData.numberOfTracks || 0} tracks${duration ? ' • ' + duration : ''}`;
    
    // Display tracks
    displayAlbumTracks(finalData.tracks || []);
    
    // Show album detail section
    showSection('album-detail');
    
    // Force display because of inline style in HTML
    const albumDetailSection = document.getElementById('album-detail');
    if (albumDetailSection) {
      albumDetailSection.style.display = 'block';
    }
    
    // Update navbar
    const navBackBtn = document.getElementById('navBackBtn');
    if (navBackBtn) navBackBtn.style.display = 'flex';
    const navbarTitle = document.getElementById('navbarTitle');
    if (navbarTitle) navbarTitle.innerHTML = '<i class="fas fa-compact-disc"></i> Album';
    
    showNotification('Album loaded', 'success');
}

/**
 * Open album from a track/song (using album ID from track data)
 */
async function openAlbumFromTrack(track) {
  if (track && track.album && track.album.id) {
    await openAlbum(track.album.id);
  } else {
    showNotification('Album information not available', 'warning');
  }
}

/**
 * Display album tracks
 */
function displayAlbumTracks(tracks) {
  const tracksContainer = document.getElementById('albumDetailTracks');
  
  if (!tracks || tracks.length === 0) {
    tracksContainer.innerHTML = '<p style="text-align: center; opacity: 0.6;">No tracks available</p>';
    return;
  }

  tracksContainer.innerHTML = tracks.map((track, index) => {
    const duration = track.duration ? formatDuration(track.duration) : '--:--';
    const isLiked = likedSongs.some(s => String(s.id) === String(track.id));
    const likeIcon = isLiked ? 'fas fa-heart' : 'far fa-heart';
    
    return `
      <div class="track-item" data-track-id="${track.id}">
        <div class="track-number">${track.trackNumber || index + 1}</div>
        <div class="track-info">
          <div class="track-title">${track.title}</div>
          <div class="track-artist">${track.artist?.name || 'Unknown Artist'}</div>
        </div>
        <div class="track-duration">${duration}</div>
        <div class="track-actions">
          <button class="icon-btn like-btn" onclick="toggleLikeAlbumTrack('${track.id}')" title="Like">
            <i class="${likeIcon}" id="like-${track.id}"></i>
          </button>
          <button class="icon-btn" onclick="addAlbumTrackToQueue('${track.id}')" title="Add to queue">
            <i class="fas fa-plus"></i>
          </button>
          <button class="icon-btn" onclick="playAlbumTrack(${index})" title="Play">
            <i class="fas fa-play"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Play entire album
 */
async function playAlbum() {
  if (!currentAlbumData || !currentAlbumData.tracks || currentAlbumData.tracks.length === 0) {
    showNotification('No tracks to play', 'warning');
    return;
  }

  currentPlaylist = currentAlbumData.tracks;
  currentIndex = 0;
  await loadAndPlay(currentPlaylist[0]);
  showNotification(`Playing ${currentAlbumData.title}`, 'success');
}

/**
 * Play album by ID (from grid)
 */
async function playAlbumById(albumId) {
  try {
    const response = await fetch(`${HIFI_BASES[currentHifiIndex]}/album/?id=${albumId}`);
    if (!response.ok) {
      // Try rotating to next endpoint on error
      if (rotateHifiEndpoint()) {
        console.log('[playAlbumById] Retrying with new endpoint...');
        return playAlbumById(albumId); // Retry with new endpoint
      }
      throw new Error('Failed to load album');
    }
    
    const data = await response.json();
    if (data.tracks && data.tracks.length > 0) {
      currentPlaylist = data.tracks;
      currentIndex = 0;
      await loadAndPlay(currentPlaylist[0]);
      showNotification(`Playing ${data.title}`, 'success');
    }
  } catch (error) {
    console.error('Error playing album:', error);
    showNotification('Failed to play album', 'error');
  }
}

/**
 * Play specific track from album
 */
async function playAlbumTrack(index) {
  if (!currentAlbumData || !currentAlbumData.tracks) return;
  
  currentPlaylist = currentAlbumData.tracks;
  currentIndex = index;
  await loadAndPlay(currentPlaylist[index]);
}

/**
 * Add album to queue
 */
function addAlbumToQueue() {
  if (!currentAlbumData || !currentAlbumData.tracks || currentAlbumData.tracks.length === 0) {
    showNotification('No tracks to add', 'warning');
    return;
  }

  currentPlaylist.push(...currentAlbumData.tracks);
  showNotification(`Added ${currentAlbumData.tracks.length} tracks to queue`, 'success');
  updateQueue();
}

/**
 * Add specific album track to queue
 */
function addAlbumTrackToQueue(trackId) {
  if (!currentAlbumData || !currentAlbumData.tracks) return;
  
  const track = currentAlbumData.tracks.find(t => String(t.id) === String(trackId));
  if (track) {
    currentPlaylist.push(track);
    showNotification(`Added "${track.title}" to queue`, 'success');
    updateQueue();
  }
}

/**
 * Toggle like for album track
 */
function toggleLikeAlbumTrack(trackId) {
  toggleLike(trackId);
  
  // Update the icon in the album track list
  const likeBtn = document.querySelector(`#albumDetailTracks .track-item[data-track-id="${trackId}"] .like-btn i`);
  if (likeBtn) {
    const isLiked = likedSongs.some(s => String(s.id) === String(trackId));
    likeBtn.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
  }
}

/**
 * Save album as playlist
 */
function saveAlbumAsPlaylist() {
  if (!currentAlbumData || !currentAlbumData.tracks || currentAlbumData.tracks.length === 0) {
    showNotification('No tracks to save', 'warning');
    return;
  }

  const playlistName = prompt(`Save "${currentAlbumData.title}" as playlist:`, currentAlbumData.title);
  
  if (playlistName && playlistName.trim()) {
    const newPlaylist = {
      id: Date.now(),
      name: playlistName.trim(),
      description: `Album by ${currentAlbumData.artist?.name || 'Unknown Artist'}`,
      tracks: currentAlbumData.tracks,
      createdAt: new Date().toISOString()
    };
    
    playlists.push(newPlaylist);
    localStorage.setItem('playlists', JSON.stringify(playlists));
    showNotification('Playlist created successfully', 'success');
  }
}

/**
 * Back from album view
 */
function backFromAlbum() {
  goBack();
  currentAlbumData = null;
}

/**
 * Format duration from seconds to MM:SS or HH:MM:SS
 */
function formatDuration(seconds) {
  if (!seconds) return '--:--';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Enter key support for album search
document.addEventListener('DOMContentLoaded', () => {
  const albumSearchInput = document.getElementById('albumSearchInput');
  if (albumSearchInput) {
    albumSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchAlbums();
      }
    });
  }
});

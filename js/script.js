// Global variables
let currentTrack = null;
let isPlaying = false;
let isShuffled = false;
let repeatMode = 0; // 0: no repeat, 1: repeat all, 2: repeat one
let currentPlaylist = [];
let currentIndex = 0;
let isPlayingFromRecommendations = false; // Track if playing from recommendations
let likedSongs = JSON.parse(localStorage.getItem('likedSongs') || '[]');
let playlists = JSON.parse(localStorage.getItem('playlists') || '[]');
let downloads = JSON.parse(localStorage.getItem('downloads') || '[]');
let audioQuality = localStorage.getItem('audioQuality') || 'LOSSLESS';
let currentTheme = localStorage.getItem('theme') || 'dark';
let discordRPCEnabled = JSON.parse(localStorage.getItem('discordRPCEnabled') || 'true');
let musicAPI = localStorage.getItem('musicAPI') || 'digger'; // 'ytmusic' or 'digger'
let navigationHistory = [];
let currentArtistId = null;
let cachedVolume = parseFloat(localStorage.getItem('volume') || '0.3');
let cachedProgress = parseFloat(localStorage.getItem('lastProgress') || '0');
let isCrossfading = false; // guard against concurrent crossfades
let isUserPausing = false;  // true only when pause is initiated by user
let suppressPlaybackAlerts = false; // mute intrusive alerts during transitions

// Music providers (fallback order)
const HIFI_BASES = [
  'https://frankfurt.monochrome.tf',
  'https://hifi.401658.xyz',
  'https://virginia.monochrome.tf',
  'https://ohio.monochrome.tf',
  'https://singapore.monochrome.tf',
  'https://california.monochrome.tf',
  'https://oregon.monochrome.tf',
  'https://jakarta.monochrome.tf',
  'https://tokyo.monochrome.tf',
  'https://tidal.401658.xyz',
  'https://hund.qqdl.site',
  'https://katze.qqdl.site',
  'https://vogel.qqdl.site',
  'https://maus.qqdl.site',
  'https://wolf.qqdl.site'
];

// Current active HiFi endpoint index
let currentHifiIndex = 0;
let lastHifiCheck = 0;
const HIFI_RETRY_DELAY = 60000; // Try same endpoint for 1 minute before rotating on failure

// API Endpoints
const API_ENDPOINTS = {
  ytmusic: {
    search: 'https://music.youtube.com/youtubei/v1/search',
    player: 'https://music.youtube.com/youtubei/v1/player',
    next: 'https://music.youtube.com/youtubei/v1/next'
  },
  digger: {
    get search() { return `${HIFI_BASES[currentHifiIndex]}/search`; },
    get track() { return `${HIFI_BASES[currentHifiIndex]}/track`; },
    get album() { return `${HIFI_BASES[currentHifiIndex]}/album`; }
  }
};

// Rotate to next HiFi endpoint on failure
function rotateHifiEndpoint() {
  const now = Date.now();
  // Only rotate if enough time has passed since last check
  if (now - lastHifiCheck < HIFI_RETRY_DELAY) {
    return false; // Don't rotate yet
  }
  lastHifiCheck = now;
  currentHifiIndex = (currentHifiIndex + 1) % HIFI_BASES.length;
  console.log(`[HiFi] Rotated to fallback endpoint ${currentHifiIndex + 1}/${HIFI_BASES.length}: ${HIFI_BASES[currentHifiIndex]}`);
  return true;
}

// YouTube InnerTube context (like OuterTune uses)
const INNERTUBE_CONTEXT = {
  client: {
    clientName: 'WEB_REMIX',
    clientVersion: '1.20241202.01.00',
    hl: 'en',
    gl: 'US'
  }
};

// Use ANDROID_VR client for player requests (doesn't require auth!)
const INNERTUBE_PLAYER_CONTEXT = {
  client: {
    clientName: 'ANDROID_VR',
    clientVersion: '1.61.48',
    androidSdkVersion: 30,
    hl: 'en',
    gl: 'US'
  }
};

// Special playlist IDs
const LIKED_SONGS_PLAYLIST_ID = '__liked_songs__';

// Suggestions infinite scroll state
let suggestionsPool = [];
let displayedSuggestions = 0;
let isLoadingMoreSuggestions = false;

let player = null;

// Expose globally for statistics tracking
window.player = player;
window.currentTrack = currentTrack;

// Cached DOM elements (initialized after DOM ready)
const DOM = {
  playBtn: null,
  progressBar: null,
  currentTime: null,
  duration: null,
  volumeSlider: null,
  searchResults: null,
  trendingGrid: null,
  suggestionsGrid: null,
  init() {
    this.playBtn = document.getElementById('playBtn');
    this.progressBar = document.getElementById('progressBar');
    this.currentTime = document.getElementById('currentTime');
    this.duration = document.getElementById('duration');
    this.volumeSlider = document.getElementById('volumeSlider');
    this.searchResults = document.getElementById('searchResults');
    this.trendingGrid = document.getElementById('trendingGrid');
    this.suggestionsGrid = document.getElementById('suggestionsGrid');
  }
};

// Debug mode check (only log in development)
const DEBUG_MODE = !window.electronAPI || localStorage.getItem('debugMode') === 'true';
const debugLog = (...args) => DEBUG_MODE && console.log(...args);
const debugError = (...args) => console.error(...args); // Always log errors

// Normalize track data from YouTube InnerTube API (like OuterTune)
function normalizeTrackFromInnerTube(renderer) {
  if (!renderer) return null;
  
  try {
    // Extract video ID
    const videoId = renderer.playlistItemData?.videoId || renderer.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
    if (!videoId) {
      console.warn('[normalizeTrackFromInnerTube] No video ID found', renderer);
      return null;
    }
    
    // Extract title
    const title = renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text;
    if (!title) {
      console.warn('[normalizeTrackFromInnerTube] No title found', renderer);
      return null;
    }
    
    // Extract artist info (from flex column 1)
    const flexColumn1 = renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
    const artistName = flexColumn1.find(run => run.navigationEndpoint?.browseEndpoint)?.text || flexColumn1[0]?.text || 'Unknown Artist';
    const artistId = flexColumn1.find(run => run.navigationEndpoint?.browseEndpoint)?.navigationEndpoint?.browseEndpoint?.browseId;
    
    // Extract album info
    const albumRun = flexColumn1.find(run => 
      run.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType === 'MUSIC_PAGE_TYPE_ALBUM'
    );
    const albumName = albumRun?.text;
    const albumId = albumRun?.navigationEndpoint?.browseEndpoint?.browseId;
    
    // Extract thumbnail
    const thumbnailUrl = renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url;
    
    // Extract duration
    const durationText = renderer.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]?.text;
    let duration = 0;
    if (durationText) {
      const parts = durationText.split(':').map(p => parseInt(p));
      if (parts.length === 2) {
        duration = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    }
    
    return {
      id: videoId,
      title: title,
      artist: {
        id: artistId,
        name: artistName
      },
      album: {
        id: albumId,
        name: albumName || title,
        cover: thumbnailUrl || ''
      },
      duration: duration
    };
  } catch (error) {
    console.error('[normalizeTrackFromInnerTube] Error normalizing track:', error, renderer);
    return null;
  }
}

// Normalize track data from different APIs to a consistent format
function normalizeTrack(track, apiType) {
  if (!track) return null;
  
  // Digger API format (already correct)
  if (apiType === 'digger') {
    return track;
  }
  
  // YouTube Music API format - normalize to Digger format
  if (apiType === 'ytmusic') {
    return {
      id: track.videoId || track.id,
      title: track.title || track.name,
      artist: {
        name: track.artist || (track.artists && track.artists[0]?.name) || 'Unknown Artist'
      },
      album: {
        cover: track.thumbnail || track.thumbnails?.[0]?.url || track.cover || ''
      },
      duration: track.duration || track.lengthSeconds || 0
    };
  }
  
  return track;
}

// Music API Functions
async function searchMusic(query) {
  const endpoint = API_ENDPOINTS[musicAPI];
  console.log(`[searchMusic] Using ${musicAPI} API:`, endpoint.search);
  
  try {
    if (musicAPI === 'ytmusic') {
      const url = endpoint.search + '?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30&prettyPrint=false';
      console.log('[searchMusic] YT Music InnerTube URL:', url);
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Format-Version': '1',
          'X-YouTube-Client-Name': '67',
          'X-YouTube-Client-Version': '1.20241202.01.00',
          'Origin': 'https://music.youtube.com',
          'Referer': 'https://music.youtube.com/'
        },
        body: JSON.stringify({
          context: INNERTUBE_CONTEXT,
          query: query,
          params: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D' // Song filter like OuterTune
        })
      });
      
      console.log('[searchMusic] YT Music Response status:', res.status);
      
      if (!res.ok) {
        console.error('[searchMusic] YT Music HTTP error:', res.status, res.statusText);
        const errorText = await res.text();
        console.error('[searchMusic] Error response:', errorText);
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data = await res.json();
      console.log('[searchMusic] YT Music InnerTube raw response:', data);
      
      // Parse InnerTube response (like OuterTune does)
      const items = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]
        ?.tabRenderer?.content?.sectionListRenderer?.contents
        ?.flatMap(section => 
          section.musicShelfRenderer?.contents?.map(content =>
            content.musicResponsiveListItemRenderer
          ).filter(Boolean) || []
        ) || [];
      
      console.log('[searchMusic] YT Music: Found', items.length, 'items');
      
      // Normalize all tracks to consistent format
      const normalizedItems = items.map(item => normalizeTrackFromInnerTube(item)).filter(t => t !== null);
      console.log('[searchMusic] YT Music: Normalized', normalizedItems.length, 'items');
      if (normalizedItems.length > 0) {
        console.log('[searchMusic] YT Music: Sample normalized item:', normalizedItems[0]);
      }
      return { items: normalizedItems };
    } else {
      const url = `${endpoint.search}/?s=${encodeURIComponent(query)}`;
      console.log('[searchMusic] Digger URL:', url);
      
      try {
        const res = await fetch(url);
        console.log('[searchMusic] Digger Response status:', res.status);
        
        if (!res.ok) {
          console.error('[searchMusic] Digger HTTP error:', res.status, res.statusText);
          // Try rotating to next endpoint on error
          if (rotateHifiEndpoint()) {
            console.log('[searchMusic] Retrying with new endpoint...');
            return searchMusic(query); // Retry with new endpoint
          }
          throw new Error(`HTTP ${res.status}`);
        }
        
        const data = await res.json();
        console.log('[searchMusic] Digger raw response:', data);
        return data;
      } catch (error) {
        console.error('[searchMusic] Digger fetch error:', error);
        // Try rotating to next endpoint on network error
        if (rotateHifiEndpoint()) {
          console.log('[searchMusic] Retrying with new endpoint after network error...');
          return searchMusic(query); // Retry with new endpoint
        }
        throw error;
      }
    }
  } catch (error) {
    console.error('[searchMusic] Error:', error);
    return { items: [] };
  }
}

// Search for artists
async function searchArtists(query) {
  try {
    const url = `${HIFI_BASES[currentHifiIndex]}/search/?a=${encodeURIComponent(query)}`;
    console.log('[searchArtists] URL:', url);
    const response = await fetch(url);
    if (!response.ok) {
      console.log('[searchArtists] Response not OK:', response.status);
      return { artists: { items: [] } };
    }
    let data = await response.json();
    console.log('[searchArtists] Raw response:', JSON.stringify(data, null, 2));
    
    // API returns data wrapped in an array: [{artists: {...}}]
    if (Array.isArray(data) && data.length > 0) {
      data = data[0];
    }
    
    console.log('[searchArtists] Response keys:', Object.keys(data));
    
    // Return the data as-is, the search function will handle it
    return data;
  } catch (error) {
    console.error('[searchArtists] Error:', error);
    return { artists: { items: [] } };
  }
}

// Search for albums
async function searchAlbums(query) {
  try {
    const url = `${HIFI_BASES[currentHifiIndex]}/search/?al=${encodeURIComponent(query)}`;
    console.log('[searchAlbums] URL:', url);
    const response = await fetch(url);
    if (!response.ok) {
      console.log('[searchAlbums] Response not OK:', response.status);
      return { albums: { items: [] } };
    }
    let data = await response.json();
    console.log('[searchAlbums] Raw response:', JSON.stringify(data, null, 2));
    
    // API returns data wrapped in an array: [{albums: {...}}]
    if (Array.isArray(data) && data.length > 0) {
      data = data[0];
    }
    
    console.log('[searchAlbums] Response keys:', Object.keys(data));
    
    // Return the data as-is, the search function will handle it
    return data;
  } catch (error) {
    console.error('[searchAlbums] Error:', error);
    return { albums: { items: [] } };
  }
}

// Create artist gallery item
function createArtistGalleryItem(artist) {
  console.log('[createArtistGalleryItem] Artist data:', artist);
  
  const div = document.createElement('div');
  div.className = 'gallery-item';
  
  // API structure: {id, name, picture}
  const artistId = artist.id || '';
  const artistName = artist.name || 'Unknown Artist';
  const artistPicture = artist.picture || '';
  
  if (artistId) {
    div.onclick = () => openArtistPage(artistId);
  }
  
  // Build image URL from picture field
  let imageUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiM0NDQiLz48dGV4dCB4PSIxMDAiIHk9IjEwMCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZvbnQtc2l6ZT0iNjAiPjxzdmcgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjOTk5IiBkPSJNMTIsMTJjMi4yMSwwLDQtMS43OSw0LTRzLTEuNzktNC00LTRzLTQsMS43OS00LDRTOS43OSwxMiwxMiwxMnogTTEyLDE0Yy0yLjY3LDAtOCwxLjM0LTgsNHYyaDE2di0yIEMyMCwxNS4zNCwxNC42NywxNCwxMiwxNHoiLz48L3N2Zz48L3RleHQ+PC9zdmc+';
  
  if (artistPicture) {
    imageUrl = `https://resources.tidal.com/images/${artistPicture.replace(/-/g, '/')}/320x320.jpg`;
  }
  
  div.innerHTML = `
    <img class="gallery-item-image" src="${imageUrl}" alt="${artistName}" style="border-radius: 50%;" />
    <div class="gallery-item-info">
      <div class="gallery-item-title">${artistName}</div>
      <div class="gallery-item-subtitle">Artist</div>
    </div>
  `;
  
  return div;
}

// Create album gallery item
function createAlbumGalleryItem(album) {
  console.log('[createAlbumGalleryItem] Album data:', album);
  
  const div = document.createElement('div');
  div.className = 'gallery-item';
  
  // API structure: {id, title, cover, artists: [{id, name, picture}]}
  const albumId = album.id || '';
  const albumTitle = album.title || 'Unknown Album';
  const albumCover = album.cover || '';
  const artistName = (album.artists && album.artists.length > 0) ? album.artists[0].name : 'Unknown Artist';
  
  // Handle album click - use album ID
  div.onclick = () => openAlbum(albumId);
  
  // Build image URL from cover field
  let imageUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjNDQ0Ii8+PHRleHQgeD0iMTAwIiB5PSIxMDAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmb250LXNpemU9IjE0IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+4pmrPC90ZXh0Pjwvc3ZnPg==';
  
  if (albumCover) {
    imageUrl = `https://resources.tidal.com/images/${albumCover.replace(/-/g, '/')}/320x320.jpg`;
  }
  
  div.innerHTML = `
    <img class="gallery-item-image" src="${imageUrl}" alt="${albumTitle}" />
    <div class="gallery-item-info">
      <div class="gallery-item-title">${albumTitle}</div>
      <div class="gallery-item-subtitle">${artistName}</div>
    </div>
  `;
  
  return div;
}

// Open artist page
async function openArtistPage(artistId) {
  try {
    const url = `${HIFI_BASES[currentHifiIndex]}/artist/${artistId}`;
    console.log('[openArtistPage] URL:', url);
    const response = await fetch(url);
    if (!response.ok) {
      showToast('Failed to load artist details');
      return;
    }
    const artist = await response.json();
    
    // Show artist modal or page - for now, search their music
    document.getElementById('searchInput').value = artist.name;
    search(artist.name);
    showToast(`Showing music by ${artist.name}`);
  } catch (error) {
    console.error('[openArtistPage] Error:', error);
    showToast('Failed to load artist');
  }
}

// Scroll gallery left or right
function scrollGallery(galleryId, direction) {
  const gallery = document.getElementById(galleryId);
  console.log('[scrollGallery] Gallery:', galleryId, 'Direction:', direction, 'Element:', gallery);
  if (!gallery) {
    console.error('[scrollGallery] Gallery not found:', galleryId);
    return;
  }
  
  const scrollAmount = 350; // Scroll by ~2 items (160px + 20px gap)
  const newScrollLeft = gallery.scrollLeft + (direction * scrollAmount);
  console.log('[scrollGallery] Current scroll:', gallery.scrollLeft, 'New scroll:', newScrollLeft);
  
  gallery.scrollBy({
    left: direction * scrollAmount,
    behavior: 'smooth'
  });
  
  // Log after scroll
  setTimeout(() => {
    console.log('[scrollGallery] Scroll after:', gallery.scrollLeft);
  }, 300);
}

// Define multiple client options for fallback
const YOUTUBE_CLIENTS = {
  IOS: {
    context: {
      client: {
        clientName: 'IOS',
        clientVersion: '20.10.4',
        deviceMake: 'Apple',
        deviceModel: 'iPhone16,2',
        hl: 'en',
        gl: 'US',
        osName: 'iOS',
        osVersion: '18.3.2.22D82'
      }
    },
    headers: {
      'X-YouTube-Client-Name': '5',
      'X-YouTube-Client-Version': '20.10.4',
      'User-Agent': 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)'
    }
  },
  TVHTML5: {
    context: {
      client: {
        clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
        clientVersion: '2.0',
        hl: 'en',
        gl: 'US'
      },
      thirdParty: {
        embedUrl: 'https://www.youtube.com'
      }
    },
    headers: {
      'X-YouTube-Client-Name': '85',
      'X-YouTube-Client-Version': '2.0',
      'User-Agent': 'Mozilla/5.0 (PlayStation; PlayStation 4/12.02) AppleWebKit/605.1.15'
    }
  }
};

async function getTrackURL(id, quality = audioQuality) {
  try {
    const endpoint = API_ENDPOINTS[musicAPI];
    if (musicAPI === 'ytmusic') {
      console.log('[getTrackURL] Fetching stream URL for video:', id);
      
      // Try different clients in order until one works
      const clientsToTry = ['IOS', 'TVHTML5'];
      
      for (const clientName of clientsToTry) {
        console.log(`[getTrackURL] Trying client: ${clientName}`);
        const client = YOUTUBE_CLIENTS[clientName];
        
        try {
          const url = endpoint.player + '?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30&prettyPrint=false';
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Format-Version': '1',
              ...client.headers,
              'Origin': 'https://www.youtube.com'
            },
            body: JSON.stringify({
              context: client.context,
              videoId: id
            })
          });
          
          console.log(`[getTrackURL] ${clientName} response status:`, res.status);
          if (!res.ok) {
            console.warn(`[getTrackURL] ${clientName} failed with status ${res.status}, trying next client...`);
            continue;
          }
          
          const data = await res.json();
          
          // Check if playability is OK
          if (data.playabilityStatus?.status !== 'OK') {
            console.warn(`[getTrackURL] ${clientName} playability:`, data.playabilityStatus?.status);
            continue;
          }
          
          // Get audio formats
          const formats = data.streamingData?.adaptiveFormats || [];
          const audioFormats = formats.filter(f => f.mimeType?.includes('audio'));
          
          if (audioFormats.length === 0) {
            console.warn(`[getTrackURL] ${clientName} no audio formats, trying next...`);
            continue;
          }
          
          // Select best format
          const webmOpus = audioFormats.find(f => f.mimeType?.includes('webm') && f.mimeType?.includes('opus'));
          const mp4Aac = audioFormats.find(f => f.mimeType?.includes('mp4') && f.mimeType?.includes('mp4a'));
          const bestFormat = webmOpus || mp4Aac || audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
          
          if (!bestFormat.url) {
            console.warn(`[getTrackURL] ${clientName} no direct URL, trying next...`);
            continue;
          }
          
          console.log(`[getTrackURL] ${clientName} SUCCESS! URL:`, bestFormat.url.substring(0, 100) + '...');
          return bestFormat.url;
        } catch (clientError) {
          console.warn(`[getTrackURL] ${clientName} error:`, clientError);
          continue;
        }
      }
      
      // All clients failed
      alert('YouTube Music: Could not play this song.\n\nPlease use "Digger API" in Settings instead.');
      throw new Error('All YouTube clients failed');
    } else {
      try {
        const res = await fetch(`${endpoint.track}/?id=${id}&quality=${quality}`);
        if (!res.ok) {
          console.error('[getTrackURL] Digger HTTP error:', res.status);
          // Try rotating to next endpoint on error
          if (rotateHifiEndpoint()) {
            console.log('[getTrackURL] Retrying with new endpoint...');
            return getTrackURL(id, quality); // Retry with new endpoint
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        return data.find(obj => obj.OriginalTrackUrl)?.OriginalTrackUrl;
      } catch (error) {
        console.error('[getTrackURL] Digger fetch error:', error);
        // Try rotating to next endpoint on network error
        if (rotateHifiEndpoint()) {
          console.log('[getTrackURL] Retrying with new endpoint after network error...');
          return getTrackURL(id, quality); // Retry with new endpoint
        }
        throw error;
      }
    }
  } catch (error) {
    console.error('Track URL error:', error);
    return null;
  }
}

// Notification System
function showNotification(title, message, type = 'info', onClick = null) {
  // Remove any existing notification
  const existing = document.querySelector('.app-notification');
  if (existing) {
    existing.remove();
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `app-notification notification-${type}`;
  
  const iconMap = {
    'info': 'fa-info-circle',
    'success': 'fa-check-circle',
    'warning': 'fa-exclamation-triangle',
    'error': 'fa-exclamation-circle'
  };
  
  notification.innerHTML = `
    <div class="notification-icon">
      <i class="fas ${iconMap[type] || iconMap.info}"></i>
    </div>
    <div class="notification-content">
      <div class="notification-title">${title}</div>
      <div class="notification-message">${message}</div>
    </div>
    <button class="notification-close" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  // Add click handler if provided
  if (onClick) {
    notification.style.cursor = 'pointer';
    notification.addEventListener('click', (e) => {
      if (!e.target.closest('.notification-close')) {
        onClick();
        notification.remove();
      }
    });
  }
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Auto-remove after 8 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 8000);
}

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
    
    // Use setTimeout to ensure DOM is fully ready
    setTimeout(() => {
      initializeNameInput();
    }, 100);
  }
}

function initializeNameInput() {
  const nameInput = document.getElementById('welcomeNameInput');
  if (!nameInput) {
    // Retry if input not found
    setTimeout(initializeNameInput, 100);
    return;
  }
  
  // Clear any existing value
  nameInput.value = '';
  
  // Remove any blocking attributes
  nameInput.removeAttribute('readonly');
  nameInput.removeAttribute('disabled');
  nameInput.disabled = false;
  nameInput.readOnly = false;
  
  // Force all pointer and interaction styles
  nameInput.style.pointerEvents = 'auto';
  nameInput.style.cursor = 'text';
  nameInput.style.userSelect = 'text';
  nameInput.style.webkitUserSelect = 'text';
  nameInput.style.webkitAppRegion = 'no-drag';
  nameInput.style.zIndex = '99999';
  nameInput.style.position = 'relative';
  nameInput.style.background = 'rgba(255, 255, 255, 0.05)';
  nameInput.style.color = 'var(--text-primary)';
  
  // Force parent containers to be non-draggable
  let parent = nameInput.parentElement;
  while (parent && parent !== document.body) {
    parent.style.webkitAppRegion = 'no-drag';
    parent.style.pointerEvents = 'auto';
    parent = parent.parentElement;
  }
  
  // Remove old event listeners by cloning and replacing
  const newInput = nameInput.cloneNode(true);
  nameInput.parentNode.replaceChild(newInput, nameInput);
  
  // Forcefully enable on every interaction
  ['click', 'focus', 'mousedown', 'touchstart'].forEach(eventType => {
    newInput.addEventListener(eventType, function(e) {
      this.disabled = false;
      this.readOnly = false;
      this.style.pointerEvents = 'auto';
      this.style.cursor = 'text';
      if (eventType === 'click' || eventType === 'mousedown') {
        setTimeout(() => this.focus(), 0);
      }
      e.stopPropagation();
    }, true);
  });
  
  // Allow Enter key to submit
  newInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      completeOnboarding();
    }
  });
  
  // Add input event for debugging
  newInput.addEventListener('input', (e) => {
    debugLog('Input value changed:', e.target.value);
  });
  
  // Focus on name input after animation - multiple attempts
  setTimeout(() => {
    newInput.disabled = false;
    newInput.readOnly = false;
    newInput.focus();
    newInput.click();
    debugLog('Name input focused. Editable:', !newInput.readOnly && !newInput.disabled);
  }, 500);
  
  setTimeout(() => {
    newInput.disabled = false;
    newInput.readOnly = false;
    newInput.focus();
  }, 1000);
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

function importProfileFromWelcome() {
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
        alert('Invalid profile file. Please select a valid Flowify profile export.');
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
        localStorage.setItem('statistics', JSON.stringify(profile.statistics));
      }
      
      // Mark onboarding as complete
      localStorage.setItem('onboardingComplete', 'true');
      localStorage.setItem('language', profile.settings.language || 'en');
      
      // Hide welcome screen with animation
      const welcomeScreen = document.getElementById('welcomeScreen');
      if (welcomeScreen) {
        welcomeScreen.style.animation = 'welcomeExit 0.5s ease-out forwards';
        setTimeout(() => {
          welcomeScreen.style.display = 'none';
          // Reload to apply all imported settings
          location.reload();
        }, 500);
      }
      
    } catch (error) {
      console.error('Error importing profile:', error);
      alert('Failed to import profile: ' + error.message + '\n\nPlease make sure you selected a valid Flowify profile export file.');
    }
  };
  
  input.click();
}

function setTheme(theme) {
  currentTheme = theme;
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  updateThemeButtons();
}

function initializeApp() {
  // Initialize DOM cache
  DOM.init();
  
  // Load and apply language
  currentLanguage = localStorage.getItem('language') || 'en';
  updateUILanguage();
  
  // Set theme
  document.body.setAttribute('data-theme', currentTheme);
  updateThemeButtons();
  updateDiscordRPCButtons();
  
  // Initialize custom theme and presets - apply selected theme
  const savedPreset = localStorage.getItem('selectedThemePreset');
  if (savedPreset === 'custom') {
    initializeCustomTheme();
  } else if (savedPreset) {
    applyThemePreset(savedPreset);
  } else {
    // Default to 'default' theme
    applyThemePreset('default');
  }
  
  // Initialize theme selector UI
  const selector = document.getElementById('themePresetSelector');
  if (selector) {
    selector.value = savedPreset || 'default';
  }
  
  // Initialize audio player
  player = document.getElementById('player');
  if (!player) {
    player = document.createElement('audio');
    player.id = 'player';
    player.style.display = 'none';
    document.body.appendChild(player);
  }
  
  // Expose player globally for statistics
  window.player = player;
  
  // Add event listeners to player
  player.addEventListener('timeupdate', updateProgress);
  player.addEventListener('ended', nextTrack);
  player.addEventListener('loadedmetadata', updateDuration);
  player.addEventListener('error', handleAudioError);
  player.addEventListener('canplay', handleAudioReady);
  player.addEventListener('volumechange', cacheVolume);
  player.addEventListener('play', handlePlayStateChange);
  player.addEventListener('pause', handlePauseStateChange);
  
  // Set cached volume after a short delay to ensure DOM is ready
  setTimeout(() => {
    player.volume = cachedVolume;
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
      volumeSlider.value = cachedVolume * 100;
    }
    debugLog('Volume restored to:', cachedVolume);
  }, 100);
  
  // Setup Media Session API for Windows media controls
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      if (player && currentTrack) {
        player.play();
      }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (player) {
        player.pause();
      }
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      previousTrack();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      nextTrack();
    });
  }
  
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
  
  // Initialize Discord RPC (respect preference in main process)
  if (window.electronAPI) {
    console.log('[RPC] electronAPI available, checking preference...');
    console.log('[RPC] discordRPCEnabled from localStorage:', discordRPCEnabled);
    
    if (typeof window.electronAPI.setDiscordEnabled === 'function') {
      console.log('[RPC] Calling setDiscordEnabled with:', !!discordRPCEnabled);
      window.electronAPI.setDiscordEnabled(!!discordRPCEnabled);
    }
    if (discordRPCEnabled) {
      console.log('[RPC] Initializing Discord RPC with default activity...');
      window.electronAPI.updateDiscordRPC({
        details: 'Browsing music',
        state: 'In main menu',
        startTimestamp: Date.now()
      });
    } else {
      console.log('[RPC] Discord RPC disabled by user preference');
    }
  } else {
    console.log('[RPC] Discord RPC not initialized: No electronAPI');
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

  // Listen for mini-player controls
  if (window.electronAPI && window.electronAPI.onPlayerControl) {
    window.electronAPI.onPlayerControl((data) => {
      if (!data || !data.action) return;
      switch (data.action) {
        case 'toggle':
          togglePlay();
          break;
        case 'next':
          nextTrack();
          break;
        case 'prev':
          previousTrack();
          break;
        case 'shuffle':
          toggleShuffle();
          break;
        case 'repeat':
          toggleRepeat();
          break;
        case 'like':
          likeCurrentTrack();
          break;
      }
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
      console.log('[queryInput] Input event fired, value:', e.target.value);
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
      // Persist preference and update runtime flag
      localStorage.setItem('discordRPCEnabled', en ? 'true' : 'false');
      discordRPCEnabled = en;
      // Update RPC state if API exposed
      try {
        if (window.electronAPI) {
          if (typeof window.electronAPI.setDiscordEnabled === 'function') {
            window.electronAPI.setDiscordEnabled(!!en);
          }
          if (en && typeof window.electronAPI.updateDiscordRPC === 'function') {
            // Re-initialize presence to current state
            updateDiscordPresence();
          }
        }
      } catch (err) {
        console.warn('Failed to update Discord RPC state:', err);
      }
    };
  }
}

// Navigation
function showSection(sectionName, skipHistory = false) {
  // Add to history if not skipping (skip when using back button)
  if (!skipHistory && sectionName !== 'artist' && sectionName !== 'album-detail') {
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
  
  if (sectionName === 'artist' || sectionName === 'album-detail') {
    if (navBackBtn) navBackBtn.style.display = 'flex';
  } else {
    if (navBackBtn) navBackBtn.style.display = 'none';
    if (navbarTitle) {
      const titles = {
        search: '<i class="fas fa-music"></i> Flowify',
        playlists: '<i class="fas fa-list"></i> Playlists',
        liked: '<i class="fas fa-heart"></i> Liked Songs',
        downloads: '<i class="fas fa-download"></i> Downloads',
        statistics: '<i class="fas fa-chart-bar"></i> Statistics',
        queue: '<i class="fas fa-stream"></i> Queue',
        customize: '<i class="fas fa-sliders-h"></i> Customize',
        info: '<i class="fas fa-info-circle"></i> Info'
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
  } else if (sectionName === 'queue') {
    // Load queue when section is shown
    if (typeof loadQueue === 'function') {
      loadQueue();
    }
  } else if (sectionName === 'statistics') {
    // Update statistics when section is shown
    if (typeof updateStatisticsDisplay === 'function') {
      updateStatisticsDisplay();
    }
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
  const artistsResults = document.getElementById('artistsResults');
  const albumsResults = document.getElementById('albumsResults');
  const songsResults = document.getElementById('songsResults');
  const artistsGallery = document.getElementById('artistsGallery');
  const albumsGallery = document.getElementById('albumsGallery');
  
  if (!resultsDiv) return;
  
  try {
    debugLog('Searching for:', query);
    
    // Show loading state
    resultsDiv.innerHTML = '<div class="empty-state"><h3>🔍 Searching...</h3><p>Finding your music...</p></div>';
    
    // Hide trending while searching
    if (trendingSection) trendingSection.style.display = 'none';

    // Search for songs, artists, and albums in parallel
    const [songsData, artistsData, albumsData] = await Promise.all([
      searchMusic(query),
      searchArtists(query),
      searchAlbums(query)
    ]);
    
    console.log('[search] Songs:', songsData);
    console.log('[search] Artists:', artistsData);
    console.log('[search] Albums:', albumsData);

    // Clear all results
    resultsDiv.innerHTML = '';
    if (artistsGallery) artistsGallery.innerHTML = '';
    if (albumsGallery) albumsGallery.innerHTML = '';

    let hasResults = false;

    // Display Artists - handle different possible structures
    let artistsList = [];
    if (artistsData) {
      if (artistsData.artists && artistsData.artists.items && Array.isArray(artistsData.artists.items)) {
        artistsList = artistsData.artists.items;
      } else if (artistsData.artists && Array.isArray(artistsData.artists)) {
        artistsList = artistsData.artists;
      } else if (artistsData.items && Array.isArray(artistsData.items)) {
        artistsList = artistsData.items;
      } else if (Array.isArray(artistsData)) {
        artistsList = artistsData;
      }
    }
    
    console.log('[search] Artists list:', artistsList.length, 'items');
    if (artistsList.length > 0) {
      console.log('[search] First artist:', artistsList[0]);
      hasResults = true;
      if (artistsResults) artistsResults.style.display = 'block';
      
      // Filter out artists without pictures and display up to 20 (but only 8 visible at a time)
      let displayedCount = 0;
      for (const artist of artistsList) {
        if (displayedCount >= 20) break; // Max 20 artists total
        
        // Skip artists without a picture
        if (!artist.picture) continue;
        
        const artistCard = createArtistGalleryItem(artist);
        if (artistsGallery) artistsGallery.appendChild(artistCard);
        displayedCount++;
      }
      
      // Hide section if no artists with pictures were found
      if (displayedCount === 0) {
        if (artistsResults) artistsResults.style.display = 'none';
        hasResults = false;
      }
    } else {
      console.log('[search] No artists found');
      if (artistsResults) artistsResults.style.display = 'none';
    }

    // Display Albums - handle different possible structures
    let albumsList = [];
    if (albumsData) {
      if (albumsData.albums && albumsData.albums.items && Array.isArray(albumsData.albums.items)) {
        albumsList = albumsData.albums.items;
      } else if (albumsData.albums && Array.isArray(albumsData.albums)) {
        albumsList = albumsData.albums;
      } else if (albumsData.items && Array.isArray(albumsData.items)) {
        albumsList = albumsData.items;
      } else if (Array.isArray(albumsData)) {
        albumsList = albumsData;
      }
    }
    
    console.log('[search] Albums list:', albumsList.length, 'items');
    if (albumsList.length > 0) {
      console.log('[search] First album:', albumsList[0]);
      hasResults = true;
      if (albumsResults) albumsResults.style.display = 'block';
      albumsList.slice(0, 20).forEach(album => { // Max 20 albums total
        const albumCard = createAlbumGalleryItem(album);
        if (albumsGallery) albumsGallery.appendChild(albumCard);
      });
    } else {
      console.log('[search] No albums found');
      if (albumsResults) albumsResults.style.display = 'none';
    }

    // Display Songs
    if (songsData && songsData.items && songsData.items.length > 0) {
      hasResults = true;
      if (songsResults) songsResults.style.display = 'block';
      if (emptyDiv) emptyDiv.style.display = 'none';
      const searchResultsTitle = document.getElementById('searchResultsTitle');
      if (searchResultsTitle) searchResultsTitle.style.display = 'block';
      const suggestionsSection = document.getElementById('suggestions');
      if (suggestionsSection) suggestionsSection.style.display = 'none';
      
      songsData.items.forEach((item, index) => {
        console.log(`[search] Creating card ${index + 1}/${songsData.items.length} for:`, item.title, 'by', item.artist?.name);
        const trackCard = createTrackCard(item);
        resultsDiv.appendChild(trackCard);
      });
    } else {
      if (songsResults) songsResults.style.display = 'none';
    }

    if (!hasResults) {
      console.warn('[search] No results found for query:', query);
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
function createTrackCard(item, isRecommendation = false) {
  try {
    if (!item) {
      console.error('[createTrackCard] Null item provided');
      return document.createElement('div');
    }
    
    console.log('[createTrackCard] Creating card for:', item);
    
    const div = document.createElement('div');
    div.className = 'track-card';
    
    // Fix image URL format
    let imageUrl = '';
    if (item.album && item.album.cover) {
      // Check if it's already a full URL (from YouTube Music)
      if (item.album.cover.startsWith('http')) {
        imageUrl = item.album.cover;
      } else {
        // Tidal format (from Digger API)
        imageUrl = `https://resources.tidal.com/images/${item.album.cover.replace(/-/g, '/')}/320x320.jpg`;
      }
    }
    
  // Check if liked from the Liked Songs playlist
  const likedPlaylist = playlists.find(p => p.id === LIKED_SONGS_PLAYLIST_ID);
  const isLiked = likedPlaylist ? likedPlaylist.songs.some(song => String(song.id) === String(item.id)) : false;
  
  div.innerHTML = `
    <img class="track-image" src="${imageUrl}" alt="${item.title}" loading="lazy"
         onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjNDQ0Ii8+PHRleHQgeD0iMTAwIiB5PSIxMDAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmb250LXNpemU9IjE0IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+4pmrPC90ZXh0Pjwvc3ZnPg=='; this.style.backgroundColor='#444';">
    <div class="track-title">${item.title}</div>
    <div class="track-artist" onclick="openArtistPage('${item.artist.id}')" style="cursor: pointer; transition: color 0.2s ease;" title="View artist" onmouseover="this.style.color='var(--accent-green)'" onmouseout="this.style.color=''">
      <i class="fas fa-user-music"></i> ${item.artist.name}
    </div>
    <div class="track-actions">
      <button class="btn btn-small" onclick="event.stopPropagation(); playTrack('${item.id}', ${JSON.stringify(item).replace(/"/g, '&quot;')}, ${isRecommendation})">
        <i class="fas fa-play"></i> Play
      </button>
      <div style="display: flex; gap: 5px;">
        <button class="btn btn-small ${isLiked ? 'btn-secondary' : ''}" onclick="event.stopPropagation(); toggleLike('${item.id}', ${JSON.stringify(item).replace(/"/g, '&quot;')})" id="like-${item.id}">
          <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
        </button>
        <button class="btn btn-small" onclick="event.stopPropagation(); addToPlaylist(${JSON.stringify(item).replace(/"/g, '&quot;')})">
          <i class="fas fa-plus"></i>
        </button>
      </div>
    </div>
  `;
  
    return div;
  } catch (error) {
    console.error('[createTrackCard] Error creating card:', error, item);
    return document.createElement('div'); // Return empty div on error
  }
}

// Audio state change handlers
function handlePlayStateChange() {
  isPlaying = true;
  updatePlayButton();
  updateDiscordPresence();
  
  // Start statistics tracking
  if (typeof startPlaybackTracking === 'function' && currentTrack) {
    startPlaybackTracking(currentTrack);
  }
  
  // Start visualizer if enabled
  if (typeof toggleVisualizer === 'function') {
    toggleVisualizer();
  }
}

function handlePauseStateChange() {
  isPlaying = false;
  // If this wasn't a user pause (e.g., ended), keep isUserPausing false
  // User pauses are marked in togglePlay before calling pause()
  updatePlayButton();
  updateDiscordPresence();
  
  // Stop statistics tracking
  if (typeof stopPlaybackTracking === 'function') {
    stopPlaybackTracking();
  }
  
  // Stop visualizer
  if (typeof toggleVisualizer === 'function') {
    toggleVisualizer();
  }
}

// Audio error handling
function handleAudioError(e) {
  console.error('Audio error:', e);
  console.error('Error details:', player.error);
  console.error('Current source:', player.src);
  console.error('Current track:', currentTrack);
  
  let errorMessage = 'Audio playback failed. ';
  
  if (player.error) {
    switch (player.error.code) {
      case 1:
        errorMessage += 'The audio download was aborted.';
        break;
      case 2:
        errorMessage += 'A network error occurred. Check console for details.';
        break;
      case 3:
        errorMessage += 'The audio file appears to be corrupted.';
        break;
      case 4:
        errorMessage += 'The audio format is not supported. This might be a codec issue - check console logs.';
        break;
      default:
        errorMessage += 'An unknown error occurred (code: ' + player.error.code + ').';
    }
    
    if (player.error.message) {
      console.error('Error message:', player.error.message);
    }
  }
  
  if (suppressPlaybackAlerts || isCrossfading) {
    console.warn('[suppressed alert]', errorMessage);
    if (typeof showNotification === 'function') {
      try { showNotification('Playback', errorMessage, 'error'); } catch {}
    }
  } else {
    alert(errorMessage);
  }
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
async function playTrack(id, trackData, fromRecommendations = false) {
  try {
    console.log('[playTrack] Called with id:', id, 'type:', typeof id);
    console.log('[playTrack] Track data:', trackData);
    
    // Set flag if playing from recommendations
    isPlayingFromRecommendations = fromRecommendations;
    
    // Show loading state
    const playButtons = document.querySelectorAll(`button[onclick*="playTrack('${id}'"]`);
    playButtons.forEach(btn => {
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
      btn.disabled = true;
    });
    
    console.log('[playTrack] Fetching track data for ID:', id);
    console.log('[playTrack] Track data:', trackData);
      // If the track was previously downloaded, prefer local file when offline
      const downloadedEntry = downloads.find(d => d.id === id && d.filePath);
      let trackUrl = null;
      if (downloadedEntry && typeof navigator !== 'undefined' && navigator.onLine === false) {
        // Use local file path for offline playback
        let fp = downloadedEntry.filePath;
        // Normalize Windows backslashes and ensure file:// protocol
        if (!fp.startsWith('file://')) {
          fp = fp.replace(/\\/g, '/');
          // Ensure we have three slashes for absolute Windows paths (file:///C:/...)
          if (!fp.startsWith('/')) fp = '/' + fp;
          fp = 'file://' + fp;
        }
        trackUrl = encodeURI(fp);
        console.log('[playTrack] Using offline downloaded file for playback:', trackUrl);
      } else {
        trackUrl = await getTrackURL(id, audioQuality);
        console.log('[playTrack] Track URL:', trackUrl);
      }

    if (trackUrl) {
      currentTrack = { ...trackData, url: trackUrl };
      window.currentTrack = currentTrack; // Expose globally for statistics
      
      // Add to listening history
      const listeningHistory = JSON.parse(localStorage.getItem('listeningHistory') || '[]');
      listeningHistory.push({
        ...trackData,
        playedAt: new Date().toISOString()
      });
      // Keep only last 100 tracks
      if (listeningHistory.length > 100) {
        listeningHistory.shift();
      }
      localStorage.setItem('listeningHistory', JSON.stringify(listeningHistory));
      
      // Stop current playback
      player.pause();
      player.currentTime = 0;
      
      // Set new source - Electron should handle CORS
      player.src = trackUrl;
      console.log('[playTrack] Set player src to:', trackUrl.substring(0, 100) + '...');
      player.load();
      
      // Try to play
      try {
        await player.play();
        isPlaying = true;
        console.log('[playTrack] Audio playing successfully');
        
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
          btn.innerHTML = '<i class="fas fa-play"></i> Play';
          btn.disabled = false;
        });
        
      } catch (playError) {
        console.error('Play error:', playError);
        
        // Reset button states
        playButtons.forEach(btn => {
          btn.innerHTML = '<i class="fas fa-play"></i> Play';
          btn.disabled = false;
        });
        
        if (!(suppressPlaybackAlerts || isCrossfading)) {
          throw playError;
        } else {
          console.warn('[suppressed play error]', playError);
        }
      }
    } else {
      console.error('No stream URL found in response');
      alert('Stream URL not found for this track.');
      
      // Reset button states
      playButtons.forEach(btn => {
        btn.innerHTML = '<i class="fas fa-play"></i> Play';
        btn.disabled = false;
      });
    }
  } catch (error) {
    console.error('Fetch/Play error:', error);
    if (!(suppressPlaybackAlerts || isCrossfading)) {
      alert('Failed to play track. Please check your internet connection and try again.');
    } else {
      console.warn('[suppressed fetch/play alert]', error);
    }
    
    // Reset button states
    const playButtons = document.querySelectorAll(`button[onclick*="playTrack('${id}'"]`);
    playButtons.forEach(btn => {
      btn.innerHTML = '<i class="fas fa-play"></i> Play';
      btn.disabled = false;
    });
  }
}

// Player controls
function togglePlay() {
  if (!currentTrack || !player) return;
  
  if (isPlaying) {
    // User-initiated pause
    isUserPausing = true;
    player.pause();
    isPlaying = false;
  } else {
    player.play().catch(error => {
      console.error('Play error:', error);
      if (!(suppressPlaybackAlerts || isCrossfading)) {
        alert('Failed to resume playback.');
      } else {
        console.warn('[suppressed resume alert]', error);
      }
    });
    isPlaying = true;
    isUserPausing = false;
  }
  updatePlayButton();
  updateDiscordPresence();
}

function nextTrack() {
  // Special handling for recommendations
  if (isPlayingFromRecommendations && suggestionsPool && suggestionsPool.length > 0) {
    // Find current track in suggestions pool
    let currentSuggestionIndex = suggestionsPool.findIndex(track => track.id === currentTrack.id);
    
    // If found, play next from pool; otherwise start from beginning
    if (currentSuggestionIndex === -1) {
      currentSuggestionIndex = 0;
    } else {
      currentSuggestionIndex = (currentSuggestionIndex + 1) % suggestionsPool.length;
    }
    
    const nextRecommendation = suggestionsPool[currentSuggestionIndex];
    if (nextRecommendation) {
      playTrack(nextRecommendation.id, nextRecommendation, true);
    }
    return;
  }
  
  // If playlist ended and we're in repeat all mode, restart from beginning
  if (currentPlaylist.length === 0 || (currentIndex >= currentPlaylist.length - 1 && repeatMode !== 1)) {
    // Playlist finished - start playing from recommendations
    if (suggestionsPool && suggestionsPool.length > 0) {
      const firstRecommendation = suggestionsPool[0];
      playTrack(firstRecommendation.id, firstRecommendation, true);
      return;
    }
    return;
  }
  
  if (repeatMode === 2) {
    // Repeat current track
    player.currentTime = 0;
    player.play();
    return;
  }
  
  if (isShuffled) {
    // Use improved shuffle with history
    if (typeof improvedShuffle === 'function' && currentPlaylist.length > 5) {
      currentPlaylist = improvedShuffle(currentPlaylist);
      currentIndex = 0;
    } else {
      currentIndex = Math.floor(Math.random() * currentPlaylist.length);
    }
  } else {
    currentIndex = (currentIndex + 1) % currentPlaylist.length;
  }
  
  const nextTrack = currentPlaylist[currentIndex];
  if (nextTrack) {
    playTrack(nextTrack.id, nextTrack);
  }
  
  // Update queue display
  if (typeof loadQueue === 'function') {
    loadQueue();
  }
}

function handleCrossfade() {
  suppressPlaybackAlerts = true;
  if (!player || !crossfadeEnabled || isCrossfading) return;
  isCrossfading = true;

  const originalVolume = player.volume;
  const oldPlayer = player;

  // Determine next track and source
  let nextTrackData = null;
  let willPlayFromRecommendations = false;
  let nextIndex = null;

  if (isPlayingFromRecommendations && suggestionsPool && suggestionsPool.length > 0) {
    let currentSuggestionIndex = suggestionsPool.findIndex(track => track.id === currentTrack.id);
    currentSuggestionIndex = currentSuggestionIndex === -1 ? 0 : (currentSuggestionIndex + 1) % suggestionsPool.length;
    nextTrackData = suggestionsPool[currentSuggestionIndex];
    willPlayFromRecommendations = true;
  } else if (currentPlaylist.length > 0) {
    if (repeatMode === 2) {
      isCrossfading = false; // no crossfade for repeat one
      return;
    }
    if (currentIndex >= currentPlaylist.length - 1 && repeatMode !== 1) {
      if (suggestionsPool && suggestionsPool.length > 0) {
        nextTrackData = suggestionsPool[0];
        willPlayFromRecommendations = true;
      }
    } else {
      nextIndex = isShuffled ? Math.floor(Math.random() * currentPlaylist.length) : (currentIndex + 1) % currentPlaylist.length;
      nextTrackData = currentPlaylist[nextIndex];
    }
  }

  if (!nextTrackData) { isCrossfading = false; return; }

  const fadeSteps = 40;
  const fadeInterval = crossfadeDuration * 1000 / fadeSteps;

  // Prepare next audio element
  const nextPlayer = new Audio();
  nextPlayer.volume = 0;

  // Detach 'ended' (and error) from old player to avoid firing during crossfade
  oldPlayer.removeEventListener('ended', nextTrack);
  oldPlayer.removeEventListener('error', handleAudioError);

  (async () => {
    try {
      const nextTrackUrl = await getTrackURL(nextTrackData.id, audioQuality);
      if (!nextTrackUrl) { isCrossfading = false; oldPlayer.addEventListener('ended', nextTrack); return; }

      nextPlayer.src = nextTrackUrl;
      nextPlayer.load();

      await new Promise((resolve) => {
        if (nextPlayer.readyState >= 3) resolve();
        else nextPlayer.addEventListener('canplay', resolve, { once: true });
      });

      // If the user explicitly paused during loading, abort crossfade
      if (isUserPausing) {
        nextPlayer.pause();
        nextPlayer.src = '';
        oldPlayer.addEventListener('ended', nextTrack);
        isCrossfading = false;
        suppressPlaybackAlerts = false;
        return;
      }

      let fadeOutVolume = originalVolume;
      let fadeInVolume = 0;

      nextPlayer.play().catch(err => console.error('Crossfade play error:', err));

      const crossfadeInterval = setInterval(() => {
        // Cancel only on user-initiated pause (not on natural end)
        if (isUserPausing) {
          clearInterval(crossfadeInterval);
          nextPlayer.pause(); nextPlayer.src = '';
          oldPlayer.volume = originalVolume;
          oldPlayer.addEventListener('ended', nextTrack);
          // Resume alerts after a short delay
          setTimeout(() => { suppressPlaybackAlerts = false; }, 250);
          isCrossfading = false;
          return;
        }

        // Fade volumes
        fadeOutVolume -= originalVolume / fadeSteps;
        oldPlayer.volume = Math.max(0, fadeOutVolume);

        fadeInVolume += originalVolume / fadeSteps;
        nextPlayer.volume = Math.min(originalVolume, fadeInVolume);

        // Complete crossfade swap
        if (fadeOutVolume <= 0 && fadeInVolume >= originalVolume) {
          clearInterval(crossfadeInterval);

          // Pause and detach old player (do not clear src to avoid spurious errors)
          oldPlayer.pause();
          // oldPlayer.src = '';

          // Promote nextPlayer to be the global player
          player = nextPlayer;

          // Attach standard listeners to new player
          player.addEventListener('timeupdate', updateProgress);
          player.addEventListener('ended', nextTrack);
          player.addEventListener('loadedmetadata', updateDuration);
          player.addEventListener('error', handleAudioError);
          player.addEventListener('canplay', handleAudioReady);
          player.addEventListener('volumechange', cacheVolume);
          player.addEventListener('play', handlePlayStateChange);
          player.addEventListener('pause', handlePauseStateChange);

          // Align volume
          player.volume = originalVolume;

          // Update indices/state
          if (willPlayFromRecommendations) {
            isPlayingFromRecommendations = true;
          } else if (nextIndex !== null) {
            currentIndex = nextIndex;
          }

          // Update UI/state
          currentTrack = { ...nextTrackData, url: nextTrackUrl };
          window.currentTrack = currentTrack; // Expose globally for statistics
          updateNowPlaying();
          updateDiscordPresence();
          if (typeof loadQueue === 'function') loadQueue();

          window.crossfadeTriggered = false;
          // Small delay before re-enabling alerts to ignore any late events from old audio
          setTimeout(() => { suppressPlaybackAlerts = false; }, 250);
          isCrossfading = false;
        }
      }, fadeInterval);
    } catch (error) {
      console.error('Crossfade error:', error);
      // Fallback
      playTrack(nextTrackData.id, nextTrackData, willPlayFromRecommendations);
      oldPlayer.addEventListener('ended', nextTrack);
      isCrossfading = false;
    }
  })();
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
    const likedPlaylist = playlists.find(p => p.id === LIKED_SONGS_PLAYLIST_ID);
    const isLiked = likedPlaylist ? likedPlaylist.songs.some(song => String(song.id) === String(currentTrack.id)) : false;
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
  
  // Update Media Session API (for Windows media controls)
  if ('mediaSession' in navigator && currentTrack) {
    const albumArt = currentTrack.album && currentTrack.album.cover 
      ? `https://resources.tidal.com/images/${currentTrack.album.cover.replace(/-/g, '/')}/640x640.jpg`
      : '';
    
    // Get current playlist name
    let playlistName = 'Flowify';
    if (currentPlaylist.length > 0) {
      const currentPlaylistObj = playlists.find(p => 
        p.songs.some(s => s.id === currentTrack.id)
      );
      if (currentPlaylistObj) {
        playlistName = currentPlaylistObj.name;
      }
    }
    
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist.name,
      album: playlistName,
      artwork: albumArt ? [
        { src: albumArt, sizes: '640x640', type: 'image/jpeg' }
      ] : []
    });
  }
  
  // Update Discord RPC
  updateDiscordPresence();
}

function updateDiscordPresence() {
  if (!window.electronAPI) return;

  // Discord RPC updates (respect toggle)
  if (discordRPCEnabled) {
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

  // Broadcast player state to mini player regardless of Discord toggle
  try {
    if (window.electronAPI.broadcastPlayerState) {
      const cover = currentTrack && currentTrack.album && currentTrack.album.cover
        ? `https://resources.tidal.com/images/${currentTrack.album.cover.replace(/-/g, '/')}/320x320.jpg`
        : '';
      const progress = (typeof player?.currentTime === 'number') ? player.currentTime : 0;
      const duration = currentTrack?.duration || (typeof player?.duration === 'number' ? player.duration : 0);
      
      // Check if current track is liked
      let isLiked = false;
      if (currentTrack) {
        const likedPlaylist = playlists.find(p => p.id === LIKED_SONGS_PLAYLIST_ID);
        if (likedPlaylist) {
          isLiked = likedPlaylist.songs.some(song => song.id === currentTrack.id);
        }
      }
      
      window.electronAPI.broadcastPlayerState({
        title: currentTrack?.title || 'Nothing playing',
        artist: currentTrack?.artist?.name || '',
        cover,
        isPlaying: !!isPlaying,
        progress,
        duration,
        isShuffled: !!isShuffled,
        repeatMode: repeatMode || 0,
        isLiked: isLiked
      });
    }
  } catch (e) {
    console.warn('Failed to broadcast player state:', e);
  }
}

function likeCurrentTrack() {
  if (!currentTrack) return;
  
  // Use the main toggleLike function for consistency
  toggleLike(currentTrack.id, currentTrack);
}

function downloadCurrentTrack() {
  if (!currentTrack) return;
  downloadTrackOffline(currentTrack.id, currentTrack);
}

function updatePlayButton() {
  if (DOM.playBtn) {
    const icon = DOM.playBtn.querySelector('i');
    if (icon) {
      icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
    }
  }
  
  // Update Media Session playback state
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }
}

function updateProgress() {
  if (!player || !player.duration) return;
  
  const progress = (player.currentTime / player.duration) * 100;
  if (DOM.progressBar) {
    DOM.progressBar.style.width = progress + '%';
  }
  
  if (DOM.currentTime) {
    DOM.currentTime.textContent = formatTime(player.currentTime);
  }
  
  // Crossfade detection - trigger when near end of track
  if (crossfadeEnabled && !window.crossfadeTriggered && player.duration && player.currentTime > 0) {
    const timeRemaining = player.duration - player.currentTime;
    
    // Start crossfade when time remaining equals crossfade duration
    if (timeRemaining <= crossfadeDuration && timeRemaining > crossfadeDuration - 0.5) {
      window.crossfadeTriggered = true;
      handleCrossfade();
    }
  }
  
  // Reset crossfade trigger when track restarts or changes
  if (player.currentTime < 1) {
    window.crossfadeTriggered = false;
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
  
  // Check if song already exists in liked songs - use string comparison for safety
  const songId = String(id);
  const existsInPlaylist = likedPlaylist.songs.findIndex(song => String(song.id) === songId);
  const existsInLikedArray = likedSongs.findIndex(song => String(song.id) === songId);
  
  // Determine if song is currently liked (exists in either location)
  const isCurrentlyLiked = existsInPlaylist !== -1 || existsInLikedArray !== -1;
  
  if (!isCurrentlyLiked) {
    // Song not liked - add it (only if doesn't exist in either)
    likedPlaylist.songs.push(trackData);
    likedSongs.push(trackData);
  } else {
    // Song already liked - remove it from both locations
    if (existsInPlaylist !== -1) {
      likedPlaylist.songs.splice(existsInPlaylist, 1);
    }
    if (existsInLikedArray !== -1) {
      likedSongs.splice(existsInLikedArray, 1);
    }
  }
  
  // Save to localStorage
  localStorage.setItem('playlists', JSON.stringify(playlists));
  localStorage.setItem('likedSongs', JSON.stringify(likedSongs));
  
  // Force reload from storage to ensure sync
  playlists = JSON.parse(localStorage.getItem('playlists') || '[]');
  likedSongs = JSON.parse(localStorage.getItem('likedSongs') || '[]');
  likedPlaylist = playlists.find(p => p.id === LIKED_SONGS_PLAYLIST_ID);
  
  loadSuggestions(); // Refresh suggestions
  
  // Check final state
  const isNowLiked = likedPlaylist && likedPlaylist.songs.some(song => String(song.id) === songId);
  
  // Update all visible like buttons for this track - handle both 'id' and id formats
  const likeButtons = [
    ...document.querySelectorAll(`button[onclick*="toggleLike('${songId}'"]`),
    ...document.querySelectorAll(`button[onclick*="toggleLike(${songId},"]`),
    ...document.querySelectorAll(`#like-${songId}`)
  ];
  
  likeButtons.forEach(btn => {
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = isNowLiked ? 'fas fa-heart' : 'far fa-heart';
    }
    if (isNowLiked) {
      btn.classList.add('btn-secondary');
    } else {
      btn.classList.remove('btn-secondary');
    }
  });
  
  // Update current track like button if this is the current track
  if (currentTrack && String(currentTrack.id) === songId) {
    const currentLikeIcon = document.getElementById('currentLikeIcon');
    if (currentLikeIcon) {
      currentLikeIcon.className = isNowLiked ? 'fas fa-heart' : 'far fa-heart';
    }
  }
  
  // Show toast notification instead of navigating
  if (isNowLiked) {
    showNotification('Liked', trackData.title, 'success');
  } else {
    showNotification('Removed', trackData.title, 'info');
  }
  
  // Refresh the current playlist view content if we're viewing one (without navigating)
  if (window.currentViewingPlaylistId) {
    const playlist = playlists.find(p => String(p.id) === String(window.currentViewingPlaylistId));
    if (playlist) {
      // Update the tracks display without changing sections
      const tracksContainer = document.getElementById('playlistDetailTracks');
      if (tracksContainer) {
        tracksContainer.innerHTML = '';
        if (playlist.songs.length === 0) {
          tracksContainer.innerHTML = '<div class="empty-state"><h3>No songs in this playlist</h3><p>Add songs to get started</p></div>';
        } else {
          playlist.songs.forEach((track, index) => {
            const row = createPlaylistRow(track, index, playlist.id);
            tracksContainer.appendChild(row);
          });
        }
        // Update song count
        const countEl = document.getElementById('playlistDetailCount');
        if (countEl) {
          countEl.textContent = `${playlist.songs.length} song${playlist.songs.length !== 1 ? 's' : ''}`;
        }
      }
    }
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
    const trackUrl = await getTrackURL(id, 'LOSSLESS');

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
        const data = await searchMusic(likedSong.artist.name);
        
        if (data && data.items && data.items.length > 0) {
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
    console.log('[loadTrending] Searching for:', sampleQueries);
    
    const results = await Promise.allSettled(
      sampleQueries.map(q => searchMusic(q).catch(err => Promise.reject(err)))
    );

    console.log('[loadTrending] Results:', results);

    // Collect items from successful queries
    let combined = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value && Array.isArray(r.value.items)) {
        console.log('[loadTrending] Adding', r.value.items.length, 'items');
        combined.push(...r.value.items);
      } else if (r.status === 'rejected') {
        console.error('[loadTrending] Query rejected:', r.reason);
      }
    }

    console.log('[loadTrending] Combined items before filter:', combined.length);
    if (combined.length > 0) {
      console.log('[loadTrending] Sample item:', combined[0]);
    }

    // Filter to track-like items with required fields
    combined = combined.filter(it => it && it.id && it.title && it.artist && it.artist.name && it.album && it.album.cover);

    console.log('[loadTrending] Items after filter:', combined.length);

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
    const trackCard = createTrackCard(suggestionsPool[i], true); // true = is recommendation
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
        const data = await searchMusic(likedSong.artist.name);
        
        if (data && data.items && data.items.length > 0) {
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
  
  contentArea.addEventListener('scroll', contentArea.suggestionsScrollHandler, { passive: true });
  debugLog('Infinite scroll setup complete for suggestions');
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
  
  // Check for duplicates using string comparison for safety
  const trackId = String(trackData.id);
  const alreadyExists = playlist.songs.some(song => String(song.id) === trackId);
  
  if (!alreadyExists) {
    playlist.songs.push(trackData);
    
    localStorage.setItem('playlists', JSON.stringify(playlists));
    
    // Force reload from storage to ensure sync
    playlists = JSON.parse(localStorage.getItem('playlists') || '[]');
    
    loadPlaylists(); // Refresh the playlist view to update song count
    closeAddToPlaylistModal();
    
    // Show success message
    const successMsg = document.createElement('div');
    successMsg.textContent = `Added to "${playlist.name}"`;
    successMsg.style.cssText = 'position: fixed; top: 80px; right: 20px; background: var(--accent-green); color: white; padding: 15px 20px; border-radius: 8px; z-index: 3000; animation: fadeIn 0.3s ease;';
    document.body.appendChild(successMsg);
    setTimeout(() => successMsg.remove(), 2000);
  } else {
    // Show already exists message
    const existsMsg = document.createElement('div');
    existsMsg.textContent = `Song already in "${playlist.name}"`;
    existsMsg.style.cssText = 'position: fixed; top: 80px; right: 20px; background: rgba(255, 152, 0, 0.9); color: white; padding: 15px 20px; border-radius: 8px; z-index: 3000; animation: fadeIn 0.3s ease;';
    document.body.appendChild(existsMsg);
    setTimeout(() => existsMsg.remove(), 2000);
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
  
  // Force reload from storage to ensure sync
  playlists = JSON.parse(localStorage.getItem('playlists') || '[]');
  
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
  isPlayingFromRecommendations = false; // Not playing from recommendations
  
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
    
    // Force reload from storage to ensure sync
    playlists = JSON.parse(localStorage.getItem('playlists') || '[]');
    
    loadPlaylists();
    
    // If we're currently viewing this playlist, go back to home
    if (window.currentViewingPlaylistId === playlistId) {
      showSection('home');
      window.currentViewingPlaylistId = null;
    }
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
  
  console.log('[RPC] Discord RPC toggled to:', enabled);
  
  if (window.electronAPI) {
    if (typeof window.electronAPI.setDiscordEnabled === 'function') {
      console.log('[RPC] Calling setDiscordEnabled with:', !!enabled);
      window.electronAPI.setDiscordEnabled(!!enabled);
    }
    if (enabled) {
      // Update with current state
      console.log('[RPC] Updating RPC with current track state...');
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
    } // when disabled, main process will clear and disconnect
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
  
  // Initialize music API select
  const musicAPISelect = document.getElementById('musicAPISelect');
  if (musicAPISelect) {
    musicAPISelect.value = musicAPI;
  }
  
  // Initialize audio quality select
  const qualitySelect = document.getElementById('qualitySelect');
  if (qualitySelect) {
    qualitySelect.value = audioQuality;
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
      
      // Restart the app using Electron API
      if (window.electronAPI && window.electronAPI.restartApp) {
        window.electronAPI.restartApp();
      } else {
        // Fallback for web version
        window.location.href = window.location.href.split('?')[0] + '?reset=' + Date.now();
      }
    }
  }
}


// Quality settings
function updateQuality(quality) {
  audioQuality = quality;
  localStorage.setItem('audioQuality', quality);
}

// Change Music API
function changeMusicAPI(api) {
  musicAPI = api;
  localStorage.setItem('musicAPI', api);
  
  // Show success notification
  const apiName = api === 'ytmusic' ? 'YouTube Music' : 'Digger API';
  showNotification('API Changed', `Now using ${apiName}`, 'success');
  
  // Reload trending songs with new API
  const trendingPref = localStorage.getItem('showTrending');
  if (trendingPref === null || trendingPref === 'true') {
    console.log('[changeMusicAPI] Reloading trending with', api);
    loadTrendingSongs();
  }
  
  // Note: Quality options might differ between APIs
  if (api === 'ytmusic') {
    debugLog('Switched to YouTube Music API');
  } else {
    debugLog('Switched to Digger API');
  }
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

function openMiniPlayer() {
  if (!currentTrack) {
    // Don't open mini player if nothing is playing
    return;
  }
  if (window.electronAPI && window.electronAPI.openMiniPlayer) {
    window.electronAPI.openMiniPlayer();
  }
}

// Offline download function
async function downloadTrackOffline(id, trackData) {
  try {
    const trackUrl = await getTrackURL(id, audioQuality);

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
    const searchData = await searchMusic(artistName);
    
    if (searchData && searchData.items && searchData.items.length > 0) {
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
  
  switch(data.status) {
    case 'checking':
      if (updateInfo) {
        updateInfo.innerHTML = '<p style="color: var(--accent-green);"><i class="fas fa-spinner fa-spin"></i> Checking for updates...</p>';
      }
      break;
      
    case 'available':
      // Show notification for available updates
      showNotification(
        'Update Available!',
        `Version ${data.version} is ready to download. Click here to update.`,
        'info',
        () => {
          showSection('info');
          const updateInfo = document.getElementById('updateInfo');
          if (updateInfo) {
            updateInfo.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      );
      
      if (updateInfo) {
        updateInfo.innerHTML = `
          <div class="update-info-box">
            <h4><i class="fas fa-download"></i> Update Available: v${data.version}</h4>
            <p>A new version is available!</p>
            <button class="btn" onclick="downloadUpdate()" style="margin-top: 10px;">
              <i class="fas fa-download"></i> Download Update
            </button>
          </div>
        `;
      }
      break;
      
    case 'not-available':
      if (updateInfo) {
        updateInfo.innerHTML = '<p style="color: var(--accent-green);"><i class="fas fa-check-circle"></i> You are using the latest version!</p>';
        setTimeout(() => {
          updateInfo.innerHTML = '';
        }, 5000);
      }
      break;
      
    case 'downloading':
      const percent = Math.round(data.percent);
      if (updateInfo) {
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
      }
      break;
      
    case 'downloaded':
      // Show notification when download completes
      showNotification(
        'Update Ready!',
        `Version ${data.version} has been downloaded and will install on restart.`,
        'success'
      );
      
      if (updateInfo) {
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
      }
      break;
      
    case 'error':
      if (updateInfo) {
        updateInfo.innerHTML = `<p style="color: #ff4444;"><i class="fas fa-exclamation-circle"></i> Error: ${data.message}</p>`;
      }
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
  const isLiked = likedPlaylist ? likedPlaylist.songs.some(s => String(s.id) === String(track.id)) : false;
  
  // For Liked Songs playlist, removing is the same as unliking
  const isLikedSongsPlaylist = playlistId === LIKED_SONGS_PLAYLIST_ID;
  const removeAction = isLikedSongsPlaylist 
    ? `toggleLike(${track.id}, ${JSON.stringify(track).replace(/"/g, '&quot;')})` 
    : `removeFromPlaylist('${playlistId}', ${track.id})`;
  
  item.innerHTML = `
    <div class="playlist-number">${index + 1}</div>
    <img src="${imageUrl}" width="72" height="72" loading="lazy" style="border-radius: 10px; background: #444; object-fit: cover;" 
         onerror="this.style.display='none';" alt="">
    <div class="playlist-info" style="min-width:0;">
      <div class="playlist-title" style="font-weight:600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.title}</div>
      <div class="playlist-artist" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.artist?.name || ''}</div>
    </div>
    <button class="btn btn-small" onclick='playTrackFromPlaylist(${track.id}, ${JSON.stringify(track).replace(/"/g, '&quot;')}, "${playlistId}", ${index})'>
      <i class="fas fa-play"></i>
    </button>
    <button class="btn btn-small ${isLiked ? 'btn-secondary' : ''}" onclick="toggleLike('${track.id}', ${JSON.stringify(track).replace(/"/g, '&quot;')})">
      <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
    </button>
    ${!isLikedSongsPlaylist ? `<button class="btn btn-small" onclick='${removeAction}'>
      <i class="fas fa-times"></i>
    </button>` : ''}
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
  // Note: derived variables (borderColor, textTertiary, inputBg, playerBg, accentGreenRgb, onAccent) are computed automatically.
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
  
  const root = document.documentElement;
  const merged = ensureDerivedThemeVars({ ...theme });
  Object.keys(merged).forEach(key => {
    const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
    root.style.setProperty(cssVar, merged[key]);
  });
  
  // Save to localStorage (store merged so refresh keeps derived too)
  localStorage.setItem('customTheme', JSON.stringify(merged));
  localStorage.setItem('selectedThemePreset', 'custom');
  
  const selector = document.getElementById('themePresetSelector');
  if (selector) {
    selector.value = 'custom';
  }
}

function resetCustomTheme() {
  // Clear custom theme from localStorage
  localStorage.removeItem('customTheme');
  localStorage.setItem('selectedThemePreset', 'default');
  
  // Reset to default theme
  applyThemePreset('default');
  
  // Reload default values in inputs
  loadCustomThemeValues();
  
  // Update selector
  const selector = document.getElementById('themePresetSelector');
  if (selector) {
    selector.value = 'default';
  }
  
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
  input.accept = '.json,.css';
  
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const content = event.target.result;
        let theme;
        
        // Check if it's a CSS file
        if (file.name.endsWith('.css')) {
          const cssVarRegex = /--([a-z-]+):\s*([^;]+);/gi;
          let match;
          theme = {};
          while ((match = cssVarRegex.exec(content)) !== null) {
            const varName = match[1].replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            const varValue = match[2].trim();
            theme[varName] = varValue;
          }
          if (Object.keys(theme).length === 0) {
            showMessage('No CSS variables found in the file', 'error');
            return;
          }
        } else {
          theme = JSON.parse(content);
          const hasAllKeys = Object.keys(defaultTheme).every(key => key in theme);
          if (!hasAllKeys) {
            showMessage('Invalid theme file', 'error');
            return;
          }
        }
        
        const merged = ensureDerivedThemeVars({ ...theme });
        localStorage.setItem('customTheme', JSON.stringify(merged));
        localStorage.setItem('selectedThemePreset', 'custom');
        loadCustomThemeValues();
        
        // Apply to CSS variables immediately
        const root = document.documentElement;
        Object.keys(merged).forEach(key => {
          const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
          root.style.setProperty(cssVar, merged[key]);
        });
        
        // Update selector
        const selector = document.getElementById('themePresetSelector');
        if (selector) {
          selector.value = 'custom';
        }
        
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
      const merged = ensureDerivedThemeVars({ ...theme });
      Object.keys(merged).forEach(key => {
        const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
        root.style.setProperty(cssVar, merged[key]);
      });
    } catch (error) {
      console.error('Failed to load custom theme:', error);
    }
  }
}

// Theme helpers and presets
function hexToRgb(hex) {
  const cleaned = hex.replace('#', '');
  const bigint = parseInt(cleaned.length === 3 ? cleaned.split('').map(c => c + c).join('') : cleaned, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}
function rgbToString({ r, g, b }) { return `${r}, ${g}, ${b}`; }
function getContrastOnColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000' : '#fff';
}
function ensureDerivedThemeVars(colors) {
  const accent = colors.accentGreen || '#2d8659';
  const accentRgb = rgbToString(hexToRgb(accent));
  const onAccent = getContrastOnColor(accent);
  const derived = { ...colors };
  // Provide commonly used derived vars if missing
  if (!derived.borderColor) derived.borderColor = `rgba(${accentRgb}, 0.15)`;
  if (!derived.textTertiary) derived.textTertiary = `rgba(${accentRgb}, 0.6)`;
  if (!derived.inputBg) derived.inputBg = `rgba(${accentRgb}, 0.08)`;
  if (!derived.playerBg) {
    // Use sidebarBg as base if provided, else fall back to gradient start
    const base = derived.sidebarBg || derived.bgGradientStart || '#0a1e14';
    const { r, g, b } = hexToRgb(base.replace(/rgba?\(([^)]+)\)/, '#000000')); // crude fallback if rgba provided
    derived.playerBg = `rgba(${r}, ${g}, ${b}, 0.95)`;
  }
  derived.accentGreenRgb = accentRgb;
  derived.onAccent = onAccent;
  // Danger palette default
  if (!derived.dangerRgb) derived.dangerRgb = '231, 76, 60';
  return derived;
}

// Theme Presets
const themePresets = {
  default: {
    name: 'Default (Green Forest)',
    colors: {
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
    }
  },
  cyberpunk: {
    name: 'Cyberpunk Neon',
    colors: {
      bgGradientStart: '#0a0a1a',
      bgGradientMid: '#1a0a2e',
      bgGradientEnd: '#16003e',
      sidebarBg: '#0a0a1a',
      cardBg: '#1a0a2e',
      cardHoverBg: '#26104e',
      textPrimary: '#00ffff',
      textSecondary: '#00cccc',
      accentGreen: '#ff006e',
      accentGreenHover: '#ff3387'
    }
  },
  ocean: {
    name: 'Ocean Breeze',
    colors: {
      bgGradientStart: '#0a1929',
      bgGradientMid: '#1a365d',
      bgGradientEnd: '#0f2744',
      sidebarBg: '#0a1929',
      cardBg: '#0f2744',
      cardHoverBg: '#1a365d',
      textPrimary: '#e3f2fd',
      textSecondary: '#bbdefb',
      accentGreen: '#2196F3',
      accentGreenHover: '#42A5F5'
    }
  },
  cherry: {
    name: 'Cherry Blossom',
    colors: {
      bgGradientStart: '#1a0009',
      bgGradientMid: '#330014',
      bgGradientEnd: '#26000f',
      sidebarBg: '#1a0009',
      cardBg: '#330014',
      cardHoverBg: '#44001b',
      textPrimary: '#fce4ec',
      textSecondary: '#f8bbd0',
      accentGreen: '#e91e63',
      accentGreenHover: '#f06292'
    }
  },
  midnight: {
    name: 'Midnight Dark',
    colors: {
      bgGradientStart: '#000000',
      bgGradientMid: '#0d0d0d',
      bgGradientEnd: '#1a1a1a',
      sidebarBg: '#000000',
      cardBg: '#0d0d0d',
      cardHoverBg: '#1a1a1a',
      textPrimary: '#ffffff',
      textSecondary: '#cccccc',
      accentGreen: '#00ff00',
      accentGreenHover: '#33ff33'
    }
  },
  sunset: {
    name: 'Sunset Orange',
    colors: {
      bgGradientStart: '#1a0f00',
      bgGradientMid: '#331a00',
      bgGradientEnd: '#4d2600',
      sidebarBg: '#1a0f00',
      cardBg: '#331a00',
      cardHoverBg: '#4d2600',
      textPrimary: '#fff3e0',
      textSecondary: '#ffe0b2',
      accentGreen: '#ff6f00',
      accentGreenHover: '#ff8f00'
    }
  },
  light: {
    name: 'Light Mode',
    colors: {
      bgGradientStart: '#f8faf9',
      bgGradientMid: '#f0f4f2',
      bgGradientEnd: '#e8f0ed',
      sidebarBg: 'rgba(255, 255, 255, 0.95)',
      cardBg: 'rgba(255, 255, 255, 0.9)',
      cardHoverBg: 'rgba(248, 255, 250, 1)',
      textPrimary: '#1a1a1a',
      textSecondary: 'rgba(26, 26, 26, 0.7)',
      accentGreen: '#2d9561',
      accentGreenHover: '#257d51',
      borderColor: 'rgba(0, 0, 0, 0.1)',
      textTertiary: 'rgba(26, 26, 26, 0.5)',
      inputBg: 'rgba(255, 255, 255, 0.8)',
      playerBg: 'rgba(255, 255, 255, 0.98)',
      accentGreenRgb: '45, 149, 97',
      onAccent: '#ffffff'
    }
  }
};

function applyThemePreset(presetName) {
  if (presetName === 'custom') {
    openCustomThemeEditor();
    return;
  }
  
  const preset = themePresets[presetName];
  if (!preset) return;
  
  const root = document.documentElement;
  const merged = ensureDerivedThemeVars({ ...preset.colors });
  Object.keys(merged).forEach(key => {
    const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
    root.style.setProperty(cssVar, merged[key]);
  });
  
  // Save selection
  localStorage.setItem('selectedThemePreset', presetName);
}

function importThemeFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.css';
  
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const cssContent = event.target.result;
        
        // Parse CSS variables from the file
        const cssVarRegex = /--([a-z-]+):\s*([^;]+);/gi;
        let match;
        const theme = {};
        
        while ((match = cssVarRegex.exec(cssContent)) !== null) {
          const varName = match[1].replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          const varValue = match[2].trim();
          theme[varName] = varValue;
        }
        
        if (Object.keys(theme).length === 0) {
          showNotification('Import Failed', 'No CSS variables found in the file. Make sure your theme uses CSS variables like --accent-green.', 'error');
          return;
        }
        
        // Apply the theme
        const root = document.documentElement;
        const merged = ensureDerivedThemeVars({ ...theme });
        Object.keys(merged).forEach(key => {
          const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
          root.style.setProperty(cssVar, merged[key]);
        });
        
        // Save as custom theme
        localStorage.setItem('customTheme', JSON.stringify(merged));
        localStorage.setItem('selectedThemePreset', 'custom');
        
        // Update selector
        const selector = document.getElementById('themePresetSelector');
        if (selector) {
          selector.value = 'custom';
        }
        
        showNotification('Theme Imported!', 'Your custom theme has been applied successfully.', 'success');
      } catch (error) {
        showNotification('Import Failed', 'Failed to parse CSS file: ' + error.message, 'error');
        console.error('Theme import error:', error);
      }
    };
    
    reader.readAsText(file);
  };
  
  input.click();
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

function playTrackFromPlaylist(trackId, trackData, playlistId, index) {
  // Find the playlist
  const playlist = playlists.find(p => String(p.id) === String(playlistId));
  if (!playlist) {
    // Fallback to regular playTrack if playlist not found
    playTrack(trackId, trackData, false);
    return;
  }
  
  // Set up the current playlist and index
  currentPlaylist = [...playlist.songs];
  currentIndex = index;
  isPlayingFromRecommendations = false; // Not playing from recommendations
  
  // Play the selected track
  playTrack(trackId, trackData, false);
}

// --- Window Button Style Switcher ---
function setWindowButtonStyle(style) {
  const controls = document.getElementById('windowControls');
  if (!controls) return;
  controls.classList.remove('windows-style', 'macos-style');
  controls.classList.add(style === 'macos' ? 'macos-style' : 'windows-style');
  localStorage.setItem('windowButtonStyle', style);
}

function loadWindowButtonStyle() {
  const style = localStorage.getItem('windowButtonStyle') || 'windows';
  const selector = document.getElementById('windowButtonStyleSelector');
  if (selector) selector.value = style;
  setWindowButtonStyle(style);
}

document.addEventListener('DOMContentLoaded', loadWindowButtonStyle);


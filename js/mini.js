(function(){
  const pinBtn = document.getElementById('pinBtn');
  const closeBtn = document.getElementById('closeBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const playBtn = document.getElementById('playBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const repeatBtn = document.getElementById('repeatBtn');
  const likeBtn = document.getElementById('likeBtn');

  const titleEl = document.getElementById('title');
  const artistEl = document.getElementById('artist');
  const coverEl = document.getElementById('cover');

  let isPlaying = false;
  let pinned = JSON.parse(localStorage.getItem('miniPinned') || 'false');
  let lastState = null;

  function setPinned(v){
    pinned = !!v;
    localStorage.setItem('miniPinned', JSON.stringify(pinned));
    if (window.electronAPI && window.electronAPI.setMiniPin) {
      window.electronAPI.setMiniPin(pinned);
    }
    pinBtn.classList.toggle('active', pinned);
  }

  pinBtn.addEventListener('click', () => setPinned(!pinned));
  closeBtn.addEventListener('click', () => window.close());
  prevBtn.addEventListener('click', () => window.electronAPI?.miniControl?.({ action: 'prev' }));
  nextBtn.addEventListener('click', () => window.electronAPI?.miniControl?.({ action: 'next' }));
  playBtn.addEventListener('click', () => window.electronAPI?.miniControl?.({ action: 'toggle' }));
  shuffleBtn.addEventListener('click', () => window.electronAPI?.miniControl?.({ action: 'shuffle' }));
  repeatBtn.addEventListener('click', () => window.electronAPI?.miniControl?.({ action: 'repeat' }));
  likeBtn.addEventListener('click', () => window.electronAPI?.miniControl?.({ action: 'like' }));

  function applyState(state){
    lastState = state;
    if (!state) return;
    titleEl.textContent = state.title || 'Unknown title';
    artistEl.textContent = state.artist || '';
    if (state.cover) {
      coverEl.src = state.cover;
    } else {
      coverEl.removeAttribute('src');
    }
    isPlaying = !!state.isPlaying;
    playBtn.innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    
    // Update shuffle state
    if (typeof state.isShuffled === 'boolean') {
      shuffleBtn.classList.toggle('active', state.isShuffled);
    }
    
    // Update repeat state (0: off, 1: all, 2: one)
    if (typeof state.repeatMode === 'number') {
      repeatBtn.classList.remove('active', 'repeat-one');
      if (state.repeatMode === 1) {
        repeatBtn.classList.add('active');
        repeatBtn.innerHTML = '<i class="fas fa-repeat"></i>';
      } else if (state.repeatMode === 2) {
        repeatBtn.classList.add('active', 'repeat-one');
        repeatBtn.innerHTML = '<i class="fas fa-repeat-1"></i>';
      } else {
        repeatBtn.innerHTML = '<i class="fas fa-repeat"></i>';
      }
    }
    
    // Update like state
    if (typeof state.isLiked === 'boolean') {
      likeBtn.innerHTML = state.isLiked ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
      likeBtn.classList.toggle('active', state.isLiked);
    }
  }

  // Init
  pinBtn.classList.toggle('active', pinned);
  if (window.electronAPI) {
    if (typeof window.electronAPI.setMiniPin === 'function') {
      window.electronAPI.setMiniPin(pinned);
    }
    if (typeof window.electronAPI.onPlayerState === 'function') {
      window.electronAPI.onPlayerState((state) => applyState(state));
    }
    if (typeof window.electronAPI.requestPlayerState === 'function') {
      window.electronAPI.requestPlayerState();
    }
  }
})();

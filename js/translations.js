// Translation system for Flowify
// To add a new language:
// 1. Add a new object in the translations object below
// 2. Copy all keys from 'en' and translate the values
// 3. Add the language to supportedLanguages array

const translations = {
  en: {
    // Welcome screen
    welcome: "Welcome to Flowify",
    welcomeSubtitle: "Your privacy-first music player",
    selectLanguage: "Select your language",
    enterName: "What should we call you?",
    namePlaceholder: "Your name",
  letsGo: "Let's Go!",
  next: "Next",
  startNow: "Start",
  prefsTitle: "Preferences",
  theme: "Theme",
  themeDesc: "Choose light or dark mode",
  showTrending: "Show Trending Songs",
  showTrendingDesc: "Show or hide trending section on Discover",
  enableDiscord: "Enable Discord RPC",
  enableDiscordDesc: "Show your activity on Discord",
    
    // Navigation
    navHome: "Home",
    navSearch: "Search",
    navPlaylists: "Playlists",
    navSettings: "Settings",
  navInfo: "Info",
    navDiscover: "Discover",
  navCustomize: "Customize",
    
    // Search/Discover
    searchPlaceholder: "Search for songs, artists, albums...",
    searchResults: "Search Results",
    noResults: "No results found",
    trendingSongs: "Trending Songs",
    popularNow: "Popular Now",
    
    // Player
    play: "Play",
    pause: "Pause",
    previous: "Previous",
    next: "Next",
    shuffle: "Shuffle",
    repeat: "Repeat",
    repeatOne: "Repeat One",
    repeatOff: "Repeat Off",
    volume: "Volume",
    mute: "Mute",
    unmute: "Unmute",
    
    // Playlists
    createPlaylist: "Create Playlist",
    playlistName: "Playlist Name",
    create: "Create",
    cancel: "Cancel",
    addToPlaylist: "Add to Playlist",
    removeFromPlaylist: "Remove from Playlist",
    deletePlaylist: "Delete Playlist",
    editPlaylist: "Edit Playlist",
    downloadPlaylist: "Download Playlist",
    importPlaylist: "Import Playlist (M3U)",
    exportPlaylist: "Export Playlist",
    likedSongs: "Liked Songs",
    playlistCreated: "Playlist created",
    playlistDeleted: "Playlist deleted",
    trackAdded: "Track added to playlist",
    trackRemoved: "Track removed from playlist",
    offline: "Offline",
    
    // Settings
    settings: "Settings",
    theme: "Theme",
    darkTheme: "Dark",
    lightTheme: "Light",
    audioQuality: "Audio Quality",
    qualityLow: "Low (96kbps)",
    qualityMedium: "Medium (128kbps)",
    qualityHigh: "High (320kbps)",
    qualityLossless: "Lossless (FLAC)",
    discordRPC: "Discord Rich Presence",
    enabled: "Enabled",
    disabled: "Disabled",
    storage: "Storage Management",
    clearDownloads: "Clear All Downloads",
    downloadsCleared: "All downloads cleared",
    customTheme: "Custom Theme",
    editCustomTheme: "Edit Custom Theme",
    about: "About",
    aboutText: "Flowify is a free music player, we focus on privacy, no account, no tracking, no bullshit, just music.",
    version: "Version",
    language: "Language",
    userName: "User Name",
    changeName: "Change Name",
    
    // Custom Theme Editor
    themeEditor: "Custom Theme Editor",
    themeEditorDesc: "Customize your theme by changing the colors below. Click 'Apply Theme' to preview, or 'Reset' to restore defaults.",
    bgGradientStart: "Background Gradient Start",
    bgGradientMid: "Background Gradient Mid",
    bgGradientEnd: "Background Gradient End",
    sidebarBg: "Sidebar Background",
    cardBg: "Card Background",
    cardHoverBg: "Card Hover",
    textPrimary: "Primary Text",
    textSecondary: "Secondary Text",
    accentColor: "Accent Color",
    accentHover: "Accent Hover",
    applyTheme: "Apply Theme",
    resetTheme: "Reset to Default",
    exportTheme: "Export",
    importTheme: "Import",
    themeApplied: "Theme applied successfully!",
    themeReset: "Theme reset to default",
    themeExported: "Theme exported successfully!",
    themeImported: "Theme imported successfully!",
    invalidTheme: "Invalid theme file",
    
    // Actions
    download: "Download",
    downloaded: "Downloaded",
    downloading: "Downloading",
    like: "Like",
    unlike: "Unlike",
    share: "Share",
    more: "More",
    
    // Messages
    trackDownloaded: "Track downloaded",
    trackLiked: "Track liked",
    trackUnliked: "Track removed from liked songs",
    error: "Error",
    success: "Success",
    
    // Greeting
    greeting: {
      morning: "Good morning",
      afternoon: "Good afternoon", 
      evening: "Good evening",
      night: "Good night"
    }
  },
  
  fr: {
    // Welcome screen
    welcome: "Bienvenue sur Flowify",
    welcomeSubtitle: "Votre lecteur de musique respectueux de la vie privée",
    selectLanguage: "Sélectionnez votre langue",
    enterName: "Comment devons-nous vous appeler ?",
    namePlaceholder: "Votre nom",
    letsGo: "C'est parti !",
    
    // Navigation
  navHome: "Accueil",
    navSearch: "Rechercher",
    navPlaylists: "Playlists",
    navSettings: "Paramètres",
    navInfo: "Info",
    navDiscover: "Découvrir",
  navCustomize: "Personnaliser",

  // Welcome/prefs
  letsGo: "C'est parti !",
  next: "Suivant",
  startNow: "Commencer",
  prefsTitle: "Préférences",
  theme: "Thème",
  themeDesc: "Choisissez le mode clair ou sombre",
  showTrending: "Afficher les chansons tendances",
  showTrendingDesc: "Afficher ou masquer la section tendances",
  enableDiscord: "Activer Discord RPC",
  enableDiscordDesc: "Afficher votre activité sur Discord",
    
    // Search/Discover
    searchPlaceholder: "Rechercher des chansons, artistes, albums...",
    searchResults: "Résultats de recherche",
    noResults: "Aucun résultat trouvé",
    trendingSongs: "Chansons tendances",
    popularNow: "Populaire maintenant",
    
    // Player
    play: "Lecture",
    pause: "Pause",
    previous: "Précédent",
    next: "Suivant",
    shuffle: "Aléatoire",
    repeat: "Répéter",
    repeatOne: "Répéter une fois",
    repeatOff: "Répétition désactivée",
    volume: "Volume",
    mute: "Muet",
    unmute: "Activer le son",
    
    // Playlists
    createPlaylist: "Créer une playlist",
    playlistName: "Nom de la playlist",
    create: "Créer",
    cancel: "Annuler",
    addToPlaylist: "Ajouter à la playlist",
    removeFromPlaylist: "Retirer de la playlist",
    deletePlaylist: "Supprimer la playlist",
    editPlaylist: "Modifier la playlist",
    downloadPlaylist: "Télécharger la playlist",
    importPlaylist: "Importer une playlist (M3U)",
    exportPlaylist: "Exporter la playlist",
    likedSongs: "Titres aimés",
    playlistCreated: "Playlist créée",
    playlistDeleted: "Playlist supprimée",
    trackAdded: "Piste ajoutée à la playlist",
    trackRemoved: "Piste retirée de la playlist",
    offline: "Hors ligne",
    
    // Settings
    settings: "Paramètres",
    theme: "Thème",
    darkTheme: "Sombre",
    lightTheme: "Clair",
    audioQuality: "Qualité audio",
    qualityLow: "Basse (96kbps)",
    qualityMedium: "Moyenne (128kbps)",
    qualityHigh: "Haute (320kbps)",
    qualityLossless: "Sans perte (FLAC)",
    discordRPC: "Discord Rich Presence",
    enabled: "Activé",
    disabled: "Désactivé",
    storage: "Gestion du stockage",
    clearDownloads: "Effacer tous les téléchargements",
    downloadsCleared: "Tous les téléchargements supprimés",
    customTheme: "Thème personnalisé",
    editCustomTheme: "Modifier le thème",
    about: "À propos",
    aboutText: "Flowify est un lecteur de musique gratuit, nous nous concentrons sur la confidentialité, pas de compte, pas de suivi, pas de conneries, juste de la musique.",
    version: "Version",
    language: "Langue",
    userName: "Nom d'utilisateur",
    changeName: "Changer de nom",
    
    // Custom Theme Editor
    themeEditor: "Éditeur de thème personnalisé",
    themeEditorDesc: "Personnalisez votre thème en modifiant les couleurs ci-dessous. Cliquez sur 'Appliquer le thème' pour prévisualiser ou 'Réinitialiser' pour restaurer les valeurs par défaut.",
    bgGradientStart: "Début du dégradé d'arrière-plan",
    bgGradientMid: "Milieu du dégradé d'arrière-plan",
    bgGradientEnd: "Fin du dégradé d'arrière-plan",
    sidebarBg: "Arrière-plan de la barre latérale",
    cardBg: "Arrière-plan de la carte",
    cardHoverBg: "Survol de la carte",
    textPrimary: "Texte principal",
    textSecondary: "Texte secondaire",
    accentColor: "Couleur d'accent",
    accentHover: "Survol de l'accent",
    applyTheme: "Appliquer le thème",
    resetTheme: "Réinitialiser",
    exportTheme: "Exporter",
    importTheme: "Importer",
    themeApplied: "Thème appliqué avec succès !",
    themeReset: "Thème réinitialisé",
    themeExported: "Thème exporté avec succès !",
    themeImported: "Thème importé avec succès !",
    invalidTheme: "Fichier de thème invalide",
    
    // Actions
    download: "Télécharger",
    downloaded: "Téléchargé",
    downloading: "Téléchargement",
    like: "Aimer",
    unlike: "Ne plus aimer",
    share: "Partager",
    more: "Plus",
    
    // Messages
    trackDownloaded: "Piste téléchargée",
    trackLiked: "Piste aimée",
    trackUnliked: "Piste retirée des titres aimés",
    error: "Erreur",
    success: "Succès",
    
    // Greeting
    greeting: {
      morning: "Bonjour",
      afternoon: "Bon après-midi",
      evening: "Bonsoir",
      night: "Bonne nuit"
    }
  }
};

// Supported languages configuration
const supportedLanguages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' }
];

// Current language (loaded from localStorage or default to English)
let currentLanguage = localStorage.getItem('language') || 'en';

// Translation function
function t(key) {
  const keys = key.split('.');
  let value = translations[currentLanguage];
  
  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      // Fallback to English if translation not found
      value = translations['en'];
      for (const k2 of keys) {
        if (value && typeof value === 'object') {
          value = value[k2];
        } else {
          return key; // Return key if not found
        }
      }
      return value || key;
    }
  }
  
  return value || key;
}

// Set language
function setLanguage(lang) {
  if (translations[lang]) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    updateUILanguage();
  }
}

// Update all UI text elements
function updateUILanguage() {
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const translation = t(key);
    
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.placeholder = translation;
    } else {
      element.textContent = translation;
    }
  });
  
  // Update all elements with data-i18n-html attribute (for HTML content)
  document.querySelectorAll('[data-i18n-html]').forEach(element => {
    const key = element.getAttribute('data-i18n-html');
    element.innerHTML = t(key);
  });
}

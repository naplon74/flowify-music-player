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
  customizeTitle: "Customize Flowify",
    
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
  customizeTitle: "Personnaliser Flowify",

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
  },

  es: {
    // Pantalla de bienvenida
    welcome: "Bienvenido a Flowify",
    welcomeSubtitle: "Tu reproductor de música centrado en la privacidad",
    selectLanguage: "Selecciona tu idioma",
    enterName: "¿Cómo deberíamos llamarte?",
    namePlaceholder: "Tu nombre",
    letsGo: "¡Vamos!",
    next: "Siguiente",
    startNow: "Empezar",
    prefsTitle: "Preferencias",
    theme: "Tema",
    themeDesc: "Elige modo claro u oscuro",
    showTrending: "Mostrar canciones en tendencia",
    showTrendingDesc: "Mostrar u ocultar la sección de tendencias",
    enableDiscord: "Activar Discord RPC",
    enableDiscordDesc: "Muestra tu actividad en Discord",

    // Navegación
    navHome: "Inicio",
    navSearch: "Buscar",
    navPlaylists: "Listas",
    navSettings: "Ajustes",
    navInfo: "Info",
    navDiscover: "Descubrir",
    navCustomize: "Personalizar",
    customizeTitle: "Personalizar Flowify",

    // Búsqueda/Descubrir
    searchPlaceholder: "Buscar canciones, artistas, álbumes...",
    searchResults: "Resultados de búsqueda",
    noResults: "Sin resultados",
    trendingSongs: "Canciones en tendencia",
    popularNow: "Popular ahora",

    // Reproductor
    play: "Reproducir",
    pause: "Pausa",
    previous: "Anterior",
    next: "Siguiente",
    shuffle: "Aleatorio",
    repeat: "Repetir",
    repeatOne: "Repetir una",
    repeatOff: "Sin repetición",
    volume: "Volumen",
    mute: "Silenciar",
    unmute: "Activar sonido",

    // Listas
    createPlaylist: "Crear lista",
    playlistName: "Nombre de la lista",
    create: "Crear",
    cancel: "Cancelar",
    addToPlaylist: "Añadir a lista",
    removeFromPlaylist: "Quitar de lista",
    deletePlaylist: "Eliminar lista",
    editPlaylist: "Editar lista",
    downloadPlaylist: "Descargar lista",
    importPlaylist: "Importar lista (M3U)",
    exportPlaylist: "Exportar lista",
    likedSongs: "Canciones que te gustan",
    playlistCreated: "Lista creada",
    playlistDeleted: "Lista eliminada",
    trackAdded: "Canción añadida a la lista",
    trackRemoved: "Canción quitada de la lista",
    offline: "Sin conexión",

    // Ajustes
    settings: "Ajustes",
    darkTheme: "Oscuro",
    lightTheme: "Claro",
    audioQuality: "Calidad de audio",
    qualityLow: "Baja (96kbps)",
    qualityMedium: "Media (128kbps)",
    qualityHigh: "Alta (320kbps)",
    qualityLossless: "Sin pérdida (FLAC)",
    discordRPC: "Discord Rich Presence",
    enabled: "Activado",
    disabled: "Desactivado",
    storage: "Gestión de almacenamiento",
    clearDownloads: "Borrar todas las descargas",
    downloadsCleared: "Descargas eliminadas",
    customTheme: "Tema personalizado",
    editCustomTheme: "Editar tema",
    about: "Acerca de",
    aboutText: "Flowify es un reproductor gratuito. Priorizamos tu privacidad: sin cuentas, sin rastreo, solo música.",
    version: "Versión",
    language: "Idioma",
    userName: "Nombre de usuario",
    changeName: "Cambiar nombre",

    // Editor de tema
    themeEditor: "Editor de tema personalizado",
    themeEditorDesc: "Personaliza tu tema cambiando los colores. Pulsa 'Aplicar tema' para ver la vista previa o 'Restablecer' para los valores por defecto.",
    bgGradientStart: "Inicio del degradado",
    bgGradientMid: "Centro del degradado",
    bgGradientEnd: "Fin del degradado",
    sidebarBg: "Fondo de la barra lateral",
    cardBg: "Fondo de tarjeta",
    cardHoverBg: "Hover de tarjeta",
    textPrimary: "Texto principal",
    textSecondary: "Texto secundario",
    accentColor: "Color de acento",
    accentHover: "Acento (hover)",
    applyTheme: "Aplicar tema",
    resetTheme: "Restablecer",
    exportTheme: "Exportar",
    importTheme: "Importar",
    themeApplied: "¡Tema aplicado!",
    themeReset: "Tema restablecido",
    themeExported: "Tema exportado",
    themeImported: "Tema importado",
    invalidTheme: "Archivo de tema inválido",

    // Acciones
    download: "Descargar",
    downloaded: "Descargado",
    downloading: "Descargando",
    like: "Me gusta",
    unlike: "No me gusta",
    share: "Compartir",
    more: "Más",

    // Mensajes
    trackDownloaded: "Canción descargada",
    trackLiked: "Canción marcada como me gusta",
    trackUnliked: "Canción retirada de me gusta",
    error: "Error",
    success: "Éxito",

    // Saludo
    greeting: {
      morning: "Buenos días",
      afternoon: "Buenas tardes",
      evening: "Buenas noches",
      night: "Buenas noches"
    }
  },

  it: {
    // Schermata di benvenuto
    welcome: "Benvenuto in Flowify",
    welcomeSubtitle: "Il tuo lettore musicale che rispetta la privacy",
    selectLanguage: "Seleziona la tua lingua",
    enterName: "Come dovremmo chiamarti?",
    namePlaceholder: "Il tuo nome",
    letsGo: "Iniziamo",
    next: "Avanti",
    startNow: "Avvia",
    prefsTitle: "Preferenze",
    theme: "Tema",
    themeDesc: "Scegli tema chiaro o scuro",
    showTrending: "Mostra brani di tendenza",
    showTrendingDesc: "Mostra o nascondi la sezione tendenze",
    enableDiscord: "Abilita Discord RPC",
    enableDiscordDesc: "Mostra la tua attività su Discord",

    // Navigazione
    navHome: "Home",
    navSearch: "Cerca",
    navPlaylists: "Playlist",
    navSettings: "Impostazioni",
    navInfo: "Info",
    navDiscover: "Scopri",
    navCustomize: "Personalizza",
    customizeTitle: "Personalizza Flowify",

    // Ricerca/Scopri
    searchPlaceholder: "Cerca brani, artisti, album...",
    searchResults: "Risultati di ricerca",
    noResults: "Nessun risultato",
    trendingSongs: "Brani di tendenza",
    popularNow: "Popolari ora",

    // Player
    play: "Riproduci",
    pause: "Pausa",
    previous: "Precedente",
    next: "Successivo",
    shuffle: "Casuale",
    repeat: "Ripeti",
    repeatOne: "Ripeti uno",
    repeatOff: "Ripetizione disattivata",
    volume: "Volume",
    mute: "Muto",
    unmute: "Riattiva audio",

    // Playlist
    createPlaylist: "Crea playlist",
    playlistName: "Nome playlist",
    create: "Crea",
    cancel: "Annulla",
    addToPlaylist: "Aggiungi alla playlist",
    removeFromPlaylist: "Rimuovi dalla playlist",
    deletePlaylist: "Elimina playlist",
    editPlaylist: "Modifica playlist",
    downloadPlaylist: "Scarica playlist",
    importPlaylist: "Importa playlist (M3U)",
    exportPlaylist: "Esporta playlist",
    likedSongs: "Brani preferiti",
    playlistCreated: "Playlist creata",
    playlistDeleted: "Playlist eliminata",
    trackAdded: "Brano aggiunto alla playlist",
    trackRemoved: "Brano rimosso dalla playlist",
    offline: "Offline",

    // Impostazioni
    settings: "Impostazioni",
    darkTheme: "Scuro",
    lightTheme: "Chiaro",
    audioQuality: "Qualità audio",
    qualityLow: "Bassa (96kbps)",
    qualityMedium: "Media (128kbps)",
    qualityHigh: "Alta (320kbps)",
    qualityLossless: "Senza perdita (FLAC)",
    discordRPC: "Discord Rich Presence",
    enabled: "Abilitato",
    disabled: "Disabilitato",
    storage: "Gestione archiviazione",
    clearDownloads: "Cancella tutti i download",
    downloadsCleared: "Download cancellati",
    customTheme: "Tema personalizzato",
    editCustomTheme: "Modifica tema",
    about: "Informazioni",
    aboutText: "Flowify è un lettore musicale gratuito. Rispettiamo la privacy: niente account, niente tracciamento, solo musica.",
    version: "Versione",
    language: "Lingua",
    userName: "Nome utente",
    changeName: "Cambia nome",

    // Editor tema
    themeEditor: "Editor tema personalizzato",
    themeEditorDesc: "Personalizza il tema modificando i colori. Clicca 'Applica tema' per l'anteprima o 'Ripristina' per i valori predefiniti.",
    bgGradientStart: "Inizio gradiente",
    bgGradientMid: "Centro gradiente",
    bgGradientEnd: "Fine gradiente",
    sidebarBg: "Sfondo barra laterale",
    cardBg: "Sfondo scheda",
    cardHoverBg: "Hover scheda",
    textPrimary: "Testo primario",
    textSecondary: "Testo secondario",
    accentColor: "Colore accento",
    accentHover: "Accento (hover)",
    applyTheme: "Applica tema",
    resetTheme: "Ripristina",
    exportTheme: "Esporta",
    importTheme: "Importa",
    themeApplied: "Tema applicato",
    themeReset: "Tema ripristinato",
    themeExported: "Tema esportato",
    themeImported: "Tema importato",
    invalidTheme: "File tema non valido",

    // Azioni
    download: "Scarica",
    downloaded: "Scaricato",
    downloading: "Scaricamento",
    like: "Mi piace",
    unlike: "Non mi piace",
    share: "Condividi",
    more: "Altro",

    // Messaggi
    trackDownloaded: "Brano scaricato",
    trackLiked: "Brano aggiunto ai preferiti",
    trackUnliked: "Brano rimosso dai preferiti",
    error: "Errore",
    success: "Successo",

    // Saluto
    greeting: {
      morning: "Buongiorno",
      afternoon: "Buon pomeriggio",
      evening: "Buonasera",
      night: "Buona notte"
    }
  }
};

// Supported languages configuration
const supportedLanguages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' }
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

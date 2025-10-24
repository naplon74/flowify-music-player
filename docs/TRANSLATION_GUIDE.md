# Translation Guide for Flowify

## How to Add a New Language

Adding a new language to Flowify is straightforward! Follow these simple steps:

### 1. Edit `translations.js`

Open the `translations.js` file and locate the `translations` object.

### 2. Add Your Language Object

Copy the entire English (`en`) translation object and paste it with your new language code. For example, to add Spanish:

```javascript
const translations = {
  en: { /* ... existing English translations ... */ },
  fr: { /* ... existing French translations ... */ },
  
  // Add Spanish
  es: {
    // Welcome screen
    welcome: "Bienvenido a Flowify",
    welcomeSubtitle: "Tu reproductor de música que respeta tu privacidad",
    selectLanguage: "Selecciona tu idioma",
    enterName: "¿Cómo deberíamos llamarte?",
    namePlaceholder: "Tu nombre",
    letsGo: "¡Vamos!",
    
    // ... translate all other keys ...
  }
};
```

### 3. Update Supported Languages

Add your language to the `supportedLanguages` array:

```javascript
const supportedLanguages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' }  // Add this line
];
```

### 4. Add Language Button to Welcome Screen

Open `index.html` and find the language selector section. Add a new button:

```html
<div class="language-selector">
  <button class="language-btn active" data-lang="en" onclick="selectLanguage('en')">
    <span class="flag">🇬🇧</span>
    <span>English</span>
  </button>
  <button class="language-btn" data-lang="fr" onclick="selectLanguage('fr')">
    <span class="flag">🇫🇷</span>
    <span>Français</span>
  </button>
  <!-- Add your new language -->
  <button class="language-btn" data-lang="es" onclick="selectLanguage('es')">
    <span class="flag">🇪🇸</span>
    <span>Español</span>
  </button>
</div>
```

## Translation Keys Reference

Here's a quick reference of what each translation key is used for:

### Welcome Screen
- `welcome` - Main welcome title
- `welcomeSubtitle` - Subtitle text
- `selectLanguage` - Language selection label
- `enterName` - Name input label
- `namePlaceholder` - Placeholder for name input
- `letsGo` - Submit button text

### Navigation
- `navHome`, `navSearch`, `navPlaylists`, `navSettings` - Navigation menu items

### Player Controls
- `play`, `pause`, `previous`, `next` - Playback buttons
- `shuffle`, `repeat`, `repeatOne`, `repeatOff` - Player modes
- `volume`, `mute`, `unmute` - Volume controls

### Playlists
- `createPlaylist`, `deletePlaylist`, `editPlaylist` - Playlist actions
- `addToPlaylist`, `removeFromPlaylist` - Track management
- `likedSongs` - Special playlist name
- `offline` - Offline indicator

### Settings
- `theme`, `darkTheme`, `lightTheme` - Theme options
- `audioQuality` - Quality settings section
- `discordRPC` - Discord integration
- `storage` - Storage management
- `customTheme` - Custom theme editor

### Messages
- `trackDownloaded`, `trackLiked`, `trackUnliked` - User feedback
- `error`, `success` - Generic messages

### Greetings
- `greeting.morning`, `greeting.afternoon`, `greeting.evening`, `greeting.night` - Time-based greetings

## Tips for Translators

1. **Keep the tone consistent** - Flowify is friendly and casual
2. **Respect placeholders** - Don't translate technical terms like "Discord RPC" or file types
3. **Test your translations** - Make sure they fit in the UI without breaking layout
4. **Consider context** - Some words may need different translations based on where they appear
5. **Use native speakers** - If possible, have a native speaker review your translations

## Testing Your Translation

1. Clear your browser's localStorage to trigger the welcome screen
2. Select your new language
3. Navigate through all sections of the app
4. Check that all text is properly translated
5. Verify that buttons, labels, and messages display correctly

## Need Help?

If you're adding a new language and need assistance, feel free to open an issue on GitHub!

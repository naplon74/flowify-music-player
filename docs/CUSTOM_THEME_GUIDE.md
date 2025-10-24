# 🎨 Flowify Custom Theme Guide

Welcome to Flowify's custom theme system! This guide will help you personalize your Flowify music player with custom colors, fonts, and styles.

## 📋 Table of Contents
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Customization Options](#customization-options)
- [Pre-made Themes](#pre-made-themes)
- [Tips & Tricks](#tips--tricks)
- [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Step 1: Get the Template
1. Download the `custom-theme-template.css` file from this repository
2. Save it to a location you can easily access

### Step 2: Customize Your Theme
1. Open `custom-theme-template.css` in any text editor (Notepad, VS Code, etc.)
2. Find the section you want to customize (colors, fonts, buttons, etc.)
3. Change the values to your liking
4. Save the file

### Step 3: Apply Your Theme
1. Copy your modified `custom-theme-template.css` file
2. Place it in your Flowify installation folder
3. Rename it to `custom-theme.css`
4. Restart Flowify

**That's it!** Your custom theme should now be active.

---

## 🎨 How It Works

Flowify uses **CSS variables** to control all colors and styles. By changing these variables, you can completely transform the look of the app without breaking anything.

### What are CSS Variables?
CSS variables look like this:
```css
--accent-green: #2d8659;
```

The part before the colon (`:`) is the variable name, and the part after is the value (in this case, a green color).

### Safe Customization
The template file includes:
- ✅ **Safe zones** with clear explanations
- ✅ **Pre-made themes** you can use instantly
- ✅ **Comments** explaining what each section does
- ✅ **Examples** showing how to customize

---

## 🎯 Customization Options

### 1. **Colors** (Easiest)
Change the look of your app by modifying colors:

```css
/* Dark theme colors */
:root {
  --bg-gradient-start: #0d3d2e;    /* Background color 1 */
  --bg-gradient-mid: #1a5943;      /* Background color 2 */
  --accent-green: #2d8659;         /* Main accent color */
}
```

**How to find colors:**
- Use an online color picker: [coolors.co](https://coolors.co)
- Use hex codes: `#FF0000` (red), `#00FF00` (green), `#0000FF` (blue)
- Use RGB: `rgb(255, 0, 0)` or with transparency: `rgba(255, 0, 0, 0.5)`

### 2. **Fonts** (Easy)
Change the text style:

```css
body {
  font-family: 'Roboto', 'Arial', sans-serif;
  font-size: 16px;
}
```

**Popular fonts to try:**
- `'Inter'` - Clean and modern
- `'Poppins'` - Rounded and friendly
- `'Roboto'` - Professional and readable
- `'Montserrat'` - Bold and stylish

### 3. **Buttons** (Medium)
Customize button appearance:

```css
.btn {
  background: var(--accent-green);
  border-radius: 8px;          /* Roundness of corners */
  padding: 10px 20px;          /* Size (top/bottom left/right) */
}

.btn:hover {
  transform: translateY(-2px); /* Lift effect on hover */
}
```

### 4. **Cards & Tiles** (Medium)
Change how song cards look:

```css
.track-item {
  border-radius: 12px;         /* Corner roundness */
  padding: 15px;               /* Internal spacing */
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3); /* Shadow */
}
```

### 5. **Animations** (Advanced)
Control animation speed:

```css
* {
  transition-duration: 0.3s;   /* Animation speed */
}
```

Make it **faster**: `0.1s`  
Make it **slower**: `0.5s`  
**Disable**: `0s`

---

## 🌟 Pre-made Themes

The template includes 5 pre-made themes you can use instantly!

### 1. 🌊 **Blue Ocean Theme**
Cool blue tones reminiscent of the ocean
```css
:root {
  --bg-gradient-start: #0a1929;
  --accent-green: #2196F3;
}
```

### 2. 🌆 **Purple Nights Theme**
Deep purple with mystical vibes
```css
:root {
  --bg-gradient-start: #1a0033;
  --accent-green: #9c27b0;
}
```

### 3. 🌅 **Sunset Orange Theme**
Warm orange and amber colors
```css
:root {
  --bg-gradient-start: #1a0f00;
  --accent-green: #ff6f00;
}
```

### 4. 🌙 **Midnight Dark Theme**
Pure black with neon green accents
```css
:root {
  --bg-gradient-start: #000000;
  --accent-green: #00ff00;
}
```

### 5. 🍒 **Cherry Red Theme**
Bold red with dramatic contrast
```css
:root {
  --bg-gradient-start: #1a0000;
  --accent-green: #f44336;
}
```

**To use a pre-made theme:**
1. Find the theme in the template file
2. Remove the `/*` at the start and `*/` at the end
3. Save and restart Flowify

---

## 💡 Tips & Tricks

### Creating Your Own Color Scheme
1. **Start with one color** - Pick your favorite color for `--accent-green`
2. **Generate variations** - Use [coolors.co](https://coolors.co) to create matching colors
3. **Test as you go** - Save and restart Flowify frequently to see changes
4. **Keep contrast high** - Make sure text is readable on backgrounds

### Color Transparency
Add transparency to colors for glass effects:
```css
rgba(45, 134, 89, 0.7)  /* 70% opacity */
rgba(45, 134, 89, 0.3)  /* 30% opacity */
```

### Backup Your Theme
Always keep a copy of your custom theme file! If something breaks, you can:
1. Delete `custom-theme.css`
2. Restart Flowify (it will use default theme)
3. Fix your custom file
4. Try again

### Find the Perfect Font
1. Visit [Google Fonts](https://fonts.google.com)
2. Browse and find a font you like
3. Copy the font name (e.g., "Poppins")
4. Add it to your theme file

---

## 🔧 Troubleshooting

### My theme isn't loading
- ✅ Make sure the file is named exactly `custom-theme.css`
- ✅ Check that it's in the Flowify installation folder
- ✅ Restart Flowify completely (close and reopen)

### Colors look wrong
- ✅ Use hex codes starting with `#` (e.g., `#FF0000`)
- ✅ Check for typos in color values
- ✅ Make sure you didn't delete any semicolons (`;`)

### App looks broken
- ✅ Delete `custom-theme.css` temporarily
- ✅ Restart Flowify to use default theme
- ✅ Check your CSS for syntax errors
- ✅ Compare with the original template

### Text is hard to read
- ✅ Increase contrast between text and background
- ✅ Make `--text-primary` brighter (dark theme) or darker (light theme)
- ✅ Try different background colors

### Want to start over?
1. Delete your `custom-theme.css` file
2. Download a fresh copy of `custom-theme-template.css`
3. Start customizing again

---

## 🎓 Learning Resources

Want to learn more about CSS customization?

- **CSS Basics**: [MDN Web Docs - CSS](https://developer.mozilla.org/en-US/docs/Web/CSS)
- **Color Theory**: [Adobe Color Wheel](https://color.adobe.com)
- **CSS Variables**: [CSS Custom Properties Guide](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- **Google Fonts**: [fonts.google.com](https://fonts.google.com)

---

## 🤝 Sharing Your Theme

Created an awesome theme? Share it with the community!

1. Upload your `custom-theme.css` file to a GitHub Gist
2. Share the link on Flowify's discussions
3. Include screenshots of your theme
4. Name your theme something cool!

---

## 📝 Example: Creating a Custom Theme

Let's create a "Cyberpunk" theme together:

```css
/* Cyberpunk Theme - Neon Pink & Blue */
:root {
  /* Dark background with blue tones */
  --bg-gradient-start: #0a0a1a;
  --bg-gradient-mid: #1a0a2e;
  --bg-gradient-end: #16003e;
  
  /* Neon pink accent */
  --accent-green: #ff006e;
  --accent-green-hover: #ff3387;
  
  /* Bright cyan for text */
  --text-primary: #00ffff;
  --text-secondary: rgba(0, 255, 255, 0.8);
  
  /* Dark cards with glow */
  --card-bg: rgba(26, 10, 46, 0.8);
  --card-hover-bg: rgba(38, 16, 70, 0.9);
}

/* Add neon glow to buttons */
.btn:hover {
  box-shadow: 0 0 20px #ff006e, 0 0 40px #ff006e;
}
```

Save this, restart Flowify, and enjoy your cyberpunk theme! 🌃

---

## ❓ Need Help?

- **Discord**: Join our community server
- **GitHub Issues**: Report bugs or ask questions
- **Documentation**: Check out the main README.md

---

**Happy theming! 🎨✨**

Made with 💚 by the Flowify community

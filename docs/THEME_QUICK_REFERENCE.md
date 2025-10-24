# 🎨 Flowify Custom Theme - Quick Reference Card

## 🚀 Quick Start (3 Steps)
1. Download `custom-theme-template.css`
2. Edit colors/fonts/styles
3. Rename to `custom-theme.css` and restart Flowify

---

## 🎨 Most Common Customizations

### Change Main Color
```css
:root {
  --accent-green: #YOUR_COLOR_HERE;
  --accent-green-hover: #LIGHTER_VERSION;
}
```

### Change Background
```css
:root {
  --bg-gradient-start: #COLOR1;
  --bg-gradient-mid: #COLOR2;
  --bg-gradient-end: #COLOR3;
}
```

### Change Text Color
```css
:root {
  --text-primary: #YOUR_COLOR;
}
```

### Change Font
```css
body {
  font-family: 'YourFont', sans-serif;
}
```

### Make Corners More/Less Rounded
```css
.btn, .track-item, .modal-content {
  border-radius: 20px; /* Bigger = more rounded */
}
```

### Change Animation Speed
```css
* {
  transition-duration: 0.2s; /* Faster */
  /* OR */
  transition-duration: 0.5s; /* Slower */
}
```

---

## 🌈 Quick Color Palette Examples

### 🌊 Ocean Blue
```css
--accent-green: #2196F3;
--bg-gradient-start: #0a1929;
```

### 💜 Purple Dream
```css
--accent-green: #9c27b0;
--bg-gradient-start: #1a0033;
```

### 🔥 Fire Red
```css
--accent-green: #f44336;
--bg-gradient-start: #1a0000;
```

### 🌙 Midnight
```css
--accent-green: #00ff00;
--bg-gradient-start: #000000;
```

### 🌅 Sunset
```css
--accent-green: #ff6f00;
--bg-gradient-start: #1a0f00;
```

---

## 🛠️ Color Tools

**Find Colors:**
- [coolors.co](https://coolors.co) - Generate palettes
- [color.adobe.com](https://color.adobe.com) - Adobe Color Wheel
- Google "color picker" - Built-in browser tool

**Format:**
- Hex: `#FF0000` ← Most common
- RGB: `rgb(255, 0, 0)`
- RGBA: `rgba(255, 0, 0, 0.5)` ← With transparency

---

## 📝 File Locations

**Template:** `custom-theme-template.css` (your starting point)
**Active Theme:** `custom-theme.css` (rename template to this)
**Full Guide:** `CUSTOM_THEME_GUIDE.md` (detailed instructions)

---

## ❌ Troubleshooting

**Theme not loading?**
- File must be named exactly `custom-theme.css`
- Must be in Flowify folder
- Restart Flowify

**Looks broken?**
- Delete `custom-theme.css`
- Restart → back to default
- Fix errors and try again

**Can't decide on colors?**
- Start with one of the pre-made themes
- Tweak from there!

---

## 💡 Pro Tips

✅ **Backup** your theme file!
✅ **Test frequently** - save and restart often
✅ **Start simple** - change one thing at a time
✅ **Use high contrast** - make sure text is readable
✅ **Copy examples** - no shame in using what works!

---

**Need more help?** Check out `CUSTOM_THEME_GUIDE.md` for the full guide!

🎨 Happy theming!

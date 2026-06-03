# How to View Documentation in Your Browser

You have several options for viewing the Finance App documentation in a web browser.

---

## Option 1: Docsify Documentation Website (Recommended) ✨

**Docsify** creates a beautiful, searchable documentation website from your markdown files.

### Start the Documentation Server

```powershell
# From the Finance folder
npm run docs
```

**Or directly:**
```powershell
docsify serve docs
```

### Access the Documentation

Once started, open your browser to:
```
http://localhost:3000
```

**Features:**
- ✅ Beautiful sidebar navigation
- ✅ Full-text search
- ✅ Syntax highlighting for code
- ✅ Copy code button
- ✅ Mobile-friendly
- ✅ Dark/light theme

### Stop the Server

Press `Ctrl+C` in PowerShell to stop the documentation server.

---

## Option 2: Direct File Access (Quick & Simple)

### View as Plain HTML

1. Open File Explorer
2. Navigate to: `C:\Backups\Finance\docs\`
3. Right-click any `.md` file
4. Choose: **Open with → Browser**

**Note:** Markdown won't be rendered nicely, but links will work.

---

## Option 3: Browser Extension (For Better Rendering)

Install a markdown viewer extension for your browser:

### For Chrome/Edge:
1. Install: [Markdown Viewer](https://chrome.google.com/webstore/detail/markdown-viewer)
2. Enable "Allow access to file URLs" in extension settings
3. Open any `.md` file in browser
4. Markdown will render beautifully

### For Firefox:
1. Install: [Markdown Viewer Webext](https://addons.mozilla.org/addon/markdown-viewer-webext/)
2. Configure to auto-render `.md` files
3. Open any `.md` file in browser

---

## Option 4: VS Code Preview (If You Have VS Code)

If you're editing docs in VS Code:

1. Open any `.md` file in VS Code
2. Press `Ctrl+Shift+V` to open preview
3. Or click the preview icon in top right
4. Or right-click → "Open Preview"

---

## Comparison

| Method | Pros | Cons |
|--------|------|------|
| **Docsify** | Beautiful, searchable, navigation | Requires running server |
| **Browser Extension** | Easy, renders nicely | Need to install extension |
| **Direct File** | Instant, no setup | Plain text, no styling |
| **VS Code** | Great preview, side-by-side | Only works in VS Code |

---

## Recommended Workflow

### For Daily Use:
→ **VS Code Preview** (if editing docs)

### For Reading/Browsing:
→ **Docsify Server** (`npm run docs`)

### For Quick Reference:
→ **Browser Extension** + open file directly

---

## Running Both App and Docs Simultaneously

You can run both the Finance App and the Documentation server at the same time:

### Terminal 1 (Finance App):
```powershell
cd C:\Backups\Finance
npm run dev
```
Open: http://localhost:3000

### Terminal 2 (Documentation):
```powershell
cd C:\Backups\Finance
docsify serve docs -p 3001
```
Open: http://localhost:3001

**Note:** Documentation uses port 3001 to avoid conflict with the app on port 3000.

---

## Customizing Docsify

The Docsify configuration is in:
- `docs/index.html` - Main configuration and theme
- `docs/_sidebar.md` - Sidebar navigation menu

### Change Theme:

Edit `docs/index.html` and change the CSS link:

**Dark theme:**
```html
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify@4/lib/themes/dark.css">
```

**Other themes:**
- `vue.css` (default - current)
- `buble.css` (blue theme)
- `dark.css` (dark mode)
- `pure.css` (minimal)

### Add Plugins:

Docsify has many plugins available at: https://docsify.js.org/#/plugins

---

## Troubleshooting

### "docsify: command not found"

**Solution:**
```powershell
npm install -g docsify-cli
```

### Port 3000 already in use

**Solution:**
```powershell
# Use a different port
docsify serve docs -p 3001
```

### Images not loading

**Solution:**
- Use relative paths in markdown: `![image](./image.png)`
- Place images in the `docs/` folder or a `docs/images/` subfolder

---

## Quick Start Guide

**Fastest way to view docs:**

```powershell
# 1. Open PowerShell in Finance folder
cd C:\Backups\Finance

# 2. Start documentation server
npm run docs

# 3. Open browser to:
# http://localhost:3000
```

That's it! Your documentation will open as a searchable website. 🎉

---

**Last Updated**: April 14, 2026

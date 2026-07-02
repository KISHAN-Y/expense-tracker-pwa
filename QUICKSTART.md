# Expense Tracker PWA - Quick Start Guide

## 5-Minute Setup

### Step 1: Prepare Google Sheets (2 min)

```
1. Go to https://sheets.google.com
2. Create new spreadsheet → name it "Expense Tracker"
3. Copy Sheet ID from URL: https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
   - Keep this ID safe!
```

### Step 2: Deploy Google Apps Script Backend (2 min)

```
1. Go to https://script.google.com
2. Create new project
3. Delete default code
4. Copy code from: backend/apps-script.js
5. Replace 'YOUR_SHEET_ID' with your Sheet ID
6. Click "Deploy" → "New Deployment"
   - Type: Web app
   - Execute as: [Your Account]
   - Who has access: Anyone
   - Click Deploy
7. Copy the deployment URL (looks like: https://script.google.com/macros/d/...)
```

### Step 3: Configure Frontend (1 min)

```
1. Open: scripts/config.js
2. Find line: API_ENDPOINT: 'https://script.google.com/macros/d/YOUR_SCRIPT_ID/userweb'
3. Replace with your deployment URL
4. Save file
```

### Step 4: Upload Files

Choose one:

**Option A: GitHub Pages (Recommended)**
```
1. Create GitHub repo: expense-tracker-pwa
2. Enable GitHub Pages (Settings → Pages → Main branch)
3. Upload all files
4. Access at: https://[username].github.io/expense-tracker-pwa
```
, 
**Option B: Netlify**
```
1. Create account at netlify.com
2. Drag & drop project folder
3. Done! Auto deployed
```

**Option C: Firebase**
```
1. npm install -g firebase-tools
2. firebase login
3. firebase init
4. firebase deploy
```

**Option D: Simple HTTP Server**
```
1. Install Python/Node.js
2. Run: python -m http.server 8000
3. Visit: http://localhost:8000
```

## Test It!

### On Desktop
```
1. Open in Chrome/Edge
2. Click install button (appears in address bar)
3. App installs to your computer
4. Add a transaction
5. Go offline (DevTools → Network → Offline)
6. Add another transaction
7. Go online → watch it sync!
```

### On Mobile
```
1. Open in mobile browser
2. Tap menu → "Add to Home Screen"
3. App appears on home screen
4. Same offline/online test as desktop
```

## Verify Setup

### Check Backend is Working
```
1. Go to Scripts in Google Drive
2. Click on your project
3. Click "Executions"
4. Should show recent runs with status ✓
```

### Check Frontend is Working
```
1. Open app in browser
2. Open DevTools (F12)
3. Go to Console tab
4. Should see "App initialized successfully"
5. No red errors
```

### Check Service Worker
```
1. DevTools → Application → Service Workers
2. Should show "Service Worker registered"
3. Status shows "running"
```

## Common Issues & Fixes

### "API Error" when adding transaction

**Problem**: API endpoint not configured correctly

**Fix**:
```
1. Copy full deployment URL from Google Apps Script
2. In scripts/config.js, paste the entire URL
3. Make sure it ends with /userweb
4. Reload page
```

### Offline mode not working

**Problem**: Service Worker not registered

**Fix**:
```
1. Open DevTools (F12)
2. Go to Application → Service Workers
3. Check if "Service Worker registered" appears
4. If not:
   - Refresh page
   - Check browser console for errors
   - Ensure HTTPS (or localhost)
```

### Transactions not saving

**Problem**: Google Sheet ID missing or wrong

**Fix**:
```
1. Get Sheet ID from Google Sheets URL
2. In Google Apps Script: Replace 'YOUR_SHEET_ID'
3. Redeploy with new version
4. Update API_ENDPOINT if needed
5. Try again
```

### App not installing

**Problem**: Manifest issues or not HTTPS

**Fix**:
```
1. Check manifest.json exists
2. Verify it's valid JSON (use jsonlint.com)
3. For production: Use HTTPS
4. For local: localhost works
5. Refresh page and try again
```

## What to Do Next

### Basic Usage
```
✅ Add transactions (income/expense)
✅ View dashboard with totals
✅ Search and filter transactions
✅ Toggle dark mode
✅ Export to CSV
```

### Advanced Features
```
⏳ Coming: Charts and analytics
⏳ Coming: Budget planning
⏳ Coming: Recurring transactions
⏳ Coming: Receipt storage
```

### Customization
```
🎨 Change colors in styles/main.css
📝 Add categories in scripts/config.js
🖼️ Add icons in assets/
📱 Modify layout in index.html
```

## Useful Links

- **Google Sheets**: https://sheets.google.com
- **Google Apps Script**: https://script.google.com
- **GitHub Pages**: https://pages.github.com
- **Netlify**: https://netlify.com
- **MDN Web Docs**: https://developer.mozilla.org
- **PWA Builder**: https://www.pwabuilder.com

## Tips & Tricks

1. **Speed up development**: Open DevTools and use throttling to test offline
2. **Save icons**: Use https://www.pwabuilder.com/imageGenerator to auto-generate
3. **Test everywhere**: Try multiple browsers (Chrome, Firefox, Safari)
4. **Mobile first**: Design on phone, then check desktop
5. **Monitor storage**: App uses IndexedDB (limited by browser)

## Support

If something isn't working:

1. **Check console**: DevTools (F12) → Console tab
2. **Check Service Worker**: Application → Service Workers
3. **Check IndexedDB**: Application → Storage → IndexedDB
4. **Check Network**: Application → Cache Storage
5. **Read logs**: Google Apps Script → Executions

## Performance

Expected performance:
- ⚡ Load time: <1 second
- ⚡ Lighthouse score: 90+
- ⚡ App size: ~100KB
- ⚡ Offline mode: Instant

## Security

Your data is:
- ✅ Stored in YOUR Google Account
- ✅ Never sent to third parties
- ✅ Cached locally for offline use
- ✅ Encrypted in transit (HTTPS)

---

**You're all set! Start tracking your expenses! 💰**

Need help? Check README.md for detailed documentation.

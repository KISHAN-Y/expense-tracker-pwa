# Deployment Guide

## Pre-Deployment Checklist

- [ ] All files created and tested locally
- [ ] Google Apps Script deployed and working
- [ ] API endpoint configured in config.js
- [ ] Icons created and placed in assets/
- [ ] manifest.json updated with correct paths
- [ ] Service Worker file present
- [ ] README.md reviewed
- [ ] QUICKSTART.md reviewed

## Deployment Options

### Option 1: GitHub Pages (Recommended)

**Pros**: Free, easy, auto HTTPS, tight GitHub integration

**Steps**:

1. Create GitHub account (if needed)
2. Create new repository: `expense-tracker-pwa`
3. Go to Settings → Pages
4. Select "Deploy from a branch"
5. Select branch: main
6. Select folder: root
7. Click Save
8. Wait for deployment (takes 1-2 minutes)
9. Access at: `https://[username].github.io/expense-tracker-pwa`

**Push to GitHub**:

```bash
# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Expense Tracker PWA"

# Create main branch
git branch -M main

# Add remote
git remote add origin https://github.com/[username]/expense-tracker-pwa.git

# Push
git push -u origin main
```

### Option 2: Netlify

**Pros**: Easy setup, great UI, free tier generous

**Steps**:

1. Go to [Netlify](https://netlify.com)
2. Sign up with GitHub
3. Click "Add new site"
4. Choose "Deploy manually"
5. Drag and drop project folder
6. Wait for deployment
7. Get URL: `https://[random-name].netlify.app`

**Or connect Git**:

1. Go to [Netlify](https://netlify.com)
2. Click "New site from Git"
3. Select GitHub
4. Choose `expense-tracker-pwa` repo
5. Click Deploy

### Option 3: Firebase Hosting

**Pros**: Google infrastructure, scalable, free tier

**Steps**:

```bash
# Install Firebase tools
npm install -g firebase-tools

# Login
firebase login

# Initialize
firebase init hosting

# Build
npm run build  # If you have build step

# Deploy
firebase deploy
```

### Option 4: Vercel

**Pros**: Simple, fast, git-connected

**Steps**:

1. Go to [Vercel](https://vercel.com)
2. Click "New Project"
3. Import GitHub repo
4. Configure (use default settings)
5. Deploy

### Option 5: AWS S3 + CloudFront

**Pros**: Powerful, can scale, pay-per-use

**Steps**:

1. Create S3 bucket
2. Upload files
3. Enable static website hosting
4. Set bucket policy to public
5. Create CloudFront distribution
6. Access via CloudFront URL

### Option 6: Self-hosted VPS

**Pros**: Full control, no restrictions

**Steps**:

```bash
# SSH into server
ssh user@your-server.com

# Install web server (nginx/apache)
sudo apt-get install nginx

# Upload files to /var/www/html/

# Configure domain
# Point domain DNS to server IP
# Setup SSL with Let's Encrypt

sudo certbot certonly -d your-domain.com
```

## Post-Deployment

### 1. Verify Installation

```javascript
// Check service worker
console.log('Service Worker:', navigator.serviceWorker ? 'Available' : 'Not available');

// Check IndexedDB
console.log('IndexedDB:', 'indexedDB' in window ? 'Available' : 'Not available');

// Check manifest
fetch('/manifest.json').then(r => console.log('Manifest:', r.ok ? 'Found' : 'Not found'));
```

### 2. Test PWA Features

**Desktop**:
- [ ] Install button appears
- [ ] Installs to applications
- [ ] Opens as standalone app
- [ ] Has app icon

**Mobile**:
- [ ] "Add to Home Screen" prompt appears
- [ ] Installs to home screen
- [ ] Opens fullscreen
- [ ] Works offline

### 3. Performance Testing

**Lighthouse**:

```
1. Open app in Chrome
2. Press F12
3. Go to Lighthouse tab
4. Click "Generate report"
5. Check scores are 90+
```

**Speed**:
- First paint: < 500ms
- Load time: < 1s
- Interactive: < 2s

### 4. Security Headers

Add to your server config:

**Nginx**:
```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

**Apache**:
```apache
Header set X-Content-Type-Options "nosniff"
Header set X-Frame-Options "DENY"
Header set X-XSS-Protection "1; mode=block"
```

### 5. SSL Certificate

For HTTPS (required for PWA):

**Let's Encrypt** (free):
```bash
sudo apt-get install certbot
sudo certbot certonly -d your-domain.com
```

**Automatic renewal**:
```bash
sudo certbot renew --dry-run
```

### 6. Set Up Custom Domain

**GitHub Pages**:
1. Create CNAME file
2. Add domain name
3. Update DNS CNAME record

**Netlify**:
1. Go to Domain settings
2. Add custom domain
3. Update DNS records

**Vercel**:
1. Go to project settings
2. Add domain
3. Follow DNS instructions

### 7. Environment Setup

**Production Configuration**:

Edit `scripts/config.js`:

```javascript
const CONFIG = {
    // ... other settings ...
    API_ENDPOINT: 'https://your-production-api-url.com/api',
    VERSION: '1.0.0',
    CACHE_VERSION: 'v1'
};
```

**Development Configuration**:

```javascript
const CONFIG = {
    // ... other settings ...
    API_ENDPOINT: 'http://localhost:3000/api',
    VERSION: '1.0.0-dev',
    CACHE_VERSION: 'v1-dev'
};
```

## Monitoring

### 1. Error Tracking

Add to `scripts/app.js`:

```javascript
// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // Send to error tracking service
    trackError(event.error);
});

// Unhandled promise rejection
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);
    trackError(event.reason);
});

async function trackError(error) {
    // Send to your error tracking service
    // Example: Sentry, LogRocket, etc.
}
```

### 2. Analytics

```javascript
// Track page views
function trackPageView(pageName) {
    // Send to analytics
    console.log(`Page view: ${pageName}`);
}

// Track transactions
function trackTransaction(type, amount) {
    console.log(`Transaction: ${type} - ${amount}`);
}
```

### 3. Performance Monitoring

```javascript
// Measure performance
function measurePerformance() {
    const perf = performance.getEntriesByType('navigation')[0];
    console.log('DNS Lookup:', perf.domainLookupEnd - perf.domainLookupStart);
    console.log('TCP Connection:', perf.connectEnd - perf.connectStart);
    console.log('Load Time:', perf.loadEventEnd - perf.loadEventStart);
}
```

## Maintenance

### Regular Tasks

- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Update dependencies
- [ ] Review analytics
- [ ] Backup Google Sheets data
- [ ] Test offline functionality
- [ ] Test on different devices/browsers

### Backup Strategy

1. **Google Sheets**: Automatic backup (built-in)
2. **Local Export**: User can export CSV/JSON
3. **Version Control**: Use Git for code backup

### Updates

1. Update code locally
2. Test thoroughly
3. Commit to Git
4. Push to GitHub (auto-deploys on GitHub Pages)
5. Monitor for issues
6. Clear browser cache if needed

## Troubleshooting Deployment

### App not loading

```
1. Check file paths are correct
2. Verify index.html is in root
3. Check console for 404 errors
4. Verify CORS is enabled
```

### PWA not installing

```
1. Ensure HTTPS (except localhost)
2. Check manifest.json is valid
3. Check icons exist and are valid
4. Verify Service Worker is registered
5. Check browser requirements
```

### API not working

```
1. Verify API endpoint is correct
2. Check Google Apps Script is deployed
3. Test API directly with curl
4. Check CORS headers
5. Review Google Apps Script logs
```

### Offline not working

```
1. Check Service Worker is active
2. Verify cache exists in DevTools
3. Check browser supports Service Workers
4. Clear cache and retry
5. Check offline files are cached
```

## Deployment Checklist

```
Pre-Deployment:
- [ ] Local testing complete
- [ ] All files ready
- [ ] Google Apps Script deployed
- [ ] Config.js updated
- [ ] Icons created
- [ ] README reviewed

Deployment:
- [ ] Chosen hosting platform
- [ ] Files uploaded/pushed
- [ ] Domain configured
- [ ] SSL certificate installed
- [ ] Deployment successful

Post-Deployment:
- [ ] PWA features working
- [ ] Offline mode tested
- [ ] Mobile installation tested
- [ ] Performance checked
- [ ] Error logging configured
- [ ] Analytics configured
- [ ] Backup strategy tested
```

---

**Your app is live! 🎉**

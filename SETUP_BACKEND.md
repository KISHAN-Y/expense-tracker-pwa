# Google Apps Script Setup - Your Sheet ID: 1AoPoKNdtC0LbkXUb1286gdQSIPzS2AYBi517hg8JR7g

## ✅ Step 1: Prepare Your Google Sheet

Your Sheet is ready to use! 

**Sheet ID**: `1AoPoKNdtC0LbkXUb1286gdQSIPzS2AYBi517hg8JR7g`

### The script will automatically create:
- A sheet named "Transactions"
- Columns: ID, Date, Type, Category, Amount, Description, CreatedAt

---

## ✅ Step 2: Deploy Google Apps Script

### 2.1 Go to Google Apps Script
```
1. Visit: https://script.google.com
2. Click "+ New project"
3. Name it: "Expense Tracker Backend"
```

### 2.2 Copy the Backend Code
```
1. Open: backend/apps-script.js (in your project)
2. Copy ALL the code
3. Go back to Google Apps Script
4. Delete the default `function myFunction()` code
5. Paste the entire backend code
6. Save (Ctrl+S)
```

### 2.3 Deploy as Web App
```
1. Click "Deploy" button (top right)
2. Select "New Deployment" (if first time)
3. Click gear icon → "Web app"
4. Fill in:
   - Execute as: [Your Google Account]
   - Who has access: "Anyone"
5. Click "Deploy"
6. COPY the deployment URL (looks like):
   https://script.google.com/macros/d/AKfycb[...]/userweb
```

### ⚠️ Important Notes:
- The URL must end with `/userweb`
- Save this URL - you'll need it in Step 4
- This URL allows your app to connect to your Google Sheet

---

## ✅ Step 3: Test the Backend (Optional)

In Google Apps Script:
```
1. Click "Executions" tab (left sidebar)
2. Run the `testBackend()` function
3. Check if it creates test data
4. Go to your Google Sheet to verify
```

---

## ✅ Step 4: Configure Your App

### Update scripts/config.js with the Deployment URL

1. Open `scripts/config.js` in your project
2. Find this line:
   ```javascript
   API_ENDPOINT: 'https://script.google.com/macros/d/YOUR_SCRIPT_ID/userweb',
   ```
3. Replace with your actual deployment URL:
   ```javascript
   API_ENDPOINT: 'https://script.google.com/macros/d/AKfycb[YOUR_ID]/userweb',
   ```
4. Save the file
5. Reload the app in browser (http://localhost:8000)

---

## ✅ Step 5: Test the Integration

### Local Testing:
```
1. Open http://localhost:8000
2. Add a transaction:
   - Toggle: Income
   - Amount: 5000
   - Category: Salary
   - Description: Test
   - Click Save

3. Check the console (F12):
   - Should see "Transaction created"
   - No red errors

4. Go to your Google Sheet:
   - Should see the transaction added!
```

### If it Works:
✅ Data shows in Google Sheet
✅ Dashboard updates
✅ You're connected!

### If it Doesn't Work:
❌ Check console for errors
❌ Verify deployment URL is correct
❌ Make sure Google Apps Script is deployed
❌ Check sheet exists

---

## 📋 Complete Flow

```
Your App (http://localhost:8000)
    ↓
Scripts/config.js (stores API URL)
    ↓
Scripts/api.js (sends to Google Apps Script)
    ↓
Google Apps Script Backend
    ↓
Your Google Sheet (1AoPoKNdtC0LbkXUb1286gdQSIPzS2AYBi517hg8JR7g)
```

---

## ✅ Once Connected

### What Works:
✅ Add transactions → saved to Google Sheet
✅ Edit transactions → updated in Google Sheet
✅ Delete transactions → removed from Google Sheet
✅ Offline → queued and synced when online
✅ Mobile → all data syncs across devices

### Your Data Flow:
```
1. Add transaction locally
2. Sent to Google Apps Script
3. Stored in Google Sheet
4. Synced back to app
5. Works offline too!
```

---

## 🔗 Deployment URL Format

When Google deploys, you'll get something like:
```
https://script.google.com/macros/d/AKfycbY-3xE7k[...]/userweb
```

This is your unique backend URL. Save it!

---

## 🆘 Troubleshooting

### "Script not deployed"
- Go to script.google.com
- Make sure you clicked "Deploy"
- Check you selected "Web app" type

### "Cannot write to spreadsheet"
- Check Google Sheet ID is correct
- Make sure you're logged in with right account
- Grant permissions when prompted

### "API returns 403 error"
- Go to Google Apps Script
- Click "Deploy" → "Manage deployments"
- Check "Execute as" is set to your account

### "Can't connect to API"
- Check API_ENDPOINT in config.js is exactly right
- No typos in URL
- Must end with `/userweb`

---

## 📝 Your Configuration

**Sheet ID**: `1AoPoKNdtC0LbkXUb1286gdQSIPzS2AYBi517hg8JR7g`
**Sheet Name**: `Transactions`
**Backend File**: `backend/apps-script.js`
**Config File**: `scripts/config.js` (Line with API_ENDPOINT)

---

## 🎯 Checklist

- [ ] Opened https://script.google.com
- [ ] Created new project
- [ ] Copied backend/apps-script.js
- [ ] Pasted code into Apps Script
- [ ] Clicked Deploy → New Deployment
- [ ] Selected Web app type
- [ ] Clicked Deploy
- [ ] Copied deployment URL
- [ ] Updated scripts/config.js
- [ ] Reloaded app in browser
- [ ] Added test transaction
- [ ] Verified in Google Sheet
- [ ] ✅ Done!

---

## 📞 Need Help?

1. **Setup Issues** → See QUICKSTART.md
2. **Deployment Issues** → See DEPLOYMENT.md
3. **Code Issues** → Check browser console (F12)
4. **Google Sheet Issues** → Check permissions

---

**You're almost there! Deploy the backend and connect! 🚀**

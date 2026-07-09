# 🚀 Deploying Spendlyst PWA to Microsoft Azure

This guide walks you through deploying your Expense Tracker PWA (`Spendlyst`) to Microsoft Azure. Because this app is a client-side progressive web app with a Google Sheets API backend, you have two primary deployment pathways:

---

## 📌 Option A: Azure Static Web Apps (Recommended & 100% Free)

Azure Static Web Apps (SWA) is built specifically for front-end PWAs. It serves files directly from a global CDN, manages SSL certificates automatically, and integrates with GitHub Actions for CI/CD.

### 🌟 Key Benefits:
- **Free Plan:** Free hosting, free SSL certificate, and free custom domain binding.
- **Auto-Deployment:** Changes pushed to GitHub deploy automatically.
- **Global Scale:** Instant page loading globally.

### 📋 Prerequisites:
1. An **Azure Account** (Free trial or Pay-as-you-go).
2. A **GitHub Repository** containing your code.

### 🛠️ Step-by-Step Deployment:
1. **Push your code to GitHub:**
   Ensure your local project directory is initialized as a Git repository and pushed to a remote GitHub repository.
2. **Create the Static Web App Resource:**
   - Sign in to the [Azure Portal](https://portal.azure.com).
   - Search for **Static Web Apps** and click **Create**.
3. **Configure Project Details:**
   - **Subscription / Resource Group:** Select your active subscription and resource group.
   - **Name:** Enter `spendlyst-pwa`.
   - **Hosting Plan:** Select **Free** (recommended for personal budgets/portfolios).
   - **Region:** Choose a region closest to you.
4. **Sign in with GitHub:**
   - Click **Sign in with GitHub** and authorize Azure.
   - Select your **Organization**, **Repository**, and the deploy branch (e.g., `main`).
5. **Configure Build Details:**
   - **Build Presets:** Select **Custom**.
   - **App location:** Enter `/` (this serves the root folder containing `index.html`).
   - **Api location:** Leave blank.
   - **Output location:** Leave blank or enter `/` (since this is a raw HTML/JS app with no build step).
6. **Review and Create:**
   - Click **Review + Create**, then **Create**.
   - Azure will automatically generate a GitHub Action workflow file in your repository under `.github/workflows/` and start building and deploying your app.
7. **Find your URL:**
   - Once deployment completes, navigate to your Static Web App resource in the Azure portal and click the URL shown in the **Overview** pane (e.g., `https://glorious-sea-0abc123.azurestaticapps.net`).

---

## 📌 Option B: Azure App Service (Running server.js)

If you specifically want to run the Node.js static server (`server.js`) as a backend process, you can deploy it to Azure App Service.

### 🛠️ Step-by-Step Deployment:
1. **Create a `package.json` file in your root directory:**
   Azure App Service needs a `package.json` to understand how to build and execute your server. Create a file named `package.json` with the following content:
   ```json
   {
     "name": "expense-tracker-pwa",
     "version": "1.0.0",
     "description": "Spendlyst PWA",
     "main": "server.js",
     "scripts": {
       "start": "node server.js"
     },
     "engines": {
       "node": ">=18.0.0"
     }
   }
   ```
2. **Modify `server.js` to read Azure’s dynamic port:**
   Azure App Service dynamically assigns a port to container apps via the `PORT` environment variable. Modify [server.js](file:///c:/Users/Admin/Desktop/Bot/server.js#L5) to dynamically use this environment variable:
   ```javascript
   const PORT = process.env.PORT || 8000;
   ```
3. **Deploy using Azure CLI or VS Code:**
   - **Using VS Code (Easiest):**
     1. Install the **Azure App Service** extension.
     2. Sign in to your Azure account in VS Code.
     3. Right-click the root project folder and select **Deploy to Web App...**
     4. Select your subscription, name your Web App (e.g. `spendlyst-app`), select the **Node.js 18 LTS** or **Node.js 20 LTS** runtime on Linux, and choose a pricing plan (Free F1 or Basic B1 tier).
     5. Select **Deploy**.
   - **Using GitHub Actions:**
     Set up a continuous deployment workflow in GitHub using Azure App Service deployment credentials.

---

## 🔒 Post-Deployment Checklist:
- **HTTPS Enforcement:** Make sure your App URL uses `https://`—the Service Worker, PWA install features, and Web Push Notifications **will not function** on insecure `http://` pages (except `localhost`).
- **Google Sheets CORS Authorization:**
  If you deployed a custom Apps Script backend, make sure the deployed Azure Web App domain is allowed to communicate with your Google Web App script. (Our Apps Script uses wildcard headers `*` for CORS, so this will work out of the box).

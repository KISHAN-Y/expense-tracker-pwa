// Main Application Logic
const APP = {
    async init() {
        try {
            console.log("Initializing App...");
            
            // 1. Initialize Database & Firebase
            await DB.init();
            console.log("Firebase initialized.");

            // 2. Setup UI listeners
            UI.setupEventListeners();

            // 3. Listen for Auth State Changes
            DB.onAuthStateChanged(async (user) => {
                if (user) {
                    console.log("User logged in:", user.displayName);
                    // Hide login, show app
                    document.getElementById('login-page').classList.remove('active');
                    document.getElementById('app-container').style.display = 'block';
                    
                    // Setup User Info
                    document.getElementById('userNameDisplay').textContent = user.displayName;
                    if (user.photoURL) {
                        document.getElementById('userAvatar').src = user.photoURL;
                    }

                    // Ensure default account exists
                    await DB.ensureDefaultAccount();
                    
                    // Load Data & Render UI
                    await this.loadData();
                } else {
                    console.log("User logged out.");
                    // Show login, hide app
                    document.getElementById('login-page').classList.add('active');
                    document.getElementById('app-container').style.display = 'none';
                }
            });

            // Login Button
            document.getElementById('googleLoginBtn').addEventListener('click', () => {
                DB.signInWithGoogle().catch(e => {
                    console.error("Login failed:", e);
                    UI.showToast("Sign in failed.");
                });
            });

            // Logout Button
            document.getElementById('logoutBtn').addEventListener('click', async () => {
                try {
                    await DB.signOut();
                    UI.showToast("Logged out successfully");
                } catch (e) {
                    UI.showToast("Logout failed");
                }
            });

        } catch (error) {
            console.error("App Initialization Error:", error);
            UI.showToast("Failed to initialize app.");
        }
    },

    async loadData() {
        try {
            // Load transactions and accounts
            const transactions = await DB.getAllTransactions();
            const accounts = await DB.getAllAccounts();
            
            // Update Dashboard
            UI.renderDashboard(transactions, accounts);
            
            // Update Transaction List
            UI.renderTransactionList(transactions);

            // Update Accounts List
            UI.renderAccountsList(accounts);
            
        } catch (error) {
            console.error("Error loading data:", error);
            UI.showToast("Failed to load data");
        }
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => APP.init());
} else {
    APP.init();
}

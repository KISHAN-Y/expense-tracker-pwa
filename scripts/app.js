// Main Application
const APP = {
    editingTransactionId: null,

    targetRoute: 'dashboard',
    idleTimer: null,
    IDLE_TIMEOUT: 5 * 60 * 1000, // 5 minutes in milliseconds

    // Initialize app
    async init() {
        try {
            // Hide bottom nav and FAB immediately on startup to prevent flicker on splash screen
            const bNav = document.getElementById('bottomNav');
            const fRoot = document.getElementById('fabRoot');
            if (bNav) bNav.style.display = 'none';
            if (fRoot) fRoot.style.display = 'none';

            // Save initial hash target before forcing splash
            let initialHash = window.location.hash;
            let targetRoute = initialHash.replace(/^#\/?/, '') || 'dashboard';
            if (targetRoute === 'splash' || targetRoute === 'login') {
                targetRoute = 'dashboard';
            }
            this.targetRoute = targetRoute;

            // Initialize database
            await DB.init();
            console.log('Database initialized');

            // Load theme
            await UI.loadThemePreference();

            // Setup event listeners
            UI.setupEventListeners();

            // Initialize offline status UI
            UI.updateOfflineStatus();

            // Initialize form
            UI.initializeTransactionForm();

            // Check session & load data
            const currentUser = localStorage.getItem('currentUser');
            if (currentUser) {
                // Check onboarding
                const onboardingDone = await DB.getSetting('onboardingComplete');
                if (!onboardingDone) {
                    UI.showOnboarding();
                }

                // Load initial data
                await this.loadData();
            }

            // Start idle timer for auto logout
            this.startIdleTimer();

            // Force splash screen on first load
            window.location.hash = '#/splash';
            
            // Trigger initial routing
            UI.handleRouting();

            // Register service worker & initialize 3-hour notification reminders
            if ('serviceWorker' in navigator) {
                // Auto-refresh page when new Service Worker activates (skipWaiting takes over)
                let refreshing = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (!refreshing) {
                        refreshing = true;
                        window.location.reload();
                    }
                });

                navigator.serviceWorker.register('service-worker.js')
                    .then(reg => {
                        console.log('Service Worker registered');
                        Utils.init3HourReminder();
                    })
                    .catch(err => console.log('Service Worker registration failed:', err));
            } else {
                Utils.init3HourReminder();
            }

            // Setup form submission (legacy form, may not exist)
            const txForm = document.getElementById('transactionForm');
            if (txForm) txForm.addEventListener('submit', (e) => this.handleFormSubmit(e));

            // Setup sync button
            const syncBtn = document.getElementById('syncBtn');
            if (syncBtn) {
                syncBtn.addEventListener('click', () => UI.handleSyncClick());
            }

            // Override category picker clicks to route through handleCategorySelection
            document.getElementById('categoryPickerList')?.addEventListener('click', e => {
                const item = e.target.closest('.category-picker-item');
                if (item) {
                    e.stopPropagation();
                    UI.handleCategorySelection(item.dataset.category);
                }
            }, true);

            // Sync data periodically
            setInterval(() => {
                if (Utils.isOnline()) {
                    this.syncData();
                }
            }, 30000); // Every 30 seconds

            // Update offline status periodically
            setInterval(() => {
                this.updateSyncIndicators();
            }, 5000); // Every 5 seconds

            // Handle online/offline
            window.addEventListener('online', () => this.handleOnline());
            window.addEventListener('offline', () => this.handleOffline());

            // Handle URL parameters (for widgets)
            this.handleUrlParams();

            console.log('App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            Utils.showToast('Failed to initialize app. Please refresh.');
        }
    },

    // Handle URL parameters (from widget shortcuts)
    handleUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const page = params.get('page');
        const type = params.get('type');

        if (page === 'addTransaction') {
            UI.goToPage('addTransaction');
            
            if (type === 'income' || type === 'expense') {
                // Set transaction type
                const buttons = document.querySelectorAll('.toggle-btn');
                buttons.forEach(btn => {
                    if (btn.dataset.type === type) {
                        btn.click();
                    }
                });
            }
        } else if (page === 'history') {
            UI.goToPage('history');
            UI.renderHistoryTransactions();
        }
    },

    // Update sync indicators (offline status and sync queue counter)
    async updateSyncIndicators() {
        try {
            UI.updateOfflineStatus();
            const queue = await DB.getSyncQueue();
            UI.updateSyncStatus(false, queue.length);
        } catch (e) {
            console.error('Error updating sync indicators:', e);
        }
    },

    // Load data with stale-while-revalidate pattern
    async loadData() {
        try {
            // 1. Immediately render the dashboard with local (stale) data for instant loading
            await UI.updateDashboardStats();
            await UI.renderRecentTransactions();
            await this.updateSyncIndicators();

            // 2. Fetch fresh data in the background if online
            if (Utils.isOnline()) {
                // If there is no local data, show skeletons while API is loading to prevent empty state flash
                const localTx = await DB.getTransactionsForUser(DB.getCurrentUserIdSync());
                if (localTx.length === 0) {
                    UI.showSkeletons('recentTransactions', 3);
                    UI.showSkeletons('historyTransactions', 5);
                }

                const serverData = await API.getData();
                if (serverData !== null) {
                    const { transactions, accounts } = serverData;

                    // Clear local DB and sync with server
                    await DB.clearTransactions();
                    await DB.clearAccounts();
                    
                    // Add all accounts from server
                    for (const a of accounts) {
                        await DB.addAccount(a);
                    }

                    // Add all transactions from server
                    for (const t of transactions) {
                        await DB.addTransaction(t);
                    }
                    console.log('Synced transactions and accounts from server');
                    
                    // 3. Re-render UI with the fresh data
                    await UI.updateDashboardStats();
                    await UI.renderRecentTransactions();
                    await this.updateSyncIndicators();
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    },

    // Sync data
    async syncData() {
        try {
            if (Utils.isOnline()) {
                await API.syncQueue();
                await this.loadData();
            }
        } catch (error) {
            console.error('Sync error:', error);
        }
    },

    // Handle form submission from new expense/income pages
    async handleTxFormSubmit(type) {
        const amountId     = type === 'expense' ? 'expenseAmount'      : 'incomeAmount';
        const categoryId   = type === 'expense' ? 'expenseCategory'    : 'incomeCategory';
        const accountIdInput = type === 'expense' ? 'expenseAccount'   : 'incomeAccount';
        const descId       = type === 'expense' ? 'expenseDescription' : 'incomeDescription';
        const dateId       = type === 'expense' ? 'expenseDate'        : 'incomeDate';

        const amount   = parseFloat(document.getElementById(amountId)?.value);
        const category = document.getElementById(categoryId)?.value;
        const accountId = document.getElementById(accountIdInput)?.value || CONFIG.DEFAULT_ACCOUNT_ID;
        const desc     = document.getElementById(descId)?.value || '';
        const date     = document.getElementById(dateId)?.value;

        if (!Utils.validateAmount(amount)) { Utils.showToast('Please enter a valid amount'); return; }
        if (!category)                     { Utils.showToast('Please select a category'); return; }
        if (!date)                         { Utils.showToast('Please select a date'); return; }

        const account = await DB.getAccount(accountId);
        if (account && account.openingBalanceDate) {
            const txDateNorm = DB._toISODate(date);
            const openDateNorm = DB._toISODate(account.openingBalanceDate);
            if (txDateNorm < openDateNorm) {
                const proceed = confirm("This transaction is dated before your account's opening balance date and won't be included in balance totals. Update the opening balance date if this is unexpected.\n\nDo you want to proceed?");
                if (!proceed) return;
            }
        }

        Utils.showLoading(true);
        try {
            const transaction = { type, amount: amount.toString(), category, accountId, description: desc, date };

            if (this.editingTransactionId) {
                // Update existing
                transaction.id = this.editingTransactionId;
                await DB.updateTransaction(transaction);
                
                // Sync with server
                if (Utils.isOnline()) {
                    await API.updateTransaction(transaction);
                } else {
                    await DB.addToSyncQueue('UPDATE', transaction);
                }
                
                Utils.showToast('Transaction updated');
                this.editingTransactionId = null;
            } else {
                // Create new
                transaction.id = Utils.generateId();
                await DB.addTransaction(transaction);

                // Sync with server
                if (Utils.isOnline()) {
                    await API.createTransaction(transaction);
                } else {
                    await DB.addToSyncQueue('CREATE', transaction);
                }
                
                Utils.showToast('Transaction added');
            }

            Utils.showLoading(false);
            
            // Clear inputs
            document.getElementById(amountId).value = '';
            document.getElementById(`${type}AmountDisplay`).textContent = type === 'income' ? '+₹0' : '-₹0';
            document.getElementById(categoryId).value = '';
            document.getElementById(`${type}CategoryText`).textContent = 'Category';
            document.getElementById(`${type}CategoryTrigger`).classList.remove('has-value');
            document.getElementById(descId).value = '';
            document.getElementById(dateId).value = '';
            document.getElementById(`${type}DateText`).textContent = 'Select Date';
            document.getElementById(`${type}DateTrigger`).classList.remove('has-value');

            // Wait a little before changing UI to show the success modal properly
            await Utils.showSuccessModal(1400);
            await this.loadData();
            UI.goToPage('dashboard');
        } catch (err) {
            console.error('Error saving transaction:', err);
            Utils.showToast('Failed to save transaction');
        } finally {
            Utils.showLoading(false);
        }
    },

    // Handle legacy form submission (old transactionForm, kept for compatibility)
    async handleFormSubmit(e) {
        e.preventDefault();
        const typeBtn = document.querySelector('.toggle-btn.active');
        if (!typeBtn) return;
        await this.handleTxFormSubmit(typeBtn.dataset.type);
    },

    // Handle form submission
    async _handleFormSubmitOld(e) {

        const type = document.querySelector('.toggle-btn.active').dataset.type;
        const amount = parseFloat(document.getElementById('amount').value);
        const category = document.getElementById('category').value;
        const description = document.getElementById('description').value;
        const date = document.getElementById('date').value;

        // Validate
        if (!Utils.validateAmount(amount)) {
            Utils.showToast('Please enter a valid amount');
            return;
        }

        if (!category) {
            Utils.showToast('Please select a category');
            return;
        }

        if (!date) {
            Utils.showToast('Please select a date');
            return;
        }

        Utils.showLoading(true);

        try {
            const transaction = {
                type,
                amount: amount.toString(),
                category,
                description,
                date
            };

            if (this.editingTransactionId) {
                // Update existing
                transaction.id = this.editingTransactionId;
                await DB.updateTransaction(transaction);
                
                // Sync with server
                if (Utils.isOnline()) {
                    await API.updateTransaction(transaction);
                } else {
                    await DB.addToSyncQueue('UPDATE', transaction);
                }
                
                Utils.showToast('Transaction updated');
                this.editingTransactionId = null;
            } else {
                // Create new
                transaction.id = Utils.generateId();
                await DB.addTransaction(transaction);

                // Sync with server
                if (Utils.isOnline()) {
                    await API.createTransaction(transaction);
                } else {
                    await DB.addToSyncQueue('CREATE', transaction);
                }

                Utils.showToast('Transaction added');
            }

            // Reset form
            document.getElementById('transactionForm').reset();
            document.getElementById('date').value = Utils.getTodayDate();
            document.querySelectorAll('.toggle-btn')[0].click();

            // Update UI
            await this.loadData();

            // Go back to dashboard
            UI.goToPage('dashboard');
        } catch (error) {
            console.error('Error saving transaction:', error);
            Utils.showToast('Failed to save transaction');
        } finally {
            Utils.showLoading(false);
        }
    },

    // Edit transaction
    async editTransaction(id) {
        try {
            const transactions = await DB.getTransactionsForUser(DB.getCurrentUserIdSync());
            const transaction = transactions.find(t => t.id === id);

            if (!transaction) {
                Utils.showToast('Transaction not found');
                return;
            }

            // Populate form
            this.editingTransactionId = id;
            
            const type = transaction.type; // 'income' or 'expense'
            
            // Set values in the hidden inputs
            document.getElementById(`${type}Amount`).value = transaction.amount;
            document.getElementById(`${type}Category`).value = transaction.category;
            const accountId = transaction.accountId || CONFIG.DEFAULT_ACCOUNT_ID;
            document.getElementById(`${type}Account`).value = accountId;
            document.getElementById(`${type}Description`).value = transaction.description || '';
            document.getElementById(`${type}Date`).value = transaction.date;

            // Ensure inputs are wired up
            UI.setupAmountInputs();

            // Trigger input event to format the display amount
            document.getElementById(`${type}Amount`).dispatchEvent(new Event('input'));
            
            // Update custom triggers UI
            const emoji = UI.getCategoryEmoji(transaction.category, type);
            document.getElementById(`${type}CategoryText`).innerHTML = `<span>${emoji}</span> <span>${transaction.category}</span>`;
            document.getElementById(`${type}CategoryTrigger`).classList.add('has-value');
            
            const account = await DB.getAccount(accountId);
            const accountName = account ? account.name : 'Unknown Account';
            document.getElementById(`${type}AccountText`).innerHTML = `<span>🏦</span> <span>${accountName}</span>`;
            document.getElementById(`${type}AccountTrigger`).classList.add('has-value');
            
            document.getElementById(`${type}DateText`).innerHTML = `<span>${Utils.formatDate(transaction.date)}</span>`;
            document.getElementById(`${type}DateTrigger`).classList.add('has-value');

            // Navigate to the edit screen
            UI.goToPage(type === 'income' ? 'addIncome' : 'addExpense');
            
            // Place cursor in the amount input field
            setTimeout(() => {
                document.getElementById(`${type}Amount`).focus();
            }, 100);

        } catch (error) {
            console.error('Error editing transaction:', error);
            Utils.showToast('Failed to load transaction');
        }
    },
    
    // Delete transaction
    async deleteTransaction(id) {
        Utils.showLoading(true);
        try {
            await DB.deleteTransaction(id);
            
            if (Utils.isOnline()) {
                await API.deleteTransaction(id);
            } else {
                await DB.addToSyncQueue('DELETE', { id });
            }
            
            Utils.showToast('Transaction deleted');
            await this.loadData();
        } catch (error) {
            console.error('Error deleting transaction:', error);
            Utils.showToast('Failed to delete transaction');
        } finally {
            Utils.showLoading(false);
        }
    },

    // Handle online
    async handleOnline() {
        console.log('Device is online');
        await this.updateSyncIndicators();
        Utils.showToast('✓ Online. Syncing data...');
        await this.syncData();
    },

    // Handle offline
    async handleOffline() {
        console.log('Device is offline');
        await this.updateSyncIndicators();
        Utils.showToast('⊘ Offline mode - Changes will sync when online');
    },

    // Idle timer methods
    startIdleTimer() {
        this.resetIdleTimer();
        
        // Listeners for user activity
        const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
        activityEvents.forEach(evt => {
            window.addEventListener(evt, () => this.resetIdleTimer(), { passive: true });
        });
    },

    resetIdleTimer() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        
        const currentUser = localStorage.getItem('currentUser');
        if (!currentUser) return; // Only track idle if logged in
        
        if (this.isProcessing) {
            console.log('[DEBUG] Idle timer bypassed - app is currently processing transactions.');
            return;
        }
        
        this.idleTimer = setTimeout(() => this.handleIdleLogout(), this.IDLE_TIMEOUT);
    },

    handleIdleLogout() {
        const currentUser = localStorage.getItem('currentUser');
        if (!currentUser) return;
        
        console.log('User logged out due to inactivity');
        localStorage.removeItem('currentUser');
        Utils.showToast('Logged out due to inactivity');
        UI.goToPage('login');
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => APP.init());
} else {
    APP.init();
}

// Prevent default drag and drop
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => e.preventDefault());

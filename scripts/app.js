// Main Application
const APP = {
    editingTransactionId: null,

    // Initialize app
    async init() {
        try {
            // Initialize database
            await DB.init();
            console.log('Database initialized');

            // Load theme
            await UI.loadThemePreference();

            // Setup event listeners
            UI.setupEventListeners();

            // Initialize form
            UI.initializeTransactionForm();

            // Load initial data
            await this.loadData();

            // Register service worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('service-worker.js')
                    .then(reg => console.log('Service Worker registered'))
                    .catch(err => console.log('Service Worker registration failed:', err));
            }

            // Setup form submission
            document.getElementById('transactionForm').addEventListener('submit', (e) => this.handleFormSubmit(e));

            // Sync data periodically
            setInterval(() => {
                if (Utils.isOnline()) {
                    this.syncData();
                }
            }, 30000); // Every 30 seconds

            // Handle online/offline
            window.addEventListener('online', () => this.handleOnline());
            window.addEventListener('offline', () => this.handleOffline());

            console.log('App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            Utils.showToast('Failed to initialize app. Please refresh.');
        }
    },

    // Load data
    async loadData() {
        try {
            // Load from server if online
            if (Utils.isOnline()) {
                const transactions = await API.getTransactions();
                if (transactions && transactions.length > 0) {
                    // Clear local DB and sync with server
                    const localTransactions = await DB.getAllTransactions();
                    
                    // Update or add transactions
                    for (const t of transactions) {
                        const exists = localTransactions.find(lt => lt.id === t.id);
                        if (exists) {
                            await DB.updateTransaction(t);
                        } else {
                            await DB.addTransaction(t);
                        }
                    }
                    console.log('Synced transactions from server');
                }
            }

            // Update UI
            await UI.updateDashboardStats();
            await UI.renderRecentTransactions();
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

    // Handle form submission
    async handleFormSubmit(e) {
        e.preventDefault();

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
            const transactions = await DB.getAllTransactions();
            const transaction = transactions.find(t => t.id === id);

            if (!transaction) {
                Utils.showToast('Transaction not found');
                return;
            }

            // Populate form
            this.editingTransactionId = id;
            
            document.querySelectorAll('.toggle-btn').forEach(btn => {
                if (btn.dataset.type === transaction.type) {
                    btn.click();
                }
            });

            document.getElementById('amount').value = transaction.amount;
            document.getElementById('category').value = transaction.category;
            document.getElementById('description').value = transaction.description || '';
            document.getElementById('date').value = transaction.date;

            // Go to form
            UI.goToPage('addTransaction');

            // Scroll to form
            setTimeout(() => {
                document.querySelector('.form-container').scrollTop = 0;
            }, 0);
        } catch (error) {
            console.error('Error editing transaction:', error);
            Utils.showToast('Failed to load transaction');
        }
    },

    // Delete transaction
    async deleteTransaction(id) {
        if (!confirm('Are you sure you want to delete this transaction?')) {
            return;
        }

        try {
            Utils.showLoading(true);

            await DB.deleteTransaction(id);

            // Sync with server
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
        Utils.showToast('Online. Syncing data...');
        await this.syncData();
    },

    // Handle offline
    handleOffline() {
        console.log('Device is offline');
        Utils.showToast('You are offline. Changes will sync when online.');
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

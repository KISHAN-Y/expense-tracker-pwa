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

            // Initialize offline status UI
            UI.updateOfflineStatus();

            // Initialize form
            UI.initializeTransactionForm();

            // Load initial data
            await this.loadData();

            // Register service worker & initialize 3-hour notification reminders
            if ('serviceWorker' in navigator) {
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
            UI.goToPage(type === 'income' ? 'addIncome' : 'addExpense');
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

    // Load data
    async loadData() {
        try {
            // Load from server if online
            if (Utils.isOnline()) {
                const transactions = await API.getTransactions();
                if (transactions !== null) {
                    // Clear local DB and sync with server
                    await DB.clearTransactions();
                    
                    // Add all transactions from server
                    for (const t of transactions) {
                        await DB.addTransaction(t);
                    }
                    console.log('Synced transactions from server');
                }
            }

            // Update UI
            await UI.updateDashboardStats();
            await UI.renderRecentTransactions();
            if (document.querySelector('.page.active')?.id === 'history') {
                await UI.renderHistoryTransactions();
            }
            await this.updateSyncIndicators();
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
        const descId       = type === 'expense' ? 'expenseDescription' : 'incomeDescription';
        const dateId       = type === 'expense' ? 'expenseDate'        : 'incomeDate';

        const amountRaw = UI.sanitizeAmountInput(document.getElementById(amountId)?.value);
        const amount   = parseFloat(amountRaw);
        const category = document.getElementById(categoryId)?.value;
        const desc     = document.getElementById(descId)?.value || '';
        const date     = document.getElementById(dateId)?.value;

        if (!Utils.validateAmount(amount)) { Utils.showToast('Please enter a valid amount'); return; }
        if (!category)                     { Utils.showToast('Please select a category'); return; }
        if (!date)                         { Utils.showToast('Please select a date'); return; }

        Utils.showLoading(true);
        try {
            const isEditing = Boolean(this.editingTransactionId);
            const transaction = {
                id: this.editingTransactionId || Utils.generateId(),
                type,
                amount: amountRaw,
                category,
                description: desc,
                date
            };

            if (isEditing) {
                await DB.updateTransaction(transaction);
                if (Utils.isOnline()) {
                    await API.updateTransaction(transaction);
                } else {
                    await DB.addToSyncQueue('UPDATE', transaction);
                }
                this.editingTransactionId = null;
            } else {
                await DB.addTransaction(transaction);
                if (Utils.isOnline()) {
                    await API.createTransaction(transaction);
                } else {
                    await DB.addToSyncQueue('CREATE', transaction);
                }
            }

            Utils.showLoading(false);
            await Utils.showSuccessModal(1200);
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
            const transactions = await DB.getAllTransactions();
            const transaction = transactions.find(t => t.id === id);

            if (!transaction) {
                Utils.showToast('Transaction not found');
                return;
            }

            const type = transaction.type === 'income' ? 'income' : 'expense';
            const amountInput = document.getElementById(`${type}Amount`);
            const amountDisplay = document.getElementById(`${type}AmountDisplay`);
            const descriptionInput = document.getElementById(`${type}Description`);
            const dateInput = document.getElementById(`${type}Date`);
            const dateTrigger = document.getElementById(`${type}DateTrigger`);
            const dateText = document.getElementById(`${type}DateText`);
            const categoryInput = document.getElementById(`${type}Category`);
            const categoryTrigger = document.getElementById(`${type}CategoryTrigger`);
            const categoryText = document.getElementById(`${type}CategoryText`);

            this.editingTransactionId = id;
            UI.closeFab();
            UI.setupAmountInputs();

            if (amountInput) amountInput.value = transaction.amount;
            if (amountDisplay) {
                amountDisplay.textContent = UI.formatAmountDraft(UI.sanitizeAmountInput(transaction.amount));
                amountDisplay.style.fontSize = String(transaction.amount).length > 8 ? '40px' : String(transaction.amount).length > 6 ? '50px' : '64px';
            }
            if (descriptionInput) descriptionInput.value = transaction.description || '';
            if (dateInput) dateInput.value = transaction.date;
            if (dateTrigger && dateText) {
                dateText.textContent = Utils.formatDate(transaction.date);
                dateTrigger.classList.add('has-value');
            }
            if (categoryInput) categoryInput.value = transaction.category;
            if (categoryTrigger && categoryText) {
                categoryText.innerHTML = `<span>${UI.getCategoryEmoji(transaction.category, type)}</span> <span>${transaction.category}</span>`;
                categoryTrigger.classList.add('has-value');
            }

            UI.goToPage(type === 'income' ? 'addIncome' : 'addExpense');
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
        await this.updateSyncIndicators();
        Utils.showToast('✓ Online. Syncing data...');
        await this.syncData();
    },

    // Handle offline
    async handleOffline() {
        console.log('Device is offline');
        await this.updateSyncIndicators();
        Utils.showToast('⊘ Offline mode - Changes will sync when online');
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

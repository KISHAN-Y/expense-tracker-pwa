// IndexedDB Database Management
const DB = {
    db: null,

    // Initialize database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Transactions store
                if (!db.objectStoreNames.contains(CONFIG.STORES.TRANSACTIONS)) {
                    const transStore = db.createObjectStore(CONFIG.STORES.TRANSACTIONS, { keyPath: 'id' });
                    transStore.createIndex('date', 'date', { unique: false });
                    transStore.createIndex('type', 'type', { unique: false });
                    transStore.createIndex('category', 'category', { unique: false });
                    transStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Settings store
                if (!db.objectStoreNames.contains(CONFIG.STORES.SETTINGS)) {
                    db.createObjectStore(CONFIG.STORES.SETTINGS, { keyPath: 'key' });
                }

                // Sync queue store
                if (!db.objectStoreNames.contains(CONFIG.STORES.SYNC_QUEUE)) {
                    db.createObjectStore(CONFIG.STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    },

    // Add transaction
    async addTransaction(transaction) {
        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readwrite').objectStore(CONFIG.STORES.TRANSACTIONS);
        transaction.id = transaction.id || Utils.generateId();
        transaction.createdAt = new Date().toISOString();
        return new Promise((resolve, reject) => {
            const request = store.add(transaction);
            request.onsuccess = () => resolve(transaction);
            request.onerror = () => reject(request.error);
        });
    },

    // Update transaction
    async updateTransaction(transaction) {
        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readwrite').objectStore(CONFIG.STORES.TRANSACTIONS);
        return new Promise((resolve, reject) => {
            const request = store.put(transaction);
            request.onsuccess = () => resolve(transaction);
            request.onerror = () => reject(request.error);
        });
    },

    // Delete transaction
    async deleteTransaction(id) {
        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readwrite').objectStore(CONFIG.STORES.TRANSACTIONS);
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    // Get all transactions
    async getAllTransactions() {
        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readonly').objectStore(CONFIG.STORES.TRANSACTIONS);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Get transactions by date
    async getTransactionsByDate(date) {
        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readonly').objectStore(CONFIG.STORES.TRANSACTIONS);
        const index = store.index('date');
        return new Promise((resolve, reject) => {
            const request = index.getAll(date);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Get transactions by type
    async getTransactionsByType(type) {
        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readonly').objectStore(CONFIG.STORES.TRANSACTIONS);
        const index = store.index('type');
        return new Promise((resolve, reject) => {
            const request = index.getAll(type);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Get settings
    async getSetting(key) {
        const store = this.db.transaction(CONFIG.STORES.SETTINGS, 'readonly').objectStore(CONFIG.STORES.SETTINGS);
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.value || null);
            request.onerror = () => reject(request.error);
        });
    },

    // Set setting
    async setSetting(key, value) {
        const store = this.db.transaction(CONFIG.STORES.SETTINGS, 'readwrite').objectStore(CONFIG.STORES.SETTINGS);
        return new Promise((resolve, reject) => {
            const request = store.put({ key, value });
            request.onsuccess = () => resolve(value);
            request.onerror = () => reject(request.error);
        });
    },

    // Clear all data
    async clearAll() {
        const transaction = this.db.transaction([CONFIG.STORES.TRANSACTIONS, CONFIG.STORES.SETTINGS], 'readwrite');
        return new Promise((resolve, reject) => {
            transaction.objectStore(CONFIG.STORES.TRANSACTIONS).clear();
            transaction.objectStore(CONFIG.STORES.SETTINGS).clear();
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    },

    // Add to sync queue
    async addToSyncQueue(action, data) {
        const store = this.db.transaction(CONFIG.STORES.SYNC_QUEUE, 'readwrite').objectStore(CONFIG.STORES.SYNC_QUEUE);
        return new Promise((resolve, reject) => {
            const request = store.add({ action, data, timestamp: new Date().toISOString() });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Get sync queue
    async getSyncQueue() {
        const store = this.db.transaction(CONFIG.STORES.SYNC_QUEUE, 'readonly').objectStore(CONFIG.STORES.SYNC_QUEUE);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Clear sync queue
    async clearSyncQueue(id) {
        const store = this.db.transaction(CONFIG.STORES.SYNC_QUEUE, 'readwrite').objectStore(CONFIG.STORES.SYNC_QUEUE);
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
};

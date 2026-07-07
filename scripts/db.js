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

                // Budgets store (new in v2)
                if (!db.objectStoreNames.contains(CONFIG.STORES.BUDGETS)) {
                    const budgetStore = db.createObjectStore(CONFIG.STORES.BUDGETS, { keyPath: 'id' });
                    budgetStore.createIndex('category', 'category', { unique: false });
                    budgetStore.createIndex('monthYear', 'monthYear', { unique: false });
                }

                // Notifications store (new in v2)
                if (!db.objectStoreNames.contains(CONFIG.STORES.NOTIFICATIONS)) {
                    const notifStore = db.createObjectStore(CONFIG.STORES.NOTIFICATIONS, { keyPath: 'id' });
                    notifStore.createIndex('createdAt', 'createdAt', { unique: false });
                    notifStore.createIndex('read', 'read', { unique: false });
                }
            };
        });
    },

    // ─── Date Normalization Helper ──────────────────────────────────────────
    // Ensures every transaction.date written to the DB is strict "YYYY-MM-DD".
    // Prevents the mixed-format bug (M/D/YYYY vs YYYY-MM-DD) from recurring.
    _normalizeDate(dateVal) {
        if (!dateVal) return dateVal;
        const parsed = Utils.parseDate(dateVal);
        // Use LOCAL date parts — never toISOString(), which converts to UTC
        // and silently shifts dates backward for timezones ahead of UTC (like IST).
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    // ─── Transactions ────────────────────────────────────────────────────────

    async addTransaction(transaction) {
        transaction.id = transaction.id || Utils.generateId();
        transaction.createdAt = transaction.createdAt || new Date().toISOString();
        // Normalize date at write time so every new record is consistent
        if (transaction.date) transaction.date = this._normalizeDate(transaction.date);

        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readwrite').objectStore(CONFIG.STORES.TRANSACTIONS);
        return new Promise((resolve, reject) => {
            const request = store.add(transaction);
            request.onsuccess = () => resolve(transaction);
            request.onerror = () => reject(request.error);
        });
    },

    async updateTransaction(transaction) {
        // Normalize date here too, in case an edit form passes a different format
        if (transaction.date) transaction.date = this._normalizeDate(transaction.date);

        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readwrite').objectStore(CONFIG.STORES.TRANSACTIONS);
        return new Promise((resolve, reject) => {
            const request = store.put(transaction);
            request.onsuccess = () => resolve(transaction);
            request.onerror = () => reject(request.error);
        });
    },

    async deleteTransaction(id) {
        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readwrite').objectStore(CONFIG.STORES.TRANSACTIONS);
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    async getAllTransactions() {
        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readonly').objectStore(CONFIG.STORES.TRANSACTIONS);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getTransactionsByDate(date) {
        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readonly').objectStore(CONFIG.STORES.TRANSACTIONS);
        const index = store.index('date');
        return new Promise((resolve, reject) => {
            const request = index.getAll(date);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getTransactionsByType(type) {
        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readonly').objectStore(CONFIG.STORES.TRANSACTIONS);
        const index = store.index('type');
        return new Promise((resolve, reject) => {
            const request = index.getAll(type);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // ─── One-Time Migration: Fix legacy mixed-format dates ──────────────────
    // Run this ONCE (e.g. from DevTools console, or a temporary settings button)
    // to normalize any transactions that were saved before this fix existed.
    async migrateDateFormats() {
        const all = await this.getAllTransactions();
        let fixedCount = 0;

        for (const t of all) {
            if (!t.date) continue;
            const normalized = this._normalizeDate(t.date);
            if (normalized !== t.date) {
                const updated = { ...t, date: normalized };
                await this.updateTransaction(updated);
                fixedCount++;
            }
        }

        console.log(`Date migration complete. ${fixedCount} of ${all.length} transactions updated.`);
        if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast(`Fixed ${fixedCount} transaction date${fixedCount === 1 ? '' : 's'}`);
        }
        return fixedCount;
    },

    // ─── Settings ────────────────────────────────────────────────────────────

    async getSetting(key) {
        const store = this.db.transaction(CONFIG.STORES.SETTINGS, 'readonly').objectStore(CONFIG.STORES.SETTINGS);
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.value || null);
            request.onerror = () => reject(request.error);
        });
    },

    async setSetting(key, value) {
        const store = this.db.transaction(CONFIG.STORES.SETTINGS, 'readwrite').objectStore(CONFIG.STORES.SETTINGS);
        return new Promise((resolve, reject) => {
            const request = store.put({ key, value });
            request.onsuccess = () => resolve(value);
            request.onerror = () => reject(request.error);
        });
    },

    async clearTransactions() {
        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readwrite').objectStore(CONFIG.STORES.TRANSACTIONS);
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    async clearAll() {
        const transaction = this.db.transaction([CONFIG.STORES.TRANSACTIONS, CONFIG.STORES.SETTINGS], 'readwrite');
        return new Promise((resolve, reject) => {
            transaction.objectStore(CONFIG.STORES.TRANSACTIONS).clear();
            transaction.objectStore(CONFIG.STORES.SETTINGS).clear();
            transaction.oncomplete = () => resolve(true);
            transaction.onerror = () => reject(transaction.error);
        });
    },

    // ─── Sync Queue ──────────────────────────────────────────────────────────

    async addToSyncQueue(action, data) {
        const store = this.db.transaction(CONFIG.STORES.SYNC_QUEUE, 'readwrite').objectStore(CONFIG.STORES.SYNC_QUEUE);
        return new Promise((resolve, reject) => {
            const request = store.add({ action, data, timestamp: new Date().toISOString() });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getSyncQueue() {
        const store = this.db.transaction(CONFIG.STORES.SYNC_QUEUE, 'readonly').objectStore(CONFIG.STORES.SYNC_QUEUE);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async clearSyncQueue(id) {
        const store = this.db.transaction(CONFIG.STORES.SYNC_QUEUE, 'readwrite').objectStore(CONFIG.STORES.SYNC_QUEUE);
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    // ─── Budgets ─────────────────────────────────────────────────────────────

    async addBudget(budget) {
        const store = this.db.transaction(CONFIG.STORES.BUDGETS, 'readwrite').objectStore(CONFIG.STORES.BUDGETS);
        budget.id = budget.id || Utils.generateId();
        budget.createdAt = budget.createdAt || new Date().toISOString();
        return new Promise((resolve, reject) => {
            const request = store.add(budget);
            request.onsuccess = () => resolve(budget);
            request.onerror = () => reject(request.error);
        });
    },

    async updateBudget(budget) {
        const store = this.db.transaction(CONFIG.STORES.BUDGETS, 'readwrite').objectStore(CONFIG.STORES.BUDGETS);
        return new Promise((resolve, reject) => {
            const request = store.put(budget);
            request.onsuccess = () => resolve(budget);
            request.onerror = () => reject(request.error);
        });
    },

    async deleteBudget(id) {
        const store = this.db.transaction(CONFIG.STORES.BUDGETS, 'readwrite').objectStore(CONFIG.STORES.BUDGETS);
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    async getAllBudgets() {
        const store = this.db.transaction(CONFIG.STORES.BUDGETS, 'readonly').objectStore(CONFIG.STORES.BUDGETS);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getBudgetsByMonth(monthYear) {
        const store = this.db.transaction(CONFIG.STORES.BUDGETS, 'readonly').objectStore(CONFIG.STORES.BUDGETS);
        const index = store.index('monthYear');
        return new Promise((resolve, reject) => {
            const request = index.getAll(monthYear);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // ─── Notifications ───────────────────────────────────────────────────────

    async addNotification(notification) {
        const store = this.db.transaction(CONFIG.STORES.NOTIFICATIONS, 'readwrite').objectStore(CONFIG.STORES.NOTIFICATIONS);
        notification.id = notification.id || Utils.generateId();
        notification.createdAt = notification.createdAt || new Date().toISOString();
        notification.read = notification.read || false;
        return new Promise((resolve, reject) => {
            const request = store.add(notification);
            request.onsuccess = () => resolve(notification);
            request.onerror = () => reject(request.error);
        });
    },

    async getAllNotifications() {
        const store = this.db.transaction(CONFIG.STORES.NOTIFICATIONS, 'readonly').objectStore(CONFIG.STORES.NOTIFICATIONS);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async markNotificationRead(id) {
        const store = this.db.transaction(CONFIG.STORES.NOTIFICATIONS, 'readwrite').objectStore(CONFIG.STORES.NOTIFICATIONS);
        return new Promise((resolve, reject) => {
            const getReq = store.get(id);
            getReq.onsuccess = () => {
                const notif = getReq.result;
                if (notif) {
                    notif.read = true;
                    const putReq = store.put(notif);
                    putReq.onsuccess = () => resolve(notif);
                    putReq.onerror = () => reject(putReq.error);
                } else {
                    resolve(null);
                }
            };
            getReq.onerror = () => reject(getReq.error);
        });
    },

    async markAllNotificationsRead() {
        const store = this.db.transaction(CONFIG.STORES.NOTIFICATIONS, 'readwrite').objectStore(CONFIG.STORES.NOTIFICATIONS);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const all = request.result;
                let pending = all.length;
                if (pending === 0) return resolve(true);
                all.forEach(n => {
                    n.read = true;
                    const putReq = store.put(n);
                    putReq.onsuccess = () => { if (--pending === 0) resolve(true); };
                    putReq.onerror = () => reject(putReq.error);
                });
            };
            request.onerror = () => reject(request.error);
        });
    },

    async getUnreadNotificationCount() {
        const all = await this.getAllNotifications();
        return all.filter(n => !n.read).length;
    },

    async clearNotifications() {
        const store = this.db.transaction(CONFIG.STORES.NOTIFICATIONS, 'readwrite').objectStore(CONFIG.STORES.NOTIFICATIONS);
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
};
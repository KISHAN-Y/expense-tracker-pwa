// IndexedDB Database Management
const DB = {
    db: null,

    // Initialize database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = async () => {
                this.db = request.result;
                try {
                    await this.migrateLegacyUserIds();
                } catch (e) {
                    console.error('Error running legacy user ID migration:', e);
                }
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const transaction = event.target.transaction;

                // Transactions store
                let transStore;
                if (!db.objectStoreNames.contains(CONFIG.STORES.TRANSACTIONS)) {
                    transStore = db.createObjectStore(CONFIG.STORES.TRANSACTIONS, { keyPath: 'id' });
                    transStore.createIndex('date', 'date', { unique: false });
                    transStore.createIndex('type', 'type', { unique: false });
                    transStore.createIndex('category', 'category', { unique: false });
                    transStore.createIndex('createdAt', 'createdAt', { unique: false });
                } else {
                    transStore = transaction.objectStore(CONFIG.STORES.TRANSACTIONS);
                }

                if (!transStore.indexNames.contains('userId')) {
                    transStore.createIndex('userId', 'userId', { unique: false });
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

    // Get current logged-in user ID synchronously
    getCurrentUserIdSync() {
        try {
            const userJson = localStorage.getItem('currentUser');
            if (userJson) {
                const user = JSON.parse(userJson);
                if (user && user.id) return user.id;
            }
        } catch (e) {
            console.error('Error reading currentUser from localStorage:', e);
        }
        return 'default';
    },

    // ─── Transactions ────────────────────────────────────────────────────────

    async addTransaction(transaction) {
        transaction.id = transaction.id || Utils.generateId();
        transaction.createdAt = transaction.createdAt || new Date().toISOString();
        const currentUserId = this.getCurrentUserIdSync();
        transaction.userId = transaction.userId || currentUserId;
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
        const currentUserId = this.getCurrentUserIdSync();
        transaction.userId = transaction.userId || currentUserId;

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

    async getAllTransactionsUnscoped() {
        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readonly').objectStore(CONFIG.STORES.TRANSACTIONS);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    async getTransactionsForUser(userId) {
        const targetUserId = userId || this.getCurrentUserIdSync();
        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readonly').objectStore(CONFIG.STORES.TRANSACTIONS);
        const index = store.index('userId');
        return new Promise((resolve, reject) => {
            const request = index.getAll(targetUserId);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    async getTransactionsByDate(date) {
        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readonly').objectStore(CONFIG.STORES.TRANSACTIONS);
        const index = store.index('date');
        const currentUserId = this.getCurrentUserIdSync();
        return new Promise((resolve, reject) => {
            const request = index.getAll(date);
            request.onsuccess = () => {
                const list = request.result || [];
                resolve(list.filter(t => t.userId === currentUserId));
            };
            request.onerror = () => reject(request.error);
        });
    },

    async getTransactionsByType(type) {
        const store = this.db.transaction(CONFIG.STORES.TRANSACTIONS, 'readonly').objectStore(CONFIG.STORES.TRANSACTIONS);
        const index = store.index('type');
        const currentUserId = this.getCurrentUserIdSync();
        return new Promise((resolve, reject) => {
            const request = index.getAll(type);
            request.onsuccess = () => {
                const list = request.result || [];
                resolve(list.filter(t => t.userId === currentUserId));
            };
            request.onerror = () => reject(request.error);
        });
    },

    // ─── One-Time Migration: Fix legacy mixed-format dates ──────────────────
    // Run this ONCE (e.g. from DevTools console, or a temporary settings button)
    // to normalize any transactions that were saved before this fix existed.
    async migrateDateFormats() {
        const all = await this.getAllTransactionsUnscoped();
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

    // ─── One-Time Migration: Assign legacy data to active user ────────────────
    async migrateLegacyUserIds() {
        const currentUserId = this.getCurrentUserIdSync();

        // 1. Migrate transactions
        const transStoreName = CONFIG.STORES.TRANSACTIONS;
        if (this.db.objectStoreNames.contains(transStoreName)) {
            const tx = this.db.transaction(transStoreName, 'readwrite');
            const store = tx.objectStore(transStoreName);
            await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => {
                    const list = request.result || [];
                    let count = 0;
                    for (const t of list) {
                        if (t.userId === undefined || t.userId === null) {
                            t.userId = currentUserId;
                            store.put(t);
                            count++;
                        }
                    }
                    tx.oncomplete = () => {
                        if (count > 0) console.log(`Migrated ${count} legacy transactions to user ID: ${currentUserId}`);
                        resolve();
                    };
                    tx.onerror = () => reject(tx.error);
                };
                request.onerror = () => reject(request.error);
            });
        }

        // 2. Migrate budgets
        const budgetStoreName = CONFIG.STORES.BUDGETS;
        if (this.db.objectStoreNames.contains(budgetStoreName)) {
            const tx = this.db.transaction(budgetStoreName, 'readwrite');
            const store = tx.objectStore(budgetStoreName);
            await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => {
                    const list = request.result || [];
                    let count = 0;
                    for (const b of list) {
                        if (b.userId === undefined || b.userId === null) {
                            b.userId = currentUserId;
                            store.put(b);
                            count++;
                        }
                    }
                    tx.oncomplete = () => {
                        if (count > 0) console.log(`Migrated ${count} legacy budgets to user ID: ${currentUserId}`);
                        resolve();
                    };
                    tx.onerror = () => reject(tx.error);
                };
                request.onerror = () => reject(request.error);
            });
        }

        // 3. Migrate notifications
        const notifStoreName = CONFIG.STORES.NOTIFICATIONS;
        if (this.db.objectStoreNames.contains(notifStoreName)) {
            const tx = this.db.transaction(notifStoreName, 'readwrite');
            const store = tx.objectStore(notifStoreName);
            await new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => {
                    const list = request.result || [];
                    let count = 0;
                    for (const n of list) {
                        if (n.userId === undefined || n.userId === null) {
                            n.userId = currentUserId;
                            store.put(n);
                            count++;
                        }
                    }
                    tx.oncomplete = () => {
                        if (count > 0) console.log(`Migrated ${count} legacy notifications to user ID: ${currentUserId}`);
                        resolve();
                    };
                    tx.onerror = () => reject(tx.error);
                };
                request.onerror = () => reject(request.error);
            });
        }
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
        const currentUserId = this.getCurrentUserIdSync();
        if (data) data.userId = data.userId || currentUserId;
        return new Promise((resolve, reject) => {
            const request = store.add({ action, data, userId: currentUserId, timestamp: new Date().toISOString() });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getSyncQueue() {
        const store = this.db.transaction(CONFIG.STORES.SYNC_QUEUE, 'readonly').objectStore(CONFIG.STORES.SYNC_QUEUE);
        const currentUserId = this.getCurrentUserIdSync();
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const list = request.result || [];
                resolve(list.filter(q => q.userId === currentUserId || (!q.userId && currentUserId === 'default')));
            };
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
        const currentUserId = this.getCurrentUserIdSync();
        budget.userId = budget.userId || currentUserId;
        return new Promise((resolve, reject) => {
            const request = store.add(budget);
            request.onsuccess = () => resolve(budget);
            request.onerror = () => reject(request.error);
        });
    },

    async updateBudget(budget) {
        const store = this.db.transaction(CONFIG.STORES.BUDGETS, 'readwrite').objectStore(CONFIG.STORES.BUDGETS);
        const currentUserId = this.getCurrentUserIdSync();
        budget.userId = budget.userId || currentUserId;
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

    async getAllBudgetsUnscoped() {
        const store = this.db.transaction(CONFIG.STORES.BUDGETS, 'readonly').objectStore(CONFIG.STORES.BUDGETS);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    async getBudgetsForUser(userId) {
        const targetUserId = userId || this.getCurrentUserIdSync();
        const store = this.db.transaction(CONFIG.STORES.BUDGETS, 'readonly').objectStore(CONFIG.STORES.BUDGETS);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const list = request.result || [];
                resolve(list.filter(b => b.userId === targetUserId));
            };
            request.onerror = () => reject(request.error);
        });
    },

    async getBudgetsByMonth(monthYear) {
        const store = this.db.transaction(CONFIG.STORES.BUDGETS, 'readonly').objectStore(CONFIG.STORES.BUDGETS);
        const index = store.index('monthYear');
        const currentUserId = this.getCurrentUserIdSync();
        return new Promise((resolve, reject) => {
            const request = index.getAll(monthYear);
            request.onsuccess = () => {
                const list = request.result || [];
                resolve(list.filter(b => b.userId === currentUserId));
            };
            request.onerror = () => reject(request.error);
        });
    },

    // ─── Notifications ───────────────────────────────────────────────────────

    async addNotification(notification) {
        const store = this.db.transaction(CONFIG.STORES.NOTIFICATIONS, 'readwrite').objectStore(CONFIG.STORES.NOTIFICATIONS);
        notification.id = notification.id || Utils.generateId();
        notification.createdAt = notification.createdAt || new Date().toISOString();
        notification.read = notification.read || false;
        const currentUserId = this.getCurrentUserIdSync();
        notification.userId = notification.userId || currentUserId;
        return new Promise((resolve, reject) => {
            const request = store.add(notification);
            request.onsuccess = () => resolve(notification);
            request.onerror = () => reject(request.error);
        });
    },

    async getAllNotificationsUnscoped() {
        const store = this.db.transaction(CONFIG.STORES.NOTIFICATIONS, 'readonly').objectStore(CONFIG.STORES.NOTIFICATIONS);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    async getNotificationsForUser(userId) {
        const targetUserId = userId || this.getCurrentUserIdSync();
        const store = this.db.transaction(CONFIG.STORES.NOTIFICATIONS, 'readonly').objectStore(CONFIG.STORES.NOTIFICATIONS);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const list = request.result || [];
                resolve(list.filter(n => n.userId === targetUserId));
            };
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

    async markAllNotificationsRead(userId) {
        const targetUserId = userId || this.getCurrentUserIdSync();
        const store = this.db.transaction(CONFIG.STORES.NOTIFICATIONS, 'readwrite').objectStore(CONFIG.STORES.NOTIFICATIONS);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const all = request.result || [];
                const userNotifs = all.filter(n => n.userId === targetUserId);
                let pending = userNotifs.length;
                if (pending === 0) return resolve(true);
                userNotifs.forEach(n => {
                    n.read = true;
                    const putReq = store.put(n);
                    putReq.onsuccess = () => { if (--pending === 0) resolve(true); };
                    putReq.onerror = () => reject(putReq.error);
                });
            };
            request.onerror = () => reject(request.error);
        });
    },

    async getUnreadNotificationCount(userId) {
        const targetUserId = userId || this.getCurrentUserIdSync();
        const all = await this.getNotificationsForUser(targetUserId);
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
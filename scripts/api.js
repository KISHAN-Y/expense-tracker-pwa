// API Handler
const API = {
    // Fetch with timeout
    async fetchWithTimeout(url, options = {}, timeout = 30000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    },

    // Get all transactions and accounts from server
    async getData() {
        try {
            const currentUserId = DB.getCurrentUserIdSync();
            const url = `${CONFIG.API_ENDPOINT}?userId=${encodeURIComponent(currentUserId)}`;
            const response = await this.fetchWithTimeout(url, {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return {
                transactions: data.transactions || [],
                accounts: data.accounts || []
            };
        } catch (error) {
            console.error('Error fetching data:', error);
            return null;
        }
    },

    // Create transaction
    async createTransaction(transaction) {
        try {
            const currentUserId = DB.getCurrentUserIdSync();
            const response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'CREATE', data: transaction, userId: currentUserId })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.success ? data.transaction : null;
        } catch (error) {
            console.error('Error creating transaction:', error);
            if (!Utils.isOnline()) {
                await DB.addToSyncQueue('CREATE', transaction);
                return transaction;
            }
            throw error;
        }
    },

    // Batch create transactions
    async createTransactions(transactions) {
        try {
            const currentUserId = DB.getCurrentUserIdSync();
            const response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'BATCH_CREATE', data: transactions, userId: currentUserId })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.success ? data.transactions : null;
        } catch (error) {
            console.error('Error batch creating transactions:', error);
            if (!Utils.isOnline()) {
                for (const tx of transactions) {
                    await DB.addToSyncQueue('CREATE', tx);
                }
                return transactions;
            }
            throw error;
        }
    },

    // Update transaction
    async updateTransaction(transaction) {
        try {
            const currentUserId = DB.getCurrentUserIdSync();
            const response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'UPDATE', data: transaction, userId: currentUserId })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.success ? data.transaction : null;
        } catch (error) {
            console.error('Error updating transaction:', error);
            if (!Utils.isOnline()) {
                await DB.addToSyncQueue('UPDATE', transaction);
                return transaction;
            }
            throw error;
        }
    },

    // Delete transaction
    async deleteTransaction(id) {
        try {
            const currentUserId = DB.getCurrentUserIdSync();
            const response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'DELETE', data: { id }, userId: currentUserId })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error deleting transaction:', error);
            if (!Utils.isOnline()) {
                await DB.addToSyncQueue('DELETE', { id });
                return true;
            }
            throw error;
        }
    },

    // Create account
    async createAccount(account) {
        try {
            const currentUserId = DB.getCurrentUserIdSync();
            const response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'CREATE_ACCOUNT', data: account, userId: currentUserId })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.success ? data.account : null;
        } catch (error) {
            console.error('Error creating account:', error);
            if (!Utils.isOnline()) {
                await DB.addToSyncQueue('CREATE_ACCOUNT', account);
                return account;
            }
            throw error;
        }
    },

    // Update account
    async updateAccount(account) {
        try {
            const currentUserId = DB.getCurrentUserIdSync();
            const response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'UPDATE_ACCOUNT', data: account, userId: currentUserId })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.success ? data.account : null;
        } catch (error) {
            console.error('Error updating account:', error);
            if (!Utils.isOnline()) {
                await DB.addToSyncQueue('UPDATE_ACCOUNT', account);
                return account;
            }
            throw error;
        }
    },

    // Delete account
    async deleteAccount(id) {
        try {
            const currentUserId = DB.getCurrentUserIdSync();
            const response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'DELETE_ACCOUNT', data: { id }, userId: currentUserId })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error deleting account:', error);
            if (!Utils.isOnline()) {
                await DB.addToSyncQueue('DELETE_ACCOUNT', { id });
                return true;
            }
            throw error;
        }
    },

    // Register user
    async register(email, password, displayName) {
        try {
            const response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'REGISTER',
                    data: { email, password, displayName }
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message || error.toString() };
        }
    },

    // Login user
    async login(email, password) {
        try {
            const response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'LOGIN',
                    data: { email, password }
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message || error.toString() };
        }
    },

    // Sync offline queue
    async syncQueue() {
        if (!Utils.isOnline()) return false;
        if (typeof APP !== 'undefined') APP.isProcessing = true;

        try {
            const queue = await DB.getSyncQueue();
            console.log(`[DEBUG] syncQueue: Starting sync queue processing. Size: ${queue.length}`);
            if (queue.length === 0) {
                UI.updateSyncStatus(true, 0);
                if (typeof APP !== 'undefined') APP.isProcessing = false;
                return true;
            }

            UI.updateSyncStatus(false, queue.length);
            Utils.showLoading(true);
            let successCount = 0;

            for (let i = 0; i < queue.length; i++) {
                const item = queue[i];
                try {
                    const { action, data, userId } = item;
                    const targetUserId = userId || DB.getCurrentUserIdSync();
                    let success = false;
                    let response;
                    
                    console.log(`[DEBUG] syncQueue: Processing item ${i + 1}/${queue.length}. Action: ${action}`, data);

                    switch (action) {
                        case 'CREATE':
                            response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                                method: 'POST',
                                headers: { 'Content-Type': 'text/plain' },
                                body: JSON.stringify({ action: 'CREATE', data, userId: targetUserId })
                            });
                            break;
                        case 'UPDATE':
                            response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                                method: 'POST',
                                headers: { 'Content-Type': 'text/plain' },
                                body: JSON.stringify({ action: 'UPDATE', data, userId: targetUserId })
                            });
                            break;
                        case 'DELETE':
                            response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                                method: 'POST',
                                headers: { 'Content-Type': 'text/plain' },
                                body: JSON.stringify({ action: 'DELETE', data, userId: targetUserId })
                            });
                            break;
                        case 'CREATE_ACCOUNT':
                            response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                                method: 'POST',
                                headers: { 'Content-Type': 'text/plain' },
                                body: JSON.stringify({ action: 'CREATE_ACCOUNT', data, userId: targetUserId })
                            });
                            break;
                        case 'UPDATE_ACCOUNT':
                            response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                                method: 'POST',
                                headers: { 'Content-Type': 'text/plain' },
                                body: JSON.stringify({ action: 'UPDATE_ACCOUNT', data, userId: targetUserId })
                            });
                            break;
                        case 'DELETE_ACCOUNT':
                            response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                                method: 'POST',
                                headers: { 'Content-Type': 'text/plain' },
                                body: JSON.stringify({ action: 'DELETE_ACCOUNT', data, userId: targetUserId })
                            });
                            break;
                    }

                    if (response && response.ok) {
                        const resJson = await response.json();
                        if (resJson && resJson.success) {
                            success = true;
                            console.log(`[DEBUG] syncQueue: Item ${i + 1} successfully synced to server.`);
                        } else {
                            console.error('[DEBUG] syncQueue: Server returned success=false:', resJson);
                        }
                    } else {
                        console.error('[DEBUG] syncQueue: HTTP response error:', response ? response.status : 'no response');
                    }

                    if (success) {
                        await DB.clearSyncQueue(item.id);
                        successCount++;
                    }
                } catch (error) {
                    console.error('[DEBUG] Sync error on item:', error);
                }
            }

            Utils.showLoading(false);
            UI.updateSyncStatus(true, 0);

            if (successCount > 0) {
                Utils.showToast(`✓ Synced ${successCount} transaction(s)`);
            }

            console.log(`[DEBUG] syncQueue: Queue processing completed. Synced ${successCount}/${queue.length}`);
            return successCount === queue.length;
        } finally {
            if (typeof APP !== 'undefined') {
                APP.isProcessing = false;
                APP.resetIdleTimer();
            }
        }
    }
};

// Listen for online/offline events
window.addEventListener('online', async () => {
    Utils.showToast('Back online! Syncing changes...');
    await API.syncQueue();
});

window.addEventListener('offline', () => {
    Utils.showToast('You are offline. Changes will sync when online.');
});

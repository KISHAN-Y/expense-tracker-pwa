// API Handler
const API = {
    // Fetch with timeout
    async fetchWithTimeout(url, options = {}, timeout = 10000) {
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

    // Get all transactions from server
    async getTransactions() {
        try {
            const response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.transactions || [];
        } catch (error) {
            console.error('Error fetching transactions:', error);
            return null;
        }
    },

    // Create transaction
    async createTransaction(transaction) {
        try {
            const response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'CREATE', data: transaction })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.success ? data.transaction : null;
        } catch (error) {
            console.error('Error creating transaction:', error);
            // Queue for sync if offline
            if (!Utils.isOnline()) {
                await DB.addToSyncQueue('CREATE', transaction);
                return transaction;
            }
            throw error;
        }
    },

    // Update transaction
    async updateTransaction(transaction) {
        try {
            const response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'UPDATE', data: transaction })
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
            const response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'DELETE', data: { id } })
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

    // Sync offline queue
    async syncQueue() {
        if (!Utils.isOnline()) return false;

        const queue = await DB.getSyncQueue();
        if (queue.length === 0) return true;

        Utils.showLoading(true);
        let successCount = 0;

        for (const item of queue) {
            try {
                const { action, data } = item;
                let success = false;

                switch (action) {
                    case 'CREATE':
                        await this.createTransaction(data);
                        success = true;
                        break;
                    case 'UPDATE':
                        await this.updateTransaction(data);
                        success = true;
                        break;
                    case 'DELETE':
                        await this.deleteTransaction(data.id);
                        success = true;
                        break;
                }

                if (success) {
                    await DB.clearSyncQueue(item.id);
                    successCount++;
                }
            } catch (error) {
                console.error('Sync error:', error);
            }
        }

        Utils.showLoading(false);

        if (successCount > 0) {
            Utils.showToast(`Synced ${successCount} transaction(s)`);
        }

        return successCount === queue.length;
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

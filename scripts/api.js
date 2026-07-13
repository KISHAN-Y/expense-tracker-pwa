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

    // Get all transactions from server
    async getTransactions() {
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
            return data.transactions || [];
        } catch (error) {
            console.error('Error fetching transactions:', error);
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

    // Get dashboard stats
    async getDashboard() {
        try {
            const currentUserId = DB.getCurrentUserIdSync();
            const isGoogleScript = CONFIG.API_ENDPOINT.includes('script.google.com');
            
            let response;
            if (isGoogleScript) {
                response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'GET_DASHBOARD', userId: currentUserId })
                });
            } else {
                const url = `${CONFIG.API_ENDPOINT.replace(/\/$/, '')}/dashboard?userId=${encodeURIComponent(currentUserId)}`;
                response = await this.fetchWithTimeout(url, { method: 'GET' });
            }

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            return { success: false, error: error.message || error.toString() };
        }
    },

    // Get user profile
    async getProfile() {
        try {
            const currentUserId = DB.getCurrentUserIdSync();
            const isGoogleScript = CONFIG.API_ENDPOINT.includes('script.google.com');
            
            let response;
            if (isGoogleScript) {
                response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'GET_PROFILE', userId: currentUserId })
                });
            } else {
                const url = `${CONFIG.API_ENDPOINT.replace(/\/$/, '')}/profile?userId=${encodeURIComponent(currentUserId)}`;
                response = await this.fetchWithTimeout(url, { method: 'GET' });
            }

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching profile:', error);
            return { success: false, error: error.message || error.toString() };
        }
    },

    // Update user profile
    async updateProfile(profileData) {
        try {
            const currentUserId = DB.getCurrentUserIdSync();
            const isGoogleScript = CONFIG.API_ENDPOINT.includes('script.google.com');
            
            let response;
            if (isGoogleScript) {
                response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'UPDATE_PROFILE', data: profileData, userId: currentUserId })
                });
            } else {
                const url = `${CONFIG.API_ENDPOINT.replace(/\/$/, '')}/profile`;
                response = await this.fetchWithTimeout(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ profile: profileData, userId: currentUserId })
                });
            }

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error updating profile:', error);
            return { success: false, error: error.message || error.toString() };
        }
    },

    // Get budgets
    async getBudgets() {
        try {
            const currentUserId = DB.getCurrentUserIdSync();
            const isGoogleScript = CONFIG.API_ENDPOINT.includes('script.google.com');
            
            let response;
            if (isGoogleScript) {
                response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'GET_BUDGETS', userId: currentUserId })
                });
            } else {
                const url = `${CONFIG.API_ENDPOINT.replace(/\/$/, '')}/budgets?userId=${encodeURIComponent(currentUserId)}`;
                response = await this.fetchWithTimeout(url, { method: 'GET' });
            }

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching budgets:', error);
            return { success: false, error: error.message || error.toString() };
        }
    },

    // Create a budget
    async createBudget(budget) {
        try {
            const currentUserId = DB.getCurrentUserIdSync();
            const isGoogleScript = CONFIG.API_ENDPOINT.includes('script.google.com');
            
            let response;
            if (isGoogleScript) {
                response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'CREATE_BUDGET', data: budget, userId: currentUserId })
                });
            } else {
                const url = `${CONFIG.API_ENDPOINT.replace(/\/$/, '')}/budgets`;
                response = await this.fetchWithTimeout(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ budget, userId: currentUserId })
                });
            }

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error creating budget:', error);
            return { success: false, error: error.message || error.toString() };
        }
    },

    // Update a budget
    async updateBudget(budget) {
        try {
            const currentUserId = DB.getCurrentUserIdSync();
            const isGoogleScript = CONFIG.API_ENDPOINT.includes('script.google.com');
            
            let response;
            if (isGoogleScript) {
                response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'UPDATE_BUDGET', data: budget, userId: currentUserId })
                });
            } else {
                const url = `${CONFIG.API_ENDPOINT.replace(/\/$/, '')}/budgets`;
                response = await this.fetchWithTimeout(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ budget, userId: currentUserId })
                });
            }

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error updating budget:', error);
            return { success: false, error: error.message || error.toString() };
        }
    },

    // Delete a budget
    async deleteBudget(id) {
        try {
            const currentUserId = DB.getCurrentUserIdSync();
            const isGoogleScript = CONFIG.API_ENDPOINT.includes('script.google.com');
            
            let response;
            if (isGoogleScript) {
                response = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'DELETE_BUDGET', data: { id }, userId: currentUserId })
                });
            } else {
                const url = `${CONFIG.API_ENDPOINT.replace(/\/$/, '')}/budgets`;
                response = await this.fetchWithTimeout(url, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, userId: currentUserId })
                });
            }

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error deleting budget:', error);
            return { success: false, error: error.message || error.toString() };
        }
    },

    // Sync offline queue
    async syncQueue() {
        if (!Utils.isOnline()) return false;

        const queue = await DB.getSyncQueue();
        if (queue.length === 0) {
            UI.updateSyncStatus(true, 0);
            return true;
        }

        UI.updateSyncStatus(false, queue.length);
        Utils.showLoading(true);
        let successCount = 0;

        for (const item of queue) {
            try {
                const { action, data, userId } = item;
                const targetUserId = userId || DB.getCurrentUserIdSync();
                let success = false;

                switch (action) {
                    case 'CREATE':
                        const createResp = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'CREATE', data, userId: targetUserId })
                        });
                        if (createResp.ok) {
                            success = true;
                        }
                        break;
                    case 'UPDATE':
                        const updateResp = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'UPDATE', data, userId: targetUserId })
                        });
                        if (updateResp.ok) {
                            success = true;
                        }
                        break;
                    case 'DELETE':
                        const deleteResp = await this.fetchWithTimeout(CONFIG.API_ENDPOINT, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'DELETE', data, userId: targetUserId })
                        });
                        if (deleteResp.ok) {
                            success = true;
                        }
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
        UI.updateSyncStatus(true, 0);

        if (successCount > 0) {
            Utils.showToast(`✓ Synced ${successCount} transaction(s)`);
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

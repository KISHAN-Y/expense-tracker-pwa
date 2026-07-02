const UI = {
    chartInstance: null,

    // Page navigation
    goToPage(pageName) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageName).classList.add('active');

        // Update nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageName}"]`)?.classList.add('active');

        // Scroll to top
        setTimeout(() => {
            document.querySelector('.page.active').scrollTop = 0;
        }, 0);
    },

    // Render recent transactions on dashboard
    async renderRecentTransactions() {
        const container = document.getElementById('recentTransactions');
        const transactions = await DB.getAllTransactions();
        
        // Sort by date and get last 5
        const recent = transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        if (recent.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No transactions yet. Start tracking!</p></div>';
            return;
        }

        container.innerHTML = recent.map(t => `
            <div class="transaction-item" onclick="APP.editTransaction('${t.id}')">
                <div class="transaction-info">
                    <div class="transaction-icon ${t.type}">
                        ${Utils.getCategoryIcon(t.category, t.type)}
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-category">${t.category}</div>
                        <div class="transaction-date">${Utils.formatDate(t.date)}</div>
                    </div>
                </div>
                <div class="transaction-amount ${t.type}">
                    ${t.type === 'income' ? '+' : '-'}${Utils.formatCurrency(t.amount)}
                </div>
            </div>
        `).join('');
    },

    // Render all transactions in history
    async renderHistoryTransactions(filter = {}) {
        const container = document.getElementById('historyTransactions');
        let transactions = await DB.getAllTransactions();

        // Apply filters
        if (filter.search) {
            const search = filter.search.toLowerCase();
            transactions = transactions.filter(t => 
                t.category.toLowerCase().includes(search) || 
                t.description.toLowerCase().includes(search)
            );
        }

        if (filter.dateFilter) {
            const today = new Date();
            transactions = transactions.filter(t => {
                const tDate = new Date(t.date);
                switch (filter.dateFilter) {
                    case 'today':
                        return tDate.toDateString() === today.toDateString();
                    case 'week':
                        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                        return tDate >= weekAgo;
                    case 'month':
                        return tDate.getMonth() === today.getMonth() && 
                               tDate.getFullYear() === today.getFullYear();
                    default:
                        return true;
                }
            });
        }

        if (filter.categoryFilter) {
            transactions = transactions.filter(t => t.category === filter.categoryFilter);
        }

        // Sort by date
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (transactions.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No transactions found</p></div>';
            return;
        }

        container.innerHTML = transactions.map(t => `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-icon ${t.type}">
                        ${Utils.getCategoryIcon(t.category, t.type)}
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-category">${t.category}</div>
                        <div class="transaction-date">${Utils.formatDate(t.date)} • ${t.description || 'No description'}</div>
                    </div>
                </div>
                <div class="transaction-amount ${t.type}">
                    ${t.type === 'income' ? '+' : '-'}${Utils.formatCurrency(t.amount)}
                </div>
                <div style="display: flex; gap: 8px; margin-left: 12px;">
                    <button onclick="APP.editTransaction('${t.id}')" class="icon-btn" title="Edit">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button onclick="APP.deleteTransaction('${t.id}')" class="icon-btn" title="Delete">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    },

    // Update dashboard stats
    async updateDashboardStats() {
        const transactions = await DB.getAllTransactions();
        const today = Utils.getTodayDate();

        // Today's income
        const todayIncome = transactions
            .filter(t => t.date === today && t.type === 'income')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        // Today's expense
        const todayExpense = transactions
            .filter(t => t.date === today && t.type === 'expense')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        // Total balance
        const totalIncome = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const totalExpense = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        const balance = totalIncome - totalExpense;

        document.getElementById('todayIncome').textContent = Utils.formatCurrency(todayIncome);
        document.getElementById('todayExpense').textContent = Utils.formatCurrency(todayExpense);
        document.getElementById('currentBalance').textContent = Utils.formatCurrency(balance);
        
        await this.renderChart();
    },

    // Render/update monthly chart using Chart.js
    async renderChart() {
        const ctx = document.getElementById('monthlyChart');
        if (!ctx) return;

        const transactions = await DB.getAllTransactions();
        
        // Group by month
        const monthlyData = {};
        transactions.forEach(t => {
            try {
                const dateObj = new Date(t.date);
                if (isNaN(dateObj)) return;
                const monthName = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                if (!monthlyData[monthName]) {
                    monthlyData[monthName] = { income: 0, expense: 0 };
                }
                const amt = parseFloat(t.amount) || 0;
                if (t.type === 'income') {
                    monthlyData[monthName].income += amt;
                } else {
                    monthlyData[monthName].expense += amt;
                }
            } catch (e) {
                console.error('Error parsing transaction date for chart:', e);
            }
        });

        // Sort months chronologically
        const sortedMonths = Object.keys(monthlyData).sort((a, b) => new Date(a) - new Date(b));
        const incomes = sortedMonths.map(m => monthlyData[m].income);
        const expenses = sortedMonths.map(m => monthlyData[m].expense);

        // Clear existing chart instance to prevent canvas rendering conflicts
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)';

        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedMonths,
                datasets: [
                    {
                        label: 'Income',
                        data: incomes,
                        backgroundColor: '#10b981',
                        borderRadius: 6,
                        borderSkipped: false
                    },
                    {
                        label: 'Expense',
                        data: expenses,
                        backgroundColor: '#f43f5e',
                        borderRadius: 6,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor,
                            font: {
                                family: 'Plus Jakarta Sans',
                                weight: '600',
                                size: 11
                            },
                            boxWidth: 10,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: isDark ? '#0f172a' : '#ffffff',
                        titleColor: isDark ? '#f8fafc' : '#0f172a',
                        bodyColor: isDark ? '#94a3b8' : '#64748b',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        borderWidth: 1,
                        padding: 10,
                        cornerRadius: 8,
                        titleFont: {
                            family: 'Plus Jakarta Sans',
                            weight: '700',
                            size: 12
                        },
                        bodyFont: {
                            family: 'Plus Jakarta Sans',
                            weight: '500',
                            size: 11
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: textColor,
                            font: {
                                family: 'Plus Jakarta Sans',
                                weight: '600',
                                size: 10
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: gridColor
                        },
                        ticks: {
                            color: textColor,
                            font: {
                                family: 'Plus Jakarta Sans',
                                weight: '600',
                                size: 10
                            },
                            callback: function(value) {
                                return '₹' + value.toLocaleString('en-IN');
                            }
                        }
                    }
                }
            }
        });
    },

    // Initialize form
    initializeTransactionForm() {
        const form = document.getElementById('transactionForm');
        const amountInput = document.getElementById('amount');
        const dateInput = document.getElementById('date');
        const categorySelect = document.getElementById('category');

        // Set today's date
        dateInput.value = Utils.getTodayDate();

        // Update categories based on type
        const updateCategories = (type) => {
            const categories = type === 'income' ? CONFIG.INCOME_CATEGORIES : CONFIG.EXPENSE_CATEGORIES;
            categorySelect.innerHTML = '<option value="">Select category</option>' + 
                categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        };

        // Type toggle
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                updateCategories(btn.dataset.type);
            });
        });

        // Set default to income
        updateCategories('income');
    },

    // Setup event listeners
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const pageName = item.dataset.page;
                this.goToPage(pageName);
                if (pageName === 'history') {
                    UI.renderHistoryTransactions();
                }
            });
        });

        // Back buttons
        document.getElementById('backFromAddBtn')?.addEventListener('click', () => this.goToPage('dashboard'));
        document.getElementById('backFromHistoryBtn')?.addEventListener('click', () => this.goToPage('dashboard'));
        document.getElementById('backFromSettingsBtn')?.addEventListener('click', () => this.goToPage('dashboard'));

        // Add button
        document.getElementById('addBtn').addEventListener('click', () => this.goToPage('addTransaction'));

        // Settings button
        document.getElementById('settingsBtn').addEventListener('click', () => this.goToPage('settings'));

        // Cancel button
        document.getElementById('cancelBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.goToPage('dashboard');
        });

        // Dark mode toggle
        const darkModeToggle = document.getElementById('darkModeToggle');
        darkModeToggle.addEventListener('change', async () => {
            const isDark = darkModeToggle.checked;
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
            await DB.setSetting('darkMode', isDark);
            await this.renderChart();
        });

        // Export button
        document.getElementById('exportBtn').addEventListener('click', async () => {
            const transactions = await DB.getAllTransactions();
            Utils.exportToCSV(transactions, `expense-tracker-${new Date().toISOString().split('T')[0]}.csv`);
            Utils.showToast('Exported successfully!');
        });

        // Backup button
        document.getElementById('backupBtn').addEventListener('click', async () => {
            Utils.showToast('Backup feature coming soon!');
        });

        // Install button
        const installBtn = document.getElementById('installBtn');
        if (installBtn && 'onbeforeinstallprompt' in window) {
            let deferredPrompt;
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                installBtn.style.display = 'block';
            });

            installBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log(`User response: ${outcome}`);
                    deferredPrompt = null;
                    installBtn.style.display = 'none';
                }
            });
        }

        // Search and filter in history
        const searchInput = document.getElementById('searchInput');
        const dateFilter = document.getElementById('dateFilter');
        const categoryFilter = document.getElementById('categoryFilter');

        const applyFilters = Utils.debounce(() => {
            UI.renderHistoryTransactions({
                search: searchInput.value,
                dateFilter: dateFilter.value,
                categoryFilter: categoryFilter.value
            });
        }, 300);

        searchInput?.addEventListener('input', applyFilters);
        dateFilter?.addEventListener('change', applyFilters);
        categoryFilter?.addEventListener('change', applyFilters);

        // Sync button click
        document.getElementById('syncBtn')?.addEventListener('click', async () => {
            await this.handleSyncClick();
        });
    },

    // Load theme preference
    async loadThemePreference() {
        const isDark = await DB.getSetting('darkMode');
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('darkModeToggle').checked = true;
        }
    },

    // Update offline status indicator
    updateOfflineStatus() {
        const isOnline = Utils.isOnline();
        const statusIndicator = document.getElementById('offlineStatus');
        const syncBtn = document.getElementById('syncBtn');
        
        if (!statusIndicator) return;

        if (isOnline) {
            statusIndicator.classList.remove('offline');
            statusIndicator.innerHTML = '● Online';
            if (syncBtn) syncBtn.style.display = 'none';
        } else {
            statusIndicator.classList.add('offline');
            statusIndicator.innerHTML = '● Offline';
            if (syncBtn) syncBtn.style.display = 'flex';
        }
    },

    // Update sync button status
    updateSyncStatus(synced, pendingCount) {
        const syncBtn = document.getElementById('syncBtn');
        if (!syncBtn) return;

        if (!Utils.isOnline()) {
            syncBtn.style.display = 'flex';
            syncBtn.innerHTML = `<span class="sync-pending">${pendingCount} pending</span>`;
            syncBtn.disabled = true;
        } else if (pendingCount > 0) {
            syncBtn.style.display = 'flex';
            syncBtn.innerHTML = `Sync (${pendingCount})`;
            syncBtn.disabled = false;
        } else {
            syncBtn.style.display = 'none';
        }
    },

    // Handle sync button click
    async handleSyncClick() {
        const syncBtn = document.getElementById('syncBtn');
        if (syncBtn) {
            syncBtn.disabled = true;
            syncBtn.innerHTML = '<span class="spinner"></span> Syncing...';
        }

        try {
            const success = await API.syncQueue();
            if (success) {
                Utils.showToast('✓ All changes synced!');
                await APP.loadData();
            } else {
                Utils.showToast('Some items failed to sync. Retry later.');
            }
        } catch (error) {
            console.error('Sync error:', error);
            Utils.showToast('Sync failed. Check your connection.');
        } finally {
            if (syncBtn) {
                syncBtn.disabled = false;
                syncBtn.innerHTML = 'Sync';
            }
            this.updateSyncStatus(true, 0);
        }
    }
};


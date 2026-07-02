// User Interface Management
const UI = {
    toastTimeout: null,
    reportChartInstance: null,
    dashboardChartInstance: null,

    // Set up all event listeners for navigation, forms, and buttons
    setupEventListeners() {
        // Bottom Navigation
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pageId = e.currentTarget.dataset.page;
                if (pageId) this.goToPage(pageId);
            });
        });

        // FAB Menu Toggle
        const fabContainer = document.querySelector('.fab-container');
        document.getElementById('mainFab').addEventListener('click', () => {
            fabContainer.classList.toggle('expanded');
        });

        // Close FAB when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.fab-container') && fabContainer.classList.contains('expanded')) {
                fabContainer.classList.remove('expanded');
            }
        });

        // FAB Actions (Open Add Transaction)
        document.getElementById('fabExpense').addEventListener('click', () => this.openAddTransaction('expense'));
        document.getElementById('fabIncome').addEventListener('click', () => this.openAddTransaction('income'));
        document.getElementById('fabTransfer').addEventListener('click', () => this.openAddTransaction('transfer'));

        // Fullscreen Back Buttons
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeFullscreenPages();
            });
        });

        // Open specific pages
        document.getElementById('goToAccountsBtn')?.addEventListener('click', () => this.openFullscreenPage('accounts-page'));
        document.getElementById('addAccountBtn')?.addEventListener('click', () => this.openFullscreenPage('add-account-page'));
        document.getElementById('openReportBtn')?.addEventListener('click', () => {
            this.openFullscreenPage('financial-report-page');
            this.renderFinancialReportChart('line', 'expense'); // Default view
        });

        // Account Form Submit
        document.getElementById('addAccountForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('newAccountName').value;
            const type = document.getElementById('newAccountType').value;
            const balance = parseFloat(document.getElementById('newAccountBalance').value) || 0;
            
            try {
                await DB.addAccount({ name, type, balance });
                this.showToast("Account added successfully");
                this.closeFullscreenPages();
                APP.loadData();
            } catch (error) {
                this.showToast("Failed to add account");
            }
        });

        // Report Chart Toggles
        document.getElementById('toggleLineChart')?.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-toggle').forEach(el => el.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const type = document.querySelector('.type-btn.active').dataset.type;
            this.renderFinancialReportChart('line', type);
        });

        document.getElementById('togglePieChart')?.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-toggle').forEach(el => el.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const type = document.querySelector('.type-btn.active').dataset.type;
            this.renderFinancialReportChart('pie', type);
        });

        // Report Expense/Income Toggle
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.type-btn').forEach(el => el.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                const type = e.currentTarget.dataset.type;
                const chartType = document.querySelector('.chart-toggle.active').id === 'toggleLineChart' ? 'line' : 'pie';
                this.renderFinancialReportChart(chartType, type);
            });
        });

        // Add Transaction Form
        document.getElementById('transFormStandard')?.addEventListener('submit', (e) => this.handleAddTransactionSubmit(e));
        document.getElementById('transFormTransfer')?.addEventListener('submit', (e) => this.handleTransferSubmit(e));
    },

    // Main Navigation
    goToPage(pageId) {
        document.querySelectorAll('.page.main-view').forEach(page => page.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        
        document.getElementById(pageId)?.classList.add('active');
        document.querySelector(`.nav-item[data-page="${pageId}"]`)?.classList.add('active');
    },

    // Modals/Fullscreen Pages
    openFullscreenPage(pageId) {
        document.getElementById(pageId)?.classList.add('active');
    },

    closeFullscreenPages() {
        document.querySelectorAll('.fullscreen-page').forEach(page => page.classList.remove('active'));
    },

    // Open Add Transaction based on type
    openAddTransaction(type) {
        const page = document.getElementById('add-transaction-page');
        const title = document.getElementById('addTransTitle');
        const standardForm = document.getElementById('transFormStandard');
        const transferForm = document.getElementById('transFormTransfer');

        // Reset classes
        page.classList.remove('bg-red', 'bg-green', 'bg-blue');

        if (type === 'expense') {
            title.textContent = 'Expense';
            page.classList.add('bg-red');
            standardForm.classList.remove('hidden');
            transferForm.classList.add('hidden');
        } else if (type === 'income') {
            title.textContent = 'Income';
            page.classList.add('bg-green');
            standardForm.classList.remove('hidden');
            transferForm.classList.add('hidden');
        } else if (type === 'transfer') {
            title.textContent = 'Transfer';
            page.classList.add('bg-blue');
            standardForm.classList.add('hidden');
            transferForm.classList.remove('hidden');
        }

        // Pre-fill categories (dummy for now)
        const catSelect = document.getElementById('transCategory');
        catSelect.innerHTML = '<option value="" disabled selected>Category</option>';
        const cats = type === 'expense' ? CONFIG.EXPENSE_CATEGORIES : CONFIG.INCOME_CATEGORIES;
        cats.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            catSelect.appendChild(opt);
        });

        this.openFullscreenPage('add-transaction-page');
        document.querySelector('.fab-container').classList.remove('expanded');
    },

    async handleAddTransactionSubmit(e) {
        e.preventDefault();
        const type = document.getElementById('addTransTitle').textContent.toLowerCase();
        const amount = parseFloat(document.getElementById('transAmount').value);
        const category = document.getElementById('transCategory').value;
        const description = document.getElementById('transDescription').value;
        const account = document.getElementById('transAccount').value; // Ignoring for now

        if (!amount || !category) {
            this.showToast("Please fill all required fields");
            return;
        }

        try {
            await DB.addTransaction({
                type,
                amount,
                category,
                description,
                date: new Date().toISOString()
            });
            this.showToast("Transaction saved");
            this.closeFullscreenPages();
            document.getElementById('transFormStandard').reset();
            document.getElementById('transAmount').value = '';
            APP.loadData();
        } catch (err) {
            this.showToast("Error saving transaction");
        }
    },

    handleTransferSubmit(e) {
        e.preventDefault();
        this.showToast("Transfer functionality coming soon");
    },

    // Rendering functions
    renderDashboard(transactions, accounts) {
        // Calculate totals
        let totalIncome = 0;
        let totalExpense = 0;
        
        transactions.forEach(t => {
            if (t.type === 'income') totalIncome += t.amount;
            if (t.type === 'expense') totalExpense += t.amount;
        });

        const balance = totalIncome - totalExpense; // Simple logic

        document.getElementById('totalBalanceDisplay').textContent = Utils.formatCurrency(balance);
        document.getElementById('totalIncomeDisplay').textContent = Utils.formatCurrency(totalIncome);
        document.getElementById('totalExpenseDisplay').textContent = Utils.formatCurrency(totalExpense);

        // Render Recent Transactions (max 5)
        const recentList = document.getElementById('recentTransactionsList');
        recentList.innerHTML = '';
        
        transactions.slice(0, 5).forEach(t => {
            const el = document.createElement('div');
            el.className = 'transaction-item';
            
            const isExpense = t.type === 'expense';
            const amountClass = isExpense ? 'text-red' : 'text-green';
            const prefix = isExpense ? '-' : '+';
            
            el.innerHTML = `
                <div class="txn-icon bg-${isExpense ? 'red' : 'green'}-light">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--${isExpense ? 'danger' : 'success'})" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div class="txn-details">
                    <span class="txn-category">${t.category}</span>
                    <span class="txn-desc">${t.description || t.date.split('T')[0]}</span>
                </div>
                <div class="txn-amount ${amountClass}">
                    ${prefix}${Utils.formatCurrency(t.amount)}
                </div>
            `;
            recentList.appendChild(el);
        });

        // Initialize empty dashboard chart
        const ctx = document.getElementById('dashboardChart');
        if (ctx) {
            if (this.dashboardChartInstance) this.dashboardChartInstance.destroy();
            this.dashboardChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Spend',
                        data: [12, 19, 3, 5, 2, 3, 10], // Dummy data
                        borderColor: '#7F3DFF',
                        tension: 0.4
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    },

    renderTransactionList(transactions) {
        const fullList = document.getElementById('fullTransactionsList');
        if (!fullList) return;
        fullList.innerHTML = '';

        // Just rendering a flat list for simplicity right now
        transactions.forEach(t => {
            const el = document.createElement('div');
            el.className = 'transaction-item';
            
            const isExpense = t.type === 'expense';
            const amountClass = isExpense ? 'text-red' : 'text-green';
            const prefix = isExpense ? '-' : '+';
            
            el.innerHTML = `
                <div class="txn-icon bg-${isExpense ? 'red' : 'green'}-light">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--${isExpense ? 'danger' : 'success'})" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <div class="txn-details">
                    <span class="txn-category">${t.category}</span>
                    <span class="txn-desc">${t.description || t.date.split('T')[0]}</span>
                </div>
                <div class="txn-amount ${amountClass}">
                    ${prefix}${Utils.formatCurrency(t.amount)}
                </div>
            `;
            fullList.appendChild(el);
        });
    },

    renderAccountsList(accounts) {
        const container = document.getElementById('accountsListContainer');
        if (!container) return;
        container.innerHTML = '';
        
        let total = 0;
        
        accounts.forEach(acc => {
            total += acc.balance;
            const el = document.createElement('div');
            el.className = 'account-card';
            el.innerHTML = `
                <div class="acc-icon bg-purple-light"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg></div>
                <span class="acc-name">${acc.name}</span>
                <span class="acc-balance">${Utils.formatCurrency(acc.balance)}</span>
            `;
            container.appendChild(el);
            
            // Populate account dropdowns
            const transAcc = document.getElementById('transAccount');
            if (transAcc) {
                const opt = document.createElement('option');
                opt.value = acc.id;
                opt.textContent = acc.name;
                transAcc.appendChild(opt);
            }
        });

        document.getElementById('accountsTotalBalance').textContent = Utils.formatCurrency(total);
    },

    renderFinancialReportChart(chartType, dataType) {
        const ctx = document.getElementById('reportChartCanvas');
        if (!ctx) return;
        
        if (this.reportChartInstance) {
            this.reportChartInstance.destroy();
        }

        // We would normally filter transactions by dataType (expense/income) here and group by category or date.
        // For demonstration, we use dummy data that looks like the screenshots.
        
        const isExpense = dataType === 'expense';
        const color = isExpense ? '#FD3C4A' : '#00A86B';
        document.getElementById('reportTotalDisplay').textContent = isExpense ? '₹332' : '₹6,000';

        if (chartType === 'line') {
            this.reportChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['1', '5', '10', '15', '20', '25', '30'],
                    datasets: [{
                        label: dataType,
                        data: isExpense ? [120, 190, 80, 250, 100, 332, 200] : [1000, 2000, 1500, 4000, 3000, 6000, 5000],
                        borderColor: color,
                        tension: 0.4,
                        fill: false
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        } else {
            this.reportChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: isExpense ? ['Shopping', 'Subscription', 'Food'] : ['Salary', 'Passive Income'],
                    datasets: [{
                        data: isExpense ? [120, 80, 132] : [4000, 2000],
                        backgroundColor: [color, '#FCCC6F', '#7F3DFF']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, cutout: '75%' }
            });
        }
    },

    // Toast notifications
    showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }
        
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = UI;
}

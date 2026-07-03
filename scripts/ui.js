const UI = {
    chartInstance: null,
    currentPeriod: 'today',
    fabOpen: false,
    activeCategoryType: 'expense',
    selectedMonthIndex: new Date().getMonth(),
    selectedYear: new Date().getFullYear(),

    // Calendar Picker State
    calState: {
        year: 2026,
        month: 6, // July (0-indexed)
        activeTarget: 'expense'
    },

    // Filter state for Transaction page
    filter: {
        type: 'all',
        sort: 'newest',
        categories: [],
        search: ''
    },

    // ─── Page Navigation ─────────────────────────────────────────────────────
    goToPage(pageName) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(pageName);
        if (target) target.classList.add('active');

        // Sync bottom nav active state
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        const navBtn = document.querySelector(`.nav-item[data-page="${pageName}"]`);
        if (navBtn) navBtn.classList.add('active');

        // Hide bottom nav + FAB on full-screen tx pages, show on all others
        const fullScreenPages = ['addIncome', 'addExpense'];
        const isFullScreen = fullScreenPages.includes(pageName);
        const bottomNav = document.querySelector('.bottom-nav');
        const fabRoot   = document.getElementById('fabRoot');
        const fabBd     = document.getElementById('fabBackdrop');

        if (bottomNav) bottomNav.style.display = isFullScreen ? 'none' : '';
        if (fabRoot)   fabRoot.style.display   = isFullScreen ? 'none' : '';
        if (isFullScreen && fabBd) fabBd.classList.remove('visible');

        // Close all custom sheets & FAB
        this.closeFab();
        this.closeFilterSheet();
        this.closeCustomSheets();

        // Scroll to top of new page
        setTimeout(() => {
            const activePage = document.querySelector('.page.active');
            if (!activePage) return;
            const scrollable = activePage.querySelector(
                '.home-screen, .txn-main, .page-main, .form-container, .tx-bottom-sheet'
            );
            if (scrollable) scrollable.scrollTop = 0;
        }, 0);
    },

    // ─── FAB Open / Close ────────────────────────────────────────────────────
    openFab() {
        this.fabOpen = true;
        document.getElementById('fabRoot')?.classList.add('open');
        document.getElementById('fabBackdrop')?.classList.add('visible');
    },

    closeFab() {
        this.fabOpen = false;
        document.getElementById('fabRoot')?.classList.remove('open');
        document.getElementById('fabBackdrop')?.classList.remove('visible');
    },

    // ─── Custom Bottom Sheets (Category, Month, Calendar, Currency) ─────────
    openCustomSheet(sheetId) {
        this.closeCustomSheets();
        document.getElementById('customSheetOverlay')?.classList.add('visible');
        document.getElementById(sheetId)?.classList.add('open');

        const bottomNav = document.querySelector('.bottom-nav');
        const fabRoot   = document.getElementById('fabRoot');
        if (bottomNav) bottomNav.style.display = 'none';
        if (fabRoot)   fabRoot.style.display   = 'none';
    },

    closeCustomSheets() {
        document.getElementById('customSheetOverlay')?.classList.remove('visible');
        document.querySelectorAll('.custom-sheet').forEach(s => s.classList.remove('open'));

        const activePage = document.querySelector('.page.active');
        const fullScreenPages = ['addIncome', 'addExpense'];
        const isFullScreen = activePage && fullScreenPages.includes(activePage.id);

        if (!isFullScreen) {
            const bottomNav = document.querySelector('.bottom-nav');
            const fabRoot   = document.getElementById('fabRoot');
            if (bottomNav) bottomNav.style.display = '';
            if (fabRoot)   fabRoot.style.display   = '';
        }
    },

    // ─── Category Picker ─────────────────────────────────────────────────────
    openCategoryPicker(type) {
        this.activeCategoryType = type;
        const sheetTitle = document.getElementById('categoryPickerSheetTitle');
        if (sheetTitle) sheetTitle.textContent = `${type === 'income' ? 'Income' : 'Expense'} Category`;

        const categories = type === 'income' ? CONFIG.INCOME_CATEGORIES : CONFIG.EXPENSE_CATEGORIES;
        const currentVal = document.getElementById(`${type}Category`)?.value;
        const container  = document.getElementById('categoryPickerList');

        if (container) {
            container.innerHTML = categories.map(cat => {
                const emoji = this.getCategoryEmoji(cat, type);
                const isActive = cat === currentVal ? 'active' : '';
                return `
                <button class="category-picker-item ${isActive}" data-category="${cat}">
                    <span class="category-picker-icon">${emoji}</span>
                    <span>${cat}</span>
                </button>`;
            }).join('');
        }

        this.openCustomSheet('categoryPickerSheet');
    },

    selectCategory(category) {
        const type = this.activeCategoryType;
        const input = document.getElementById(`${type}Category`);
        const trigger = document.getElementById(`${type}CategoryTrigger`);
        const text = document.getElementById(`${type}CategoryText`);

        if (input) input.value = category;

        if (trigger && text) {
            const emoji = this.getCategoryEmoji(category, type);
            text.innerHTML = `<span>${emoji}</span> <span>${category}</span>`;
            trigger.classList.add('has-value');
        }

        this.closeCustomSheets();
    },

    resetCategoryTrigger(type) {
        const input = document.getElementById(`${type}Category`);
        const trigger = document.getElementById(`${type}CategoryTrigger`);
        const text = document.getElementById(`${type}CategoryText`);

        if (input) input.value = '';
        if (trigger && text) {
            text.textContent = 'Category';
            trigger.classList.remove('has-value');
        }
    },

    // ─── Custom Calendar Picker ─────────────────────────────────────────────
    openCalendarPicker(targetType) {
        this.calState.activeTarget = targetType;
        const currentVal = document.getElementById(`${targetType}Date`)?.value || Utils.getTodayDate();
        if (currentVal && currentVal.includes('-')) {
            const [y, m] = currentVal.split('-').map(Number);
            this.calState.year = y;
            this.calState.month = m - 1;
        } else {
            const now = new Date();
            this.calState.year = now.getFullYear();
            this.calState.month = now.getMonth();
        }
        this.renderCalendarDays();
        this.openCustomSheet('calendarPickerSheet');
    },

    renderCalendarDays() {
        const { year, month } = this.calState;
        const titleEl = document.getElementById('calMonthYearTitle');
        const gridEl  = document.getElementById('calDaysGrid');
        if (!gridEl) return;

        const date = new Date(year, month, 1);
        const monthName = date.toLocaleString('en-US', { month: 'long' });
        if (titleEl) titleEl.textContent = `${monthName}, ${year}`;

        const firstDay = new Date(year, month, 1).getDay();
        const startOffset = (firstDay + 6) % 7; // Mon=0 .. Sun=6

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevMonthDays = new Date(year, month, 0).getDate();

        const currentVal = document.getElementById(`${this.calState.activeTarget}Date`)?.value;

        let html = '';

        // Prev month days
        for (let i = startOffset - 1; i >= 0; i--) {
            const d = prevMonthDays - i;
            html += `<div class="cal-day-cell other-month">${d}</div>`;
        }

        // Current month days
        const todayStr = Utils.getTodayDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const monthStr = String(month + 1).padStart(2, '0');
            const dayStr   = String(day).padStart(2, '0');
            const dateISO  = `${year}-${monthStr}-${dayStr}`;

            const isToday = dateISO === todayStr ? 'today' : '';
            const isSelected = dateISO === currentVal ? 'selected' : '';

            html += `<div class="cal-day-cell ${isToday} ${isSelected}" data-date="${dateISO}">${day}</div>`;
        }

        gridEl.innerHTML = html;
    },

    selectCalendarDate(dateISO) {
        const target  = this.calState.activeTarget;
        const input   = document.getElementById(`${target}Date`);
        const trigger = document.getElementById(`${target}DateTrigger`);
        const text    = document.getElementById(`${target}DateText`);

        if (input) input.value = dateISO;
        if (trigger && text) {
            const formatted = Utils.formatDate(dateISO);
            text.innerHTML = `<span>${formatted}</span>`;
            trigger.classList.add('has-value');
        }

        this.closeCustomSheets();
    },

    resetDateTrigger(type) {
        const today = Utils.getTodayDate();
        const input   = document.getElementById(`${type}Date`);
        const trigger = document.getElementById(`${type}DateTrigger`);
        const text    = document.getElementById(`${type}DateText`);

        if (input) input.value = today;
        if (trigger && text) {
            const formatted = Utils.formatDate(today);
            text.innerHTML = `<span>${formatted}</span>`;
            trigger.classList.add('has-value');
        }
    },

    // ─── Filter Sheet ────────────────────────────────────────────────────────
    openFilterSheet() {
        document.getElementById('filterSheet')?.classList.add('open');
        document.getElementById('filterOverlay')?.classList.add('visible');

        // Hide bottom nav + FAB when filter sheet is open
        const bottomNav = document.querySelector('.bottom-nav');
        const fabRoot   = document.getElementById('fabRoot');
        if (bottomNav) bottomNav.style.display = 'none';
        if (fabRoot)   fabRoot.style.display   = 'none';
    },

    closeFilterSheet() {
        document.getElementById('filterSheet')?.classList.remove('open');
        document.getElementById('filterOverlay')?.classList.remove('visible');

        // Restore bottom nav + FAB if not on a full-screen tx page
        const activePage = document.querySelector('.page.active');
        const fullScreenPages = ['addIncome', 'addExpense'];
        const isFullScreen = activePage && fullScreenPages.includes(activePage.id);

        if (!isFullScreen) {
            const bottomNav = document.querySelector('.bottom-nav');
            const fabRoot   = document.getElementById('fabRoot');
            if (bottomNav) bottomNav.style.display = '';
            if (fabRoot)   fabRoot.style.display   = '';
        }
    },

    // ─── Category helpers ────────────────────────────────────────────────────
    getCategoryClass(category, type) {
        const map = {
            'Shopping':      'cat-shopping',
            'Food':          'cat-food',
            'Travel':        'cat-travel',
            'Transport':     'cat-travel',
            'Subscription':  'cat-subscription',
            'Entertainment': 'cat-entertainment',
            'Salary':        'cat-salary',
            'Business':      'cat-business',
            'Freelance':     'cat-freelance',
            'Health':        'cat-health',
            'Education':     'cat-education',
            'Bills':         'cat-bills',
            'Utilities':     'cat-bills',
        };
        return map[category] || (type === 'income' ? 'income' : 'expense');
    },

    getCategoryEmoji(category, type) {
        const map = {
            'Shopping':      '🛒',
            'Food':          '🍜',
            'Travel':        '✈️',
            'Transport':     '🚗',
            'Subscription':  '📋',
            'Entertainment': '🎮',
            'Salary':        '💼',
            'Business':      '💼',
            'Freelance':     '💻',
            'Health':        '❤️',
            'Education':     '📚',
            'Bills':         '🧾',
            'Utilities':     '💡',
        };
        return map[category] || (type === 'income' ? '💰' : '💸');
    },

    formatShortDate(dateStr) {
        return Utils.formatShortDate(dateStr);
    },

    escapeHTML(value) {
        const div = document.createElement('div');
        div.textContent = value ?? '';
        return div.innerHTML;
    },

    getMonthName(index = this.selectedMonthIndex) {
        return new Date(this.selectedYear, index, 1).toLocaleString('en-US', { month: 'long' });
    },

    isSelectedMonth(dateStr) {
        const date = Utils.parseDate(dateStr);
        return date.getFullYear() === this.selectedYear && date.getMonth() === this.selectedMonthIndex;
    },

    updateSelectedMonthLabels() {
        const monthName = this.getMonthName();
        const monthEl = document.getElementById('currentMonthLabel');
        const txnMonthEl = document.getElementById('txnMonthLabel');
        if (monthEl) monthEl.textContent = monthName;
        if (txnMonthEl) txnMonthEl.textContent = monthName;

        document.querySelectorAll('.month-picker-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.month === monthName);
        });
    },

    transactionMatchesSearch(t) {
        const query = this.filter.search.trim().toLowerCase();
        if (!query) return true;

        return [
            t.category,
            t.description,
            t.type,
            t.amount,
            Utils.formatDate(t.date),
            this.formatDateLabel(t.date)
        ].some(value => String(value || '').toLowerCase().includes(query));
    },

    updateSelectedCatCount() {
        const count = this.filter.categories.length;
        const el = document.getElementById('selectedCatCount');
        if (el) el.textContent = `${count} Selected`;
    },

    renderCategoryFilterOptions() {
        const container = document.getElementById('categoryFilterGroup');
        if (!container) return;

        const categories = [...new Set([...CONFIG.EXPENSE_CATEGORIES, ...CONFIG.INCOME_CATEGORIES])];
        container.innerHTML = categories.map(category => {
            const active = this.filter.categories.includes(category) ? 'active' : '';
            const icon = this.getCategoryEmoji(category, CONFIG.INCOME_CATEGORIES.includes(category) ? 'income' : 'expense');
            return `<button class="category-filter-pill ${active}" data-category="${this.escapeHTML(category)}">${icon}<span>${this.escapeHTML(category)}</span></button>`;
        }).join('');

        this.updateSelectedCatCount();
    },

    updateTransactionOverview(transactions) {
        const income = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const expense = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const net = income - expense;

        const netEl = document.getElementById('txnNetFlow');
        const incomeEl = document.getElementById('txnIncomeTotal');
        const expenseEl = document.getElementById('txnExpenseTotal');

        if (netEl) {
            netEl.textContent = Utils.formatCurrency(net);
            netEl.classList.toggle('income', net >= 0);
            netEl.classList.toggle('expense', net < 0);
        }
        if (incomeEl) incomeEl.textContent = Utils.formatCurrency(income);
        if (expenseEl) expenseEl.textContent = Utils.formatCurrency(expense);
    },

    formatDateLabel(dateStr) {
        if (!dateStr) return '';
        const today = new Date();
        const txDate = Utils.parseDate(dateStr);
        if (isNaN(txDate.getTime())) return Utils.formatShortDate(dateStr);

        if (txDate.toDateString() === today.toDateString()) return 'Today';
        const yest = new Date(today); yest.setDate(today.getDate() - 1);
        if (txDate.toDateString() === yest.toDateString()) return 'Yesterday';

        return Utils.formatShortDate(dateStr);
    },

    sanitizeAmountInput(value) {
        const normalized = String(value || '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
        const firstDot = normalized.indexOf('.');
        if (firstDot === -1) return normalized;

        const whole = normalized.slice(0, firstDot);
        const decimals = normalized.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
        return `${whole}.${decimals}`;
    },

    formatAmountDraft(value, symbol = this._sym()) {
        if (!value) return `${symbol}0`;

        const hasDecimalPoint = value.includes('.');
        const [wholeRaw, decimalRaw = ''] = value.split('.');
        const wholeNumber = Number(wholeRaw || '0');
        const whole = wholeNumber.toLocaleString('en-IN', { maximumFractionDigits: 0 });

        if (hasDecimalPoint) return `${symbol}${whole}.${decimalRaw}`;
        return `${symbol}${whole}`;
    },

    // ─── Wire amount input to live display ───────────────────────────────────
    setupAmountInputs() {
        const symbol = this._sym();

        const wire = (inputId, displayId) => {
            const input = document.getElementById(inputId);
            const display = document.getElementById(displayId);
            if (!input || !display || input.dataset.amountWired === 'true') return;

            input.dataset.amountWired = 'true';
            display.addEventListener('click', () => input.focus());

            input.addEventListener('input', () => {
                const sanitized = this.sanitizeAmountInput(input.value);
                if (input.value !== sanitized) input.value = sanitized;
                display.textContent = this.formatAmountDraft(sanitized, symbol);
                display.style.fontSize = sanitized.length > 8 ? '40px' :
                                         sanitized.length > 6 ? '50px' : '64px';
            });
        };

        wire('expenseAmount', 'expenseAmountDisplay');
        wire('incomeAmount',  'incomeAmountDisplay');
    },

    // ─── Render Recent Transactions on Dashboard ──────────────────────────────
    async renderRecentTransactions() {
        const container = document.getElementById('recentTransactions');
        if (!container) return;
        const transactions = await DB.getAllTransactions();

        const recent = transactions
            .sort((a, b) => Utils.parseDate(b.date) - Utils.parseDate(a.date))
            .slice(0, 5);

        if (recent.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No transactions yet. Start tracking!</p></div>';
            return;
        }

        container.innerHTML = recent.map(t => this.renderTransactionItem(t)).join('');
    },

    renderTransactionItem(t) {
        const catClass = this.getCategoryClass(t.category, t.type);
        const emoji = this.getCategoryEmoji(t.category, t.type);
        const formattedDate = Utils.formatDate(t.date) || this.formatShortDate(t.date);
        const sign = t.type === 'income' ? '+' : '-';
        const descText = t.description ? `${this.escapeHTML(t.description)} • ${formattedDate}` : formattedDate;

        return `
        <div class="transaction-item" data-transaction-id="${this.escapeHTML(t.id)}" role="button" tabindex="0">
            <div class="transaction-info">
                <div class="transaction-icon ${catClass}">${emoji}</div>
                <div class="transaction-details">
                    <div class="transaction-category">${this.escapeHTML(t.category)}</div>
                    <div class="transaction-date">${descText}</div>
                </div>
            </div>
            <div class="transaction-right">
                <span class="transaction-amount ${t.type}">${sign} ${Utils.formatCurrency(t.amount)}</span>
                <span class="transaction-time">${formattedDate}</span>
            </div>
        </div>`;
    },
    // ─── Render History with date grouping ───────────────────────────────────
    async renderHistoryTransactions() {
        const container = document.getElementById('historyTransactions');
        if (!container) return;

        let transactions = await DB.getAllTransactions();
        const monthTransactions = transactions.filter(t => this.isSelectedMonth(t.date));
        this.updateTransactionOverview(monthTransactions);

        transactions = monthTransactions.filter(t => this.transactionMatchesSearch(t));

        if (this.filter.type !== 'all') {
            transactions = transactions.filter(t => t.type === this.filter.type);
        }
        if (this.filter.categories.length > 0) {
            transactions = transactions.filter(t => this.filter.categories.includes(t.category));
        }

        switch (this.filter.sort) {
            case 'highest': transactions.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)); break;
            case 'lowest':  transactions.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount)); break;
            case 'oldest':  transactions.sort((a, b) => Utils.parseDate(a.date) - Utils.parseDate(b.date)); break;
            default:        transactions.sort((a, b) => Utils.parseDate(b.date) - Utils.parseDate(a.date));
        }

        const countEl = document.getElementById('txnResultCount');
        if (countEl) countEl.textContent = `${transactions.length} item${transactions.length === 1 ? '' : 's'}`;

        const clearBtn = document.getElementById('txnClearSearchBtn');
        if (clearBtn) clearBtn.classList.toggle('visible', Boolean(this.filter.search.trim()));

        if (transactions.length === 0) {
            const hasFilters = this.filter.search.trim() || this.filter.type !== 'all' || this.filter.categories.length > 0;
            const message = hasFilters ? 'No matching transactions found' : `No transactions in ${this.getMonthName()}`;
            container.innerHTML = `<div class="empty-state txn-empty"><p>${message}</p></div>`;
            return;
        }

        const groups = {};
        transactions.forEach(t => {
            if (!groups[t.date]) groups[t.date] = [];
            groups[t.date].push(t);
        });

        const sortedDates = Object.keys(groups).sort((a, b) =>
            this.filter.sort === 'oldest' ? Utils.parseDate(a) - Utils.parseDate(b) : Utils.parseDate(b) - Utils.parseDate(a)
        );

        container.innerHTML = sortedDates.map(date => {
            const itemsHtml = groups[date].map(t => this.renderTransactionItem(t)).join('');
            return `
            <div class="txn-date-group">
                <div class="txn-date-label">${this.formatDateLabel(date)}</div>
                <div class="transactions-list">${itemsHtml}</div>
            </div>`;
        }).join('');
    },
    // ─── Dashboard Stats ─────────────────────────────────────────────────────
    async updateDashboardStats() {
        const transactions = await DB.getAllTransactions();

        const totalIncome = transactions
            .filter(t => t.type === 'income')
            .reduce((s, t) => s + parseFloat(t.amount), 0);

        const totalExpense = transactions
            .filter(t => t.type === 'expense')
            .reduce((s, t) => s + parseFloat(t.amount), 0);

        const balance = totalIncome - totalExpense;

        document.getElementById('currentBalance').textContent = Utils.formatCurrency(balance);
        document.getElementById('totalIncome').textContent    = Utils.formatCurrency(totalIncome);
        document.getElementById('totalExpense').textContent   = Utils.formatCurrency(totalExpense);

        this.updateSelectedMonthLabels();

        await this.renderSpendHeatmap(this.currentPeriod);
    },

    // ─── Spend Frequency Heatmap (Matches Mockup Reference Image Exactly) ──────
    async renderSpendHeatmap(period = 'today') {
        const container = document.getElementById('spendHeatmap');
        const yearTitleEl = document.getElementById('heatmapYearTitle');
        if (!container) return;

        const transactions = await DB.getAllTransactions();
        const now = new Date();
        const currentYear = now.getFullYear();
        if (yearTitleEl) yearTitleEl.textContent = currentYear;

        const getLvl = (val, max) => {
            if (!val || val <= 0) return 0;
            if (max <= 0) return 1;
            const ratio = val / max;
            if (ratio < 0.2) return 1;
            if (ratio < 0.45) return 2;
            if (ratio < 0.75) return 3;
            return 4; // Dark Charcoal / Black tile
        };

        const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

        // Render 12 Month x 7 Row Matrix (Reference Image Design)
        // Matrix data: 12 month columns, each with 7 intensity rows
        const matrixData = Array.from({ length: 12 }, () => new Array(7).fill(0));

        transactions.filter(t => t.type === 'expense').forEach(t => {
            const [y, m, d] = t.date.split('-').map(Number);
            if (y === currentYear && m >= 1 && m <= 12) {
                const monthIdx = m - 1;
                const rowIdx = (d - 1) % 7;
                matrixData[monthIdx][rowIdx] += parseFloat(t.amount);
            }
        });

        const flatVals = matrixData.flat();
        const hasData = flatVals.some(v => v > 0);

        // Sample pattern matching the mockup image if no user data yet
        if (!hasData) {
            const sampleMatrix = [
                [75, 0, 45, 0, 15, 30, 25],   // JAN
                [35, 90, 45, 0, 10, 50, 25],  // FEB
                [20, 0, 30, 0, 60, 180, 64],  // MAR
                [0, 0, 0, 0, 40, 75, 90],     // APR
                [30, 0, 0, 25, 10, 20, 35],   // MAY
                [0, 0, 0, 128, 0, 0, 0],      // JUN
                [0, 25, 70, 190, 0, 10, 20],  // JUL
                [25, 0, 85, 160, 55, 0, 0],   // AUG
                [35, 75, 195, 110, 60, 75, 0],// SEP
                [85, 160, 75, 80, 0, 30, 0],  // OCT
                [45, 60, 35, 0, 0, 40, 0],    // NOV
                [0, 70, 30, 0, 25, 195, 64]   // DEC
            ];
            for (let m = 0; m < 12; m++) {
                for (let r = 0; r < 7; r++) {
                    matrixData[m][r] = sampleMatrix[m][r];
                }
            }
        }

        const maxVal = Math.max(...matrixData.flat(), 1);

        let html = '<div class="hm-matrix-container">';
        html += '<div class="hm-matrix-grid">';

        for (let col = 0; col < 12; col++) {
            html += '<div class="hm-month-col">';
            for (let row = 0; row < 7; row++) {
                const val = matrixData[col][row];
                const lvl = getLvl(val, maxVal);
                const mName = monthNames[col];
                const labelText = (val === 128 || val === 64) ? val : (val > 150 ? Math.round(val) : '');
                const tipText = `${mName} Block ${row+1} • ${val > 0 ? Utils.formatCurrency(val) : 'No expense'}`;

                html += `
                <div class="hm-tile lvl-${lvl}" onclick="Utils.showToast('${tipText}')" title="${tipText}">
                    ${labelText}
                </div>`;
            }
            html += '</div>';
        }

        html += '</div>';

        // Month Labels Row (JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC)
        const currentMonthIdx = now.getMonth();
        html += '<div class="hm-month-labels-row">';
        monthNames.forEach((mName, idx) => {
            const activeClass = idx === currentMonthIdx ? 'active' : '';
            html += `<span class="hm-month-col-label ${activeClass}">${mName}</span>`;
        });
        html += '</div>';

        html += '</div>';

        container.innerHTML = html;
    },

    // ─── Setup all event listeners ────────────────────────────────────────────
    setupEventListeners() {

        // Bottom nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const pageName = item.dataset.page;
                this.goToPage(pageName);
                if (pageName === 'history') this.renderHistoryTransactions();
            });
        });

        this.updateSelectedMonthLabels();
        this.renderCategoryFilterOptions();

        const openTransaction = e => {
            const item = e.target.closest('.transaction-item[data-transaction-id]');
            if (item) APP.editTransaction(item.dataset.transactionId);
        };
        document.getElementById('recentTransactions')?.addEventListener('click', openTransaction);
        document.getElementById('historyTransactions')?.addEventListener('click', openTransaction);
        document.getElementById('recentTransactions')?.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') openTransaction(e);
        });
        document.getElementById('historyTransactions')?.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') openTransaction(e);
        });
        // FAB toggle
        document.getElementById('addBtn')?.addEventListener('click', () => {
            if (this.fabOpen) this.closeFab();
            else this.openFab();
        });

        document.getElementById('fabBackdrop')?.addEventListener('click', () => this.closeFab());

        // Custom Sheet Overlay backdrop click
        document.getElementById('customSheetOverlay')?.addEventListener('click', () => this.closeCustomSheets());
        document.getElementById('closeCategorySheetBtn')?.addEventListener('click', () => this.closeCustomSheets());
        document.getElementById('closeMonthSheetBtn')?.addEventListener('click', () => this.closeCustomSheets());
        document.getElementById('closeCalendarSheetBtn')?.addEventListener('click', () => this.closeCustomSheets());
        document.getElementById('closeCurrencySheetBtn')?.addEventListener('click', () => this.closeCustomSheets());

        // Category Triggers
        document.getElementById('expenseCategoryTrigger')?.addEventListener('click', () => this.openCategoryPicker('expense'));
        document.getElementById('incomeCategoryTrigger')?.addEventListener('click', () => this.openCategoryPicker('income'));

        // Category Item Click
        document.getElementById('categoryPickerList')?.addEventListener('click', e => {
            const item = e.target.closest('.category-picker-item');
            if (item) {
                const cat = item.dataset.category;
                this.selectCategory(cat);
            }
        });

        // Custom Date Triggers
        document.getElementById('expenseDateTrigger')?.addEventListener('click', () => this.openCalendarPicker('expense'));
        document.getElementById('incomeDateTrigger')?.addEventListener('click', () => this.openCalendarPicker('income'));

        // Calendar Prev / Next Month
        document.getElementById('calPrevMonthBtn')?.addEventListener('click', () => {
            this.calState.month--;
            if (this.calState.month < 0) {
                this.calState.month = 11;
                this.calState.year--;
            }
            this.renderCalendarDays();
        });

        document.getElementById('calNextMonthBtn')?.addEventListener('click', () => {
            this.calState.month++;
            if (this.calState.month > 11) {
                this.calState.month = 0;
                this.calState.year++;
            }
            this.renderCalendarDays();
        });

        // Calendar Day Cell Click
        document.getElementById('calDaysGrid')?.addEventListener('click', e => {
            const cell = e.target.closest('.cal-day-cell:not(.other-month)');
            if (cell && cell.dataset.date) {
                this.selectCalendarDate(cell.dataset.date);
            }
        });

        // Month Selector Triggers
        const openMonthSheet = () => this.openCustomSheet('monthPickerSheet');
        document.getElementById('monthSelectorBtn')?.addEventListener('click', openMonthSheet);
        document.getElementById('txnMonthBtn')?.addEventListener('click', openMonthSheet);

        // Month Item Click
        document.getElementById('monthPickerGrid')?.addEventListener('click', e => {
            const btn = e.target.closest('.month-picker-item');
            if (btn) {
                const month = btn.dataset.month;
                const monthIndex = Array.from(document.querySelectorAll('.month-picker-item')).findIndex(item => item.dataset.month === month);
                if (monthIndex >= 0) this.selectedMonthIndex = monthIndex;
                this.updateSelectedMonthLabels();
                this.closeCustomSheets();
                if (document.querySelector('.page.active')?.id === 'history') this.renderHistoryTransactions();
            }
        });

        // Currency Trigger & Picker Click
        document.getElementById('currencySelectTrigger')?.addEventListener('click', () => this.openCustomSheet('currencyPickerSheet'));

        document.getElementById('currencyPickerList')?.addEventListener('click', async e => {
            const btn = e.target.closest('.picker-option-item');
            if (btn) {
                const cur = btn.dataset.currency;
                document.querySelectorAll('.picker-option-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const textEl = document.getElementById('currencySelectText');
                const info = CONFIG.CURRENCIES[cur] || { symbol: '$', name: cur };
                if (textEl) textEl.textContent = `${info.symbol} ${info.name}`;

                CONFIG.DEFAULT_CURRENCY = cur;
                await DB.setSetting('currency', cur);
                await this.updateDashboardStats();
                this.closeCustomSheets();
                Utils.showToast(`Currency changed to ${cur}`);
            }
        });

        // Mini button: Income
        document.getElementById('openIncomePage')?.addEventListener('click', () => {
            this.closeFab();
            this.resetCategoryTrigger('income');
            this.resetDateTrigger('income');
            this.setupAmountInputs();
            document.getElementById('incomeAmount').value = '';
            document.getElementById('incomeAmountDisplay').textContent = `${this._sym()}0`;
            document.getElementById('incomeAmountDisplay').style.fontSize = '64px';
            document.getElementById('incomeDescription').value = '';
            this.goToPage('addIncome');
        });

        // Mini button: Expense
        document.getElementById('openExpensePage')?.addEventListener('click', () => {
            this.closeFab();
            this.resetCategoryTrigger('expense');
            this.resetDateTrigger('expense');
            this.setupAmountInputs();
            document.getElementById('expenseAmount').value = '';
            document.getElementById('expenseAmountDisplay').textContent = `${this._sym()}0`;
            document.getElementById('expenseAmountDisplay').style.fontSize = '64px';
            document.getElementById('expenseDescription').value = '';
            this.goToPage('addExpense');
        });

        // Continue buttons
        document.getElementById('expenseContinueBtn')?.addEventListener('click', () => APP.handleTxFormSubmit('expense'));
        document.getElementById('incomeContinueBtn')?.addEventListener('click', () => APP.handleTxFormSubmit('income'));

        // Back buttons
        document.getElementById('backFromExpenseBtn')?.addEventListener('click', () => this.goToPage('dashboard'));
        document.getElementById('backFromIncomeBtn')?.addEventListener('click', () => this.goToPage('dashboard'));

        // See All
        document.getElementById('seeAllBtn')?.addEventListener('click', () => {
            this.goToPage('history');
            this.renderHistoryTransactions();
        });

        // Profile avatar
        document.getElementById('profileBtn')?.addEventListener('click', () => this.goToPage('profile'));

        // Subnav back buttons
        document.getElementById('backFromBudgetBtn')?.addEventListener('click', () => this.goToPage('dashboard'));
        document.getElementById('backFromProfileBtn')?.addEventListener('click', () => this.goToPage('dashboard'));

        // Period tabs
        document.querySelectorAll('.period-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentPeriod = tab.dataset.period;
                this.renderSpendHeatmap(this.currentPeriod);
            });
        });

        // Transaction page filter
        document.getElementById('openFilterBtn')?.addEventListener('click', () => {
            this.renderCategoryFilterOptions();
            this.openFilterSheet();
        });
        document.getElementById('filterOverlay')?.addEventListener('click', () => this.closeFilterSheet());

        document.getElementById('filterByGroup')?.addEventListener('click', e => {
            const pill = e.target.closest('.pill');
            if (!pill) return;
            document.querySelectorAll('#filterByGroup .pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            this.filter.type = pill.dataset.filter;
        });

        document.getElementById('sortByGroup')?.addEventListener('click', e => {
            const pill = e.target.closest('.pill');
            if (!pill) return;
            document.querySelectorAll('#sortByGroup .pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            this.filter.sort = pill.dataset.sort;
        });

        document.getElementById('categoryFilterGroup')?.addEventListener('click', e => {
            const pill = e.target.closest('.category-filter-pill');
            if (!pill) return;
            const category = pill.dataset.category;
            if (this.filter.categories.includes(category)) {
                this.filter.categories = this.filter.categories.filter(c => c !== category);
            } else {
                this.filter.categories.push(category);
            }
            pill.classList.toggle('active');
            this.updateSelectedCatCount();
        });

        document.getElementById('txnSearchInput')?.addEventListener('input', Utils.debounce(e => {
            this.filter.search = e.target.value;
            this.renderHistoryTransactions();
        }, 120));

        document.getElementById('txnClearSearchBtn')?.addEventListener('click', () => {
            this.filter.search = '';
            const input = document.getElementById('txnSearchInput');
            if (input) input.value = '';
            this.renderHistoryTransactions();
        });

        document.getElementById('reportBannerBtn')?.addEventListener('click', () => {
            Utils.showToast('Financial report coming soon');
        });

        document.getElementById('applyFilterBtn')?.addEventListener('click', () => {
            this.closeFilterSheet();
            this.renderHistoryTransactions();
        });

        document.getElementById('resetFilterBtn')?.addEventListener('click', () => {
            this.filter = { type: 'all', sort: 'newest', categories: [], search: this.filter.search };
            document.querySelectorAll('#filterByGroup .pill').forEach((p,i) => p.classList.toggle('active', i===0));
            document.querySelectorAll('#sortByGroup .pill').forEach((p,i) => p.classList.toggle('active', i===2));
            this.renderCategoryFilterOptions();
        });

        // Dark mode
        const darkToggle = document.getElementById('darkModeToggle');
        darkToggle?.addEventListener('change', async () => {
            const isDark = darkToggle.checked;
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
            await DB.setSetting('darkMode', isDark);
            await this.renderSpendHeatmap(this.currentPeriod);
        });

        // Export
        document.getElementById('exportBtn')?.addEventListener('click', async () => {
            const transactions = await DB.getAllTransactions();
            Utils.exportToCSV(transactions, `expense-tracker-${new Date().toISOString().split('T')[0]}.csv`);
            Utils.showToast('Exported successfully!');
        });

        // Test notification
        document.getElementById('testNotifBtn')?.addEventListener('click', async () => {
            await Utils.triggerSystemNotification(
                'Expense Tracker 💰',
                'Reminder: Time to log your recent income & expenses!'
            );
            Utils.showToast('🔔 Test notification sent!');
        });

        // Backup
        document.getElementById('backupBtn')?.addEventListener('click', () => {
            Utils.showToast('Backup feature coming soon!');
        });

        // PWA install
        const installBtn = document.getElementById('installBtn');
        if (installBtn) {
            let deferredPrompt;
            window.addEventListener('beforeinstallprompt', e => {
                e.preventDefault();
                deferredPrompt = e;
                installBtn.style.display = 'block';
            });
            installBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    await deferredPrompt.userChoice;
                    deferredPrompt = null;
                    installBtn.style.display = 'none';
                }
            });
        }
    },

    // ─── Currency symbol helper ───────────────────────────────────────────────
    _sym() {
        const cur = CONFIG.DEFAULT_CURRENCY;
        return (CONFIG.CURRENCIES?.[cur] || CONFIG.CURRENCIES?.USD || { symbol: '$' }).symbol;
    },

    // ─── Load Theme ───────────────────────────────────────────────────────────
    async loadThemePreference() {
        const isDark = await DB.getSetting('darkMode');
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            const toggle = document.getElementById('darkModeToggle');
            if (toggle) toggle.checked = true;
        }

        const savedCur = await DB.getSetting('currency');
        if (savedCur && CONFIG.CURRENCIES[savedCur]) {
            CONFIG.DEFAULT_CURRENCY = savedCur;
            const textEl = document.getElementById('currencySelectText');
            const info = CONFIG.CURRENCIES[savedCur];
            if (textEl) textEl.textContent = `${info.symbol} ${info.name}`;

            document.querySelectorAll('.picker-option-item').forEach(b => {
                b.classList.toggle('active', b.dataset.currency === savedCur);
            });
        }
    },

    // ─── Compatibility stubs ──────────────────────────────────────────────────
    populateCategorySelects() {},
    initializeTransactionForm() {},
    updateOfflineStatus() {
        if (!Utils.isOnline()) Utils.showToast('You are offline');
    },
    updateSyncStatus(synced, pendingCount) {
        if (pendingCount > 0 && Utils.isOnline()) Utils.showToast(`${pendingCount} item(s) pending sync`);
    },
    async handleSyncClick() {
        try {
            await API.syncQueue();
            Utils.showToast('✓ All changes synced!');
            await APP.loadData();
        } catch {
            Utils.showToast('Sync failed. Check your connection.');
        }
    }
};

const UI = {
    chartInstance: null,
    currentPeriod: 'today',
    fabOpen: false,
    activeCategoryType: 'expense',

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
        categories: []
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
        const fullScreenPages = ['addIncome', 'addExpense', 'transactionDetail'];
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
        const fullScreenPages = ['addIncome', 'addExpense', 'transactionDetail'];
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
        const fullScreenPages = ['addIncome', 'addExpense', 'transactionDetail'];
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

    // ─── Wire amount input to live display ───────────────────────────────────
    setupAmountInputs() {
        if (this._amountInputsSetup) return;
        this._amountInputsSetup = true;
        const symbol = (() => {
            const cur = CONFIG.DEFAULT_CURRENCY;
            return (CONFIG.CURRENCIES[cur] || CONFIG.CURRENCIES.INR || {symbol: '₹'}).symbol;
        })();

        const wire = (inputId, displayId) => {
            const input = document.getElementById(inputId);
            const display = document.getElementById(displayId);
            if (!input || !display) return;

            display.addEventListener('click', () => input.focus());

            input.addEventListener('input', () => {
                let valStr = input.value;
                if (!valStr) {
                    display.textContent = `${symbol}0`;
                    display.style.fontSize = '64px';
                    return;
                }
                
                // Allow trailing dot and zeros to be visible while typing
                let formatted;
                if (valStr.endsWith('.')) {
                    const val = parseFloat(valStr);
                    formatted = isNaN(val) ? `${symbol}0.` : `${symbol}${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}.`;
                } else if (valStr.endsWith('.0')) {
                    const val = parseFloat(valStr);
                    formatted = isNaN(val) ? `${symbol}0.0` : `${symbol}${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}.0`;
                } else if (valStr.endsWith('.00')) {
                    const val = parseFloat(valStr);
                    formatted = isNaN(val) ? `${symbol}0.00` : `${symbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                } else {
                    const val = parseFloat(valStr);
                    formatted = isNaN(val) ? `${symbol}0` : `${symbol}${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
                }
                
                display.textContent = formatted;
                display.style.fontSize = input.value.length > 8 ? '40px' :
                                         input.value.length > 6 ? '50px' : '64px';
            });
        };

        wire('expenseAmount', 'expenseAmountDisplay');
        wire('incomeAmount',  'incomeAmountDisplay');
    },

    // ─── Render Recent Transactions on Dashboard ──────────────────────────────
    async renderRecentTransactions() {
        const container = document.getElementById('recentTransactions');
        const transactions = await DB.getAllTransactions();

        const recent = transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        if (recent.length === 0) {
            container.innerHTML = '<div class="empty-state"><lottie-player src="https://assets2.lottiefiles.com/packages/lf20_0s6tfbuc.json" background="transparent" speed="1" style="width: 150px; height: 150px; margin: 0 auto;" loop autoplay></lottie-player><p>No transactions yet. Start tracking!</p></div>';
            return;
        }

        container.innerHTML = recent.map(t => {
            const catClass = this.getCategoryClass(t.category, t.type);
            const emoji = this.getCategoryEmoji(t.category, t.type);
            const formattedDate = Utils.formatDate(t.date) || this.formatShortDate(t.date);
            const sign = t.type === 'income' ? '+' : '-';
            const descText = t.description ? `${t.description} • ${formattedDate}` : formattedDate;

            return `
            <div class="transaction-item" onclick="UI.showTransactionDetails('${t.id}')">
                <div class="transaction-info">
                    <div class="transaction-icon ${catClass}">${emoji}</div>
                    <div class="transaction-details">
                        <div class="transaction-category">${t.category}</div>
                        <div class="transaction-date">${descText}</div>
                    </div>
                </div>
                <div class="transaction-right">
                    <span class="transaction-amount ${t.type}">${sign} ${Utils.formatCurrency(t.amount)}</span>
                    <span class="transaction-time">${formattedDate}</span>
                </div>
            </div>`;
        }).join('');
    },

    // ─── Render History with date grouping ───────────────────────────────────
    async renderHistoryTransactions() {
        const container = document.getElementById('historyTransactions');
        const allTransactions = await DB.getAllTransactions();

        // Calculate running balance for all days
        const ledgerGroups = {};
        allTransactions.forEach(t => {
            if (!ledgerGroups[t.date]) ledgerGroups[t.date] = { income: 0, expense: 0 };
            if (t.type === 'income') ledgerGroups[t.date].income += parseFloat(t.amount);
            else ledgerGroups[t.date].expense += parseFloat(t.amount);
        });

        const allDatesSorted = Object.keys(ledgerGroups).sort((a, b) => new Date(a) - new Date(b));
        let runningBalance = 0;
        const dailyBalances = {};
        for (const date of allDatesSorted) {
            runningBalance += ledgerGroups[date].income - ledgerGroups[date].expense;
            dailyBalances[date] = runningBalance;
        }

        let transactions = [...allTransactions];

        if (this.filter.type !== 'all') {
            transactions = transactions.filter(t => t.type === this.filter.type);
        }
        if (this.filter.categories.length > 0) {
            transactions = transactions.filter(t => this.filter.categories.includes(t.category));
        }

        switch (this.filter.sort) {
            case 'highest': transactions.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)); break;
            case 'lowest':  transactions.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount)); break;
            case 'oldest':  transactions.sort((a, b) => new Date(a.date) - new Date(b.date)); break;
            default:        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        }

        if (transactions.length === 0) {
            container.innerHTML = '<div class="empty-state"><lottie-player src="https://assets2.lottiefiles.com/packages/lf20_0s6tfbuc.json" background="transparent" speed="1" style="width: 150px; height: 150px; margin: 0 auto;" loop autoplay></lottie-player><p>No transactions found</p></div>';
            return;
        }

        const groups = {};
        transactions.forEach(t => {
            if (!groups[t.date]) groups[t.date] = [];
            groups[t.date].push(t);
        });

        const sortedDates = Object.keys(groups).sort((a, b) =>
            this.filter.sort === 'oldest' ? new Date(a) - new Date(b) : new Date(b) - new Date(a)
        );

        container.innerHTML = sortedDates.map(date => {
            const items = groups[date];
            const dateLabel = this.formatDateLabel(date);
            const itemsHtml = items.map(t => {
                const catClass = this.getCategoryClass(t.category, t.type);
                const emoji = this.getCategoryEmoji(t.category, t.type);
                const sign = t.type === 'income' ? '+' : '-';
                const formattedDate = Utils.formatDate(t.date) || this.formatShortDate(date);
                const descText = t.description ? `${t.description} • ${formattedDate}` : formattedDate;

                return `
                <div class="transaction-item" onclick="UI.showTransactionDetails('${t.id}')">
                    <div class="transaction-info">
                        <div class="transaction-icon ${catClass}">${emoji}</div>
                        <div class="transaction-details">
                            <div class="transaction-category">${t.category}</div>
                            <div class="transaction-date">${descText}</div>
                        </div>
                    </div>
                    <div class="transaction-right">
                        <span class="transaction-amount ${t.type}">${sign} ${Utils.formatCurrency(t.amount)}</span>
                        <span class="transaction-time">${formattedDate}</span>
                    </div>
                </div>`;
            }).join('');

            return `
            <div class="txn-date-group">
                <div class="txn-date-label">
                    <span>${dateLabel}</span>
                    <span class="day-end-balance">Day End: ${Utils.formatCurrency(dailyBalances[date])}</span>
                </div>
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

        const monthName = new Date().toLocaleString('en-US', { month: 'long' });
        const monthEl    = document.getElementById('currentMonthLabel');
        const txnMonthEl = document.getElementById('txnMonthLabel');
        if (monthEl)    monthEl.textContent    = monthName;
        if (txnMonthEl) txnMonthEl.textContent = monthName;

        await this.renderSpendHeatmap(this.currentPeriod);
    },

    // ─── Spend Frequency Heatmap (Matches Mockup Reference Image Exactly) ──────
    async renderSpendHeatmap(period = 'today') {
        const container = document.getElementById('spendHeatmap');
        const yearTitleEl = document.getElementById('heatmapYearTitle');
        if (!container) return;

        const transactions = await DB.getAllTransactions();
        
        // Update Title
        if (yearTitleEl) yearTitleEl.textContent = 'Last 7 Days';

        const getLvl = (val, max) => {
            if (!val || val <= 0) return 0;
            if (max <= 0) return 1;
            const ratio = val / max;
            if (ratio < 0.2) return 1;
            if (ratio < 0.45) return 2;
            if (ratio < 0.75) return 3;
            return 4; // Dark Charcoal / Black tile
        };

        const last7Days = [];
        const dayLabels = [];
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            last7Days.push(`${y}-${m}-${day}`);
            dayLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase());
        }

        const matrixData = new Array(7).fill(0);

        transactions.filter(t => t.type === 'expense').forEach(t => {
            const idx = last7Days.indexOf(t.date);
            if (idx !== -1) {
                matrixData[idx] += parseFloat(t.amount);
            }
        });

        const hasData = matrixData.some(v => v > 0);

        // Sample pattern matching the mockup image if no user data yet
        if (!hasData) {
            const sampleMatrix = [15, 45, 0, 128, 60, 190, 64];
            for (let r = 0; r < 7; r++) {
                matrixData[r] = sampleMatrix[r];
            }
        }

        const maxVal = Math.max(...matrixData, 1);

        let html = '<div class="hm-matrix-container" style="overflow-x: hidden;">';
        html += '<div class="hm-matrix-grid" style="grid-template-columns: repeat(7, 1fr);">';

        for (let col = 0; col < 7; col++) {
            html += '<div class="hm-month-col" style="display: flex; flex-direction: column; align-items: stretch; justify-content: flex-end;">';
            const val = matrixData[col];
            const lvl = getLvl(val, maxVal);
            const labelText = (val > 0) ? Math.round(val) : '';
            const tipText = `${dayLabels[col]} • ${val > 0 ? Utils.formatCurrency(val) : 'No expense'}`;
            
            html += `
            <div class="hm-tile lvl-${lvl}" style="display: flex; align-items: center; justify-content: center; font-size: 14px; border-radius: 12px; transition: 0.2s; aspect-ratio: 1;" onclick="Utils.showToast('${tipText}')" title="${tipText}">
                ${labelText}
            </div>`;
            
            html += '</div>';
        }

        html += '</div>';

        // Day Labels Row (MON TUE WED THU FRI SAT SUN)
        html += '<div class="hm-month-labels-row" style="grid-template-columns: repeat(7, 1fr);">';
        dayLabels.forEach((dName, idx) => {
            const activeClass = idx === 6 ? 'active' : '';
            html += `<span class="hm-month-col-label ${activeClass}" style="font-size: 11px;">${dName}</span>`;
        });
        html += '</div></div>';

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

        // Delete Confirmation Modal
        document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => this.hideDeleteConfirmModal());
        document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => {
            this.hideDeleteConfirmModal();
            this.goToPage('dashboard');
            if (this.currentDetailId) {
                APP.deleteTransaction(this.currentDetailId);
            }
        });

        document.getElementById('detailDeleteBtn')?.addEventListener('click', () => this.showDeleteConfirmModal());
        document.getElementById('detailEditBtn')?.addEventListener('click', () => {
            if (this.currentDetailId) {
                APP.editTransaction(this.currentDetailId);
            }
        });

        // Detail Page Back Button
        document.getElementById('backFromDetailBtn')?.addEventListener('click', () => {
            this.goToPage('dashboard');
        });

        // Add expense/income triggers
        const openMonthSheet = () => this.openCustomSheet('monthPickerSheet');
        document.getElementById('monthSelectorBtn')?.addEventListener('click', openMonthSheet);
        document.getElementById('txnMonthBtn')?.addEventListener('click', openMonthSheet);

        // Month Item Click
        document.getElementById('monthPickerGrid')?.addEventListener('click', e => {
            const btn = e.target.closest('.month-picker-item');
            if (btn) {
                const month = btn.dataset.month;
                document.querySelectorAll('.month-picker-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const el1 = document.getElementById('currentMonthLabel');
                const el2 = document.getElementById('txnMonthLabel');
                if (el1) el1.textContent = month;
                if (el2) el2.textContent = month;

                this.closeCustomSheets();
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
        document.getElementById('openFilterBtn')?.addEventListener('click', () => this.openFilterSheet());
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

        document.getElementById('applyFilterBtn')?.addEventListener('click', () => {
            this.closeFilterSheet();
            this.renderHistoryTransactions();
        });

        document.getElementById('resetFilterBtn')?.addEventListener('click', () => {
            this.filter = { type: 'all', sort: 'newest', categories: [] };
            document.querySelectorAll('#filterByGroup .pill').forEach((p,i) => p.classList.toggle('active', i===0));
            document.querySelectorAll('#sortByGroup .pill').forEach((p,i) => p.classList.toggle('active', i===2));
            const el = document.getElementById('selectedCatCount');
            if (el) el.textContent = '0 Selected';
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

    // ─── Transaction Detail & Delete Modal ──────────────────────────────────
    async showTransactionDetails(id) {
        this.currentDetailId = id;
        const transactions = await DB.getAllTransactions();
        const t = transactions.find(x => x.id === id);
        if (!t) return;
        
        const sign = t.type === 'income' ? '+' : '-';
        const emoji = this.getCategoryEmoji(t.category, t.type);

        document.getElementById('detailHeroTitle').textContent = t.type === 'income' ? 'Income' : 'Expense';
        document.getElementById('detailHeroSubtitle').textContent = 'Transaction saved';
        
        document.getElementById('detailCatIcon').textContent = emoji;
        document.getElementById('detailCatName').textContent = t.category;
        
        const amountEl = document.getElementById('detailAmount');
        amountEl.textContent = sign + ' ' + Utils.formatCurrency(t.amount);
        amountEl.style.color = t.type === 'income' ? 'var(--primary)' : 'var(--danger)';

        document.getElementById('detailTypeVal').textContent = t.type;
        document.getElementById('detailTypeVal').style.color = t.type === 'income' ? 'var(--primary)' : 'var(--danger)';
        document.getElementById('detailDateVal').textContent = Utils.formatDate(t.date) || t.date;

        const descRow = document.getElementById('detailDescRow');
        if (t.description) {
            document.getElementById('detailDescVal').innerHTML = Utils.escapeHTML(t.description);
            descRow.style.display = 'flex';
        } else {
            descRow.style.display = 'none';
        }

        this.goToPage('transactionDetail');
    },

    showDeleteConfirmModal() {
        document.getElementById('deleteConfirmOverlay')?.classList.add('show');
    },

    hideDeleteConfirmModal() {
        document.getElementById('deleteConfirmOverlay')?.classList.remove('show');
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

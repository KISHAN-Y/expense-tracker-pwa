const UI = {
    chartInstance: null,
    currentPeriod: 'today',
    fabOpen: false,
    activeCategoryType: 'expense',
    currentDetailId: null,

    // Calendar Picker State
    calState: {
        year: 2026,
        month: 6,
        activeTarget: 'expense'
    },

    // Filter state for Transaction page
    filter: {
        type: 'all',
        sort: 'newest',
        categories: []
    },

    // Onboarding state
    onboardingSlide: 0,

    // Story state
    storyIndex: 0,
    storyProgress: 0,
    storyDuration: 5000,
    storyInterval: null,
    editingBudgetId: null,
    budgetDeletingId: null,
    isPaused: false,
    storyData: null,

    // ─── Page Navigation ─────────────────────────────────────────────────────
    goToPage(pageName) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(pageName);
        if (target) target.classList.add('active');

        // Sync bottom nav active state
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        const navBtn = document.querySelector(`.nav-item[data-page="${pageName}"]`);
        if (navBtn) navBtn.classList.add('active');

        // Move nav indicator
        this.updateNavIndicator(pageName);

        // Hide bottom nav + FAB on full-screen tx pages
        const fullScreenPages = ['addIncome', 'addExpense', 'transactionDetail'];
        const isFullScreen = fullScreenPages.includes(pageName);
        const bottomNav = document.querySelector('.bottom-nav');
        const fabRoot = document.getElementById('fabRoot');
        const fabBd = document.getElementById('fabBackdrop');

        if (bottomNav) bottomNav.style.display = isFullScreen ? 'none' : '';
        if (fabRoot) fabRoot.style.display = isFullScreen ? 'none' : '';
        if (isFullScreen && fabBd) fabBd.classList.remove('visible');

        // Close sheets + FAB
        this.closeFab();
        this.closeFilterSheet();
        this.closeCustomSheets();
        this.closeNotificationSheet();

        // Scroll to top
        setTimeout(() => {
            const activePage = document.querySelector('.page.active');
            if (!activePage) return;
            const scrollable = activePage.querySelector(
                '.home-screen, .txn-main, .page-main, .form-container, .tx-bottom-sheet, .profile-screen, .budget-main'
            );
            if (scrollable) scrollable.scrollTop = 0;
        }, 0);

        // Render page-specific content
        if (pageName === 'profile') this.renderProfilePage();
        if (pageName === 'budget') this.renderBudgetPage();

        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(10);
    },

    // ─── Nav Indicator ────────────────────────────────────────────────────────
    updateNavIndicator(pageName) {
        const indicator = document.getElementById('navIndicator');
        if (!indicator) return;

        const navMap = { 'dashboard': 0, 'history': 1, 'budget': 2, 'profile': 3 };
        const idx = navMap[pageName];
        if (idx === undefined) return;

        // Shift by 100% per index. The selector capsule is exactly 1/5th wide.
        indicator.style.transform = `translateX(${idx * 100}%)`;
    },

    // ─── FAB Open / Close ────────────────────────────────────────────────────
    openFab() {
        this.fabOpen = true;
        document.getElementById('fabRoot')?.classList.add('open');
        document.getElementById('navAddBtn')?.classList.add('open');
        document.getElementById('fabBackdrop')?.classList.add('visible');
    },

    closeFab() {
        this.fabOpen = false;
        document.getElementById('fabRoot')?.classList.remove('open');
        document.getElementById('navAddBtn')?.classList.remove('open');
        document.getElementById('fabBackdrop')?.classList.remove('visible');
    },

    // ─── Custom Bottom Sheets ─────────────────────────────────────────────────
    openCustomSheet(sheetId) {
        this.closeCustomSheets();
        document.getElementById('customSheetOverlay')?.classList.add('visible');
        document.getElementById(sheetId)?.classList.add('open');

        const bottomNav = document.querySelector('.bottom-nav');
        const fabRoot = document.getElementById('fabRoot');
        if (bottomNav) bottomNav.style.display = 'none';
        if (fabRoot) fabRoot.style.display = 'none';
    },

    closeCustomSheets() {
        document.getElementById('customSheetOverlay')?.classList.remove('visible');
        document.getElementById('budgetSheetOverlay')?.classList.remove('visible');
        document.querySelectorAll('.custom-sheet').forEach(s => s.classList.remove('open'));

        const activePage = document.querySelector('.page.active');
        const fullScreenPages = ['addIncome', 'addExpense', 'transactionDetail'];
        const isFullScreen = activePage && fullScreenPages.includes(activePage.id);

        if (!isFullScreen) {
            const bottomNav = document.querySelector('.bottom-nav');
            const fabRoot = document.getElementById('fabRoot');
            if (bottomNav) bottomNav.style.display = '';
            if (fabRoot) fabRoot.style.display = '';
        }
    },

    // ─── Budget Actions ──────────────────────────────────────────────────────
    async deleteBudget(id) {
        this.budgetDeletingId = id;
        document.getElementById('budgetDeleteConfirmOverlay')?.classList.add('show');
    },

    async editBudget(id, category, limit) {
        this.editingBudgetId = id;
        const sheetTitle = document.querySelector('#createBudgetSheet .sheet-title');
        if (sheetTitle) sheetTitle.textContent = 'Edit Budget';
        
        document.getElementById('budgetCategoryInput').value = category;
        const emoji = this.getCategoryEmoji(category, 'expense');
        document.getElementById('budgetCategoryText').innerHTML = `<span>${emoji}</span> <span>${category}</span>`;
        document.getElementById('budgetCategoryTrigger')?.classList.add('has-value');
        
        document.getElementById('budgetAmountInput').value = limit;
        
        document.getElementById('budgetSheetOverlay')?.classList.add('visible');
        document.getElementById('createBudgetSheet')?.classList.add('open');
        const bottomNav = document.querySelector('.bottom-nav');
        const fabRoot = document.getElementById('fabRoot');
        if (bottomNav) bottomNav.style.display = 'none';
        if (fabRoot) fabRoot.style.display = 'none';
    },

    // ─── Financial Story Report ──────────────────────────────────────────────
    generateStoryData(transactions, budgets, monthYear) {
        const QUOTES = {
            caution: [
                { text: "Beware of little expenses; a small leak will sink a great ship.", author: "Benjamin Franklin" },
                { text: "Do not save what is left after spending, but spend what is left after saving.", author: "Warren Buffett" },
                { text: "He who buys what he does not need steals from himself.", author: "Swedish Proverb" }
            ],
            growth: [
                { text: "It's not how much money you make, but how much money you keep.", author: "Robert Kiyosaki" },
                { text: "Rich people acquire assets. The poor acquire liabilities they think are assets.", author: "Robert Kiyosaki" },
                { text: "Never depend on a single income. Make investment to create a second source.", author: "Warren Buffett" }
            ],
            fallback: [
                { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
                { text: "The safest way to double your money is to fold it over once and put it in your pocket.", author: "Kin Hubbard" },
                { text: "Money is a master but a servant. Choose to make it your servant.", author: "P.T. Barnum" }
            ]
        };

        // 1. Calculate budgets status
        const expenseTx = transactions.filter(t => t.type === 'expense' && t.date && t.date.startsWith(monthYear));
        const spendByCategory = {};
        expenseTx.forEach(t => {
            if (!spendByCategory[t.category]) spendByCategory[t.category] = 0;
            spendByCategory[t.category] += parseFloat(t.amount);
        });

        let overLimitCount = 0;
        const exceededList = [];
        budgets.forEach(b => {
            const spent = spendByCategory[b.category] || 0;
            const limit = parseFloat(b.limit);
            if (spent > limit) {
                overLimitCount++;
                exceededList.push(b.category);
            }
        });

        // 2. Slide 2: Expenses & biggest spend
        let totalSpend = 0;
        let biggestSpendCat = '';
        let maxSpend = 0;
        expenseTx.forEach(t => {
            const amt = parseFloat(t.amount);
            totalSpend += amt;
            if (spendByCategory[t.category] > maxSpend) {
                maxSpend = spendByCategory[t.category];
                biggestSpendCat = t.category;
            }
        });

        // 3. Slide 3: Earnings & biggest income
        const incomeTx = transactions.filter(t => t.type === 'income' && t.date && t.date.startsWith(monthYear));
        const earnByCategory = {};
        let totalEarned = 0;
        let biggestEarnCat = '';
        let maxEarn = 0;
        incomeTx.forEach(t => {
            const amt = parseFloat(t.amount);
            totalEarned += amt;
            if (!earnByCategory[t.category]) earnByCategory[t.category] = 0;
            earnByCategory[t.category] += amt;
            if (earnByCategory[t.category] > maxEarn) {
                maxEarn = earnByCategory[t.category];
                biggestEarnCat = t.category;
            }
        });

        // 4. Slide 4: Quotes
        const netSavings = totalEarned - totalSpend;
        let quotePool = QUOTES.fallback;
        if (overLimitCount > 0) {
            quotePool = QUOTES.caution;
        } else if (netSavings > totalEarned * 0.3 && totalEarned > 0) {
            quotePool = QUOTES.growth;
        }
        const quote = quotePool[Math.floor(Math.random() * quotePool.length)];

        return {
            budgetStatus: { overLimitCount, totalBudgetsCount: budgets.length, exceededList },
            expenseSummary: { totalSpend, biggestSpendCategory: biggestSpendCat, biggestSpendAmount: maxSpend },
            incomeSummary: { totalIncome: totalEarned, biggestIncomeCategory: biggestEarnCat, biggestIncomeAmount: maxEarn },
            quote
        };
    },

    async openStory() {
        const now = new Date();
        const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const budgets = await DB.getBudgetsByMonth(monthYear);
        const allBudgets = budgets.length > 0 ? budgets : await DB.getAllBudgets();
        const transactions = await DB.getAllTransactions();

        // Precompute everything
        this.storyData = this.generateStoryData(transactions, allBudgets, monthYear);

        // Slide 1 Content
        const exceedText = document.getElementById('storyExceedText');
        const exceedPills = document.getElementById('storyExceedPills');
        const sData = this.storyData;

        if (exceedText) {
            exceedText.textContent = sData.budgetStatus.overLimitCount > 0 
                ? `${sData.budgetStatus.overLimitCount} of ${sData.budgetStatus.totalBudgetsCount} Budget is exceeds the limit`
                : "You're within budget on all categories 🎉";
        }
        if (exceedPills) {
            exceedPills.innerHTML = sData.budgetStatus.exceededList.map(cat => {
                const emoji = this.getCategoryEmoji(cat, 'expense');
                return `<div class="story-pill"><span class="story-pill-emoji">${emoji}</span><span>${cat}</span></div>`;
            }).join('');
        }

        // Slide 2 Content
        document.getElementById('storySpendText').textContent = Utils.formatCurrency(sData.expenseSummary.totalSpend);
        if (sData.expenseSummary.biggestSpendCategory) {
            document.getElementById('storySpendCard').style.display = 'flex';
            document.getElementById('storySpendIcon').textContent = this.getCategoryEmoji(sData.expenseSummary.biggestSpendCategory, 'expense');
            document.getElementById('storySpendCategory').textContent = sData.expenseSummary.biggestSpendCategory;
            document.getElementById('storySpendAmount').textContent = Utils.formatCurrency(sData.expenseSummary.biggestSpendAmount);
        } else {
            document.getElementById('storySpendCard').style.display = 'none';
        }

        // Slide 3 Content
        document.getElementById('storyEarnText').textContent = Utils.formatCurrency(sData.incomeSummary.totalIncome);
        if (sData.incomeSummary.biggestIncomeCategory) {
            document.getElementById('storyEarnCard').style.display = 'flex';
            document.getElementById('storyEarnIcon').textContent = this.getCategoryEmoji(sData.incomeSummary.biggestIncomeCategory, 'income');
            document.getElementById('storyEarnCategory').textContent = sData.incomeSummary.biggestIncomeCategory;
            document.getElementById('storyEarnAmount').textContent = Utils.formatCurrency(sData.incomeSummary.biggestIncomeAmount);
        } else {
            document.getElementById('storyEarnCard').style.display = 'none';
        }

        // Slide 4 Content
        document.getElementById('storyQuoteText').textContent = `"${sData.quote.text}"`;
        document.getElementById('storyQuoteAuthor').textContent = `-${sData.quote.author}`;

        // Initialize Indicators
        const indicatorsContainer = document.getElementById('storyIndicators');
        if (indicatorsContainer) {
            indicatorsContainer.innerHTML = Array.from({ length: 4 }).map((_, idx) => `
                <div class="story-indicator-bar">
                    <div class="story-indicator-progress" id="storyProgress${idx}"></div>
                </div>
            `).join('');
        }

        // Display overlay
        document.getElementById('storyOverlay')?.classList.add('visible');

        // Start Slide Show
        this.storyIndex = 0;
        this.isPaused = false;
        this.startStoryTimer();
    },

    startStoryTimer() {
        clearInterval(this.storyInterval);
        this.storyProgress = 0;

        // Reset slide active states
        const slides = document.querySelectorAll('.story-slide');
        slides.forEach((slide, idx) => {
            slide.classList.toggle('active', idx === this.storyIndex);
        });

        // Set indicator progress for past and future slides
        for (let i = 0; i < 4; i++) {
            const progBar = document.getElementById(`storyProgress${i}`);
            if (progBar) {
                if (i < this.storyIndex) progBar.style.width = '100%';
                else if (i > this.storyIndex) progBar.style.width = '0%';
            }
        }

        // Fill current progress bar
        const tick = 40; // milliseconds
        this.storyInterval = setInterval(() => {
            if (this.isPaused) return; // Freeze if user holds tap
            this.storyProgress += (tick / this.storyDuration) * 100;
            const currentProg = document.getElementById(`storyProgress${this.storyIndex}`);
            if (currentProg) {
                currentProg.style.width = `${Math.min(this.storyProgress, 100)}%`;
            }

            if (this.storyProgress >= 100) {
                this.nextStorySlide();
            }
        }, tick);
    },

    nextStorySlide() {
        if (this.storyIndex < 3) {
            this.storyIndex++;
            this.startStoryTimer();
        } else {
            this.closeStory();
        }
    },

    prevStorySlide() {
        if (this.storyIndex > 0) {
            this.storyIndex--;
            this.startStoryTimer();
        } else {
            this.startStoryTimer(); // Restart current progress on Slide 1 (no-op)
        }
    },

    closeStory() {
        clearInterval(this.storyInterval);
        document.getElementById('storyOverlay')?.classList.remove('visible');
    },

    // ─── Category Picker ─────────────────────────────────────────────────────
    openCategoryPicker(type) {
        this.activeCategoryType = type;
        const sheetTitle = document.getElementById('categoryPickerSheetTitle');
        if (sheetTitle) sheetTitle.textContent = `${type === 'income' ? 'Income' : 'Expense'} Category`;

        const categories = type === 'income' ? CONFIG.INCOME_CATEGORIES : CONFIG.EXPENSE_CATEGORIES;
        const currentVal = document.getElementById(`${type}Category`)?.value;
        const container = document.getElementById('categoryPickerList');

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
        if (trigger && text) { text.textContent = 'Category'; trigger.classList.remove('has-value'); }
    },

    // ─── Calendar Picker ─────────────────────────────────────────────────────
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
        const gridEl = document.getElementById('calDaysGrid');
        if (!gridEl) return;

        const date = new Date(year, month, 1);
        const monthName = date.toLocaleString('en-US', { month: 'long' });
        if (titleEl) titleEl.textContent = `${monthName}, ${year}`;

        const firstDay = new Date(year, month, 1).getDay();
        const startOffset = (firstDay + 6) % 7;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevMonthDays = new Date(year, month, 0).getDate();
        const currentVal = document.getElementById(`${this.calState.activeTarget}Date`)?.value;

        let html = '';
        for (let i = startOffset - 1; i >= 0; i--) {
            html += `<div class="cal-day-cell other-month">${prevMonthDays - i}</div>`;
        }

        const todayStr = Utils.getTodayDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const monthStr = String(month + 1).padStart(2, '0');
            const dayStr = String(day).padStart(2, '0');
            const dateISO = `${year}-${monthStr}-${dayStr}`;
            const isToday = dateISO === todayStr ? 'today' : '';
            const isSelected = dateISO === currentVal ? 'selected' : '';
            html += `<div class="cal-day-cell ${isToday} ${isSelected}" data-date="${dateISO}">${day}</div>`;
        }

        gridEl.innerHTML = html;
    },

    selectCalendarDate(dateISO) {
        const target = this.calState.activeTarget;
        const input = document.getElementById(`${target}Date`);
        const trigger = document.getElementById(`${target}DateTrigger`);
        const text = document.getElementById(`${target}DateText`);

        if (input) input.value = dateISO;
        if (trigger && text) {
            text.innerHTML = `<span>${Utils.formatDate(dateISO)}</span>`;
            trigger.classList.add('has-value');
        }

        this.closeCustomSheets();
    },

    resetDateTrigger(type) {
        const today = Utils.getTodayDate();
        const input = document.getElementById(`${type}Date`);
        const trigger = document.getElementById(`${type}DateTrigger`);
        const text = document.getElementById(`${type}DateText`);
        if (input) input.value = today;
        if (trigger && text) {
            text.innerHTML = `<span>${Utils.formatDate(today)}</span>`;
            trigger.classList.add('has-value');
        }
    },

    // ─── Filter Sheet ────────────────────────────────────────────────────────
    openFilterSheet() {
        document.getElementById('filterSheet')?.classList.add('open');
        document.getElementById('filterOverlay')?.classList.add('visible');
        const bottomNav = document.querySelector('.bottom-nav');
        const fabRoot = document.getElementById('fabRoot');
        if (bottomNav) bottomNav.style.display = 'none';
        if (fabRoot) fabRoot.style.display = 'none';
    },

    closeFilterSheet() {
        document.getElementById('filterSheet')?.classList.remove('open');
        document.getElementById('filterOverlay')?.classList.remove('visible');
        const activePage = document.querySelector('.page.active');
        const fullScreenPages = ['addIncome', 'addExpense', 'transactionDetail'];
        const isFullScreen = activePage && fullScreenPages.includes(activePage.id);
        if (!isFullScreen) {
            const bottomNav = document.querySelector('.bottom-nav');
            const fabRoot = document.getElementById('fabRoot');
            if (bottomNav) bottomNav.style.display = '';
            if (fabRoot) fabRoot.style.display = '';
        }
    },

    // ─── Notification Sheet ──────────────────────────────────────────────────
    openNotificationSheet() {
        document.getElementById('notifSheetOverlay')?.classList.add('visible');
        document.getElementById('notifSheet')?.classList.add('open');
        this.renderNotifications();
    },

    closeNotificationSheet() {
        document.getElementById('notifSheetOverlay')?.classList.remove('visible');
        document.getElementById('notifSheet')?.classList.remove('open');
    },

    async renderNotifications() {
        const container = document.getElementById('notifSheetList');
        if (!container) return;

        const notifications = await DB.getAllNotifications();
        const sorted = notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20);

        if (sorted.length === 0) {
            container.innerHTML = '<div class="notif-empty"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-sub)" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><p>No notifications yet</p></div>';
            return;
        }

        container.innerHTML = sorted.map(n => {
            const timeAgo = this.getTimeAgo(n.createdAt);
            const unread = !n.read ? 'unread' : '';
            return `
            <div class="notif-item ${unread}" data-notif-id="${n.id}">
                <div class="notif-item-icon">${n.icon || '🔔'}</div>
                <div class="notif-item-content">
                    <p class="notif-item-msg">${Utils.escapeHTML(n.message)}</p>
                    <span class="notif-item-time">${timeAgo}</span>
                </div>
            </div>`;
        }).join('');
    },

    async updateNotifBadge() {
        const count = await DB.getUnreadNotificationCount();
        const dot = document.getElementById('notifDot');
        if (dot) dot.classList.toggle('visible', count > 0);
    },

    getTimeAgo(dateStr) {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
    },

    // ─── Category Helpers ────────────────────────────────────────────────────
    getCategoryClass(category, type) {
        const map = { 'Shopping': 'cat-shopping', 'Food': 'cat-food', 'Travel': 'cat-travel', 'Transport': 'cat-travel', 'Subscription': 'cat-subscription', 'Entertainment': 'cat-entertainment', 'Salary': 'cat-salary', 'Business': 'cat-business', 'Freelance': 'cat-freelance', 'Health': 'cat-health', 'Education': 'cat-education', 'Bills': 'cat-bills', 'Utilities': 'cat-bills' };
        return map[category] || (type === 'income' ? 'income' : 'expense');
    },

    getCategoryEmoji(category, type) {
        const map = { 'Shopping': '🛒', 'Food': '🍜', 'Travel': '✈️', 'Transport': '🚗', 'Subscription': '📋', 'Entertainment': '🎮', 'Salary': '💼', 'Business': '💼', 'Freelance': '💻', 'Health': '❤️', 'Education': '📚', 'Bills': '🧾', 'Utilities': '💡', 'Fuel': '⛽', 'Investment': '📈', 'Gift': '🎁', 'Bonus': '🎉' };
        return map[category] || (type === 'income' ? '💰' : '💸');
    },

    formatShortDate(dateStr) { return Utils.formatShortDate(dateStr); },

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

    // ─── Wire amount inputs ──────────────────────────────────────────────────
    setupAmountInputs() {
        if (this._amountInputsSetup) return;
        this._amountInputsSetup = true;
        const symbol = (() => {
            const cur = CONFIG.DEFAULT_CURRENCY;
            return (CONFIG.CURRENCIES[cur] || CONFIG.CURRENCIES.INR || { symbol: '₹' }).symbol;
        })();

        const wire = (inputId, displayId) => {
            const input = document.getElementById(inputId);
            const display = document.getElementById(displayId);
            if (!input || !display) return;
            display.addEventListener('click', () => input.focus());
            input.addEventListener('input', () => {
                let valStr = input.value;
                if (!valStr) { display.textContent = `${symbol}0`; display.style.fontSize = '64px'; return; }
                let formatted;
                if (valStr.endsWith('.')) { const val = parseFloat(valStr); formatted = isNaN(val) ? `${symbol}0.` : `${symbol}${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}.`; }
                else if (valStr.endsWith('.0')) { const val = parseFloat(valStr); formatted = isNaN(val) ? `${symbol}0.0` : `${symbol}${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}.0`; }
                else if (valStr.endsWith('.00')) { const val = parseFloat(valStr); formatted = isNaN(val) ? `${symbol}0.00` : `${symbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
                else { const val = parseFloat(valStr); formatted = isNaN(val) ? `${symbol}0` : `${symbol}${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}`; }
                display.textContent = formatted;
                display.style.fontSize = input.value.length > 8 ? '40px' : input.value.length > 6 ? '50px' : '64px';
            });
        };

        wire('expenseAmount', 'expenseAmountDisplay');
        wire('incomeAmount', 'incomeAmountDisplay');
    },

    // ─── Render Recent Transactions on Dashboard ──────────────────────────────
    async renderRecentTransactions() {
        const container = document.getElementById('recentTransactions');
        const transactions = await DB.getAllTransactions();
        const recent = transactions.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

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

    // ─── Render History ───────────────────────────────────────────────────────
    async renderHistoryTransactions() {
        const container = document.getElementById('historyTransactions');
        const allTransactions = await DB.getAllTransactions();

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
        if (this.filter.type !== 'all') transactions = transactions.filter(t => t.type === this.filter.type);
        if (this.filter.categories.length > 0) transactions = transactions.filter(t => this.filter.categories.includes(t.category));

        switch (this.filter.sort) {
            case 'highest': transactions.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)); break;
            case 'lowest': transactions.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount)); break;
            case 'oldest': transactions.sort((a, b) => new Date(a.date) - new Date(b.date)); break;
            default: transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        }

        if (transactions.length === 0) {
            container.innerHTML = '<div class="empty-state"><lottie-player src="https://assets2.lottiefiles.com/packages/lf20_0s6tfbuc.json" background="transparent" speed="1" style="width: 150px; height: 150px; margin: 0 auto;" loop autoplay></lottie-player><p>No transactions found</p></div>';
            return;
        }

        const groups = {};
        transactions.forEach(t => { if (!groups[t.date]) groups[t.date] = []; groups[t.date].push(t); });
        const sortedDates = Object.keys(groups).sort((a, b) => this.filter.sort === 'oldest' ? new Date(a) - new Date(b) : new Date(b) - new Date(a));

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
        const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
        const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
        const balance = totalIncome - totalExpense;

        // Animated counter
        this.animateCounter('currentBalance', balance);
        document.getElementById('totalIncome').textContent = Utils.formatCurrency(totalIncome);
        document.getElementById('totalExpense').textContent = Utils.formatCurrency(totalExpense);

        // Greeting
        const rawName = await DB.getSetting('displayName') || 'User';
        const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        const greeting = this.getGreeting();
        const greetEl = document.getElementById('greetingText');
        if (greetEl) greetEl.textContent = `${greeting}, ${name} 👋`;

        // Update header avatar
        const headerAvatar = document.getElementById('headerAvatarInitial');
        if (headerAvatar) headerAvatar.textContent = name.charAt(0).toUpperCase();

        // Update avatar gradient
        const avatarBtn = document.querySelector('.avatar-btn');
        const gradIdx = await DB.getSetting('avatarGradient') || 0;
        const grad = CONFIG.AVATAR_GRADIENTS[gradIdx] || CONFIG.AVATAR_GRADIENTS[0];
        if (avatarBtn) avatarBtn.style.background = `linear-gradient(135deg, ${grad[0]} 0%, ${grad[1]} 100%)`;

        const monthName = new Date().toLocaleString('en-US', { month: 'long' });
        const monthEl = document.getElementById('currentMonthLabel');
        const txnMonthEl = document.getElementById('txnMonthLabel');
        const budgetMonthEl = document.getElementById('budgetMonthLabel');
        if (monthEl) monthEl.textContent = monthName;
        if (txnMonthEl) txnMonthEl.textContent = monthName;
        if (budgetMonthEl) budgetMonthEl.textContent = monthName;

        await this.renderSpendHeatmap(this.currentPeriod);
        await this.updateNotifBadge();
    },

    getGreeting() {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    },

    animateCounter(elementId, targetValue) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const formatted = Utils.formatCurrency(targetValue);
        el.textContent = formatted;
    },

    // ─── Spend Heatmap ───────────────────────────────────────────────────────
    async renderSpendHeatmap(period = 'today') {
        const container = document.getElementById('spendHeatmap');
        const yearTitleEl = document.getElementById('heatmapYearTitle');
        if (!container) return;

        const transactions = await DB.getAllTransactions();
        if (yearTitleEl) yearTitleEl.textContent = 'Last 7 Days';

        const getLvl = (val, max) => {
            if (!val || val <= 0) return 0;
            if (max <= 0) return 1;
            const ratio = val / max;
            if (ratio < 0.2) return 1;
            if (ratio < 0.45) return 2;
            if (ratio < 0.75) return 3;
            return 4;
        };

        const last7Days = [];
        const dayLabels = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            last7Days.push(`${y}-${m}-${day}`);
            dayLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase());
        }

        const matrixData = new Array(7).fill(0);
        transactions.filter(t => t.type === 'expense').forEach(t => {
            const idx = last7Days.indexOf(t.date);
            if (idx !== -1) matrixData[idx] += parseFloat(t.amount);
        });

        const hasData = matrixData.some(v => v > 0);
        if (!hasData) {
            const sampleMatrix = [15, 45, 0, 128, 60, 190, 64];
            for (let r = 0; r < 7; r++) matrixData[r] = sampleMatrix[r];
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
            html += `<div class="hm-tile lvl-${lvl}" style="display: flex; align-items: center; justify-content: center; font-size: 14px; border-radius: 12px; transition: 0.2s; aspect-ratio: 1;" onclick="Utils.showToast('${tipText}')" title="${tipText}">${labelText}</div>`;
            html += '</div>';
        }

        html += '</div>';
        html += '<div class="hm-month-labels-row" style="grid-template-columns: repeat(7, 1fr);">';
        dayLabels.forEach((dName, idx) => {
            const activeClass = idx === 6 ? 'active' : '';
            html += `<span class="hm-month-col-label ${activeClass}" style="font-size: 11px;">${dName}</span>`;
        });
        html += '</div></div>';
        container.innerHTML = html;
    },

    // ─── Profile Page ────────────────────────────────────────────────────────
    async renderProfilePage() {
        const rawName = await DB.getSetting('displayName') || 'User';
        const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        const gradIdx = await DB.getSetting('avatarGradient') || 0;
        const grad = CONFIG.AVATAR_GRADIENTS[gradIdx] || CONFIG.AVATAR_GRADIENTS[0];
        const memberSince = await DB.getSetting('memberSince') || new Date().getFullYear().toString();

        // Set name
        const nameEl = document.getElementById('profileDisplayName');
        if (nameEl) nameEl.textContent = name;
        const namePreviewEl = document.getElementById('settingsNamePreview');
        if (namePreviewEl) namePreviewEl.textContent = name;

        // Set avatar
        const avatarLarge = document.getElementById('profileAvatarLarge');
        if (avatarLarge) avatarLarge.style.background = `linear-gradient(135deg, ${grad[0]} 0%, ${grad[1]} 100%)`;
        const initialsEl = document.getElementById('profileAvatarInitials');
        if (initialsEl) initialsEl.textContent = name.charAt(0).toUpperCase();

        // Member since
        const sinceEl = document.getElementById('profileMemberSince');
        if (sinceEl) sinceEl.textContent = `Member since ${memberSince}`;

        // Stats
        const transactions = await DB.getAllTransactions();
        const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
        const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
        const netSaved = totalIncome - totalExpense;

        const uniqueDates = new Set(transactions.map(t => t.date));

        document.getElementById('statTotalTx').textContent = transactions.length;
        document.getElementById('statTotalSaved').textContent = Utils.formatCurrency(netSaved);
        document.getElementById('statDaysActive').textContent = uniqueDates.size;

        const exportNameInput = document.getElementById('exportAccountHolderInput');
        if (exportNameInput) {
            exportNameInput.value = await DB.getSetting('displayName') || 'Yadav Kishan Pareshkumar';
        }
    },

    // ─── Budget Page ─────────────────────────────────────────────────────────
    async renderBudgetPage() {
        const now = new Date();
        const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const budgets = await DB.getBudgetsByMonth(monthYear);
        const allBudgets = budgets.length > 0 ? budgets : await DB.getAllBudgets();
        const transactions = await DB.getAllTransactions();

        // Filter transactions to this month
        const monthTransactions = transactions.filter(t => t.date && t.date.startsWith(monthYear) && t.type === 'expense');

        // Calculate spending per category
        const spendByCategory = {};
        monthTransactions.forEach(t => {
            if (!spendByCategory[t.category]) spendByCategory[t.category] = 0;
            spendByCategory[t.category] += parseFloat(t.amount);
        });

        // Overall totals
        let totalBudget = 0;
        let totalSpent = 0;

        const cardsList = document.getElementById('budgetCardsList');
        const ringProgress = document.getElementById('budgetRingProgress');
        const ringSpent = document.getElementById('budgetRingSpent');
        const ringTotal = document.getElementById('budgetRingTotal');
        const ringStatus = document.getElementById('budgetRingStatus');

        if (allBudgets.length === 0) {
            // Show empty state
            if (cardsList) cardsList.innerHTML = `
                <div class="budget-empty-state">
                    <div class="budget-empty-icon">
                        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                    </div>
                    <p class="budget-empty-title">No budgets yet</p>
                    <p class="budget-empty-desc">Create your first budget to start tracking your spending limits</p>
                </div>`;

            if (ringSpent) ringSpent.textContent = this._sym() + '0';
            if (ringTotal) ringTotal.textContent = this._sym() + '0';
            if (ringStatus) { ringStatus.textContent = 'No budgets set yet'; ringStatus.className = 'budget-ring-status'; }
            if (ringProgress) ringProgress.style.strokeDashoffset = '326.73';
            return;
        }

        // Render budget cards
        let cardsHtml = '';
        allBudgets.forEach((b, i) => {
            const spent = spendByCategory[b.category] || 0;
            const limit = parseFloat(b.limit);
            totalBudget += limit;
            totalSpent += spent;
            const remaining = limit - spent;
            const percent = Math.min((spent / limit) * 100, 100);
            const overBudget = spent > limit;
            const progressClass = overBudget ? 'over' : percent > 75 ? 'danger' : percent > 50 ? 'warning' : '';
            const emoji = this.getCategoryEmoji(b.category, 'expense');

            cardsHtml += `
            <div class="budget-card" style="animation-delay: ${i * 0.05}s">
                <div class="budget-card-header">
                    <div class="budget-card-category">
                        <div class="budget-card-emoji">${emoji}</div>
                        <div class="budget-card-meta">
                            <span class="budget-card-name">${b.category}</span>
                            <div class="budget-card-actions">
                                <button class="budget-card-action-btn edit" onclick="event.stopPropagation(); UI.editBudget('${b.id}', '${b.category}', ${limit})" title="Edit Budget">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button class="budget-card-action-btn delete" onclick="event.stopPropagation(); UI.deleteBudget('${b.id}')" title="Delete Budget">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="budget-card-amount-info">
                        <div class="budget-card-remaining ${overBudget ? 'over' : ''}">${overBudget ? 'Over by ' + Utils.formatCurrency(Math.abs(remaining)) : 'Remaining ' + Utils.formatCurrency(remaining)}</div>
                        <div class="budget-card-total">of ${Utils.formatCurrency(limit)}</div>
                    </div>
                </div>
                <div class="budget-progress-bar">
                    <div class="budget-progress-fill ${progressClass}" style="width: ${percent}%"></div>
                </div>
            </div>`;
        });

        if (cardsList) cardsList.innerHTML = cardsHtml;

        // Update ring
        const overallPercent = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
        const circumference = 326.73;
        const offset = circumference - (overallPercent / 100) * circumference;

        if (ringProgress) {
            ringProgress.style.strokeDashoffset = offset.toString();
            ringProgress.classList.remove('warning', 'danger');
            if (totalSpent > totalBudget) ringProgress.classList.add('danger');
            else if (overallPercent > 75) ringProgress.classList.add('warning');
        }

        if (ringSpent) ringSpent.textContent = Utils.formatCurrency(totalSpent);
        if (ringTotal) ringTotal.textContent = Utils.formatCurrency(totalBudget);

        if (ringStatus) {
            const remaining = totalBudget - totalSpent;
            ringStatus.className = 'budget-ring-status';
            if (totalSpent > totalBudget) {
                ringStatus.textContent = `⚠️ Over budget by ${Utils.formatCurrency(Math.abs(remaining))}`;
                ringStatus.classList.add('danger');
            } else if (overallPercent > 75) {
                ringStatus.textContent = `${Utils.formatCurrency(remaining)} remaining`;
                ringStatus.classList.add('warning');
            } else {
                ringStatus.textContent = `${Utils.formatCurrency(remaining)} remaining`;
            }
        }
    },

    // ─── Onboarding ──────────────────────────────────────────────────────────
    async showOnboarding() {
        const overlay = document.getElementById('onboardingOverlay');
        if (overlay) overlay.classList.add('visible');
        this.onboardingSlide = 0;
        this.updateOnboardingSlide();
    },

    async completeOnboarding() {
        // Save name
        const nameInput = document.getElementById('onboardingName');
        if (nameInput && nameInput.value.trim()) {
            await DB.setSetting('displayName', nameInput.value.trim());
        }
        await DB.setSetting('onboardingComplete', true);
        await DB.setSetting('memberSince', new Date().getFullYear().toString());

        const overlay = document.getElementById('onboardingOverlay');
        if (overlay) overlay.classList.remove('visible');

        await this.updateDashboardStats();
        await this.renderRecentTransactions();
    },

    nextOnboardingSlide() {
        if (this.onboardingSlide >= 2) {
            this.completeOnboarding();
            return;
        }
        this.onboardingSlide++;
        this.updateOnboardingSlide();
    },

    updateOnboardingSlide() {
        document.querySelectorAll('.onboarding-slide').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.onboarding-dot').forEach(d => d.classList.remove('active'));

        const slide = document.querySelector(`.onboarding-slide[data-slide="${this.onboardingSlide}"]`);
        const dot = document.querySelector(`.onboarding-dot[data-dot="${this.onboardingSlide}"]`);
        if (slide) slide.classList.add('active');
        if (dot) dot.classList.add('active');

        const nextBtn = document.getElementById('onboardingNext');
        if (nextBtn) nextBtn.innerHTML = this.onboardingSlide === 2 ? 'Get Started <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>' : 'Next <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>';
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
        document.getElementById('navAddBtn')?.addEventListener('click', () => {
            if (this.fabOpen) this.closeFab(); else this.openFab();
        });
        document.getElementById('fabBackdrop')?.addEventListener('click', () => this.closeFab());

        // Custom Sheet Overlay
        document.getElementById('customSheetOverlay')?.addEventListener('click', () => this.closeCustomSheets());
        document.getElementById('closeCategorySheetBtn')?.addEventListener('click', () => this.closeCustomSheets());
        document.getElementById('closeMonthSheetBtn')?.addEventListener('click', () => this.closeCustomSheets());
        document.getElementById('closeCalendarSheetBtn')?.addEventListener('click', () => this.closeCustomSheets());
        document.getElementById('closeCurrencySheetBtn')?.addEventListener('click', () => this.closeCustomSheets());
        document.getElementById('closeEditNameSheetBtn')?.addEventListener('click', () => this.closeCustomSheets());
        document.getElementById('closeAvatarColorSheetBtn')?.addEventListener('click', () => this.closeCustomSheets());
        document.getElementById('closeBudgetSheetBtn')?.addEventListener('click', () => this.closeCustomSheets());

        // Category Triggers
        document.getElementById('expenseCategoryTrigger')?.addEventListener('click', () => this.openCategoryPicker('expense'));
        document.getElementById('incomeCategoryTrigger')?.addEventListener('click', () => this.openCategoryPicker('income'));

        document.getElementById('categoryPickerList')?.addEventListener('click', e => {
            const item = e.target.closest('.category-picker-item');
            if (item) this.selectCategory(item.dataset.category);
        });

        // Custom Date Triggers
        document.getElementById('expenseDateTrigger')?.addEventListener('click', () => this.openCalendarPicker('expense'));
        document.getElementById('incomeDateTrigger')?.addEventListener('click', () => this.openCalendarPicker('income'));

        // Calendar navigation
        document.getElementById('calPrevMonthBtn')?.addEventListener('click', () => {
            this.calState.month--;
            if (this.calState.month < 0) { this.calState.month = 11; this.calState.year--; }
            this.renderCalendarDays();
        });
        document.getElementById('calNextMonthBtn')?.addEventListener('click', () => {
            this.calState.month++;
            if (this.calState.month > 11) { this.calState.month = 0; this.calState.year++; }
            this.renderCalendarDays();
        });

        document.getElementById('calDaysGrid')?.addEventListener('click', e => {
            const cell = e.target.closest('.cal-day-cell:not(.other-month)');
            if (cell && cell.dataset.date) this.selectCalendarDate(cell.dataset.date);
        });

        // Delete Confirmation
        document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => this.hideDeleteConfirmModal());
        document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => {
            this.hideDeleteConfirmModal();
            this.goToPage('dashboard');
            if (this.currentDetailId) APP.deleteTransaction(this.currentDetailId);
        });

        document.getElementById('detailDeleteBtn')?.addEventListener('click', () => this.showDeleteConfirmModal());
        document.getElementById('detailEditBtn')?.addEventListener('click', () => {
            if (this.currentDetailId) APP.editTransaction(this.currentDetailId);
        });

        document.getElementById('backFromDetailBtn')?.addEventListener('click', () => this.goToPage('dashboard'));

        // Month picker
        const openMonthSheet = () => this.openCustomSheet('monthPickerSheet');
        document.getElementById('monthSelectorBtn')?.addEventListener('click', openMonthSheet);
        document.getElementById('txnMonthBtn')?.addEventListener('click', openMonthSheet);
        document.getElementById('budgetMonthBtn')?.addEventListener('click', openMonthSheet);

        document.getElementById('monthPickerGrid')?.addEventListener('click', e => {
            const btn = e.target.closest('.month-picker-item');
            if (btn) {
                const month = btn.dataset.month;
                document.querySelectorAll('.month-picker-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                ['currentMonthLabel', 'txnMonthLabel', 'budgetMonthLabel'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = month;
                });
                this.closeCustomSheets();
            }
        });

        // Currency
        document.getElementById('currencySettingBtn')?.addEventListener('click', () => this.openCustomSheet('currencyPickerSheet'));

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

        // Mini buttons
        document.getElementById('openIncomePage')?.addEventListener('click', () => {
            this.closeFab();
            this.resetCategoryTrigger('income');
            this.resetDateTrigger('income');
            this.setupAmountInputs();
            document.getElementById('incomeAmount').value = '';
            document.getElementById('incomeAmountDisplay').textContent = `${this._sym()}0`;
            document.getElementById('incomeAmountDisplay').style.fontSize = '64px';
            document.getElementById('incomeDescription').value = '';
            APP.editingTransactionId = null;
            this.goToPage('addIncome');
        });

        document.getElementById('openExpensePage')?.addEventListener('click', () => {
            this.closeFab();
            this.resetCategoryTrigger('expense');
            this.resetDateTrigger('expense');
            this.setupAmountInputs();
            document.getElementById('expenseAmount').value = '';
            document.getElementById('expenseAmountDisplay').textContent = `${this._sym()}0`;
            document.getElementById('expenseAmountDisplay').style.fontSize = '64px';
            document.getElementById('expenseDescription').value = '';
            APP.editingTransactionId = null;
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

        // Notifications
        document.getElementById('notifBtn')?.addEventListener('click', () => this.openNotificationSheet());
        document.getElementById('notifSheetOverlay')?.addEventListener('click', () => this.closeNotificationSheet());
        document.getElementById('markAllReadBtn')?.addEventListener('click', async () => {
            await DB.markAllNotificationsRead();
            await this.renderNotifications();
            await this.updateNotifBadge();
            Utils.showToast('All notifications marked as read');
        });

        // Period tabs
        document.querySelectorAll('.period-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.period-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentPeriod = tab.dataset.period;
                this.renderSpendHeatmap(this.currentPeriod);
            });
        });

        // Filters
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
            document.querySelectorAll('#filterByGroup .pill').forEach((p, i) => p.classList.toggle('active', i === 0));
            document.querySelectorAll('#sortByGroup .pill').forEach((p, i) => p.classList.toggle('active', i === 2));
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

        // Export PDF Reconciled Statement
        document.getElementById('exportPdfBtn')?.addEventListener('click', async () => {
            const range = document.getElementById('exportRangeSelect')?.value || 'month';
            const inputName = document.getElementById('exportAccountHolderInput')?.value?.trim();
            
            let displayName = inputName || 'Yadav Kishan Pareshkumar';
            
            // Persist the name if changed by the user
            if (inputName) {
                await DB.setSetting('displayName', inputName);
                displayName = inputName;
                // Refresh profile and greetings
                await this.renderProfilePage();
                await this.updateDashboardStats();
            }

            const lastReconciledDate = await DB.getSetting('lastReconciledDate');
            const transactions = await DB.getAllTransactions();

            let filteredTx = [];
            let rangeLabel = 'All Time';

            if (range === 'month') {
                const now = new Date();
                const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                filteredTx = transactions.filter(t => t.date && t.date.startsWith(monthYear));
                rangeLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
            } else {
                filteredTx = transactions;
            }

            Utils.exportToPDF(filteredTx, displayName, rangeLabel, lastReconciledDate);
        });

        // Test notification
        document.getElementById('testNotifBtn')?.addEventListener('click', async () => {
            await Utils.triggerSystemNotification('Expense Tracker 💰', 'Reminder: Time to log your recent income & expenses!');
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
                installBtn.style.display = 'flex';
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

        // ─── Profile Settings ────────────────────────────────────────────────
        // Edit Name
        document.getElementById('editNameBtn')?.addEventListener('click', () => {
            const input = document.getElementById('editNameInput');
            if (input) input.value = document.getElementById('profileDisplayName')?.textContent || '';
            this.openCustomSheet('editNameSheet');
        });

        document.getElementById('saveNameBtn')?.addEventListener('click', async () => {
            const input = document.getElementById('editNameInput');
            const name = input?.value?.trim();
            if (name) {
                await DB.setSetting('displayName', name);
                await this.renderProfilePage();
                await this.updateDashboardStats();
                this.closeCustomSheets();
                Utils.showToast('Name updated!');
            }
        });

        // Avatar Color
        document.getElementById('profileAvatarEditBtn')?.addEventListener('click', () => {
            this.renderAvatarColorPicker();
            this.openCustomSheet('avatarColorSheet');
        });

        // ─── Budget ──────────────────────────────────────────────────────────
        document.getElementById('createBudgetBtn')?.addEventListener('click', () => {
            this.editingBudgetId = null;
            const sheetTitle = document.querySelector('#createBudgetSheet .sheet-title');
            if (sheetTitle) sheetTitle.textContent = 'Create Budget';
            document.getElementById('budgetCategoryInput').value = '';
            document.getElementById('budgetCategoryText').textContent = 'Select Category';
            document.getElementById('budgetAmountInput').value = '';
            document.getElementById('budgetSheetOverlay')?.classList.add('visible');
            document.getElementById('createBudgetSheet')?.classList.add('open');
            const bottomNav = document.querySelector('.bottom-nav');
            const fabRoot = document.getElementById('fabRoot');
            if (bottomNav) bottomNav.style.display = 'none';
            if (fabRoot) fabRoot.style.display = 'none';
        });

        document.getElementById('budgetSheetOverlay')?.addEventListener('click', () => this.closeCustomSheets());

        document.getElementById('budgetCategoryTrigger')?.addEventListener('click', () => {
            this.activeCategoryType = 'budgetCategory';
            const categories = CONFIG.EXPENSE_CATEGORIES;
            const currentVal = document.getElementById('budgetCategoryInput')?.value;
            const container = document.getElementById('categoryPickerList');
            if (container) {
                container.innerHTML = categories.map(cat => {
                    const emoji = this.getCategoryEmoji(cat, 'expense');
                    const isActive = cat === currentVal ? 'active' : '';
                    return `<button class="category-picker-item ${isActive}" data-category="${cat}"><span class="category-picker-icon">${emoji}</span><span>${cat}</span></button>`;
                }).join('');
            }
            const sheetTitle = document.getElementById('categoryPickerSheetTitle');
            if (sheetTitle) sheetTitle.textContent = 'Budget Category';
            this.openCustomSheet('categoryPickerSheet');
        });

        document.getElementById('saveBudgetBtn')?.addEventListener('click', async () => {
            const category = document.getElementById('budgetCategoryInput')?.value;
            const amount = parseFloat(document.getElementById('budgetAmountInput')?.value);
            if (!category) { Utils.showToast('Please select a category'); return; }
            if (!amount || amount <= 0) { Utils.showToast('Please enter a valid amount'); return; }

            const now = new Date();
            const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            if (this.editingBudgetId) {
                await DB.updateBudget({ id: this.editingBudgetId, category, limit: amount.toString(), monthYear, month: now.getMonth(), year: now.getFullYear() });
                this.editingBudgetId = null;
                Utils.showToast('Budget updated!');
            } else {
                await DB.addBudget({ category, limit: amount.toString(), monthYear, month: now.getMonth(), year: now.getFullYear() });
                Utils.showToast('Budget created!');
                await DB.addNotification({ icon: '📊', message: `Budget of ${Utils.formatCurrency(amount)} set for ${category}` });
                await this.updateNotifBadge();
            }

            this.closeCustomSheets();
            await this.renderBudgetPage();
        });

        // Report Story triggers
        document.getElementById('reportBannerBtn')?.addEventListener('click', () => this.openStory());
        document.getElementById('dashboardReportBannerBtn')?.addEventListener('click', () => this.openStory());
        document.getElementById('storyCloseBtn')?.addEventListener('click', () => this.closeStory());
        document.getElementById('storyTapLeft')?.addEventListener('click', () => this.prevStorySlide());
        document.getElementById('storyTapRight')?.addEventListener('click', () => this.nextStorySlide());

        // Report Story Interactive behaviors (pause on hold, resume on release, swipe down to close)
        const handlePause = () => { this.isPaused = true; };
        const handleResume = () => { this.isPaused = false; };
        const slidesContainer = document.getElementById('storySlidesContainer');
        if (slidesContainer) {
            slidesContainer.addEventListener('mousedown', handlePause);
            slidesContainer.addEventListener('touchstart', handlePause, { passive: true });
            slidesContainer.addEventListener('mouseup', handleResume);
            slidesContainer.addEventListener('touchend', handleResume, { passive: true });
            slidesContainer.addEventListener('mouseleave', handleResume);
        }

        let storyStartY = 0;
        const storyOverlay = document.getElementById('storyOverlay');
        storyOverlay?.addEventListener('touchstart', e => {
            storyStartY = e.touches[0].clientY;
        }, { passive: true });
        storyOverlay?.addEventListener('touchmove', e => {
            const deltaY = e.touches[0].clientY - storyStartY;
            if (deltaY > 80) {
                this.closeStory();
            }
        }, { passive: true });

        // Redirection CTA
        document.getElementById('storyCtaBtn')?.addEventListener('click', () => {
            this.closeStory();
            this.goToPage('history');
            this.renderHistoryTransactions();
        });

        // Budget Delete Confirmation
        document.getElementById('cancelBudgetDeleteBtn')?.addEventListener('click', () => {
            document.getElementById('budgetDeleteConfirmOverlay')?.classList.remove('show');
        });
        document.getElementById('confirmBudgetDeleteBtn')?.addEventListener('click', async () => {
            document.getElementById('budgetDeleteConfirmOverlay')?.classList.remove('show');
            if (this.budgetDeletingId) {
                await DB.deleteBudget(this.budgetDeletingId);
                Utils.showToast('Budget deleted');
                await this.renderBudgetPage();
                this.budgetDeletingId = null;
            }
        });

        // ─── Onboarding ──────────────────────────────────────────────────────
        document.getElementById('onboardingNext')?.addEventListener('click', () => this.nextOnboardingSlide());
        document.getElementById('onboardingSkip')?.addEventListener('click', () => this.completeOnboarding());

        document.getElementById('onboardingEnableNotif')?.addEventListener('click', async () => {
            if ('Notification' in window) {
                const perm = await Notification.requestPermission();
                const btn = document.getElementById('onboardingEnableNotif');
                if (perm === 'granted') {
                    if (btn) { btn.innerHTML = '✅ Notifications Enabled'; btn.classList.add('enabled'); }
                    Utils.showToast('Notifications enabled!');
                } else {
                    Utils.showToast('Notification permission denied');
                }
            }
        });
    },

    // ─── Transaction Detail ──────────────────────────────────────────────────
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

    // ─── Avatar Color Picker ─────────────────────────────────────────────────
    async renderAvatarColorPicker() {
        const grid = document.getElementById('avatarColorGrid');
        if (!grid) return;
        const currentIdx = await DB.getSetting('avatarGradient') || 0;

        grid.innerHTML = CONFIG.AVATAR_GRADIENTS.map((grad, i) => `
            <button class="avatar-color-option ${i === currentIdx ? 'active' : ''}" data-gradient="${i}" style="background: linear-gradient(135deg, ${grad[0]} 0%, ${grad[1]} 100%);">
                <span class="color-check">✓</span>
            </button>
        `).join('');

        grid.addEventListener('click', async e => {
            const btn = e.target.closest('.avatar-color-option');
            if (!btn) return;
            const idx = parseInt(btn.dataset.gradient);
            await DB.setSetting('avatarGradient', idx);
            grid.querySelectorAll('.avatar-color-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            await this.renderProfilePage();
            await this.updateDashboardStats();
            this.closeCustomSheets();
            Utils.showToast('Avatar color updated!');
        });
    },

    // ─── Category select override for budget ─────────────────────────────────
    handleCategorySelection(category) {
        if (this.activeCategoryType === 'budgetCategory') {
            const input = document.getElementById('budgetCategoryInput');
            const text = document.getElementById('budgetCategoryText');
            if (input) input.value = category;
            if (text) {
                const emoji = this.getCategoryEmoji(category, 'expense');
                text.innerHTML = `<span>${emoji}</span> <span>${category}</span>`;
            }
            document.getElementById('budgetCategoryTrigger')?.classList.add('has-value');
            this.closeCustomSheets();
            // Reopen budget sheet
            setTimeout(() => {
                document.getElementById('budgetSheetOverlay')?.classList.add('visible');
                document.getElementById('createBudgetSheet')?.classList.add('open');
                const bottomNav = document.querySelector('.bottom-nav');
                const fabRoot = document.getElementById('fabRoot');
                if (bottomNav) bottomNav.style.display = 'none';
                if (fabRoot) fabRoot.style.display = 'none';
            }, 100);
        } else {
            this.selectCategory(category);
        }
    },

    // ─── Helpers ─────────────────────────────────────────────────────────────
    _sym() {
        const cur = CONFIG.DEFAULT_CURRENCY;
        return (CONFIG.CURRENCIES?.[cur] || CONFIG.CURRENCIES?.USD || { symbol: '$' }).symbol;
    },

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

    // Compatibility stubs
    populateCategorySelects() {},
    initializeTransactionForm() {},
    updateOfflineStatus() { if (!Utils.isOnline()) Utils.showToast('You are offline'); },
    updateSyncStatus(synced, pendingCount) { if (pendingCount > 0 && Utils.isOnline()) Utils.showToast(`${pendingCount} item(s) pending sync`); },
    async handleSyncClick() {
        try { await API.syncQueue(); Utils.showToast('✓ All changes synced!'); await APP.loadData(); }
        catch { Utils.showToast('Sync failed. Check your connection.'); }
    }
};

window.UI = UI;

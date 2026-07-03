// Utility Functions
const Utils = {
    // Format currency — uses the currency stored in settings (or falls back to default)
    formatCurrency(amount, currency) {
        const cur = currency || CONFIG.DEFAULT_CURRENCY;
        const currencyInfo = CONFIG.CURRENCIES[cur] || CONFIG.CURRENCIES[CONFIG.DEFAULT_CURRENCY];
        const num = Number(amount) || 0;
        return `${currencyInfo.symbol}${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    },

    // Robust date parser that handles ISO, YYYY-MM-DD, DD-MM-YYYY, timestamps, Date objects
    parseDate(dateVal) {
        if (!dateVal) return new Date();
        if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? new Date() : dateVal;

        const str = String(dateVal).trim();
        if (!str || str === 'Invalid Date' || str === 'undefined' || str === 'null') return new Date();

        // 1. Try ISO / standard JS Date constructor
        const d1 = new Date(str);
        if (!isNaN(d1.getTime())) return d1;

        // 2. Try timestamp number
        if (!isNaN(str)) {
            const d2 = new Date(Number(str));
            if (!isNaN(d2.getTime())) return d2;
        }

        // 3. Try YYYY-MM-DD or DD-MM-YYYY or YYYY/MM/DD
        const parts = str.split(/[-/.]/);
        if (parts.length >= 3) {
            let y, m, d;
            if (parts[0].length === 4) { // YYYY-MM-DD
                y = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10) - 1;
                d = parseInt(parts[2], 10);
            } else if (parts[2].length === 4) { // DD-MM-YYYY
                d = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10) - 1;
                y = parseInt(parts[2], 10);
            } else {
                d = parseInt(parts[0], 10);
                m = parseInt(parts[1], 10) - 1;
                y = parseInt(parts[2], 10);
            }
            if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                const d3 = new Date(y, m, d);
                if (!isNaN(d3.getTime())) return d3;
            }
        }

        return new Date();
    },

    // Format date  e.g. "Jul 3, 2026"
    formatDate(dateStr) {
        const d = this.parseDate(dateStr);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    },

    // Format short date e.g. "Jul 3"
    formatShortDate(dateStr) {
        const d = this.parseDate(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },

    // Format time
    formatTime(date) {
        const d = this.parseDate(date);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    },

    // Get today's date in YYYY-MM-DD format
    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    },

    // Show success overlay modal ("Transaction has been successfully added")
    showSuccessModal(duration = 1500) {
        const modal = document.getElementById('successOverlay');
        if (!modal) return Promise.resolve();
        modal.classList.add('show');
        return new Promise(resolve => {
            setTimeout(() => {
                modal.classList.remove('show');
                resolve();
            }, duration);
        });
    },

    // Show toast notification — auto dismisses after `duration` ms (default 1s)
    showToast(message, duration = 1000) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        // Clear any existing timer so rapid calls reset properly
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => toast.classList.remove('show'), duration);
    },

    // Show / hide loading indicator
    showLoading(show = true) {
        const loader = document.getElementById('loadingIndicator');
        if (!loader) return;
        loader.classList.toggle('show', show);
    },

    // Validate email
    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    // Validate amount
    validateAmount(amount) {
        return !isNaN(amount) && amount > 0;
    },

    // Get category emoji icon
    getCategoryIcon(category, type) {
        const icons = {
            expense: {
                'Food': '🍜', 'Travel': '✈️', 'Fuel': '⛽',
                'Shopping': '🛒', 'Entertainment': '🎮', 'Bills': '🧾',
                'Health': '❤️', 'Education': '📚', 'Investment': '💼',
                'Subscription': '📋', 'Transport': '🚗', 'Utilities': '💡',
                'Other': '📦'
            },
            income: {
                'Salary': '💼', 'Freelance': '💻', 'Business': '🏢',
                'Investment': '📈', 'Gift': '🎁', 'Bonus': '🎉',
                'Other': '💰'
            }
        };
        return icons[type]?.[category] || (type === 'income' ? '💰' : '💸');
    },

    // Generate unique ID
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    // Debounce
    debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    // Throttle
    throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Export to CSV
    exportToCSV(transactions, filename = 'transactions.csv') {
        let csv = 'Date,Type,Category,Amount,Description\n';
        transactions.forEach(t => {
            csv += `"${t.date}","${t.type}","${t.category}","${t.amount}","${t.description || ''}"\n`;
        });
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            Utils.showToast('Copied to clipboard!');
            return true;
        } catch {
            return false;
        }
    },

    // Get query parameter
    getQueryParam(param) {
        return new URLSearchParams(window.location.search).get(param);
    },

    // Online check
    isOnline() {
        return navigator.onLine;
    },

    // Mobile check
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    // Storage estimate
    async getStorageSize() {
        if (!navigator.storage?.estimate) return null;
        const { usage, quota } = await navigator.storage.estimate();
        return { usage, quota, percentage: (usage / quota) * 100 };
    },

    // Trigger system notification (screen ON or OFF)
    async triggerSystemNotification(title, body) {
        title = title || 'Expense Tracker 💰';
        body = body || 'Time to add your recent income & expenses!';

        if (!('Notification' in window)) {
            this.showToast(body, 2500);
            return;
        }

        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }

        if (Notification.permission === 'granted') {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    title,
                    body
                });
            } else if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                if (reg) {
                    reg.showNotification(title, {
                        body,
                        icon: 'assets/icon-192.svg',
                        badge: 'assets/icon-192.svg',
                        vibrate: [200, 100, 200]
                    });
                }
            } else {
                new Notification(title, { body });
            }
        } else {
            this.showToast(body, 2500);
        }
    },

    // 3-Hour Reminder Scheduler
    init3HourReminder() {
        const THREE_HOURS = 3 * 60 * 60 * 1000;

        const checkAndNotify = () => {
            const lastTime = parseInt(localStorage.getItem('last3HourNotifTime') || '0', 10);
            const now = Date.now();

            if (now - lastTime >= THREE_HOURS) {
                this.triggerSystemNotification(
                    'Expense Tracker 💰',
                    'Time to track your money! Don\'t forget to add your recent income & expenses.'
                );
                localStorage.setItem('last3HourNotifTime', now.toString());
            }
        };

        checkAndNotify();
        setInterval(checkAndNotify, 15 * 60 * 1000);
    }
};


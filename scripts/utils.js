// Utility Functions
const Utils = {
    // Format currency
    formatCurrency(amount, currency = CONFIG.DEFAULT_CURRENCY) {
        const currencyInfo = CONFIG.CURRENCIES[currency] || CONFIG.CURRENCIES.INR;
        return `${currencyInfo.symbol}${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    },

    // Format date
    formatDate(date) {
        const d = new Date(date);
        return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    },

    // Format time
    formatTime(date) {
        const d = new Date(date);
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    },

    // Get today's date in YYYY-MM-DD format
    getTodayDate() {
        const today = new Date();
        return today.toISOString().split('T')[0];
    },

    // Show toast notification
    showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    },

    // Show loading
    showLoading(show = true) {
        const loader = document.getElementById('loadingIndicator');
        if (show) {
            loader.classList.add('show');
        } else {
            loader.classList.remove('show');
        }
    },

    // Validate email
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    // Validate amount
    validateAmount(amount) {
        return !isNaN(amount) && amount > 0;
    },

    // Get category icon
    getCategoryIcon(category, type) {
        const icons = {
            expense: {
                'Food': '🍔',
                'Travel': '🚗',
                'Fuel': '⛽',
                'Shopping': '🛍️',
                'Entertainment': '🎬',
                'Bills': '📄',
                'Health': '🏥',
                'Education': '📚',
                'Investment': '💼',
                'Other': '📦'
            },
            income: {
                'Salary': '💼',
                'Freelance': '💻',
                'Business': '🏢',
                'Investment': '📈',
                'Gift': '🎁',
                'Bonus': '🎉',
                'Other': '💰'
            }
        };
        return icons[type]?.[category] || '💰';
    },

    // Generate unique ID
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
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
            csv += `"${t.date}","${t.type}","${t.category}","${t.amount}","${t.description}"\n`;
        });

        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    },

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            Utils.showToast('Copied to clipboard!');
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            return false;
        }
    },

    // Get query parameter
    getQueryParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    },

    // Is online
    isOnline() {
        return navigator.onLine;
    },

    // Check if device is mobile
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    // Get browser storage size
    async getStorageSize() {
        if (!navigator.storage?.estimate) {
            return null;
        }
        const estimate = await navigator.storage.estimate();
        return {
            usage: estimate.usage,
            quota: estimate.quota,
            percentage: (estimate.usage / estimate.quota) * 100
        };
    }
};

// Configuration
const CONFIG = {
    // ─── API CONFIGURATION ──────────────────────────────────────────────────
    // The URL of your deployed Google Apps Script web app
    API_ENDPOINT: 'https://script.google.com/macros/s/AKfycbx_bNhisNmbSMY_kYFvuZlh9Rz4A0xsYgJrP7Vu7eBi-C670pe5hyXV7E5S-fAkTvZ95Q/exec', // Replace with your Google Apps Script URL
    APP_NAME: 'Expense Tracker',
    VERSION: '2.0.0',
    CACHE_VERSION: 'v6',
    CURRENCIES: {
        INR: { symbol: '₹', name: 'Indian Rupee' },
        USD: { symbol: '$', name: 'US Dollar' },
        EUR: { symbol: '€', name: 'Euro' }
    },
    DEFAULT_CURRENCY: 'INR',
    EXPENSE_CATEGORIES: [
        'Food',
        'Travel',
        'Fuel',
        'Shopping',
        'Entertainment',
        'Bills',
        'Health',
        'Education',
        'Investment',
        'Other'
    ],
    INCOME_CATEGORIES: [
        'Salary',
        'Freelance',
        'Business',
        'Investment',
        'Gift',
        'Bonus',
        'Other'
    ],
    AVATAR_GRADIENTS: [
        ['#C58AF9', '#9B59F5'],
        ['#FF6B6B', '#EE5A24'],
        ['#00B4D8', '#0077B6'],
        ['#00A86B', '#00875A'],
        ['#F59E0B', '#D97706'],
        ['#EC4899', '#BE185D']
    ],
    DB_NAME: 'ExpenseTrackerDB',
    DB_VERSION: 4,
    DEFAULT_USER_ID: 'default',
    DEFAULT_ACCOUNT_ID: '00000000-0000-0000-0000-000000000001',
    STORES: {
        TRANSACTIONS: 'transactions',
        SETTINGS: 'settings',
        SYNC_QUEUE: 'syncQueue',
        BUDGETS: 'budgets',
        NOTIFICATIONS: 'notifications',
        ACCOUNTS: 'accounts'
    }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

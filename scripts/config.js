// Configuration
const CONFIG = {
    APP_NAME: 'Expense Tracker',
    VERSION: '2.0.0',
    CACHE_VERSION: 'v6',
    API_ENDPOINT: 'https://script.google.com/macros/s/AKfycbxn-uU4TgVkT5hNgpd6XTTIJd5xFbvNogyesPDe0CEQVWPfn4tTJCb6FQLEGffvUFRu7Q/exec', // Replace with your Google Apps Script URL
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
    DB_VERSION: 2,
    DEFAULT_USER_ID: 'default',
    STORES: {
        TRANSACTIONS: 'transactions',
        SETTINGS: 'settings',
        SYNC_QUEUE: 'syncQueue',
        BUDGETS: 'budgets',
        NOTIFICATIONS: 'notifications'
    }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

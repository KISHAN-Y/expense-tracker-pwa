// Configuration
const CONFIG = {
    APP_NAME: 'Expense Tracker',
    VERSION: '1.0.0',
    CACHE_VERSION: 'v1',
    API_ENDPOINT: 'https://script.google.com/macros/s/AKfycbxfymw0v77gvsZ3XMhK-5pHERUekAfc-m9JUNuCpeKifJUiz2YiV68aO_vlyD013asEsA/exec', // Replace with your Google Apps Script URL
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
    DB_NAME: 'ExpenseTrackerDB',
    DB_VERSION: 1,
    STORES: {
        TRANSACTIONS: 'transactions',
        SETTINGS: 'settings',
        SYNC_QUEUE: 'syncQueue'
    }
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

# Advanced Features & Customization Guide

## Advanced Features

### 1. Charts & Analytics

Add this script to `scripts/app.js` to enable monthly spending charts:

```javascript
// Initialize charts (requires Chart.js)
async function initializeCharts() {
    // Load Chart.js library
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    document.head.appendChild(script);
    
    script.onload = () => {
        renderMonthlyChart();
    };
}

async function renderMonthlyChart() {
    const transactions = await DB.getAllTransactions();
    const ctx = document.getElementById('monthlyChart');
    
    if (!ctx) return;
    
    // Process data for chart
    const monthlyData = {};
    transactions.forEach(t => {
        const month = t.date.substring(0, 7);
        if (!monthlyData[month]) {
            monthlyData[month] = { income: 0, expense: 0 };
        }
        if (t.type === 'income') {
            monthlyData[month].income += parseFloat(t.amount);
        } else {
            monthlyData[month].expense += parseFloat(t.amount);
        }
    });
    
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(monthlyData),
            datasets: [
                {
                    label: 'Income',
                    data: Object.values(monthlyData).map(d => d.income),
                    borderColor: '#22C55E',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Expense',
                    data: Object.values(monthlyData).map(d => d.expense),
                    borderColor: '#EF4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}
```

### 2. Budget Planning

```javascript
// Set monthly budget
async function setMonthlyBudget(amount) {
    await DB.setSetting('monthlyBudget', amount);
}

// Check budget status
async function checkBudgetStatus() {
    const budget = await DB.getSetting('monthlyBudget');
    const transactions = await DB.getAllTransactions();
    const currentMonth = new Date().toISOString().substring(0, 7);
    
    const monthlyExpense = transactions
        .filter(t => t.type === 'expense' && t.date.startsWith(currentMonth))
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const percentage = (monthlyExpense / budget) * 100;
    
    return {
        budget: budget,
        spent: monthlyExpense,
        remaining: budget - monthlyExpense,
        percentage: percentage
    };
}
```

### 3. Recurring Transactions

```javascript
// Set recurring transaction
async function setRecurringTransaction(transaction, frequency) {
    const recurring = {
        ...transaction,
        recurring: {
            frequency: frequency, // 'daily', 'weekly', 'monthly', 'yearly'
            lastExecuted: new Date().toISOString(),
            active: true
        }
    };
    await DB.setSetting(`recurring_${transaction.id}`, recurring);
}

// Process recurring transactions
async function processRecurringTransactions() {
    const allSettings = await DB.db.transaction(CONFIG.STORES.SETTINGS, 'readonly')
        .objectStore(CONFIG.STORES.SETTINGS)
        .getAll();
    
    for (const setting of allSettings) {
        if (setting.key.startsWith('recurring_')) {
            const recurring = setting.value;
            const lastExecuted = new Date(recurring.lastExecuted);
            const now = new Date();
            
            let shouldExecute = false;
            
            switch (recurring.frequency) {
                case 'daily':
                    shouldExecute = lastExecuted.getDate() !== now.getDate();
                    break;
                case 'weekly':
                    shouldExecute = (now - lastExecuted) >= 7 * 24 * 60 * 60 * 1000;
                    break;
                case 'monthly':
                    shouldExecute = lastExecuted.getMonth() !== now.getMonth();
                    break;
                case 'yearly':
                    shouldExecute = lastExecuted.getFullYear() !== now.getFullYear();
                    break;
            }
            
            if (shouldExecute && recurring.active) {
                await APP.handleFormSubmit({
                    ...recurring,
                    date: Utils.getTodayDate()
                });
                
                recurring.lastExecuted = now.toISOString();
                await DB.setSetting(setting.key, recurring);
            }
        }
    }
}
```

### 4. Push Notifications

```javascript
// Request notification permission
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return false;
    }
    
    if (Notification.permission === 'granted') {
        return true;
    }
    
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    
    return false;
}

// Send notification
function sendNotification(title, options = {}) {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            icon: '/assets/icon-192.png',
            badge: '/assets/icon-96.png',
            ...options
        });
    }
}

// Notify when budget exceeded
async function checkBudgetNotification() {
    const status = await checkBudgetStatus();
    if (status.percentage > 100) {
        sendNotification('Budget Alert!', {
            body: `You've exceeded your monthly budget by ₹${Math.abs(status.remaining).toFixed(2)}`
        });
    } else if (status.percentage > 80) {
        sendNotification('Budget Warning', {
            body: `You've used ${status.percentage.toFixed(0)}% of your monthly budget`
        });
    }
}
```

### 5. Data Export & Import

```javascript
// Export all data as JSON
async function exportDataAsJSON() {
    const transactions = await DB.getAllTransactions();
    const settings = {};
    
    const allSettings = await DB.db.transaction(CONFIG.STORES.SETTINGS, 'readonly')
        .objectStore(CONFIG.STORES.SETTINGS)
        .getAll();
    
    allSettings.forEach(s => {
        settings[s.key] = s.value;
    });
    
    const data = {
        exportDate: new Date().toISOString(),
        appVersion: CONFIG.VERSION,
        transactions,
        settings
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expense-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

// Import data from JSON
async function importDataFromJSON(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Clear existing data
                await DB.clearAll();
                
                // Import transactions
                for (const transaction of data.transactions) {
                    await DB.addTransaction(transaction);
                }
                
                // Import settings
                for (const [key, value] of Object.entries(data.settings)) {
                    await DB.setSetting(key, value);
                }
                
                Utils.showToast('Data imported successfully');
                await APP.loadData();
                resolve(true);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}
```

### 6. Multi-Currency Support

```javascript
// Exchange rates (fetch from API in production)
const EXCHANGE_RATES = {
    'INR': 1,
    'USD': 0.012,
    'EUR': 0.011
};

// Convert between currencies
function convertCurrency(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    
    const amountInBase = amount / EXCHANGE_RATES[fromCurrency];
    return amountInBase * EXCHANGE_RATES[toCurrency];
}

// Format amount in different currency
function formatInCurrency(amount, currency) {
    const converted = convertCurrency(amount, CONFIG.DEFAULT_CURRENCY, currency);
    return Utils.formatCurrency(converted, currency);
}
```

### 7. Receipt OCR (Future Enhancement)

```javascript
// Upload and OCR receipt
async function uploadReceipt(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                // In production, send to OCR service like:
                // Google Vision API, AWS Textract, or Tesseract.js
                
                const base64 = e.target.result.split(',')[1];
                // Process with API
                
                resolve(base64);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.readAsDataURL(file);
    });
}
```

## Customization

### Change App Colors

Edit `styles/main.css`:

```css
:root {
    --primary: #6366F1;      /* Change to your brand color */
    --success: #10B981;
    --danger: #F87171;
    --warning: #FCD34D;
    /* ... more colors ... */
}
```

### Add New Categories

Edit `scripts/config.js`:

```javascript
EXPENSE_CATEGORIES: [
    'Food',
    'Transport',
    'Entertainment',
    'Shopping',
    'Bills',
    'Healthcare',
    'Education',
    'Utilities',
    'Insurance',
    'Subscriptions',  // Add new categories
    'Maintenance',
    'Gifts',
    'Donations',
    'Other'
]
```

### Change Currency

Edit `scripts/config.js`:

```javascript
DEFAULT_CURRENCY: 'USD',  // Change from 'INR' to any supported currency

CURRENCIES: {
    INR: { symbol: '₹', name: 'Indian Rupee' },
    USD: { symbol: '$', name: 'US Dollar' },
    EUR: { symbol: '€', name: 'Euro' },
    GBP: { symbol: '£', name: 'British Pound' }  // Add more
}
```

### Modify API Endpoint

Edit `scripts/config.js`:

```javascript
API_ENDPOINT: 'https://your-custom-backend.com/api/expenses'  // Use your backend
```

### Dark Mode Colors

Edit `styles/main.css`:

```css
[data-theme="dark"] {
    --background: #1a1a1a;    /* Darker background */
    --card: #2a2a2a;
    --text: #ffffff;
    /* ... more dark mode colors ... */
}
```

---

**Explore possibilities and customize to your needs! 🚀**

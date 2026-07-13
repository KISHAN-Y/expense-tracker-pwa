const db = require('./db');

function getDashboardStats(userId) {
    const targetUserId = userId || 'default';
    const allTransactions = db.getTransactions();
    const allBudgets = db.getBudgets();
    const users = db.getUsers();

    // Find current user profile
    const user = users.find(u => u.userId === targetUserId) || {};
    const displayName = user.displayName || 'User';
    const avatarGradient = user.avatarGradient !== undefined ? user.avatarGradient : 0;
    const currency = user.currency || 'INR';

    // Filter transactions by userId
    const userTransactions = allTransactions.filter(t => (t.userId || 'default') === targetUserId);
    
    // Sort transactions by date (newest first)
    const sortedTransactions = [...userTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Stats calculations
    const totalIncome = userTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const totalExpense = userTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const balance = totalIncome - totalExpense;

    // Recent 5 transactions
    const recentTransactions = sortedTransactions.slice(0, 5);

    // Heatmap data - last 7 days daily expense totals
    const last7Days = [];
    const heatmapData = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        last7Days.push(dateStr);
        heatmapData[dateStr] = 0;
    }

    userTransactions
        .filter(t => t.type === 'expense' && heatmapData[t.date] !== undefined)
        .forEach(t => {
            heatmapData[t.date] += parseFloat(t.amount) || 0;
        });

    const weeklySpend = last7Days.map(date => ({
        date,
        amount: heatmapData[date]
    }));

    // Current month budget calculations
    const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
    const userBudgets = allBudgets.filter(b => b.userId === targetUserId && b.monthYear === currentMonthStr);
    
    // Calculate actual expense per category for the current month
    const monthExpenses = userTransactions.filter(t => 
        t.type === 'expense' && 
        t.date && 
        t.date.startsWith(currentMonthStr)
    );

    const spendByCategory = {};
    monthExpenses.forEach(t => {
        if (!spendByCategory[t.category]) spendByCategory[t.category] = 0;
        spendByCategory[t.category] += parseFloat(t.amount) || 0;
    });

    const budgetStatus = userBudgets.map(b => {
        const spent = spendByCategory[b.category] || 0;
        const limit = parseFloat(b.limit) || 0;
        const remaining = limit - spent;
        return {
            id: b.id,
            category: b.category,
            limit: limit,
            spent: spent,
            remaining: remaining,
            percent: limit > 0 ? Math.min((spent / limit) * 100, 100) : 0,
            over: spent > limit
        };
    });

    // Category breakdown totals
    const categoryBreakdown = {};
    userTransactions.filter(t => t.type === 'expense').forEach(t => {
        if (!categoryBreakdown[t.category]) categoryBreakdown[t.category] = 0;
        categoryBreakdown[t.category] += parseFloat(t.amount) || 0;
    });

    return {
        success: true,
        stats: {
            totalIncome,
            totalExpense,
            balance,
            currency
        },
        user: {
            displayName,
            avatarGradient
        },
        recentTransactions,
        weeklySpend,
        budgets: budgetStatus,
        categoryBreakdown
    };
}

module.exports = {
    getDashboardStats
};

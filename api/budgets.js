const db = require('./db');

function getBudgets(userId) {
    const targetUserId = userId || 'default';
    const budgets = db.getBudgets();
    const filtered = budgets.filter(b => b.userId === targetUserId);
    return { success: true, budgets: filtered };
}

function createBudget(budget, userId) {
    if (!budget || !budget.category || budget.limit === undefined) {
        return { success: false, error: 'Invalid budget data' };
    }

    const budgets = db.getBudgets();
    const targetUserId = userId || 'default';

    const newBudget = {
        id: budget.id || 'b-' + db.generateRandomHex(16),
        category: budget.category,
        limit: parseFloat(budget.limit) || 0,
        monthYear: budget.monthYear || new Date().toISOString().substring(0, 7), // YYYY-MM
        createdAt: new Date().toISOString(),
        userId: targetUserId
    };

    budgets.push(newBudget);
    db.saveBudgets(budgets);

    return {
        success: true,
        message: 'Budget created successfully',
        budget: newBudget
    };
}

function updateBudget(budget, userId) {
    if (!budget || !budget.id) {
        return { success: false, error: 'Invalid budget data' };
    }

    const targetUserId = userId || 'default';
    const budgets = db.getBudgets();
    const index = budgets.findIndex(b => b.id === budget.id);

    if (index === -1) {
        return { success: false, error: 'Budget not found' };
    }

    const currentBudget = budgets[index];

    // Verify ownership
    if (currentBudget.userId !== targetUserId) {
        return { success: false, error: 'Unauthorized: You do not own this budget' };
    }

    // Update fields
    if (budget.category !== undefined) currentBudget.category = budget.category;
    if (budget.limit !== undefined) currentBudget.limit = parseFloat(budget.limit) || 0;
    if (budget.monthYear !== undefined) currentBudget.monthYear = budget.monthYear;

    budgets[index] = currentBudget;
    db.saveBudgets(budgets);

    return {
        success: true,
        message: 'Budget updated successfully',
        budget: currentBudget
    };
}

function deleteBudget(budgetId, userId) {
    if (!budgetId) {
        return { success: false, error: 'Budget ID is required' };
    }

    const targetUserId = userId || 'default';
    const budgets = db.getBudgets();
    const index = budgets.findIndex(b => b.id === budgetId);

    if (index === -1) {
        return { success: false, error: 'Budget not found' };
    }

    const currentBudget = budgets[index];

    // Verify ownership
    if (currentBudget.userId !== targetUserId) {
        return { success: false, error: 'Unauthorized: You do not own this budget' };
    }

    budgets.splice(index, 1);
    db.saveBudgets(budgets);

    return {
        success: true,
        message: 'Budget deleted successfully'
    };
}

module.exports = {
    getBudgets,
    createBudget,
    updateBudget,
    deleteBudget
};

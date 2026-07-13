const db = require('./db');

function getTransactions(userId) {
    const reqUserId = userId || 'default';
    const txs = db.getTransactions();
    
    // Filter transactions by userId
    const filtered = txs.filter(t => {
        const rowUserId = t.userId || 'default';
        return rowUserId === reqUserId;
    });

    return { success: true, transactions: filtered };
}

function createTransaction(transaction, userId) {
    if (!transaction || !transaction.id) {
        return { success: false, error: 'Invalid transaction data' };
    }

    const txs = db.getTransactions();
    
    // Add default fields matching Google Apps Script structure
    const newTx = {
        id: transaction.id,
        date: transaction.date,
        type: transaction.type,
        category: transaction.category,
        amount: parseFloat(transaction.amount) || 0,
        description: transaction.description || '',
        createdAt: new Date().toISOString(),
        userId: userId || 'default'
    };

    txs.push(newTx);
    db.saveTransactions(txs);

    return {
        success: true,
        message: 'Transaction created',
        transaction: newTx
    };
}

function updateTransaction(transaction, userId) {
    if (!transaction || !transaction.id) {
        return { success: false, error: 'Invalid transaction data' };
    }

    const targetUserId = userId || 'default';
    const txs = db.getTransactions();
    const index = txs.findIndex(t => t.id === transaction.id);

    if (index === -1) {
        return { success: false, error: 'Transaction not found' };
    }

    const currentTx = txs[index];
    const rowUserId = currentTx.userId || 'default';

    // Verify ownership
    if (rowUserId !== targetUserId) {
        return { success: false, error: 'Unauthorized: You do not own this transaction' };
    }

    // Update fields
    const updatedTx = {
        ...currentTx,
        date: transaction.date,
        type: transaction.type,
        category: transaction.category,
        amount: parseFloat(transaction.amount) || 0,
        description: transaction.description || '',
        // Keep original createdAt and userId
    };

    txs[index] = updatedTx;
    db.saveTransactions(txs);

    return {
        success: true,
        message: 'Transaction updated',
        transaction: updatedTx
    };
}

function deleteTransaction(transactionId, userId) {
    if (!transactionId) {
        return { success: false, error: 'Transaction ID is required' };
    }

    const targetUserId = userId || 'default';
    const txs = db.getTransactions();
    const index = txs.findIndex(t => t.id === transactionId);

    if (index === -1) {
        return { success: false, error: 'Transaction not found' };
    }

    const currentTx = txs[index];
    const rowUserId = currentTx.userId || 'default';

    // Verify ownership
    if (rowUserId !== targetUserId) {
        return { success: false, error: 'Unauthorized: You do not own this transaction' };
    }

    txs.splice(index, 1);
    db.saveTransactions(txs);

    return {
        success: true,
        message: 'Transaction deleted'
    };
}

module.exports = {
    getTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction
};

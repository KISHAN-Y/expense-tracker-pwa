// Google Apps Script Backend for Expense Tracker PWA
// Copy this code to your Google Apps Script project
// 1. Go to https://script.google.com
// 2. Create a new project
// 3. Replace the code with this content
// 4. Deploy as Web App
// 5. Copy the deployment URL to CONFIG.API_ENDPOINT in scripts/config.js

// Sheet configuration
const SHEET_ID = '1AoPoKNdtC0LbkXUb1286gdQSIPzS2AYBi517hg8JR7g'; // Your Google Sheet ID
const SHEET_NAME = 'Transactions';

// Get spreadsheet
function getSheet() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        sheet.appendRow(['ID', 'Date', 'Type', 'Category', 'Amount', 'Description', 'CreatedAt']);
    }
    return sheet;
}

// Handle CORS preflight
function doOptions(e) {
    return createCorsResponse({ success: true });
}

// Helper function to create JSON response
function createCorsResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

// GET - Return all transactions
function doGet(e) {
    try {
        const sheet = getSheet();
        const data = sheet.getDataRange().getValues();
        
        // Convert to array of objects (skip header)
        const transactions = [];
        for (let i = 1; i < data.length; i++) {
            transactions.push({
                id: data[i][0],
                date: data[i][1],
                type: data[i][2],
                category: data[i][3],
                amount: data[i][4],
                description: data[i][5],
                createdAt: data[i][6]
            });
        }

        return createCorsResponse({ success: true, transactions: transactions });
    } catch (error) {
        return createCorsResponse({ success: false, error: error.toString() });
    }
}

// POST - Create transaction
function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const { action, data: transactionData } = data;

        switch (action) {
            case 'CREATE':
                return createTransaction(transactionData);
            case 'UPDATE':
                return updateTransaction(transactionData);
            case 'DELETE':
                return deleteTransaction(transactionData);
            default:
                return errorResponse('Invalid action');
        }
    } catch (error) {
        return errorResponse(error.toString());
    }
}

// PUT - Update transaction
function doPut(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const { data: transactionData } = data;
        return updateTransaction(transactionData);
    } catch (error) {
        return errorResponse(error.toString());
    }
}

// DELETE - Delete transaction
function doDelete(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const { data: transactionData } = data;
        return deleteTransaction(transactionData);
    } catch (error) {
        return errorResponse(error.toString());
    }
}

// Create transaction
function createTransaction(transaction) {
    try {
        const sheet = getSheet();
        const row = [
            transaction.id,
            transaction.date,
            transaction.type,
            transaction.category,
            transaction.amount,
            transaction.description || '',
            new Date().toISOString()
        ];
        sheet.appendRow(row);
        SpreadsheetApp.flush();
        
        return createCorsResponse({ 
            success: true, 
            message: 'Transaction created',
            transaction: transaction 
        });
    } catch (error) {
        return errorResponse(error.toString());
    }
}

// Update transaction
function updateTransaction(transaction) {
    try {
        const sheet = getSheet();
        const data = sheet.getDataRange().getValues();
        
        // Find and update the row
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] === transaction.id) {
                sheet.getRange(i + 1, 1, 1, 7).setValues([[
                    transaction.id,
                    transaction.date,
                    transaction.type,
                    transaction.category,
                    transaction.amount,
                    transaction.description || '',
                    data[i][6] // Keep original createdAt
                ]]);
                SpreadsheetApp.flush();
                
                return createCorsResponse({ 
                    success: true, 
                    message: 'Transaction updated',
                    transaction: transaction 
                });
            }
        }
        
        return errorResponse('Transaction not found');
    } catch (error) {
        return errorResponse(error.toString());
    }
}

// Delete transaction
function deleteTransaction(data) {
    try {
        const sheet = getSheet();
        const sheetData = sheet.getDataRange().getValues();
        
        // Find and delete the row
        for (let i = 1; i < sheetData.length; i++) {
            if (sheetData[i][0] === data.id) {
                sheet.deleteRow(i + 1);
                SpreadsheetApp.flush();
                
                return createCorsResponse({ 
                    success: true, 
                    message: 'Transaction deleted'
                });
            }
        }
        
        return errorResponse('Transaction not found');
    } catch (error) {
        return errorResponse(error.toString());
    }
}

// Error response helper
function errorResponse(message) {
    return createCorsResponse({ success: false, error: message });
}

// Test function (run from Apps Script editor)
function testBackend() {
    const testTransaction = {
        id: 'test-' + Date.now(),
        date: new Date().toISOString().split('T')[0],
        type: 'expense',
        category: 'Food',
        amount: '150.00',
        description: 'Test transaction'
    };
    
    Logger.log('Creating test transaction...');
    createTransaction(testTransaction);
    
    Logger.log('Fetching all transactions...');
    const transactions = getSheet().getDataRange().getValues();
    Logger.log('Total rows: ' + transactions.length);
    Logger.log(transactions);
}

// Deploy as web app:
// 1. Click "Deploy" -> "New Deployment"
// 2. Select "Web app" type
// 3. Execute as: Me (your account)
// 4. Who has access: Anyone
// 5. Click Deploy
// 6. Copy the deployment URL and paste in CONFIG.API_ENDPOINT

// Google Apps Script Backend for Expense Tracker PWA
// Copy this code to your Google Apps Script project
// 1. Go to https://script.google.com
// 2. Create a new project
// 3. Replace the code with this content
// 4. Deploy as Web App
// 5. Copy the deployment URL to CONFIG.API_ENDPOINT in scripts/config.js

// Sheet configuration
const SHEET_ID = '1AoPoKNdtC0LbkXUb1286gdQSIPzS2AYBi517hg8JR7g'; // Your Google Sheet ID
const SHEET_NAME = 'Sheet1';
const USERS_SHEET_NAME = 'Users';

// Get spreadsheet
function getSheet() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        sheet.appendRow(['ID', 'Date', 'Type', 'Category', 'Amount', 'Description', 'CreatedAt', 'UserId']);
    } else {
        // Automatically check if UserId header exists, if not, append it
        const headers = sheet.getDataRange().getValues()[0];
        if (headers.indexOf('UserId') === -1) {
            sheet.getRange(1, headers.length + 1).setValue('UserId');
            SpreadsheetApp.flush();
        }
    }
    return sheet;
}

// Get Users spreadsheet
function getUsersSheet() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(USERS_SHEET_NAME);
        sheet.appendRow(['UserId', 'Email', 'PasswordHash', 'Salt', 'CreatedAt', 'DisplayName']);
    } else {
        const headers = sheet.getDataRange().getValues()[0];
        if (headers.indexOf('DisplayName') === -1) {
            sheet.getRange(1, headers.length + 1).setValue('DisplayName');
            SpreadsheetApp.flush();
        }
    }
    return sheet;
}

// Hash password with salt using SHA-256
function hashPassword(password, salt) {
    const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + salt, Utilities.Charset.UTF_8);
    let hashStr = '';
    for (let i = 0; i < rawHash.length; i++) {
        let byteVal = rawHash[i];
        if (byteVal < 0) byteVal += 256;
        let byteString = byteVal.toString(16);
        if (byteString.length == 1) byteString = '0' + byteString;
        hashStr += byteString;
    }
    return hashStr;
}

// Generate random hex string (salt or userId)
function generateRandomHex(length) {
    const chars = 'abcdef0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Register user
function registerUser(email, password, displayName) {
    try {
        if (!email || !password) {
            return { success: false, error: 'Email and password are required' };
        }
        
        email = email.trim().toLowerCase();
        const usersSheet = getUsersSheet();
        const data = usersSheet.getDataRange().getValues();
        const headers = data[0];
        const dispNameIdx = headers.indexOf('DisplayName');
        
        // Check if user already exists
        for (let i = 1; i < data.length; i++) {
            if (data[i][1].toString().toLowerCase() === email) {
                return { success: false, error: 'User already exists' };
            }
        }
        
        const userId = 'u-' + generateRandomHex(16);
        const salt = generateRandomHex(16);
        const hash = hashPassword(password, salt);
        const createdAt = new Date().toISOString();
        
        const row = [userId, email, hash, salt, createdAt];
        if (dispNameIdx !== -1) {
            row[dispNameIdx] = displayName || '';
        } else {
            row.push(displayName || '');
        }
        
        usersSheet.appendRow(row);
        SpreadsheetApp.flush();
        
        return {
            success: true,
            user: { id: userId, email: email, displayName: displayName }
        };
    } catch (error) {
        return { success: false, error: error.toString() };
    }
}

// Login user
function loginUser(email, password) {
    try {
        if (!email || !password) {
            return { success: false, error: 'Email and password are required' };
        }
        
        email = email.trim().toLowerCase();
        const usersSheet = getUsersSheet();
        const data = usersSheet.getDataRange().getValues();
        const headers = data[0];
        const dispNameIdx = headers.indexOf('DisplayName');
        
        for (let i = 1; i < data.length; i++) {
            if (data[i][1].toString().toLowerCase() === email) {
                const storedHash = data[i][2];
                const salt = data[i][3];
                const computedHash = hashPassword(password, salt);
                
                if (computedHash === storedHash) {
                    const dispName = (dispNameIdx !== -1 && data[i][dispNameIdx]) ? data[i][dispNameIdx] : email.split('@')[0];
                    return {
                        success: true,
                        user: { id: data[i][0], email: email, displayName: dispName }
                    };
                } else {
                    return { success: false, error: 'Incorrect password' };
                }
            }
        }
        
        return { success: false, error: 'User not found' };
    } catch (error) {
        return { success: false, error: error.toString() };
    }
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

// GET - Return all transactions for specific user
function doGet(e) {
    try {
        const sheet = getSheet();
        const data = sheet.getDataRange().getValues();
        
        // Get userId from request query parameter
        const reqUserId = e && e.parameter && e.parameter.userId ? e.parameter.userId : 'default';
        
        // Convert to array of objects (skip header)
        const transactions = [];
        const headers = data[0];
        const userIdIdx = headers.indexOf('UserId');
        
        for (let i = 1; i < data.length; i++) {
            const rowUserId = userIdIdx !== -1 ? data[i][userIdIdx] : '';
            
            // Only return rows matching reqUserId. For backward compatibility, map empty userId to 'default'
            if (rowUserId === reqUserId || (!rowUserId && reqUserId === 'default')) {
                transactions.push({
                    id: data[i][0],
                    date: data[i][1],
                    type: data[i][2],
                    category: data[i][3],
                    amount: data[i][4],
                    description: data[i][5],
                    createdAt: data[i][6],
                    userId: rowUserId || 'default'
                });
            }
        }

        return createCorsResponse({ success: true, transactions: transactions });
    } catch (error) {
        return createCorsResponse({ success: false, error: error.toString() });
    }
}

// POST - Handles CRUD and Authentication
function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const { action, data: actionData, userId } = data;

        switch (action) {
            case 'REGISTER':
                return createCorsResponse(registerUser(actionData.email, actionData.password, actionData.displayName));
            case 'LOGIN':
                return createCorsResponse(loginUser(actionData.email, actionData.password));
            case 'CREATE':
                return createTransaction(actionData, userId);
            case 'UPDATE':
                return updateTransaction(actionData, userId);
            case 'DELETE':
                return deleteTransaction(actionData, userId);
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
        const { data: transactionData, userId } = data;
        return updateTransaction(transactionData, userId);
    } catch (error) {
        return errorResponse(error.toString());
    }
}

// DELETE - Delete transaction
function doDelete(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const { data: transactionData, userId } = data;
        return deleteTransaction(transactionData, userId);
    } catch (error) {
        return errorResponse(error.toString());
    }
}

// Create transaction
function createTransaction(transaction, userId) {
    try {
        const sheet = getSheet();
        const headers = sheet.getDataRange().getValues()[0];
        const userIdIdx = headers.indexOf('UserId');
        
        const row = [
            transaction.id,
            transaction.date,
            transaction.type,
            transaction.category,
            transaction.amount,
            transaction.description || '',
            new Date().toISOString()
        ];
        
        if (userIdIdx !== -1) {
            row[userIdIdx] = userId || 'default';
        } else {
            row.push(userId || 'default');
        }
        
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
function updateTransaction(transaction, userId) {
    try {
        const sheet = getSheet();
        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        const userIdIdx = headers.indexOf('UserId');
        const targetUserId = userId || 'default';
        
        // Find and update the row
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] === transaction.id) {
                const rowUserId = userIdIdx !== -1 ? data[i][userIdIdx] : '';
                
                // Check ownership
                if (rowUserId && rowUserId !== targetUserId) {
                    return errorResponse('Unauthorized: You do not own this transaction');
                }
                
                const updatedRow = [
                    transaction.id,
                    transaction.date,
                    transaction.type,
                    transaction.category,
                    transaction.amount,
                    transaction.description || '',
                    data[i][6] // Keep original createdAt
                ];
                
                if (userIdIdx !== -1) {
                    updatedRow[userIdIdx] = targetUserId;
                }
                
                sheet.getRange(i + 1, 1, 1, Math.max(7, userIdIdx + 1)).setValues([updatedRow]);
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
function deleteTransaction(data, userId) {
    try {
        const sheet = getSheet();
        const sheetData = sheet.getDataRange().getValues();
        const headers = sheetData[0];
        const userIdIdx = headers.indexOf('UserId');
        const targetUserId = userId || 'default';
        
        // Find and delete the row
        for (let i = 1; i < sheetData.length; i++) {
            if (sheetData[i][0] === data.id) {
                const rowUserId = userIdIdx !== -1 ? sheetData[i][userIdIdx] : '';
                
                // Check ownership
                if (rowUserId && rowUserId !== targetUserId) {
                    return errorResponse('Unauthorized: You do not own this transaction');
                }
                
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

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
const ACCOUNTS_SHEET_NAME = 'Accounts';
const DEFAULT_ACCOUNT_ID = '00000000-0000-0000-0000-000000000001';

// Helper function to find a sheet tab case-insensitively
function getSheetByNameCaseInsensitive(ss, name) {
    const sheets = ss.getSheets();
    const target = name.toLowerCase();
    for (let i = 0; i < sheets.length; i++) {
        if (sheets[i].getName().toLowerCase() === target) {
            return sheets[i];
        }
    }
    return null;
}

// Clean and parse currency amount robustly
function cleanAmount(amountVal) {
    if (amountVal === undefined || amountVal === null) return 0;
    if (typeof amountVal === 'number') return amountVal;
    
    const cleanStr = String(amountVal)
        .replace(/[₹$€\s,]/g, '') // remove currency symbols, spaces, commas
        .trim();
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
}

// Normalize any date value to ISO YYYY-MM-DD string.
// Handles: JS Date objects (from Google Sheets), ISO strings, DD/MM/YYYY, MM/DD/YYYY.
function toISODate(dateVal) {
    if (!dateVal) return '';
    if (dateVal instanceof Date) {
        const y = dateVal.getFullYear();
        const m = String(dateVal.getMonth() + 1).padStart(2, '0');
        const d = String(dateVal.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const s = String(dateVal).trim();
    // Already ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    // Try DD/MM/YYYY or MM/DD/YYYY
    const parts = s.split(/[\/\-\.]/);
    if (parts.length === 3) {
        const [a, b, c] = parts.map(Number);
        // If first part > 12, it's DD/MM/YYYY
        if (a > 12) return `${c}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
        // If second part > 12, it's MM/DD/YYYY
        if (b > 12) return `${c}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
        // Ambiguous — assume DD/MM/YYYY (Indian locale convention)
        return `${c}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    }
    return s;
}

// Get spreadsheet
function getSheet() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = getSheetByNameCaseInsensitive(ss, SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        sheet.appendRow(['ID', 'Date', 'Type', 'Category', 'Amount', 'Description', 'CreatedAt', 'UserId']);
    } else {
        // Automatically check if UserId and AccountId headers exist, if not, append them
        const headers = sheet.getDataRange().getValues()[0];
        let modified = false;
        if (findHeaderIndex(headers, 'UserId') === -1) {
            sheet.getRange(1, headers.length + 1).setValue('UserId');
            headers.push('UserId');
            modified = true;
        }
        if (findHeaderIndex(headers, 'AccountId') === -1) {
            sheet.getRange(1, headers.length + 1).setValue('AccountId');
            modified = true;
        }
        if (modified) {
            SpreadsheetApp.flush();
        }
    }
    return sheet;
}

// Get Accounts spreadsheet
function getAccountsSheet() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = getSheetByNameCaseInsensitive(ss, ACCOUNTS_SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(ACCOUNTS_SHEET_NAME);
        sheet.appendRow(['id', 'name', 'type', 'balance', 'userId', 'createdAt', 'openingBalance', 'openingBalanceDate']);
    } else {
        const data = sheet.getDataRange().getValues();
        if (data.length === 0) {
            sheet.appendRow(['id', 'name', 'type', 'balance', 'userId', 'createdAt', 'openingBalance', 'openingBalanceDate']);
            SpreadsheetApp.flush();
        } else {
            // Auto-append missing headers
            const headers = data[0];
            let modified = false;
            if (findHeaderIndex(headers, 'openingBalance') === -1) {
                sheet.getRange(1, headers.length + 1).setValue('openingBalance');
                headers.push('openingBalance');
                modified = true;
            }
            if (findHeaderIndex(headers, 'openingBalanceDate') === -1) {
                sheet.getRange(1, headers.length + 1).setValue('openingBalanceDate');
                modified = true;
            }
            if (modified) {
                SpreadsheetApp.flush();
            }
        }
    }
    return sheet;
}

// Get Users spreadsheet
function getUsersSheet() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = getSheetByNameCaseInsensitive(ss, USERS_SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(USERS_SHEET_NAME);
        sheet.appendRow(['UserId', 'Email', 'PasswordHash', 'Salt', 'CreatedAt', 'DisplayName']);
    } else {
        const data = sheet.getDataRange().getValues();
        if (data.length === 0) {
            sheet.appendRow(['UserId', 'Email', 'PasswordHash', 'Salt', 'CreatedAt', 'DisplayName']);
            SpreadsheetApp.flush();
        } else {
            const headers = data[0];

            // Check if it's a data row instead of a header row (e.g. starts with 'u-')
            const isDataRow = headers[0] && headers[0].toString().substring(0, 2) === 'u-';

            if (isDataRow) {
                // Insert a new header row at the top
                sheet.insertRowBefore(1);
                sheet.getRange(1, 1, 1, 6).setValues([['UserId', 'Email', 'PasswordHash', 'Salt', 'CreatedAt', 'DisplayName']]);
                SpreadsheetApp.flush();
            } else {
                // It is a header row, make sure all required fields are present
                const required = ['UserId', 'Email', 'PasswordHash', 'Salt', 'CreatedAt', 'DisplayName'];
                let modified = false;

                required.forEach((colName, index) => {
                    if (findHeaderIndex(headers, colName) === -1) {
                        if (index < headers.length) {
                            sheet.getRange(1, index + 1).setValue(colName);
                        } else {
                            sheet.getRange(1, headers.length + 1).setValue(colName);
                            headers.push(colName);
                        }
                        modified = true;
                    }
                });

                if (modified) {
                    SpreadsheetApp.flush();
                }
            }
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

// Helper function to find header index case-insensitively and whitespace-tolerantly
function findHeaderIndex(headers, columnName) {
    if (!headers) return -1;
    const target = columnName.trim().toLowerCase();
    for (let i = 0; i < headers.length; i++) {
        if (headers[i] && headers[i].toString().trim().toLowerCase() === target) {
            return i;
        }
    }
    return -1;
}

// Ensure Users sheet has correct headers, fix if needed, return fresh data
function ensureUsersHeaders(usersSheet) {
    const REQUIRED_HEADERS = ['UserId', 'Email', 'PasswordHash', 'Salt', 'CreatedAt', 'DisplayName'];
    var data = usersSheet.getDataRange().getValues();

    // Empty sheet — just write headers
    if (data.length === 0) {
        usersSheet.appendRow(REQUIRED_HEADERS);
        SpreadsheetApp.flush();
        return usersSheet.getDataRange().getValues();
    }

    var headers = data[0];

    // Check if row 1 looks like user data instead of headers (starts with 'u-')
    var firstCell = headers[0] ? headers[0].toString().trim() : '';
    if (firstCell.substring(0, 2) === 'u-' || firstCell === '') {
        // Row 1 is data, not headers. Insert header row at top.
        usersSheet.insertRowBefore(1);
        usersSheet.getRange(1, 1, 1, REQUIRED_HEADERS.length).setValues([REQUIRED_HEADERS]);
        SpreadsheetApp.flush();
        return usersSheet.getDataRange().getValues();
    }

    // Row 1 is a header row — check each required column exists
    var needsFlush = false;
    var nextCol = headers.length + 1;
    for (var r = 0; r < REQUIRED_HEADERS.length; r++) {
        if (findHeaderIndex(headers, REQUIRED_HEADERS[r]) === -1) {
            // Overwrite at position r+1 if within range, else append
            if (r < headers.length && (!headers[r] || headers[r].toString().trim() === '')) {
                usersSheet.getRange(1, r + 1).setValue(REQUIRED_HEADERS[r]);
            } else {
                usersSheet.getRange(1, nextCol).setValue(REQUIRED_HEADERS[r]);
                nextCol++;
            }
            needsFlush = true;
        }
    }
    if (needsFlush) {
        SpreadsheetApp.flush();
    }
    return usersSheet.getDataRange().getValues();
}

// Register user
function registerUser(email, password, displayName) {
    try {
        if (!email || !password) {
            return { success: false, error: 'Email and password are required' };
        }

        email = email.trim().toLowerCase();
        var usersSheet = getUsersSheet();
        var data = ensureUsersHeaders(usersSheet);
        var headers = data[0];

        // Find indices dynamically
        var emailIdx = findHeaderIndex(headers, 'Email');
        var hashIdx = findHeaderIndex(headers, 'PasswordHash');
        var saltIdx = findHeaderIndex(headers, 'Salt');
        var idIdx = findHeaderIndex(headers, 'UserId');
        var createdAtIdx = findHeaderIndex(headers, 'CreatedAt');
        var dispNameIdx = findHeaderIndex(headers, 'DisplayName');

        // Check if user already exists
        for (var i = 1; i < data.length; i++) {
            var rowEmail = data[i][emailIdx] ? data[i][emailIdx].toString().trim().toLowerCase() : '';
            if (rowEmail === email) {
                return { success: false, error: 'User already exists' };
            }
        }

        var userId = 'u-' + generateRandomHex(16);
        var salt = generateRandomHex(16);
        var hash = hashPassword(password, salt);
        var createdAt = new Date().toISOString();

        // Construct row — always use fixed column order [UserId, Email, PasswordHash, Salt, CreatedAt, DisplayName]
        var row = new Array(headers.length);
        for (var c = 0; c < row.length; c++) row[c] = '';
        row[idIdx] = userId;
        row[emailIdx] = email;
        row[hashIdx] = hash;
        row[saltIdx] = salt;
        row[createdAtIdx] = createdAt;
        if (dispNameIdx !== -1) {
            row[dispNameIdx] = displayName || '';
        }

        usersSheet.appendRow(row);
        SpreadsheetApp.flush();

        // Send welcome email
        sendWelcomeEmail(email, displayName);

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
        var usersSheet = getUsersSheet();
        var data = ensureUsersHeaders(usersSheet);
        var headers = data[0];

        // Find indices dynamically
        var emailIdx = findHeaderIndex(headers, 'Email');
        var hashIdx = findHeaderIndex(headers, 'PasswordHash');
        var saltIdx = findHeaderIndex(headers, 'Salt');
        var idIdx = findHeaderIndex(headers, 'UserId');
        var dispNameIdx = findHeaderIndex(headers, 'DisplayName');

        for (var i = 1; i < data.length; i++) {
            var rowEmail = data[i][emailIdx] ? data[i][emailIdx].toString().trim().toLowerCase() : '';
            if (rowEmail === email) {
                var storedHash = data[i][hashIdx];
                var salt = data[i][saltIdx];
                var computedHash = hashPassword(password, salt);

                if (computedHash === storedHash) {
                    var dispName = (dispNameIdx !== -1 && data[i][dispNameIdx]) ? data[i][dispNameIdx] : email.split('@')[0];
                    return {
                        success: true,
                        user: { id: data[i][idIdx], email: email, displayName: dispName }
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
        const userIdIdx = findHeaderIndex(headers, 'UserId');
        const accountIdIdx = findHeaderIndex(headers, 'AccountId');

        let modified = false;
        for (let i = 1; i < data.length; i++) {
            let rowUserId = userIdIdx !== -1 ? data[i][userIdIdx] : '';
            let rawAccountId = accountIdIdx !== -1 ? data[i][accountIdIdx] : '';

            // Backfill blank UserId for logged in user if it's empty
            if (!rowUserId && reqUserId !== 'default' && userIdIdx !== -1) {
                sheet.getRange(i + 1, userIdIdx + 1).setValue(reqUserId);
                rowUserId = reqUserId;
                modified = true;
            }

            // Backfill blank AccountId with DEFAULT_ACCOUNT_ID if empty
            if (!rawAccountId && accountIdIdx !== -1) {
                sheet.getRange(i + 1, accountIdIdx + 1).setValue(DEFAULT_ACCOUNT_ID);
                rawAccountId = DEFAULT_ACCOUNT_ID;
                modified = true;
            }

            // Only return rows matching reqUserId. For backward compatibility, map empty userId to 'default'
            if (rowUserId === reqUserId || (!rowUserId && reqUserId === 'default')) {
                const accountId = rawAccountId ? rawAccountId.toString().trim() : DEFAULT_ACCOUNT_ID;
                
                transactions.push({
                    id: data[i][0],
                    date: data[i][1],
                    type: data[i][2],
                    category: data[i][3],
                    amount: data[i][4] !== undefined && data[i][4] !== null ? data[i][4].toString() : '0',
                    description: data[i][5],
                    createdAt: data[i][6],
                    userId: rowUserId || 'default',
                    accountId: accountId
                });
            }
        }

        if (modified) {
            SpreadsheetApp.flush();
        }

        // Get accounts
        const accountsSheet = getAccountsSheet();
        const accountsData = accountsSheet.getDataRange().getValues();
        const accounts = [];
        const accHeaders = accountsData[0];
        const accUserIdIdx = findHeaderIndex(accHeaders, 'userId');
        const accOpeningBalIdx = findHeaderIndex(accHeaders, 'openingBalance');
        const accOpeningDateIdx = findHeaderIndex(accHeaders, 'openingBalanceDate');
        
        for (let i = 1; i < accountsData.length; i++) {
            const rowUserId = accUserIdIdx !== -1 ? accountsData[i][accUserIdIdx] : '';
            if (rowUserId === reqUserId || (!rowUserId && reqUserId === 'default')) {
                accounts.push({
                    id: accountsData[i][0],
                    name: accountsData[i][1],
                    type: accountsData[i][2],
                    balance: accountsData[i][3],
                    userId: rowUserId || 'default',
                    createdAt: accountsData[i][5],
                    openingBalance: accOpeningBalIdx !== -1 ? cleanAmount(accountsData[i][accOpeningBalIdx]) : 0,
                    openingBalanceDate: accOpeningDateIdx !== -1 ? toISODate(accountsData[i][accOpeningDateIdx]) : ''
                });
            }
        }

        // If no accounts exist for this user, auto-seed the default account
        if (accounts.length === 0) {
            const defaultAccRow = [
                DEFAULT_ACCOUNT_ID,
                'Main Account',
                'Checking',
                0,
                reqUserId || 'default',
                new Date().toISOString(),
                0,   // openingBalance
                ''   // openingBalanceDate
            ];
            accountsSheet.appendRow(defaultAccRow);
            SpreadsheetApp.flush();
            accounts.push({
                id: DEFAULT_ACCOUNT_ID,
                name: 'Main Account',
                type: 'Checking',
                balance: 0,
                userId: reqUserId || 'default',
                createdAt: defaultAccRow[5],
                openingBalance: 0,
                openingBalanceDate: ''
            });
        }

        return createCorsResponse({ success: true, transactions: transactions, accounts: accounts });
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
            case 'BATCH_CREATE':
                return createTransactions(actionData, userId);
            case 'UPDATE':
                return updateTransaction(actionData, userId);
            case 'DELETE':
                return deleteTransaction(actionData, userId);
            case 'CREATE_ACCOUNT':
                return createAccount(actionData, userId);
            case 'UPDATE_ACCOUNT':
                return updateAccount(actionData, userId);
            case 'DELETE_ACCOUNT':
                return deleteAccount(actionData, userId);
            case 'SEND_PROMO_EMAIL':
                return createCorsResponse(sendPromotionalEmail(actionData.email));
            case 'SEND_REPORT_EMAIL':
                return createCorsResponse(sendFinancialReportEmail(actionData.email, actionData.reportData));
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
        const userIdIdx = findHeaderIndex(headers, 'UserId');
        const accountIdIdx = findHeaderIndex(headers, 'AccountId');

        const row = [
            transaction.id,
            transaction.date,
            transaction.type,
            transaction.category,
            cleanAmount(transaction.amount),
            transaction.description || '',
            new Date().toISOString()
        ];

        // Ensure row is long enough
        while (row.length < headers.length) {
            row.push('');
        }

        if (userIdIdx !== -1) {
            row[userIdIdx] = userId || 'default';
        }
        
        if (accountIdIdx !== -1) {
            row[accountIdIdx] = transaction.accountId || DEFAULT_ACCOUNT_ID;
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

// Batch create transactions
function createTransactions(transactions, userId) {
    try {
        const sheet = getSheet();
        const headers = sheet.getDataRange().getValues()[0];
        const userIdIdx = findHeaderIndex(headers, 'UserId');
        const accountIdIdx = findHeaderIndex(headers, 'AccountId');

        const rows = [];
        for (const transaction of transactions) {
            const row = [
                transaction.id,
                transaction.date,
                transaction.type,
                transaction.category,
                cleanAmount(transaction.amount),
                transaction.description || '',
                new Date().toISOString()
            ];

            // Ensure row is long enough
            while (row.length < headers.length) {
                row.push('');
            }

            if (userIdIdx !== -1) {
                row[userIdIdx] = userId || 'default';
            }
            
            if (accountIdIdx !== -1) {
                row[accountIdIdx] = transaction.accountId || DEFAULT_ACCOUNT_ID;
            }
            rows.push(row);
        }

        // Batch append
        if (rows.length > 0) {
            const lastRow = sheet.getLastRow();
            const range = sheet.getRange(lastRow + 1, 1, rows.length, headers.length);
            range.setValues(rows);
            SpreadsheetApp.flush();
        }

        return createCorsResponse({
            success: true,
            message: transactions.length + ' Transactions created',
            transactions: transactions
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
        const userIdIdx = findHeaderIndex(headers, 'UserId');
        const accountIdIdx = findHeaderIndex(headers, 'AccountId');
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
                    cleanAmount(transaction.amount),
                    transaction.description || '',
                    data[i][6] // Keep original createdAt
                ];
                
                // Ensure array length
                while (updatedRow.length < headers.length) {
                    updatedRow.push('');
                }

                if (userIdIdx !== -1) {
                    updatedRow[userIdIdx] = targetUserId;
                }
                
                if (accountIdIdx !== -1) {
                    updatedRow[accountIdIdx] = transaction.accountId || DEFAULT_ACCOUNT_ID;
                }

                sheet.getRange(i + 1, 1, 1, headers.length).setValues([updatedRow]);
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
        const userIdIdx = findHeaderIndex(headers, 'UserId');
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

// ============ ACCOUNT FUNCTIONS ============

function createAccount(account, userId) {
    try {
        const sheet = getAccountsSheet();
        const headers = sheet.getDataRange().getValues()[0];
        
        const row = [
            account.id,
            account.name,
            account.type || '',
            cleanAmount(account.balance),
            userId || 'default',
            new Date().toISOString(),
            cleanAmount(account.openingBalance),
            toISODate(account.openingBalanceDate)
        ];

        sheet.appendRow(row);
        SpreadsheetApp.flush();

        return createCorsResponse({
            success: true,
            message: 'Account created',
            account: account
        });
    } catch (error) {
        return errorResponse(error.toString());
    }
}

function updateAccount(account, userId) {
    try {
        const sheet = getAccountsSheet();
        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        const targetUserId = userId || 'default';
        const userIdIdx = findHeaderIndex(headers, 'userId');

        // Find and update the row
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] === account.id) {
                const rowUserId = userIdIdx !== -1 ? data[i][userIdIdx] : '';

                // Check ownership
                if (rowUserId && rowUserId !== targetUserId) {
                    return errorResponse('Unauthorized: You do not own this account');
                }

                const updatedRow = [
                    account.id,
                    account.name,
                    account.type || '',
                    cleanAmount(account.balance),
                    targetUserId,
                    data[i][5], // Keep original createdAt
                    cleanAmount(account.openingBalance),
                    toISODate(account.openingBalanceDate)
                ];

                sheet.getRange(i + 1, 1, 1, headers.length).setValues([updatedRow]);
                SpreadsheetApp.flush();

                return createCorsResponse({
                    success: true,
                    message: 'Account updated',
                    account: account
                });
            }
        }

        return errorResponse('Account not found');
    } catch (error) {
        return errorResponse(error.toString());
    }
}

function deleteAccount(data, userId) {
    try {
        const sheet = getAccountsSheet();
        const sheetData = sheet.getDataRange().getValues();
        const headers = sheetData[0];
        const targetUserId = userId || 'default';
        const userIdIdx = findHeaderIndex(headers, 'userId');

        // Find and delete the row
        for (let i = 1; i < sheetData.length; i++) {
            if (sheetData[i][0] === data.id) {
                const rowUserId = userIdIdx !== -1 ? sheetData[i][userIdIdx] : '';

                // Check ownership
                if (rowUserId && rowUserId !== targetUserId) {
                    return errorResponse('Unauthorized: You do not own this account');
                }

                sheet.deleteRow(i + 1);
                SpreadsheetApp.flush();

                return createCorsResponse({
                    success: true,
                    message: 'Account deleted'
                });
            }
        }

        return errorResponse('Account not found');
    } catch (error) {
        return errorResponse(error.toString());
    }
}

// Error response helper
function errorResponse(message) {
    return createCorsResponse({ success: false, error: message });
}

// ============ TEST FUNCTION ============
// Run this function MANUALLY from the Apps Script editor (click ▶ Run)
// to trigger the email authorization prompt. You only need to do this ONCE.
function testSendEmail() {
    var myEmail = Session.getActiveUser().getEmail();
    Logger.log('Attempting to send test email to: ' + myEmail);
    Logger.log('Daily email quota remaining: ' + MailApp.getRemainingDailyQuota());

    MailApp.sendEmail({
        to: myEmail,
        subject: 'Spendlyst Test Email ✅',
        htmlBody: '<h2>It works!</h2><p>If you see this, welcome emails will now work automatically.</p>'
    });

    Logger.log('Test email sent successfully!');
}

function testSendPromotionalEmail() {
    var email = 'kishaninvesq@gmail.com';
    Logger.log('Testing promotional email to ' + email);
    sendPromotionalEmail(email);
}

function testSendFinancialReportEmail() {
    var email = 'kishaninvesq@gmail.com';
    var mockData = {
        totalIncome: '45000',
        totalExpense: '12500',
        incomePercentage: '78',
        expensePercentage: '22',
        foodExpense: '4500',
        shoppingExpense: '2000',
        transportExpense: '1500'
    };
    Logger.log('Testing financial report email to ' + email);
    sendFinancialReportEmail(email, mockData);
}

// Send welcome email using MailApp (simplest Google-native email service)
function sendWelcomeEmail(userEmail, displayName) {
    try {
        var userName = displayName || userEmail.split('@')[0];
        var appLink = 'https://spendlyst.tech'; // Change to your live hosting domain when deployed

        var htmlBody = WELCOME_EMAIL_TEMPLATE
            .replace(/\{\{USER_NAME\}\}/g, userName)
            .replace(/\{\{USER_EMAIL\}\}/g, userEmail)
            .replace(/\{\{APP_LINK\}\}/g, appLink);

        MailApp.sendEmail({
            to: userEmail,
            subject: 'Welcome to Spendlyst 🎉',
            body: 'Welcome to Spendlyst, ' + userName + '! Open the app to get started.',
            htmlBody: htmlBody
        });

        Logger.log('Welcome email sent to ' + userEmail);
    } catch (e) {
        Logger.log('EMAIL ERROR: ' + e.toString());
    }
}

// Welcome email HTML template
const WELCOME_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to Spendlyst</title>
</head>
<body style="margin:0; padding:0; background-color:#E9E6F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    Welcome aboard, {{USER_NAME}} — your money, mapped. Let's get your first account set up.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#E9E6F5; padding: 32px 0;">
    <tr>
      <td align="center">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#FBFAFE; border-radius:20px; overflow:hidden;">

          <!-- Header band -->
          <tr>
            <td style="background: linear-gradient(135deg, #7B5CFA 0%, #5B3DE0 100%); background-color:#7B5CFA; padding: 40px 40px 32px 40px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:52px; height:52px; background-color:rgba(255,255,255,0.18); border-radius:14px; text-align:center; vertical-align:middle;">
                    <span style="color:#ffffff; font-size:24px; font-weight:700;">S</span>
                  </td>
                  <td style="padding-left:14px;">
                    <div style="color:#ffffff; font-size:26px; font-weight:700; letter-spacing:-0.02em; font-family: Arial, sans-serif;">Spendlyst</div>
                    <div style="color:rgba(255,255,255,0.85); font-size:11px; text-transform:uppercase; letter-spacing:0.08em; margin-top:2px;">Money, mapped</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Welcome hero -->
          <tr>
            <td style="padding: 40px 40px 8px 40px;">
              <h1 style="margin:0 0 10px 0; font-size:24px; color:#14121F; font-weight:700; line-height:1.3;">
                Welcome aboard, {{USER_NAME}} 👋
              </h1>
              <p style="margin:0; font-size:14.5px; color:#7A7690; line-height:1.6;">
                You've just taken the first step toward actually knowing where your money goes. No more guessing at month-end — Spendlyst tracks it for you, automatically.
              </p>
            </td>
          </tr>

          <!-- Account confirmation card -->
          <tr>
            <td style="padding: 24px 40px 8px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ECE9F7; border-radius:14px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <div style="font-size:10.5px; text-transform:uppercase; letter-spacing:0.06em; color:#7A7690; font-weight:600; margin-bottom:4px;">Account Created</div>
                    <div style="font-size:15px; font-weight:600; color:#14121F;">{{USER_EMAIL}}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Next steps -->
          <tr>
            <td style="padding: 28px 40px 8px 40px;">
              <div style="font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#14121F; margin-bottom:14px;">
                Get started in 3 steps
              </div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                <tr>
                  <td style="width:32px; vertical-align:top;">
                    <div style="width:24px; height:24px; background-color:#EDE8FF; border-radius:50%; text-align:center; line-height:24px; font-size:12px; font-weight:700; color:#5B3DE0;">1</div>
                  </td>
                  <td style="padding-left:10px; padding-bottom:14px;">
                    <div style="font-size:13.5px; font-weight:600; color:#14121F;">Set up your first account</div>
                    <div style="font-size:12.5px; color:#7A7690; margin-top:2px;">Add your bank, card, or wallet so every transaction has a home.</div>
                  </td>
                </tr>
                <tr>
                  <td style="width:32px; vertical-align:top;">
                    <div style="width:24px; height:24px; background-color:#EDE8FF; border-radius:50%; text-align:center; line-height:24px; font-size:12px; font-weight:700; color:#5B3DE0;">2</div>
                  </td>
                  <td style="padding-left:10px; padding-bottom:14px;">
                    <div style="font-size:13.5px; font-weight:600; color:#14121F;">Log your first transaction</div>
                    <div style="font-size:12.5px; color:#7A7690; margin-top:2px;">Income or expense — either one gets your running balance started.</div>
                  </td>
                </tr>
                <tr>
                  <td style="width:32px; vertical-align:top;">
                    <div style="width:24px; height:24px; background-color:#EDE8FF; border-radius:50%; text-align:center; line-height:24px; font-size:12px; font-weight:700; color:#5B3DE0;">3</div>
                  </td>
                  <td style="padding-left:10px;">
                    <div style="font-size:13.5px; font-weight:600; color:#14121F;">Set a budget</div>
                    <div style="font-size:12.5px; color:#7A7690; margin-top:2px;">Pick a category and a limit — we'll flag it the moment you're close.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td style="padding: 24px 40px 8px 40px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#5B3DE0; border-radius:12px;">
                    <a href="{{APP_LINK}}" target="_blank" style="display:inline-block; padding:14px 36px; font-size:14.5px; font-weight:600; color:#ffffff; text-decoration:none; font-family: Arial, sans-serif;">
                      Open Spendlyst →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security note -->
          <tr>
            <td style="padding: 28px 40px 8px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px dashed #ECE9F7; padding-top:18px;">
                <tr>
                  <td style="padding-top:18px;">
                    <p style="margin:0; font-size:11.5px; color:#7A7690; line-height:1.6;">
                      🔒 Your data is private by default — only you can see your transactions. If you didn't create this account, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px 40px; border-top:1px solid #ECE9F7;" align="center">
              <p style="margin:0 0 4px 0; font-size:11px; color:#7A7690;">
                <span style="font-weight:700; color:#5B3DE0;">Spendlyst</span> · Personal Expense Tracker
              </p>
              <p style="margin:0; font-size:10.5px; color:#B3AFC7;">
                Sent to {{USER_EMAIL}} because you created a Spendlyst account.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
// Send promotional email
function sendPromotionalEmail(userEmail) {
    try {
        MailApp.sendEmail({
            to: userEmail,
            subject: 'Spendlyst - Take Control of Your Finances 🚀',
            htmlBody: PROMOTIONAL_EMAIL_TEMPLATE
        });
        Logger.log('Promotional email sent to ' + userEmail);
        return { success: true, message: 'Promotional email sent to ' + userEmail };
    } catch (e) {
        Logger.log('EMAIL ERROR: ' + e.toString());
        return { success: false, error: e.toString() };
    }
}

// Send financial report email
function sendFinancialReportEmail(userEmail, reportData) {
    try {
        var htmlBody = FINANCIAL_REPORT_TEMPLATE
            .replace(/\{\{totalIncome\}\}/g, reportData.totalIncome || '0')
            .replace(/\{\{totalExpense\}\}/g, reportData.totalExpense || '0')
            .replace(/\{\{incomePercentage\}\}/g, reportData.incomePercentage || '0')
            .replace(/\{\{expensePercentage\}\}/g, reportData.expensePercentage || '0')
            .replace(/\{\{foodExpense\}\}/g, reportData.foodExpense || '0')
            .replace(/\{\{shoppingExpense\}\}/g, reportData.shoppingExpense || '0')
            .replace(/\{\{transportExpense\}\}/g, reportData.transportExpense || '0');

        MailApp.sendEmail({
            to: userEmail,
            subject: 'Your Bi-Weekly Financial Report 📊',
            htmlBody: htmlBody
        });
        Logger.log('Financial report email sent to ' + userEmail);
        return { success: true, message: 'Financial report email sent to ' + userEmail };
    } catch (e) {
        Logger.log('EMAIL ERROR: ' + e.toString());
        return { success: false, error: e.toString() };
    }
}

// Promotional email HTML template
var PROMOTIONAL_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml"
    xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spendlyst - Take Control of Your Finances</title>
    <!--[if !mso]><!-->
    <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Inter:wght@400;500&display=swap"
        rel="stylesheet">
    <!--<![endif]-->
    <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>

<body
    style="margin:0; padding:0; background-color:#F5F5F8; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; -webkit-font-smoothing: antialiased;">

    <!-- Preheader -->
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
        Ready to master your money? Track your income, monitor expenses, and build your dashboard.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="background-color:#F5F5F8; padding: 56px 0;">
        <tr>
            <td align="center">

                <!-- Main Workspace Card -->
                <table role="presentation" width="600" cellpadding="0" cellspacing="0"
                    style="max-width:600px; width:100%; background-color:#FFFFFF; border-radius:24px; overflow:hidden; box-shadow:0 8px 32px rgba(20, 20, 35, 0.02);">

                    <!-- Top Branding Layer -->
                    <tr>
                        <td style="padding: 56px 56px 40px 56px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="left" style="vertical-align: middle; width: 40px;">
                                        <img src="https://spendlyst.tech/assets/icon-192.png" alt="Spendlyst" width="40"
                                            height="40"
                                            style="display:block; border:0; outline:none; width:40px; height:40px;">
                                    </td>
                                    <td align="left" style="padding-left: 12px; vertical-align: middle;">
                                        <div
                                            style="font-size: 18px; font-weight: 700; color: #111111; letter-spacing: -0.02em;">
                                            Spendlyst</div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Editorial Introduction -->
                    <tr>
                        <td style="padding: 0 56px 36px 56px;">
                            <h1
                                style="margin: 0 0 16px 0; font-size: 30px; font-weight: 700; color: #111111; line-height: 1.25; letter-spacing: -0.03em;">
                                Ready to master your money?
                            </h1>
                            <p
                                style="margin: 0; font-size: 15px; color: #666470; line-height: 1.6; font-family: 'Inter', sans-serif;">
                                Hi there,&nbsp;&nbsp;&bull;&nbsp;&nbsp;Managing personal finances doesn’t have to feel
                                like a structural chore. Spendlyst shifts the paradigm, putting full cash-flow metrics
                                right at your fingertips.
                            </p>
                        </td>
                    </tr>

                    <!-- High-Trust Creative Feature Layout (Tonal Shifts Only) -->
                    <tr>
                        <td style="padding: 0 56px 40px 56px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                                style="background-color: #FAF9FC; border-radius: 16px;">
                                <tr>
                                    <td style="padding: 32px;">

                                        <!-- Core Multi-Engine Feature Highlight -->
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                                            style="margin-bottom: 24px;">
                                            <tr>
                                                <td style="vertical-align: top; width: 24px; padding-top: 2px;">
                                                    <span
                                                        style="color: #5B3DE0; font-size: 16px; font-weight: bold;">&rarr;</span>
                                                </td>
                                                <td style="padding-left: 12px;">
                                                    <div
                                                        style="font-size: 15px; font-weight: 600; color: #111111; letter-spacing: -0.01em;">
                                                        Automated Ledger Dynamics</div>
                                                    <div
                                                        style="font-size: 13.5px; color: #666470; margin-top: 4px; line-height: 1.5; font-family: 'Inter', sans-serif;">
                                                        Instantly categorize cash inflows and outward velocities inside
                                                        a clean workspace architecture.</div>
                                                </td>
                                            </tr>
                                        </table>

                                        <!-- Standout Local Capability Callout -->
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="vertical-align: top; width: 24px; padding-top: 2px;">
                                                    <span
                                                        style="color: #5B3DE0; font-size: 16px; font-weight: bold;">&rarr;</span>
                                                </td>
                                                <td style="padding-left: 12px;">
                                                    <div
                                                        style="font-size: 15px; font-weight: 600; color: #111111; letter-spacing: -0.01em;">
                                                        100% Offline Sync Architecture
                                                        <span
                                                            style="display: inline-block; background-color: #EBE8FF; color: #5B3DE0; font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 6px; margin-left: 6px; letter-spacing: 0.04em; font-family: 'Inter', sans-serif;">Local
                                                            First</span>
                                                    </div>
                                                    <div
                                                        style="font-size: 13.5px; color: #666470; margin-top: 4px; line-height: 1.5; font-family: 'Inter', sans-serif;">
                                                        Your database lives securely on-device. Access sub-second
                                                        dashboard rendering and insights completely independent of a
                                                        network connection.</div>
                                                </td>
                                            </tr>
                                        </table>

                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Primary Direct Action Layer -->
                    <tr>
                        <td style="padding: 0 56px 48px 56px;" align="center">
                            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" href="https://spendlyst.tech/#/dashboard" style="height:52px;v-text-anchor:middle;width:488px;" arcsize="24%" stroke="f" fillcolor="#5B3DE0">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">Initialize Your Dashboard &rarr;</center>
                    </v:roundrect>
                    <![endif]-->
                                        <!--[if !mso]><!-->
                                        <a href="https://spendlyst.tech/#/dashboard" target="_blank"
                                            style="display:block; background-color:#5B3DE0; border-radius:12px; padding:16px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; text-align:center; letter-spacing: -0.01em; box-shadow: 0 12px 24px rgba(91, 61, 224, 0.15);">
                                            Initialize Your Dashboard &rarr;
                                        </a>
                                        <!--<![endif]-->
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Signature Block -->
                    <tr>
                        <td style="padding: 0 56px 56px 56px;">
                            <p
                                style="margin: 0; font-size: 15px; color: #666470; line-height: 1.6; font-family: 'Inter', sans-serif;">
                                Join thousands tracking wealth safely through local execution engines.<br><br>
                                Best regards,<br>
                                <span style="color: #111111; font-weight: 600;">The Spendlyst Team</span>
                            </p>
                        </td>
                    </tr>

                    <!-- Sub-Card Structural Footer Space -->
                    <tr>
                        <td style="padding: 32px 56px; background-color:#FAF9FC;" align="center">
                            <p
                                style="margin:0 0 12px 0; font-size:11px; color:#A19FB0; line-height:1.5; font-family: 'Inter', sans-serif;">
                                You are receiving this communication due to an active sub-layer notification request
                                with Spendlyst Core.
                            </p>
                            <p style="margin:0; font-size:12px; font-weight:500;">
                                <a href="#" style="color:#5B3DE0; text-decoration:none;">Unsubscribe Workspace</a>
                                <span style="color:#D1CDE0; margin: 0 8px;">&bull;</span>
                                <a href="#" style="color:#5B3DE0; text-decoration:none;">Privacy Parameters</a>
                            </p>
                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

</body>

</html>`;

// Financial report email HTML template
var FINANCIAL_REPORT_TEMPLATE = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml"
    xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bi-Weekly Financial Report</title>
    <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet">
</head>

<body
    style="margin:0; padding:0; background-color:#F5F4F8; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased;">

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="background-color:#F5F4F8; padding: 64px 0;">
        <tr>
            <td align="center">

                <!-- Main Report Container -->
                <table role="presentation" width="600" cellpadding="0" cellspacing="0"
                    style="max-width:600px; width:100%; background-color:#FFFFFF; border-radius:24px; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.03);">

                    <!-- Report Header -->
                    <tr>
                        <td style="padding: 56px 56px 40px 56px; background-color: #FFFFFF;">
                            <div
                                style="font-size: 12px; font-weight: 700; color: #5B3DE0; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
                                Financial Ledger
                            </div>
                            <h1
                                style="margin: 0; font-size: 32px; font-weight: 700; color: #111111; letter-spacing: -0.03em;">
                                Bi-Weekly Summary
                            </h1>
                            <div
                                style="margin-top: 12px; font-size: 15px; color: #888694; font-family: 'Inter', sans-serif;">
                                July 1 – July 15, 2026
                            </div>
                        </td>
                    </tr>

                    <!-- Summary Section (Tonal Separation) -->
                    <tr>
                        <td style="padding: 0 56px 40px 56px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <!-- Income Box -->
                                    <td width="48%"
                                        style="background-color: #F0FDF4; border-radius: 16px; padding: 24px;">
                                        <div
                                            style="font-size: 11px; font-weight: 700; color: #15803D; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
                                            Total Income</div>
                                        <div
                                            style="font-size: 20px; font-weight: 700; color: #111111; font-family: 'Inter', sans-serif;">
                                            ₹{{totalIncome}}</div>
                                    </td>
                                    <td width="4%">&nbsp;</td>
                                    <!-- Expense Box -->
                                    <td width="48%"
                                        style="background-color: #FFF1F2; border-radius: 16px; padding: 24px;">
                                        <div
                                            style="font-size: 11px; font-weight: 700; color: #B91C1C; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
                                            Total Expenses</div>
                                        <div
                                            style="font-size: 20px; font-weight: 700; color: #111111; font-family: 'Inter', sans-serif;">
                                            ₹{{totalExpense}}</div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Visualization Block -->
                    <tr>
                        <td style="padding: 0 56px 48px 56px;">
                            <div style="font-size: 14px; font-weight: 600; color: #111111; margin-bottom: 16px;">Flow
                                Analysis</div>

                            <!-- Multi-Segment Progress Bar -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                                style="height: 12px; border-radius: 6px; overflow: hidden; background-color: #F0F0F2;">
                                <tr>
                                    <td width="{{incomePercentage}}%" style="background-color: #22C55E;"></td>
                                    <td width="{{expensePercentage}}%" style="background-color: #EF4444;"></td>
                                </tr>
                            </table>

                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                                style="margin-top: 12px;">
                                <tr>
                                    <td align="left" style="font-size: 12px; font-weight: 600; color: #22C55E;">
                                        {{incomePercentage}}% Income</td>
                                    <td align="right" style="font-size: 12px; font-weight: 600; color: #EF4444;">
                                        {{expensePercentage}}% Expense</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Top Spending Section (Spacing-based list) -->
                    <tr>
                        <td style="background-color: #FAF9FC; padding: 48px 56px;">
                            <div style="font-size: 14px; font-weight: 600; color: #111111; margin-bottom: 24px;">Top
                                Expenditures</div>

                            <!-- List Item 1 -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                                style="margin-bottom: 20px;">
                                <tr>
                                    <td width="40">
                                        <div
                                            style="width: 32px; height: 32px; background-color: #ECECF2; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">
                                            🍔</div>
                                    </td>
                                    <td style="font-size: 14.5px; font-weight: 500; color: #111111;">Food & Dining</td>
                                    <td align="right" style="font-size: 14.5px; font-weight: 600; color: #111111;">
                                        ₹{{foodExpense}}</td>
                                </tr>
                            </table>

                            <!-- List Item 2 -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                                style="margin-bottom: 20px;">
                                <tr>
                                    <td width="40">
                                        <div
                                            style="width: 32px; height: 32px; background-color: #ECECF2; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">
                                            🛍️</div>
                                    </td>
                                    <td style="font-size: 14.5px; font-weight: 500; color: #111111;">Shopping</td>
                                    <td align="right" style="font-size: 14.5px; font-weight: 600; color: #111111;">
                                        ₹{{shoppingExpense}}</td>
                                </tr>
                            </table>

                            <!-- List Item 3 -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td width="40">
                                        <div
                                            style="width: 32px; height: 32px; background-color: #ECECF2; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">
                                            🚗</div>
                                    </td>
                                    <td style="font-size: 14.5px; font-weight: 500; color: #111111;">Transport</td>
                                    <td align="right" style="font-size: 14.5px; font-weight: 600; color: #111111;">
                                        ₹{{transportExpense}}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CTA Block -->
                    <tr>
                        <td style="padding: 48px 56px 56px 56px;" align="center">
                            <a href="https://spendlyst.tech/#/dashboard"
                                style="display:inline-block; background-color:#5B3DE0; color:#ffffff; text-decoration:none; padding:16px 32px; border-radius:12px; font-weight:600; font-size:14px; letter-spacing: -0.01em;">
                                View Full Analysis &rarr;
                            </a>
                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

</body>

</html>`;

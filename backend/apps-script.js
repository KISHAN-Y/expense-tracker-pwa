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

// Get spreadsheet
function getSheet() {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = getSheetByNameCaseInsensitive(ss, SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        sheet.appendRow(['ID', 'Date', 'Type', 'Category', 'Amount', 'Description', 'CreatedAt', 'UserId']);
    } else {
        // Automatically check if UserId header exists, if not, append it
        const headers = sheet.getDataRange().getValues()[0];
        if (findHeaderIndex(headers, 'UserId') === -1) {
            sheet.getRange(1, headers.length + 1).setValue('UserId');
            SpreadsheetApp.flush();
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

// Send welcome email using MailApp (simplest Google-native email service)
function sendWelcomeEmail(userEmail, displayName) {
    try {
        var userName = displayName || userEmail.split('@')[0];
        var appLink = 'http://localhost:5500'; // Change to your live hosting domain when deployed
        
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


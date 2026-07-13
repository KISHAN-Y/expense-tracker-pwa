const auth = require('./auth');
const transactions = require('./transactions');
const profile = require('./profile');
const budgets = require('./budgets');
const dashboard = require('./dashboard');

/**
 * Parse POST/PUT request body stream into JSON object
 */
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', err => {
            reject(err);
        });
    });
}

/**
 * Helper to respond with JSON data
 */
function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

/**
 * API Central Request Handler & Router
 */
async function apiHandler(req, res) {
    // Add CORS headers to all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Parse URL and parameters
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname.replace(/\/$/, ''); // strip trailing slash
    const queryParams = parsedUrl.searchParams;

    try {
        // ==========================================
        // 1. Action-based Endpoint Protocol (Legacy / Apps Script mirror)
        // Matches GET/POST /api or /api/endpoint
        // ==========================================
        if (pathname === '/api' || pathname === '/api/endpoint') {
            if (req.method === 'GET') {
                const userId = queryParams.get('userId') || 'default';
                const result = transactions.getTransactions(userId);
                return sendJson(res, 200, result);
            }

            if (req.method === 'POST') {
                const body = await parseBody(req);
                const { action, data, userId } = body;

                switch (action) {
                    case 'REGISTER':
                        return sendJson(res, 200, auth.register(data.email, data.password, data.displayName));
                    case 'LOGIN':
                        return sendJson(res, 200, auth.login(data.email, data.password));
                    case 'CREATE':
                        return sendJson(res, 200, transactions.createTransaction(data, userId));
                    case 'UPDATE':
                        return sendJson(res, 200, transactions.updateTransaction(data, userId));
                    case 'DELETE':
                        return sendJson(res, 200, transactions.deleteTransaction(data.id, userId));
                    case 'GET_DASHBOARD':
                        return sendJson(res, 200, dashboard.getDashboardStats(userId));
                    case 'GET_PROFILE':
                        return sendJson(res, 200, profile.getProfile(userId));
                    case 'UPDATE_PROFILE':
                        return sendJson(res, 200, profile.updateProfile(userId, data));
                    case 'GET_BUDGETS':
                        return sendJson(res, 200, budgets.getBudgets(userId));
                    case 'CREATE_BUDGET':
                        return sendJson(res, 200, budgets.createBudget(data, userId));
                    case 'UPDATE_BUDGET':
                        return sendJson(res, 200, budgets.updateBudget(data, userId));
                    case 'DELETE_BUDGET':
                        return sendJson(res, 200, budgets.deleteBudget(data.id, userId));
                    case 'SEND_PROMO_EMAIL':
                        console.log(`\x1b[35m[EMAIL SIMULATION]\x1b[0m Promotional email simulated for ${data.email}`);
                        return sendJson(res, 200, { success: true, message: 'Promotional email simulated' });
                    case 'SEND_REPORT_EMAIL':
                        console.log(`\x1b[35m[EMAIL SIMULATION]\x1b[0m Financial report email simulated for ${data.email}`);
                        return sendJson(res, 200, { success: true, message: 'Financial report email simulated' });
                    default:
                        return sendJson(res, 400, { success: false, error: 'Invalid action specified' });
                }
            }

            return sendJson(res, 405, { success: false, error: 'Method not allowed on this path' });
        }

        // ==========================================
        // 2. RESTful HTTP Endpoint Routes (Mobile / Modern API style)
        // ==========================================

        // Health Check: GET /api/health
        if (pathname === '/api/health') {
            if (req.method === 'GET') {
                let dbStatus = 'healthy';
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const usersFile = path.join(__dirname, '..', 'data', 'users.json');
                    const txFile = path.join(__dirname, '..', 'data', 'transactions.json');
                    
                    // Verify database files are readable and writable
                    fs.accessSync(usersFile, fs.constants.R_OK | fs.constants.W_OK);
                    fs.accessSync(txFile, fs.constants.R_OK | fs.constants.W_OK);
                } catch (err) {
                    dbStatus = 'degraded';
                }

                return sendJson(res, 200, {
                    status: 'healthy',
                    database: dbStatus,
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime()
                });
            }
            return sendJson(res, 405, { success: false, error: 'Method not allowed on /api/health' });
        }

        // Registration: POST /api/auth/register
        if (pathname === '/api/auth/register') {
            if (req.method === 'POST') {
                const body = await parseBody(req);
                const result = auth.register(body.email, body.password, body.displayName);
                const status = result.success ? 201 : 400;
                return sendJson(res, status, result);
            }
            return sendJson(res, 405, { success: false, error: 'Method not allowed on /api/auth/register' });
        }

        // Login: POST /api/auth/login
        if (pathname === '/api/auth/login') {
            if (req.method === 'POST') {
                const body = await parseBody(req);
                const result = auth.login(body.email, body.password);
                const status = result.success ? 200 : 401;
                return sendJson(res, status, result);
            }
            return sendJson(res, 405, { success: false, error: 'Method not allowed on /api/auth/login' });
        }

        // Transactions CRUD:
        if (pathname === '/api/transactions') {
            // GET /api/transactions?userId=xxx
            if (req.method === 'GET') {
                const userId = queryParams.get('userId') || 'default';
                const result = transactions.getTransactions(userId);
                return sendJson(res, 200, result);
            }

            // POST /api/transactions
            if (req.method === 'POST') {
                const body = await parseBody(req);
                const txData = body.transaction || body;
                const userId = body.userId || queryParams.get('userId') || 'default';
                
                const result = transactions.createTransaction(txData, userId);
                const status = result.success ? 201 : 400;
                return sendJson(res, status, result);
            }

            // PUT /api/transactions
            if (req.method === 'PUT') {
                const body = await parseBody(req);
                const txData = body.transaction || body;
                const userId = body.userId || queryParams.get('userId') || 'default';

                const result = transactions.updateTransaction(txData, userId);
                const status = result.success ? 200 : 400;
                return sendJson(res, status, result);
            }

            // DELETE /api/transactions?id=xxx or body.id
            if (req.method === 'DELETE') {
                const body = await parseBody(req).catch(() => ({}));
                const id = queryParams.get('id') || body.id;
                const userId = queryParams.get('userId') || body.userId || 'default';

                const result = transactions.deleteTransaction(id, userId);
                const status = result.success ? 200 : 400;
                return sendJson(res, status, result);
            }

            return sendJson(res, 405, { success: false, error: 'Method not allowed on /api/transactions' });
        }

        // Dashboard Endpoint: GET /api/dashboard?userId=xxx
        if (pathname === '/api/dashboard') {
            if (req.method === 'GET') {
                const userId = queryParams.get('userId') || 'default';
                const result = dashboard.getDashboardStats(userId);
                return sendJson(res, 200, result);
            }
            return sendJson(res, 405, { success: false, error: 'Method not allowed on /api/dashboard' });
        }

        // Profile Endpoint: GET /api/profile?userId=xxx or PUT /api/profile
        if (pathname === '/api/profile') {
            if (req.method === 'GET') {
                const userId = queryParams.get('userId') || 'default';
                const result = profile.getProfile(userId);
                const status = result.success ? 200 : 404;
                return sendJson(res, status, result);
            }
            if (req.method === 'PUT') {
                const body = await parseBody(req);
                const userId = body.userId || queryParams.get('userId') || 'default';
                const profileData = body.profile || body;
                const result = profile.updateProfile(userId, profileData);
                const status = result.success ? 200 : 400;
                return sendJson(res, status, result);
            }
            return sendJson(res, 405, { success: false, error: 'Method not allowed on /api/profile' });
        }

        // Budgets CRUD Endpoints:
        if (pathname === '/api/budgets') {
            // GET /api/budgets?userId=xxx
            if (req.method === 'GET') {
                const userId = queryParams.get('userId') || 'default';
                const result = budgets.getBudgets(userId);
                return sendJson(res, 200, result);
            }

            // POST /api/budgets
            if (req.method === 'POST') {
                const body = await parseBody(req);
                const budgetData = body.budget || body;
                const userId = body.userId || queryParams.get('userId') || 'default';
                const result = budgets.createBudget(budgetData, userId);
                const status = result.success ? 201 : 400;
                return sendJson(res, status, result);
            }

            // PUT /api/budgets
            if (req.method === 'PUT') {
                const body = await parseBody(req);
                const budgetData = body.budget || body;
                const userId = body.userId || queryParams.get('userId') || 'default';
                const result = budgets.updateBudget(budgetData, userId);
                const status = result.success ? 200 : 400;
                return sendJson(res, status, result);
            }

            // DELETE /api/budgets?id=xxx or body.id
            if (req.method === 'DELETE') {
                const body = await parseBody(req).catch(() => ({}));
                const id = queryParams.get('id') || body.id;
                const userId = queryParams.get('userId') || body.userId || 'default';
                const result = budgets.deleteBudget(id, userId);
                const status = result.success ? 200 : 400;
                return sendJson(res, status, result);
            }

            return sendJson(res, 405, { success: false, error: 'Method not allowed on /api/budgets' });
        }

        // Route not found
        return sendJson(res, 404, { success: false, error: `Route not found: ${req.method} ${pathname}` });

    } catch (error) {
        console.error('API Error: ', error);
        return sendJson(res, 500, { success: false, error: 'Internal Server Error', details: error.message });
    }
}

module.exports = apiHandler;

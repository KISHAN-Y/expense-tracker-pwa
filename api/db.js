const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');

// Initialize database storage
function initDb() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
    if (!fs.existsSync(TRANSACTIONS_FILE)) {
        fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
}

// Ensure db runs initialization immediately
initDb();

/**
 * Helper to read JSON file
 */
function readJsonFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`Error reading database file at ${filePath}:`, error);
        return [];
    }
}

/**
 * Helper to write JSON file safely
 */
function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error(`Error writing database file at ${filePath}:`, error);
        return false;
    }
}

/**
 * Hash password with SHA-256 and salt (matches Apps Script format)
 */
function hashPassword(password, salt) {
    return crypto.createHash('sha256').update(password + salt).digest('hex');
}

/**
 * Generate random hex string (for user IDs, salts, etc.)
 */
function generateRandomHex(length) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

module.exports = {
    getUsers: () => readJsonFile(USERS_FILE),
    saveUsers: (users) => writeJsonFile(USERS_FILE, users),
    getTransactions: () => readJsonFile(TRANSACTIONS_FILE),
    saveTransactions: (txs) => writeJsonFile(TRANSACTIONS_FILE, txs),
    hashPassword,
    generateRandomHex
};

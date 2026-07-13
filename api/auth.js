const db = require('./db');

function registerUser(email, password, displayName) {
    if (!email || !password) {
        return { success: false, error: 'Email and password are required' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const users = db.getUsers();

    // Check if user already exists
    const exists = users.find(u => u.email === cleanEmail);
    if (exists) {
        return { success: false, error: 'User already exists' };
    }

    const userId = 'u-' + db.generateRandomHex(16);
    const salt = db.generateRandomHex(16);
    const hash = db.hashPassword(password, salt);
    const displayNameVal = displayName || email.split('@')[0];

    const newUser = {
        userId,
        email: cleanEmail,
        passwordHash: hash,
        salt,
        createdAt: new Date().toISOString(),
        displayName: displayNameVal
    };

    users.push(newUser);
    db.saveUsers(users);

    console.log(`\x1b[35m[EMAIL SIMULATION]\x1b[0m Welcome email simulation for: ${cleanEmail}`);
    console.log(`  To: ${cleanEmail}`);
    console.log(`  Subject: Welcome to Spendlyst 🎉`);
    console.log(`  Body: Welcome ${displayNameVal}! Your account is active. ID: ${userId}`);

    return {
        success: true,
        user: { id: userId, email: cleanEmail, displayName: displayNameVal }
    };
}

function loginUser(email, password) {
    if (!email || !password) {
        return { success: false, error: 'Email and password are required' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const users = db.getUsers();

    const user = users.find(u => u.email === cleanEmail);
    if (!user) {
        return { success: false, error: 'User not found' };
    }

    const computedHash = db.hashPassword(password, user.salt);
    if (computedHash !== user.passwordHash) {
        return { success: false, error: 'Incorrect password' };
    }

    return {
        success: true,
        user: { id: user.userId, email: user.email, displayName: user.displayName }
    };
}

module.exports = {
    register: registerUser,
    login: loginUser
};

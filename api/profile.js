const db = require('./db');

function getProfile(userId) {
    const targetUserId = userId || 'default';
    const users = db.getUsers();
    const user = users.find(u => u.userId === targetUserId);

    if (!user) {
        return { success: false, error: 'User profile not found' };
    }

    // Strip passwordHash and salt
    const { passwordHash, salt, ...profile } = user;

    // Default values if not set
    if (profile.avatarGradient === undefined) profile.avatarGradient = 0;
    if (profile.memberSince === undefined) profile.memberSince = new Date(profile.createdAt || Date.now()).getFullYear().toString();
    if (profile.currency === undefined) profile.currency = 'INR';

    return {
        success: true,
        profile
    };
}

function updateProfile(userId, profileData) {
    const targetUserId = userId || 'default';
    const users = db.getUsers();
    const userIndex = users.findIndex(u => u.userId === targetUserId);

    if (userIndex === -1) {
        return { success: false, error: 'User profile not found' };
    }

    const user = users[userIndex];

    // Update allowed fields
    if (profileData.displayName !== undefined) {
        user.displayName = profileData.displayName.trim();
    }
    if (profileData.avatarGradient !== undefined) {
        user.avatarGradient = parseInt(profileData.avatarGradient, 10);
    }
    if (profileData.memberSince !== undefined) {
        user.memberSince = profileData.memberSince.toString();
    }
    if (profileData.currency !== undefined) {
        user.currency = profileData.currency.toString().toUpperCase();
    }

    users[userIndex] = user;
    db.saveUsers(users);

    const { passwordHash, salt, ...profile } = user;

    return {
        success: true,
        message: 'Profile updated successfully',
        profile
    };
}

module.exports = {
    getProfile,
    updateProfile
};

const { google } = require('googleapis');
const config = require('./config');

// Cache userId -> email mappings to avoid repeated API calls
const userEmailCache = {};

/**
 * Look up a user's email address from their Google profile ID
 * using the Admin SDK Directory API.
 *
 * Requires:
 * - Admin SDK API enabled in GCP
 * - Domain-Wide Delegation scope: https://www.googleapis.com/auth/admin.directory.user.readonly
 * - GOOGLE_ADMIN_EMAIL env var set to a Workspace admin email (needed to bootstrap the lookup)
 */
async function getUserEmail(userId) {
    if (!userId) return null;

    // Return cached result if available
    if (userEmailCache[userId]) {
        return userEmailCache[userId];
    }

    const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;
    if (!adminEmail) {
        console.error('GOOGLE_ADMIN_EMAIL not set. Cannot look up user email from userId.');
        return null;
    }

    try {
        // Use the admin email to bootstrap — we need *someone* to impersonate
        // in order to call the Admin SDK. The admin email is the natural choice.
        const auth = new google.auth.JWT({
            email: config.google.serviceAccountEmail,
            key: config.google.privateKey,
            scopes: ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
            subject: adminEmail,
        });

        const admin = google.admin({ version: 'directory_v1', auth });

        // The userId from Drive's state param is a Google account ID.
        // We can look it up directly via the Admin SDK.
        const { data: user } = await admin.users.get({
            userKey: userId,
        });

        const email = user.primaryEmail;
        userEmailCache[userId] = email;
        console.log(`Resolved userId ${userId} -> ${email}`);
        return email;
    } catch (err) {
        console.error(`Failed to resolve userId ${userId}:`, err.message);
        return null;
    }
}

module.exports = { getUserEmail };

const { getDriveService } = require('./server/drive');
async function test() {
    const drive = getDriveService();
    const authClient = drive.context._options.auth;
    try {
        const res = await authClient.getAccessToken();
        console.log("Token:", res.token ? "YES" : "NO", res.token?.substring(0, 10));
    } catch (e) {
        console.error("Error:", e.message);
    }
}
test();

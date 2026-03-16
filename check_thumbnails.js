const { google } = require('googleapis');

async function checkThumbnails() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/Users/josuevillalonagmail.com/Downloads/driveplsy-4b791a37ad75.json',
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        const drive = google.drive({ version: 'v3', auth });
        const driveId = '0ALpP5a2VxRU1Uk9PVA';

        let queryOptions = {
            q: "mimeType contains 'video/'",
            corpora: 'drive',
            driveId: driveId,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            fields: 'files(id, name, hasThumbnail, modifiedTime)',
            orderBy: 'modifiedTime desc',  // Processing a thumbnail changes the modified time
            pageSize: 100
        };

        const result = await drive.files.list(queryOptions);
        const videos = result.data.files;
        
        const processed = videos.filter(f => f.hasThumbnail);

        console.log(`\n=== Newly Processed Files (Last 15) ===\n`);
        processed.slice(0, 15).forEach(f => {
            console.log(`✅ File Name: ${f.name}`);
            console.log(`   File ID:   ${f.id}`);
            console.log(`   Modified:  ${new Date(f.modifiedTime).toLocaleString()}`);
            console.log(`-------------------------------------------------`);
        });

    } catch (err) {
        console.error('Error checking thumbnails:', err.message);
    }
}

checkThumbnails();

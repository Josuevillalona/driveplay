const { google } = require('googleapis');

async function checkThumbnails() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: '/Users/josuevillalonagmail.com/Downloads/driveplsy-4b791a37ad75.json',
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        const drive = google.drive({ version: 'v3', auth });
        const driveId = '0ALpP5a2VxRU1Uk9PVA';

        // Fetch recently modified videos with thumbnails, including their parent folder ID
        const result = await drive.files.list({
            q: "mimeType contains 'video/'",
            corpora: 'drive',
            driveId: driveId,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            fields: 'files(id, name, hasThumbnail, modifiedTime, parents)',
            orderBy: 'modifiedTime desc',
            pageSize: 10
        });

        const processed = result.data.files.filter(f => f.hasThumbnail);

        console.log(`\n=== Successfully Thumbnailed Files (Most Recent) ===\n`);

        for (const f of processed.slice(0, 8)) {
            // Fetch the parent folder name
            let folderName = '(root)';
            if (f.parents && f.parents.length > 0) {
                try {
                    const folder = await drive.files.get({
                        fileId: f.parents[0],
                        supportsAllDrives: true,
                        fields: 'name'
                    });
                    folderName = folder.data.name;
                } catch (_) {}
            }

            console.log(`✅ ${folderName} / ${f.name}`);
            console.log(`   File ID: ${f.id}`);
            console.log(`   Drive Link: https://drive.google.com/file/d/${f.id}/view`);
            console.log(`-------------------------------------------------`);
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkThumbnails();

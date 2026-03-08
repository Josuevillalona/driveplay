# DrivePlay: Google Cloud & Workspace Setup Guide

To get DrivePlay working with your organization's Drive (using "Open With"), you need to set up a Google Cloud Project (GCP) and grant it permissions in your Google Workspace Admin Console. **You must be logged into your business/Workspace email for all of these steps.**

Here is the step-by-step walkthrough to get this running:

---

## Part 1: Google Cloud Console (The Project & Credentials)
Go to [console.cloud.google.com](https://console.cloud.google.com/) and ensure you're in your business account via the top-right profile icon.

### 1. Create the Project
1. In the top-left navigation bar, click the **Project Dropdown** (or "Select a project").
2. Click **New Project** in the top right of the modal.
3. Enter `DrivePlay` as the Project Name. Ensure the "Organization" matches your business domain.
4. Click **Create** and wait a moment for it to finish. Select the new project once done.

### 2. Enable APIs
1. Search for **"Google Drive API"** in the top search bar and click it.
2. Click **Enable**.
3. Search for **"Google Workspace Marketplace SDK"** in the top search bar and click it. (We need this to force-install the app for your team without requiring user login.)
4. Click **Enable**.

### 3. Create the Service Account
1. Search for **"Service Accounts"** in the top bar and click it (under IAM & Admin).
2. Click **+ Create Service Account** at the top.
3. Name it `driveplay-service` and click **Create and Continue**.
4. Skip the "Grant this service account access to project" step (click **Continue**).
5. Click **Done**.
6. In the list, click the email address of the service account you just created.
7. Go to the **"Advanced Settings"** or look for the **"Unique ID"** (Client ID). **Copy this Client ID** (a long number) — you need it for Part 2!
8. Go to the **KEYS** tab at the top.
9. Click **Add Key** -> **Create New Key**.
10. Choose **JSON** and click **Create**. The key file will download. Open it in a text editor — you will need the `client_email` and `private_key` for your `.env` file (and Render later).

### 4. Setup OAuth Consent Screen
*Even with a Service Account, Google needs an OAuth screen to power UI integrations like "Open With."*
1. Go to **APIs & Services -> OAuth consent screen**.
2. Select **Internal** (this locks it to your company) and click **Create**.
3. Set App Name to `DrivePlay`.
4. Enter your admin email for **User support email** and **Developer contact information**.
5. Click **Save and Continue** through the Scopes and Summary screens (no scopes needed here).

---

## Part 2: Google Workspace Admin (The Permissions)
Go to [admin.google.com](https://admin.google.com/) and log in as your domain admin.

### 1. Grant Domain-Wide Delegation
1. Go to **Security > Access and data control > API controls**. 
*(If you don't see it, search "API controls" in the admin search bar).*
2. Scroll to the bottom and click **Manage Domain Wide Delegation**.
3. Click **Add new**.
4. **Client ID**: Paste the numeric Client ID you copied from the Service Account in Part 1.
5. **OAuth scopes**: Paste exactly `https://www.googleapis.com/auth/drive.readonly`
6. Click **Authorize**.
*(This gives the Service Account permission to read files on behalf of your domain without users having to log in.)*

---

## Part 3: Google Workspace Marketplace SDK (The "Open With" Menu)
Go back to [console.cloud.google.com](https://console.cloud.google.com/) and ensure your DrivePlay project is selected.

### 1. App Configuration
1. Search for **"Google Workspace Marketplace SDK"** and click **Manage**.
2. Click the **App Configuration** tab on the left.
3. Under App Visibility, select **Private** (only available to your domain).
4. Fill out the **Store setup** details (Language, App name, Short description = "Stream Drive videos", detailed description).
5. Provide a Developer name and your business website URL.
6. Check **Universal navigation extension**.
7. Check **Drive extension**.
8. Under **Drive extension**:
   - **Document URL**: Enter `https://<YOUR-RENDER-URL>/open?state={state}` (You can use `http://localhost:3000/open?state={state}` to test locally first, but remember to update it).
   - Add MIME types: `video/mp4`, `video/quicktime`
   - Uncheck "Create new files".
9. Click **Save**.

---

## Part 4: Install the App for your Team (Force-Install)
Go back to [admin.google.com](https://admin.google.com/).

1. Go to **Apps > Google Workspace Marketplace apps > App list**.
2. Click **Install app**.
3. Select **Internal apps** on the left. You should see DrivePlay.
4. Click it, then click **Admin install**. Follow the prompts to install it for everyone.

**Done!** Now, when anyone in your org right-clicks an MP4 or MOV in Google Drive, they will see "Open With -> DrivePlay". The ID gets sent to your server, your service account fetches the file using Domain-Wide Delegation, and streams it back to them!

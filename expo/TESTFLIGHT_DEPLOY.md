# TestFlight Deployment Guide

This guide will walk you through deploying **SnapKeep Organizer** to TestFlight for beta testing.

## Prerequisites

- ✅ Apple Developer Account ($99/year) - [Sign up here](https://developer.apple.com/programs/)
- ✅ Expo account - [Create free account](https://expo.dev/signup)
- ✅ EAS CLI installed (already done)
- ✅ Project configured with `eas.json` (already done)

## Step 1: Login to EAS

```bash
eas login
```

Enter your Expo credentials when prompted.

## Step 2: Configure iOS Credentials

Before building, you need to set up your Apple Developer credentials:

```bash
eas credentials
```

Select:
1. **iOS** platform
2. **Production** profile
3. Let EAS manage your credentials (recommended)

EAS will:
- Create a Distribution Certificate
- Generate an App Store Provisioning Profile
- Store them securely in Expo's servers

**Alternative:** If you prefer to manage credentials manually, you can upload them through the Expo dashboard.

## Step 3: Update eas.json with Your Apple ID

Edit `eas.json` and update the `submit.production.ios` section:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-actual-apple-id@example.com",
        "ascAppId": "your-app-store-connect-app-id",
        "appleTeamId": "your-team-id"
      }
    }
  }
}
```

**To find these values:**
- **appleId**: Your Apple ID email
- **ascAppId**: Found in App Store Connect (numeric ID in the URL when viewing your app)
- **appleTeamId**: Found in Apple Developer Portal → Membership

## Step 4: Create App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **Apps** → **+** (Add New App)
3. Fill in:
   - **Platform**: iOS
   - **Name**: SnapKeep Organizer
   - **Primary Language**: English
   - **Bundle ID**: `app.rork.snapkeep-organizer`
   - **SKU**: `snapkeep-organizer-001` (or any unique identifier)
4. Click **Create**

## Step 5: Build for Production

Run the build command:

```bash
npm run build:ios
```

Or directly:

```bash
eas build --platform ios --profile production
```

This will:
- ✅ Upload your code to EAS servers
- ✅ Build the app in the cloud (takes 10-20 minutes)
- ✅ Auto-increment the build number
- ✅ Generate a signed `.ipa` file

**Monitor the build:**
- You'll get a URL to watch the build progress
- You'll receive an email when the build completes

## Step 6: Submit to TestFlight

Once the build completes:

```bash
npm run submit:ios
```

Or directly:

```bash
eas submit --platform ios --profile production
```

This uploads the `.ipa` to App Store Connect and makes it available in TestFlight.

**Alternative Manual Upload:**
1. Download the `.ipa` from the build page
2. Open **Transporter** app (on macOS)
3. Drag and drop the `.ipa` file
4. Click **Deliver**

## Step 7: Configure TestFlight

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app → **TestFlight** tab
3. Wait for "Processing" to complete (usually 5-10 minutes)
4. Fill in **Test Information**:
   - Beta App Description
   - Feedback Email
   - What to Test notes
5. Add **Internal Testers** (up to 100 testers, no review needed)
6. Or add **External Testers** (requires Apple review, 1-2 days)

## Step 8: Invite Testers

**Internal Testing (Immediate):**
1. Go to **TestFlight** → **Internal Testing**
2. Click **+** to add testers
3. Enter email addresses
4. Testers receive invite immediately

**External Testing (Requires Review):**
1. Go to **TestFlight** → **External Testing**
2. Create a test group
3. Add testers
4. Submit for Beta App Review
5. Wait 24-48 hours for approval
6. Once approved, testers can install

## Step 9: Testers Install the App

Testers will:
1. Receive an email invitation
2. Install **TestFlight** from App Store
3. Accept the invitation
4. Download and install your app

## Common Commands

```bash
# Login to Expo
eas login

# Build for production (TestFlight)
npm run build:ios

# Build a preview version (internal distribution)
npm run build:ios:preview

# Submit to TestFlight
npm run submit:ios

# Check build status
eas build:list

# View credentials
eas credentials

# Run local iOS build (for testing)
npm run ios
```

## Updating the App

When you make changes and want to release a new version:

1. **Update version in `app.json`:**
   ```json
   {
     "version": "1.0.2"  // Increment version
   }
   ```

2. **Build number auto-increments** (handled by `eas.json` config)

3. **Build and submit:**
   ```bash
   npm run build:ios
   npm run submit:ios
   ```

4. Testers will receive a notification of the new version in TestFlight

## Troubleshooting

### "No matching provisioning profile found"
Run `eas credentials` and regenerate your provisioning profile.

### "Bundle identifier is already in use"
Ensure your Bundle ID in `app.json` matches the one registered in Apple Developer Portal.

### "Build failed during compilation"
Check the build logs in the EAS dashboard for specific error messages.

### "App stuck in Processing"
This can take up to 30 minutes. If longer, contact Apple Support through App Store Connect.

### "TestFlight invitation not received"
- Check spam folder
- Verify email address is correct
- Ensure tester has accepted Apple's TestFlight terms

## Cost Breakdown

- **Apple Developer Account**: $99/year (required)
- **Expo EAS Build**: Free tier includes limited builds, paid plans for more
- **TestFlight Distribution**: Free (included with Apple Developer Account)

## Next Steps

After successful TestFlight testing:
1. Submit for **App Store Review**
2. Prepare marketing materials (screenshots, description, etc.)
3. Set pricing and availability
4. Submit for production release

## Support

- **Expo EAS Docs**: https://docs.expo.dev/build/introduction/
- **TestFlight Guide**: https://developer.apple.com/testflight/
- **App Store Connect**: https://appstoreconnect.apple.com

---

**Current Configuration:**
- App Name: SnapKeep Organizer
- Bundle ID: `app.rork.snapkeep-organizer`
- Version: 1.0.1
- Build Number: 1 (auto-increments)

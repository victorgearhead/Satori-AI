# GCP + Firebase Deploy Steps

## 1) Prepare files

1. Copy `.env.example` to `.env.local`.
2. Fill `.env.local` with:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
GOOGLE_API_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

## 2) One-command deploy (recommended)

Run in PowerShell from project root:

```powershell
.\scripts\deploy-gcp.ps1 -ProjectId YOUR_FIREBASE_PROJECT_ID -SeedData
```

## 3) Manual deploy (if not using script)

Run in this exact order from project root:

```powershell
npm install
npm run typecheck
npx firebase login
npx firebase use YOUR_FIREBASE_PROJECT_ID
npm run deploy:rules
npm run seed
npm run deploy:app
```

## 4) Firebase Console required clicks

1. Open Firebase Console -> your project.
2. Go to Authentication -> Sign-in method -> enable Google.
3. Go to Authentication -> Settings -> Authorized domains -> add deployed app domain.

## 5) Done

Your app URL is shown in Firebase App Hosting after `npm run deploy:app`.

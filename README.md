# Satori AI

Production-ready Next.js + Firebase platform for candidate assessments, recruiter pipelines, and transparency reports.

## What Is Included

- Google Auth login for candidate/recruiter personas.
- Firestore-backed jobs, applications, candidate assessments, and transparency reports.
- Firebase Storage upload path for candidate CV files.
- Genkit AI flow orchestration through secure Next.js server actions.
- Recruiter interview operations with Google Meet scheduling.
- Gemini-powered transcript intelligence synced into transparency reports.
- PDF resume extraction with skill-based auto-apply matching.
- Recruiter-customizable per-job hiring pipelines (shortlist/coding/interview/decision).
- Candidate stage visibility with transparent progression statuses.
- Company-first tenant isolation in Firestore security rules.
- Firebase App Hosting deployment config for GCP.

## Architecture

- Frontend: Next.js App Router.
- Auth + Data: Firebase Auth, Firestore, Storage.
- AI Evaluation: Genkit (`generateAssessmentTask`, `evaluateSolutionAndProvideFeedback`, `detectSubmissionAuthenticity`).
- Interview Intelligence: Google Calendar + Meet + Genkit transcript analysis.
- Auto Matching: Resume text extraction + threshold-based job matching.
- Runtime Hosting: Firebase App Hosting.

## Prerequisites

- Node.js 20+
- Firebase CLI (`npm i -g firebase-tools`)
- Google Cloud project with Firebase enabled
- Gemini API key for Genkit (`GOOGLE_API_KEY`)

## 1. Configure Environment

1. Copy `.env.example` to `.env.local`.
2. Fill all `NEXT_PUBLIC_FIREBASE_*` variables from Firebase project settings.
3. Add `GOOGLE_API_KEY` for Genkit model calls.
4. For local scripts/server actions outside GCP ADC, set:
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
5. For Google Meet scheduling, set:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
   - `GOOGLE_CALENDAR_ID` (optional)
   - `INTERVIEW_BOT_WEBHOOK_KEY` (for external transcript bots)
6. Optional matching threshold override:
   - `AUTO_APPLY_MATCH_THRESHOLD` (default `88`)
7. Stage notification email queue collection:
   - `FIREBASE_EMAIL_COLLECTION` (optional, default `mail`)

## 2. Select Firebase Project

1. Login:
   - `firebase login`
2. Create project mapping:
   - Copy `.firebaserc.example` to `.firebaserc`
   - Set your real Firebase project ID.

## 3. Install and Validate

1. Install dependencies:
   - `npm install`
2. Validate app quality gates:
   - `npm run check`

## 4. Provision Backend Rules + Indexes

Deploy Firestore and Storage enforcement first:

- `npm run deploy:rules`

This deploys:

- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`

## 4.1 Enable Stage Emails (Firebase Extension)

Install Firebase Extension:

- `Trigger Email` (`firebase/firestore-send-email`)

During setup:

1. Set collection path to the same value as `FIREBASE_EMAIL_COLLECTION` (default `mail`).
2. Configure SMTP settings (or your provider credentials) in extension params.
3. Save and deploy extension.

How this works:

- App server actions add email docs to the configured mail collection.
- Extension sends actual stage update emails (applied, advanced, rejected, selected, interview scheduled).

## 5. Seed Test Data

For quick user testing, seed jobs and demo user profiles:

- `npm run seed`

## 6. Deploy App Hosting

Deploy the Next.js app to Firebase App Hosting:

- `npm run deploy:app`

Or full end-to-end pipeline:

- `npm run deploy`

## Collections Used

- `users/{uid}`
  - `role`: `candidate | recruiter`
  - `companyId`: recruiter tenant ID
- `jobs/{jobId}`
- `applications/{applicationId}`
- `candidateAssessments/{assessmentId}`
- `transparencyReports/{reportId}`
- `transparencyReports/job-{jobId}` (single canonical report per job)
- `interviewSessions/{sessionId}`
- `interviewTranscripts/{transcriptId}`
- `candidateProfiles/{candidateId}`

## Multi-Tenant Model

Recruiters are isolated by `companyId`.

- Recruiter reads/writes are scoped to matching company documents.
- Candidates can only read their own applications and assessments.
- Transparency reports are readable by:
  - report candidate
  - recruiter of same `companyId`

## Local Development

- `npm run dev`
- Optional Genkit inspector while developing prompts/flows:
  - `npm run genkit:dev`

## Production Checklist

- Remove any test users from Firebase Auth before launch.
- Configure OAuth consent and authorized domains for Google sign-in.
- Enable App Check and turn on Billing alerts in GCP.
- Add monitoring and alerting (Cloud Logging + Error Reporting).
- Verify Firestore and Storage rules in Emulator Suite before major schema changes.

## Notes

- `next.config.ts` enforces type and lint checks during build for production safety.
- Server actions verify Firebase ID tokens before any privileged write.
- On Firebase App Hosting / GCP, Admin SDK should use Application Default Credentials automatically.

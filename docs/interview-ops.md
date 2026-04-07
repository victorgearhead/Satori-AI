# Interview Ops + Transcript Intelligence

This add-on enables recruiter-managed Google Meet scheduling and transcript-driven transparency reporting.

## What it adds

- Recruiter interview scheduling with Google Meet auto-generation.
- Candidate invite email delivery via Google Calendar event attendees.
- Transcript ingestion and Gemini-based interview intelligence extraction.
- Transcript highlights embedded in a single job-level transparency report.
- Public benchmark mode for transparency reports (`publicVisibility: true`).
- Bot webhook ingestion for transcript providers.

## Required environment variables

Add these to `.env.local` and deployment secrets:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_CALENDAR_ID` (optional, defaults to `primary`)

Existing required variables still apply:

- Firebase client/admin variables
- `GOOGLE_API_KEY` for Genkit

## Google Cloud setup

1. Create or select a service account in GCP.
2. Enable Google Calendar API for the project.
3. Grant Calendar write access to the target calendar:
   - For personal calendar use, share calendar with service account email.
   - For Google Workspace, use a shared/team calendar and grant editor.
4. Store service account email/private key as runtime secrets.

## Firestore collections used

- `interviewSessions`
- `interviewTranscripts`
- `transparencyReports` (extended with transcript fields)

## Single report model

- Exactly one transparency report per job: `transparencyReports/job-<jobId>`
- Report includes:
   - PII-redacted resume summaries
   - PII-redacted transcript intelligence
   - anonymized candidate corpus
   - selected candidate benchmark

## Recruiter workflow

1. Open `/recruiter/interviews`.
2. Select candidates and interview time window.
3. Create session -> Google Meet link is generated and invites are sent.
4. After interview, paste transcript and submit.
5. Gemini analysis updates transcript record and syncs transparency report.
6. Finalize selected candidate so the report reflects final benchmark status.

## Transcript bots

Use API endpoint:

- `POST /api/interview-bot-webhook`
- Header: `x-bot-webhook-key: <INTERVIEW_BOT_WEBHOOK_KEY>`
- Body:

```json
{
   "sessionId": "...",
   "candidateId": "...",
   "transcriptText": "...",
   "source": "meetingBaas",
   "publicVisibility": true
}
```

Supported sources: `meetingBaas`, `recall`, `fireflies`, `otter`.

## Public benchmarking workflow

1. Recruiter sets `publicVisibility` when uploading transcript.
2. Report becomes visible on `/transparency-reports`.
3. Any user can open full comparison details and transcript highlights.

## Deployment commands

```powershell
npm install
npm run check
npm run deploy:rules
npm run seed
npm run deploy:app
```

## Notes

- Transcript ingestion currently expects text input. If you need auto-transcription from recordings, add a Cloud Function with Speech-to-Text and call `saveInterviewTranscript` after transcription.
- Interview schedule edits currently update Firestore session state. If you need calendar event rescheduling, extend `google-calendar.ts` with `events.patch` and call it from `updateInterviewSession`.

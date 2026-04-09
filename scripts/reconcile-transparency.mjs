import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

function getCredential() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && privateKey && projectId) {
    return cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    });
  }

  return applicationDefault();
}

function ensureAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: getCredential(),
    projectId,
  });
}

function metricFromApplication(app) {
  if (typeof app.logicScore === 'number') return app.logicScore;
  if (typeof app.matchScore === 'number') return app.matchScore;
  if (app.status === 'Hired') return 80;
  return 50;
}

function aliasFromCandidateId(candidateId) {
  return `CAND-${candidateId.slice(0, 8).toUpperCase()}`;
}

async function reconcileTransparency() {
  const app = ensureAdminApp();
  const db = getFirestore(app);

  const jobsSnapshot = await db.collection('jobs').get();
  let jobsProcessed = 0;
  let reportsUpserted = 0;
  let applicationsFlagged = 0;

  for (const jobDoc of jobsSnapshot.docs) {
    const job = jobDoc.data();
    const jobId = jobDoc.id;

    const applicationsSnapshot = await db
      .collection('applications')
      .where('jobId', '==', jobId)
      .get();

    if (applicationsSnapshot.empty) {
      continue;
    }

    jobsProcessed += 1;

    const allowedCandidateIds = applicationsSnapshot.docs
      .map((doc) => String(doc.data().candidateId ?? ''))
      .filter(Boolean);

    const reportRef = db.collection('transparencyReports').doc(`job-${jobId}`);
    const reportSnapshot = await reportRef.get();
    const existing = reportSnapshot.exists ? reportSnapshot.data() : null;

    const existingEntries = Array.isArray(existing?.anonymizedCandidates)
      ? existing.anonymizedCandidates
      : [];
    const existingByCandidate = new Map(
      existingEntries.map((entry) => [String(entry.candidateId ?? ''), entry])
    );

    const hiredApplication = applicationsSnapshot.docs.find(
      (doc) => String(doc.data().status ?? '') === 'Hired'
    );
    const selectedCandidateId = hiredApplication
      ? String(hiredApplication.data().candidateId)
      : String(existing?.candidateId ?? allowedCandidateIds[0]);

    const anonymizedCandidates = applicationsSnapshot.docs.map((doc) => {
      const appData = doc.data();
      const candidateId = String(appData.candidateId ?? '');
      const score = metricFromApplication(appData);
      const existingEntry = existingByCandidate.get(candidateId);

      return {
        candidateId,
        candidateAlias: existingEntry?.candidateAlias ?? aliasFromCandidateId(candidateId),
        status: candidateId === selectedCandidateId ? 'Selected' : 'NotSelected',
        resumeSummary:
          existingEntry?.resumeSummary
          ?? String(appData.coverLetter ?? 'Resume summary unavailable.'),
        transcriptSummary:
          existingEntry?.transcriptSummary
          ?? 'Transcript not available yet. Report reconciled from application data.',
        transcriptHighlights: Array.isArray(existingEntry?.transcriptHighlights)
          ? existingEntry.transcriptHighlights
          : [`Current stage: ${String(appData.currentStage ?? 'Unknown')}`],
        userMetrics: existingEntry?.userMetrics ?? {
          experience: score,
          projectDepth: score,
          internshipRelevance: score,
          academicPedigree: score,
          skillMatch: score,
        },
      };
    });

    const selectedEntry = anonymizedCandidates.find((entry) => entry.status === 'Selected');
    const benchmark = selectedEntry?.userMetrics ?? {
      experience: 75,
      projectDepth: 75,
      internshipRelevance: 75,
      academicPedigree: 75,
      skillMatch: 75,
    };

    await reportRef.set(
      {
        jobId,
        applicationId: `job-${jobId}`,
        companyId: String(job.companyId ?? ''),
        candidateId: selectedCandidateId,
        jobTitle: String(job.title ?? 'Role'),
        company: String(job.company ?? String(job.companyId ?? '')).toUpperCase(),
        userMetrics: benchmark,
        hiredMetrics: benchmark,
        qualitativeAnalysis:
          String(existing?.qualitativeAnalysis ?? '')
          || 'Auto-reconciled transparency report generated from application and stage data.',
        decidingFactor:
          String(existing?.decidingFactor ?? '')
          || 'Pending or auto-selected based on final pipeline status.',
        publicVisibility: Boolean(existing?.publicVisibility),
        allowedCandidateIds,
        anonymizedCandidates,
        piiRedactionEnabled: true,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: existing?.createdAt ?? FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    reportsUpserted += 1;

    await Promise.all(
      applicationsSnapshot.docs.map(async (doc) => {
        await doc.ref.set(
          {
            transparencyReportAvailable: true,
            hasReport: true,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      })
    );

    applicationsFlagged += applicationsSnapshot.size;
  }

  console.log('Transparency reconciliation complete.');
  console.log(`Jobs processed: ${jobsProcessed}`);
  console.log(`Reports upserted: ${reportsUpserted}`);
  console.log(`Applications flagged: ${applicationsFlagged}`);
}

reconcileTransparency().catch((error) => {
  console.error('Transparency reconciliation failed', error);
  process.exitCode = 1;
});

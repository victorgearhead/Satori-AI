'use server';

import { createHash, randomUUID } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import pdfParse from 'pdf-parse';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { generateAssessmentTask } from '@/ai/flows/generate-assessment-task-flow';
import { evaluateSolutionAndProvideFeedback } from '@/ai/flows/evaluate-solution-and-provide-feedback';
import { detectSubmissionAuthenticity } from '@/ai/flows/detect-submission-authenticity';
import { createGoogleMeetEvent } from '@/lib/google-calendar';
import { analyzeInterviewTranscript } from '@/ai/flows/analyze-interview-transcript';
import { analyzeResumeFitForJob } from '@/ai/flows/analyze-resume-fit-for-job';
import {
  DEFAULT_PIPELINE_STAGES,
  extractSkillsFromResume,
  scoreJobMatch,
} from '@/lib/matching';
import type { Job, PipelineStage } from '@/lib/types';

const runAssessmentTaskSchema = z.object({
  skill: z.string().min(1),
  proficiency: z.enum(['Beginner', 'Intermediate', 'Advanced']),
});

const submitAssessmentSchema = z.object({
  idToken: z.string().min(10),
  skill: z.string().min(1),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  taskDescription: z.string().min(1),
  candidateSolution: z.string().min(1),
  timeTakenSeconds: z.number().int().nonnegative(),
});

const submitApplicationSchema = z.object({
  idToken: z.string().min(10),
  jobId: z.string().min(1),
  coverLetter: z.string().min(10),
  cvUrl: z.string().url().optional(),
});

const createInterviewSessionSchema = z.object({
  idToken: z.string().min(10),
  jobId: z.string().min(1),
  applicationIds: z.array(z.string().min(1)).min(1),
  title: z.string().min(4),
  description: z.string().optional(),
  startTimeIso: z.string().datetime(),
  endTimeIso: z.string().datetime(),
  timezone: z.string().min(1),
});

const updateInterviewSessionSchema = z.object({
  idToken: z.string().min(10),
  sessionId: z.string().min(1),
  title: z.string().min(4).optional(),
  description: z.string().optional(),
  startTimeIso: z.string().datetime().optional(),
  endTimeIso: z.string().datetime().optional(),
  timezone: z.string().min(1).optional(),
  status: z.enum(['Scheduled', 'Completed', 'Cancelled']).optional(),
  meetLink: z.string().url().optional(),
});

const saveInterviewTranscriptSchema = z.object({
  idToken: z.string().min(10),
  sessionId: z.string().min(1),
  candidateId: z.string().min(1),
  transcriptText: z.string().min(40),
  source: z
    .enum(['manual', 'integration', 'meetingBaas', 'recall', 'fireflies', 'otter'])
    .default('manual'),
  publicVisibility: z.boolean().default(true),
});

const finalizeTransparencyReportSchema = z.object({
  idToken: z.string().min(10),
  jobId: z.string().min(1),
  selectedCandidateId: z.string().min(1),
  decidingFactor: z.string().min(10),
});

const backfillTransparencyAccessSchema = z.object({
  idToken: z.string().min(10),
  jobId: z.string().min(1),
});

const ingestBotTranscriptSchema = z.object({
  sessionId: z.string().min(1),
  candidateId: z.string().min(1),
  transcriptText: z.string().min(40),
  source: z.enum(['meetingBaas', 'recall', 'fireflies', 'otter']),
  publicVisibility: z.boolean().default(true),
});

const createJobPostingSchema = z.object({
  idToken: z.string().min(10),
  title: z.string().min(3),
  company: z.string().min(2),
  location: z.string().min(2),
  salary: z.string().min(2),
  type: z.enum(['Full-time', 'Contract', 'Remote']),
  description: z.string().min(20),
  requirements: z.array(z.string().min(2)).min(1),
  tags: z.array(z.string().min(1)).default([]),
  pipelineStages: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(2),
        type: z.enum(['shortlist', 'coding', 'interview', 'decision']),
        instructions: z.string().optional(),
      })
    )
    .optional(),
});

const updateJobPipelineSchema = z.object({
  idToken: z.string().min(10),
  jobId: z.string().min(1),
  pipelineStages: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(2),
      type: z.enum(['shortlist', 'coding', 'interview', 'decision']),
      instructions: z.string().optional(),
    })
  ),
});

const advanceApplicationStageSchema = z.object({
  idToken: z.string().min(10),
  applicationId: z.string().min(1),
  decision: z.enum(['advance', 'reject']),
  decisionReasonCategory: z.enum([
    'skills-gap',
    'communication',
    'problem-solving',
    'culture-fit',
    'timeline-mismatch',
    'compensation',
    'other',
  ]),
  evidenceBullets: z.array(z.string().min(5)).min(1).max(5),
  rubricScore: z.number().int().min(0).max(100),
  note: z.string().optional(),
});

const analyzeResumeAndAutoApplySchema = z.object({
  idToken: z.string().min(10),
  cvUrl: z.string().url(),
  threshold: z.number().min(50).max(100).optional(),
});

const analyzeCandidateResumeFitSchema = z.object({
  idToken: z.string().min(10),
  applicationId: z.string().min(1),
});

type RecruiterApplicationRecord = {
  id: string;
  companyId: string;
  jobId: string;
  candidateId: string;
  email?: string;
  candidateName?: string;
  jobTitle?: string;
};

async function assertRecruiterRole(uid: string) {
  const profileSnapshot = await adminDb.collection('users').doc(uid).get();
  if (!profileSnapshot.exists) {
    throw new Error('User profile not found.');
  }

  const profile = profileSnapshot.data() as { role?: string; companyId?: string };
  if (profile.role !== 'recruiter' || !profile.companyId) {
    throw new Error('Recruiter role is required for this action.');
  }

  return {
    companyId: profile.companyId,
  };
}

async function assertCandidateRole(uid: string) {
  const profileSnapshot = await adminDb.collection('users').doc(uid).get();
  if (!profileSnapshot.exists) {
    throw new Error('User profile not found.');
  }

  const profile = profileSnapshot.data() as {
    role?: string;
    email?: string;
    displayName?: string;
  };
  if (profile.role !== 'candidate') {
    throw new Error('Candidate role is required for this action.');
  }

  return {
    email: profile.email ?? '',
    displayName: profile.displayName ?? 'Candidate',
  };
}

async function queueStageNotificationEmail(input: {
  toEmail: string;
  subject: string;
  text: string;
  html?: string;
}) {
  if (!input.toEmail) {
    return;
  }

  const mailCollection = process.env.FIREBASE_EMAIL_COLLECTION || 'mail';

  try {
    await adminDb.collection(mailCollection).add({
      to: [input.toEmail],
      message: {
        subject: input.subject,
        text: input.text,
        html: input.html ?? input.text.replace(/\n/g, '<br/>'),
      },
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to queue stage email notification', error);
  }
}

async function getAllJobs(): Promise<Job[]> {
  const snapshot = await adminDb.collection('jobs').get();
  return snapshot.docs.map((jobDoc) => {
    const data = jobDoc.data() as Record<string, unknown>;
    return {
      id: jobDoc.id,
      title: String(data.title ?? ''),
      company: String(data.company ?? ''),
      companyId: String(data.companyId ?? ''),
      location: String(data.location ?? ''),
      salary: String(data.salary ?? ''),
      type: (data.type as Job['type']) ?? 'Full-time',
      description: String(data.description ?? ''),
      requirements: Array.isArray(data.requirements)
        ? (data.requirements as string[])
        : [],
      postedAt: String(data.postedAt ?? ''),
      tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
      pipelineStages: Array.isArray(data.pipelineStages)
        ? (data.pipelineStages as PipelineStage[])
        : DEFAULT_PIPELINE_STAGES,
    };
  });
}

async function extractPdfTextFromUrl(cvUrl: string): Promise<string> {
  const response = await fetch(cvUrl);
  if (!response.ok) {
    throw new Error('Unable to download uploaded CV for analysis.');
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('pdf')) {
    throw new Error('Auto-apply currently supports PDF resumes only.');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const parsed = await pdfParse(buffer);
  const text = parsed.text?.trim();
  if (!text) {
    throw new Error('Could not extract readable text from CV.');
  }
  return text;
}

function normalizeSkillName(skill: string): string {
  return skill
    .toLowerCase()
    .replace(/[^a-z0-9.+#\-\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeSkills(skills: string[], limit = 20): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const skill of skills) {
    const normalized = normalizeSkillName(skill);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

async function scoreJobMatchSmart(args: {
  resumeText: string;
  resumeSkills: string[];
  job: Job;
}): Promise<{ score: number; missingSkills: string[]; matchedSkills: string[] }> {
  const fallback = scoreJobMatch(args.resumeSkills, args.job);

  try {
    const ai = await analyzeResumeFitForJob({
      jobTitle: args.job.title,
      jobDescription: args.job.description,
      requirements: Array.isArray(args.job.requirements) ? args.job.requirements : [],
      tags: Array.isArray(args.job.tags) ? args.job.tags : [],
      // Bound prompt size for latency and token cost, while retaining signal.
      resumeText: args.resumeText.slice(0, 12000),
    });

    const blendedScore = Math.round(ai.overallMatchScore * 0.75 + fallback.score * 0.25);

    const matchedSkills = dedupeSkills([...ai.matchedSkills, ...fallback.matchedSkills], 20);
    const matchedSet = new Set(matchedSkills.map((skill) => normalizeSkillName(skill)));
    const missingSkills = dedupeSkills(
      [...ai.missingSkills, ...fallback.missingSkills].filter(
        (skill) => !matchedSet.has(normalizeSkillName(skill))
      ),
      20
    );

    return {
      score: Math.max(0, Math.min(100, blendedScore)),
      missingSkills,
      matchedSkills,
    };
  } catch (error) {
    console.error(`AI match scoring failed for job ${args.job.id}, using fallback`, error);
    return fallback;
  }
}

function getStageStatus(stageType: PipelineStage['type']):
  | 'Pending'
  | 'Screening'
  | 'Assessment'
  | 'Interview' {
  if (stageType === 'shortlist') return 'Screening';
  if (stageType === 'coding') return 'Assessment';
  if (stageType === 'interview') return 'Interview';
  return 'Pending';
}

function redactPII(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[REDACTED_PHONE]')
    .replace(/\b(?:linkedin\.com\/in|github\.com\/)\S+/gi, '[REDACTED_PROFILE]');
}

function buildCandidateAlias(candidateId: string): string {
  const hash = createHash('sha256').update(candidateId).digest('hex').slice(0, 8);
  return `CAND-${hash.toUpperCase()}`;
}

async function upsertJobTransparencyReport(args: {
  recruiterCompanyId: string;
  sessionId: string;
  jobId: string;
  jobTitle: string;
  candidateId: string;
  transcriptSummary: string;
  transcriptHighlights: string[];
  communicationScore: number;
  problemSolvingScore: number;
  confidenceScore: number;
  publicVisibility: boolean;
}) {
  const reportId = `job-${args.jobId}`;
  const reportRef = adminDb.collection('transparencyReports').doc(reportId);
  const existing = await reportRef.get();
  const data = existing.exists ? (existing.data() as Record<string, unknown>) : null;

  const jobApplicationsSnapshot = await adminDb
    .collection('applications')
    .where('jobId', '==', args.jobId)
    .get();

  const allowedCandidateIds = Array.from(
    new Set(
      jobApplicationsSnapshot.docs
        .map((doc) => String(doc.data().candidateId ?? ''))
        .filter(Boolean)
    )
  );

  const applicationSnapshot = await adminDb
    .collection('applications')
    .where('jobId', '==', args.jobId)
    .where('candidateId', '==', args.candidateId)
    .limit(1)
    .get();

  const application = applicationSnapshot.empty
    ? null
    : (applicationSnapshot.docs[0].data() as {
        coverLetter?: string;
        status?: string;
      });

  const resumeSummary = redactPII(application?.coverLetter ?? 'Resume summary unavailable.');
  const candidateAlias = buildCandidateAlias(args.candidateId);
  const currentCandidates = Array.isArray(data?.anonymizedCandidates)
    ? (data?.anonymizedCandidates as Array<Record<string, unknown>>)
    : [];

  const nextCandidates = currentCandidates.filter(
    (entry) => String(entry.candidateId) !== args.candidateId
  );

  const selectedCandidateId = data?.candidateId ? String(data.candidateId) : '';

  nextCandidates.push({
    candidateId: args.candidateId,
    candidateAlias,
    status: selectedCandidateId === args.candidateId ? 'Selected' : 'NotSelected',
    resumeSummary,
    transcriptSummary: redactPII(args.transcriptSummary),
    transcriptHighlights: args.transcriptHighlights.map((item) => redactPII(item)),
    userMetrics: {
      experience: args.communicationScore,
      projectDepth: args.problemSolvingScore,
      internshipRelevance: args.confidenceScore,
      academicPedigree: args.problemSolvingScore,
      skillMatch: args.communicationScore,
    },
  });

  await reportRef.set(
    {
      jobId: args.jobId,
      applicationId: reportId,
      companyId: args.recruiterCompanyId,
      candidateId: selectedCandidateId || args.candidateId,
      jobTitle: args.jobTitle,
      company: args.recruiterCompanyId.toUpperCase(),
      userMetrics: {
        experience: args.communicationScore,
        projectDepth: args.problemSolvingScore,
        internshipRelevance: args.confidenceScore,
        academicPedigree: args.problemSolvingScore,
        skillMatch: args.communicationScore,
      },
      hiredMetrics: {
        experience: Math.min(100, args.communicationScore + 8),
        projectDepth: Math.min(100, args.problemSolvingScore + 8),
        internshipRelevance: Math.min(100, args.confidenceScore + 8),
        academicPedigree: Math.min(100, args.problemSolvingScore + 5),
        skillMatch: Math.min(100, args.communicationScore + 6),
      },
      qualitativeAnalysis:
        String(data?.qualitativeAnalysis ?? '') ||
        'Consolidated transparency report generated from resumes and interview transcripts.',
      decidingFactor: String(data?.decidingFactor ?? '') || 'Pending final selection.',
      interviewSessionId: args.sessionId,
      transcriptSummary: redactPII(args.transcriptSummary),
      transcriptHighlights: args.transcriptHighlights.map((item) => redactPII(item)),
      publicVisibility: args.publicVisibility,
      allowedCandidateIds,
      anonymizedCandidates: nextCandidates,
      piiRedactionEnabled: true,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: existing.exists
        ? (data?.createdAt as unknown)
        : FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return reportId;
}

async function markReportAvailableForJobApplications(jobId: string) {
  const applicationsSnapshot = await adminDb
    .collection('applications')
    .where('jobId', '==', jobId)
    .get();

  if (applicationsSnapshot.empty) {
    return;
  }

  await Promise.all(
    applicationsSnapshot.docs.map((doc) =>
      doc.ref.set(
        {
          transparencyReportAvailable: true,
          hasReport: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    )
  );
}

async function reconcileJobTransparency(jobId: string, recruiterCompanyId: string, jobTitle: string) {
  const applicationsSnapshot = await adminDb
    .collection('applications')
    .where('jobId', '==', jobId)
    .get();

  if (applicationsSnapshot.empty) {
    return null;
  }

  const reportId = `job-${jobId}`;
  const reportRef = adminDb.collection('transparencyReports').doc(reportId);
  const reportSnapshot = await reportRef.get();
  const reportData = reportSnapshot.exists
    ? (reportSnapshot.data() as Record<string, unknown>)
    : null;

  const publicVisibility = Boolean(reportData?.publicVisibility);
  const existingCandidates = Array.isArray(reportData?.anonymizedCandidates)
    ? (reportData?.anonymizedCandidates as Array<Record<string, unknown>>)
    : [];
  const existingCandidateIds = new Set(
    existingCandidates.map((entry) => String(entry.candidateId ?? '')).filter(Boolean)
  );

  for (const applicationDoc of applicationsSnapshot.docs) {
    const app = applicationDoc.data() as {
      candidateId: string;
      logicScore?: number;
      matchScore?: number;
      jobTitle?: string;
      status?: string;
    };

    if (!existingCandidateIds.has(app.candidateId)) {
      const baseline =
        typeof app.logicScore === 'number'
          ? app.logicScore
          : typeof app.matchScore === 'number'
            ? app.matchScore
            : app.status === 'Hired'
              ? 80
              : 50;

      await upsertJobTransparencyReport({
        recruiterCompanyId,
        sessionId: '',
        jobId,
        jobTitle: app.jobTitle ?? jobTitle,
        candidateId: app.candidateId,
        transcriptSummary:
          'Reconciled transparency entry generated automatically from application and stage data.',
        transcriptHighlights: [`Current status: ${app.status ?? 'Pending'}`],
        communicationScore: baseline,
        problemSolvingScore: baseline,
        confidenceScore: baseline,
        publicVisibility,
      });
    }
  }

  const allowedCandidateIds = Array.from(
    new Set(
      applicationsSnapshot.docs
        .map((doc) => String(doc.data().candidateId ?? ''))
        .filter(Boolean)
    )
  );

  await reportRef.set(
    {
      jobId,
      companyId: recruiterCompanyId,
      jobTitle,
      allowedCandidateIds,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await markReportAvailableForJobApplications(jobId);

  return reportId;
}

export async function runAssessmentTask(input: z.infer<typeof runAssessmentTaskSchema>) {
  const payload = runAssessmentTaskSchema.parse(input);
  return generateAssessmentTask(payload);
}

export async function submitAssessment(input: z.infer<typeof submitAssessmentSchema>) {
  const payload = submitAssessmentSchema.parse(input);

  const decodedToken = await adminAuth.verifyIdToken(payload.idToken);
  const uid = decodedToken.uid;

  const [authenticityResult, evaluationResult] = await Promise.all([
    detectSubmissionAuthenticity({
      submissionContent: payload.candidateSolution,
    }),
    evaluateSolutionAndProvideFeedback({
      skill: payload.skill,
      difficulty: payload.difficulty,
      taskDescription: payload.taskDescription,
      candidateSolution: payload.candidateSolution,
      timeTakenSeconds: payload.timeTakenSeconds,
    }),
  ]);

  const assessmentId = randomUUID();

  await adminDb.collection('candidateAssessments').doc(assessmentId).set({
    candidateId: uid,
    skill: payload.skill,
    score: evaluationResult.correctnessScore,
    stabilityScore: evaluationResult.scoreVector.logicClarity,
    authenticityScore: authenticityResult.authenticityScore,
    feedback: evaluationResult.overallFeedback,
    strengths: [evaluationResult.logicFlowFeedback, evaluationResult.problemSolvingApproachFeedback],
    weaknesses: [evaluationResult.errorPatternFeedback, evaluationResult.timeBehaviorFeedback],
    scoreVector: evaluationResult.scoreVector,
    authenticityReasoning: authenticityResult.authenticityReasoning,
    isAuthentic: authenticityResult.isAuthentic,
    detectedPatterns: authenticityResult.detectedPatterns ?? [],
    lastAttempt: new Date().toISOString(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    assessmentId,
  };
}

export async function submitJobApplication(
  input: z.infer<typeof submitApplicationSchema>
) {
  const payload = submitApplicationSchema.parse(input);
  const decodedToken = await adminAuth.verifyIdToken(payload.idToken);
  const uid = decodedToken.uid;

  const profileSnapshot = await adminDb.collection('users').doc(uid).get();
  if (!profileSnapshot.exists) {
    throw new Error('User profile not found. Please sign in again.');
  }

  const profile = profileSnapshot.data() as {
    displayName?: string;
    email?: string;
  };

  const jobSnapshot = await adminDb.collection('jobs').doc(payload.jobId).get();
  if (!jobSnapshot.exists) {
    throw new Error('Job not found.');
  }

  const job = jobSnapshot.data() as {
    title: string;
    company: string;
    companyId: string;
    pipelineStages?: PipelineStage[];
  };

  const pipelineStages =
    Array.isArray(job.pipelineStages) && job.pipelineStages.length > 0
      ? job.pipelineStages
      : DEFAULT_PIPELINE_STAGES;
  const firstStage = pipelineStages[0];

  const existingApplication = await adminDb
    .collection('applications')
    .where('jobId', '==', payload.jobId)
    .where('candidateId', '==', uid)
    .limit(1)
    .get();

  if (!existingApplication.empty) {
    throw new Error('You have already applied for this role.');
  }

  const applicationId = randomUUID();

  await adminDb.collection('applications').doc(applicationId).set({
    jobId: payload.jobId,
    candidateId: uid,
    candidateName: profile.displayName ?? decodedToken.name ?? 'Candidate',
    email: profile.email ?? decodedToken.email ?? '',
    status: 'Pending',
    appliedDate: new Date().toISOString().slice(0, 10),
    cvUrl: payload.cvUrl ?? null,
    coverLetter: payload.coverLetter,
    logicScore: null,
    transparencyReportAvailable: true,
    matchScore: 0,
    currentStage: firstStage?.name ?? 'Application Review',
    hasReport: true,
    company: job.company,
    companyId: job.companyId,
    jobTitle: job.title,
    pipelineStageIndex: 0,
    stageHistory: [],
    autoApplied: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await queueStageNotificationEmail({
    toEmail: profile.email ?? decodedToken.email ?? '',
    subject: `Application received: ${job.title}`,
    text: [
      `Hi ${profile.displayName ?? decodedToken.name ?? 'Candidate'},`,
      '',
      `Your application for ${job.title} at ${job.company} has been received.`,
      `Current stage: ${firstStage?.name ?? 'Application Review'}.`,
      '',
      'You can track each stage update in your dashboard.',
    ].join('\n'),
  });

  await upsertJobTransparencyReport({
    recruiterCompanyId: job.companyId,
    sessionId: '',
    jobId: payload.jobId,
    jobTitle: job.title,
    candidateId: uid,
    transcriptSummary:
      'Application submitted. Detailed transcript insights will be added after interview analysis.',
    transcriptHighlights: ['Application profile initialized for transparent comparison.'],
    communicationScore: 50,
    problemSolvingScore: 50,
    confidenceScore: 50,
    publicVisibility: false,
  });

  await reconcileJobTransparency(payload.jobId, job.companyId, job.title);

  return {
    applicationId,
  };
}

export async function createJobPosting(
  input: z.infer<typeof createJobPostingSchema>
) {
  const payload = createJobPostingSchema.parse(input);
  const tags = payload.tags
    .map((tag) => tag.trim())
    .filter(Boolean);
  const decoded = await adminAuth.verifyIdToken(payload.idToken);
  const recruiter = await assertRecruiterRole(decoded.uid);

  const jobId = randomUUID();
  await adminDb.collection('jobs').doc(jobId).set({
    title: payload.title,
    company: payload.company,
    companyId: recruiter.companyId,
    location: payload.location,
    salary: payload.salary,
    type: payload.type,
    description: payload.description,
    requirements: payload.requirements,
    postedAt: new Date().toISOString().slice(0, 10),
    tags,
    pipelineStages:
      payload.pipelineStages && payload.pipelineStages.length > 0
        ? payload.pipelineStages
        : DEFAULT_PIPELINE_STAGES,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { jobId };
}

export async function updateJobPipeline(
  input: z.infer<typeof updateJobPipelineSchema>
) {
  const payload = updateJobPipelineSchema.parse(input);
  const decoded = await adminAuth.verifyIdToken(payload.idToken);
  const recruiter = await assertRecruiterRole(decoded.uid);

  const jobRef = adminDb.collection('jobs').doc(payload.jobId);
  const snapshot = await jobRef.get();
  if (!snapshot.exists) {
    throw new Error('Job not found.');
  }

  const job = snapshot.data() as { companyId: string };
  if (job.companyId !== recruiter.companyId) {
    throw new Error('Not authorized to edit this job pipeline.');
  }

  await jobRef.update({
    pipelineStages: payload.pipelineStages,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
}

export async function advanceApplicationStage(
  input: z.infer<typeof advanceApplicationStageSchema>
) {
  const payload = advanceApplicationStageSchema.parse(input);
  const decoded = await adminAuth.verifyIdToken(payload.idToken);
  const recruiter = await assertRecruiterRole(decoded.uid);

  const appRef = adminDb.collection('applications').doc(payload.applicationId);
  const appSnapshot = await appRef.get();
  if (!appSnapshot.exists) {
    throw new Error('Application not found.');
  }

  const application = appSnapshot.data() as {
    jobId: string;
    companyId: string;
    candidateId: string;
    email?: string;
    candidateName?: string;
    jobTitle?: string;
    logicScore?: number;
    matchScore?: number;
    pipelineStageIndex?: number;
    currentStage?: string;
    stageHistory?: Array<Record<string, unknown>>;
  };

  if (application.companyId !== recruiter.companyId) {
    throw new Error('Not authorized to update this application.');
  }

  const jobSnapshot = await adminDb.collection('jobs').doc(application.jobId).get();
  const job = jobSnapshot.exists
    ? (jobSnapshot.data() as { title?: string; pipelineStages?: PipelineStage[] })
    : null;
  const stages =
    job && Array.isArray(job.pipelineStages) && job.pipelineStages.length > 0
      ? job.pipelineStages
      : DEFAULT_PIPELINE_STAGES;

  const currentIndex = application.pipelineStageIndex ?? 0;
  const currentStage = stages[Math.min(currentIndex, stages.length - 1)];
  const history = Array.isArray(application.stageHistory)
    ? [...application.stageHistory]
    : [];

  if (payload.decision === 'reject') {
    history.push({
      stageId: currentStage.id,
      stageName: currentStage.name,
      status: 'rejected',
      actorUid: decoded.uid,
      actorRole: 'recruiter',
      decisionReasonCategory: payload.decisionReasonCategory,
      evidenceBullets: payload.evidenceBullets,
      rubricScore: payload.rubricScore,
      note: payload.note ?? '',
      updatedAt: new Date().toISOString(),
    });

    await appRef.update({
      status: 'Rejected',
      currentStage: currentStage.name,
      stageHistory: history,
      transparencyReportAvailable: true,
      hasReport: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Ensure rejected candidates still receive a job-level comparison report.
    const baselineScore =
      typeof application.logicScore === 'number'
        ? application.logicScore
        : typeof application.matchScore === 'number'
          ? application.matchScore
          : 50;

    await upsertJobTransparencyReport({
      recruiterCompanyId: recruiter.companyId,
      sessionId: '',
      jobId: application.jobId,
      jobTitle: application.jobTitle ?? job?.title ?? 'Role',
      candidateId: application.candidateId,
      transcriptSummary:
        'No meeting transcript available. Decision reflects stage performance and application quality review.',
      transcriptHighlights: payload.note
        ? [
            `Reason category: ${payload.decisionReasonCategory}`,
            ...payload.evidenceBullets,
            payload.note,
          ]
        : [
            `Rejected at stage: ${currentStage.name}`,
            `Reason category: ${payload.decisionReasonCategory}`,
            ...payload.evidenceBullets,
          ],
      communicationScore: baselineScore,
      problemSolvingScore: baselineScore,
      confidenceScore: baselineScore,
      publicVisibility: false,
    });

    await reconcileJobTransparency(
      application.jobId,
      recruiter.companyId,
      application.jobTitle ?? job?.title ?? 'Role'
    );

    await queueStageNotificationEmail({
      toEmail: application.email ?? '',
      subject: `Application update: ${application.jobTitle ?? 'Job Application'}`,
      text: [
        `Hi ${application.candidateName ?? 'Candidate'},`,
        '',
        `Status update for ${application.jobTitle ?? 'your application'}: Not moved forward at ${currentStage.name}.`,
        `Decision category: ${payload.decisionReasonCategory}.`,
        `Rubric score: ${payload.rubricScore}/100.`,
        payload.note ? `Reviewer note: ${payload.note}` : '',
        '',
        'You can review transparency insights in your dashboard when available.',
      ]
        .filter(Boolean)
        .join('\n'),
    });

    return { ok: true, status: 'Rejected' };
  }

  history.push({
    stageId: currentStage.id,
    stageName: currentStage.name,
    status: 'advanced',
    actorUid: decoded.uid,
    actorRole: 'recruiter',
    decisionReasonCategory: payload.decisionReasonCategory,
    evidenceBullets: payload.evidenceBullets,
    rubricScore: payload.rubricScore,
    note: payload.note ?? '',
    updatedAt: new Date().toISOString(),
  });

  if (currentIndex >= stages.length - 1) {
    await appRef.update({
      status: 'Hired',
      currentStage: 'Selected',
      stageHistory: history,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await queueStageNotificationEmail({
      toEmail: application.email ?? '',
      subject: `Congratulations: ${application.jobTitle ?? 'Application'} selected`,
      text: [
        `Hi ${application.candidateName ?? 'Candidate'},`,
        '',
        `Great news. You have been selected for ${application.jobTitle ?? 'the role'}.`,
        `Decision category: ${payload.decisionReasonCategory}.`,
        `Rubric score: ${payload.rubricScore}/100.`,
        payload.note ? `Message from recruiter: ${payload.note}` : '',
        '',
        'You can view final report details once closure is completed.',
      ]
        .filter(Boolean)
        .join('\n'),
    });

    const reportId = await upsertJobTransparencyReport({
      recruiterCompanyId: recruiter.companyId,
      sessionId: '',
      jobId: application.jobId,
      jobTitle: application.jobTitle ?? job?.title ?? 'Role',
      candidateId: application.candidateId,
      transcriptSummary:
        'Candidate reached final hiring stage and was selected. Comparison report updated automatically.',
      transcriptHighlights: [
        'Selected through pipeline progression.',
        `Decision category: ${payload.decisionReasonCategory}`,
        `Rubric score: ${payload.rubricScore}/100`,
        ...payload.evidenceBullets,
      ],
      communicationScore:
        typeof application.logicScore === 'number'
          ? application.logicScore
          : typeof application.matchScore === 'number'
            ? application.matchScore
            : 80,
      problemSolvingScore:
        typeof application.logicScore === 'number'
          ? application.logicScore
          : typeof application.matchScore === 'number'
            ? application.matchScore
            : 80,
      confidenceScore:
        typeof application.logicScore === 'number'
          ? application.logicScore
          : typeof application.matchScore === 'number'
            ? application.matchScore
            : 80,
      publicVisibility: false,
    });

    const reportRef = adminDb.collection('transparencyReports').doc(reportId);
    const reportSnapshot = await reportRef.get();
    if (reportSnapshot.exists) {
      const reportData = reportSnapshot.data() as Record<string, unknown>;
      const candidates = Array.isArray(reportData.anonymizedCandidates)
        ? (reportData.anonymizedCandidates as Array<Record<string, unknown>>)
        : [];

      const updatedCandidates = candidates.map((entry) => ({
        ...entry,
        status:
          String(entry.candidateId) === application.candidateId ? 'Selected' : 'NotSelected',
      }));

      await reportRef.set(
        {
          candidateId: application.candidateId,
          decidingFactor:
            payload.note?.trim() ||
            'Auto-finalized by pipeline stage progression (selected at final stage).',
          anonymizedCandidates: updatedCandidates,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await reconcileJobTransparency(
      application.jobId,
      recruiter.companyId,
      application.jobTitle ?? job?.title ?? 'Role'
    );

    return { ok: true, status: 'Hired' };
  }

  const nextIndex = currentIndex + 1;
  const nextStage = stages[nextIndex];

  await appRef.update({
    status: getStageStatus(nextStage.type),
    currentStage: nextStage.name,
    pipelineStageIndex: nextIndex,
    stageHistory: history,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await queueStageNotificationEmail({
    toEmail: application.email ?? '',
    subject: `Next stage unlocked: ${application.jobTitle ?? 'Application'}`,
    text: [
      `Hi ${application.candidateName ?? 'Candidate'},`,
      '',
      `You have progressed to the next stage for ${application.jobTitle ?? 'your application'}.`,
      `Current stage: ${nextStage.name}.`,
        `Decision category: ${payload.decisionReasonCategory}.`,
        `Rubric score: ${payload.rubricScore}/100.`,
      payload.note ? `Reviewer note: ${payload.note}` : '',
      '',
      'Please check your dashboard for process details and timelines.',
    ]
      .filter(Boolean)
      .join('\n'),
  });

  return { ok: true, status: getStageStatus(nextStage.type) };
}

export async function analyzeResumeAndAutoApply(
  input: z.infer<typeof analyzeResumeAndAutoApplySchema>
) {
  const payload = analyzeResumeAndAutoApplySchema.parse(input);
  const decoded = await adminAuth.verifyIdToken(payload.idToken);
  const uid = decoded.uid;
  const candidate = await assertCandidateRole(uid);

  const threshold =
    payload.threshold ?? Number(process.env.AUTO_APPLY_MATCH_THRESHOLD ?? 88);
  const extractedText = await extractPdfTextFromUrl(payload.cvUrl);
  const skills = extractSkillsFromResume(extractedText);

  const summary = extractedText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join(' ')
    .slice(0, 600);

  await adminDb.collection('candidateProfiles').doc(uid).set(
    {
      candidateId: uid,
      sourceCvUrl: payload.cvUrl,
      extractedText,
      summary,
      skills,
      updatedAt: new Date().toISOString(),
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const jobs = await getAllJobs();
  const recommendations = [] as Array<{
    jobId: string;
    title: string;
    company: string;
    score: number;
    missingSkills: string[];
    matchedSkills: string[];
    autoApplied: boolean;
  }>;

  let autoAppliedCount = 0;

  for (const job of jobs) {
    const match = await scoreJobMatchSmart({
      resumeText: extractedText,
      resumeSkills: skills,
      job,
    });
    const shouldApply = match.score >= threshold;

    let autoApplied = false;
    if (shouldApply) {
      const existing = await adminDb
        .collection('applications')
        .where('jobId', '==', job.id)
        .where('candidateId', '==', uid)
        .limit(1)
        .get();

      if (existing.empty) {
        const applicationId = randomUUID();
        const pipelineStages =
          job.pipelineStages && job.pipelineStages.length > 0
            ? job.pipelineStages
            : DEFAULT_PIPELINE_STAGES;
        const firstStage = pipelineStages[0];

        await adminDb.collection('applications').doc(applicationId).set({
          jobId: job.id,
          candidateId: uid,
          candidateName: candidate.displayName,
          email: candidate.email,
          status: getStageStatus(firstStage.type),
          appliedDate: new Date().toISOString().slice(0, 10),
          cvUrl: payload.cvUrl,
          coverLetter: 'Auto-applied based on resume match engine.',
          logicScore: null,
          transparencyReportAvailable: true,
          matchScore: match.score,
          currentStage: firstStage.name,
          hasReport: true,
          company: job.company,
          companyId: job.companyId,
          jobTitle: job.title,
          pipelineStageIndex: 0,
          stageHistory: [],
          autoApplied: true,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        await upsertJobTransparencyReport({
          recruiterCompanyId: job.companyId,
          sessionId: '',
          jobId: job.id,
          jobTitle: job.title,
          candidateId: uid,
          transcriptSummary:
            'Auto-applied candidate profile added. Interview transcript insights will appear after interview processing.',
          transcriptHighlights: [`Auto-apply match score: ${match.score}%`],
          communicationScore: match.score,
          problemSolvingScore: match.score,
          confidenceScore: match.score,
          publicVisibility: false,
        });

        await reconcileJobTransparency(job.id, job.companyId, job.title);

        await queueStageNotificationEmail({
          toEmail: candidate.email,
          subject: `Auto-applied: ${job.title}`,
          text: [
            `Hi ${candidate.displayName},`,
            '',
            `Your resume matched ${job.title} at ${job.company} and was auto-applied at ${match.score}% score.`,
            `Current stage: ${firstStage.name}.`,
            '',
            'You can still apply manually to any role from the jobs page.',
          ].join('\n'),
        });

        autoApplied = true;
        autoAppliedCount += 1;
      }
    }

    recommendations.push({
      jobId: job.id,
      title: job.title,
      company: job.company,
      score: match.score,
      missingSkills: match.missingSkills,
      matchedSkills: match.matchedSkills,
      autoApplied,
    });
  }

  recommendations.sort((a, b) => b.score - a.score);

  return {
    threshold,
    autoAppliedCount,
    extractedSkills: skills,
    recommendations,
  };
}

export async function analyzeCandidateResumeFit(
  input: z.infer<typeof analyzeCandidateResumeFitSchema>
) {
  const payload = analyzeCandidateResumeFitSchema.parse(input);
  const decoded = await adminAuth.verifyIdToken(payload.idToken);
  const recruiter = await assertRecruiterRole(decoded.uid);

  const applicationSnapshot = await adminDb
    .collection('applications')
    .doc(payload.applicationId)
    .get();

  if (!applicationSnapshot.exists) {
    throw new Error('Application not found.');
  }

  const application = applicationSnapshot.data() as {
    companyId: string;
    jobId: string;
    cvUrl?: string | null;
    candidateId: string;
  };

  if (application.companyId !== recruiter.companyId) {
    throw new Error('Not authorized to analyze this application.');
  }

  if (!application.cvUrl) {
    throw new Error('Candidate resume is not available for this application.');
  }

  const jobSnapshot = await adminDb.collection('jobs').doc(application.jobId).get();
  if (!jobSnapshot.exists) {
    throw new Error('Associated job not found.');
  }

  const job = jobSnapshot.data() as {
    companyId: string;
    title: string;
    description: string;
    requirements?: string[];
    tags?: string[];
  };

  if (job.companyId !== recruiter.companyId) {
    throw new Error('Not authorized to analyze this job.');
  }

  const resumeText = await extractPdfTextFromUrl(application.cvUrl);
  const analysis = await analyzeResumeFitForJob({
    jobTitle: job.title,
    jobDescription: job.description,
    requirements: Array.isArray(job.requirements) ? job.requirements : [],
    tags: Array.isArray(job.tags) ? job.tags : [],
    resumeText,
  });

  await applicationSnapshot.ref.set(
    {
      aiResumeFit: {
        score: analysis.overallMatchScore,
        matchedSkills: analysis.matchedSkills,
        missingSkills: analysis.missingSkills,
        strengths: analysis.strengths,
        concerns: analysis.concerns,
        summary: analysis.summary,
        analyzedAt: new Date().toISOString(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    applicationId: payload.applicationId,
    candidateId: application.candidateId,
    cvUrl: application.cvUrl,
    ...analysis,
  };
}

export async function createInterviewSession(
  input: z.infer<typeof createInterviewSessionSchema>
) {
  const payload = createInterviewSessionSchema.parse(input);
  const decodedToken = await adminAuth.verifyIdToken(payload.idToken);
  const uid = decodedToken.uid;
  const recruiter = await assertRecruiterRole(uid);

  const jobSnapshot = await adminDb.collection('jobs').doc(payload.jobId).get();
  if (!jobSnapshot.exists) {
    throw new Error('Job not found.');
  }

  const job = jobSnapshot.data() as {
    title: string;
    companyId: string;
  };

  if (job.companyId !== recruiter.companyId) {
    throw new Error('You can only schedule interviews for your company jobs.');
  }

  const appsSnapshots = await Promise.all(
    payload.applicationIds.map((applicationId) =>
      adminDb.collection('applications').doc(applicationId).get()
    )
  );

  const validApplications = appsSnapshots
    .filter((snapshot) => snapshot.exists)
    .map(
      (snapshot) =>
        ({
          id: snapshot.id,
          ...(snapshot.data() as {
            companyId?: string;
            jobId?: string;
            candidateId?: string;
            email?: string;
          }),
        }) as RecruiterApplicationRecord
    )
    .filter(
      (application) =>
        application.companyId === recruiter.companyId && application.jobId === payload.jobId
    );

  if (validApplications.length === 0) {
    throw new Error('No valid applications selected for scheduling.');
  }

  const candidateIds = validApplications.map((application) =>
    String(application.candidateId)
  );
  const candidateEmails = validApplications
    .map((application) => String(application.email ?? ''))
    .filter((email) => email.length > 0);

  let meetLink = '';
  let calendarEventId: string | null = null;
  let calendarFallbackUsed = false;
  const calendarEnabled = process.env.GOOGLE_CALENDAR_ENABLED === 'true';

  if (calendarEnabled) {
    try {
      const meet = await createGoogleMeetEvent({
        title: payload.title,
        description: payload.description,
        startTimeIso: payload.startTimeIso,
        endTimeIso: payload.endTimeIso,
        timezone: payload.timezone,
        attendeeEmails: Array.from(new Set(candidateEmails)),
      });
      meetLink = meet.meetLink;
      calendarEventId = meet.eventId;
    } catch (error) {
      calendarFallbackUsed = true;
      console.error('Interview calendar fallback activated', error);
    }
  }

  if (!meetLink) {
    const fallbackLink = process.env.DEFAULT_INTERVIEW_MEET_URL?.trim();
    if (fallbackLink) {
      meetLink = fallbackLink;
      calendarFallbackUsed = true;
    }
  }

  const sessionId = randomUUID();
  await adminDb.collection('interviewSessions').doc(sessionId).set({
    companyId: recruiter.companyId,
    recruiterId: uid,
    jobId: payload.jobId,
    jobTitle: job.title,
    title: payload.title,
    description: payload.description ?? '',
    startTimeIso: payload.startTimeIso,
    endTimeIso: payload.endTimeIso,
    timezone: payload.timezone,
    meetLink,
    calendarEventId,
    candidateIds,
    candidateEmails: Array.from(new Set(candidateEmails)),
    status: 'Scheduled',
    transcriptStatus: 'Pending',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await Promise.all(
    validApplications.map((application) =>
      adminDb.collection('applications').doc(String(application.id)).update({
        status: 'Interview',
        currentStage: 'Interview Scheduled',
        updatedAt: FieldValue.serverTimestamp(),
      })
    )
  );

  await Promise.all(
    validApplications.map((application) =>
      queueStageNotificationEmail({
        toEmail: application.email ?? '',
        subject: `Interview scheduled: ${job.title}`,
        text: [
          `Hi ${application.candidateName ?? 'Candidate'},`,
          '',
          `Your interview for ${job.title} has been scheduled.`,
          `Start: ${new Date(payload.startTimeIso).toLocaleString()}`,
          `End: ${new Date(payload.endTimeIso).toLocaleString()}`,
          meetLink
            ? `Meeting Link: ${meetLink}`
            : 'Meeting link will be shared by recruiter shortly.',
          calendarFallbackUsed
            ? 'Note: This link was configured as a fallback because Google Calendar write access is unavailable.'
            : '',
          '',
          'Please join on time and keep your notifications enabled for next-stage updates.',
        ]
          .filter(Boolean)
          .join('\n'),
      })
    )
  );

  await reconcileJobTransparency(payload.jobId, recruiter.companyId, job.title);

  return {
    sessionId,
    meetLink,
    calendarFallbackUsed,
  };
}

export async function updateInterviewSession(
  input: z.infer<typeof updateInterviewSessionSchema>
) {
  const payload = updateInterviewSessionSchema.parse(input);
  const decodedToken = await adminAuth.verifyIdToken(payload.idToken);
  const recruiter = await assertRecruiterRole(decodedToken.uid);

  const sessionRef = adminDb.collection('interviewSessions').doc(payload.sessionId);
  const sessionSnapshot = await sessionRef.get();
  if (!sessionSnapshot.exists) {
    throw new Error('Interview session not found.');
  }

  const session = sessionSnapshot.data() as { companyId: string };
  if (session.companyId !== recruiter.companyId) {
    throw new Error('Not authorized to edit this interview session.');
  }

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (payload.title) updates.title = payload.title;
  if (payload.description !== undefined) updates.description = payload.description;
  if (payload.startTimeIso) updates.startTimeIso = payload.startTimeIso;
  if (payload.endTimeIso) updates.endTimeIso = payload.endTimeIso;
  if (payload.timezone) updates.timezone = payload.timezone;
  if (payload.status) updates.status = payload.status;
  if (payload.meetLink) updates.meetLink = payload.meetLink;

  await sessionRef.update(updates);

  return {
    ok: true,
  };
}

export async function saveInterviewTranscript(
  input: z.infer<typeof saveInterviewTranscriptSchema>
) {
  const payload = saveInterviewTranscriptSchema.parse(input);
  const decodedToken = await adminAuth.verifyIdToken(payload.idToken);
  const recruiter = await assertRecruiterRole(decodedToken.uid);

  const sessionRef = adminDb.collection('interviewSessions').doc(payload.sessionId);
  const sessionSnapshot = await sessionRef.get();
  if (!sessionSnapshot.exists) {
    throw new Error('Interview session not found.');
  }

  const session = sessionSnapshot.data() as {
    companyId: string;
    jobId: string;
    jobTitle: string;
  };

  if (session.companyId !== recruiter.companyId) {
    throw new Error('Not authorized to attach transcript to this session.');
  }

  const analysis = await analyzeInterviewTranscript({
    transcriptText: redactPII(payload.transcriptText),
    roleContext: session.jobTitle,
  });

  const transcriptId = `${payload.sessionId}_${payload.candidateId}`;
  await adminDb.collection('interviewTranscripts').doc(transcriptId).set({
    sessionId: payload.sessionId,
    companyId: recruiter.companyId,
    candidateId: payload.candidateId,
    transcriptText: redactPII(payload.transcriptText),
    source: payload.source,
    extractedSummary: analysis.summary,
    extractedStrengths: analysis.strengths,
    extractedRisks: analysis.risks,
    communicationScore: analysis.communicationScore,
    problemSolvingScore: analysis.problemSolvingScore,
    confidenceScore: analysis.confidenceScore,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await sessionRef.update({
    transcriptStatus: 'Available',
    updatedAt: FieldValue.serverTimestamp(),
  });

  const applicationSnapshot = await adminDb
    .collection('applications')
    .where('jobId', '==', session.jobId)
    .where('candidateId', '==', payload.candidateId)
    .limit(1)
    .get();

  if (!applicationSnapshot.empty) {
    const appRef = applicationSnapshot.docs[0].ref;
    await appRef.update({
      transparencyReportAvailable: true,
      hasReport: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  const reportId = await upsertJobTransparencyReport({
    recruiterCompanyId: recruiter.companyId,
    sessionId: payload.sessionId,
    jobId: session.jobId,
    jobTitle: session.jobTitle,
    candidateId: payload.candidateId,
    transcriptSummary: analysis.summary,
    transcriptHighlights: analysis.highlights,
    communicationScore: analysis.communicationScore,
    problemSolvingScore: analysis.problemSolvingScore,
    confidenceScore: analysis.confidenceScore,
    publicVisibility: payload.publicVisibility,
  });

  await reconcileJobTransparency(session.jobId, recruiter.companyId, session.jobTitle);

  return {
    transcriptId,
    reportId,
  };
}

export async function finalizeTransparencyReport(
  input: z.infer<typeof finalizeTransparencyReportSchema>
) {
  const payload = finalizeTransparencyReportSchema.parse(input);
  const decodedToken = await adminAuth.verifyIdToken(payload.idToken);
  const recruiter = await assertRecruiterRole(decodedToken.uid);

  const reportId = `job-${payload.jobId}`;
  const reportRef = adminDb.collection('transparencyReports').doc(reportId);
  const reportSnapshot = await reportRef.get();
  if (!reportSnapshot.exists) {
    throw new Error('No transparency report exists for this job yet.');
  }

  const data = reportSnapshot.data() as Record<string, unknown>;
  if (String(data.companyId) !== recruiter.companyId) {
    throw new Error('Not authorized to finalize this report.');
  }

  const candidates = Array.isArray(data.anonymizedCandidates)
    ? (data.anonymizedCandidates as Array<Record<string, unknown>>)
    : [];

  const updatedCandidates = candidates.map((entry) => ({
    ...entry,
    status:
      String(entry.candidateId) === payload.selectedCandidateId ? 'Selected' : 'NotSelected',
  }));

  const jobApplicationsSnapshot = await adminDb
    .collection('applications')
    .where('jobId', '==', payload.jobId)
    .get();

  const allowedCandidateIds = Array.from(
    new Set(
      jobApplicationsSnapshot.docs
        .map((doc) => String(doc.data().candidateId ?? ''))
        .filter(Boolean)
    )
  );

  await reportRef.set(
    {
      candidateId: payload.selectedCandidateId,
      decidingFactor: redactPII(payload.decidingFactor),
      allowedCandidateIds,
      anonymizedCandidates: updatedCandidates,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await Promise.all(
    jobApplicationsSnapshot.docs.map((doc) =>
      doc.ref.set(
        {
          transparencyReportAvailable: true,
          hasReport: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    )
  );

  await reconcileJobTransparency(
    payload.jobId,
    recruiter.companyId,
    String(data.jobTitle ?? 'Role')
  );

  return {
    reportId,
  };
}

export async function backfillTransparencyAccessForJob(
  input: z.infer<typeof backfillTransparencyAccessSchema>
) {
  const payload = backfillTransparencyAccessSchema.parse(input);
  const decodedToken = await adminAuth.verifyIdToken(payload.idToken);
  const recruiter = await assertRecruiterRole(decodedToken.uid);

  const jobRef = adminDb.collection('jobs').doc(payload.jobId);
  const jobSnapshot = await jobRef.get();
  if (!jobSnapshot.exists) {
    throw new Error('Job not found.');
  }

  const job = jobSnapshot.data() as { title?: string; companyId: string };
  if (job.companyId !== recruiter.companyId) {
    throw new Error('Not authorized to backfill this job report.');
  }

  const applicationsSnapshot = await adminDb
    .collection('applications')
    .where('jobId', '==', payload.jobId)
    .get();

  if (applicationsSnapshot.empty) {
    throw new Error('No applications found for this job.');
  }

  const reportRef = adminDb.collection('transparencyReports').doc(`job-${payload.jobId}`);
  const reportSnapshot = await reportRef.get();
  const reportData = reportSnapshot.exists
    ? (reportSnapshot.data() as Record<string, unknown>)
    : null;
  const visibility = Boolean(reportData?.publicVisibility);

  for (const doc of applicationsSnapshot.docs) {
    const app = doc.data() as {
      candidateId: string;
      status?: string;
      logicScore?: number;
      matchScore?: number;
      jobTitle?: string;
    };

    const baselineScore =
      typeof app.logicScore === 'number'
        ? app.logicScore
        : typeof app.matchScore === 'number'
          ? app.matchScore
          : 50;

    await upsertJobTransparencyReport({
      recruiterCompanyId: recruiter.companyId,
      sessionId: '',
      jobId: payload.jobId,
      jobTitle: app.jobTitle ?? job.title ?? 'Role',
      candidateId: app.candidateId,
      transcriptSummary:
        'Backfilled report entry generated from available application and stage data.',
      transcriptHighlights: [
        `Application status: ${app.status ?? 'Pending'}`,
        'Transcript data may be unavailable for this candidate.',
      ],
      communicationScore: baselineScore,
      problemSolvingScore: baselineScore,
      confidenceScore: baselineScore,
      publicVisibility: visibility,
    });
  }

  await Promise.all(
    applicationsSnapshot.docs.map((doc) =>
      doc.ref.set(
        {
          transparencyReportAvailable: true,
          hasReport: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    )
  );

  await reconcileJobTransparency(payload.jobId, recruiter.companyId, job.title ?? 'Role');

  return {
    reportId: `job-${payload.jobId}`,
    applicationsUpdated: applicationsSnapshot.size,
  };
}

export async function ingestInterviewTranscriptFromBot(
  input: z.infer<typeof ingestBotTranscriptSchema>
) {
  const payload = ingestBotTranscriptSchema.parse(input);

  const sessionSnapshot = await adminDb
    .collection('interviewSessions')
    .doc(payload.sessionId)
    .get();
  if (!sessionSnapshot.exists) {
    throw new Error('Interview session not found.');
  }

  const session = sessionSnapshot.data() as {
    companyId: string;
    jobId: string;
    jobTitle: string;
  };

  const analysis = await analyzeInterviewTranscript({
    transcriptText: redactPII(payload.transcriptText),
    roleContext: session.jobTitle,
  });

  const transcriptId = `${payload.sessionId}_${payload.candidateId}`;
  await adminDb.collection('interviewTranscripts').doc(transcriptId).set({
    sessionId: payload.sessionId,
    companyId: session.companyId,
    candidateId: payload.candidateId,
    transcriptText: redactPII(payload.transcriptText),
    source: payload.source,
    extractedSummary: analysis.summary,
    extractedStrengths: analysis.strengths,
    extractedRisks: analysis.risks,
    communicationScore: analysis.communicationScore,
    problemSolvingScore: analysis.problemSolvingScore,
    confidenceScore: analysis.confidenceScore,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const reportId = await upsertJobTransparencyReport({
    recruiterCompanyId: session.companyId,
    sessionId: payload.sessionId,
    jobId: session.jobId,
    jobTitle: session.jobTitle,
    candidateId: payload.candidateId,
    transcriptSummary: analysis.summary,
    transcriptHighlights: analysis.highlights,
    communicationScore: analysis.communicationScore,
    problemSolvingScore: analysis.problemSolvingScore,
    confidenceScore: analysis.confidenceScore,
    publicVisibility: payload.publicVisibility,
  });

  await reconcileJobTransparency(session.jobId, session.companyId, session.jobTitle);

  return {
    transcriptId,
    reportId,
  };
}

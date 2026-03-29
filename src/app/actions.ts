'use server';

import { randomUUID } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { generateAssessmentTask } from '@/ai/flows/generate-assessment-task-flow';
import { evaluateSolutionAndProvideFeedback } from '@/ai/flows/evaluate-solution-and-provide-feedback';
import { detectSubmissionAuthenticity } from '@/ai/flows/detect-submission-authenticity';

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
  };

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
    transparencyReportAvailable: false,
    matchScore: 0,
    currentStage: 'Application Review',
    hasReport: false,
    company: job.company,
    companyId: job.companyId,
    jobTitle: job.title,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    applicationId,
  };
}

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  Application,
  CandidateResumeProfile,
  CandidateAssessment,
  InterviewSession,
  InterviewTranscript,
  Job,
  PipelineStage,
  TransparencyReport,
} from '@/lib/types';

function withId<T>(id: string, data: T): T & { id: string } {
  return { id, ...data };
}

function toJob(id: string, data: Record<string, unknown>): Job {
  return withId(id, {
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
      : [],
  });
}

function toApplication(id: string, data: Record<string, unknown>): Application {
  return withId(id, {
    jobId: String(data.jobId ?? ''),
    candidateId: String(data.candidateId ?? ''),
    candidateName: String(data.candidateName ?? ''),
    email: String(data.email ?? ''),
    status: (data.status as Application['status']) ?? 'Pending',
    appliedDate: String(data.appliedDate ?? ''),
    cvUrl: data.cvUrl ? String(data.cvUrl) : undefined,
    coverLetter: data.coverLetter ? String(data.coverLetter) : undefined,
    logicScore: typeof data.logicScore === 'number' ? data.logicScore : undefined,
    transparencyReportAvailable: Boolean(data.transparencyReportAvailable),
    matchScore: Number(data.matchScore ?? 0),
    currentStage: String(data.currentStage ?? ''),
    hasReport: Boolean(data.hasReport),
    company: String(data.company ?? ''),
    companyId: String(data.companyId ?? ''),
    jobTitle: String(data.jobTitle ?? ''),
    pipelineStageIndex:
      typeof data.pipelineStageIndex === 'number' ? data.pipelineStageIndex : 0,
    stageHistory: Array.isArray(data.stageHistory)
      ? (data.stageHistory as Application['stageHistory'])
      : [],
    autoApplied: Boolean(data.autoApplied),
  });
}

function toCandidateResumeProfile(
  candidateId: string,
  data: Record<string, unknown>
): CandidateResumeProfile {
  return {
    candidateId,
    sourceCvUrl: data.sourceCvUrl ? String(data.sourceCvUrl) : undefined,
    extractedText: String(data.extractedText ?? ''),
    summary: String(data.summary ?? ''),
    skills: Array.isArray(data.skills) ? (data.skills as string[]) : [],
    updatedAt: String(data.updatedAt ?? ''),
  };
}

function toAssessment(id: string, data: Record<string, unknown>): CandidateAssessment {
  return withId(id, {
    candidateId: String(data.candidateId ?? ''),
    skill: String(data.skill ?? ''),
    score: Number(data.score ?? 0),
    stabilityScore: Number(data.stabilityScore ?? 0),
    authenticityScore: Number(data.authenticityScore ?? 0),
    feedback: String(data.feedback ?? ''),
    strengths: Array.isArray(data.strengths) ? (data.strengths as string[]) : [],
    weaknesses: Array.isArray(data.weaknesses) ? (data.weaknesses as string[]) : [],
    lastAttempt: String(data.lastAttempt ?? ''),
  });
}

function toTransparencyReport(
  id: string,
  data: Record<string, unknown>
): TransparencyReport {
  return withId(id, {
    jobId: data.jobId ? String(data.jobId) : undefined,
    applicationId: String(data.applicationId ?? ''),
    companyId: String(data.companyId ?? ''),
    candidateId: String(data.candidateId ?? ''),
    jobTitle: String(data.jobTitle ?? ''),
    company: String(data.company ?? ''),
    userMetrics: data.userMetrics as TransparencyReport['userMetrics'],
    hiredMetrics: data.hiredMetrics as TransparencyReport['hiredMetrics'],
    qualitativeAnalysis: String(data.qualitativeAnalysis ?? ''),
    decidingFactor: String(data.decidingFactor ?? ''),
    publicVisibility: Boolean(data.publicVisibility),
    interviewSessionId: data.interviewSessionId
      ? String(data.interviewSessionId)
      : undefined,
    transcriptSummary: data.transcriptSummary
      ? String(data.transcriptSummary)
      : undefined,
    transcriptHighlights: Array.isArray(data.transcriptHighlights)
      ? (data.transcriptHighlights as string[])
      : [],
    anonymizedCandidates: Array.isArray(data.anonymizedCandidates)
      ? (data.anonymizedCandidates as TransparencyReport['anonymizedCandidates'])
      : [],
    piiRedactionEnabled: Boolean(data.piiRedactionEnabled),
  });
}

function toInterviewSession(id: string, data: Record<string, unknown>): InterviewSession {
  return withId(id, {
    companyId: String(data.companyId ?? ''),
    recruiterId: String(data.recruiterId ?? ''),
    jobId: String(data.jobId ?? ''),
    jobTitle: String(data.jobTitle ?? ''),
    title: String(data.title ?? ''),
    description: data.description ? String(data.description) : undefined,
    startTimeIso: String(data.startTimeIso ?? ''),
    endTimeIso: String(data.endTimeIso ?? ''),
    timezone: String(data.timezone ?? 'UTC'),
    meetLink: String(data.meetLink ?? ''),
    calendarEventId: data.calendarEventId ? String(data.calendarEventId) : undefined,
    candidateIds: Array.isArray(data.candidateIds) ? (data.candidateIds as string[]) : [],
    candidateEmails: Array.isArray(data.candidateEmails)
      ? (data.candidateEmails as string[])
      : [],
    status: (data.status as InterviewSession['status']) ?? 'Scheduled',
    transcriptStatus:
      (data.transcriptStatus as InterviewSession['transcriptStatus']) ?? 'Pending',
  });
}

function toInterviewTranscript(
  id: string,
  data: Record<string, unknown>
): InterviewTranscript {
  return withId(id, {
    sessionId: String(data.sessionId ?? ''),
    companyId: String(data.companyId ?? ''),
    candidateId: String(data.candidateId ?? ''),
    transcriptText: String(data.transcriptText ?? ''),
    source: (data.source as InterviewTranscript['source']) ?? 'manual',
    extractedSummary: String(data.extractedSummary ?? ''),
    extractedStrengths: Array.isArray(data.extractedStrengths)
      ? (data.extractedStrengths as string[])
      : [],
    extractedRisks: Array.isArray(data.extractedRisks)
      ? (data.extractedRisks as string[])
      : [],
    communicationScore: Number(data.communicationScore ?? 0),
    problemSolvingScore: Number(data.problemSolvingScore ?? 0),
    confidenceScore: Number(data.confidenceScore ?? 0),
  });
}

export async function getJobs(companyId?: string): Promise<Job[]> {
  const constraints: QueryConstraint[] = [];
  if (companyId) {
    constraints.push(where('companyId', '==', companyId));
  }
  constraints.push(orderBy('postedAt', 'desc'));

  const jobsQuery = query(collection(db, 'jobs'), ...constraints);
  const snapshot = await getDocs(jobsQuery);

  return snapshot.docs.map((jobDoc) => toJob(jobDoc.id, jobDoc.data()));
}

export async function getJob(jobId: string): Promise<Job | null> {
  const snapshot = await getDoc(doc(db, 'jobs', jobId));
  if (!snapshot.exists()) {
    return null;
  }

  return toJob(snapshot.id, snapshot.data());
}

export async function getApplications(companyId?: string): Promise<Application[]> {
  const constraints: QueryConstraint[] = [orderBy('appliedDate', 'desc')];
  if (companyId) {
    constraints.unshift(where('companyId', '==', companyId));
  }

  const appsQuery = query(collection(db, 'applications'), ...constraints);
  const snapshot = await getDocs(appsQuery);

  return snapshot.docs.map((appDoc) => toApplication(appDoc.id, appDoc.data()));
}

export async function getCandidateApplications(
  candidateId: string
): Promise<Application[]> {
  const appsQuery = query(
    collection(db, 'applications'),
    where('candidateId', '==', candidateId),
    orderBy('appliedDate', 'desc')
  );

  const snapshot = await getDocs(appsQuery);
  return snapshot.docs.map((appDoc) => toApplication(appDoc.id, appDoc.data()));
}

export async function getApplicationsByJob(
  jobId: string,
  companyId: string
): Promise<Application[]> {
  const appsQuery = query(
    collection(db, 'applications'),
    where('jobId', '==', jobId),
    where('companyId', '==', companyId),
    orderBy('appliedDate', 'desc')
  );

  const snapshot = await getDocs(appsQuery);
  return snapshot.docs.map((appDoc) => toApplication(appDoc.id, appDoc.data()));
}

export async function getCandidateResumeProfile(
  candidateId: string
): Promise<CandidateResumeProfile | null> {
  const snapshot = await getDoc(doc(db, 'candidateProfiles', candidateId));
  if (!snapshot.exists()) {
    return null;
  }

  return toCandidateResumeProfile(snapshot.id, snapshot.data());
}

export async function getCandidateAssessments(
  candidateId: string
): Promise<CandidateAssessment[]> {
  const assessmentsQuery = query(
    collection(db, 'candidateAssessments'),
    where('candidateId', '==', candidateId),
    orderBy('lastAttempt', 'desc')
  );

  const snapshot = await getDocs(assessmentsQuery);
  return snapshot.docs.map((assessmentDoc) =>
    toAssessment(assessmentDoc.id, assessmentDoc.data())
  );
}

export async function getAssessmentResult(
  assessmentId: string
): Promise<CandidateAssessment | null> {
  const snapshot = await getDoc(doc(db, 'candidateAssessments', assessmentId));
  if (!snapshot.exists()) {
    return null;
  }

  return toAssessment(snapshot.id, snapshot.data());
}

export async function getTransparencyReport(
  reportId: string
): Promise<TransparencyReport | null> {
  const snapshot = await getDoc(doc(db, 'transparencyReports', reportId));
  if (!snapshot.exists()) {
    return null;
  }

  return toTransparencyReport(snapshot.id, snapshot.data());
}

export async function getPublicTransparencyReports(): Promise<TransparencyReport[]> {
  const reportsQuery = query(
    collection(db, 'transparencyReports'),
    where('publicVisibility', '==', true)
  );

  const snapshot = await getDocs(reportsQuery);
  return snapshot.docs.map((reportDoc) =>
    toTransparencyReport(reportDoc.id, reportDoc.data())
  );
}

export async function getRecruiterInterviewSessions(
  companyId: string
): Promise<InterviewSession[]> {
  const sessionsQuery = query(
    collection(db, 'interviewSessions'),
    where('companyId', '==', companyId),
    orderBy('startTimeIso', 'desc')
  );

  const snapshot = await getDocs(sessionsQuery);
  return snapshot.docs.map((sessionDoc) =>
    toInterviewSession(sessionDoc.id, sessionDoc.data())
  );
}

export async function getCandidateInterviewSessions(
  candidateId: string
): Promise<InterviewSession[]> {
  const sessionsQuery = query(
    collection(db, 'interviewSessions'),
    where('candidateIds', 'array-contains', candidateId),
    orderBy('startTimeIso', 'desc')
  );

  const snapshot = await getDocs(sessionsQuery);
  return snapshot.docs.map((sessionDoc) =>
    toInterviewSession(sessionDoc.id, sessionDoc.data())
  );
}

export async function getInterviewTranscriptBySession(
  sessionId: string,
  candidateId?: string
): Promise<InterviewTranscript | null> {
  const constraints: QueryConstraint[] = [where('sessionId', '==', sessionId)];
  if (candidateId) {
    constraints.push(where('candidateId', '==', candidateId));
  }

  const transcriptsQuery = query(collection(db, 'interviewTranscripts'), ...constraints);
  const snapshot = await getDocs(transcriptsQuery);
  if (snapshot.empty) {
    return null;
  }

  return toInterviewTranscript(snapshot.docs[0].id, snapshot.docs[0].data());
}

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
  CandidateAssessment,
  Job,
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
  });
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
    applicationId: String(data.applicationId ?? ''),
    companyId: String(data.companyId ?? ''),
    candidateId: String(data.candidateId ?? ''),
    jobTitle: String(data.jobTitle ?? ''),
    company: String(data.company ?? ''),
    userMetrics: data.userMetrics as TransparencyReport['userMetrics'],
    hiredMetrics: data.hiredMetrics as TransparencyReport['hiredMetrics'],
    qualitativeAnalysis: String(data.qualitativeAnalysis ?? ''),
    decidingFactor: String(data.decidingFactor ?? ''),
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

export type UserRole = 'candidate' | 'recruiter';

export interface PipelineStage {
  id: string;
  name: string;
  type: 'shortlist' | 'coding' | 'interview' | 'decision';
  instructions?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  companyId: string;
  location: string;
  salary: string;
  type: 'Full-time' | 'Contract' | 'Remote';
  description: string;
  requirements: string[];
  postedAt: string;
  tags: string[];
  pipelineStages?: PipelineStage[];
}

export interface Application {
  id: string;
  jobId: string;
  candidateId: string;
  candidateName: string;
  email: string;
  status: 'Pending' | 'Screening' | 'Assessment' | 'Interview' | 'Hired' | 'Rejected';
  appliedDate: string;
  cvUrl?: string;
  coverLetter?: string;
  logicScore?: number;
  transparencyReportAvailable: boolean;
  matchScore: number;
  currentStage: string;
  hasReport: boolean;
  company: string;
  companyId: string;
  jobTitle: string;
  pipelineStageIndex?: number;
  stageHistory?: Array<{
    stageId: string;
    stageName: string;
    status: 'advanced' | 'rejected';
    actorUid?: string;
    actorRole?: 'recruiter' | 'candidate' | 'system';
    decisionReasonCategory?:
      | 'skills-gap'
      | 'communication'
      | 'problem-solving'
      | 'culture-fit'
      | 'timeline-mismatch'
      | 'compensation'
      | 'other';
    evidenceBullets?: string[];
    rubricScore?: number;
    note?: string;
    updatedAt: string;
  }>;
  autoApplied?: boolean;
}

export interface CandidateResumeProfile {
  candidateId: string;
  sourceCvUrl?: string;
  extractedText: string;
  summary: string;
  skills: string[];
  updatedAt: string;
}

export interface CandidateAssessment {
  id: string;
  candidateId: string;
  skill: string;
  score: number;
  stabilityScore: number;
  authenticityScore: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  lastAttempt: string;
}

export interface TransparencyReport {
  id: string;
  jobId?: string;
  applicationId: string;
  companyId: string;
  candidateId: string;
  jobTitle: string;
  company: string;
  userMetrics: {
    experience: number;
    projectDepth: number;
    internshipRelevance: number;
    academicPedigree: number;
    skillMatch: number;
  };
  hiredMetrics: {
    experience: number;
    projectDepth: number;
    internshipRelevance: number;
    academicPedigree: number;
    skillMatch: number;
  };
  qualitativeAnalysis: string;
  decidingFactor: string;
  publicVisibility?: boolean;
  interviewSessionId?: string;
  transcriptSummary?: string;
  transcriptHighlights?: string[];
  anonymizedCandidates?: Array<{
    candidateId: string;
    candidateAlias: string;
    status: 'Selected' | 'NotSelected';
    resumeSummary: string;
    transcriptSummary: string;
    transcriptHighlights: string[];
    userMetrics: {
      experience: number;
      projectDepth: number;
      internshipRelevance: number;
      academicPedigree: number;
      skillMatch: number;
    };
  }>;
  piiRedactionEnabled?: boolean;
}

export interface InterviewSession {
  id: string;
  companyId: string;
  recruiterId: string;
  jobId: string;
  jobTitle: string;
  title: string;
  description?: string;
  startTimeIso: string;
  endTimeIso: string;
  timezone: string;
  meetLink: string;
  calendarEventId?: string;
  candidateIds: string[];
  candidateEmails: string[];
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  transcriptStatus: 'Pending' | 'Available';
  createdAt?: string;
  updatedAt?: string;
}

export interface InterviewTranscript {
  id: string;
  sessionId: string;
  companyId: string;
  candidateId: string;
  transcriptText: string;
  source: 'manual' | 'integration' | 'meetingBaas' | 'recall' | 'fireflies' | 'otter';
  extractedSummary: string;
  extractedStrengths: string[];
  extractedRisks: string[];
  communicationScore: number;
  problemSolvingScore: number;
  confidenceScore: number;
  createdAt?: string;
  updatedAt?: string;
}

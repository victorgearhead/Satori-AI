export type UserRole = 'candidate' | 'recruiter';

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
}

export interface Job {
  id: string;
  title: string;
  company: string;
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
  jobTitle: string;
}

export interface CandidateAssessment {
  id: string;
  skill: string;
  score: number;
  stabilityScore: number;
  lastAttempt: string;
}

export interface TransparencyReport {
  id: string;
  applicationId: string;
  jobTitle: string;
  company: string;
  userMetrics: {
    experience: number; // percentile or raw score based on years
    projectDepth: number; // complexity of showcased work
    internshipRelevance: number; // pedigree of past internships
    academicPedigree: number; // Tier-1/2 college weightage
    skillMatch: number; // Direct stack alignment
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

export const MOCK_JOBS: Job[] = [
  {
    id: 'j1',
    title: 'SDE-2 (Backend)',
    company: 'Zomato',
    location: 'Gurgaon, India',
    salary: '₹28L - ₹38L',
    type: 'Full-time',
    description: 'Looking for a high-performance Backend Engineer to scale our core order management systems. You will work on low-latency systems handling millions of requests per minute.',
    requirements: ['3+ years Experience in Java/Go', 'Understanding of Distributed Systems', 'Experience with Kafka/Redis at scale', 'Tier-1/2 College preferred'],
    postedAt: '2024-03-22',
    tags: ['Java', 'Spring Boot', 'Kafka', 'System Design'],
  },
  {
    id: 'j2',
    title: 'Senior Frontend Engineer',
    company: 'Flipkart',
    location: 'Bangalore, India',
    salary: '₹22L - ₹32L',
    type: 'Full-time',
    description: 'Architect and build the next generation of e-commerce storefronts. Focus on performance, accessibility, and high-quality user experiences.',
    requirements: ['4+ years React/Next.js experience', 'Deep knowledge of Web Vitals', 'Leadership in frontend architecture'],
    postedAt: '2024-03-21',
    tags: ['React', 'TypeScript', 'Next.js', 'Performance'],
  },
  {
    id: 'j3',
    title: 'Software Engineer (L3)',
    company: 'Swiggy',
    location: 'Remote / Bangalore',
    salary: '₹18L - ₹25L',
    type: 'Full-time',
    description: 'Join the Logistics & Delivery team to optimize our delivery algorithms. High impact role in a fast-paced environment.',
    requirements: ['2+ years experience', 'Strong Problem Solving (DS/Algo)', 'Python/Go proficiency'],
    postedAt: '2024-03-24',
    tags: ['Python', 'Algorithms', 'Go', 'Microservices'],
  },
];

export const MOCK_APPLICATIONS: Application[] = [
  {
    id: 'app-1',
    jobId: 'j1',
    candidateName: 'Rahul Sharma',
    email: 'rahul@example.com',
    status: 'Interview',
    appliedDate: '2024-03-23',
    logicScore: 92,
    transparencyReportAvailable: false,
    matchScore: 94,
    currentStage: 'Hiring Manager Round',
    hasReport: false,
    company: 'Zomato',
    jobTitle: 'SDE-2 (Backend)',
  },
  {
    id: 'app-2',
    jobId: 'j2',
    candidateName: 'Priya Verma',
    email: 'priya@example.com',
    status: 'Rejected',
    appliedDate: '2024-03-15',
    logicScore: 78,
    transparencyReportAvailable: true,
    matchScore: 82,
    currentStage: 'Final Decision',
    hasReport: true,
    company: 'Flipkart',
    jobTitle: 'Senior Frontend Engineer',
  },
  {
    id: 'app-3',
    jobId: 'j3',
    candidateName: 'Amit Patel',
    email: 'amit@example.com',
    status: 'Screening',
    appliedDate: '2024-03-25',
    logicScore: 85,
    transparencyReportAvailable: false,
    matchScore: 78,
    currentStage: 'Resume Review',
    hasReport: false,
    company: 'Swiggy',
    jobTitle: 'Software Engineer (L3)',
  }
];

export const MOCK_CANDIDATE_ASSESSMENTS: CandidateAssessment[] = [
  {
    id: 'ca-1',
    skill: 'Data Structures',
    score: 88,
    stabilityScore: 92,
    lastAttempt: '2024-03-10'
  },
  {
    id: 'ca-2',
    skill: 'System Design',
    score: 75,
    stabilityScore: 80,
    lastAttempt: '2024-03-12'
  }
];

export const MOCK_TRANSPARENCY_REPORTS: TransparencyReport[] = [
  {
    id: 'report-2',
    applicationId: 'app-2',
    jobTitle: 'Senior Frontend Engineer',
    company: 'Flipkart',
    userMetrics: {
      experience: 65, // 2.5 years
      projectDepth: 80, // Strong open source contributions
      internshipRelevance: 70, // 1 Mid-size startup
      academicPedigree: 75, // Tier-2 NIT
      skillMatch: 95 // Perfect Next.js/React match
    },
    hiredMetrics: {
      experience: 90, // 5 years (Senior benchmark)
      projectDepth: 85, // Production-grade design systems
      internshipRelevance: 95, // Ex-Microsoft Intern
      academicPedigree: 90, // Tier-1 (IIT)
      skillMatch: 92
    },
    qualitativeAnalysis: "Your technical skill match is exceptional, scoring higher than the hired candidate in specific logic domains. However, for this 'Senior' role, the hiring team prioritized 'Total Years of Professional Experience' (5 years vs your 2.5) and 'Academic Pedigree' (IIT vs NIT) to mitigate risk in architectural decisions. Your project depth is highly competitive, but the hired candidate's experience in scaling design systems at an enterprise level was the deciding factor.",
    decidingFactor: "Total Years of Relevant Professional Experience & Academic Background."
  }
];

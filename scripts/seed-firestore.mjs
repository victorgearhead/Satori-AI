import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId) {
  throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is required.');
}

const credential =
  clientEmail && privateKey
    ? cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      })
    : applicationDefault();

initializeApp({ credential, projectId });

const db = getFirestore();

const jobs = [
  {
    id: 'job-satori-backend',
    title: 'SDE-2 (Backend)',
    company: 'Swiggy',
    companyId: 'swiggy',
    location: 'Bangalore, India',
    salary: 'INR 28L - INR 38L',
    type: 'Full-time',
    description:
      'Build and scale low-latency backend services powering order routing and partner logistics.',
    requirements: [
      '3+ years with Java or Go',
      'Experience in distributed systems',
      'Production ownership in high throughput systems',
    ],
    postedAt: new Date().toISOString().slice(0, 10),
    tags: ['Java', 'Go', 'Kafka', 'System Design'],
  },
  {
    id: 'job-satori-frontend',
    title: 'Senior Frontend Engineer',
    company: 'Flipkart',
    companyId: 'flipkart',
    location: 'Bangalore, India',
    salary: 'INR 22L - INR 32L',
    type: 'Full-time',
    description:
      'Own performant customer-facing web journeys with React and Next.js at marketplace scale.',
    requirements: [
      '4+ years React/Next.js',
      'Strong Web Vitals and accessibility fundamentals',
      'Experience with design systems',
    ],
    postedAt: new Date().toISOString().slice(0, 10),
    tags: ['React', 'TypeScript', 'Next.js', 'Performance'],
  },
  {
    id: 'job-satori-platform',
    title: 'Software Engineer (Platform)',
    company: 'Zomato',
    companyId: 'zomato',
    location: 'Gurgaon, India',
    salary: 'INR 20L - INR 30L',
    type: 'Remote',
    description:
      'Design and operate service platform tooling for observability, reliability, and CI/CD excellence.',
    requirements: [
      'Strong Linux and cloud fundamentals',
      'Scripting in Python/Go',
      'Experience with Kubernetes',
    ],
    postedAt: new Date().toISOString().slice(0, 10),
    tags: ['Kubernetes', 'Go', 'Python', 'Platform'],
  },
];

const users = [
  {
    id: 'demo-recruiter-swiggy',
    email: 'recruiter@swiggy.test',
    displayName: 'Swiggy Recruiter',
    role: 'recruiter',
    companyId: 'swiggy',
  },
  {
    id: 'demo-candidate',
    email: 'candidate@test.com',
    displayName: 'Demo Candidate',
    role: 'candidate',
  },
];

const transparencyReports = [
  {
    id: 'job-job-satori-backend',
    jobId: 'job-satori-backend',
    applicationId: 'job-job-satori-backend',
    companyId: 'swiggy',
    candidateId: 'demo-candidate',
    jobTitle: 'SDE-2 (Backend)',
    company: 'Swiggy',
    userMetrics: {
      experience: 72,
      projectDepth: 78,
      internshipRelevance: 70,
      academicPedigree: 74,
      skillMatch: 82,
    },
    hiredMetrics: {
      experience: 84,
      projectDepth: 88,
      internshipRelevance: 82,
      academicPedigree: 86,
      skillMatch: 87,
    },
    qualitativeAnalysis:
      'Candidate demonstrated strong API design intuition and debugging speed. The final selection favored deeper distributed-systems incident ownership under production pressure.',
    decidingFactor: 'Higher production incident ownership in distributed backend systems.',
    publicVisibility: true,
    transcriptSummary:
      'Interview transcript showed clear communication and structured reasoning. Improvement area was deeper consistency in trade-off analysis under scale constraints.',
    transcriptHighlights: [
      'Strong explanation of idempotency strategy for payment retries.',
      'Needed prompting to quantify p95/p99 latency impact of design choices.',
      'Demonstrated practical debugging workflow during outage scenario.',
    ],
    anonymizedCandidates: [
      {
        candidateId: 'demo-candidate',
        candidateAlias: 'CAND-8FA19A21',
        status: 'Selected',
        resumeSummary: 'Backend candidate with distributed systems and microservices experience.',
        transcriptSummary:
          'Structured communication and strong debugging depth with moderate scaling trade-off clarity.',
        transcriptHighlights: [
          'Clear retry/idempotency approach.',
          'Good incident triage process articulation.',
        ],
        userMetrics: {
          experience: 84,
          projectDepth: 88,
          internshipRelevance: 82,
          academicPedigree: 86,
          skillMatch: 87,
        },
      },
      {
        candidateId: 'demo-candidate-2',
        candidateAlias: 'CAND-C71DBA42',
        status: 'NotSelected',
        resumeSummary: 'Strong coding fundamentals with limited large-scale backend ownership.',
        transcriptSummary:
          'Good fundamentals but lower confidence on production trade-off decisions in high-scale contexts.',
        transcriptHighlights: [
          'Solid API contract basics.',
          'Needed support on latency-budget reasoning.',
        ],
        userMetrics: {
          experience: 72,
          projectDepth: 78,
          internshipRelevance: 70,
          academicPedigree: 74,
          skillMatch: 82,
        },
      },
    ],
    piiRedactionEnabled: true,
  },
];

async function seed() {
  const batch = db.batch();

  for (const user of users) {
    const ref = db.collection('users').doc(user.id);
    batch.set(ref, {
      ...user,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  for (const job of jobs) {
    const ref = db.collection('jobs').doc(job.id);
    batch.set(ref, {
      ...job,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  for (const report of transparencyReports) {
    const ref = db.collection('transparencyReports').doc(report.id);
    batch.set(ref, {
      ...report,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  console.log('Seed completed. Added jobs and demo profiles.');
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

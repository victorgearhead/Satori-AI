import { config } from 'dotenv';
config();

import '@/ai/flows/detect-submission-authenticity.ts';
import '@/ai/flows/evaluate-solution-and-provide-feedback.ts';
import '@/ai/flows/generate-skill-profile-summary.ts';
import '@/ai/flows/generate-assessment-task-flow.ts';
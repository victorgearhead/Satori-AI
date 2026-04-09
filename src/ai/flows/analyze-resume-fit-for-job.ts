'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeResumeFitForJobInputSchema = z.object({
  jobTitle: z.string().min(2),
  jobDescription: z.string().min(10),
  requirements: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  resumeText: z.string().min(50),
});

const AnalyzeResumeFitForJobOutputSchema = z.object({
  overallMatchScore: z.number().min(0).max(100),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  summary: z.string(),
});

export type AnalyzeResumeFitForJobInput = z.infer<typeof AnalyzeResumeFitForJobInputSchema>;
export type AnalyzeResumeFitForJobOutput = z.infer<typeof AnalyzeResumeFitForJobOutputSchema>;

export async function analyzeResumeFitForJob(
  input: AnalyzeResumeFitForJobInput
): Promise<AnalyzeResumeFitForJobOutput> {
  return analyzeResumeFitForJobFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeResumeFitForJobPrompt',
  input: { schema: AnalyzeResumeFitForJobInputSchema },
  output: { schema: AnalyzeResumeFitForJobOutputSchema },
  prompt: `You are a recruiter copilot for technical hiring.

Given a job and a candidate resume, evaluate how well the resume fits the role.

Job Title: {{{jobTitle}}}

Job Description:
{{{jobDescription}}}

Requirements:
{{#each requirements}}
- {{{this}}}
{{/each}}

Tags:
{{#each tags}}
- {{{this}}}
{{/each}}

Resume Text:
{{{resumeText}}}

Instructions:
1) Provide a strict overall match score between 0 and 100.
2) Return concrete matched skills found in the resume.
3) Return missing skills that are important for the role but absent/weak in the resume.
4) Return 3-6 strengths and 2-6 concerns.
5) Keep summary concise (2-4 sentences) and recruiter-friendly.
6) Do not include PII.

Return JSON only, matching the output schema.`,
});

const analyzeResumeFitForJobFlow = ai.defineFlow(
  {
    name: 'analyzeResumeFitForJobFlow',
    inputSchema: AnalyzeResumeFitForJobInputSchema,
    outputSchema: AnalyzeResumeFitForJobOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

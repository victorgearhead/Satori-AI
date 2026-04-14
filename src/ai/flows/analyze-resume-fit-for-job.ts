'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GENERIC_SKILL_TERMS = new Set([
  'ability',
  'across',
  'candidate',
  'communication',
  'detail',
  'documentation',
  'ensure',
  'experience',
  'familiarity',
  'knowledge',
  'problem solving',
  'problem-solving',
  'quality',
  'required',
  'responsibility',
  'role',
  'skills',
  'strong',
  'team',
  'understanding',
  'work',
  'years',
]);

function normalizeSkillToken(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.+#\-\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelySkill(text: string): boolean {
  const normalized = normalizeSkillToken(text);
  if (!normalized) {
    return false;
  }

  if (normalized.length < 2 || normalized.length > 40) {
    return false;
  }

  const words = normalized.split(' ').filter(Boolean);
  if (words.length === 0 || words.length > 4) {
    return false;
  }

  if (GENERIC_SKILL_TERMS.has(normalized)) {
    return false;
  }

  const meaningfulWordCount = words.filter(
    (word) => !GENERIC_SKILL_TERMS.has(word) && word.length > 1
  ).length;

  return meaningfulWordCount > 0;
}

function sanitizeSkillList(values: string[], maxItems = 12): string[] {
  const unique = new Set<string>();

  for (const raw of values) {
    const normalized = normalizeSkillToken(raw);
    if (!isLikelySkill(normalized)) {
      continue;
    }
    unique.add(normalized);
    if (unique.size >= maxItems) {
      break;
    }
  }

  return Array.from(unique);
}

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
7) For matchedSkills and missingSkills, include ONLY real skill terms (tools, frameworks, languages, platforms, methods), not sentence fragments.
8) Never output generic soft-skill or requirement words as skills (for example: communication, teamwork, problem solving, quality, responsibility, knowledge, experience).
9) Keep each skill short (1-4 words), lowercase preferred, and deduplicated.
10) Cap matchedSkills and missingSkills to 12 items each.

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
    const safeOutput = output!;
    return {
      ...safeOutput,
      matchedSkills: sanitizeSkillList(safeOutput.matchedSkills, 12),
      missingSkills: sanitizeSkillList(safeOutput.missingSkills, 12),
    };
  }
);

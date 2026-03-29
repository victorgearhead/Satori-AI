'use server';
/**
 * @fileOverview This file implements a Genkit flow for detecting the authenticity
 * of a candidate's submission, identifying potential copy-pasted or AI-generated content.
 *
 * - detectSubmissionAuthenticity - A function that handles the authenticity detection process.
 * - DetectSubmissionAuthenticityInput - The input type for the detectSubmissionAuthenticity function.
 * - DetectSubmissionAuthenticityOutput - The return type for the detectSubmissionAuthenticity function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectSubmissionAuthenticityInputSchema = z.object({
  submissionContent: z
    .string()
    .describe(
      'The code or text content of the candidate submission to be analyzed for authenticity.'
    ),
  candidateHistory: z
    .string()
    .optional()
    .describe(
      'Optional: Previous submission history or performance data for the candidate, to help detect sudden performance jumps or inconsistencies.'
    ),
});
export type DetectSubmissionAuthenticityInput = z.infer<
  typeof DetectSubmissionAuthenticityInputSchema
>;

const DetectSubmissionAuthenticityOutputSchema = z.object({
  isAuthentic: z
    .boolean()
    .describe('True if the submission appears authentic, false otherwise.'),
  authenticityScore: z
    .number()
    .min(0)
    .max(100)
    .describe(
      'A score from 0 (highly suspicious) to 100 (highly authentic) indicating the likelihood of the submission being original and human-generated.'
    ),
  authenticityReasoning: z
    .string()
    .describe(
      'A detailed explanation for the authenticity score, highlighting any detected patterns such as copy-paste, AI-generated phrases, or inconsistencies with past performance (if provided).'
    ),
  detectedPatterns: z
    .array(z.string())
    .optional()
    .describe(
      'A list of specific patterns detected, e.g., "copy-paste", "AI-generated style", "inconsistent with history".'
    ),
});
export type DetectSubmissionAuthenticityOutput = z.infer<
  typeof DetectSubmissionAuthenticityOutputSchema
>;

export async function detectSubmissionAuthenticity(
  input: DetectSubmissionAuthenticityInput
): Promise<DetectSubmissionAuthenticityOutput> {
  return detectSubmissionAuthenticityFlow(input);
}

const authenticityPrompt = ai.definePrompt({
  name: 'authenticityPrompt',
  input: {schema: DetectSubmissionAuthenticityInputSchema},
  output: {schema: DetectSubmissionAuthenticityOutputSchema},
  prompt: `You are an advanced AI authenticity detection engine for a talent intelligence platform. Your task is to analyze candidate submissions for signs of plagiarism (copy-paste) or AI generation. You need to provide a score, reasoning, and list specific detected patterns.

Consider the following submission content:
Submission: \`\`\`{{{submissionContent}}}\`\`\`

{{#if candidateHistory}}
Also consider the candidate's historical performance/submissions (if available) for consistency analysis. This can help detect sudden performance jumps or inconsistencies:
History: \`\`\`{{{candidateHistory}}}\`\`\`
{{/if}}

Based on your analysis, determine if the submission is authentic (isAuthentic: true/false), assign an authenticity score from 0 (highly suspicious) to 100 (highly authentic), and provide a detailed reasoning. Also, list any specific patterns detected.

Output your response in JSON format according to the output schema provided, ensuring all fields are populated.`,
});

const detectSubmissionAuthenticityFlow = ai.defineFlow(
  {
    name: 'detectSubmissionAuthenticityFlow',
    inputSchema: DetectSubmissionAuthenticityInputSchema,
    outputSchema: DetectSubmissionAuthenticityOutputSchema,
  },
  async input => {
    const {output} = await authenticityPrompt(input);
    if (!output) {
      throw new Error('Failed to get authenticity detection output.');
    }
    return output;
  }
);

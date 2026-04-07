'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AnalyzeInterviewTranscriptInputSchema = z.object({
  transcriptText: z.string().min(1),
  roleContext: z.string().optional(),
  skillContext: z.string().optional(),
});

export type AnalyzeInterviewTranscriptInput = z.infer<
  typeof AnalyzeInterviewTranscriptInputSchema
>;

const AnalyzeInterviewTranscriptOutputSchema = z.object({
  summary: z.string(),
  highlights: z.array(z.string()),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  communicationScore: z.number().min(0).max(100),
  problemSolvingScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(100),
});

export type AnalyzeInterviewTranscriptOutput = z.infer<
  typeof AnalyzeInterviewTranscriptOutputSchema
>;

const prompt = ai.definePrompt({
  name: 'analyzeInterviewTranscriptPrompt',
  input: { schema: AnalyzeInterviewTranscriptInputSchema },
  output: { schema: AnalyzeInterviewTranscriptOutputSchema },
  prompt: `You are an interview intelligence engine for a transparency-first hiring platform.
Analyze the interview transcript and produce objective, concise output for audit logs.

Transcript:
{{{transcriptText}}}

{{#if roleContext}}
Role context: {{{roleContext}}}
{{/if}}

{{#if skillContext}}
Skill context: {{{skillContext}}}
{{/if}}

Return JSON that follows the schema exactly:
- summary: 4-6 sentence summary of candidate performance
- highlights: 3-8 notable moments from the interview
- strengths: concrete strengths demonstrated in interview responses
- risks: objective concerns or weak areas
- communicationScore, problemSolvingScore, confidenceScore: integer-style score 0-100
`,
});

const flow = ai.defineFlow(
  {
    name: 'analyzeInterviewTranscriptFlow',
    inputSchema: AnalyzeInterviewTranscriptInputSchema,
    outputSchema: AnalyzeInterviewTranscriptOutputSchema,
  },
  async (input: AnalyzeInterviewTranscriptInput) => {
    const { output } = await prompt(input);
    return output!;
  }
);

export async function analyzeInterviewTranscript(
  input: AnalyzeInterviewTranscriptInput
): Promise<AnalyzeInterviewTranscriptOutput> {
  return flow(input);
}

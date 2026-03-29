'use server';
/**
 * @fileOverview A Genkit flow for generating a qualitative summary of a candidate's cognitive skill profile (Skill Fingerprint).
 *
 * - generateSkillProfileSummary - A function that handles the generation of the skill profile summary.
 * - GenerateSkillProfileSummaryInput - The input type for the generateSkillProfileSummary function.
 * - GenerateSkillProfileSummaryOutput - The return type for the generateSkillProfileSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSkillProfileSummaryInputSchema = z.object({
  candidateName: z.string().describe("The name of the candidate."),
  skillName: z.string().describe("The name of the skill being assessed (e.g., 'Python')."),
  skillScore: z.number().describe("The overall skill score, a numerical value between 0 and 100."),
  skillBreakdown: z.string().describe("A detailed qualitative breakdown of the candidate's performance, including logic correctness, error patterns, time behavior, and code quality. Example: 'Logic correctness: 80%, Error patterns: Minor syntax errors, Time behavior: Completed task efficiently, Code quality: Modular and readable.'"),
  skillFingerprintDescription: z.string().describe("A textual representation of the candidate's unique behavioral embedding or problem-solving style. Example: 'Strong logic, weak syntax. Fast but inconsistent. High accuracy, low depth.'"),
  stabilityScore: z.number().describe("A score indicating the consistency of performance across attempts (0-100)."),
  authenticityScore: z.number().describe("A score indicating the likelihood that the work is genuinely theirs (0-100)."),
  riskIndicator: z.string().describe("A qualitative risk indicator, e.g., 'Low Risk', 'Moderate Risk - Inconsistent performance', 'High Risk - AI detected'.")
});
export type GenerateSkillProfileSummaryInput = z.infer<typeof GenerateSkillProfileSummaryInputSchema>;

const GenerateSkillProfileSummaryOutputSchema = z.object({
  summary: z.string().describe("A qualitative summary of the candidate's cognitive skill profile, highlighting unique problem-solving style, strengths, and weaknesses.")
});
export type GenerateSkillProfileSummaryOutput = z.infer<typeof GenerateSkillProfileSummaryOutputSchema>;

const prompt = ai.definePrompt({
  name: 'skillProfileSummaryPrompt',
  input: { schema: GenerateSkillProfileSummaryInputSchema },
  output: { schema: GenerateSkillProfileSummaryOutputSchema },
  prompt: `You are an AI-driven talent intelligence platform called Satori AI. Your goal is to provide recruiters with a clear, qualitative summary of a candidate's cognitive skill profile, known as their Skill Fingerprint. This summary should go beyond numerical scores to explain *how* the candidate approaches problems, their unique problem-solving style, their key strengths, and their areas for improvement (weaknesses).

The summary should be concise, professional, and insightful. Focus on translating the provided data into an easy-to-understand narrative for a recruiter.

Here is the candidate's data for the "{{{skillName}}}" skill:

Candidate Name: {{{candidateName}}}
Skill Score: {{{skillScore}}}%
Skill Breakdown: {{{skillBreakdown}}}
Skill Fingerprint Description: {{{skillFingerprintDescription}}}
Stability Score: {{{stabilityScore}}}% (Higher means more consistent performance across attempts)
Authenticity Score: {{{authenticityScore}}}% (Higher means less likelihood of AI-generated or copied answers)
Risk Indicator: {{{riskIndicator}}}

Based on this information, generate a qualitative summary of {{{candidateName}}}'s cognitive skill profile, highlighting their unique problem-solving style, strengths, and weaknesses for the {{{skillName}}} skill.

Example Summary Structure (adapt as needed):
"Candidate [Name] demonstrates [Skill] proficiency with a score of [Score]%. Their problem-solving style is characterized by [unique style from fingerprint/breakdown]. Key strengths include [list strengths based on breakdown/fingerprint]. Areas for development include [list weaknesses based on breakdown/fingerprint]. Their performance shows [stability assessment] and [authenticity assessment]."

Ensure the summary is insightful and directly addresses problem-solving style, strengths, and weaknesses. Do not just restate scores, but interpret them.
`
});

const generateSkillProfileSummaryFlow = ai.defineFlow(
  {
    name: 'generateSkillProfileSummaryFlow',
    inputSchema: GenerateSkillProfileSummaryInputSchema,
    outputSchema: GenerateSkillProfileSummaryOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);

export async function generateSkillProfileSummary(input: GenerateSkillProfileSummaryInput): Promise<GenerateSkillProfileSummaryOutput> {
  return generateSkillProfileSummaryFlow(input);
}

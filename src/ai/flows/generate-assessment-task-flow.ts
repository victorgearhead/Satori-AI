'use server';
/**
 * @fileOverview A Genkit flow for dynamically generating unique assessment micro-tasks.
 *
 * - generateAssessmentTask - A function that handles the generation of an assessment task.
 * - GenerateAssessmentTaskInput - The input type for the generateAssessmentTask function.
 * - GenerateAssessmentTaskOutput - The return type for the generateAssessmentTask function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateAssessmentTaskInputSchema = z.object({
  skill: z.string().describe('The skill for which to generate an assessment task (e.g., "Python", "SQL").'),
  proficiency: z.enum(['Beginner', 'Intermediate', 'Advanced']).describe('The desired proficiency level for the assessment task.'),
});
export type GenerateAssessmentTaskInput = z.infer<typeof GenerateAssessmentTaskInputSchema>;

const GenerateAssessmentTaskOutputSchema = z.object({
  taskDescription: z.string().describe('A detailed description of the micro-task assessment.'),
  expectedOutputFormat: z.string().describe('The expected format for the candidate\'s solution (e.g., "Python code", "SQL query", "JSON response").'),
  difficultyLevel: z.enum(['Beginner', 'Intermediate', 'Advanced']).describe('The actual difficulty level of the generated task.'),
});
export type GenerateAssessmentTaskOutput = z.infer<typeof GenerateAssessmentTaskOutputSchema>;

export async function generateAssessmentTask(input: GenerateAssessmentTaskInput): Promise<GenerateAssessmentTaskOutput> {
  return generateAssessmentTaskFlow(input);
}

const generateAssessmentTaskPrompt = ai.definePrompt({
  name: 'generateAssessmentTaskPrompt',
  input: { schema: GenerateAssessmentTaskInputSchema },
  output: { schema: GenerateAssessmentTaskOutputSchema },
  prompt: `You are an expert assessment task generator for technical skills.
Your goal is to create a unique micro-task for a candidate based on their selected skill and desired proficiency level.
Ensure the task is clear, concise, and directly relevant to the skill and proficiency.

Skill: {{{skill}}}
Proficiency: {{{proficiency}}}

Generate a unique micro-task that precisely matches the requested skill and proficiency.
The task should clearly state what the candidate needs to do.
Also, specify the expected format of the candidate's solution.
Finally, confirm the difficulty level of the task you have generated.

Example for Python, Intermediate:
Task Description: Write a Python function \`count_words(text)\` that takes a string \`text\` as input and returns a dictionary where keys are words from the text and values are their frequencies. The function should ignore case and punctuation, and treat " " as the word separator.
Expected Output Format: Python code
Difficulty Level: Intermediate

Generate the task now.`,
});

const generateAssessmentTaskFlow = ai.defineFlow(
  {
    name: 'generateAssessmentTaskFlow',
    inputSchema: GenerateAssessmentTaskInputSchema,
    outputSchema: GenerateAssessmentTaskOutputSchema,
  },
  async (input) => {
    const { output } = await generateAssessmentTaskPrompt(input);
    return output!;
  },
);

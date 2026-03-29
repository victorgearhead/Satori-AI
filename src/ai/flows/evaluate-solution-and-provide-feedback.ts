'use server';
/**
 * @fileOverview An AI agent for evaluating candidate solutions to assessment tasks.
 *
 * - evaluateSolutionAndProvideFeedback - A function that evaluates a candidate's solution to a task and provides detailed feedback.
 * - EvaluateSolutionAndProvideFeedbackInput - The input type for the evaluateSolutionAndProvideFeedback function.
 * - EvaluateSolutionAndProvideFeedbackOutput - The return type for the evaluateSolutionAndProvideFeedback function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const EvaluateSolutionAndProvideFeedbackInputSchema = z.object({
  skill: z.string().describe('The skill being assessed (e.g., Python, SQL).'),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).describe('The difficulty level of the task.'),
  taskDescription: z.string().describe('The description of the assessment task given to the candidate.'),
  candidateSolution: z.string().describe('The candidate\'s submitted solution to the task.'),
  timeTakenSeconds: z.number().optional().describe('The time in seconds the candidate took to complete the task.'),
  expectedOutput: z.string().optional().describe('The expected output if the candidate\'s solution were run correctly.'),
  testCases: z.array(z.object({ input: z.string(), expectedOutput: z.string() })).optional().describe('A list of test cases with inputs and expected outputs.'),
  complexityDescription: z.string().optional().describe('A brief description of the task complexity to evaluate time behavior.'),
});
export type EvaluateSolutionAndProvideFeedbackInput = z.infer<typeof EvaluateSolutionAndProvideFeedbackInputSchema>;

const EvaluateSolutionAndProvideFeedbackOutputSchema = z.object({
  overallFeedback: z.string().describe('A comprehensive summary of the evaluation, including strengths and areas for improvement.'),
  correctnessScore: z.number().min(0).max(100).describe('A score from 0-100 indicating the correctness of the solution.'),
  logicFlowFeedback: z.string().describe('Detailed feedback on the logical flow and reasoning pattern of the solution.'),
  errorPatternFeedback: z.string().describe('Identification and description of common error patterns or specific mistakes made.'),
  problemSolvingApproachFeedback: z.string().describe('Feedback on the overall problem-solving approach and strategy used by the candidate.'),
  timeBehaviorFeedback: z.string().describe('Feedback on the time taken to complete the task relative to its complexity.'),
  scoreVector: z.object({
    correctness: z.number().min(0).max(100).describe('Score for functional correctness.'),
    logicClarity: z.number().min(0).max(100).describe('Score for the clarity and soundness of the logical flow.'),
    efficiency: z.number().min(0).max(100).describe('Score for the efficiency and optimization of the solution, considering time behavior.'),
    errorPropensity: z.number().min(0).max(100).describe('Score for the prevalence and type of errors (higher is better, meaning fewer or less severe errors).'),
    approachOriginality: z.number().min(0).max(100).describe('Score for the creativity or uniqueness of the problem-solving approach.'),
  }).describe('A multi-dimensional vector representing various aspects of the candidate\'s skill.'),
});
export type EvaluateSolutionAndProvideFeedbackOutput = z.infer<typeof EvaluateSolutionAndProvideFeedbackOutputSchema>;

export async function evaluateSolutionAndProvideFeedback(input: EvaluateSolutionAndProvideFeedbackInput): Promise<EvaluateSolutionAndProvideFeedbackOutput> {
  return evaluateSolutionAndProvideFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'evaluateSolutionAndProvideFeedbackPrompt',
  input: { schema: EvaluateSolutionAndProvideFeedbackInputSchema },
  output: { schema: EvaluateSolutionAndProvideFeedbackOutputSchema },
  prompt: `You are an expert AI-driven talent intelligence evaluator for Satori AI, specializing in assessing technical skills. Your task is to provide comprehensive feedback on a candidate's submitted solution to an assessment task, going beyond mere correctness. You need to analyze the logic flow, identify error patterns, evaluate the problem-solving approach, and consider the time taken, to help the candidate understand their strengths and areas for improvement.

The assessment details are as follows:
Skill: {{{skill}}}
Difficulty: {{{difficulty}}}

Task Description:
{{{taskDescription}}}

Candidate's Submitted Solution:
{{{candidateSolution}}}

{{#if timeTakenSeconds}}
Time Taken: {{{timeTakenSeconds}}} seconds
{{/if}}

{{#if expectedOutput}}
Expected Output (if applicable):
{{{expectedOutput}}}
{{/if}}

{{#if testCases}}
Provided Test Cases (with expected outputs):
{{#each testCases}}
Input: {{{this.input}}}
Expected Output: {{{this.expectedOutput}}}
---
{{/each}}
{{/if}}

{{#if complexityDescription}}
Task Complexity Context: {{{complexityDescription}}}
{{/if}}

Please provide a detailed, structured evaluation following the specified output schema. Focus on providing actionable feedback.

Specifically, address the following aspects in your analysis:
1.  **Overall Feedback**: A general summary of the solution's performance, highlighting key strengths and weaknesses.
2.  **Correctness**: Assess how accurately the solution addresses the problem. Provide a score from 0-100.
3.  **Logic Flow**: Describe the step-by-step reasoning pattern. Is it clear, concise, efficient, or convoluted? Are there any logical gaps or redundancies?
4.  **Error Patterns**: Identify any recurring types of errors, logical fallacies, or common mistakes. How could they be avoided?
5.  **Problem-Solving Approach**: Comment on the candidate's strategy. Was it optimal, brute-force, elegant, or unconventional?
6.  **Time Behavior**: If timeTakenSeconds is provided, evaluate if the time taken is reasonable given the complexityDescription and task difficulty.
7.  **Score Vector**: Provide a multi-dimensional score across correctness, logic clarity, efficiency, error propensity, and approach originality (each 0-100).

Your output MUST be a JSON object conforming to the \`EvaluateSolutionAndProvideFeedbackOutputSchema\`.
`,
});

const evaluateSolutionAndProvideFeedbackFlow = ai.defineFlow(
  {
    name: 'evaluateSolutionAndProvideFeedbackFlow',
    inputSchema: EvaluateSolutionAndProvideFeedbackInputSchema,
    outputSchema: EvaluateSolutionAndProvideFeedbackOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);

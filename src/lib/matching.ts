import type { Job, PipelineStage } from '@/lib/types';

export const DEFAULT_PIPELINE_STAGES: PipelineStage[] = [
  { id: 'shortlist', name: 'Shortlist', type: 'shortlist' },
  { id: 'coding', name: 'Coding Test', type: 'coding' },
  { id: 'interview-1', name: 'Technical Interview 1', type: 'interview' },
  { id: 'interview-2', name: 'Technical Interview 2', type: 'interview' },
  { id: 'decision', name: 'Final Decision', type: 'decision' },
];

const STOP_WORDS = new Set([
  'and',
  'or',
  'the',
  'a',
  'an',
  'to',
  'of',
  'for',
  'in',
  'on',
  'at',
  'by',
  'with',
  'from',
  'as',
  'is',
  'are',
  'be',
  'your',
  'our',
  'you',
  'we',
  'this',
  'that',
  'will',
  'must',
  'should',
  'can',
  'have',
  'has',
  'had',
  'experience',
  'years',
  'year',
  'strong',
  'good',
  'required',
  'preferred',
  'role',
  'team',
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9.+#\-\s]/g, ' ');
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !STOP_WORDS.has(token));
}

function canonicalizeToken(token: string): string {
  if (token.endsWith('ies') && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith('es') && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith('s') && token.length > 3) {
    return token.slice(0, -1);
  }
  return token;
}

function canonicalizePhrase(phrase: string): string {
  return phrase
    .split(' ')
    .map((part) => canonicalizeToken(part))
    .join(' ')
    .trim();
}

function extractDynamicTerms(text: string, limit = 120): string[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return [];
  }

  const frequency = new Map<string, number>();

  for (let i = 0; i < tokens.length; i += 1) {
    const unigram = tokens[i];
    frequency.set(unigram, (frequency.get(unigram) ?? 0) + 1);

    if (i + 1 < tokens.length) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      frequency.set(bigram, (frequency.get(bigram) ?? 0) + 1);
    }

    if (i + 2 < tokens.length) {
      const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
      frequency.set(trigram, (frequency.get(trigram) ?? 0) + 1);
    }
  }

  return Array.from(frequency.entries())
    .filter(([term]) => term.length >= 2)
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return b[0].length - a[0].length;
    })
    .slice(0, limit)
    .map(([term]) => term);
}

export function extractSkillsFromResume(text: string): string[] {
  const terms = extractDynamicTerms(text, 140);
  return Array.from(new Set(terms.map((term) => canonicalizePhrase(term))));
}

function buildJobSkillPool(job: Job): string[] {
  const stageChunks = (job.pipelineStages ?? []).flatMap((stage) => [
    stage.name,
    stage.instructions ?? '',
  ]);
  const chunks = [
    job.title,
    job.description,
    ...(job.tags ?? []),
    ...(job.requirements ?? []),
    ...stageChunks,
  ];

  const terms = extractDynamicTerms(chunks.join(' '), 120);
  return Array.from(new Set(terms.map((term) => canonicalizePhrase(term))));
}

export function scoreJobMatch(
  candidateSkills: string[],
  job: Job
): {
  score: number;
  missingSkills: string[];
  matchedSkills: string[];
} {
  const candidateSet = new Set(
    candidateSkills.map((skill) => canonicalizePhrase(normalize(skill))).filter(Boolean)
  );
  const jobSkills = buildJobSkillPool(job);

  if (jobSkills.length === 0) {
    return {
      score: 0,
      missingSkills: [],
      matchedSkills: [],
    };
  }

  const matchedSkills = jobSkills.filter((skill) => candidateSet.has(skill));
  const missingSkills = jobSkills.filter((skill) => !candidateSet.has(skill));

  const score = Math.round((matchedSkills.length / jobSkills.length) * 100);

  return {
    score,
    missingSkills: missingSkills.slice(0, 20),
    matchedSkills: matchedSkills.slice(0, 20),
  };
}

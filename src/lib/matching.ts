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

const GENERIC_REQUIREMENT_WORDS = new Set([
  'ability',
  'across',
  'building',
  'candidate',
  'collaborate',
  'collaboration',
  'communication',
  'concept',
  'concepts',
  'culture',
  'customer',
  'deliver',
  'delivery',
  'detail',
  'documentation',
  'ensure',
  'excellent',
  'execute',
  'familiarity',
  'focus',
  'high',
  'implement',
  'improve',
  'knowledge',
  'learn',
  'manage',
  'mentoring',
  'mindset',
  'problem',
  'problem-solving',
  'process',
  'quality',
  'responsibility',
  'results',
  'skills',
  'solution',
  'solutions',
  'support',
  'testing',
  'understanding',
  'work',
  'written',
]);

const SKILL_ALIAS_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  ['sql', 'postgresql', 'postgres', 'mysql', 'mssql', 'sql server', 'oracle', 'sqlite'],
  ['python'],
  ['java'],
  ['javascript', 'js'],
  ['typescript', 'ts'],
  ['node.js', 'nodejs', 'node'],
  ['react', 'react.js', 'reactjs'],
  ['next.js', 'nextjs'],
  ['angular'],
  ['vue', 'vue.js', 'vuejs'],
  ['c++', 'cpp'],
  ['c#', 'csharp', '.net', 'dotnet', 'asp.net', 'aspnet'],
  ['golang', 'go language'],
  ['rust'],
  ['php'],
  ['ruby', 'ruby on rails', 'rails'],
  ['spring', 'spring boot', 'springboot'],
  ['django'],
  ['flask'],
  ['fastapi'],
  ['mongodb', 'mongo'],
  ['redis'],
  ['elasticsearch', 'elastic'],
  ['kafka'],
  ['rabbitmq'],
  ['docker'],
  ['kubernetes', 'k8s'],
  ['aws', 'amazon web services'],
  ['azure', 'microsoft azure'],
  ['gcp', 'google cloud', 'google cloud platform'],
  ['firebase'],
  ['graphql'],
  ['rest api', 'restful api'],
  ['microservices', 'microservice'],
  ['system design'],
  ['data structures', 'algorithms', 'dsa'],
  ['machine learning', 'ml'],
  ['deep learning'],
  ['nlp', 'natural language processing'],
  ['tensorflow'],
  ['pytorch'],
  ['pandas'],
  ['numpy'],
  ['airflow'],
  ['spark', 'apache spark'],
  ['hadoop'],
  ['tableau'],
  ['power bi', 'powerbi'],
  ['git'],
  ['linux'],
  ['jenkins'],
  ['terraform'],
  ['ansible'],
  ['ci/cd', 'cicd', 'ci cd'],
  ['agile', 'scrum'],
  ['figma'],
  ['jira'],
  ['excel'],
];

const SKILL_SECTION_HINTS = [
  'skills',
  'tech stack',
  'technology',
  'technologies',
  'tools',
  'frameworks',
  'languages',
  'platforms',
  'databases',
  'expertise',
  'proficient',
];

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
  if (/[.+#]/.test(token)) {
    return token;
  }
  if (token.endsWith('ies') && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith('es') && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith('s') && token.length > 3 && !token.endsWith('ss')) {
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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SKILL_MATCHERS: Array<{ canonical: string; pattern: RegExp }> = SKILL_ALIAS_GROUPS.flatMap(
  (aliases) => {
    const canonical = canonicalizePhrase(normalize(aliases[0]));
    return aliases.map((alias) => ({
      canonical,
      pattern: new RegExp(`(^|[^a-z0-9+#.])${escapeRegExp(normalize(alias))}($|[^a-z0-9+#.])`),
    }));
  }
);

function extractKnownSkills(text: string): string[] {
  const normalizedText = normalize(text);
  if (!normalizedText.trim()) {
    return [];
  }

  const found = new Set<string>();
  for (const matcher of SKILL_MATCHERS) {
    if (matcher.pattern.test(normalizedText)) {
      found.add(matcher.canonical);
    }
  }

  return Array.from(found);
}

function parseSkillPhrases(chunks: string[], limit = 50): string[] {
  const candidates = new Set<string>();
  for (const chunk of chunks) {
    const segments = chunk
      .split(/[|,;/\n\t()]/)
      .map((part) => canonicalizePhrase(normalize(part)))
      .filter(Boolean);

    for (const segment of segments) {
      const words = segment.split(' ').filter(Boolean);
      if (words.length === 0 || words.length > 4) {
        continue;
      }

      const meaningfulWords = words.filter(
        (word) => !STOP_WORDS.has(word) && !GENERIC_REQUIREMENT_WORDS.has(word)
      );
      if (meaningfulWords.length === 0) {
        continue;
      }

      if (meaningfulWords.join(' ').length < 2) {
        continue;
      }

      candidates.add(meaningfulWords.join(' '));
      if (candidates.size >= limit) {
        return Array.from(candidates);
      }
    }
  }

  return Array.from(candidates);
}

export function extractSkillsFromResume(text: string): string[] {
  const knownSkills = extractKnownSkills(text);

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 250);

  const skillSectionLines = lines.filter((line) => {
    const lower = line.toLowerCase();
    return SKILL_SECTION_HINTS.some((hint) => lower.includes(hint));
  });

  const parsedPhrases = parseSkillPhrases(skillSectionLines, 80);

  return Array.from(new Set([...knownSkills, ...parsedPhrases]));
}

function buildJobSkillPool(job: Job): string[] {
  const stageInstructionChunks = (job.pipelineStages ?? [])
    .map((stage) => stage.instructions ?? '')
    .filter(Boolean);

  const focusedChunks = [
    job.title,
    ...(job.tags ?? []),
    ...(job.requirements ?? []),
    ...stageInstructionChunks,
  ];

  const knownSkills = extractKnownSkills(
    [job.title, job.description, ...(job.tags ?? []), ...(job.requirements ?? [])].join(' ')
  );
  const parsedPhrases = parseSkillPhrases(focusedChunks, 60);

  const dynamicFallback = extractDynamicTerms(
    [...(job.tags ?? []), ...(job.requirements ?? [])].join(' '),
    40
  )
    .map((term) => canonicalizePhrase(term))
    .filter((term) => {
      const words = term.split(' ').filter(Boolean);
      if (words.length === 0 || words.length > 3) {
        return false;
      }
      return words.some(
        (word) => !STOP_WORDS.has(word) && !GENERIC_REQUIREMENT_WORDS.has(word)
      );
    });

  return Array.from(new Set([...knownSkills, ...parsedPhrases, ...dynamicFallback])).slice(0, 40);
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

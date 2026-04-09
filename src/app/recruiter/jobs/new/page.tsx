"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { createJobPosting } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import type { PipelineStage } from '@/lib/types';

const DEFAULT_STAGES: PipelineStage[] = [
  { id: 'shortlist', name: 'Shortlist', type: 'shortlist' },
  { id: 'coding', name: 'Coding Test', type: 'coding' },
  { id: 'interview-1', name: 'Technical Interview', type: 'interview' },
  { id: 'decision', name: 'Final Decision', type: 'decision' },
];

export default function NewJobPage() {
  const { profile, loading, idToken } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [salary, setSalary] = useState('');
  const [type, setType] = useState<'Full-time' | 'Contract' | 'Remote'>('Full-time');
  const [description, setDescription] = useState('');
  const [requirementsText, setRequirementsText] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [stages, setStages] = useState<PipelineStage[]>(DEFAULT_STAGES);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!profile) {
      router.replace('/');
      return;
    }

    if (profile.role !== 'recruiter') {
      router.replace(profile.role === 'candidate' ? '/dashboard' : '/');
      return;
    }
  }, [loading, profile, router]);

  async function handleCreate() {
    if (!idToken) {
      toast({
        title: 'Sign-in required',
        description: 'Sign in as recruiter to create positions.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      const result = await createJobPosting({
        idToken,
        title,
        company,
        location,
        salary,
        type,
        description,
        requirements: requirementsText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        tags: tagsText
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        pipelineStages: stages,
      });

      toast({
        title: 'Role created',
        description: 'Job posted with custom pipeline.',
      });
      router.push(`/recruiter/jobs/${result.jobId}/pipeline`);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Creation failed',
        description: error instanceof Error ? error.message : 'Could not create role.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navigation />
      <main className="container mx-auto px-4 py-10 max-w-5xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900">Create Position</h1>
          <p className="text-slate-500">Post a new role and define the exact hiring process candidates will see.</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Role Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Role title" />
              <Input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company name" />
              <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" />
              <Input value={salary} onChange={(event) => setSalary(event.target.value)} placeholder="Salary range" />
            </div>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as 'Full-time' | 'Contract' | 'Remote')}
              className="h-10 rounded-md border px-3"
            >
              <option value="Full-time">Full-time</option>
              <option value="Contract">Contract</option>
              <option value="Remote">Remote</option>
            </select>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Job description"
              className="min-h-[120px]"
            />
            <Textarea
              value={requirementsText}
              onChange={(event) => setRequirementsText(event.target.value)}
              placeholder="Requirements (one per line)"
              className="min-h-[120px]"
            />
            <Input
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="Tags (comma separated)"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline Stages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stages.map((stage, index) => (
              <div key={stage.id} className="grid md:grid-cols-3 gap-3 border rounded-lg p-3">
                <Input
                  value={stage.name}
                  onChange={(event) => {
                    const value = event.target.value;
                    setStages((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, name: value } : item))
                    );
                  }}
                  placeholder="Stage name"
                />
                <select
                  value={stage.type}
                  onChange={(event) => {
                    const value = event.target.value as PipelineStage['type'];
                    setStages((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, type: value } : item))
                    );
                  }}
                  className="h-10 rounded-md border px-3"
                >
                  <option value="shortlist">Shortlist</option>
                  <option value="coding">Coding</option>
                  <option value="interview">Interview</option>
                  <option value="decision">Decision</option>
                </select>
                <Input
                  value={stage.instructions ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    setStages((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, instructions: value } : item
                      )
                    );
                  }}
                  placeholder="Instructions"
                />
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => {
                setStages((prev) => [
                  ...prev,
                  {
                    id: `stage-${Date.now()}`,
                    name: 'New Stage',
                    type: 'shortlist',
                    instructions: '',
                  },
                ]);
              }}
            >
              Add Stage
            </Button>
          </CardContent>
        </Card>

        <Button onClick={handleCreate} disabled={saving} className="w-full h-11">
          {saving ? 'Creating...' : 'Create Position'}
        </Button>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { getApplicationsByJob, getJob } from '@/lib/database';
import type { Application, Job, PipelineStage } from '@/lib/types';
import { advanceApplicationStage, updateJobPipeline } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function RecruiterJobPipelinePage() {
  const params = useParams<{ id: string }>();
  const { profile, idToken } = useAuth();
  const { toast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    if (!params.id || !profile?.companyId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [jobData, apps] = await Promise.all([
        getJob(params.id),
        getApplicationsByJob(params.id, profile.companyId),
      ]);

      setJob(jobData);
      setApplications(apps);
      setPipelineStages(
        jobData?.pipelineStages && jobData.pipelineStages.length > 0
          ? jobData.pipelineStages
          : [
              { id: 'shortlist', name: 'Shortlist', type: 'shortlist' },
              { id: 'coding', name: 'Coding Test', type: 'coding' },
              { id: 'interview', name: 'Technical Interview', type: 'interview' },
              { id: 'decision', name: 'Final Decision', type: 'decision' },
            ]
      );
    } catch (error) {
      console.error(error);
      toast({
        title: 'Unable to load pipeline',
        description: 'Please verify Firestore permissions and indexes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [params.id, profile?.companyId]);

  async function savePipeline() {
    if (!idToken || !job) return;

    try {
      setSaving(true);
      await updateJobPipeline({
        idToken,
        jobId: job.id,
        pipelineStages,
      });
      toast({
        title: 'Pipeline updated',
        description: 'Applicants now follow the updated process flow.',
      });
      await loadData();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Pipeline update failed',
        description: error instanceof Error ? error.message : 'Could not update pipeline.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function moveApplication(applicationId: string, decision: 'advance' | 'reject') {
    if (!idToken) return;

    try {
      await advanceApplicationStage({
        idToken,
        applicationId,
        decision,
        note,
      });
      toast({
        title: decision === 'advance' ? 'Candidate moved forward' : 'Candidate rejected',
        description: 'Pipeline state updated successfully.',
      });
      await loadData();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Stage update failed',
        description: error instanceof Error ? error.message : 'Could not update candidate stage.',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navigation />
      <main className="container mx-auto px-4 py-10 max-w-7xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900">Position Pipeline</h1>
          <p className="text-slate-500">Customize rounds and move candidates transparently stage-by-stage.</p>
        </header>

        {loading && <div className="text-slate-400 py-16">Loading pipeline...</div>}

        {!loading && !job && <div className="text-slate-400 py-16">Job not found.</div>}

        {!loading && job && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Process Flow: {job.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pipelineStages.map((stage, index) => (
                  <div key={stage.id} className="grid md:grid-cols-3 gap-3 border rounded-lg p-3">
                    <Input
                      value={stage.name}
                      onChange={(event) => {
                        const value = event.target.value;
                        setPipelineStages((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, name: value } : item))
                        );
                      }}
                      placeholder="Stage name"
                    />
                    <select
                      value={stage.type}
                      onChange={(event) => {
                        const value = event.target.value as PipelineStage['type'];
                        setPipelineStages((prev) =>
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
                        setPipelineStages((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, instructions: value } : item
                          )
                        );
                      }}
                      placeholder="Stage instructions"
                    />
                  </div>
                ))}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPipelineStages((prev) => [
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
                  <Button onClick={savePipeline} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Pipeline'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Applicants in this Position</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional note/message for this stage decision"
                  className="min-h-[90px]"
                />

                {applications.length === 0 && (
                  <p className="text-sm text-slate-400">No applicants in this position yet.</p>
                )}

                {applications.map((application) => (
                  <div key={application.id} className="border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900">{application.candidateName}</p>
                      <p className="text-xs text-slate-500">{application.email}</p>
                      <div className="flex gap-2">
                        <Badge>{application.status}</Badge>
                        <Badge variant="outline">{application.currentStage}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => moveApplication(application.id, 'reject')}>
                        Reject
                      </Button>
                      <Button onClick={() => moveApplication(application.id, 'advance')}>
                        Advance
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

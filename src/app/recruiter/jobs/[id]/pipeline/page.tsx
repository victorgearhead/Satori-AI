"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { getApplicationsByJob, getJob, getRecruiterInterviewSessions } from '@/lib/database';
import type { Application, InterviewSession, Job, PipelineStage } from '@/lib/types';
import {
  advanceApplicationStage,
  analyzeCandidateResumeFit,
  createInterviewSession,
  updateInterviewSession,
  updateJobPipeline,
} from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function toDatetimeLocal(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

const STAGE_TYPE_LABELS: Record<PipelineStage['type'], string> = {
  shortlist: 'Shortlist',
  coding: 'Coding',
  interview: 'Interview',
  decision: 'Decision',
};

type ResumeFitInsight = {
  overallMatchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  strengths: string[];
  concerns: string[];
  summary: string;
};

export default function RecruiterJobPipelinePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, loading: authLoading, idToken } = useAuth();
  const { toast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviewSessions, setInterviewSessions] = useState<InterviewSession[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<string[]>([]);
  const [sessionTitle, setSessionTitle] = useState('Satori Structured Interview');
  const [sessionDescription, setSessionDescription] = useState(
    'Behavioral + technical round with transcript capture.'
  );
  const [startLocal, setStartLocal] = useState(
    toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000))
  );
  const [endLocal, setEndLocal] = useState(
    toDatetimeLocal(new Date(Date.now() + 25 * 60 * 60 * 1000))
  );
  const [decisionReasonCategory, setDecisionReasonCategory] = useState<
    | 'skills-gap'
    | 'communication'
    | 'problem-solving'
    | 'culture-fit'
    | 'timeline-mismatch'
    | 'compensation'
    | 'other'
  >('skills-gap');
  const [evidenceBulletsText, setEvidenceBulletsText] = useState('');
  const [rubricScore, setRubricScore] = useState(70);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [updatingSessionId, setUpdatingSessionId] = useState<string | null>(null);
  const [resumeInsights, setResumeInsights] = useState<Record<string, ResumeFitInsight>>({});
  const [resumeAnalysisLoadingId, setResumeAnalysisLoadingId] = useState<string | null>(null);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!profile) {
      router.replace('/');
      return;
    }

    if (profile.role !== 'recruiter') {
      router.replace(profile.role === 'candidate' ? '/dashboard' : '/');
    }
  }, [authLoading, profile, router]);

  const loadData = useCallback(async () => {
    if (!params.id || !profile?.companyId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [jobData, apps, sessions] = await Promise.all([
        getJob(params.id),
        getApplicationsByJob(params.id, profile.companyId),
        getRecruiterInterviewSessions(profile.companyId),
      ]);

      setJob(jobData);
      setApplications(apps);
      setInterviewSessions(sessions.filter((session) => session.jobId === params.id));
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
  }, [params.id, profile?.companyId, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const shortlistedApplications = useMemo(
    () =>
      applications.filter(
        (application) =>
          application.status === 'Pending' ||
          application.status === 'Assessment' ||
          application.status === 'Interview'
      ),
    [applications]
  );

  const applicationByCandidateId = useMemo(() => {
    const map = new Map<string, Application>();
    for (const application of applications) {
      map.set(application.candidateId, application);
    }
    return map;
  }, [applications]);

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
        description: 'Applicants now follow the updated process flow. Redirecting to recruiter dashboard.',
      });
      router.push('/recruiter');
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

    const evidenceBullets = evidenceBulletsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 5);

    if (evidenceBullets.length === 0) {
      toast({
        title: 'Decision evidence required',
        description: 'Add at least one evidence bullet before moving a candidate.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await advanceApplicationStage({
        idToken,
        applicationId,
        decision,
        decisionReasonCategory,
        evidenceBullets,
        rubricScore,
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

  async function handleScheduleInterview() {
    if (!idToken || !job) {
      return;
    }

    if (selectedApplicationIds.length === 0) {
      toast({
        title: 'No applicants selected',
        description: 'Select at least one applicant to schedule an interview.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setScheduling(true);
      const result = await createInterviewSession({
        idToken,
        jobId: job.id,
        applicationIds: selectedApplicationIds,
        title: sessionTitle,
        description: sessionDescription,
        startTimeIso: new Date(startLocal).toISOString(),
        endTimeIso: new Date(endLocal).toISOString(),
        timezone,
      });

      toast({
        title: 'Interview scheduled',
        description: result.meetLink
          ? result.calendarFallbackUsed
            ? `Interview scheduled with fallback link: ${result.meetLink}`
            : `Meet link created: ${result.meetLink}`
          : 'Interview scheduled without auto-generated meet link. Add one from the session card.',
      });
      setSelectedApplicationIds([]);
      await loadData();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Unable to schedule interview',
        description: error instanceof Error ? error.message : 'Failed to create interview session.',
        variant: 'destructive',
      });
    } finally {
      setScheduling(false);
    }
  }

  async function markSessionCompleted(sessionId: string) {
    if (!idToken) {
      return;
    }

    try {
      setUpdatingSessionId(sessionId);
      await updateInterviewSession({
        idToken,
        sessionId,
        status: 'Completed',
      });
      toast({
        title: 'Interview updated',
        description: 'Session marked as completed.',
      });
      await loadData();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Unable to update session',
        description: error instanceof Error ? error.message : 'Failed to update interview session.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingSessionId(null);
    }
  }

  async function attachMeetLink(sessionId: string) {
    if (!idToken) {
      return;
    }

    const input = window.prompt('Paste a meeting link (Google Meet/Zoom/etc)');
    if (!input) {
      return;
    }

    const link = input.trim();
    if (!/^https?:\/\//i.test(link)) {
      toast({
        title: 'Invalid link',
        description: 'Please provide a full URL including https://',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUpdatingSessionId(sessionId);
      await updateInterviewSession({
        idToken,
        sessionId,
        meetLink: link,
      });
      toast({
        title: 'Meeting link attached',
        description: 'Candidates can now join using this link.',
      });
      await loadData();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Failed to attach link',
        description: error instanceof Error ? error.message : 'Could not update interview link.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingSessionId(null);
    }
  }

  async function handleAnalyzeResume(applicationId: string) {
    if (!idToken) {
      return;
    }

    try {
      setResumeAnalysisLoadingId(applicationId);
      const analysis = await analyzeCandidateResumeFit({
        idToken,
        applicationId,
      });

      setResumeInsights((prev) => ({
        ...prev,
        [applicationId]: {
          overallMatchScore: analysis.overallMatchScore,
          matchedSkills: analysis.matchedSkills,
          missingSkills: analysis.missingSkills,
          strengths: analysis.strengths,
          concerns: analysis.concerns,
          summary: analysis.summary,
        },
      }));

      toast({
        title: 'Resume analyzed',
        description: `Gemini match score: ${analysis.overallMatchScore}%`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Resume analysis failed',
        description: error instanceof Error ? error.message : 'Unable to analyze candidate resume.',
        variant: 'destructive',
      });
    } finally {
      setResumeAnalysisLoadingId(null);
    }
  }


  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navigation />
      <main className="container mx-auto px-4 py-10 max-w-7xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-black text-slate-900">Manage Pipeline</h1>
          <p className="text-slate-500">
            Build this role&apos;s process, run interview operations here, and move candidates stage-by-stage.
          </p>

          {!loading && job && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="font-semibold">{job.title}</Badge>
              <Badge variant="outline" className="font-semibold">{job.company}</Badge>
              <Badge variant="outline" className="font-semibold">{applications.length} applicants</Badge>
              <Badge variant="outline" className="font-semibold">{interviewSessions.length} interviews</Badge>
            </div>
          )}
        </header>

        {loading && <div className="text-slate-400 py-16">Loading pipeline...</div>}

        {!loading && !job && <div className="text-slate-400 py-16">Job not found.</div>}

        {!loading && job && (
          <>
            <div className="grid xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2 space-y-8">
                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle>Pipeline Designer</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {pipelineStages.map((stage, index) => (
                      <div key={stage.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            Stage {index + 1} - {STAGE_TYPE_LABELS[stage.type]}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPipelineStages((prev) => prev.filter((_, i) => i !== index));
                            }}
                            disabled={pipelineStages.length <= 1}
                          >
                            Remove
                          </Button>
                        </div>
                        <div className="grid md:grid-cols-3 gap-3">
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
                      </div>
                    ))}

                    <div className="flex flex-wrap gap-3">
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

                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle>Applicants in This Position</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-3 gap-3">
                      <select
                        value={decisionReasonCategory}
                        onChange={(event) => {
                          setDecisionReasonCategory(
                            event.target.value as
                              | 'skills-gap'
                              | 'communication'
                              | 'problem-solving'
                              | 'culture-fit'
                              | 'timeline-mismatch'
                              | 'compensation'
                              | 'other'
                          );
                        }}
                        className="h-10 rounded-md border px-3"
                      >
                        <option value="skills-gap">Skills Gap</option>
                        <option value="communication">Communication</option>
                        <option value="problem-solving">Problem Solving</option>
                        <option value="culture-fit">Culture Fit</option>
                        <option value="timeline-mismatch">Timeline Mismatch</option>
                        <option value="compensation">Compensation</option>
                        <option value="other">Other</option>
                      </select>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={rubricScore}
                        onChange={(event) =>
                          setRubricScore(
                            Math.max(0, Math.min(100, Number(event.target.value || 0)))
                          )
                        }
                        placeholder="Rubric score (0-100)"
                      />
                    </div>

                    <Textarea
                      value={evidenceBulletsText}
                      onChange={(event) => setEvidenceBulletsText(event.target.value)}
                      placeholder="Evidence bullets (one point per line)"
                      className="min-h-[90px]"
                    />
                    <Textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Candidate-facing explanation (optional, but recommended)"
                      className="min-h-[70px]"
                    />

                    {applications.length === 0 && (
                      <p className="text-sm text-slate-400">No applicants in this position yet.</p>
                    )}

                    {applications.map((application) => (
                      <div
                        key={application.id}
                        className="border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <p className="font-bold text-slate-900">{application.candidateName}</p>
                          <p className="text-xs text-slate-500">{application.email}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge>{application.status}</Badge>
                            <Badge variant="outline">{application.currentStage}</Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {application.cvUrl && (
                            <Button asChild variant="outline">
                              <a href={application.cvUrl} target="_blank" rel="noreferrer">
                                View Resume
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            disabled={!application.cvUrl || resumeAnalysisLoadingId === application.id}
                            onClick={() => void handleAnalyzeResume(application.id)}
                          >
                            {resumeAnalysisLoadingId === application.id ? 'Analyzing...' : 'Analyze Resume Fit'}
                          </Button>
                          {application.status === 'Hired' ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Finalized: Selected
                            </Badge>
                          ) : application.status === 'Rejected' ? (
                            <Badge className="bg-rose-100 text-rose-700 border border-rose-200">
                              Finalized: Rejected
                            </Badge>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                onClick={() => moveApplication(application.id, 'reject')}
                              >
                                Reject
                              </Button>
                              <Button onClick={() => moveApplication(application.id, 'advance')}>
                                Advance
                              </Button>
                            </>
                          )}
                        </div>

                        {resumeInsights[application.id] && (
                          <div className="w-full rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-bold text-slate-900">Gemini Resume Match</p>
                              <Badge>{resumeInsights[application.id].overallMatchScore}%</Badge>
                            </div>
                            <p className="text-xs text-slate-600">{resumeInsights[application.id].summary}</p>
                            <p className="text-xs text-slate-500">
                              Matched: {resumeInsights[application.id].matchedSkills.slice(0, 6).join(', ') || 'None'}
                            </p>
                            <p className="text-xs text-slate-500">
                              Missing: {resumeInsights[application.id].missingSkills.slice(0, 6).join(', ') || 'None'}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-8">
                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle>Interview Ops (This Role)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input
                      value={sessionTitle}
                      onChange={(event) => setSessionTitle(event.target.value)}
                      placeholder="Interview title"
                    />
                    <Textarea
                      value={sessionDescription}
                      onChange={(event) => setSessionDescription(event.target.value)}
                      placeholder="Interview description"
                      className="min-h-[90px]"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="datetime-local"
                        value={startLocal}
                        onChange={(event) => setStartLocal(event.target.value)}
                      />
                      <Input
                        type="datetime-local"
                        value={endLocal}
                        onChange={(event) => setEndLocal(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200 p-3 bg-slate-50/60">
                      {shortlistedApplications.length === 0 && (
                        <p className="text-xs text-slate-400">No candidates eligible for interview scheduling.</p>
                      )}
                      {shortlistedApplications.map((application) => (
                        <label key={application.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedApplicationIds.includes(application.id)}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setSelectedApplicationIds((prev) =>
                                checked
                                  ? Array.from(new Set([...prev, application.id]))
                                  : prev.filter((id) => id !== application.id)
                              );
                            }}
                          />
                          <span className="font-medium text-slate-700">{application.candidateName}</span>
                        </label>
                      ))}
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleScheduleInterview}
                      disabled={scheduling || selectedApplicationIds.length === 0}
                    >
                      {scheduling ? 'Scheduling...' : `Schedule Interview (${selectedApplicationIds.length})`}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle>Scheduled Interviews</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {interviewSessions.length === 0 && (
                      <p className="text-sm text-slate-400">No interview sessions scheduled for this role.</p>
                    )}

                    {interviewSessions.map((session) => (
                      <div key={session.id} className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 text-base">{session.title}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(session.startTimeIso).toLocaleString()} - {new Date(session.endTimeIso).toLocaleTimeString()}
                            </p>
                          </div>
                          <Badge className="w-fit" variant={session.status === 'Completed' ? 'secondary' : 'outline'}>
                            {session.status}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-slate-100 text-slate-700 border border-slate-200">
                            Transcript: {session.transcriptStatus}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Candidates: {session.candidateIds.length}
                          </Badge>
                          {session.candidateIds.slice(0, 2).map((candidateId) => {
                            const candidate = applicationByCandidateId.get(candidateId);
                            return (
                              <Badge key={`${session.id}-${candidateId}`} variant="outline" className="text-xs">
                                {candidate?.candidateName ?? candidateId.slice(0, 8)}
                              </Badge>
                            );
                          })}
                          {session.meetLink ? (
                            <a href={session.meetLink} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                              Open Meet Link
                            </a>
                          ) : (
                            <p className="text-xs text-slate-400">No meet link attached yet.</p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={updatingSessionId === session.id}
                            onClick={() => void attachMeetLink(session.id)}
                          >
                            {updatingSessionId === session.id ? 'Updating...' : 'Attach Link'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={session.status === 'Completed' || updatingSessionId === session.id}
                            onClick={() => void markSessionCompleted(session.id)}
                          >
                            {updatingSessionId === session.id ? 'Updating...' : 'Mark Completed'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

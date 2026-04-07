"use client";

import { useEffect, useMemo, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { getApplications, getRecruiterInterviewSessions } from '@/lib/database';
import type { Application, InterviewSession } from '@/lib/types';
import {
  createInterviewSession,
  finalizeTransparencyReport,
  saveInterviewTranscript,
  updateInterviewSession,
} from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function toDatetimeLocal(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function RecruiterInterviewsPage() {
  const { profile, idToken, loading } = useAuth();
  const { toast } = useToast();

  const [applications, setApplications] = useState<Application[]>([]);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<string[]>([]);
  const [sessionTitle, setSessionTitle] = useState('Satori Structured Interview');
  const [sessionDescription, setSessionDescription] = useState('Behavioral + technical round with transcript capture.');
  const [startLocal, setStartLocal] = useState(toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [endLocal, setEndLocal] = useState(toDatetimeLocal(new Date(Date.now() + 25 * 60 * 60 * 1000)));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [transcriptSessionId, setTranscriptSessionId] = useState('');
  const [transcriptCandidateId, setTranscriptCandidateId] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [publicVisibility, setPublicVisibility] = useState(true);
  const [finalJobId, setFinalJobId] = useState('');
  const [finalCandidateId, setFinalCandidateId] = useState('');
  const [finalDecidingFactor, setFinalDecidingFactor] = useState('');

  const recruiterCompanyId = profile?.companyId;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  async function loadData() {
    if (!profile || profile.role !== 'recruiter' || !recruiterCompanyId) {
      setApplications([]);
      setSessions([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [apps, interviewSessions] = await Promise.all([
        getApplications(recruiterCompanyId),
        getRecruiterInterviewSessions(recruiterCompanyId),
      ]);
      setApplications(apps);
      setSessions(interviewSessions);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Unable to load interviews',
        description: 'Please verify Firestore indexes and permissions.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [profile, recruiterCompanyId]);

  const interviewCandidates = useMemo(
    () =>
      applications.filter(
        (app: Application) =>
          app.status === 'Interview' ||
          app.status === 'Assessment' ||
          app.status === 'Screening'
      ),
    [applications]
  );

  async function handleScheduleSession() {
    if (!idToken || !profile || profile.role !== 'recruiter') {
      toast({
        title: 'Recruiter sign-in required',
        description: 'Sign in as recruiter to schedule interviews.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedApplicationIds.length === 0) {
      toast({
        title: 'No candidates selected',
        description: 'Select at least one candidate application.',
        variant: 'destructive',
      });
      return;
    }

    const jobId = applications.find((app: Application) => app.id === selectedApplicationIds[0])?.jobId;
    if (!jobId) {
      toast({
        title: 'Invalid selection',
        description: 'Could not resolve job for selected applications.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      const result = await createInterviewSession({
        idToken,
        jobId,
        applicationIds: selectedApplicationIds,
        title: sessionTitle,
        description: sessionDescription,
        startTimeIso: new Date(startLocal).toISOString(),
        endTimeIso: new Date(endLocal).toISOString(),
        timezone,
      });

      toast({
        title: 'Interview scheduled',
        description: `Google Meet created: ${result.meetLink}`,
      });

      setSelectedApplicationIds([]);
      await loadData();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Scheduling failed',
        description: error instanceof Error ? error.message : 'Could not create interview.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTranscriptSave() {
    if (!idToken) {
      toast({
        title: 'Sign-in required',
        description: 'You must be signed in as recruiter.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      const result = await saveInterviewTranscript({
        idToken,
        sessionId: transcriptSessionId,
        candidateId: transcriptCandidateId,
        transcriptText,
        source: 'manual',
        publicVisibility,
      });

      toast({
        title: 'Transcript processed',
        description: `Transparency report synced: ${result.reportId}`,
      });

      setTranscriptText('');
      await loadData();
    } catch (error) {
      console.error(error);
      toast({
        title: 'Transcript sync failed',
        description: error instanceof Error ? error.message : 'Could not save transcript.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function markCompleted(sessionId: string) {
    if (!idToken) return;
    try {
      await updateInterviewSession({
        idToken,
        sessionId,
        status: 'Completed',
      });
      await loadData();
    } catch (error) {
      console.error(error);
    }
  }

  async function handleFinalizeReport() {
    if (!idToken) {
      toast({
        title: 'Sign-in required',
        description: 'You must be signed in as recruiter.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      const result = await finalizeTransparencyReport({
        idToken,
        jobId: finalJobId,
        selectedCandidateId: finalCandidateId,
        decidingFactor: finalDecidingFactor,
      });

      toast({
        title: 'Report finalized',
        description: `Single transparency report ready: ${result.reportId}`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Finalize failed',
        description: error instanceof Error ? error.message : 'Could not finalize report.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navigation />
      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900">Interview Ops + Transcript Intelligence</h1>
          <p className="text-slate-500">Schedule Google Meet interviews, edit timing, and sync transcript intelligence into transparency reports.</p>
        </header>

        {(loading || isLoading) && <div className="text-slate-400 py-20 text-center">Loading recruiter interview console...</div>}

        {!loading && !isLoading && (!profile || profile.role !== 'recruiter') && (
          <div className="text-slate-400 py-20 text-center">Sign in as recruiter to manage interviews.</div>
        )}

        {!loading && !isLoading && profile?.role === 'recruiter' && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Schedule Interview Session</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Input value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} placeholder="Interview title" />
                  <Input value={sessionDescription} onChange={(e) => setSessionDescription(e.target.value)} placeholder="Interview description" />
                  <Input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
                  <Input type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Select Candidates</p>
                  <div className="grid md:grid-cols-2 gap-2">
                    {interviewCandidates.map((app: Application) => {
                      const checked = selectedApplicationIds.includes(app.id);
                      return (
                        <button
                          key={app.id}
                          type="button"
                          onClick={() => {
                            setSelectedApplicationIds((prev: string[]) =>
                              checked ? prev.filter((id: string) => id !== app.id) : [...prev, app.id]
                            );
                          }}
                          className={`text-left border rounded-lg p-3 transition-colors ${checked ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'}`}
                        >
                          <div className="text-sm font-bold text-slate-900">{app.candidateName}</div>
                          <div className="text-xs text-slate-500">{app.jobTitle}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button onClick={handleScheduleSession} disabled={isSaving}>Create Google Meet + Send Invites</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Interview Sessions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sessions.length === 0 && <div className="text-sm text-slate-400">No interviews scheduled yet.</div>}
                {sessions.map((session: InterviewSession) => (
                  <div key={session.id} className="border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900">{session.title}</div>
                      <div className="text-xs text-slate-500">{new Date(session.startTimeIso).toLocaleString()} • {session.jobTitle}</div>
                      <a href={session.meetLink} target="_blank" rel="noreferrer" className="text-xs text-primary font-semibold">Open Meet Link</a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{session.status}</Badge>
                      <Badge className="bg-slate-100 text-slate-700 border border-slate-200">Transcript: {session.transcriptStatus}</Badge>
                      {session.status !== 'Completed' && (
                        <Button variant="outline" onClick={() => markCompleted(session.id)}>Mark Completed</Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Attach Transcript + Sync Transparency Report</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Input value={transcriptSessionId} onChange={(e) => setTranscriptSessionId(e.target.value)} placeholder="Interview Session ID" />
                  <Input value={transcriptCandidateId} onChange={(e) => setTranscriptCandidateId(e.target.value)} placeholder="Candidate UID" />
                </div>
                <Textarea
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  className="min-h-[220px]"
                  placeholder="Paste interview transcript here. Gemini will extract summary, strengths, risks, and scores."
                />
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={publicVisibility}
                    onChange={(e) => setPublicVisibility(e.target.checked)}
                  />
                  Make resulting transparency report publicly viewable for benchmarking
                </label>
                <Button onClick={handleTranscriptSave} disabled={isSaving}>Analyze Transcript + Update Report</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Finalize Single Transparency Report (Per Job)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Input value={finalJobId} onChange={(e) => setFinalJobId(e.target.value)} placeholder="Job ID" />
                  <Input value={finalCandidateId} onChange={(e) => setFinalCandidateId(e.target.value)} placeholder="Selected Candidate UID" />
                </div>
                <Textarea
                  value={finalDecidingFactor}
                  onChange={(e) => setFinalDecidingFactor(e.target.value)}
                  placeholder="Deciding factor (will be PII-redacted)"
                  className="min-h-[120px]"
                />
                <Button onClick={handleFinalizeReport} disabled={isSaving}>Finalize Report</Button>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

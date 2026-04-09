"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import {
  getApplication,
  getCandidateInterviewSessions,
  getJob,
  getTransparencyReport,
} from '@/lib/database';
import type { Application, InterviewSession, Job, TransparencyReport } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, FileText, Video } from 'lucide-react';

export default function CandidateApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, loading } = useAuth();
  const { toast } = useToast();

  const [application, setApplication] = useState<Application | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [interviews, setInterviews] = useState<InterviewSession[]>([]);
  const [report, setReport] = useState<TransparencyReport | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!profile) {
      router.replace('/');
      return;
    }

    if (profile.role !== 'candidate') {
      router.replace(profile.role === 'recruiter' ? '/recruiter' : '/');
    }
  }, [loading, profile, router]);

  useEffect(() => {
    async function loadData() {
      if (!params.id || !profile || profile.role !== 'candidate') {
        setLoadingData(false);
        return;
      }

      try {
        setLoadingData(true);

        const app = await getApplication(params.id);
        if (!app || app.candidateId !== profile.uid) {
          setApplication(null);
          setJob(null);
          setInterviews([]);
          setReport(null);
          return;
        }

        const [jobData, allInterviews] = await Promise.all([
          getJob(app.jobId),
          getCandidateInterviewSessions(profile.uid),
        ]);

        setApplication(app);
        setJob(jobData);
        setInterviews(allInterviews.filter((session) => session.jobId === app.jobId));

        // Transparency report visibility depends on role/public settings; failure should not block pipeline view.
        try {
          const reportData = await getTransparencyReport(`job-${app.jobId}`);
          setReport(reportData);
        } catch {
          setReport(null);
        }
      } catch (error) {
        console.error(error);
        toast({
          title: 'Unable to load application details',
          description: 'Please try again in a moment.',
          variant: 'destructive',
        });
      } finally {
        setLoadingData(false);
      }
    }

    void loadData();
  }, [params.id, profile, toast]);

  const currentStageIndex = useMemo(() => {
    if (!application || !job?.pipelineStages || job.pipelineStages.length === 0) {
      return -1;
    }

    const explicitIndex = application.pipelineStageIndex;
    if (typeof explicitIndex === 'number') {
      return Math.min(explicitIndex, job.pipelineStages.length - 1);
    }

    const inferred = job.pipelineStages.findIndex(
      (stage) => stage.name.toLowerCase() === application.currentStage.toLowerCase()
    );
    return inferred;
  }, [application, job]);

  const rejectionStageIndex = useMemo(() => {
    if (!application || !job?.pipelineStages || job.pipelineStages.length === 0) {
      return -1;
    }

    const rejectedEvent = application.stageHistory
      ?.slice()
      .reverse()
      .find((event) => event.status === 'rejected');

    if (!rejectedEvent) {
      return -1;
    }

    return job.pipelineStages.findIndex(
      (stage) => stage.id === rejectedEvent.stageId || stage.name === rejectedEvent.stageName
    );
  }, [application, job]);

  const isRejected = application?.status === 'Rejected';

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navigation />
      <main className="container mx-auto px-4 py-10 max-w-6xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900">Application Pipeline</h1>
          <p className="text-slate-500">Track every stage, interview, and transparency update for this application.</p>
        </header>

        {loadingData && <div className="text-slate-400 py-16">Loading application details...</div>}

        {!loadingData && !application && (
          <Card>
            <CardContent className="p-10 text-center text-slate-400">
              Application not found or you do not have access.
            </CardContent>
          </Card>
        )}

        {!loadingData && application && (
          <>
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>{application.jobTitle}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge>{application.status}</Badge>
                  <Badge variant="outline">Current Stage: {application.currentStage}</Badge>
                  <Badge variant="outline">Applied: {application.appliedDate}</Badge>
                  <Badge variant="outline">Company: {application.company}</Badge>
                </div>
                <div className="grid md:grid-cols-2 gap-3 text-sm text-slate-600">
                  <p>Match Score: <span className="font-bold text-slate-900">{application.matchScore}%</span></p>
                  <p>Pipeline Position: <span className="font-bold text-slate-900">{currentStageIndex >= 0 ? currentStageIndex + 1 : '-'}</span></p>
                </div>

                {job?.pipelineStages && job.pipelineStages.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                      <span className="text-slate-500">Pipeline Progress</span>
                      <span className={isRejected ? 'text-red-600' : 'text-emerald-600'}>
                        {isRejected
                          ? `Stopped at stage ${Math.max(1, rejectionStageIndex + 1)}`
                          : `${Math.max(0, currentStageIndex + 1)}/${job.pipelineStages.length} stages`}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                      {job.pipelineStages.map((stage, index) => {
                        const activeLimit = isRejected
                          ? (rejectionStageIndex >= 0 ? rejectionStageIndex : currentStageIndex)
                          : currentStageIndex;
                        const isFilled = index <= activeLimit;
                        const tone = !isFilled
                          ? 'bg-slate-200'
                          : isRejected
                            ? 'bg-red-500'
                            : 'bg-emerald-500';

                        return (
                          <div key={stage.id} className="space-y-1">
                            <div className={`h-2 rounded-full ${tone}`} />
                            <p className="text-[10px] text-slate-400 truncate">{stage.name}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Stage Transparency</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {job?.pipelineStages && job.pipelineStages.length > 0 ? (
                  job.pipelineStages.map((stage, index) => {
                    const reached = currentStageIndex >= index;
                    const isCurrent = currentStageIndex === index;

                    return (
                      <div
                        key={stage.id}
                        className={`rounded-lg border p-3 ${isCurrent ? 'border-primary bg-primary/5' : reached ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-slate-900">{index + 1}. {stage.name}</p>
                          <Badge variant={isCurrent ? 'default' : 'outline'}>{isCurrent ? 'Current' : reached ? 'Passed' : 'Upcoming'}</Badge>
                        </div>
                        {stage.instructions && (
                          <p className="text-xs text-slate-500 mt-1">{stage.instructions}</p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-400">Pipeline stages not configured for this job yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock size={16} /> Stage History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!application.stageHistory || application.stageHistory.length === 0 ? (
                  <p className="text-sm text-slate-400">No stage transitions recorded yet.</p>
                ) : (
                  application.stageHistory
                    .slice()
                    .reverse()
                    .map((event, idx) => (
                      <div key={`${event.stageId}-${idx}`} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-slate-900">{event.stageName}</p>
                          <Badge variant="outline">{event.status}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{new Date(event.updatedAt).toLocaleString()}</p>
                        {event.actorRole && (
                          <p className="text-xs text-slate-500 mt-1">Updated by: {event.actorRole}</p>
                        )}
                        {event.decisionReasonCategory && (
                          <p className="text-xs text-slate-500 mt-1">Decision category: {event.decisionReasonCategory}</p>
                        )}
                        {typeof event.rubricScore === 'number' && (
                          <p className="text-xs text-slate-500 mt-1">Rubric score: {event.rubricScore}/100</p>
                        )}
                        {(event.evidenceBullets?.length ?? 0) > 0 && (
                          <ul className="mt-2 list-disc pl-5 text-xs text-slate-600 space-y-1">
                            {event.evidenceBullets?.map((item, index) => (
                              <li key={index}>{item}</li>
                            ))}
                          </ul>
                        )}
                        {event.note && <p className="text-sm text-slate-600 mt-2">Note: {event.note}</p>}
                      </div>
                    ))
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Video size={16} /> Interviews for This Application</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {interviews.length === 0 ? (
                  <p className="text-sm text-slate-400">No interviews scheduled yet for this role.</p>
                ) : (
                  interviews.map((session) => (
                    <div key={session.id} className="rounded-lg border border-slate-200 p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-900 text-sm">{session.title}</p>
                        <div className="flex gap-2">
                          <Badge variant="outline">{session.status}</Badge>
                          <Badge variant="outline">Transcript: {session.transcriptStatus}</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">{new Date(session.startTimeIso).toLocaleString()}</p>
                      {session.meetLink ? (
                        <a href={session.meetLink} target="_blank" rel="noreferrer" className="text-xs text-primary font-semibold">
                          Join Interview Link
                        </a>
                      ) : (
                        <p className="text-xs text-slate-400">Meeting link will be shared by recruiter.</p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
              {report && (
                <Link href={`/transparency-reports/${report.id}`}>
                  <Button>
                    <FileText size={14} className="mr-2" /> View Transparency Report
                  </Button>
                </Link>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

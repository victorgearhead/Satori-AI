"use client";

import { useEffect, useMemo, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Clock, FileText, Search, Award, Code2, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getCandidateApplications, getCandidateAssessments } from '@/lib/database';
import type { Application, CandidateAssessment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function CandidateDashboard() {
  const { profile, loading } = useAuth();
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [assessments, setAssessments] = useState<CandidateAssessment[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!profile || profile.role !== 'candidate') {
        setApplications([]);
        setAssessments([]);
        setLoadingData(false);
        return;
      }

      try {
        setLoadingData(true);
        const [apps, skillAssessments] = await Promise.all([
          getCandidateApplications(profile.uid),
          getCandidateAssessments(profile.uid),
        ]);
        setApplications(apps);
        setAssessments(skillAssessments);
      } catch (error) {
        console.error(error);
        toast({
          title: 'Unable to load dashboard data',
          description: 'Please verify Firestore permissions and indexes.',
          variant: 'destructive',
        });
      } finally {
        setLoadingData(false);
      }
    }

    void loadData();
  }, [profile, toast]);

  const profilePercentile = useMemo(() => {
    if (assessments.length === 0) {
      return 0;
    }

    const avg =
      assessments.reduce((acc, assessment) => acc + assessment.score, 0) /
      assessments.length;
    return Math.round(avg);
  }, [assessments]);

  return (
    <div className="min-h-screen bg-slate-50/50 font-body">
      <Navigation />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Your Hiring Pipeline</h1>
            <p className="text-slate-500 font-medium">Data-backed transparency for your career growth.</p>
          </div>
          <Link href="/jobs">
            <Button className="bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20 h-11 px-6">
              <Search className="mr-2 h-4 w-4" /> Explore New Roles
            </Button>
          </Link>
        </header>

        {(loading || loadingData) && (
          <div className="text-center text-slate-400 py-24">Loading your dashboard...</div>
        )}

        {!loading && !loadingData && (!profile || profile.role !== 'candidate') && (
          <div className="text-center text-slate-400 py-24">Sign in as a candidate to access your dashboard.</div>
        )}

        {!loading && !loadingData && profile && profile.role === 'candidate' && (
          <>
            <div className="grid md:grid-cols-4 gap-6 mb-10">
              <Card className="bg-slate-900 text-white border-none shadow-xl md:col-span-2 overflow-hidden relative">
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center border border-white/10">
                      <Award className="text-primary" />
                    </div>
                    <div>
                      <div className="text-[10px] opacity-60 uppercase tracking-widest font-bold">Profile Percentile</div>
                      <div className="text-2xl font-bold">Top {Math.max(1, 100 - profilePercentile)}%</div>
                    </div>
                  </div>
                  <Progress value={profilePercentile} className="h-2 bg-white/10" />
                </CardContent>
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              </Card>

              <Card className="shadow-sm border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border">
                      <Shield size={24} />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Credibility</div>
                      <div className="text-2xl font-bold text-slate-900">
                        {assessments[0]?.authenticityScore ?? 0}% Verified
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border">
                      <Clock size={24} />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Active Apps</div>
                      <div className="text-2xl font-bold text-slate-900">{applications.length} Positions</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-8">
                <section>
                  <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <div className="w-2 h-6 bg-primary rounded-full" /> Active Applications
                  </h2>
                  <div className="space-y-5">
                    {applications.length === 0 && (
                      <Card className="overflow-hidden border-slate-200">
                        <div className="p-10 text-center text-slate-400">You have not applied to any jobs yet.</div>
                      </Card>
                    )}

                    {applications.map((app) => (
                      <Card key={app.id} className="overflow-hidden border-slate-200 hover:shadow-md transition-all group">
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-6">
                            <div className="space-y-1">
                              <h3 className="text-xl font-bold text-slate-900 group-hover:text-primary transition-colors">{app.jobTitle}</h3>
                              <p className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                                {app.company} <span className="text-slate-300">•</span> Applied {app.appliedDate}
                              </p>
                            </div>
                            <Badge className={
                              app.status === 'Rejected' ? 'bg-slate-100 text-slate-600' :
                              app.status === 'Hired' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-primary/10 text-primary border-primary/20'
                            }>
                              {app.status.toUpperCase()}
                            </Badge>
                          </div>

                          <div className="flex flex-col sm:flex-row items-center justify-between pt-5 border-t gap-4">
                            <div className="flex items-center gap-6">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Match Score: <span className="text-primary text-sm ml-1">{app.matchScore}%</span>
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Current: <span className="text-slate-900 text-sm ml-1">{app.currentStage}</span>
                              </div>
                            </div>
                            {app.hasReport && (
                              <Link href={`/transparency-reports/${app.id}`}>
                                <Button size="sm" variant="outline" className="text-primary border-primary/20 hover:bg-primary/5 font-bold h-9">
                                  <FileText size={14} className="mr-2" /> View Transparency Report
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>
              </div>

              <aside className="space-y-8">
                <section>
                  <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <div className="w-2 h-6 bg-emerald-500 rounded-full" /> Verified Skill Set
                  </h2>
                  <div className="space-y-4">
                    {assessments.length === 0 && (
                      <Card>
                        <CardContent className="p-6 text-sm text-slate-400">
                          No assessments yet. Start one from the Assessments tab.
                        </CardContent>
                      </Card>
                    )}
                    {assessments.map((assessment) => (
                      <Card key={assessment.id} className="hover:border-primary/50 transition-colors group">
                        <CardHeader className="p-5 pb-2">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-base flex items-center gap-2 font-bold">
                              <Code2 size={16} className="text-primary" /> {assessment.skill}
                            </CardTitle>
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-bold">VERIFIED</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-5 pt-0">
                          <div className="flex items-end justify-between mb-3">
                            <span className="text-2xl font-bold text-slate-900">{assessment.score}%</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Stability: {assessment.stabilityScore}%</span>
                          </div>
                          <Progress value={assessment.score} className="h-1.5" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>

                <Card className="bg-slate-100 border-none shadow-none">
                  <CardHeader className="p-6">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900">
                      <TrendingUp className="text-primary" size={16} /> Market Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-4">
                    <p className="text-xs text-slate-600 leading-relaxed italic">
                      Build consistency across interviews by repeatedly attempting role-specific assessments and tracking skill deltas over time.
                    </p>
                  </CardContent>
                </Card>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, ArrowLeft, ShieldCheck, Scale, BarChart3, TrendingUp, Briefcase, GraduationCap, Code2, Layers, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getTransparencyReport } from '@/lib/database';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import type { TransparencyReport } from '@/lib/types';

export default function TransparencyReportPage() {
  const params = useParams<{ id: string }>();
  const { profile, loading } = useAuth();
  const { toast } = useToast();
  const [report, setReport] = useState<TransparencyReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(true);

  useEffect(() => {
    async function loadReport() {
      if (!params.id) {
        setLoadingReport(false);
        return;
      }

      try {
        setLoadingReport(true);
        const loaded = await getTransparencyReport(params.id);
        setReport(loaded);
      } catch (error) {
        console.error(error);
        toast({
          title: 'Unable to load report',
          description: 'Please try again in a few moments.',
          variant: 'destructive',
        });
      } finally {
        setLoadingReport(false);
      }
    }

    void loadReport();
  }, [params.id, toast]);

  const unauthorized =
    !!report &&
    !!profile &&
    profile.role === 'recruiter' &&
    profile.companyId !== report.companyId;

  const metrics = [
    { label: 'Work Experience', key: 'experience' as const, icon: Briefcase, desc: 'Years and relevance of professional tenure.' },
    { label: 'Project Complexity', key: 'projectDepth' as const, icon: Code2, desc: 'Quality and scale of personal/pro projects.' },
    { label: 'Internship Pedigree', key: 'internshipRelevance' as const, icon: Layers, desc: 'Reputation of companies interned at.' },
    { label: 'Academic Pedigree', key: 'academicPedigree' as const, icon: GraduationCap, desc: 'College tier and GPA weight.' },
    { label: 'Tech Stack Match', key: 'skillMatch' as const, icon: Brain, desc: 'Direct alignment with the required tech stack.' },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 font-body">
      <Navigation />
      <main className="container mx-auto px-4 py-12 max-w-5xl">
        {(loading || loadingReport) && (
          <div className="text-center text-slate-400 py-24">Loading transparency report...</div>
        )}

        {!loading && !loadingReport && !profile && (
          <div className="text-center text-slate-400 py-24">Sign in to view transparency reports.</div>
        )}

        {!loading && !loadingReport && profile && !report && (
          <div className="text-center text-slate-400 py-24">Transparency report not found.</div>
        )}

        {!loading && !loadingReport && profile && unauthorized && (
          <div className="text-center text-slate-400 py-24">
            Your recruiter account is not authorized to view this company report.
          </div>
        )}

        {!loading && !loadingReport && profile && report && !unauthorized && (
          <>
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary mb-8 font-bold transition-colors">
              <ArrowLeft size={16} /> BACK TO DASHBOARD
            </Link>

            <header className="mb-12 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest border shadow-sm">
                <ShieldCheck size={14} className="text-primary" /> Satori Transparency Audit
              </div>
              <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">Candidacy Benchmarking Report</h1>
              <p className="text-slate-500 text-lg font-medium">
                {report.company} <span className="text-slate-300 mx-2">|</span> {report.jobTitle}
              </p>
            </header>

            <div className="grid lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-10">
                <section className="bg-white rounded-[2rem] border-2 border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                  <div className="p-8 border-b bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Scale size={20} />
                      </div>
                      <h2 className="text-xl font-bold text-slate-900">Profile Delta Matrix</h2>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-slate-200" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">You</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                        <span className="text-[10px] font-bold text-primary uppercase">Hired Candidate</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-10 space-y-12">
                    {metrics.map((metric) => {
                      const Icon = metric.icon;
                      return (
                        <div key={metric.label} className="space-y-5">
                          <div className="flex justify-between items-end">
                            <div className="space-y-1">
                              <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <Icon size={16} className="text-primary" /> {metric.label}
                              </span>
                              <p className="text-[10px] text-slate-400 font-medium">{metric.desc}</p>
                            </div>
                            <div className="flex gap-6 items-baseline">
                              <span className="text-xs font-bold text-slate-400">YOU: <span className="text-slate-900 ml-1">{report.userMetrics[metric.key]}%</span></span>
                              <span className="text-sm font-black text-primary">HIRED: <span className="ml-1">{report.hiredMetrics[metric.key]}%</span></span>
                            </div>
                          </div>
                          <div className="space-y-2.5">
                            <div className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="absolute top-0 left-0 h-full bg-primary transition-all duration-700 ease-out"
                                style={{ width: `${report.hiredMetrics[metric.key]}%` }}
                              />
                            </div>
                            <div className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="absolute top-0 left-0 h-full bg-slate-300 transition-all duration-700 ease-out delay-100"
                                style={{ width: `${report.userMetrics[metric.key]}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="bg-slate-900 text-white p-10 rounded-[2rem] shadow-2xl relative overflow-hidden">
                  <div className="relative z-10 space-y-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                        <Brain className="text-primary" size={20} />
                      </div>
                      <h3 className="text-2xl font-bold">Recruiter Decision Intelligence</h3>
                    </div>

                    <div className="prose prose-invert max-w-none">
                      <p className="text-slate-400 leading-relaxed text-lg font-medium">
                        {report.qualitativeAnalysis}
                      </p>

                      <div className="mt-10 p-8 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                        <h4 className="text-xs font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                          <AlertCircle size={16} /> THE PRIMARY SELECTION DELTA
                        </h4>
                        <p className="text-lg font-bold text-white italic">
                          &quot;{report.decidingFactor}&quot;
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full -mr-48 -mt-48 blur-[120px]" />
                </section>
              </div>

              <aside className="space-y-8">
                <Card className="border-primary/20 bg-primary/5 rounded-3xl overflow-hidden">
                  <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-xl flex items-center gap-2 text-primary font-bold">
                      <TrendingUp size={20} /> Strategic Roadmap
                    </CardTitle>
                    <CardDescription className="text-slate-500 font-medium italic">Bridge the profile gap with intentional growth</CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 pt-0 space-y-6">
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      To compete for roles at {report.company}, the data suggests scaling your real-world delivery depth and professional experience across high-impact production systems.
                    </p>
                    <Button className="w-full bg-primary hover:bg-primary/90 text-xs font-bold h-12 shadow-xl shadow-primary/20 rounded-xl">
                      START OPTIMIZATION
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 rounded-3xl">
                  <CardContent className="p-8 space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center border">
                        <BarChart3 className="text-slate-400" size={24} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Process Integrity</div>
                        <div className="text-lg font-bold text-slate-900">Bias-Neutral Audit</div>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      This report is generated by Satori&apos;s ethics engine, ensuring selection factors are weighted objectively and PII is redacted for fair comparison.
                    </p>
                    <div className="pt-4 flex items-center gap-2 text-[10px] font-bold text-primary">
                      <ShieldCheck size={14} /> CERTIFIED AUDIT LOG
                    </div>
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

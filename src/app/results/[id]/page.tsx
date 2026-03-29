"use client";

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle2, TrendingUp, ShieldCheck, Zap, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { getAssessmentResult } from '@/lib/database';
import type { CandidateAssessment } from '@/lib/types';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

export default function ResultPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const skill = searchParams.get('skill') ?? 'Skill';
  const { profile, loading } = useAuth();
  const { toast } = useToast();

  const [result, setResult] = useState<CandidateAssessment | null>(null);
  const [loadingResult, setLoadingResult] = useState(true);

  useEffect(() => {
    async function loadResult() {
      if (!params.id) {
        setLoadingResult(false);
        return;
      }

      try {
        setLoadingResult(true);
        const loaded = await getAssessmentResult(params.id);
        setResult(loaded);
      } catch (error) {
        console.error(error);
        toast({
          title: 'Unable to load result',
          description: 'Please try again in a few moments.',
          variant: 'destructive',
        });
      } finally {
        setLoadingResult(false);
      }
    }

    void loadResult();
  }, [params.id, toast]);

  const unauthorized =
    !!result && !!profile && result.candidateId !== profile.uid;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {(loading || loadingResult) && (
          <div className="text-center text-muted-foreground py-24">Loading your result...</div>
        )}

        {!loading && !loadingResult && !profile && (
          <div className="text-center text-muted-foreground py-24">
            Sign in to view your assessment results.
          </div>
        )}

        {!loading && !loadingResult && profile && !result && (
          <div className="text-center text-muted-foreground py-24">
            This result was not found.
          </div>
        )}

        {!loading && !loadingResult && profile && unauthorized && (
          <div className="text-center text-muted-foreground py-24">
            You are not allowed to view this result.
          </div>
        )}

        {!loading && !loadingResult && profile && result && !unauthorized && (
          <>
            <div className="text-center mb-12 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold uppercase tracking-widest">
                <CheckCircle2 size={14} /> Verification Complete
              </div>
              <h1 className="text-4xl font-bold text-primary">Your {skill} Skill Fingerprint</h1>
              <p className="text-muted-foreground text-lg">Our analysis engine has completed its multidimensional evaluation.</p>
            </div>

            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <Card className="md:col-span-2 shadow-lg border-2 border-accent/20">
                <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        className="text-muted"
                        strokeWidth="8"
                        stroke="currentColor"
                        fill="transparent"
                        r="58"
                        cx="64"
                        cy="64"
                      />
                      <circle
                        className="text-accent"
                        strokeWidth="8"
                        strokeDasharray={364}
                        strokeDashoffset={364 - (364 * result.score) / 100}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r="58"
                        cx="64"
                        cy="64"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold text-primary">{result.score}%</span>
                      <span className="text-[10px] text-muted-foreground font-bold tracking-widest">MASTERY</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-primary">Verified Capability</h3>
                    <p className="text-sm text-muted-foreground px-4">{result.feedback}</p>
                  </div>
                </CardContent>
              </Card>

              <div className="md:col-span-2 grid grid-rows-2 gap-6">
                <Card className="shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-primary font-bold">
                        <ShieldCheck className="text-accent" /> Truth Score
                      </div>
                      <span className="text-xl font-bold text-accent">{result.authenticityScore}%</span>
                    </div>
                    <Progress value={result.authenticityScore} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed">High authenticity score indicates your submission pattern is consistent.</p>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-primary font-bold">
                        <Zap className="text-amber-500" /> Skill Stability
                      </div>
                      <span className="text-xl font-bold text-amber-500">{result.stabilityScore}%</span>
                    </div>
                    <Progress value={result.stabilityScore} className="h-2 bg-amber-100" />
                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed">Consistent logic patterns across this attempt indicate dependable performance.</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp size={18} className="text-green-500" /> Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                        <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" /> {s}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle size={18} className="text-amber-500" /> Focus Areas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {result.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" /> {w}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-center gap-4">
              <Link href="/dashboard">
                <Button variant="outline" className="px-8">Back to Dashboard</Button>
              </Link>
              <Link href="/assessments">
                <Button className="bg-primary hover:bg-primary/90 px-8">Verify Another Skill</Button>
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

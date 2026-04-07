"use client";

import { useEffect, useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { storage } from '@/lib/firebase';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getJobs } from '@/lib/database';
import type { Job } from '@/lib/types';
import { Search, MapPin, DollarSign, Briefcase, Filter, ChevronRight, Brain, Clock } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { analyzeResumeAndAutoApply } from '@/app/actions';

interface MatchRecommendation {
  jobId: string;
  title: string;
  company: string;
  score: number;
  missingSkills: string[];
  matchedSkills: string[];
  autoApplied: boolean;
}

export default function JobBoard() {
  const { toast } = useToast();
  const { profile, idToken } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [autoApplying, setAutoApplying] = useState(false);
  const [recommendations, setRecommendations] = useState<MatchRecommendation[]>([]);
  const [thresholdUsed, setThresholdUsed] = useState<number>(88);

  useEffect(() => {
    async function loadJobs() {
      try {
        setLoading(true);
        const loaded = await getJobs();
        setJobs(loaded);
      } catch (error) {
        console.error(error);
        toast({
          title: 'Unable to load jobs',
          description: 'Please verify your Firestore setup.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    void loadJobs();
  }, [toast]);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navigation />
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <Card className="p-6 mb-8 border-slate-200 bg-white">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900">AI Resume Match + Auto Apply</h2>
            <p className="text-sm text-slate-500">
              Upload your PDF resume once. Jobs with match score above threshold are auto-applied, and others show missing skills.
            </p>
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)}
                className="text-sm"
              />
              <Button
                disabled={autoApplying || !resumeFile}
                onClick={async () => {
                  if (!idToken || !profile || profile.role !== 'candidate') {
                    toast({
                      title: 'Candidate sign-in required',
                      description: 'Please sign in as candidate to use auto-apply.',
                      variant: 'destructive',
                    });
                    return;
                  }

                  if (!resumeFile) {
                    return;
                  }

                  try {
                    setAutoApplying(true);
                    const fileRef = ref(
                      storage,
                      `candidate-cv/${profile.uid}/${Date.now()}-${resumeFile.name}`
                    );
                    const uploadResult = await uploadBytes(fileRef, resumeFile);
                    const cvUrl = await getDownloadURL(uploadResult.ref);

                    const result = await analyzeResumeAndAutoApply({
                      idToken,
                      cvUrl,
                    });

                    setRecommendations(result.recommendations as MatchRecommendation[]);
                    setThresholdUsed(result.threshold);

                    toast({
                      title: 'Resume analysis complete',
                      description: `${result.autoAppliedCount} jobs auto-applied at ${result.threshold}% threshold.`,
                    });
                  } catch (error) {
                    console.error(error);
                    toast({
                      title: 'Auto-apply failed',
                      description:
                        error instanceof Error
                          ? error.message
                          : 'Could not analyze resume for job matching.',
                      variant: 'destructive',
                    });
                  } finally {
                    setAutoApplying(false);
                  }
                }}
              >
                {autoApplying ? 'Analyzing Resume...' : 'Analyze Resume + Auto Apply'}
              </Button>
            </div>

            {recommendations.length > 0 && (
              <div className="space-y-3 pt-2">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Match Insights (threshold: {thresholdUsed}%)
                </p>
                <div className="space-y-2">
                  {recommendations.slice(0, 6).map((rec) => (
                    <div key={rec.jobId} className="border rounded-lg p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900">
                          {rec.title} - {rec.company}
                        </p>
                        <Badge className={rec.score >= thresholdUsed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                          {rec.score}%
                        </Badge>
                      </div>
                      {rec.autoApplied ? (
                        <p className="text-xs text-emerald-600 font-semibold">Auto-applied</p>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Missing skills: {rec.missingSkills.length > 0 ? rec.missingSkills.join(', ') : 'None'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <header className="mb-12 text-center space-y-4">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Find Your Next Role</h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            Traditional hiring, powered by Satori&apos;s Transparency Engine.
          </p>

          <div className="flex flex-col md:flex-row gap-3 max-w-4xl mx-auto pt-6">
            <div className="relative flex-[2]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <Input placeholder="Search job titles, companies, or keywords..." className="pl-12 h-14 bg-white shadow-sm border-slate-200" />
            </div>
            <div className="relative flex-1">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <Input placeholder="Location" className="pl-12 h-14 bg-white shadow-sm border-slate-200" />
            </div>
            <Button className="h-14 px-10 bg-primary hover:bg-primary/90 text-white font-bold text-lg shadow-lg shadow-primary/20">
              Search
            </Button>
          </div>
        </header>

        <div className="grid md:grid-cols-4 gap-8">
          <aside className="md:col-span-1 space-y-8">
            <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Filter size={18} /> Filter Results
              </h3>
            </div>
          </aside>

          <div className="md:col-span-3 space-y-6">
            <div className="flex items-center justify-between px-2">
              <span className="text-sm font-medium text-slate-500">
                {loading ? 'Loading...' : `${jobs.length} open positions`}
              </span>
              <select className="text-sm bg-transparent border-none font-semibold text-slate-900 focus:ring-0">
                <option>Most Recent</option>
                <option>Highest Salary</option>
              </select>
            </div>

            {!loading && jobs.length === 0 && (
              <Card className="p-8 text-center text-slate-400">No jobs published yet.</Card>
            )}

            {jobs.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-all duration-300 border-slate-200 overflow-hidden group">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-2">
                      <Link href={`/jobs/${job.id}`}>
                        <h2 className="text-2xl font-bold text-slate-900 group-hover:text-primary transition-colors cursor-pointer">
                          {job.title}
                        </h2>
                      </Link>
                      <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5 font-medium"><Briefcase size={16} className="text-slate-400" /> {job.company}</span>
                        <span className="flex items-center gap-1.5"><MapPin size={16} className="text-slate-400" /> {job.location}</span>
                        <span className="flex items-center gap-1.5 text-emerald-600 font-bold"><DollarSign size={16} /> {job.salary}</span>
                        <span className="flex items-center gap-1.5"><Clock size={16} /> {job.postedAt}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-semibold px-3 py-1">
                      {job.type}
                    </Badge>
                  </div>

                  <p className="text-slate-600 line-clamp-2 mb-6 text-sm leading-relaxed">
                    {job.description}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {job.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-0.5">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="pt-5 border-t flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      <Brain size={14} className="text-primary" /> Transparent Process
                    </div>
                    <Link href={`/jobs/${job.id}`}>
                      <Button className="bg-primary hover:bg-primary/90 text-white font-bold px-6">
                        View Details <ChevronRight size={16} className="ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

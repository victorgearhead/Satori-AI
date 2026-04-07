"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { getJob } from '@/lib/database';
import type { Job } from '@/lib/types';
import { MapPin, DollarSign, Briefcase, Calendar, ShieldCheck, Brain, ArrowLeft, Upload } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { submitJobApplication } from '@/app/actions';
import { storage } from '@/lib/firebase';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const applySchema = z.object({
  fullName: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  coverLetter: z.string().min(40, 'Please provide at least 40 characters'),
});

type ApplyFormValues = z.infer<typeof applySchema>;

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const { profile, idToken, loading } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ApplyFormValues>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      fullName: profile?.displayName ?? '',
      email: profile?.email ?? '',
      coverLetter: '',
    },
  });

  useEffect(() => {
    if (profile) {
      form.setValue('fullName', profile.displayName ?? '');
      form.setValue('email', profile.email ?? '');
    }
  }, [profile, form]);

  useEffect(() => {
    async function loadJob() {
      if (!params.id) {
        setLoadingJob(false);
        return;
      }

      try {
        setLoadingJob(true);
        const loaded = await getJob(params.id);
        setJob(loaded);
      } catch (error) {
        console.error(error);
        toast({
          title: 'Unable to load job',
          description: 'Please try again in a few moments.',
          variant: 'destructive',
        });
      } finally {
        setLoadingJob(false);
      }
    }

    void loadJob();
  }, [params.id, toast]);

  async function handleApply(values: ApplyFormValues) {
    if (!job) {
      return;
    }

    if (!profile || profile.role !== 'candidate' || !idToken) {
      toast({
        title: 'Candidate sign-in required',
        description: 'Please sign in as a candidate before applying.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      let cvUrl: string | undefined;

      if (cvFile) {
        const fileRef = ref(storage, `candidate-cv/${profile.uid}/${Date.now()}-${cvFile.name}`);
        const uploadResult = await uploadBytes(fileRef, cvFile);
        cvUrl = await getDownloadURL(uploadResult.ref);
      }

      await submitJobApplication({
        idToken,
        jobId: job.id,
        coverLetter: values.coverLetter,
        cvUrl,
      });

      toast({
        title: 'Application submitted',
        description: 'Your application is now in the recruiter pipeline.',
      });

      form.reset({
        fullName: profile.displayName,
        email: profile.email,
        coverLetter: '',
      });
      setCvFile(null);
    } catch (error) {
      console.error(error);
      toast({
        title: 'Submission failed',
        description:
          error instanceof Error ? error.message : 'Could not submit your application.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navigation />
      <main className="container mx-auto px-4 py-12 max-w-5xl">
        <Link href="/jobs" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary mb-8 font-medium transition-colors">
          <ArrowLeft size={16} /> Back to Job Search
        </Link>

        {(loading || loadingJob) && (
          <div className="text-center text-slate-400 py-24">Loading role details...</div>
        )}

        {!loading && !loadingJob && !job && (
          <div className="text-center text-slate-400 py-24">Job not found.</div>
        )}

        {!loading && !loadingJob && job && (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <section className="bg-white p-8 rounded-2xl border shadow-sm">
                <header className="space-y-4 mb-8">
                  <div className="flex justify-between items-start">
                    <h1 className="text-3xl font-bold text-slate-900">{job.title}</h1>
                    <Badge className="bg-primary/10 text-primary border-primary/20">{job.type}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm font-medium">
                    <span className="flex items-center gap-1.5 text-slate-600"><Briefcase size={16} className="text-slate-400" /> {job.company}</span>
                    <span className="flex items-center gap-1.5 text-slate-600"><MapPin size={16} className="text-slate-400" /> {job.location}</span>
                    <span className="flex items-center gap-1.5 text-emerald-600 font-bold"><DollarSign size={16} /> {job.salary}</span>
                    <span className="flex items-center gap-1.5 text-slate-400"><Calendar size={16} /> Posted {job.postedAt}</span>
                  </div>
                </header>

                <div className="prose prose-slate max-w-none space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-3">Job Description</h3>
                    <p className="text-slate-600 leading-relaxed">{job.description}</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-3">Requirements</h3>
                    <ul className="space-y-2">
                      {job.requirements.map((req, i) => (
                        <li key={i} className="flex gap-3 text-slate-600">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section id="apply" className="bg-white p-8 rounded-2xl border shadow-sm space-y-8">
                <h2 className="text-2xl font-bold text-slate-900">Apply for this Position</h2>
                <form className="space-y-6" onSubmit={form.handleSubmit(handleApply)}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Full Name</label>
                      <Input {...form.register('fullName')} placeholder="John Doe" />
                      {form.formState.errors.fullName && (
                        <p className="text-xs text-red-500">{form.formState.errors.fullName.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Email Address</label>
                      <Input type="email" {...form.register('email')} placeholder="john@example.com" />
                      {form.formState.errors.email && (
                        <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Resume / CV</label>
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-primary transition-colors bg-slate-50/50">
                      <Upload className="mx-auto text-slate-400 mb-3" size={32} />
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setCvFile(file);
                        }}
                        className="mx-auto block text-sm text-slate-600"
                      />
                      <p className="text-xs text-slate-400 mt-2">PDF, DOCX up to 10MB</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Why do you want to join {job.company}?</label>
                    <Textarea
                      {...form.register('coverLetter')}
                      placeholder="Tell us about your motivation and how your skills align with the role..."
                      className="min-h-[150px]"
                    />
                    {form.formState.errors.coverLetter && (
                      <p className="text-xs text-red-500">{form.formState.errors.coverLetter.message}</p>
                    )}
                  </div>

                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                    <div className="flex items-center gap-3 text-primary">
                      <ShieldCheck size={20} />
                      <h4 className="font-bold">Satori Transparency Guarantee</h4>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      By applying through Satori, you are guaranteed a <strong>Transparency Report</strong> if your application is rejected after the interview stage.
                    </p>
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20">
                    {submitting ? 'Submitting...' : 'Submit Application'}
                  </Button>
                </form>
              </section>
            </div>

            <aside className="space-y-6">
              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Brain size={20} className="text-primary" /> Process Insight
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {(job.pipelineStages && job.pipelineStages.length > 0
                      ? job.pipelineStages
                      : [
                          { name: 'Application Review', type: 'shortlist' },
                          { name: 'Coding Test', type: 'coding' },
                          { name: 'Technical Interview', type: 'interview' },
                          { name: 'Final Decision', type: 'decision' },
                        ]
                    ).map((s, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 font-medium">{s.name}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-400">{String(s.type).replace('-', ' ')}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

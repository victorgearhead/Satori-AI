"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import { getPublicTransparencyReports } from '@/lib/database';
import type { TransparencyReport } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function PublicTransparencyReportsPage() {
  const { toast } = useToast();
  const [reports, setReports] = useState<TransparencyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      try {
        setLoading(true);
        const data = await getPublicTransparencyReports();
        setReports(data);
      } catch (error) {
        console.error(error);
        toast({
          title: 'Unable to load reports',
          description: 'Please verify Firestore permissions and indexes.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    void loadReports();
  }, [toast]);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <Navigation />
      <main className="container mx-auto px-4 py-12 max-w-6xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-black text-slate-900">Public Transparency Benchmarks</h1>
          <p className="text-slate-500 max-w-3xl">
            Compare yourself against anonymized candidate outcomes, now enriched with interview transcript intelligence.
          </p>
        </header>

        {loading && <div className="text-center text-slate-400 py-16">Loading public reports...</div>}

        {!loading && reports.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center text-slate-400">No public transparency reports available yet.</CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {reports.map((report) => (
            <Card key={report.id} className="border-slate-200">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-lg">{report.jobTitle}</CardTitle>
                  <Badge variant="outline">Public</Badge>
                </div>
                <p className="text-sm text-slate-500">{report.company}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-600 line-clamp-3">{report.transcriptSummary || report.qualitativeAnalysis}</p>
                {(report.transcriptHighlights?.length ?? 0) > 0 && (
                  <ul className="text-xs text-slate-500 list-disc pl-4 space-y-1">
                    {report.transcriptHighlights?.slice(0, 3).map((highlight, index) => (
                      <li key={index}>{highlight}</li>
                    ))}
                  </ul>
                )}
                <Link href={`/transparency-reports/${report.id}`}>
                  <Button variant="outline" className="w-full">Open Full Comparison</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

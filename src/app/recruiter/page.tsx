"use client"

import { useEffect, useMemo, useState } from 'react'
import { Navigation } from '@/components/Navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Search, Filter, Plus, FileText, MoreHorizontal, UserCheck, Briefcase, Users, CheckCircle2, Building2 } from 'lucide-react'
import { getApplications, getJobs } from '@/lib/database'
import type { Application, Job } from '@/lib/types'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

export default function RecruiterDashboard() {
  const { profile, loading } = useAuth()
  const { toast } = useToast()
  const [companyJobs, setCompanyJobs] = useState<Job[]>([])
  const [companyApplications, setCompanyApplications] = useState<Application[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  const recruiterCompanyId = profile?.companyId
  const recruiterCompanyName = profile?.companyId?.toUpperCase() ?? 'Your Company'

  useEffect(() => {
    async function loadRecruiterData() {
      if (!profile || profile.role !== 'recruiter' || !recruiterCompanyId) {
        setCompanyJobs([])
        setCompanyApplications([])
        setIsLoadingData(false)
        return
      }

      try {
        setIsLoadingData(true)
        const [jobs, apps] = await Promise.all([
          getJobs(recruiterCompanyId),
          getApplications(recruiterCompanyId),
        ])
        setCompanyJobs(jobs)
        setCompanyApplications(apps)
      } catch (error) {
        console.error(error)
        toast({
          title: 'Unable to load recruiter data',
          description: 'Please verify Firestore indexes and permissions.',
          variant: 'destructive',
        })
      } finally {
        setIsLoadingData(false)
      }
    }

    void loadRecruiterData()
  }, [profile, recruiterCompanyId, toast])

  const stats = useMemo(
    () => [
      { label: 'Active Pipeline', value: companyApplications.length.toString(), color: 'border-l-primary', icon: Users },
      { label: 'Open Positions', value: companyJobs.length.toString(), color: 'border-l-emerald-500', icon: Briefcase },
      {
        label: 'Interview Load',
        value: companyApplications.filter((app) => app.status === 'Interview').length.toString(),
        color: 'border-l-amber-500',
        icon: CheckCircle2,
      },
      {
        label: 'Transparency Logs',
        value: companyApplications.filter((app) => app.hasReport).length.toString(),
        color: 'border-l-indigo-500',
        icon: FileText,
      },
    ],
    [companyApplications, companyJobs.length]
  )

  return (
    <div className="min-h-screen bg-slate-50/50 font-body">
      <Navigation />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest">
              <Building2 size={14} /> {recruiterCompanyName} Internal Portal
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Hiring Dashboard</h1>
            <p className="text-slate-500 font-medium">Manage your specific {recruiterCompanyName} talent pipeline and transparency audits.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/recruiter/interviews">
              <Button variant="outline" className="h-11 px-6 border-slate-300 font-bold rounded-xl">
                Interview Ops
              </Button>
            </Link>
            <Link href="/recruiter/jobs/new">
              <Button className="h-11 px-8 bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 font-bold rounded-xl">
                <Plus size={18} className="mr-2" /> Create New Role
              </Button>
            </Link>
          </div>
        </header>

        <section className="mb-10">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg">Open Positions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {companyJobs.length === 0 && (
                <p className="text-sm text-slate-400">No open positions yet.</p>
              )}
              {companyJobs.map((job) => (
                <div key={job.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{job.title}</p>
                    <p className="text-xs text-slate-500">{job.location}</p>
                  </div>
                  <Link href={`/recruiter/jobs/${job.id}/pipeline`}>
                    <Button variant="outline">Manage Pipeline</Button>
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <div className="grid md:grid-cols-4 gap-6 mb-10">
          {stats.map((stat, i) => (
            <Card key={i} className={`shadow-sm border-l-4 rounded-xl ${stat.color} bg-white`}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</div>
                    <div className="text-3xl font-black text-slate-900">{stat.value}</div>
                  </div>
                  <stat.icon className="text-slate-200" size={24} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <div className="w-2 h-6 bg-primary rounded-full" /> {recruiterCompanyName} Applicants
            </h2>
            <div className="flex items-center gap-4">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input placeholder="Search pipeline..." className="pl-10 h-10 bg-white rounded-lg border-slate-200" />
              </div>
              <Button variant="outline" size="sm" className="h-10 border-slate-200 font-bold px-4">
                <Filter size={16} className="mr-2 text-primary" /> Filters
              </Button>
            </div>
          </div>

          <Card className="shadow-xl shadow-slate-200/50 border-slate-100 rounded-2xl overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold text-slate-900 text-xs tracking-widest uppercase py-5">Candidate</TableHead>
                  <TableHead className="font-bold text-slate-900 text-xs tracking-widest uppercase py-5">Applied For</TableHead>
                  <TableHead className="font-bold text-slate-900 text-xs tracking-widest uppercase py-5">Satori Truth Score</TableHead>
                  <TableHead className="font-bold text-slate-900 text-xs tracking-widest uppercase py-5">Status</TableHead>
                  <TableHead className="font-bold text-slate-900 text-xs tracking-widest uppercase py-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading || isLoadingData ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-20 text-center text-slate-400 font-medium">
                      Loading recruiter pipeline...
                    </TableCell>
                  </TableRow>
                ) : !profile || profile.role !== 'recruiter' ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-20 text-center text-slate-400 font-medium">
                      Sign in as a recruiter to view company-isolated data.
                    </TableCell>
                  </TableRow>
                ) : companyApplications.length > 0 ? (
                  companyApplications.map((app) => (
                    <TableRow key={app.id} className="group hover:bg-slate-50 transition-colors border-slate-100">
                      <TableCell className="py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs border">
                            {app.candidateName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{app.candidateName}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase">{app.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-6">
                        <div className="text-sm font-bold text-slate-900">{app.jobTitle}</div>
                      </TableCell>
                      <TableCell className="py-6">
                        {app.logicScore ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-4">
                              <span className="font-black text-primary text-sm">{app.logicScore}%</span>
                            </div>
                            <Progress value={app.logicScore} className="h-1.5 w-24 bg-slate-100" />
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 text-[10px] font-bold border-dashed border-slate-300">WAITING</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-6">
                        <Badge className={
                          app.status === 'Hired' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          app.status === 'Rejected' ? 'bg-slate-50 text-slate-600 border-slate-200' :
                          'bg-primary/5 text-primary border-primary/20'
                        }>
                          {app.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Button variant="ghost" size="sm" className="h-9 px-3 text-slate-500 hover:text-primary hover:bg-primary/5 font-bold">
                            Review CV
                          </Button>
                          <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-slate-200">
                            <MoreHorizontal size={16} className="text-slate-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-20 text-center text-slate-400 font-medium">
                      No active applicants for {recruiterCompanyName} yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </section>

        <div className="grid md:grid-cols-2 gap-10 mt-12">
          <Card className="bg-slate-900 text-white border-none rounded-3xl overflow-hidden relative shadow-2xl">
            <CardHeader className="p-8">
              <CardTitle className="flex items-center gap-3 text-2xl font-black">
                <UserCheck className="text-primary" /> Global Transparency Audit
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6 relative z-10">
              <p className="text-base text-slate-400 leading-relaxed font-medium">
                Closing a position triggers the **Satori Transparency Audit**. Rejected candidates for {recruiterCompanyName} will receive an anonymous delta report against the hired candidate.
              </p>
              <Button className="bg-primary hover:bg-primary/90 border-none font-black h-12 px-10 rounded-xl shadow-lg shadow-primary/20 w-full sm:w-auto">
                RUN PIPELINE CLOSURE
              </Button>
            </CardContent>
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full -mr-40 -mt-40 blur-[100px]" />
          </Card>

          <Card className="border-slate-200 rounded-3xl shadow-sm bg-white">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-lg font-bold">{recruiterCompanyName} Funnel Health</CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              {[
                { stage: 'Initial Screening', count: companyApplications.length, total: 10, color: 'bg-primary' },
                { stage: 'Logic Verification', count: 2, total: 10, color: 'bg-indigo-500' },
                { stage: 'Final Rounds', count: 1, total: 10, color: 'bg-emerald-500' }
              ].map((s, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    <span>{s.stage}</span>
                    <span className="text-slate-900">{s.count} Candidates</span>
                  </div>
                  <Progress value={(s.count / s.total) * 100} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Brain, Fingerprint, UserCheck, Search, Globe, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthDialog } from '@/components/AuthDialog'
import { useAuth } from '@/components/AuthProvider'

export default function LandingPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'candidate' | 'recruiter'>('candidate')

  async function openCandidateConsole() {
    if (profile?.role === 'candidate') {
      router.push('/dashboard')
      return
    }

    setDialogMode('candidate')
    setIsAuthDialogOpen(true)
  }

  async function openRecruiterPortal() {
    if (profile?.role === 'recruiter') {
      router.push('/recruiter')
      return
    }

    setDialogMode('recruiter')
    setIsAuthDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-slate-50 font-body">
      <header className="container mx-auto px-4 py-8 flex justify-between items-center bg-transparent">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-900/10">
            <Brain className="text-primary w-6 h-6" />
          </div>
          <span className="font-black text-2xl tracking-tighter text-slate-900 uppercase">SATORI</span>
        </div>
        <nav className="hidden md:flex items-center gap-10 text-[11px] font-black uppercase tracking-widest text-slate-500">
          <Link href="/jobs" className="hover:text-primary transition-colors">Job Board</Link>
          <button onClick={() => void openRecruiterPortal()} className="hover:text-primary transition-colors">Employer Portal</button>
          <button onClick={() => void openCandidateConsole()} className="hover:text-primary transition-colors">Candidate Console</button>
        </nav>
        <div className="flex gap-4">
          <Button onClick={() => void openCandidateConsole()} variant="outline" className="font-bold px-6 h-12 rounded-xl text-xs uppercase tracking-widest">Candidate Login</Button>
          <Button onClick={() => void openRecruiterPortal()} className="bg-slate-900 hover:bg-slate-800 font-bold px-6 h-12 rounded-xl text-xs uppercase tracking-widest">Recruiter Login</Button>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 pt-24 pb-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/5 text-slate-900 font-bold text-[10px] mb-10 border border-slate-900/10 uppercase tracking-widest">
            <UserCheck size={14} className="text-primary" />
            <span>Bridging the Indian Dev Ecosystem with Global Tech</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-slate-900 mb-10 max-w-6xl mx-auto leading-[0.9] uppercase">
            RESUMES ARE NOISE. <br />
            <span className="text-primary italic">LOGIC IS TRUTH.</span>
          </h1>
          <p className="text-xl text-slate-500 max-w-3xl mx-auto mb-16 leading-relaxed font-medium">
            The first transparency-first hiring platform. We use **Skill Fingerprinting** to verify logical patterns and provide **Candidacy Benchmarking** so you know exactly where you stand against the hired pool.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link href="/jobs">
              <Button size="lg" className="px-12 h-16 text-sm font-black uppercase tracking-widest bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-2xl shadow-slate-900/20">
                Browse Global Roles <Search className="ml-3" size={18} />
              </Button>
            </Link>
            <Button onClick={() => void openRecruiterPortal()} size="lg" variant="outline" className="px-12 h-16 text-sm font-black uppercase tracking-widest border-2 border-slate-200 bg-white hover:bg-slate-50 rounded-2xl">
              Post for Your Company
            </Button>
          </div>
        </section>

        {/* The Novelty Layer */}
        <section className="bg-white py-32 border-y-2 border-slate-100">
          <div className="container mx-auto px-4">
            <div className="text-center mb-20 space-y-4">
              <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tight">The Satori Transparency Protocol</h2>
              <p className="text-slate-500 font-medium">Standardizing the &quot;Black Box&quot; of Recruitment.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-16">
              <div className="space-y-6">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-primary border shadow-sm">
                  <Fingerprint size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase">Skill Fingerprinting</h3>
                <p className="text-slate-500 leading-relaxed font-medium">We audit resumes through behavioral logic tests. We verify that your DS/Algo mastery is production-ready, giving you a Satori Truth Score.</p>
              </div>
              <div className="space-y-6">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-primary border shadow-sm">
                  <Scale size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase">Candidacy Benchmarking</h3>
                <p className="text-slate-500 leading-relaxed font-medium">Rejected? Get a side-by-side comparison of your metrics (Pedigree, Experience, Projects) vs the hired candidate, all PII hidden.</p>
              </div>
              <div className="space-y-6">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-primary border shadow-sm">
                  <Globe size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 uppercase">Multi-Company Hub</h3>
                <p className="text-slate-500 leading-relaxed font-medium">One platform, multiple companies. Zomato, Flipkart, Swiggy—all using the same verified logic protocol for fair hiring.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="container mx-auto px-4 py-20 text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <Brain className="text-primary w-4 h-4" />
          </div>
          <span className="font-black text-lg tracking-tighter text-slate-900 uppercase">SATORI AI</span>
        </div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">&copy; 2024 Satori Intelligence Platform. Redefining Global Tech Hiring.</p>
      </footer>
      <AuthDialog
        open={isAuthDialogOpen}
        onOpenChange={setIsAuthDialogOpen}
        initialMode={dialogMode}
      />
    </div>
  )
}

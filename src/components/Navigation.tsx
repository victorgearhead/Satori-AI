"use client"

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Brain, LayoutDashboard, Briefcase, Settings, User, LogOut, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/components/AuthProvider'
import { AuthDialog } from '@/components/AuthDialog'
import { Button } from '@/components/ui/button'

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, loading, signOut } = useAuth()
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'candidate' | 'recruiter'>('candidate')

  // Navigation items for the Candidate/User experience
  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Browse Jobs', href: '/jobs', icon: Briefcase },
    { name: 'Assessments', href: '/assessments', icon: Brain },
    { name: 'Transparency', href: '/transparency-reports', icon: FileText },
  ]

  // Check if we are in the recruiter section to show different nav or styling
  const isRecruiterPath = pathname.startsWith('/recruiter')

  function handleCandidateLogin() {
    setDialogMode('candidate')
    setIsAuthDialogOpen(true)
  }

  function handleRecruiterLogin() {
    setDialogMode('recruiter')
    setIsAuthDialogOpen(true)
  }

  async function handleSignOut() {
    await signOut()
    router.push('/')
  }

  return (
    <nav className="border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center group-hover:bg-accent transition-colors">
              <Brain className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-primary">SATORI AI</span>
          </Link>

          {!isRecruiterPath && (
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                      pathname.startsWith(item.href)
                        ? "bg-primary text-white shadow-md shadow-primary/20"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon size={18} />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          )}
          
          {isRecruiterPath && (
             <div className="hidden md:flex items-center gap-2">
                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-bold uppercase tracking-widest border">
                  Recruiter Mode {profile?.companyId ? `(${profile.companyId})` : ''}
                </span>
             </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 text-muted-foreground hover:text-primary transition-colors">
            <Settings size={20} />
          </button>
          {!loading && !profile && (
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCandidateLogin}
              >
                Candidate Login
              </Button>
              <Button
                size="sm"
                onClick={handleRecruiterLogin}
              >
                Recruiter Login
              </Button>
            </div>
          )}
          {!loading && profile && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-muted border flex items-center justify-center overflow-hidden">
                <User size={20} className="text-muted-foreground" />
              </div>
              <Button variant="ghost" size="icon" onClick={() => void handleSignOut()}>
                <LogOut size={18} />
              </Button>
            </div>
          )}
        </div>
      </div>
      <AuthDialog
        open={isAuthDialogOpen}
        onOpenChange={setIsAuthDialogOpen}
        initialMode={dialogMode}
      />
    </nav>
  )
}

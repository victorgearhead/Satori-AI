"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Brain, Clock, ChevronRight, CheckCircle, Loader2, Fingerprint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { submitAssessment } from '@/app/actions'
import { useAuth } from '@/components/AuthProvider'

interface AssessmentClientProps {
  skill: string
  task: {
    taskDescription: string
    expectedOutputFormat: string
    difficultyLevel: string
  }
}

export function AssessmentClient({ skill, task }: AssessmentClientProps) {
  const [solution, setSolution] = useState('')
  const [timer, setTimer] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const { profile, idToken } = useAuth()

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSubmit = async () => {
    if (!solution.trim()) {
      toast({
        title: "Submission Empty",
        description: "Please enter your solution before submitting.",
        variant: "destructive",
      })
      return
    }

    if (!profile || !idToken) {
      toast({
        title: "Sign in required",
        description: "Please sign in before submitting an assessment.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const { assessmentId } = await submitAssessment({
        idToken,
        skill: skill,
        difficulty: task.difficultyLevel as 'Beginner' | 'Intermediate' | 'Advanced',
        taskDescription: task.taskDescription,
        candidateSolution: solution,
        timeTakenSeconds: timer,
      })
      
      router.push(`/results/${assessmentId}?skill=${skill}`)
      
    } catch (error) {
      console.error(error)
      toast({
        title: "Submission Failed",
        description: "An error occurred while evaluating your solution.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-5 gap-0 h-[calc(100vh-64px)] overflow-hidden">
      {/* Sidebar - Task Info */}
      <div className="lg:col-span-2 border-r bg-white flex flex-col overflow-y-auto">
        <div className="p-8 space-y-8 flex-1">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-accent flex items-center gap-1">
                <Brain size={14} /> Problem Statement
              </span>
              <div className="flex items-center gap-2 text-muted-foreground bg-muted px-2 py-1 rounded text-sm font-mono">
                <Clock size={14} /> {formatTime(timer)}
              </div>
            </div>
            <h1 className="text-2xl font-bold text-primary capitalize">{skill} Assessment</h1>
            <div className="flex gap-2">
              <span className="px-2 py-0.5 rounded-full bg-primary/5 text-primary text-[10px] font-bold border">
                {task.difficultyLevel.toUpperCase()}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-accent/5 text-accent text-[10px] font-bold border border-accent/20">
                ADAPTIVE
              </span>
            </div>
          </div>

          <div className="prose prose-slate max-w-none">
            <div className="text-slate-600 leading-relaxed whitespace-pre-wrap">
              {task.taskDescription}
            </div>
          </div>

          <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
            <h3 className="text-sm font-bold text-primary flex items-center gap-2">
              <CheckCircle size={16} className="text-accent" /> Submission Guidelines
            </h3>
            <ul className="text-xs space-y-2 text-muted-foreground list-disc pl-4">
              <li>Expected format: <span className="text-primary font-semibold">{task.expectedOutputFormat}</span></li>
              <li>Avoid generic solution names or standard templates.</li>
              <li>Our Truth Engine detects AI-generated content and plagiarism.</li>
            </ul>
          </div>
        </div>

        <div className="p-6 border-t bg-slate-50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <Fingerprint size={14} className="text-accent" />
            Skill Fingerprint Engine Active
          </div>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="w-full bg-primary hover:bg-primary/90 h-12 text-base font-bold shadow-lg shadow-primary/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Evaluating Solution...
              </>
            ) : (
              <>Submit Solution <ChevronRight className="ml-2" /></>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content - Editor Space */}
      <div className="lg:col-span-3 bg-slate-900 flex flex-col overflow-hidden">
        <div className="h-10 border-b border-slate-800 bg-slate-950 flex items-center px-4 justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/20" />
              <div className="w-3 h-3 rounded-full bg-amber-500/20" />
              <div className="w-3 h-3 rounded-full bg-green-500/20" />
            </div>
            <span className="text-xs text-slate-500 font-mono ml-4">solution.py</span>
          </div>
          <div className="text-[10px] text-slate-600 font-mono uppercase tracking-widest">
            {skill} Environment
          </div>
        </div>
        <div className="flex-1 p-0 relative group">
          <textarea
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            className="w-full h-full bg-transparent text-slate-300 font-code p-8 focus:outline-none resize-none placeholder:text-slate-700 text-sm leading-relaxed"
            placeholder="# Start typing your solution here...
# Satori AI analyzes your behavioral patterns as you code."
            spellCheck={false}
          />
          <div className="absolute bottom-4 right-4 flex items-center gap-4 text-[10px] text-slate-600 font-mono">
            <span>UTF-8</span>
            <span>{solution.length} characters</span>
            <span>Tab size: 4</span>
          </div>
        </div>
      </div>
    </div>
  )
}
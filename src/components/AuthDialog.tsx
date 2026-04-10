"use client"

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Chrome, Loader2 } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'

type AuthMode = 'candidate' | 'recruiter'
type AuthVariant = 'login' | 'register'

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMode?: AuthMode
}

function mapFirebaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Authentication failed. Please try again.'

  if (message.includes('auth/invalid-credential')) {
    return 'Invalid email or password.'
  }
  if (message.includes('auth/email-already-in-use')) {
    return 'This email is already in use. Please log in instead.'
  }
  if (message.includes('auth/weak-password')) {
    return 'Password must be at least 6 characters.'
  }
  if (message.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.'
  }

  return message
}

export function AuthDialog({ open, onOpenChange, initialMode = 'candidate' }: AuthDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const {
    profile,
    signInAsCandidate,
    signInAsRecruiter,
    registerCandidateWithEmail,
    registerRecruiterWithEmail,
    signInCandidateWithEmail,
    signInRecruiterWithEmail,
    forgotPassword,
  } = useAuth()

  const [authMode, setAuthMode] = useState<AuthMode>(initialMode)
  const [variant, setVariant] = useState<AuthVariant>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [companyId, setCompanyId] = useState(profile?.companyId ?? 'swiggy')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setAuthMode(initialMode)
    }
  }, [initialMode, open])

  const title = useMemo(
    () => (authMode === 'candidate' ? 'Candidate Access' : 'Recruiter Access'),
    [authMode]
  )

  async function continueWithGoogle() {
    setSubmitting(true)

    try {
      if (authMode === 'candidate') {
        await signInAsCandidate()
        router.push('/dashboard')
      } else {
        const normalizedCompany = companyId.trim() || 'swiggy'
        await signInAsRecruiter(normalizedCompany)
        router.push('/recruiter')
      }

      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'Google sign-in failed',
        description: mapFirebaseError(error),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function submitEmailPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (variant === 'register' && password !== confirmPassword) {
      toast({
        title: 'Password mismatch',
        description: 'Confirm password must match your password.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)

    try {
      if (authMode === 'candidate' && variant === 'register') {
        await registerCandidateWithEmail(email.trim(), password)
        toast({
          title: 'Verification email sent',
          description: 'Check your inbox and verify your email before logging in.',
        })
        setVariant('login')
      } else if (authMode === 'recruiter' && variant === 'register') {
        const normalizedCompany = companyId.trim() || 'swiggy'
        await registerRecruiterWithEmail(email.trim(), password, normalizedCompany)
        toast({
          title: 'Recruiter account created',
          description: 'Verify your email, then log in to continue.',
        })
        setVariant('login')
      } else if (authMode === 'candidate' && variant === 'login') {
        await signInCandidateWithEmail(email.trim(), password)
        router.push('/dashboard')
        onOpenChange(false)
      } else {
        const normalizedCompany = companyId.trim() || 'swiggy'
        await signInRecruiterWithEmail(email.trim(), password, normalizedCompany)
        router.push('/recruiter')
        onOpenChange(false)
      }
    } catch (error) {
      toast({
        title: 'Authentication error',
        description: mapFirebaseError(error),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgotPassword() {
    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      toast({
        title: 'Email required',
        description: 'Enter your email first, then click Forgot password.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      await forgotPassword(normalizedEmail)
      toast({
        title: 'Password reset email sent',
        description: 'Check your inbox for a password reset link.',
      })
    } catch (error) {
      toast({
        title: 'Could not send reset email',
        description: mapFirebaseError(error),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Log in or register with Google or email/password.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            type="button"
            variant={authMode === 'candidate' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setAuthMode('candidate')}
            disabled={submitting}
          >
            Candidate
          </Button>
          <Button
            type="button"
            variant={authMode === 'recruiter' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setAuthMode('recruiter')}
            disabled={submitting}
          >
            Recruiter
          </Button>
        </div>

        <Tabs value={variant} onValueChange={(value) => setVariant(value as AuthVariant)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Log In</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          <TabsContent value={variant}>
            <div className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void continueWithGoogle()}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Chrome className="mr-2 h-4 w-4" />}
                Continue with Google
              </Button>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <span>or use email/password</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <form className="space-y-3" onSubmit={submitEmailPassword}>
                {authMode === 'recruiter' && (
                  <div className="space-y-1">
                    <Label htmlFor="companyId">Company ID</Label>
                    <Input
                      id="companyId"
                      value={companyId}
                      onChange={(event) => setCompanyId(event.target.value)}
                      placeholder="swiggy"
                      required
                      disabled={submitting}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                    disabled={submitting}
                  />
                </div>

                {variant === 'login' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline disabled:opacity-60"
                      onClick={() => void handleForgotPassword()}
                      disabled={submitting}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {variant === 'register' && (
                  <div className="space-y-1">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                      minLength={6}
                      disabled={submitting}
                    />
                  </div>
                )}

                <Button className="w-full" type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {variant === 'register' ? 'Create Account' : 'Log In'}
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

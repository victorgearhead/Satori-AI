import { runAssessmentTask } from '@/app/actions'
import { AssessmentClient } from './AssessmentClient'
import { Navigation } from '@/components/Navigation'

interface PageProps {
  params: Promise<{ skill: string }>
}

export default async function AssessmentPage({ params }: PageProps) {
  const { skill } = await params
  
  const task = await runAssessmentTask({
    skill: skill,
    proficiency: 'Intermediate',
  })

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Navigation />
      <AssessmentClient skill={skill} task={task} />
    </div>
  )
}
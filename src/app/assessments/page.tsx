import { Navigation } from '@/components/Navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Brain, Code, Database, Globe, Layers, Layout, Terminal } from 'lucide-react'
import Link from 'next/link'
import type { ComponentProps } from 'react'
import type { LucideIcon } from 'lucide-react'

const SKILLS = [
  { name: 'Python', icon: Terminal, desc: 'Assess logic, data structures, and algorithm efficiency.' },
  { name: 'SQL', icon: Database, desc: 'Evaluate query optimization and relational schema understanding.' },
  { name: 'React', icon: Layout, desc: 'Test component design, state management, and performance.' },
  { name: 'Node.js', icon: ServerIcon, desc: 'Analyze asynchronous programming and backend architecture.' },
  { name: 'Java', icon: Code, desc: 'Evaluate OOP principles, concurrency, and robust logic.' },
  { name: 'Go', icon: ZapIcon, desc: 'Test efficiency, systems design, and concurrency handling.' },
]

function ServerIcon(props: ComponentProps<LucideIcon>) {
  return <Layers {...props} />
}

function ZapIcon(props: ComponentProps<LucideIcon>) {
  return <Globe {...props} />
}

export default function AssessmentSelection() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-12 max-w-5xl">
        <header className="text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold uppercase tracking-widest">
            <Brain size={14} /> Adaptive Assessment
          </div>
          <h1 className="text-4xl font-bold text-primary">What do you want to verify today?</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Our Truth Engine will generate a unique assessment based on your chosen skill and level.
          </p>
        </header>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SKILLS.map((skill) => {
            const Icon = skill.icon
            return (
              <Card key={skill.name} className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 border-2 hover:border-accent/30">
                <CardHeader className="space-y-4">
                  <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center text-primary group-hover:bg-accent group-hover:text-white transition-colors">
                    <Icon size={24} />
                  </div>
                  <div className="space-y-1">
                    <CardTitle>{skill.name}</CardTitle>
                    <CardDescription>{skill.desc}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="bg-muted text-[10px] font-bold">BEGINNER</Badge>
                      <Badge variant="secondary" className="bg-muted text-[10px] font-bold">INTERMEDIATE</Badge>
                      <Badge variant="secondary" className="bg-muted text-[10px] font-bold">ADVANCED</Badge>
                    </div>
                    <Link href={`/assessments/${skill.name.toLowerCase()}`}>
                      <Button className="w-full bg-primary hover:bg-primary/90">
                        Start Challenge
                      </Button>
                    </Link>
                  </div>
                </CardContent>
                <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 -mr-12 -mt-12 rounded-full blur-2xl group-hover:bg-accent/20 transition-colors" />
              </Card>
            )
          })}
        </div>

        <div className="mt-16 p-8 bg-white rounded-3xl border border-dashed text-center">
          <h3 className="font-semibold text-muted-foreground mb-4">Can&apos;t find your skill?</h3>
          <Button variant="outline" className="border-primary/20">Suggest a Skill Track</Button>
        </div>
      </main>
    </div>
  )
}

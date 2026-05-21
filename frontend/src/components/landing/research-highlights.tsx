import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ScanSearch, BarChart3, LineChart } from 'lucide-react';

export function ResearchHighlights() {
  const items = [
    {
      icon: <ScanSearch className="h-6 w-6 text-primary" />,
      title: 'Daily Market Pulse',
      desc: 'Quick read on market trend, distribution days, and breadth.'
    },
    {
      icon: <BarChart3 className="h-6 w-6 text-primary" />,
      title: 'Model Portfolio Notes',
      desc: 'High-conviction ideas with risk management commentary.'
    },
    {
      icon: <LineChart className="h-6 w-6 text-primary" />,
      title: 'Sector & Theme Watch',
      desc: 'What’s leading now, and where leadership could rotate next.'
    }
  ];

  return (
    <section id="research" className="w-full py-12 md:py-24 lg:py-32 bg-card/40 anchor-offset">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center text-center space-y-2 mb-10">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Research Highlights</h2>
          <p className="text-muted-foreground max-w-[760px] md:text-xl">Concise market research inspired by professional workflows.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((it) => (
            <Card key={it.title} className="bg-card/60 border-border/50 hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-start gap-3">
                {it.icon}
                <div>
                  <CardTitle className="text-lg">{it.title}</CardTitle>
                  <CardDescription>{it.desc}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

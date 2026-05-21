import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function LeaderboardPreview() {
  const leaders = [
    { symbol: 'ABC', change: '+6.2%', theme: 'Momentum', rs: 92 },
    { symbol: 'XYZ', change: '+4.8%', theme: 'Breakout', rs: 88 },
    { symbol: 'LMN', change: '+3.9%', theme: 'Earnings', rs: 85 },
  ];

  return (
    <section id="leaderboard" className="w-full py-12 md:py-24 lg:py-32 bg-background">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center text-center space-y-2 mb-10">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Leaders Board (Preview)</h2>
          <p className="text-muted-foreground max-w-[760px] md:text-xl">Top relative-strength ideas, refreshed daily.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {leaders.map((l) => (
            <Card key={l.symbol} className="bg-card/60 border-border/50 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{l.symbol}</CardTitle>
                  <Badge className="shrink-0">{l.change}</Badge>
                </div>
                <CardDescription>{l.theme} · RS {l.rs}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

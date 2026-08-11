import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function Testimonials() {
  const quotes = [
    {
      name: 'Riya S.',
      role: 'Swing Trader',
      quote:
        'Nivro helped me spot momentum opportunities earlier. The UI is clean and fast.'
    },
    {
      name: 'Aman K.',
      role: 'Long-term Investor',
      quote:
        'The fundamentals view and AI summaries make research far more efficient.'
    },
    {
      name: 'Meera G.',
      role: 'Beginner',
      quote:
        'I finally understand what to look for. The tools are simple and confidence-boosting.'
    }
  ];

  return (
    <section id="testimonials" className="w-full py-12 md:py-24 lg:py-32 bg-card/40 anchor-offset">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center text-center space-y-2 mb-10">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Loved by Investors</h2>
          <p className="text-muted-foreground max-w-[700px] md:text-xl">
            Real stories from traders and investors using Nivro every day.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quotes.map((q) => (
            <Card key={q.name} className="hover:shadow-lg transition-shadow bg-card/60 border-border/50">
              <CardHeader>
                <CardTitle className="text-base">“{q.quote}”</CardTitle>
                <CardDescription>{q.name} · {q.role}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

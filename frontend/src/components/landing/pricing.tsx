import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function Pricing() {
  const tiers = [
    {
      name: 'Free',
      price: '₹0',
      description: 'Get started with core tools',
      features: ['Screener (basic)', '3 watchlists', 'Email summaries (weekly)'],
      cta: 'Start Free',
      highlighted: false,
    },
    {
      name: 'Pro',
      price: '₹499/mo',
      description: 'For active traders and investors',
      features: ['Advanced screener', 'AI insights', 'Backtests (limited)', 'Priority support'],
      cta: 'Go Pro',
      highlighted: true,
    },
    {
      name: 'Enterprise',
      price: 'Contact',
      description: 'For teams and funds',
      features: ['Custom models', 'Dedicated support', 'SLA & SSO', 'Audit logs'],
      cta: 'Contact Sales',
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="w-full py-12 md:py-24 lg:py-32 bg-background anchor-offset">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center text-center space-y-2 mb-10">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Simple, transparent pricing</h2>
          <p className="text-muted-foreground max-w-[700px] md:text-xl">
            Start free and upgrade when you need more power.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch justify-items-stretch">
          {tiers.map((t) => (
            <Card key={t.name} className={`${t.highlighted ? 'border-primary ring-1 ring-primary/20' : ''} bg-card/60 border-border/50 hover:shadow-lg transition-shadow h-full flex flex-col`}>
              <CardHeader className="items-center text-center">
                <CardTitle>{t.name}</CardTitle>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col items-center text-center">
                <div className="text-3xl font-bold mb-4">{t.price}</div>
                <ul className="text-sm text-muted-foreground space-y-2 mb-6">
                  {t.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <Button className="w-full mt-auto" variant={t.highlighted ? 'default' : 'outline'}>{t.cta}</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

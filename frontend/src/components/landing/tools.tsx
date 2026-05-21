import { AreaChart, PiggyBank, Briefcase } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function Tools() {
  return (
    <section id="tools" className="w-full py-12 md:py-24 lg:py-32 bg-background anchor-offset">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Powerful Tools for Every Investor</h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              From calculating returns to optimizing your portfolio, we have you covered.
            </p>
          </div>
        </div>
        <div className="mx-auto grid max-w-sm items-start gap-8 sm:max-w-4xl sm:grid-cols-2 md:gap-12 lg:max-w-5xl lg:grid-cols-3 mt-12">
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-2 border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="items-center text-center p-6">
              <div className="p-4 rounded-full bg-primary/10 mb-4 border border-primary/20">
                <PiggyBank className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>SIP Calculator</CardTitle>
              <CardDescription>Project your investment growth and see your money multiply over time.</CardDescription>
            </CardHeader>
          </Card>
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-2 border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="items-center text-center p-6">
              <div className="p-4 rounded-full bg-primary/10 mb-4 border border-primary/20">
                <Briefcase className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Asset Allocation Tool</CardTitle>
              <CardDescription>Balance your portfolio across equity, debt, and gold for optimal returns.</CardDescription>
            </CardHeader>
          </Card>
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-2 border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="items-center text-center p-6">
              <div className="p-4 rounded-full bg-primary/10 mb-4 border border-primary/20">
                <AreaChart className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Economic Dashboard</CardTitle>
              <CardDescription>Stay on top of key economic indicators and market-moving news.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </section>
  );
}

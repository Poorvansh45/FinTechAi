import { ScanSearch, CandlestickChart, BrainCircuit } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function Features() {
  return (
    <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-card anchor-offset">
      <div className="container px-4 md:px-6">
        <div className="mx-auto grid max-w-sm items-start gap-8 sm:max-w-4xl sm:grid-cols-2 md:gap-12 lg:max-w-5xl lg:grid-cols-3">
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-2 border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="items-center text-center p-6">
              <div className="p-4 rounded-full bg-primary/10 mb-4 border border-primary/20">
                <ScanSearch className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Fundamental Screener</CardTitle>
              <CardDescription>Filter stocks with our powerful, data-driven fundamental analysis engine.</CardDescription>
            </CardHeader>
          </Card>
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-2 border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="items-center text-center p-6">
              <div className="p-4 rounded-full bg-primary/10 mb-4 border border-primary/20">
                <CandlestickChart className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Advanced Charting</CardTitle>
              <CardDescription>Visualize market data with our TradingView-inspired charting tools.</CardDescription>
            </CardHeader>
          </Card>
          <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-2 border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="items-center text-center p-6">
              <div className="p-4 rounded-full bg-primary/10 mb-4 border border-primary/20">
                <BrainCircuit className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>AI Insights</CardTitle>
              <CardDescription>Leverage our AI to get actionable insights and simplify your investment decisions.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </section>
  );
}

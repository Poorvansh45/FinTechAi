import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, BrainCircuit, BarChartHorizontal } from 'lucide-react';

export function Hero() {
  // Prefer a custom hero image placed at /public/ai-hero.png
  const heroSrc = '/ai-hero.png';

  const stats = [
      {value: "10K+", label: "Stocks Analyzed"},
      {value: "99.8%", label: "Uptime"},
      {value: "24/7", label: "Data Updates"},
  ]

  return (
    <section className="w-full py-10 md:py-18 lg:py-24 xl:py-28 bg-background">
      <div className="container px-4 md:px-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-10 items-center">
          <div className="flex flex-col justify-center space-y-4 items-center lg:items-start">
            <div className="space-y-6">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none font-headline text-foreground text-center lg:text-left leading-tight">
                    Smarter Investing,
                    <br />
                    <span className="text-accent">Powered by AI.</span>
                </h1>
                <p className="max-w-[640px] text-muted-foreground md:text-lg text-center lg:text-left">
                    Anonymous, intelligent, and accessible stock analysis for everyday investors. Get the insights you need, when you need them.
                </p>
                <div className="flex items-center gap-4 text-sm">
                    <Badge variant="outline" className="flex items-center gap-2 border-border/50 py-1 px-3">
                        <ShieldCheck className="w-4 h-4 text-primary"/>
                        <span>100% Secure</span>
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-2 border-border/50 py-1 px-3">
                        <BrainCircuit className="w-4 h-4 text-primary"/>
                        <span>AI-Powered</span>
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-2 border-border/50 py-1 px-3">
                        <BarChartHorizontal className="w-4 h-4 text-primary"/>
                        <span>Real-time Data</span>
                    </Badge>
                </div>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row mt-4 justify-center lg:justify-start">
              <Button asChild size="lg" className="transition-transform hover:scale-105">
                <Link href="#">Start Screening</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#">Explore Strategies</Link>
              </Button>
            </div>
             <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                {stats.map(stat => (
                  <div key={stat.label}>
                    <h3 className="text-2xl font-bold">{stat.value}</h3>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
             </div>
          </div>
          <div className="relative flex items-center justify-center lg:justify-end">
            <Image
              src={heroSrc}
              alt="AI and finance illustration for the hero section"
              width={560}
              height={420}
              className="mx-auto aspect-[3/2] overflow-hidden rounded-xl object-cover shadow-lg md:translate-y-1"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}

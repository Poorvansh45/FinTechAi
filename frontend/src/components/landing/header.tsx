import { BrainCircuit, Menu, User } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ModeToggle } from '@/components/mode-toggle';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
 

export function Header() {
  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/screener', label: 'Screener' },
    { href: '/journal', label: 'Journal' },
    { href: '/about', label: 'About Us' },
    { href: '/#tools', label: 'Tools' },
    { href: '/#pricing', label: 'Pricing' },
    { href: '/#faq', label: 'FAQ' },
  ];

  return (
    <header className="px-4 lg:px-6 h-16 flex items-center bg-background/80 backdrop-blur-sm sticky top-0 z-40 border-b">
      <Link href="#" className="flex items-center justify-center gap-2" prefetch={false}>
        <BrainCircuit className="h-6 w-6 text-primary" />
        <span className="text-xl font-bold font-headline">Nivro</span>
      </Link>
      <nav className="ml-auto hidden lg:flex gap-6 items-center">
        {navLinks.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            prefetch={false}
          >
            {link.label}
          </Link>
        ))}
        <Button asChild size="sm" className="ml-2">
          <Link href="/screener">Open Screener</Link>
        </Button>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <div className="lg:hidden">
            <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle navigation menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left">
                <VisuallyHidden>
                <SheetTitle>Menu</SheetTitle>
                <SheetDescription>Main navigation menu</SheetDescription>
                </VisuallyHidden>
                <Link href="#" className="flex items-center gap-2 text-lg font-semibold mb-8">
                    <BrainCircuit className="h-6 w-6 text-primary" />
                    <span className="font-bold">Nivro</span>
                </Link>
                <nav className="grid gap-4 text-base font-medium">
                {navLinks.map((link) => (
                    <Link
                    key={link.label}
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground"
                    prefetch={false}
                    >
                    {link.label}
                    </Link>
                ))}
                <Button asChild className="mt-4">
                  <Link href="/dashboard">Get Started</Link>
                </Button>
                </nav>
            </SheetContent>
            </Sheet>
        </div>
        <ModeToggle />
        {/* Portfolio/Profile icon button */}
        <Button asChild variant="ghost" size="icon">
            <Link href="/dashboard" aria-label="Portfolio / Login">
            <User className="h-5 w-5" />
            <span className='sr-only'>User Profile</span>
            </Link>
        </Button>
      </div>
    </header>
  );
}

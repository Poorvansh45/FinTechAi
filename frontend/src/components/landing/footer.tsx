import { BrainCircuit, Twitter, Linkedin, Facebook } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function Footer() {
  return (
    <footer className="py-8 w-full shrink-0 items-center px-4 md:px-6 border-t bg-card">
      <div className="container grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-2">
              <BrainCircuit className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">FinTechAI</span>
          </div>
          <p className="text-muted-foreground text-sm">Get AI-powered stock insights weekly.</p>
          <div className="flex w-full max-w-sm items-center space-x-2 mt-2">
            <Input type="email" placeholder="Email" />
            <Button type="submit">Subscribe</Button>
          </div>
        </div>

        <div className="md:col-start-3 flex flex-col gap-2 text-sm">
          <h3 className="font-semibold mb-2">Company</h3>
          <Link href="#" className="text-muted-foreground hover:text-primary transition-colors" prefetch={false}>About</Link>
          <Link href="#" className="text-muted-foreground hover:text-primary transition-colors" prefetch={false}>Careers</Link>
          <Link href="#" className="text-muted-foreground hover:text-primary transition-colors" prefetch={false}>Support</Link>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <h3 className="font-semibold mb-2">Legal</h3>
          <Link href="#" className="text-muted-foreground hover:text-primary transition-colors" prefetch={false}>FAQs</Link>
          <Link href="#" className="text-muted-foreground hover:text-primary transition-colors" prefetch={false}>Policies</Link>
        </div>
      </div>
      <div className="container mt-8 pt-6 border-t flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground">
        <span>Copyright © 2025 FinTechAI. All rights reserved.</span>
        <div className="flex items-center gap-4 mt-4 md:mt-0">
            <Link href="#" aria-label="Twitter" className="text-muted-foreground hover:text-primary transition-colors">
                <Twitter className="h-5 w-5" />
            </Link>
            <Link href="#" aria-label="LinkedIn" className="text-muted-foreground hover:text-primary transition-colors">
                <Linkedin className="h-5 w-5" />
            </Link>
            <Link href="#" aria-label="Facebook" className="text-muted-foreground hover:text-primary transition-colors">
                <Facebook className="h-5 w-5" />
            </Link>
        </div>
      </div>
    </footer>
  );
}

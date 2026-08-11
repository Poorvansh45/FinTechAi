import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:9002'
  ),
  title: 'Nivro — See More. Know Better.',
  description:
    'AI-powered trading intelligence platform for market research, screening, portfolio optimization, quantitative analysis, and AI-assisted decision making.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Nivro — See More. Know Better.',
    description:
      'AI-powered trading intelligence platform for market research, screening, portfolio optimization, quantitative analysis, and AI-assisted decision making.',
    images: ['/logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nivro — See More. Know Better.',
    description:
      'AI-powered trading intelligence platform for market research, screening, portfolio optimization, quantitative analysis, and AI-assisted decision making.',
    images: ['/logo.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="antialiased" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

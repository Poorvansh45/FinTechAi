import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// IBM Plex: a grotesque UI face with a technical, "financial document" feel,
// plus a matching mono for figures. Loaded through next/font (self-hosted at
// build time, no runtime request to Google, no layout shift).
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:9002'
  ),
  title: 'Nivro — Trading research workspace',
  description:
    'Monitor markets, screen for SMC zones, and review portfolio risk in one workspace, with AI-assisted analysis when useful.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Nivro — Trading research workspace',
    description:
      'Monitor markets, screen for SMC zones, and review portfolio risk in one workspace, with AI-assisted analysis when useful.',
    images: ['/logo.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nivro — Trading research workspace',
    description:
      'Monitor markets, screen for SMC zones, and review portfolio risk in one workspace, with AI-assisted analysis when useful.',
    images: ['/logo.png'],
  },
};

// Browser chrome (mobile address bar) follows the page background. The
// ThemeProvider re-syncs this tag when the user picks a theme explicitly.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F5F1' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0E13' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

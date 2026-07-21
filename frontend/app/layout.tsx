import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'CAT® - Plug-and-Play Industrial Diagnostic System',
  description: 'Enterprise-grade machinery configuration audit and automated diagnostics leveraging GPT-5.5 analysis.',
  icons: {
    icon: '/favicon.ico',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-100 min-h-screen text-gray-900">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

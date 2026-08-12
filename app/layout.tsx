import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Background Remover',
  description: 'Remove image backgrounds in your browser. Nothing is ever uploaded.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

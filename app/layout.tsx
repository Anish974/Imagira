import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Imagira — background removal that stays on your machine',
  description:
    'Drop an image, get a transparent PNG. Every pixel is processed in your browser and nothing is uploaded.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

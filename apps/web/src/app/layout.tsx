import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BharatVidya School ERP',
  description: 'India-focused school ERP for academics, fees, attendance and exams',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

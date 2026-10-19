import type { Metadata } from 'next';
import './globals.css';
import './academic-workspace.css';
import AppNavigation from '@/components/app-navigation';

export const metadata: Metadata = { title: 'Wichakan', description: 'School Academic Management System' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body><a className="app-skip-link" href="#main-content">ข้ามไปเนื้อหา</a><AppNavigation/><div id="main-content" tabIndex={-1}>{children}</div></body></html>;
}

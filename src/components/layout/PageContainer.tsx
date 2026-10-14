import React from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

export interface PageContainerProps {
  children: React.ReactNode;
  noPadding?: boolean;
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, noPadding = false }) => {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-between selection:bg-cyan-500/30 selection:text-cyan-200">
      <Header />
      <main className={`flex-1 ${noPadding ? 'pt-0' : 'pt-24'}`}>{children}</main>
      <Footer />
    </div>
  );
};

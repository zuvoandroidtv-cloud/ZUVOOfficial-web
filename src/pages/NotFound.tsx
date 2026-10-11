import React from 'react';
import { Link } from 'react-router-dom';
import { PageContainer } from '../components/layout/PageContainer';
import { Container } from '../components/ui/Container';
import { SEO } from '../components/common/SEO';

export const NotFound: React.FC = () => {
  return (
    <PageContainer>
      <SEO
        title="404 — Page Not Found | ZUVO Android TV"
        description="The requested page could not be located on the official ZUVO website."
        noindex={true}
      />
      <div className="py-24 bg-black text-center">
        <Container>
          <span className="text-xs font-bold text-cyan-400 tracking-widest uppercase block mb-4">404 ERROR</span>
          <h1 className="text-5xl sm:text-7xl font-extrabold text-white uppercase mb-6">
            PAGE NOT <span className="text-zuvo-gradient">FOUND</span>
          </h1>
          <p className="text-neutral-400 text-base max-w-md mx-auto mb-8">
            The page or product specification route you requested could not be located.
          </p>
          <Link
            to="/"
            className="inline-flex px-8 py-4 rounded-full bg-white text-black font-bold text-xs tracking-widest uppercase hover:bg-neutral-200 transition"
          >
            RETURN TO HOMEPAGE
          </Link>
        </Container>
      </div>
    </PageContainer>
  );
};
export default NotFound;

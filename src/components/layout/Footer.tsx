import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { footerLinks } from '../../data/navigation';
import { siteConfig } from '../../data/siteConfig';
import { getCrmStaffLoginUrl } from '../../utils/crmConfig';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#050505] border-t border-white/10 text-neutral-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 mb-16">
          {/* Brand Column */}
          <div className="md:col-span-2 flex flex-col space-y-6">
            <Link to="/">
              <img src="/zuvo-logo.svg" alt="ZUVO Android TV" className="h-9 w-auto" />
            </Link>
            <p className="text-neutral-400 text-sm max-w-sm leading-relaxed">
              {siteConfig.description}
            </p>
            <div className="flex items-center space-x-4 pt-2">
              <Badge>POWERED BY ANDROID TV OS</Badge>
            </div>
          </div>

          {/* Products Column */}
          <div>
            <h4 className="text-white text-xs font-bold tracking-widest uppercase mb-6">TV Series</h4>
            <ul className="space-y-3">
              {footerLinks.products.map((item) => (
                <li key={item.path}>
                  <Link to={item.path} className="hover:text-white transition-colors text-xs">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Technology Column */}
          <div>
            <h4 className="text-white text-xs font-bold tracking-widest uppercase mb-6">Technology</h4>
            <ul className="space-y-3">
              {footerLinks.technology.map((item) => (
                <li key={item.path}>
                  <Link to={item.path} className="hover:text-white transition-colors text-xs">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Column */}
          <div>
            <h4 className="text-white text-xs font-bold tracking-widest uppercase mb-6">Support & Brand</h4>
            <ul className="space-y-3">
              {footerLinks.support.map((item) => (
                <li key={item.path}>
                  <Link to={item.path} className="hover:text-white transition-colors text-xs">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 space-y-4 sm:space-y-0">
          <p>© {new Date().getFullYear()} ZUVO Consumer Electronics. All rights reserved.</p>
          <div className="flex items-center space-x-6">
            <Link to="/privacy" className="hover:text-neutral-300">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-neutral-300">Terms of Service</Link>
            <Link to="/support" className="hover:text-neutral-300">Customer Support</Link>
            <Link
              to="/staff"
              title="Authorized Staff & Service Center Portal"
              className="text-neutral-600 hover:text-neutral-400 transition-colors text-[11px] flex items-center space-x-1"
            >
              <span>Staff Portal</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

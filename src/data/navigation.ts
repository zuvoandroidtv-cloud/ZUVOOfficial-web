export interface NavLink {
  label: string;
  path: string;
}

export const mainNavLinks: NavLink[] = [
  { label: 'Home', path: '/' },
  { label: 'Products', path: '/products' },
  { label: 'Dealership', path: '/dealership' },
  { label: 'Technology', path: '/technology' },
  { label: 'About', path: '/about' },
  { label: 'Support', path: '/support' },
  { label: 'Contact', path: '/contact' },
];

export const footerLinks = {
  products: [
    { label: '24" Normal LED TV', path: '/products/zuvo-24-normal' },
    { label: '32" Smart LED TV', path: '/products/zuvo-32-smart' },
    { label: '32" Smart + B/T + Voice', path: '/products/zuvo-32-smart-bt-voice' },
    { label: '43" Smart LED TV', path: '/products/zuvo-43-smart' },
    { label: '43" Smart + B/T + Voice', path: '/products/zuvo-43-smart-bt-voice' },
    { label: '50" Smart + B/T + Voice', path: '/products/zuvo-50-smart-bt-voice' },
    { label: '55" Smart + B/T + Voice', path: '/products/zuvo-55-smart-bt-voice' },
    { label: 'All TV Models', path: '/products' },
  ],
  technology: [
    { label: 'Quantum Dot Display', path: '/technology#display' },
    { label: 'Dolby Atmos Audio', path: '/technology#audio' },
    { label: 'Android TV Platform', path: '/technology#smart-tv' },
    { label: 'AI Picture Engine', path: '/technology#processor' },
  ],
  support: [
    { label: 'Product Support', path: '/support' },
    { label: 'Warranty & Policy', path: '/warranty' },
    { label: 'Become a Dealer', path: '/dealership' },
    { label: 'Contact Us', path: '/contact' },
  ],
  company: [
    { label: 'About ZUVO', path: '/about' },
    { label: 'Brand Philosophy', path: '/about#philosophy' },
    { label: 'Dealership Enquiry', path: '/dealership' },
    { label: 'Privacy Policy', path: '/privacy' },
    { label: 'Terms of Service', path: '/terms' },
  ],
};

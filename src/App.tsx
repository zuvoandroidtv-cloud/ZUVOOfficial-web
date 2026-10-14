import { Routes, Route, Navigate } from 'react-router-dom';
import { ScrollToTop } from './components/layout/ScrollToTop';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetails from './pages/ProductDetails';
import Technology from './pages/Technology';
import About from './pages/About';
import Support from './pages/Support';
import Contact from './pages/Contact';
import Dealership from './pages/Dealership';
import Warranty from './pages/Warranty';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import NotFound from './pages/NotFound';

// Unified CRM Integration
import { AuthProvider } from './crm/context/AuthContext';
import { App as CrmApp } from './crm/App';

export default function App() {
  return (
    <AuthProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:productId" element={<ProductDetails />} />
        <Route path="/dealership" element={<Dealership />} />
        <Route path="/dealer" element={<Navigate to="/dealership" replace />} />
        <Route path="/warranty" element={<Warranty />} />
        <Route path="/technology" element={<Technology />} />
        <Route path="/about" element={<About />} />
        <Route path="/support" element={<Support />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />

        {/* Unified Authenticated CRM & Discreet Staff Portal */}
        <Route path="/staff" element={<CrmApp />} />
        <Route path="/crm" element={<CrmApp />} />
        <Route path="/crm/*" element={<CrmApp />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

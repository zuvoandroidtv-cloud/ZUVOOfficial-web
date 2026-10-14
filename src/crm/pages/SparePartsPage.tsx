import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  Package,
  Search,
  Plus,
  Tv,
  CheckCircle,
  AlertTriangle,
  Layers,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { exportToCSV, exportToExcel } from '../utils/exportUtils';
import { Pagination } from '../components/common/Pagination';

export const SparePartsPage: React.FC = () => {
  const { currentRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'catalog' | 'compatibility' | 'consumption'>('catalog');
  const [parts, setParts] = useState<any[]>([]);
  const [stockSummary, setStockSummary] = useState<any[]>([]);
  const [compatibilities, setCompatibilities] = useState<any[]>([]);
  const [consumptions, setConsumptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);

  const fetchPartsData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (activeTab === 'catalog') {
        const [partsRes, stockRes] = await Promise.all([
          supabase.from('spare_parts').select('*').order('part_code', { ascending: true }),
          supabase.from('spare_parts_stock_summary').select('*')
        ]);
        setParts(partsRes.data || []);
        setStockSummary(stockRes.data || []);
      } else if (activeTab === 'compatibility') {
        const { data, error } = await supabase
          .from('spare_part_compatibility')
          .select(`
            *,
            spare_parts(part_code, part_name, category),
            product_variants(product_name, product_code, screen_size)
          `)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setCompatibilities(data || []);
      } else if (activeTab === 'consumption') {
        const { data, error } = await supabase
          .from('spare_parts_consumption')
          .select('*')
          .order('total_quantity_used', { ascending: false });
        if (error) throw error;
        setConsumptions(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching spare parts data:', err);
      setErrorMsg(err.message || 'Failed to fetch spare parts data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartsData();
  }, [activeTab, searchQuery]);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      if (activeTab === 'catalog') {
        const rows = parts.map((p) => {
          const stock = stockSummary.find((s) => s.spare_part_id === p.id);
          return {
            part_code: p.part_code,
            part_name: p.part_name,
            category: p.category,
            standard_cost: p.standard_cost,
            selling_price: p.selling_price,
            available_stock: stock?.total_quantity_available ?? 0,
            unit_of_measure: p.unit_of_measure,
            stock_health_status: stock?.stock_health_status || 'Adequate',
            is_active: p.is_active ? 'Active' : 'Inactive'
          };
        });
        const headers = [
          { key: 'part_code', label: 'Part Code' },
          { key: 'part_name', label: 'Part Name' },
          { key: 'category', label: 'Category' },
          { key: 'standard_cost', label: 'Standard Cost (INR)' },
          { key: 'selling_price', label: 'Selling Price (INR)' },
          { key: 'available_stock', label: 'Available Stock' },
          { key: 'unit_of_measure', label: 'Unit' },
          { key: 'stock_health_status', label: 'Stock Health' },
          { key: 'is_active', label: 'Status' }
        ];
        const filename = `zuvo_spare_parts_catalog_${new Date().toISOString().slice(0, 10)}`;
        if (format === 'csv') exportToCSV(rows, headers, filename);
        else await exportToExcel(rows, headers, filename, 'Parts Catalog');
      } else if (activeTab === 'compatibility') {
        const rows = compatibilities.map((c) => ({
          part_code: c.spare_parts?.part_code || '',
          part_name: c.spare_parts?.part_name || '',
          category: c.spare_parts?.category || '',
          product_name: c.product_variants?.product_name || '',
          screen_size: c.product_variants?.screen_size || '',
          notes: c.notes || 'Verified factory fit'
        }));
        const headers = [
          { key: 'part_code', label: 'Part Code' },
          { key: 'part_name', label: 'Spare Part Name' },
          { key: 'category', label: 'Category' },
          { key: 'product_name', label: 'Compatible TV Variant' },
          { key: 'screen_size', label: 'Screen Size (inch)' },
          { key: 'notes', label: 'Compatibility Notes' }
        ];
        const filename = `zuvo_part_compatibility_${new Date().toISOString().slice(0, 10)}`;
        if (format === 'csv') exportToCSV(rows, headers, filename);
        else await exportToExcel(rows, headers, filename, 'TV Compatibility');
      } else if (activeTab === 'consumption') {
        const rows = consumptions.map((cs) => ({
          part_code: cs.part_code,
          part_name: cs.part_name,
          category: cs.category,
          total_quantity_used: cs.total_quantity_used,
          usage_count: cs.usage_count,
          warranty_covered_cost: cs.warranty_covered_cost,
          chargeable_cost: cs.chargeable_cost,
          total_cost: cs.total_cost
        }));
        const headers = [
          { key: 'part_code', label: 'Part Code' },
          { key: 'part_name', label: 'Part Name' },
          { key: 'category', label: 'Category' },
          { key: 'total_quantity_used', label: 'Quantity Used' },
          { key: 'usage_count', label: 'Repairs Count' },
          { key: 'warranty_covered_cost', label: 'Warranty Covered Cost (INR)' },
          { key: 'chargeable_cost', label: 'Chargeable Cost (INR)' },
          { key: 'total_cost', label: 'Total Cost (INR)' }
        ];
        const filename = `zuvo_rma_parts_consumption_${new Date().toISOString().slice(0, 10)}`;
        if (format === 'csv') exportToCSV(rows, headers, filename);
        else await exportToExcel(rows, headers, filename, 'RMA Consumption');
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="module-container">
      {/* Top Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="title-md" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package style={{ color: 'var(--brand-primary)' }} /> Spare Parts & Components
          </h1>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            Hardware catalog, variant cross-compatibility, buffer stock levels & RMA replacement analytics
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => handleExport('csv')}
            disabled={exporting || loading}
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => handleExport('xlsx')}
            disabled={exporting || loading}
          >
            <FileSpreadsheet size={15} /> Export Excel
          </button>
          <button
            className={`btn ${activeTab === 'catalog' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('catalog')}
          >
            Catalog & Stock
          </button>
          <button
            className={`btn ${activeTab === 'compatibility' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('compatibility')}
          >
            <Tv size={15} /> TV Compatibility
          </button>
          <button
            className={`btn ${activeTab === 'consumption' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('consumption')}
          >
            <TrendingDown size={15} /> RMA Consumption
          </button>
        </div>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="card" style={{ borderColor: 'var(--status-danger)', background: 'rgba(239, 68, 68, 0.05)', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <AlertCircle style={{ color: 'var(--status-danger)' }} />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--status-danger)' }}>Error loading spare parts data</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{errorMsg}</div>
          </div>
        </div>
      )}

      {/* TAB 1: Parts Catalog & Stock */}
      {activeTab === 'catalog' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Part Code</th>
                  <th>Part Name</th>
                  <th>Category</th>
                  <th>Std Cost</th>
                  <th>Selling Price</th>
                  <th>Available Stock</th>
                  <th>Health Status</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                      <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--brand-primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
                      <p className="text-muted">Loading spare parts catalog...</p>
                    </td>
                  </tr>
                ) : parts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3.5rem' }}>
                      <Package size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                      <p className="text-muted">No spare parts in catalog.</p>
                    </td>
                  </tr>
                ) : (
                  parts.map((p) => {
                    const stock = stockSummary.find((s) => s.spare_part_id === p.id);
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="badge badge-neutral" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {p.part_code}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{p.part_name}</td>
                        <td>
                          <span className="badge badge-primary" style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                            {p.category}
                          </span>
                        </td>
                        <td>₹{p.standard_cost?.toLocaleString()}</td>
                        <td style={{ fontWeight: 600 }}>₹{p.selling_price?.toLocaleString()}</td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
                            {stock?.total_quantity_available ?? 0}
                          </span>
                          <span className="text-muted" style={{ fontSize: '0.75rem', marginLeft: '0.25rem' }}>
                            {p.unit_of_measure}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${stock?.stock_health_status === 'healthy' ? 'badge-success' : 'badge-warning'}`}>
                            {stock?.stock_health_status || 'Adequate'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${p.is_active ? 'badge-success' : 'badge-danger'}`}>
                            {p.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Compatibility Matrix */}
      {activeTab === 'compatibility' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Hardware Cross-Compatibility Mapping</h3>
            <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
              Maps genuine ZUVO spare parts to approved TV model variants for RMA servicing
            </p>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Spare Part</th>
                  <th>Category</th>
                  <th>Compatible TV Variant</th>
                  <th>Screen Size</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>
                      <p className="text-muted">Loading compatibility matrix...</p>
                    </td>
                  </tr>
                ) : compatibilities.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem' }}>
                      <p className="text-muted">No compatibility rules defined.</p>
                    </td>
                  </tr>
                ) : (
                  compatibilities.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.spare_parts?.part_name}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {c.spare_parts?.part_code}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ textTransform: 'uppercase' }}>
                          {c.spare_parts?.category}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {c.product_variants?.product_name}
                      </td>
                      <td>{c.product_variants?.screen_size}"</td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        {c.notes || 'Verified factory fit'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RMA Consumption (spare_parts_consumption) */}
      {activeTab === 'consumption' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Spare Parts Service Consumption</h3>
            <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
              Historical consumption across RMA repairs with warranty vs chargeable cost distribution
            </p>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Part Code</th>
                  <th>Part Name</th>
                  <th>Category</th>
                  <th>Qty Used</th>
                  <th>Repairs Count</th>
                  <th>Warranty Cost</th>
                  <th>Chargeable Cost</th>
                  <th>Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                      <p className="text-muted">Loading consumption metrics...</p>
                    </td>
                  </tr>
                ) : consumptions.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                      <Package size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 0.5rem', opacity: 0.5 }} />
                      <p className="text-muted">Zero spare parts consumed yet in service repairs.</p>
                    </td>
                  </tr>
                ) : (
                  consumptions.map((cs, idx) => (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{cs.part_code}</td>
                      <td style={{ fontWeight: 600 }}>{cs.part_name}</td>
                      <td>
                        <span className="badge badge-neutral" style={{ textTransform: 'uppercase' }}>
                          {cs.category}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>{cs.total_quantity_used}</td>
                      <td>{cs.usage_count}</td>
                      <td style={{ color: 'var(--status-success)' }}>₹{cs.warranty_covered_cost?.toLocaleString()}</td>
                      <td style={{ color: 'var(--brand-accent)' }}>₹{cs.chargeable_cost?.toLocaleString()}</td>
                      <td style={{ fontWeight: 700 }}>₹{cs.total_cost?.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalCount?: number;
  totalRecords?: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalCount,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100]
}) => {
  const effectiveTotal = totalCount ?? totalRecords ?? 0;
  const totalPages = Math.ceil(effectiveTotal / pageSize) || 1;
  const startItem = effectiveTotal === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, effectiveTotal);

  if (effectiveTotal === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.875rem 1rem',
        borderTop: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        gap: '1rem',
        fontSize: '0.85rem'
      }}
    >
      {/* Items count summary */}
      <div style={{ color: 'var(--text-secondary)' }}>
        Showing <strong style={{ color: 'var(--text-primary)' }}>{startItem}</strong> - <strong style={{ color: 'var(--text-primary)' }}>{endItem}</strong> of <strong style={{ color: 'var(--brand-primary)' }}>{effectiveTotal}</strong> records
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Page size selector */}
        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="text-muted">Per page:</span>
            <select
              className="input-field"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', height: '32px' }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt} style={{ background: '#111827' }}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Page Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            title="First Page"
            style={{ padding: '0.25rem 0.5rem' }}
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            title="Previous Page"
            style={{ padding: '0.25rem 0.5rem' }}
          >
            <ChevronLeft size={16} />
          </button>

          <span style={{ margin: '0 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Page {currentPage} of {totalPages}
          </span>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="Next Page"
            style={{ padding: '0.25rem 0.5rem' }}
          >
            <ChevronRight size={16} />
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            title="Last Page"
            style={{ padding: '0.25rem 0.5rem' }}
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

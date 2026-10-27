import React from 'react';
import { X, Filter, RotateCcw, Check } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterField {
  id: string;
  label: string;
  type: 'select' | 'text' | 'date';
  options?: FilterOption[];
  placeholder?: string;
}

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  onApply: () => void;
  onClear: () => void;
  activeFilterCount?: number;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  title = 'Filter Records',
  fields,
  values,
  onChange,
  onApply,
  onClear,
  activeFilterCount = 0
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="filter-drawer-backdrop" onClick={onClose} />

      {/* Slide-in Left to Right Drawer Panel */}
      <div className="filter-drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="filter-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: 'rgba(6, 182, 212, 0.15)', padding: '6px', borderRadius: '6px' }}>
              <Filter size={16} style={{ color: 'var(--accent-cyan)' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{title}</h3>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                {activeFilterCount > 0 ? `${activeFilterCount} active filters applied` : 'Refine operational results'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 8px', border: 'none', background: 'transparent' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Body with Contextual Inputs */}
        <div className="filter-drawer-body">
          {fields.map((field) => (
            <div key={field.id} className="input-group">
              <label className="input-label">{field.label}</label>
              {field.type === 'select' ? (
                <select
                  className="form-input"
                  value={values[field.id] || ''}
                  onChange={(e) => onChange(field.id, e.target.value)}
                >
                  <option value="">All {field.label}s</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value} style={{ background: '#111827' }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'date' ? (
                <input
                  type="date"
                  className="form-input"
                  value={values[field.id] || ''}
                  onChange={(e) => onChange(field.id, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  className="form-input"
                  placeholder={field.placeholder || `Filter by ${field.label.toLowerCase()}...`}
                  value={values[field.id] || ''}
                  onChange={(e) => onChange(field.id, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        {/* Drawer Footer with Clear All & Apply */}
        <div className="filter-drawer-footer">
          <button
            type="button"
            onClick={onClear}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={13} /> Clear All
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onApply();
                onClose();
              }}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Check size={14} /> Apply Filters
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

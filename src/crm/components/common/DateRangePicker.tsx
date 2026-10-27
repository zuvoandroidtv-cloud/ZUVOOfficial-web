import React from 'react';
import { Calendar, X } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClearDateRange: () => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClearDateRange
}) => {
  const setPreset = (preset: 'today' | '7days' | '30days' | 'month') => {
    const end = new Date();
    const start = new Date();

    if (preset === 'today') {
      // today
    } else if (preset === '7days') {
      start.setDate(end.getDate() - 7);
    } else if (preset === '30days') {
      start.setDate(end.getDate() - 30);
    } else if (preset === 'month') {
      start.setDate(1);
    }

    onStartDateChange(start.toISOString().slice(0, 10));
    onEndDateChange(end.toISOString().slice(0, 10));
  };

  const hasFilter = Boolean(startDate || endDate);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', maxWidth: '100%' }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        background: 'var(--bg-card, #151824)',
        border: '1px solid var(--border-card, #1f2438)',
        borderRadius: '10px',
        padding: '6px 12px',
        height: '40px',
        boxSizing: 'border-box'
      }}>
        <Calendar size={15} style={{ color: 'var(--accent-cyan, #06b6d4)', flexShrink: 0 }} />
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          aria-label="Start date"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#ffffff',
            fontSize: '0.85rem',
            fontFamily: 'inherit',
            width: '125px',
            colorScheme: 'dark',
            cursor: 'pointer'
          }}
        />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #64748b)', padding: '0 2px' }}>to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          aria-label="End date"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#ffffff',
            fontSize: '0.85rem',
            fontFamily: 'inherit',
            width: '125px',
            colorScheme: 'dark',
            cursor: 'pointer'
          }}
        />
        {hasFilter && (
          <button
            type="button"
            onClick={onClearDateRange}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '0.25rem'
            }}
            title="Clear date range"
          >
            <X size={12} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setPreset('today')}
          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
        >
          Today
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setPreset('7days')}
          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
        >
          Last 7D
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setPreset('30days')}
          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
        >
          Last 30D
        </button>
      </div>
    </div>
  );
};

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.25rem 0.625rem', flexWrap: 'wrap', maxWidth: '100%' }}>
        <Calendar size={15} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8125rem', fontFamily: 'inherit', minWidth: '110px', flex: 1 }}
        />
        <span className="text-muted" style={{ fontSize: '0.75rem' }}>to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8125rem', fontFamily: 'inherit', minWidth: '110px', flex: 1 }}
        />
        {hasFilter && (
          <button
            type="button"
            onClick={onClearDateRange}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '0.25rem' }}
            title="Clear date range"
          >
            <X size={14} />
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

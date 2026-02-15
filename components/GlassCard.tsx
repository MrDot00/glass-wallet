
import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', title }) => {
  return (
    <div className={`glass rounded-3xl p-6 shadow-2xl transition-all duration-300 glass-hover ${className}`}>
      {title && <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">{title}</h3>}
      {children}
    </div>
  );
};

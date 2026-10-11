import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from './Badge';

export interface SectionHeadingProps {
  badge?: string;
  title: string;
  highlightTitle?: string;
  subtitle?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  badge,
  title,
  highlightTitle,
  subtitle,
  className = '',
  as = 'h2',
}) => {
  const HeadingTag = as === 'h1' ? motion.h1 : as === 'h3' ? motion.h3 : motion.h2;

  return (
    <div className={`flex flex-col text-center items-center justify-center max-w-3xl mx-auto mb-16 ${className}`}>
      {badge && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <Badge>{badge}</Badge>
        </motion.div>
      )}
      <HeadingTag
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="text-3xl md:text-5xl font-extrabold tracking-tight text-white uppercase leading-tight text-center"
      >
        {title}{' '}
        {highlightTitle && <span className="text-zuvo-gradient">{highlightTitle}</span>}
      </HeadingTag>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-4 text-neutral-400 text-base md:text-lg font-normal leading-relaxed text-center"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
};

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface LightBeamButtonProps {
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function LightBeamButton({ href, onClick, children, className = '', style }: LightBeamButtonProps) {
  const content = (
    <>
      {/* Shining beam overlay on hover */}
      <span className="absolute inset-0 bg-[linear-gradient(to_right,transparent_20%,rgba(255,255,255,0.2)_50%,transparent_80%)] translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-out" />
      {/* Glow transition */}
      <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-[0_0_30px_rgba(139, 92, 246, 0.5)] pointer-events-none" />
      
      <span className="relative z-10 flex items-center gap-2">
        {children}
      </span>
    </>
  );

  const baseClass = `relative inline-flex items-center justify-center px-8 rounded-full text-sm font-bold text-white transition-all duration-300 overflow-hidden group hover:scale-[1.02] cursor-pointer ${className}`;
  const baseStyle = {
    height: '52px',
    background: 'linear-gradient(135deg, #8B5CF6, #6366F1, #8B5CF6)',
    backgroundSize: '200% auto',
    boxShadow: '0 0 20px rgba(139, 92, 246, 0.25)',
    ...style,
  };

  if (href) {
    return (
      <motion.div
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        className="inline-block"
      >
        <Link href={href} onClick={onClick} className={baseClass} style={baseStyle}>
          {content}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className={baseClass}
      style={baseStyle}
    >
      {content}
    </motion.button>
  );
}

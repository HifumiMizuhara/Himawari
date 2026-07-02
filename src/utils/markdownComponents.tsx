import React from 'react';
import { sanitizeHref } from './safeUrl';

export const SafeMarkdownLink: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement>> = ({
  href,
  children,
  ...props
}) => {
  const safeHref = sanitizeHref(href);
  if (!safeHref) {
    return <span className="text-gray-500 dark:text-gray-400">{children}</span>;
  }
  return (
    <a href={safeHref} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  );
};

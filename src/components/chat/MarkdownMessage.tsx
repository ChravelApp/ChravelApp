import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink } from 'lucide-react';

interface MarkdownMessageProps {
  content: string;
}

export const MarkdownMessage = ({ content }: MarkdownMessageProps) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2 inline-flex items-center gap-1"
          >
            {children}
            <ExternalLink size={10} className="inline flex-shrink-0" />
          </a>
        ),
        strong: ({ children }) => (
          <strong className="text-white font-semibold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="text-slate-300 italic">{children}</em>
        ),
        h1: ({ children }) => (
          <h1 className="text-lg font-bold text-white mt-3 mb-1">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold text-white mt-3 mb-1">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-bold text-white mt-2 mb-1">{children}</h3>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-outside ml-4 space-y-0.5 text-sm">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside ml-4 space-y-0.5 text-sm">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-slate-300">{children}</li>
        ),
        p: ({ children }) => (
          <p className="text-sm text-slate-300 mb-2 last:mb-0">{children}</p>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-blue-500/50 pl-3 my-2 text-slate-400 italic">
            {children}
          </blockquote>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-slate-700/50 text-blue-300 px-1.5 py-0.5 rounded text-xs">
                {children}
              </code>
            );
          }
          return (
            <code className="block bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 text-xs text-slate-300 overflow-x-auto my-2">
              {children}
            </code>
          );
        },
        hr: () => <hr className="border-slate-700/50 my-3" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

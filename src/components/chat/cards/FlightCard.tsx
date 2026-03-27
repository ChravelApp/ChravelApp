import React from 'react';
import { Plane, ExternalLink } from 'lucide-react';

interface FlightCardProps {
  title: string;
  url: string;
  snippet?: string;
  metadata?: Record<string, string>;
}

export const FlightCard = ({ title, url, snippet, metadata }: FlightCardProps) => {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden hover:border-blue-500/40 transition-colors group"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Plane size={20} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-medium text-sm truncate group-hover:text-blue-300 transition-colors">
              {title}
            </h4>
            {snippet && (
              <p className="text-slate-400 text-xs mt-1 line-clamp-2">{snippet}</p>
            )}
            {metadata?.price && (
              <p className="text-green-400 text-sm font-medium mt-2">{metadata.price}</p>
            )}
            {metadata?.route && (
              <p className="text-slate-500 text-xs mt-1">{metadata.route}</p>
            )}
          </div>
          <ExternalLink size={14} className="text-slate-500 group-hover:text-blue-400 flex-shrink-0 mt-1" />
        </div>
      </div>
    </a>
  );
};

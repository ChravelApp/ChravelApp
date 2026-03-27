import React from 'react';
import { Building2, Star, ExternalLink } from 'lucide-react';

interface HotelCardProps {
  title: string;
  url: string;
  imageUrl?: string;
  snippet?: string;
  metadata?: Record<string, string>;
}

export const HotelCard = ({ title, url, imageUrl, snippet, metadata }: HotelCardProps) => {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden hover:border-purple-500/40 transition-colors group"
    >
      <div className="flex">
        {imageUrl ? (
          <div className="w-24 h-24 flex-shrink-0">
            <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-24 h-24 bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <Building2 size={28} className="text-purple-400" />
          </div>
        )}
        <div className="flex-1 p-3 min-w-0">
          <h4 className="text-white font-medium text-sm truncate group-hover:text-purple-300 transition-colors">
            {title}
          </h4>
          {metadata?.rating && (
            <div className="flex items-center gap-1 mt-1">
              <Star size={12} className="text-yellow-400 fill-yellow-400" />
              <span className="text-yellow-400 text-xs">{metadata.rating}</span>
            </div>
          )}
          {snippet && (
            <p className="text-slate-400 text-xs mt-1 line-clamp-2">{snippet}</p>
          )}
          {metadata?.price && (
            <p className="text-green-400 text-sm font-medium mt-1">{metadata.price}</p>
          )}
        </div>
        <ExternalLink size={14} className="text-slate-500 group-hover:text-purple-400 flex-shrink-0 m-3" />
      </div>
    </a>
  );
};

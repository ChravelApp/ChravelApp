import React from 'react';
import { MapPin, Star, ExternalLink } from 'lucide-react';

interface PlaceCardProps {
  title: string;
  url: string;
  imageUrl?: string;
  snippet?: string;
  metadata?: Record<string, string>;
}

export const PlaceCard = ({ title, url, imageUrl, snippet, metadata }: PlaceCardProps) => {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden hover:border-orange-500/40 transition-colors group"
    >
      <div className="flex">
        {imageUrl ? (
          <div className="w-24 h-24 flex-shrink-0">
            <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-24 h-24 bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <MapPin size={28} className="text-orange-400" />
          </div>
        )}
        <div className="flex-1 p-3 min-w-0">
          <h4 className="text-white font-medium text-sm truncate group-hover:text-orange-300 transition-colors">
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
          {metadata?.cuisine && (
            <span className="inline-block bg-orange-500/20 text-orange-300 text-xs px-2 py-0.5 rounded-full mt-1">
              {metadata.cuisine}
            </span>
          )}
        </div>
        <ExternalLink size={14} className="text-slate-500 group-hover:text-orange-400 flex-shrink-0 m-3" />
      </div>
    </a>
  );
};

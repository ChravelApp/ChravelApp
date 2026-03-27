
import React from 'react';
import { MessageCircle, WifiOff } from 'lucide-react';
import { ChatMessage, GroundingCard } from './types';
import { MarkdownMessage } from './MarkdownMessage';
import { FlightCard, HotelCard, PlaceCard } from './cards';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isTyping: boolean;
}

function classifyCard(card: GroundingCard): GroundingCard {
  if (card.type !== 'link') return card;

  const urlLower = card.url.toLowerCase();
  const titleLower = card.title.toLowerCase();

  if (urlLower.includes('google.com/travel/flights') || urlLower.includes('flights.google') ||
      titleLower.includes('flight') || titleLower.includes('airline')) {
    return { ...card, type: 'flight' };
  }
  if (urlLower.includes('google.com/travel/hotels') || urlLower.includes('hotels.google') ||
      urlLower.includes('booking.com') || urlLower.includes('marriott') || urlLower.includes('hilton') ||
      titleLower.includes('hotel') || titleLower.includes('resort') || titleLower.includes('inn')) {
    return { ...card, type: 'hotel' };
  }
  if (urlLower.includes('google.com/maps') || urlLower.includes('yelp.com') ||
      urlLower.includes('tripadvisor') || titleLower.includes('restaurant') ||
      titleLower.includes('dining') || titleLower.includes('cafe')) {
    return { ...card, type: 'place' };
  }

  return card;
}

function renderGroundingCard(card: GroundingCard, index: number) {
  const classified = classifyCard(card);

  switch (classified.type) {
    case 'flight':
      return <FlightCard key={index} title={classified.title} url={classified.url} snippet={classified.snippet} metadata={classified.metadata} />;
    case 'hotel':
      return <HotelCard key={index} title={classified.title} url={classified.url} imageUrl={classified.imageUrl} snippet={classified.snippet} metadata={classified.metadata} />;
    case 'place':
      return <PlaceCard key={index} title={classified.title} url={classified.url} imageUrl={classified.imageUrl} snippet={classified.snippet} metadata={classified.metadata} />;
    default:
      return (
        <a
          key={index}
          href={classified.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 hover:border-slate-600/50 transition-colors"
        >
          <h4 className="text-white text-sm font-medium truncate">{classified.title}</h4>
          {classified.snippet && <p className="text-slate-400 text-xs mt-1 line-clamp-2">{classified.snippet}</p>}
        </a>
      );
  }
}

export const ChatMessages = ({ messages, isTyping }: ChatMessagesProps) => {
  if (messages.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageCircle size={48} className="text-gray-600 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-gray-400 mb-2">Start planning with AI</h4>
        <p className="text-gray-500 text-sm">Ask me about restaurants, activities, or anything about your trip!</p>
      </div>
    );
  }

  return (
    <>
      {messages.map((message) => (
        <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
            message.type === 'user'
              ? 'bg-gray-800 text-white'
              : `${message.isFromFallback ? 'bg-yellow-900/20 border border-yellow-500/30' : 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/20'} text-gray-300`
          }`}>
            {message.type === 'user' ? (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            ) : (
              <MarkdownMessage content={message.content} />
            )}
            {message.isFromFallback && (
              <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1">
                <WifiOff size={10} />
                Limited response
              </p>
            )}
            {message.groundingCards && message.groundingCards.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.groundingCards.map((card, index) => renderGroundingCard(card, index))}
              </div>
            )}
          </div>
        </div>
      ))}
      {isTyping && (
        <div className="flex justify-start">
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl p-4 border border-blue-500/20">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

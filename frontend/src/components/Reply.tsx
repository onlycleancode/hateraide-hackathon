import React from 'react';
import { Reply as ReplyType } from '../types';

interface ReplyProps {
  reply: ReplyType;
}

const Reply: React.FC<ReplyProps> = ({ reply }) => {
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'harmful':
        return 'border-l-red-500 bg-red-50';
      case 'unfriendly':
        return 'border-l-orange-400 bg-orange-50';
      case 'friendly':
        return 'border-l-green-500 bg-green-50';
      case 'in-jest':
        return 'border-l-blue-500 bg-blue-50';
      default:
        return 'border-l-gray-300 bg-gray-50';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'harmful':
        return '⚠️';
      case 'unfriendly':
        return '😐';
      case 'friendly':
        return '😊';
      case 'in-jest':
        return '😄';
      default:
        return '❓';
    }
  };

  if (reply.hidden) {
    return (
      <div className="border-l-4 border-l-gray-400 bg-gray-100 p-3 rounded-r-lg">
        <div className="flex items-center justify-between">
          <span className="text-gray-600 text-sm italic">Comment hidden due to content policy</span>
          <button className="text-xs text-blue-600 hover:underline">Show</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`border-l-4 p-3 rounded-r-lg ${getSentimentColor(reply.sentiment)}`}>
      <div className="flex items-start space-x-3">
        <img 
          src={reply.author.avatar} 
          alt={reply.author.name}
          className="w-8 h-8 rounded-full flex-shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/32x32/9CA3AF/FFFFFF?text=U';
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <h5 className="font-medium text-gray-900 flex items-center">
              {reply.author.name}
              {reply.author.important && (
                <span className="ml-1 text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                  Notable
                </span>
              )}
            </h5>
            <span className="text-xs text-gray-500">{reply.language.toUpperCase()}</span>
            <span className="text-sm" title={`Sentiment: ${reply.sentiment}`}>
              {getSentimentIcon(reply.sentiment)}
            </span>
          </div>
          
          {reply.type === 'text' && (
            <p className="text-gray-700 text-sm">{reply.content}</p>
          )}
          
          {reply.type === 'image' && reply.media_url && (
            <div>
              {reply.content && <p className="text-gray-700 text-sm mb-2">{reply.content}</p>}
              <img 
                src={reply.media_url} 
                alt="Reply image"
                className="rounded max-w-xs h-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x150/E5E7EB/6B7280?text=Image+Not+Found';
                }}
              />
            </div>
          )}
          
          {reply.type === 'gif' && reply.media_url && (
            <img 
              src={reply.media_url} 
              alt="GIF reply"
              className="rounded max-w-xs h-auto"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x150/E5E7EB/6B7280?text=GIF+Not+Found';
              }}
            />
          )}

          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
            <button className="hover:text-red-500">Like</button>
            <button className="hover:text-blue-500">Reply</button>
            {reply.sentiment === 'harmful' && (
              <button className="hover:text-gray-700">Hide</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reply;
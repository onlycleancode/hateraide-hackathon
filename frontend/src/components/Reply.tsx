import React, { useState, useEffect } from 'react';
import type { Reply as ReplyType } from '../types';
import { wsService, type ModerationUpdate, type ModerationAction } from '../services/websocket';

interface ReplyProps {
  reply: ReplyType;
  replyAnalysisData?: any; // Analysis data for sentiment detection
}

const Reply: React.FC<ReplyProps> = ({ reply, replyAnalysisData }) => {
  const [moderationAction, setModerationAction] = useState<ModerationAction | null>(null);
  const [isContentRevealed, setIsContentRevealed] = useState(false);
  const [isMediaRevealed, setIsMediaRevealed] = useState(false);
  
  useEffect(() => {
    // Subscribe to moderation updates for this specific reply
    const subscriptionId = `reply-${reply.id}`;
    wsService.subscribe(subscriptionId, (update: ModerationUpdate) => {
      if (update.action.reply_id === reply.id) {
        setModerationAction(update.action);
        setIsContentRevealed(false);
        setIsMediaRevealed(false);
      }
    });
    
    return () => {
      wsService.unsubscribe(subscriptionId);
    };
  }, [reply.id]);
  // Helper function to get sentiment from analysis data
  const getReplySentiment = (replyId: string) => {
    if (!replyAnalysisData?.reply_analyzer_results?.reply_analyses) return 'unknown';
    
    const replyAnalysis = replyAnalysisData.reply_analyzer_results.reply_analyses.find(
      (analysis: any) => analysis.reply_id === replyId
    );
    
    return replyAnalysis?.analysis_result?.sentiment || 'unknown';
  };

  // Helper function to check if author is important
  const isNotableUser = (replyId: string) => {
    if (!replyAnalysisData?.reply_analyzer_results?.reply_analyses) return false;
    
    const replyAnalysis = replyAnalysisData.reply_analyzer_results.reply_analyses.find(
      (analysis: any) => analysis.reply_id === replyId
    );
    
    return replyAnalysis?.analysis_result?.author_important || false;
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'harmful':
        return 'border-l-red-500 bg-red-50';
      case 'unfriendly':
        return 'border-l-orange-400 bg-orange-50';
      case 'friendly':
        return 'border-l-green-500 bg-green-50';
      case 'silly':
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
      case 'silly':
        return '😄';
      default:
        return '❓';
    }
  };

  // Check if content should be moderated based on sentiment data (instant) or real-time updates
  const sentiment = getReplySentiment(reply.id);
  const shouldModerate = moderationAction || (sentiment === 'harmful' || sentiment === 'unfriendly');
  const moderationType = moderationAction?.action_type || (sentiment === 'harmful' ? 'hide' : sentiment === 'unfriendly' ? 'blur' : null);
  
  // Generate moderation reason from sentiment if no real-time action
  const moderationReason = moderationAction?.reason || 
    (sentiment === 'harmful' ? 'This content contains harmful or hateful language' : 
     sentiment === 'unfriendly' ? 'This content may be negative or dismissive' : '');
  
  if (reply.hidden || (moderationType === 'hide' && !isContentRevealed)) {
    return (
      <div className="border-l-4 border-l-red-500 bg-red-50 p-3 rounded-r-lg">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-red-700 text-sm font-medium flex items-center gap-2">
              ⚠️ Content hidden - {moderationAction?.sentiment || sentiment || 'harmful'} content detected
            </span>
            {moderationReason && (
              <p className="text-xs text-red-600 mt-1">{moderationReason}</p>
            )}
          </div>
          <button 
            onClick={() => {
              if (confirm('This content has been flagged as harmful. Are you sure you want to view it?')) {
                setIsContentRevealed(true);
              }
            }}
            className="text-xs text-red-600 hover:underline font-medium"
          >
            Show anyway
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`border-l-4 p-3 rounded-r-lg ${getSentimentColor(getReplySentiment(reply.id))}`}>
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
              {isNotableUser(reply.id) && (
                <span className="ml-1 text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                  Notable
                </span>
              )}
            </h5>
            <span className="text-xs text-gray-500">{reply.language.toUpperCase()}</span>
            <span className="text-sm" title={`Sentiment: ${getReplySentiment(reply.id)}`}>
              {getSentimentIcon(getReplySentiment(reply.id))}
            </span>
          </div>
          
          {reply.type === 'text' && (
            <div className="relative">
              {moderationType === 'blur' && !isContentRevealed ? (
                <div 
                  className="cursor-pointer relative"
                  onClick={() => setIsContentRevealed(true)}
                >
                  <p className="text-gray-700 text-sm blur-sm select-none">{reply.content}</p>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-white/90 px-2 py-1 rounded text-xs font-medium text-orange-600">
                      😐 Unfriendly - Click to reveal
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-700 text-sm">{reply.content}</p>
              )}
            </div>
          )}
          
          {reply.type === 'image' && reply.media_url && (
            <div>
              {reply.content && (
                <div className="relative mb-2">
                  {moderationType === 'blur' && !isContentRevealed ? (
                    <div 
                      className="cursor-pointer relative"
                      onClick={() => setIsContentRevealed(true)}
                    >
                      <p className="text-gray-700 text-sm blur-sm select-none">{reply.content}</p>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="bg-white/90 px-2 py-1 rounded text-xs font-medium text-orange-600">
                          😐 Click to reveal
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-700 text-sm">{reply.content}</p>
                  )}
                </div>
              )}
              {moderationType && !isMediaRevealed ? (
                <div 
                  className="relative inline-block cursor-pointer"
                  onClick={() => {
                    if (moderationType === 'hide') {
                      if (confirm('This media has been flagged as harmful. Are you sure you want to view it?')) {
                        setIsMediaRevealed(true);
                      }
                    } else {
                      setIsMediaRevealed(true);
                    }
                  }}
                >
                  {moderationType === 'hide' ? (
                    <div className="w-48 h-32 bg-gray-900 rounded flex items-center justify-center text-white">
                      <div className="text-center">
                        <div className="text-lg mb-1">⚠️</div>
                        <div className="text-xs font-medium">Media Hidden</div>
                        <div className="text-xs opacity-75">Harmful Content</div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <img 
                        src={reply.media_url} 
                        alt="Reply image"
                        className="rounded max-w-xs h-auto blur-md"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x150/E5E7EB/6B7280?text=Image+Not+Found';
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="bg-white/90 px-3 py-1 rounded text-sm font-medium text-orange-600">
                          😐 Unfriendly
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <img 
                  src={reply.media_url} 
                  alt="Reply image"
                  className="rounded max-w-xs h-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x150/E5E7EB/6B7280?text=Image+Not+Found';
                  }}
                />
              )}
            </div>
          )}
          
          {reply.type === 'gif' && reply.media_url && (
            moderationType && !isMediaRevealed ? (
              <div 
                className="relative inline-block cursor-pointer"
                onClick={() => {
                  if (moderationType === 'hide') {
                    if (confirm('This GIF has been flagged as harmful. Are you sure you want to view it?')) {
                      setIsMediaRevealed(true);
                    }
                  } else {
                    setIsMediaRevealed(true);
                  }
                }}
              >
                {moderationType === 'hide' ? (
                  <div className="w-48 h-32 bg-gray-900 rounded flex items-center justify-center text-white">
                    <div className="text-center">
                      <div className="text-lg mb-1">⚠️</div>
                      <div className="text-xs font-medium">GIF Hidden</div>
                      <div className="text-xs opacity-75">Harmful Content</div>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <img 
                      src={reply.media_url} 
                      alt="GIF reply"
                      className="rounded max-w-xs h-auto blur-md"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x150/E5E7EB/6B7280?text=GIF+Not+Found';
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="bg-white/90 px-3 py-1 rounded text-sm font-medium text-orange-600">
                        😐 Unfriendly
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <img 
                src={reply.media_url} 
                alt="GIF reply"
                className="rounded max-w-xs h-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x150/E5E7EB/6B7280?text=GIF+Not+Found';
                }}
              />
            )
          )}

          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
            <button className="hover:text-red-500">Like</button>
            <button className="hover:text-blue-500">Reply</button>
            {getReplySentiment(reply.id) === 'harmful' && (
              <button className="hover:text-gray-700">Hide</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reply;
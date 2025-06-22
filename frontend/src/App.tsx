import { useState, useEffect, useCallback } from "react";
import type { Post } from "./types/index";
import { apiService } from "./services/api";
import { wsService, type ModerationUpdate, type ModerationAction } from "./services/websocket";

interface MockData {
  posts: Post[];
}

function HaterAideAnalysis({
  post,
  replyAnalysisResults,
  onBack,
}: {
  post: Post;
  replyAnalysisResults: any;
  onBack: () => void;
}) {
  const [generalSentimentData, setGeneralSentimentData] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [nextStepsData, setNextStepsData] = useState<any>(null);
  const [replyAnalysisData, setReplyAnalysisData] = useState<any>(null);
  const [moderationActions, setModerationActions] = useState<Map<string, ModerationAction>>(new Map());
  const [preloadedModerations, setPreloadedModerations] = useState<Map<string, ModerationAction>>(new Map());
  const [preloadedSuggestions, setPreloadedSuggestions] = useState<Map<string, string>>(new Map());

  // Preload moderation based on existing sentiment data
  useEffect(() => {
    if (replyAnalysisData?.reply_analyzer_results?.reply_analyses) {
      const preloadedActions = new Map<string, ModerationAction>();
      
      replyAnalysisData.reply_analyzer_results.reply_analyses.forEach((analysis: any) => {
        const sentiment = analysis.analysis_result?.sentiment;
        if (sentiment === 'harmful' || sentiment === 'unfriendly') {
          const action: ModerationAction = {
            reply_id: analysis.reply_id,
            action_type: sentiment === 'harmful' ? 'hide' : 'blur',
            reason: `Content flagged as ${sentiment} by AI analysis`,
            sentiment: sentiment,
            timestamp: new Date().toISOString(),
            status: 'applied'
          };
          preloadedActions.set(analysis.reply_id, action);
        }
      });
      
      setPreloadedModerations(preloadedActions);
      console.log(`Preloaded ${preloadedActions.size} moderation actions from existing data`);
    }
  }, [replyAnalysisData]);
  
  // Preload suggested responses based on next steps data
  useEffect(() => {
    if (nextStepsData?.next_step_analysis?.recommended_next_steps) {
      const preloadedResponses = new Map<string, string>();
      
      nextStepsData.next_step_analysis.recommended_next_steps.forEach((action: any) => {
        if (action.reply_id && action.suggested_response) {
          preloadedResponses.set(action.reply_id, action.suggested_response);
        }
      });
      
      setPreloadedSuggestions(preloadedResponses);
    }
  }, [nextStepsData]);
  
  // Set up WebSocket connection and moderation updates
  useEffect(() => {
    // Connect to WebSocket
    wsService.connect();
    
    // Subscribe to moderation updates
    const subscriptionId = 'hateraide-analysis';
    wsService.subscribe(subscriptionId, (update: ModerationUpdate) => {
      console.log('Received moderation update:', update);
      setModerationActions(prev => {
        const newMap = new Map(prev);
        newMap.set(update.action.reply_id, update.action);
        return newMap;
      });
    });
    
    // Load initial moderation status
    fetch('http://localhost:8000/api/moderation-status')
      .then(res => res.json())
      .then(data => {
        if (data.moderation_actions) {
          const actions = new Map<string, ModerationAction>();
          Object.entries(data.moderation_actions).forEach(([replyId, action]) => {
            actions.set(replyId, action as ModerationAction);
          });
          setModerationActions(actions);
        }
      })
      .catch(err => console.error('Failed to load moderation status:', err));
    
    return () => {
      wsService.unsubscribe(subscriptionId);
    };
  }, []);

  // Load analysis data when component mounts AND ensure suggestions are loaded
  useEffect(() => {
    const loadAnalysisData = async () => {
      try {
        // Load all data in parallel
        const [sentimentRes, replyRes, nextStepsRes] = await Promise.all([
          fetch('/general_sentiment_results.json'),
          fetch('/reply_analyzer_results.json'),
          fetch('/next_steps.json')
        ]);

        if (sentimentRes.ok) {
          const sentimentData = await sentimentRes.json();
          setGeneralSentimentData(sentimentData);
        }

        if (replyRes.ok) {
          const replyData = await replyRes.json();
          setReplyAnalysisData(replyData);
        }

        if (nextStepsRes.ok) {
          const nextSteps = await nextStepsRes.json();
          setNextStepsData(nextSteps);
          
          // Immediately populate suggestions map
          if (nextSteps?.next_step_analysis?.recommended_next_steps) {
            const suggestions = new Map<string, string>();
            nextSteps.next_step_analysis.recommended_next_steps.forEach((action: any) => {
              if (action.reply_id && action.suggested_response) {
                suggestions.set(action.reply_id, action.suggested_response);
              }
            });
            setPreloadedSuggestions(suggestions);
          }
        }
      } catch (error) {
        console.error('Failed to load analysis data:', error);
      }
    };

    loadAnalysisData();
  }, []); // Empty array - only run once on mount

  // Helper function to get moderation info for a reply
  const getReplyModerationInfo = (replyId: string) => {
    // First check real-time moderation actions
    const realtimeAction = moderationActions.get(replyId);
    if (realtimeAction) return realtimeAction;
    
    // Then check preloaded moderations from existing data
    const preloadedAction = preloadedModerations.get(replyId);
    if (preloadedAction) return preloadedAction;
    
    // Fallback to analysis results
    if (!replyAnalysisResults?.reply_analyses) return null;

    const replyAnalysis = replyAnalysisResults.reply_analyses.find(
      (analysis: any) => analysis.reply_id === replyId
    );

    const actions = replyAnalysis?.analysis_result?.moderation_actions || [];
    return actions.length > 0 ? actions[0] : null;
  };

  // Helper function to check if content should be blurred/hidden
  const shouldModerateContent = (replyId: string): 'blur' | 'hide' | null => {
    const moderation = getReplyModerationInfo(replyId);
    if (!moderation) return null;
    
    // Check if it's a ModerationAction object
    if ('action_type' in moderation) {
      return moderation.action_type;
    }
    
    return null;
  };

  // Helper function to get reply sentiment
  const getReplySentiment = (replyId: string) => {
    if (!replyAnalysisData?.reply_analyzer_results?.reply_analyses) return null;

    const replyAnalysis = replyAnalysisData.reply_analyzer_results.reply_analyses.find(
      (analysis: any) => analysis.reply_id === replyId
    );

    return replyAnalysis?.analysis_result?.sentiment || null;
  };

  // Helper function to map sentiment to emoji and details
  const getSentimentDetails = (sentiment: string | null) => {
    const sentimentMap: { [key: string]: { emoji: string; label: string; description: string; buttonColor: string } } = {
      friendly: {
        emoji: "😊",
        label: "Friendly",
        description: "Positive engagement with supportive intent",
        buttonColor: "#42b883"
      },
      "silly": {
        emoji: "😜",
        label: "Silly",
        description: "Playful humor that might seem edgy",
        buttonColor: "#f39c12"
      },
      harmful: {
        emoji: "😠",
        label: "Harmful",
        description: "Contains offensive or hurtful content",
        buttonColor: "#e74c3c"
      },
      unfriendly: {
        emoji: "😒",
        label: "Unfriendly",
        description: "Negative but not necessarily harmful",
        buttonColor: "#e67e22"
      }
    };

    return sentimentMap[sentiment || ""] || {
      emoji: "🤔",
      label: "Unknown",
      description: "Sentiment analysis pending",
      buttonColor: "#95a5a6"
    };
  };

  // Helper function to check if a user is notable based on LLM analysis
  const isNotableUser = (replyId: string) => {
    if (!replyAnalysisData?.reply_analyzer_results?.reply_analyses) return false;
    
    const replyAnalysis = replyAnalysisData.reply_analyzer_results.reply_analyses.find(
      (analysis: any) => analysis.reply_id === replyId
    );
    
    return replyAnalysis?.analysis_result?.author_important || false;
  };

  // Helper function to get suggested response from next steps data
  const getSuggestedResponse = (replyId: string, authorName: string) => {
    if (!nextStepsData?.next_step_analysis?.recommended_next_steps) {
      console.log(`📊 No next steps data available yet`);
      return null;
    }
    
    // First check if this reply is in the important responders list
    const isImportantResponder = nextStepsData.next_step_analysis.important_responders?.some(
      (resp: any) => resp.reply_id === replyId
    );
    
    if (!isImportantResponder) {
      console.log(`📊 Reply ${replyId} not in important responders list`);
      return null;
    }
    
    // Find recommendation by matching the reply_id (preferred) or author name
    const recommendation = nextStepsData.next_step_analysis.recommended_next_steps.find(
      (action: any) => action.reply_id === replyId || action.responder === authorName
    );
    
    console.log(`📊 Found recommendation for ${replyId}:`, recommendation?.suggested_response);
    return recommendation?.suggested_response || null;
  };

  // Function to handle notable user reply
  const handleNotableUserReply = (reply: any) => {
    if (replyingToId === reply.id) {
      setReplyingToId(null);
      setReplyText("");
    } else {
      setReplyingToId(reply.id);
      
      // Check preloaded map first (just like moderation)
      const suggestedResponse = preloadedSuggestions.get(reply.id);
      
      if (suggestedResponse) {
        setReplyText(suggestedResponse);
      } else {
        setReplyText("");
      }
    }
  };
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f0f2f5" }}>
      <header
        style={{
          backgroundColor: "#4267B2",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              onClick={onBack}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                color: "white",
                padding: "8px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              ← Back
            </button>
            <h1
              style={{
                fontSize: "28px",
                fontWeight: "bold",
                color: "white",
                margin: 0,
                fontFamily: "Helvetica, Arial, sans-serif",
              }}
            >
              🛡️ HaterAide Analysis
            </h1>
          </div>
        </div>
      </header>

      <main
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "20px 16px",
        }}
      >
        {/* Main Content - Post and Comments */}
        <div>
          {/* Original Post */}
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              marginBottom: "16px",
              overflow: "hidden",
            }}
          >
            {/* Post header */}
            <div
              style={{
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                borderBottom: "1px solid #e4e6ea",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  marginRight: "12px",
                  overflow: "hidden",
                }}
              >
                <img
                  src={post.author.avatar}
                  alt={post.author.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    target.parentElement!.style.backgroundColor = "#1877f2";
                    target.parentElement!.style.display = "flex";
                    target.parentElement!.style.alignItems = "center";
                    target.parentElement!.style.justifyContent = "center";
                    target.parentElement!.style.color = "white";
                    target.parentElement!.style.fontWeight = "bold";
                    target.parentElement!.innerHTML =
                      post.author.name.charAt(0);
                  }}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: "600",
                    color: "#1c1e21",
                    marginBottom: "2px",
                  }}
                >
                  {post.author.name} {post.author.verified && "✓"}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#65676b",
                  }}
                >
                  {new Date(post.timestamp).toLocaleDateString()} · 🌎
                </div>
              </div>
            </div>

            {/* Post content */}
            <div style={{ padding: "16px" }}>
              <p
                style={{
                  fontSize: "15px",
                  lineHeight: "1.33",
                  color: "#1c1e21",
                  margin: 0,
                }}
              >
                {post.content}
              </p>

              {post.image_url && (
                <div
                  style={{
                    marginTop: "12px",
                    backgroundColor: "#f0f2f5",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={post.image_url}
                    alt="Post content"
                    style={{
                      width: "100%",
                      height: "auto",
                      maxHeight: "400px",
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* General Sentiment Summary */}
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              marginBottom: "16px",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <span style={{ fontSize: "16px" }}>🤖</span>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#1c1e21",
                  margin: 0,
                }}
              >
                AI-Generated Summary
              </h3>
            </div>
            <div
              style={{
                backgroundColor: "#f0f2f5",
                borderRadius: "8px",
                padding: "12px",
                border: "1px solid #e4e6ea",
              }}
            >
              {generalSentimentData?.general_sentiment_results?.results ? (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "12px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "16px",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        backgroundColor:
                          generalSentimentData.general_sentiment_results.results.overall_sentiment === "positive"
                            ? "#d4edda"
                            : generalSentimentData.general_sentiment_results.results.overall_sentiment === "negative"
                            ? "#f8d7da"
                            : "#fff3cd",
                        color:
                          generalSentimentData.general_sentiment_results.results.overall_sentiment === "positive"
                            ? "#155724"
                            : generalSentimentData.general_sentiment_results.results.overall_sentiment === "negative"
                            ? "#721c24"
                            : "#856404",
                        fontWeight: "600",
                        textTransform: "capitalize",
                      }}
                    >
                      {generalSentimentData.general_sentiment_results.results.overall_sentiment}
                    </span>
                    {generalSentimentData.general_sentiment_results.results.engagement_stats.safety_concern === "high" && (
                      <span
                        style={{
                          fontSize: "12px",
                          backgroundColor: "#f8d7da",
                          color: "#721c24",
                          padding: "2px 6px",
                          borderRadius: "3px",
                          fontWeight: "600",
                        }}
                      >
                        ⚠️ HIGH SAFETY CONCERN
                      </span>
                    )}
                  </div>
                  <div style={{ marginBottom: "12px" }}>
                    <p
                      style={{
                        fontSize: "14px",
                        color: "#1c1e21",
                        margin: 0,
                        lineHeight: "1.4",
                        marginBottom: "8px",
                      }}
                    >
                      {isExpanded 
                        ? generalSentimentData.general_sentiment_results.results.summary
                        : `${generalSentimentData.general_sentiment_results.results.summary.substring(0, 150)}${
                            generalSentimentData.general_sentiment_results.results.summary.length > 150 ? '...' : ''
                          }`
                      }
                    </p>
                    {generalSentimentData.general_sentiment_results.results.summary.length > 150 && (
                      <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#1877f2",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                          padding: "0",
                          textDecoration: "underline",
                        }}
                      >
                        {isExpanded ? "See less" : "See more"}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p
                  style={{
                    fontSize: "14px",
                    color: "#65676b",
                    margin: 0,
                    fontStyle: "italic",
                  }}
                >
                  General sentiment analysis will appear here once the backend
                  processes the post and comments...
                </p>
              )}
            </div>
          </div>

          {/* Comments with Hater Meter */}
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              padding: "16px",
            }}
          >
            <h3
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: "#1c1e21",
                marginBottom: "16px",
              }}
            >
              Comments with Hater Meter
            </h3>

            {post.replies.map((reply: any) => (
              <div
                key={reply.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 300px",
                  gap: "16px",
                  marginBottom: "16px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid #e4e6ea",
                }}
              >
                {/* Original Comment */}
                <div style={{ display: "flex" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      marginRight: "8px",
                      flexShrink: 0,
                      overflow: "hidden",
                    }}
                  >
                    <img
                      src={reply.author.avatar}
                      alt={reply.author.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        target.parentElement!.style.backgroundColor = "#42b883";
                        target.parentElement!.style.display = "flex";
                        target.parentElement!.style.alignItems = "center";
                        target.parentElement!.style.justifyContent = "center";
                        target.parentElement!.style.color = "white";
                        target.parentElement!.style.fontSize = "12px";
                        target.parentElement!.style.fontWeight = "bold";
                        target.parentElement!.innerHTML =
                          reply.author.name.charAt(0);
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        backgroundColor: "#f0f2f5",
                        borderRadius: "16px",
                        padding: "8px 12px",
                        marginBottom: "4px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: "600",
                          color: "#1c1e21",
                          marginBottom: "2px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {reply.author.name}
                        {isNotableUser(reply.id) && (
                          <span
                            style={{
                              fontSize: "10px",
                              backgroundColor: "#1877f2",
                              color: "white",
                              padding: "2px 4px",
                              borderRadius: "3px",
                              fontWeight: "700",
                            }}
                          >
                            ⭐ NOTABLE
                          </span>
                        )}
                      </div>
                      {/* Content with moderation */}
                      <div
                        style={{
                          fontSize: "14px",
                          color: "#1c1e21",
                        }}
                      >
                        {(() => {
                          const moderationType = shouldModerateContent(reply.id);
                          
                          if (moderationType === 'hide') {
                            return (
                              <div
                                style={{
                                  backgroundColor: "#1c1e21",
                                  color: "white",
                                  borderRadius: "8px",
                                  padding: "8px 12px",
                                  position: "relative",
                                  cursor: "pointer",
                                  userSelect: "none",
                                }}
                                title="Content hidden due to harmful nature. Click to reveal at your own risk."
                                onClick={(e) => {
                                  if (confirm('This content has been flagged as harmful. Are you sure you want to view it?')) {
                                    const container = e.currentTarget;
                                    container.style.backgroundColor = "transparent";
                                    container.style.color = "#1c1e21";
                                    container.innerHTML = reply.content;
                                  }
                                }}
                              >
                                <div style={{ textAlign: "center" }}>
                                  ⚠️ Content Hidden - Harmful
                                  <div style={{ fontSize: "10px", marginTop: "4px" }}>
                                    Click to reveal
                                  </div>
                                </div>
                              </div>
                            );
                          } else if (moderationType === 'blur') {
                            return (
                              <div
                                style={{
                                  filter: "blur(4px)",
                                  cursor: "pointer",
                                  position: "relative",
                                  transition: "filter 0.3s ease",
                                }}
                                title="Content blurred due to unfriendly nature. Click to unblur."
                                onClick={(e) => {
                                  const target = e.currentTarget;
                                  target.style.filter = "none";
                                  target.title = "";
                                  // Remove the overlay div
                                  const overlay = target.querySelector('div[style*="absolute"]');
                                  if (overlay) overlay.remove();
                                }}
                              >
                                {reply.content}
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "50%",
                                    left: "50%",
                                    transform: "translate(-50%, -50%)",
                                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                                    padding: "4px 8px",
                                    borderRadius: "4px",
                                    fontSize: "10px",
                                    fontWeight: "bold",
                                    pointerEvents: "none",
                                  }}
                                >
                                  😐 UNFRIENDLY
                                </div>
                              </div>
                            );
                          } else {
                            return reply.content;
                          }
                        })()}
                      </div>

                      {/* Media with moderation */}
                      {reply.media_url && (
                        <div style={{ marginTop: "8px" }}>
                          {(() => {
                            const moderationType = shouldModerateContent(reply.id);
                            
                            if (moderationType === 'hide') {
                              return (
                                <div
                                  style={{
                                    width: "200px",
                                    height: "120px",
                                    backgroundColor: "#1c1e21",
                                    borderRadius: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    color: "white",
                                  }}
                                  title="Media hidden due to harmful content. Click to reveal at your own risk."
                                  onClick={(e) => {
                                    if (confirm('This media has been flagged as harmful. Are you sure you want to view it?')) {
                                      const container = e.currentTarget;
                                      const img = document.createElement('img');
                                      img.src = reply.media_url!;
                                      img.alt = reply.content || "Media content";
                                      img.style.maxWidth = "200px";
                                      img.style.maxHeight = "200px";
                                      img.style.borderRadius = "8px";
                                      img.style.objectFit = "cover";
                                      container.replaceWith(img);
                                    }
                                  }}
                                >
                                  <div style={{ textAlign: "center" }}>
                                    ⚠️ Media Hidden
                                    <div style={{ fontSize: "10px", marginTop: "4px" }}>
                                      Harmful Content
                                    </div>
                                  </div>
                                </div>
                              );
                            } else if (moderationType === 'blur') {
                              return (
                                <div style={{ position: "relative", display: "inline-block" }}>
                                  <img
                                    src={reply.media_url}
                                    alt={reply.content || "Media content"}
                                    style={{
                                      maxWidth: "200px",
                                      maxHeight: "200px",
                                      borderRadius: "8px",
                                      objectFit: "cover",
                                      filter: "blur(8px)",
                                      cursor: "pointer",
                                      transition: "filter 0.3s ease",
                                    }}
                                    title="Media blurred due to unfriendly content. Click to unblur."
                                    onClick={(e) => {
                                      const target = e.currentTarget;
                                      target.style.filter = "none";
                                      target.title = "";
                                      const overlay = target.nextElementSibling;
                                      if (overlay) overlay.remove();
                                    }}
                                  />
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: "50%",
                                      left: "50%",
                                      transform: "translate(-50%, -50%)",
                                      backgroundColor: "rgba(255, 255, 255, 0.9)",
                                      padding: "8px 12px",
                                      borderRadius: "4px",
                                      fontSize: "12px",
                                      fontWeight: "bold",
                                      pointerEvents: "none",
                                    }}
                                  >
                                    😐 UNFRIENDLY
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <img
                                  src={reply.media_url}
                                  alt={reply.content || "Media content"}
                                  style={{
                                    maxWidth: "200px",
                                    maxHeight: "200px",
                                    borderRadius: "8px",
                                    objectFit: "cover",
                                  }}
                                />
                              );
                            }
                          })()}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#65676b",
                        marginTop: "4px",
                        display: "flex",
                        gap: "12px",
                      }}
                    >
                      <button
                        onClick={() => handleNotableUserReply(reply)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#1877f2",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                          padding: "0",
                        }}
                      >
                        Reply
                      </button>
                      <span style={{ color: "#65676b" }}>·</span>
                      <span>2m</span>
                    </div>
                    
                    {/* Reply input field */}
                    {replyingToId === reply.id && (
                      <div
                        style={{
                          marginTop: "8px",
                          display: "flex",
                          gap: "8px",
                          alignItems: "flex-start",
                        }}
                      >
                        <div
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            backgroundColor: "#1877f2",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "10px",
                            fontWeight: "bold",
                            flexShrink: 0,
                          }}
                        >
                          You
                        </div>
                        <div style={{ flex: 1 }}>
                          {isNotableUser(reply.id) && preloadedSuggestions.has(reply.id) && (
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#1877f2",
                                marginBottom: "4px",
                                paddingLeft: "12px",
                                fontWeight: "600",
                              }}
                            >
                              ⭐ Notable User - AI-Suggested Reply
                            </div>
                          )}
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`Reply to ${reply.author.name}...`}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              borderRadius: "20px",
                              border: isNotableUser(reply.id) ? "2px solid #1877f2" : "1px solid #e4e6ea",
                              fontSize: "14px",
                              backgroundColor: "#f0f2f5",
                              outline: "none",
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && replyText.trim()) {
                                console.log(`Reply to ${reply.id}: ${replyText}`);
                                setReplyingToId(null);
                                setReplyText("");
                              }
                            }}
                            autoFocus
                          />
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#65676b",
                              marginTop: "4px",
                              paddingLeft: "12px",
                            }}
                          >
                            Press Enter to send
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Hater Meter Column */}
                <div
                  style={{
                    backgroundColor: "#f8f9fa",
                    borderRadius: "8px",
                    padding: "12px",
                    border: "1px solid #e4e6ea",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#65676b",
                      marginBottom: "8px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Hater Meter
                  </div>

                  {(() => {
                    const sentiment = getReplySentiment(reply.id);
                    const sentimentDetails = getSentimentDetails(sentiment);
                    
                    return (
                      <>
                        {/* Emoji indicator */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "8px",
                          }}
                        >
                          <span style={{ fontSize: "24px" }}>{sentimentDetails.emoji}</span>
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: "600",
                              color: "#1c1e21",
                            }}
                          >
                            {sentimentDetails.label}
                          </span>
                        </div>

                      </>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  const [data, setData] = useState<MockData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Initialize view state from localStorage to persist across refreshes
  const [currentView, setCurrentView] = useState<"feed" | "analysis">(() => {
    const saved = localStorage.getItem('hateraide_view');
    return saved === 'analysis' ? 'analysis' : 'feed';
  });
  
  const [selectedPostId, setSelectedPostId] = useState<string | null>(() => {
    return localStorage.getItem('hateraide_post_id');
  });
  
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [replyAnalysisResults, setReplyAnalysisResults] = useState<any>(null);
  const [replyAnalysisData, setReplyAnalysisData] = useState<any>(null);
  const [hasLoadedInitialAnalysis, setHasLoadedInitialAnalysis] = useState(false);
  
  // Persist view state changes to localStorage
  useEffect(() => {
    localStorage.setItem('hateraide_view', currentView);
    if (selectedPostId) {
      localStorage.setItem('hateraide_post_id', selectedPostId);
    } else {
      localStorage.removeItem('hateraide_post_id');
    }
  }, [currentView, selectedPostId]);
  
  // Recover selectedPost from data when component mounts
  useEffect(() => {
    if (data && selectedPostId && !selectedPost) {
      const post = data.posts.find(p => p.id === selectedPostId);
      if (post) {
        setSelectedPost(post);
      }
    }
  }, [data, selectedPostId, selectedPost]);

  useEffect(() => {
    // Load mock data once on mount
    fetch("/mock_data.json")
      .then((response) => response.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error:", error);
        setLoading(false);
      });
  }, []); // Empty dependency array - only run once

  // Load reply analysis data for notable user detection in main app
  // Only load once on initial mount when in feed view
  useEffect(() => {
    // Only load if we're in feed view and haven't loaded yet
    if (currentView === "feed" && !replyAnalysisData) {
      const loadReplyAnalysisData = async () => {
        try {
          const response = await fetch('/reply_analyzer_results.json');
          if (response.ok) {
            const data = await response.json();
            setReplyAnalysisData(data);
          }
        } catch (error) {
          console.error('Failed to load reply analysis data:', error);
        }
      };

      loadReplyAnalysisData();
    }
  }, []); // Empty dependency array - only run once on mount

  // Helper function to check if a user is notable based on LLM analysis (for App component)
  const isNotableUser = (replyId: string) => {
    if (!replyAnalysisData?.reply_analyzer_results?.reply_analyses) return false;
    
    const replyAnalysis = replyAnalysisData.reply_analyzer_results.reply_analyses.find(
      (analysis: any) => analysis.reply_id === replyId
    );
    
    return replyAnalysis?.analysis_result?.author_important || false;
  };

  const handleEnableHaterAide = async (postId: string) => {
    // Find the post and switch UI immediately
    const post = data?.posts.find((p) => p.id === postId);
    console.log(`📝 Found post:`, post);

    if (post) {
      console.log(`🎯 Setting selectedPost and changing view...`);
      // Switch UI immediately and store the post ID to prevent loss
      setSelectedPost(post);
      setSelectedPostId(postId);
      setCurrentView("analysis");

      // If we haven't loaded initial analysis data yet, do it now for instant display
      if (!hasLoadedInitialAnalysis) {
        try {
          // Try to load existing analysis data immediately for "cheat loading"
          const replyResponse = await fetch('/reply_analyzer_results.json?' + Date.now());
          if (replyResponse.ok) {
            const replyData = await replyResponse.json();
            if (replyData && Object.keys(replyData).length > 0) {
              setReplyAnalysisData(replyData);
              setReplyAnalysisResults(replyData.reply_analyzer_results);
              console.log('✅ Loaded existing analysis data for instant moderation display');
            }
          }
        } catch (error) {
          console.log('No existing analysis data found, will generate new');
        }
        setHasLoadedInitialAnalysis(true);
      }

      // Run analysis (will update with fresh data)
      try {
        console.log(`🛡️ HaterAide enabled for post: ${postId}`);
        const result = await apiService.runHaterAideAnalysis(postId);
        console.log("Analysis completed:", result);

        // Store reply analysis results for moderation display
        if (result.reply_analyzer_results) {
          setReplyAnalysisResults(result.reply_analyzer_results);
        }
      } catch (error) {
        console.error("Analysis failed:", error);
      }
    } else {
      console.log(`❌ Post not found for ID: ${postId}`);
    }
  };

  // Handle view switching - ALWAYS show analysis view if we're in it
  if (currentView === "analysis") {
    // If we have a selectedPostId but lost selectedPost, try to recover it
    const postToShow = selectedPost || (selectedPostId && data?.posts.find(p => p.id === selectedPostId));
    
    if (postToShow) {
      return (
        <HaterAideAnalysis
          post={postToShow}
          replyAnalysisResults={replyAnalysisResults}
          onBack={() => {
            console.log('🔙 User clicked back button');
            setCurrentView("feed");
            setSelectedPost(null);
            setSelectedPostId(null);
            setReplyAnalysisResults(null);
            // Clear localStorage
            localStorage.removeItem('hateraide_view');
            localStorage.removeItem('hateraide_post_id');
          }}
        />
      );
    } else if (data && selectedPostId) {
      // If we're in analysis view but lost the post object, try to recover
      console.log('🔄 Recovering post from data...');
      const recoveredPost = data.posts.find(p => p.id === selectedPostId);
      if (recoveredPost) {
        setSelectedPost(recoveredPost);
      }
    }
  }

  // Only show loading screen if we're in feed view
  if (loading && currentView === "feed") {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              border: "2px solid #2563eb",
              borderTop: "2px solid transparent",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          ></div>
          <p>Loading posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f0f2f5" }}>
      <header
        style={{
          backgroundColor: "#4267B2",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h1
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color: "white",
              margin: 0,
              fontFamily: "Helvetica, Arial, sans-serif",
            }}
          >
            facebook
          </h1>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                padding: "8px 12px",
                borderRadius: "20px",
                color: "white",
                fontSize: "14px",
              }}
            >
              🔍 Search
            </div>
            <div
              style={{
                width: "32px",
                height: "32px",
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
              }}
            >
              👤
            </div>
          </div>
        </div>
      </header>

      <main
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          padding: "20px 16px",
        }}
      >
        {data?.posts?.map((post: Post) => (
          <div
            key={post.id}
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              marginBottom: "16px",
              overflow: "hidden",
            }}
          >
            {/* Post header */}
            <div
              style={{
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                borderBottom: "1px solid #e4e6ea",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  marginRight: "12px",
                  overflow: "hidden",
                }}
              >
                <img
                  src={post.author.avatar}
                  alt={post.author.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    target.parentElement!.style.backgroundColor = "#1877f2";
                    target.parentElement!.style.display = "flex";
                    target.parentElement!.style.alignItems = "center";
                    target.parentElement!.style.justifyContent = "center";
                    target.parentElement!.style.color = "white";
                    target.parentElement!.style.fontWeight = "bold";
                    target.parentElement!.innerHTML =
                      post.author.name.charAt(0);
                  }}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: "600",
                    color: "#1c1e21",
                    marginBottom: "2px",
                  }}
                >
                  {post.author.name} {post.author.verified && "✓"}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#65676b",
                  }}
                >
                  {new Date(post.timestamp).toLocaleDateString()} · 🌎
                </div>
              </div>
            </div>

            {/* Post content */}
            <div
              style={{
                padding: "16px",
              }}
            >
              <p
                style={{
                  fontSize: "15px",
                  lineHeight: "1.33",
                  color: "#1c1e21",
                  margin: 0,
                }}
              >
                {post.content}
              </p>

              {post.image_url && (
                <div
                  style={{
                    marginTop: "12px",
                    backgroundColor: "#f0f2f5",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={post.image_url}
                    alt="Post content"
                    style={{
                      width: "100%",
                      height: "auto",
                      maxHeight: "400px",
                      objectFit: "contain",
                      display: "block",
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      const placeholder = document.createElement("div");
                      placeholder.style.backgroundColor = "#f0f2f5";
                      placeholder.style.borderRadius = "8px";
                      placeholder.style.padding = "16px";
                      placeholder.style.textAlign = "center";
                      placeholder.style.color = "#65676b";
                      placeholder.style.fontSize = "14px";
                      placeholder.textContent = `📷 Image could not be loaded`;
                      target.parentElement!.appendChild(placeholder);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Reactions bar */}
            {post.reactions && Object.keys(post.reactions).length > 0 && (
              <div
                style={{
                  padding: "8px 16px",
                  borderBottom: "1px solid #e4e6ea",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    fontSize: "14px",
                    color: "#65676b",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {Object.entries(post.reactions)
                      .slice(0, 3)
                      .map(([emoji, _count]) => (
                        <span
                          key={emoji}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "2px",
                            fontSize: "16px",
                          }}
                        >
                          {emoji}
                        </span>
                      ))}
                    <span style={{ marginLeft: "4px" }}>
                      {Object.values(post.reactions)
                        .reduce((a, b) => a + b, 0)
                        .toLocaleString()}
                    </span>
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                    {(
                      post.total_replies || post.replies.length
                    ).toLocaleString()}{" "}
                    comments
                  </div>
                </div>
              </div>
            )}

            {/* Post actions */}
            <div
              style={{
                borderTop: "1px solid #e4e6ea",
                padding: "8px 16px",
                display: "flex",
                justifyContent: "space-around",
              }}
            >
              <button
                style={{
                  background: "none",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  color: "#65676b",
                  fontSize: "15px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flex: 1,
                  justifyContent: "center",
                }}
              >
                👍 Like
              </button>
              <button
                style={{
                  background: "none",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  color: "#65676b",
                  fontSize: "15px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flex: 1,
                  justifyContent: "center",
                }}
              >
                💬 Comment
              </button>
              <button
                style={{
                  background: "none",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  color: "#65676b",
                  fontSize: "15px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flex: 1,
                  justifyContent: "center",
                }}
              >
                ↗️ Share
              </button>

              {/* HaterAide button - show for posts with multiple replies */}
              {(post.total_replies && post.total_replies > 10) || (post.replies && post.replies.length > 5) ? (
                <button
                  onClick={() => handleEnableHaterAide(post.id)}
                  style={{
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    color: "white",
                    fontSize: "15px",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flex: 1,
                    justifyContent: "center",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.02)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 12px rgba(102, 126, 234, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  🛡️ Enable HaterAide
                </button>
              ) : null}
            </div>

            {/* Comments section */}
            {post.replies && post.replies.length > 0 && (
              <div
                style={{
                  borderTop: "1px solid #e4e6ea",
                  padding: "12px 16px",
                }}
              >
                {post.replies.map((reply: any) => (
                  <div
                    key={reply.id}
                    style={{
                      display: "flex",
                      marginBottom: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        marginRight: "8px",
                        flexShrink: 0,
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={reply.author.avatar}
                        alt={reply.author.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          target.parentElement!.style.backgroundColor =
                            "#42b883";
                          target.parentElement!.style.display = "flex";
                          target.parentElement!.style.alignItems = "center";
                          target.parentElement!.style.justifyContent = "center";
                          target.parentElement!.style.color = "white";
                          target.parentElement!.style.fontSize = "12px";
                          target.parentElement!.style.fontWeight = "bold";
                          target.parentElement!.innerHTML =
                            reply.author.name.charAt(0);
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          backgroundColor: "#f0f2f5",
                          borderRadius: "16px",
                          padding: "8px 12px",
                          marginBottom: "4px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: "600",
                            color: "#1c1e21",
                            marginBottom: "2px",
                          }}
                        >
                          {reply.author.name}
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#1c1e21",
                          }}
                        >
                          {reply.content}
                        </div>

                        {/* Render media for replies */}
                        {reply.media_url && (
                          <div style={{ marginTop: "8px" }}>
                            {reply.type === "gif" || reply.type === "image" ? (
                              <img
                                src={reply.media_url}
                                alt={reply.content || "Media content"}
                                style={{
                                  maxWidth: "200px",
                                  maxHeight: "200px",
                                  borderRadius: "8px",
                                  objectFit: "cover",
                                }}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                  const placeholder =
                                    document.createElement("div");
                                  placeholder.style.backgroundColor = "#e4e6ea";
                                  placeholder.style.borderRadius = "8px";
                                  placeholder.style.padding = "8px";
                                  placeholder.style.textAlign = "center";
                                  placeholder.style.color = "#65676b";
                                  placeholder.style.fontSize = "12px";
                                  placeholder.textContent = `${
                                    reply.type === "gif" ? "🎬" : "📷"
                                  } ${reply.type.toUpperCase()}`;
                                  target.parentElement!.appendChild(
                                    placeholder
                                  );
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  backgroundColor: "#e4e6ea",
                                  borderRadius: "8px",
                                  padding: "8px",
                                  textAlign: "center",
                                  color: "#65676b",
                                  fontSize: "12px",
                                }}
                              >
                                📎 {reply.type.toUpperCase()}: {reply.media_url}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#65676b",
                          paddingLeft: "12px",
                        }}
                      >
                        Like · Reply · {reply.language}
                        {isNotableUser(reply.id) && " · ⭐ Notable"}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Show "See more" for viral posts */}
                {post.total_replies &&
                  post.total_replies > post.replies.length && (
                    <div
                      style={{
                        textAlign: "center",
                        marginTop: "12px",
                      }}
                    >
                      <button
                        style={{
                          background: "none",
                          border: "none",
                          color: "#1877f2",
                          fontSize: "14px",
                          fontWeight: "600",
                          cursor: "pointer",
                          padding: "8px",
                        }}
                      >
                        View{" "}
                        {(
                          post.total_replies - post.replies.length
                        ).toLocaleString()}{" "}
                        more comments
                      </button>
                    </div>
                  )}
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}

export default App;

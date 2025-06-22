import { useState, useEffect } from "react";
import type { Post } from "./types/index";
import { apiService, type HaterAideAnalysisResponse } from "./services/api";

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
  const [analysisData, setAnalysisData] =
    useState<HaterAideAnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [replyModerationData, setReplyModerationData] = useState<any>(null);

  // Analysis will be triggered by the enable button, not automatically
  // Remove automatic analysis trigger to prevent duplicate runs

  // Helper function to get moderation info for a reply
  const getReplyModerationInfo = (replyId: string) => {
    if (!replyAnalysisResults?.reply_analyses) return null;

    const replyAnalysis = replyAnalysisResults.reply_analyses.find(
      (analysis: any) => analysis.reply_id === replyId
    );

    return replyAnalysis?.analysis_result?.moderation_actions || null;
  };

  // Helper function to check if content should be blurred
  const shouldBlurContent = (replyId: string) => {
    const moderationActions = getReplyModerationInfo(replyId);
    return moderationActions?.some(
      (action: any) => action.tool_name === "blur_text_content"
    );
  };

  // Helper function to check if media should be minimized
  const shouldMinimizeMedia = (replyId: string) => {
    const moderationActions = getReplyModerationInfo(replyId);
    return moderationActions?.some(
      (action: any) => action.tool_name === "minimize_media_content"
    );
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
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "20px 16px",
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "20px",
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
              {isAnalyzing ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                    color: "#65676b",
                  }}
                >
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      border: "2px solid #1877f2",
                      borderTop: "2px solid transparent",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                    }}
                  ></div>
                  Running HaterAide analysis... This may take a moment.
                </div>
              ) : analysisData?.status === "success" ? (
                <p
                  style={{
                    fontSize: "14px",
                    color: "#1c1e21",
                    margin: 0,
                  }}
                >
                  ✅ Analysis complete! {analysisData.message}
                </p>
              ) : analysisData?.status === "error" ? (
                <p
                  style={{
                    fontSize: "14px",
                    color: "#e74c3c",
                    margin: 0,
                  }}
                >
                  ❌ Analysis failed: {analysisData.message}
                </p>
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
                        }}
                      >
                        {reply.author.name}
                      </div>
                      {/* Content with moderation */}
                      <div
                        style={{
                          fontSize: "14px",
                          color: "#1c1e21",
                        }}
                      >
                        {shouldBlurContent(reply.id) ? (
                          <div
                            style={{
                              backgroundColor: "#000",
                              color: "#000",
                              borderRadius: "4px",
                              padding: "4px 8px",
                              position: "relative",
                              cursor: "pointer",
                            }}
                            title="Content moderated due to harmful content. Click to reveal."
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              target.style.backgroundColor = "transparent";
                              target.style.color = "#1c1e21";
                              target.title = "";
                            }}
                          >
                            {reply.content}
                            <div
                              style={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                                color: "#fff",
                                fontSize: "10px",
                                fontWeight: "bold",
                                pointerEvents: "none",
                              }}
                            >
                              🚫 MODERATED
                            </div>
                          </div>
                        ) : (
                          reply.content
                        )}
                      </div>

                      {/* Media with moderation */}
                      {reply.media_url && (
                        <div style={{ marginTop: "8px" }}>
                          {shouldMinimizeMedia(reply.id) ? (
                            <div
                              style={{
                                width: "100px",
                                height: "60px",
                                backgroundColor: "#f0f0f0",
                                borderRadius: "8px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                border: "2px solid #e74c3c",
                              }}
                              title="Media minimized due to harmful content. Click to expand."
                              onClick={(e) => {
                                const target = e.target as HTMLElement;
                                target.outerHTML = `<img src="${
                                  reply.media_url
                                }" alt="${
                                  reply.content || "Media content"
                                }" style="max-width: 200px; max-height: 200px; border-radius: 8px; object-fit: cover;" />`;
                              }}
                            >
                              <div
                                style={{
                                  textAlign: "center",
                                  fontSize: "10px",
                                  color: "#e74c3c",
                                  fontWeight: "bold",
                                }}
                              >
                                🚫
                                <br />
                                MEDIA
                                <br />
                                HIDDEN
                              </div>
                            </div>
                          ) : (
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
                          )}
                        </div>
                      )}
                    </div>
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

                  {/* Emoji indicator */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "8px",
                    }}
                  >
                    <span style={{ fontSize: "24px" }}>😊</span>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#1c1e21",
                      }}
                    >
                      Friendly
                    </span>
                  </div>

                  {/* Brief comment */}
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#65676b",
                      marginBottom: "8px",
                      lineHeight: "1.3",
                    }}
                  >
                    Positive engagement with humorous intent
                  </div>

                  {/* Action button */}
                  <button
                    style={{
                      backgroundColor: "#42b883",
                      color: "white",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: "600",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    Keep Visible
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar - Analysis Tools */}
        <div>
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
              Analysis Tools
            </h3>

            <div style={{ marginBottom: "16px" }}>
              <button
                style={{
                  backgroundColor: "#1877f2",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  width: "100%",
                  marginBottom: "8px",
                }}
              >
                🔄 Refresh Analysis
              </button>

              <button
                style={{
                  backgroundColor: "#42b883",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  width: "100%",
                  marginBottom: "8px",
                }}
              >
                👁️ Show All Hidden
              </button>

              <button
                style={{
                  backgroundColor: "#e74c3c",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                🚫 Hide All Harmful
              </button>
            </div>

            <div
              style={{
                backgroundColor: "#f8f9fa",
                borderRadius: "6px",
                padding: "12px",
                fontSize: "12px",
                color: "#65676b",
              }}
            >
              <strong>Stats:</strong>
              <br />
              Total Comments: {post.replies.length}
              <br />
              Harmful: 2<br />
              Friendly: {post.replies.length - 4}
              <br />
              Unfriendly: 2
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  const [data, setData] = useState<MockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<"feed" | "analysis">("feed");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useEffect(() => {
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
  }, []);

  const [replyAnalysisResults, setReplyAnalysisResults] = useState<any>(null);

  const handleEnableHaterAide = async (postId: string) => {
    // Find the post and switch UI immediately
    const post = data?.posts.find((p) => p.id === postId);
    console.log(`📝 Found post:`, post);

    if (post) {
      console.log(`🎯 Setting selectedPost and changing view...`);
      // Switch UI immediately
      setSelectedPost(post);
      setCurrentView("analysis");

      // Run analysis ONCE
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

  // Handle view switching
  if (currentView === "analysis" && selectedPost) {
    return (
      <HaterAideAnalysis
        post={selectedPost}
        replyAnalysisResults={replyAnalysisResults}
        onBack={() => {
          setCurrentView("feed");
          setSelectedPost(null);
          setReplyAnalysisResults(null);
        }}
      />
    );
  }

  if (loading) {
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
                      .map(([emoji, count]) => (
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

              {/* HaterAide button - only show for viral posts */}
              {post.total_replies && post.total_replies > 100 && (
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
              )}
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
                        Like · Reply · {reply.sentiment} · {reply.language}
                        {reply.author.important && " · ⭐ Notable"}
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

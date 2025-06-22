/**
 * API service for communicating with HaterAide Python backend
 * Prepares for integration with main.py functions
 */

export interface HaterAideAnalysisRequest {
  post_id: string;
  run_all_agents?: boolean;
}

export interface HaterAideAnalysisResponse {
  post_analyzer_results: any;
  reply_analyzer_results: any;
  general_sentiment_results: any;
  next_step_results: any;
  status: "success" | "error";
  message?: string;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    // Connect to main FastAPI backend
    this.baseUrl = "http://localhost:8000";
  }

  /**
   * Enable HaterAide for a post - triggers analysis
   */
  async enableHaterAide(postId: string): Promise<any> {
    try {
      console.log(`🛡️ Enabling HaterAide for post: ${postId}`);

      const response = await fetch(`${this.baseUrl}/api/enable-hateraide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ post_id: postId }),
      });

      if (!response.ok) {
        throw new Error(`Backend responded with status: ${response.status}`);
      }

      const result = await response.json();
      console.log("✅ HaterAide enabled successfully:", result);
      return result;
    } catch (error) {
      console.error("❌ HaterAide enable failed:", error);
      throw error;
    }
  }

  /**
   * Trigger HaterAide analysis for a specific post
   * Gets real results from the post_analyzer agent
   */
  async runHaterAideAnalysis(
    postId: string
  ): Promise<HaterAideAnalysisResponse> {
    try {
      console.log(`🤖 Getting HaterAide Analysis results for post: ${postId}`);

      // The enableHaterAide call already ran the post_analyzer
      // For now, we'll make another call to get the results
      // In the future, this could be optimized to store results and retrieve them
      const response = await fetch(`${this.baseUrl}/api/enable-hateraide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ post_id: postId }),
      });

      if (!response.ok) {
        throw new Error(`Backend responded with status: ${response.status}`);
      }

      const result = await response.json();

      if (result.status === "error") {
        return {
          post_analyzer_results: null,
          reply_analyzer_results: null,
          general_sentiment_results: null,
          next_step_results: null,
          status: "error",
          message: result.message,
        };
      }

      // Transform the backend response to match our interface
      return {
        post_analyzer_results: {
          analysis_timestamp: result.timestamp,
          agent: "post_analyzer",
          total_posts_analyzed: 1,
          post_analyses: [
            {
              post_id: postId,
              analysis_status: "success",
              analysis_result: result.analysis_result,
              post_data: result.post_data,
            },
          ],
        },
        reply_analyzer_results: {
          analysis_timestamp: result.timestamp,
          agent: "reply_analyzer",
          total_replies_analyzed: 0,
          replies_with_harmful_content: 0,
          important_authors_found: 0,
          reply_analyses: [],
        },
        general_sentiment_results: {
          analysis_timestamp: result.timestamp,
          agent: "general_sentiment",
          total_posts_analyzed: 1,
          sentiment_analyses: [],
        },
        next_step_results: {
          analysis_timestamp: result.timestamp,
          agent: "next_step",
          total_posts_analyzed: 1,
          engagement_strategies: [],
        },
        status: "success",
        message: `${result.message} - ${
          result.analysis_result?.description || "Analysis completed"
        }`,
      };
    } catch (error) {
      console.error("HaterAide analysis failed:", error);
      return {
        post_analyzer_results: null,
        reply_analyzer_results: null,
        general_sentiment_results: null,
        next_step_results: null,
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Future endpoint: Run individual agents
   */
  async runPostAnalyzer(postId: string) {
    // Will call: POST /api/post-analyzer
    // Body: { post_id: postId }
    console.log(`Running post_analyzer for ${postId}`);
  }

  async runReplyAnalyzer(postId: string) {
    // Will call: POST /api/reply-analyzer
    // Body: { post_id: postId }
    console.log(`Running reply_analyzer for ${postId}`);
  }

  async runGeneralSentiment(postId: string) {
    // Will call: POST /api/general-sentiment
    // Body: { post_id: postId }
    console.log(`Running general_sentiment for ${postId}`);
  }

  async runNextStep(postId: string) {
    // Will call: POST /api/next-step
    // Body: { post_id: postId }
    console.log(`Running next_step for ${postId}`);
  }

  /**
   * Get analysis results for a post
   */
  async getAnalysisResults(postId: string) {
    // Will call: GET /api/analysis/{post_id}
    console.log(`Getting analysis results for ${postId}`);
  }
}

export const apiService = new ApiService();

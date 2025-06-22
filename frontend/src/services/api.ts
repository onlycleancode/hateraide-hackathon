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
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Trigger HaterAide analysis for a specific post
   * Gets real results from the post_analyzer agent
   */
  async runHaterAideAnalysis(postId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/enable-hateraide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ post_id: postId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to run HaterAide analysis: ${response.statusText}`);
    }

    return response.json();
  }

  async getModerationStatus(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/moderation-status`);
    
    if (!response.ok) {
      throw new Error(`Failed to get moderation status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Future endpoint: Run individual agents
   */
  async runPostAnalyzer(postId: string) {
  }

  async runReplyAnalyzer(postId: string) {
  }

  async runGeneralSentiment(postId: string) {
  }

  async runNextStep(postId: string) {
  }

  /**
   * Get analysis results for a post
   */
  async getAnalysisResults(postId: string) {
  }
}

export const apiService = new ApiService();

from fastapi import APIRouter, HTTPException
from models.schemas import (
    PostAnalysisRequest, ReplyAnalysisRequest, 
    PostAnalysisResult, ReplyAnalysisResult, 
    GeneralSentimentResult, NextStepResult,
    Post, Reply
)
from agents.post_analyzer import PostAnalyzerAgent
from agents.reply_analyzer import ReplyAnalyzerAgent
from agents.general_sentiment import GeneralSentimentAgent
from agents.next_step import NextStepAgent
from typing import List
import json
import logging
from datetime import datetime

router = APIRouter()

# Set up logging
logger = logging.getLogger("hateraide_api")
logger.setLevel(logging.INFO)

@router.get("/mock-data")
async def get_mock_data():
    """Return mock social media data from frontend folder"""
    import os
    
    # Read actual mock data from frontend folder
    mock_file_path = os.path.join("frontend", "public", "mock_data.json")
    
    try:
        with open(mock_file_path, 'r') as f:
            mock_data = json.load(f)
        return mock_data
    except FileNotFoundError:
        logger.error(f"Mock data file not found: {mock_file_path}")
        raise HTTPException(status_code=500, detail="Mock data file not found")
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing mock data: {str(e)}")
        raise HTTPException(status_code=500, detail="Error parsing mock data")

@router.post("/analyze-post", response_model=PostAnalysisResult)
async def analyze_post(request: PostAnalysisRequest = None, post_id: str = "post_1"):
    """Analyze a social media post - uses mock data if no request provided"""
    try:
        if request is None:
            # Use mock data - get specific post by ID
            mock_data = await get_mock_data()
            
            # Find the post by ID
            post_data = None
            for post in mock_data["posts"]:
                if post["id"] == post_id:
                    post_data = post
                    break
            
            if not post_data:
                raise HTTPException(status_code=404, detail=f"Post {post_id} not found in mock data")
            
            # Convert to Post object
            from models.schemas import Author
            author = Author(**post_data["author"])
            post = Post(
                id=post_data["id"],
                type=post_data["type"],
                content=post_data["content"],
                author=author,
                timestamp=post_data["timestamp"],
                image_url=post_data.get("image_url")
            )
        else:
            post = request.post
        
        agent = PostAnalyzerAgent()
        result = await agent.analyze_post(post)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

from pydantic import BaseModel

class EnableHaterAideRequest(BaseModel):
    post_id: str

@router.post("/enable-hateraide", response_model=dict)
async def enable_hateraide(request: EnableHaterAideRequest):
    """Enable HaterAide analysis on a specific mock post"""
    logger.info("🛡️ HaterAide Enable button pressed!")
    post_id = request.post_id
    logger.info(f"🚀 Starting post analysis pipeline for post: {post_id}")
    
    try:
        # Get mock data for analysis
        mock_data = await get_mock_data()
        
        # Find the specific post
        post_data = None
        for post in mock_data["posts"]:
            if post["id"] == post_id:
                post_data = post
                break
        
        if not post_data:
            raise HTTPException(status_code=404, detail=f"Post {post_id} not found in mock data")
        
        logger.info(f"📝 Processing post: {post_data['content'][:50]}...")
        logger.info(f"👤 Author: {post_data['author']['name']}")
        logger.info(f"📊 Total replies: {post_data.get('total_replies', len(post_data.get('replies', [])))}")
        
        # Convert post data to Post object for reply analysis (prepare this first)
        from models.schemas import Author, Reply
        author = Author(**post_data["author"])
        post_obj = Post(
            id=post_data["id"],
            type=post_data["type"],
            content=post_data["content"],
            author=author,
            timestamp=post_data["timestamp"],
            image_url=post_data.get("image_url"),
            replies=[]
        )
        
        # Convert replies to Reply objects
        replies = []
        for reply_data in post_data.get("replies", []):
            reply_author = Author(**reply_data["author"])
            reply_obj = Reply(
                id=reply_data["id"],
                type=reply_data["type"],
                content=reply_data["content"],
                media_url=reply_data.get("media_url"),
                author=reply_author,
                language=reply_data.get("language", "en"),
                sentiment=reply_data.get("sentiment", "unknown"),
                hidden=reply_data.get("hidden", False),
                timestamp=reply_data.get("timestamp")
            )
            replies.append(reply_obj)
        
        logger.info(f"🚀 Running parallel analysis: post + {len(replies)} replies...")
        
        # Run post and reply analysis in parallel for speed
        import asyncio
        
        async def run_post_analysis():
            return await analyze_post(post_id=post_id)
        
        async def run_reply_analysis_with_fallback():
            # Start with a basic post analysis for context while waiting for full analysis
            basic_post_context = PostAnalysisResult(
                analysis=f"Analyzing {post_obj.type} post by {post_obj.author.name}",
                sentiment="neutral",
                confidence_score=0.5,
                category="other"
            )
            reply_agent = ReplyAnalyzerAgent()
            return await reply_agent.analyze_replies(post_obj, replies, basic_post_context)
        
        # Execute both analyses concurrently
        post_result, reply_results = await asyncio.gather(
            run_post_analysis(),
            run_reply_analysis_with_fallback(),
            return_exceptions=True
        )
        
        # Handle any exceptions
        if isinstance(post_result, Exception):
            logger.error(f"❌ Post analysis failed: {str(post_result)}")
            raise post_result
        
        if isinstance(reply_results, Exception):
            logger.error(f"❌ Reply analysis failed: {str(reply_results)}")
            # Create fallback empty results
            reply_results = []
        
        logger.info(f"✅ Parallel analysis completed: post + {len(reply_results)} replies")
        
        # Run general sentiment analysis
        logger.info("🌡️ Running general sentiment analysis...")
        general_sentiment_agent = GeneralSentimentAgent()
        general_sentiment_result = await general_sentiment_agent.analyze_general_sentiment(
            post_result, reply_results
        )
        
        # Run next step analysis
        logger.info("🎯 Running next step analysis...")
        from agents.next_step import NextStepAgent
        next_step_agent = NextStepAgent()
        
        # Check if reply_analyzer_results.json exists, otherwise use current results
        import os
        if os.path.exists("reply_analyzer_results.json"):
            logger.info("📁 Using existing reply_analyzer_results.json for next step analysis")
            with open("reply_analyzer_results.json", 'r') as f:
                reply_analyzer_data = json.load(f)
        else:
            # Create reply analyzer data structure from current results
            reply_analyzer_data = {
                "hateraide_session": {
                    "session_id": f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    "timestamp": datetime.now().isoformat(),
                    "trigger": "enable_hateraide_button",
                    "status": "success",
                    "post_id": post_id
                },
                "reply_analyzer_results": {
                    "agent": "reply_analyzer",
                    "analysis_timestamp": datetime.now().isoformat(),
                    "llm_endpoint": "llama-4-scout-17b-16e-instruct-fp8",
                    "total_replies_analyzed": len(reply_results),
                    "replies_with_harmful_content": len([r for r in reply_results if r.sentiment == "harmful"]),
                    "important_authors_found": len([r for r in reply_results if r.author_important]),
                    "reply_analyses": [
                        {
                            "reply_id": result.reply_id,
                            "analysis_status": "success",
                            "analysis_result": {
                                "sentiment": result.sentiment,
                                "justification": result.justification,
                                "should_hide": result.should_hide,
                                "author_important": result.author_important,
                                "moderation_actions": []
                            }
                        }
                        for result in reply_results
                    ],
                    "status": "completed"
                },
                "post_context": {
                    "post_id": post_data["id"],
                    "post_content": post_data["content"],
                    "post_category": post_result.category,
                    "post_sentiment": post_result.sentiment,
                    "total_replies": len(replies)
                }
            }
        
        next_step_result = await next_step_agent.analyze_and_generate_next_steps(reply_analyzer_data)
        
        # Create comprehensive output for JSON file
        analysis_output = {
            "hateraide_session": {
                "session_id": f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "timestamp": datetime.now().isoformat(),
                "trigger": "enable_hateraide_button",
                "status": "success",
                "post_id": post_id
            },
            "post_data": {
                "id": post_data["id"],
                "content": post_data["content"],
                "author": post_data["author"],
                "timestamp": post_data["timestamp"],
                "type": post_data["type"],
                "image_url": post_data.get("image_url"),
                "reactions": post_data.get("reactions", {}),
                "total_replies": post_data.get("total_replies"),
                "replies_sample": post_data.get("replies", [])[:3]  # First 3 replies for context
            },
            "post_analyzer_results": {
                "agent": "post_analyzer",
                "analysis_timestamp": datetime.now().isoformat(),
                "llm_endpoint": "llama-4-scout-17b-16e-instruct-fp8",
                "results": {
                    "analysis": post_result.analysis,
                    "sentiment": post_result.sentiment,
                    "confidence_score": post_result.confidence_score,
                    "category": post_result.category
                },
                "status": "completed"
            },
            "system_info": {
                "backend_version": "1.0.0",
                "python_agent": "post_analyzer",
                "llm_model": "Llama-4-Scout-17B-16E-Instruct-FP8",
                "source": "frontend/public/mock_data.json"
            }
        }
        
        # Create separate reply analyzer output
        reply_analysis_output = {
            "hateraide_session": {
                "session_id": f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "timestamp": datetime.now().isoformat(),
                "trigger": "enable_hateraide_button",
                "status": "success",
                "post_id": post_id
            },
            "reply_analyzer_results": {
                "agent": "reply_analyzer",
                "analysis_timestamp": datetime.now().isoformat(),
                "llm_endpoint": "llama-4-scout-17b-16e-instruct-fp8",
                "total_replies_analyzed": len(reply_results),
                "replies_with_harmful_content": len([r for r in reply_results if r.sentiment == "harmful"]),
                "important_authors_found": len([r for r in reply_results if r.author_important]),
                "reply_analyses": [
                    {
                        "reply_id": result.reply_id,
                        "analysis_status": "success",
                        "analysis_result": {
                            "sentiment": result.sentiment,
                            "justification": result.justification,
                            "should_hide": result.should_hide,
                            "author_important": result.author_important,
                            "moderation_actions": []  # Will be populated by tools if used
                        }
                    }
                    for result in reply_results
                ],
                "status": "completed"
            },
            "post_context": {
                "post_id": post_data["id"],
                "post_content": post_data["content"],
                "post_category": post_result.category,
                "post_sentiment": post_result.sentiment,
                "total_replies": len(replies)
            },
            "system_info": {
                "backend_version": "1.0.0",
                "python_agent": "reply_analyzer",
                "llm_model": "Llama-4-Scout-17B-16E-Instruct-FP8",
                "source": "frontend/public/mock_data.json",
                "processing_method": "async_batch_processing"
            }
        }
        
        # Create general sentiment output
        general_sentiment_output = {
            "hateraide_session": {
                "session_id": f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "timestamp": datetime.now().isoformat(),
                "trigger": "enable_hateraide_button",
                "status": "success",
                "post_id": post_id
            },
            "general_sentiment_results": {
                "agent": "general_sentiment",
                "analysis_timestamp": datetime.now().isoformat(),
                "llm_endpoint": "llama-4-scout-17b-16e-instruct-fp8",
                "results": {
                    "overall_sentiment": general_sentiment_result.overall_sentiment,
                    "summary": general_sentiment_result.summary,
                    "notable_figures": general_sentiment_result.notable_figures,
                    "engagement_stats": general_sentiment_result.engagement_stats
                },
                "input_data": {
                    "post_sentiment": post_result.sentiment,
                    "post_category": post_result.category,
                    "total_replies_analyzed": len(reply_results),
                    "sentiment_breakdown": general_sentiment_result.engagement_stats.get("sentiment_distribution", {})
                },
                "status": "completed"
            },
            "system_info": {
                "backend_version": "1.0.0",
                "python_agent": "general_sentiment",
                "llm_model": "Llama-4-Scout-17B-16E-Instruct-FP8",
                "source": "frontend/public/mock_data.json",
                "analysis_approach": "post_and_reply_synthesis"
            }
        }
        
        # Save to JSON files in root directory
        post_filename = f"post_analyzer_results.json"
        reply_filename = f"reply_analyzer_results.json"
        general_filename = f"general_sentiment_results.json"
        next_steps_filename = f"next_steps.json"
        
        with open(post_filename, 'w') as f:
            json.dump(analysis_output, f, indent=2)
        
        with open(reply_filename, 'w') as f:
            json.dump(reply_analysis_output, f, indent=2)
        
        with open(general_filename, 'w') as f:
            json.dump(general_sentiment_output, f, indent=2)
        
        # Note: next_steps.json is already saved by the NextStepAgent
        logger.info(f"💾 Post analysis results saved to {post_filename}")
        logger.info(f"💾 Reply analysis results saved to {reply_filename}")
        logger.info(f"💾 General sentiment results saved to {general_filename}")
        logger.info(f"💾 Next steps analysis saved to {next_steps_filename}")
        logger.info("✅ HaterAide analysis completed successfully!")
        
        # Return response for frontend
        return {
            "status": "success",
            "message": f"HaterAide analysis completed successfully - analyzed {len(reply_results)} replies",
            "analysis_result": {
                "analysis": post_result.analysis,
                "sentiment": post_result.sentiment,
                "confidence_score": post_result.confidence_score,
                "category": post_result.category
            },
            "reply_analyzer_results": {
                "total_replies_analyzed": len(reply_results),
                "replies_with_harmful_content": len([r for r in reply_results if r.sentiment == "harmful"]),
                "important_authors_found": len([r for r in reply_results if r.author_important]),
                "reply_analyses": [
                    {
                        "reply_id": result.reply_id,
                        "sentiment": result.sentiment,
                        "justification": result.justification,
                        "should_hide": result.should_hide,
                        "author_important": result.author_important
                    }
                    for result in reply_results
                ]
            },
            "general_sentiment_results": {
                "overall_sentiment": general_sentiment_result.overall_sentiment,
                "summary": general_sentiment_result.summary,
                "notable_figures": general_sentiment_result.notable_figures,
                "engagement_stats": general_sentiment_result.engagement_stats
            },
            "next_step_results": {
                "important_responders_found": next_step_result.get("next_step_analysis", {}).get("important_responders_found", 0),
                "recommended_next_steps": next_step_result.get("next_step_analysis", {}).get("recommended_next_steps", []),
                "important_responders": next_step_result.get("next_step_analysis", {}).get("important_responders", [])
            },
            "timestamp": datetime.now().isoformat(),
            "post_data": {
                "id": post_data["id"],
                "content": post_data["content"],
                "author": post_data["author"]["name"],
                "total_replies": post_data.get("total_replies")
            },
            "saved_to_files": {
                "post_analysis": post_filename,
                "reply_analysis": reply_filename,
                "general_sentiment": general_filename,
                "next_steps": next_steps_filename
            }
        }
        
    except Exception as e:
        error_output = {
            "hateraide_session": {
                "session_id": f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                "timestamp": datetime.now().isoformat(),
                "trigger": "enable_hateraide_button",
                "status": "error"
            },
            "error": {
                "message": str(e),
                "type": type(e).__name__,
                "timestamp": datetime.now().isoformat()
            }
        }
        
        # Save error to JSON file too
        filename = f"post_analyzer_error_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w') as f:
            json.dump(error_output, f, indent=2)
        
        logger.error(f"❌ HaterAide analysis failed: {str(e)}")
        logger.info(f"💾 Error details saved to {filename}")
        
        return {
            "status": "error",
            "message": f"Analysis failed: {str(e)}",
            "timestamp": datetime.now().isoformat(),
            "saved_to_file": filename
        }

@router.post("/analyze-replies")
async def analyze_replies(request: ReplyAnalysisRequest):
    """Analyze replies to a post"""
    try:
        # First get post context
        post_agent = PostAnalyzerAgent()
        post_analysis = await post_agent.analyze_post(request.post)
        
        # Then analyze replies
        reply_agent = ReplyAnalyzerAgent()
        reply_results = await reply_agent.analyze_replies(
            request.post, 
            request.replies, 
            post_analysis["context"]
        )
        
        return {
            "post_analysis": post_analysis,
            "reply_analyses": reply_results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reply analysis failed: {str(e)}")

@router.post("/general-sentiment", response_model=GeneralSentimentResult)
async def analyze_general_sentiment(reply_analyses: List[dict]):
    """Generate overall sentiment analysis"""
    try:
        agent = GeneralSentimentAgent()
        result = await agent.analyze_general_sentiment(reply_analyses)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {str(e)}")

@router.post("/next-steps", response_model=NextStepResult)
async def generate_next_steps(data: dict):
    """Generate next step recommendations"""
    try:
        agent = NextStepAgent()
        result = await agent.generate_next_steps(
            data.get("reply_analyses", []),
            data.get("important_responders", [])
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Next steps generation failed: {str(e)}")

@router.post("/process-full-analysis")
async def process_full_analysis(request: PostAnalysisRequest):
    """Run complete analysis pipeline"""
    try:
        # Step 1: Analyze post
        post_agent = PostAnalyzerAgent()
        post_analysis = await post_agent.analyze_post(request.post)
        
        # Step 2: Analyze replies
        reply_agent = ReplyAnalyzerAgent()
        reply_results = await reply_agent.analyze_replies(
            request.post,
            request.post.replies,
            post_analysis["context"]
        )
        
        # Step 3: General sentiment
        sentiment_agent = GeneralSentimentAgent()
        general_sentiment = await sentiment_agent.analyze_general_sentiment(reply_results)
        
        # Step 4: Next steps
        important_responders = [
            {"name": reply.author.name, "message": reply.content}
            for reply in request.post.replies
            if reply.author.important
        ]
        
        next_step_agent = NextStepAgent()
        next_steps = await next_step_agent.generate_next_steps(reply_results, important_responders)
        
        return {
            "post_analysis": post_analysis,
            "reply_analyses": reply_results,
            "general_sentiment": general_sentiment,
            "next_steps": next_steps
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Full analysis failed: {str(e)}")
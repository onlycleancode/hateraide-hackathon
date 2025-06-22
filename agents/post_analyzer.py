from .base_agent import BaseAgent
from models.schemas import Post, PostAnalysisResult
from services.llm_client import llama_client
from pydantic import BaseModel
from typing import Literal
import logging
import json
from datetime import datetime

class PostAnalysisResponse(BaseModel):
    analysis: str
    sentiment: Literal["positive", "negative", "neutral", "mixed"]
    confidence_score: float
    category: Literal["joke", "comedy", "serious", "newsworthy", "personal", "advertisement", "other"]

class PostAnalyzerAgent(BaseAgent):
    def __init__(self):
        system_prompt = """You are a social media post analyzer that can analyze both text and visual content. Analyze the given post and provide:

1. A 2-3 sentence analysis of what the post is about and its likely impact
2. Overall sentiment (positive, negative, neutral, or mixed)
3. Confidence score (0.0 to 1.0) in your analysis
4. Category of the post

Consider:
- Text content: tone, language, cultural references
- Visual content: analyze any images/GIFs for context, emotion, humor, subject matter
- How text and visuals work together to create meaning
- Potential for virality based on content type and appeal
- Likely audience reactions to both text and visual elements
- Social/cultural context and meme potential

When analyzing images:
- Describe what you see and how it relates to the text
- Identify the emotional tone or humor in visuals
- Note if it's a meme format, reaction image, or original content
- Consider how the visual enhances or changes the message

Be concise but insightful in your analysis, treating text and visuals as a unified message."""
        
        super().__init__("post_analyzer", system_prompt)
        
        # Set up logging
        self.logger = logging.getLogger("post_analyzer")
        self.logger.setLevel(logging.INFO)
        
        # Create handler if not exists
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)

    async def analyze_post(self, post: Post) -> PostAnalysisResult:
        self.logger.info(f"🚀 Starting post analysis for post ID: {post.id}")
        self.logger.info(f"📝 Post content: {post.content[:100]}...")
        
        # Prepare text content for analysis
        text_content = f"""Analyze this social media post:

Author: {post.author.name} (verified: {post.author.verified})
Content: {post.content}
Post Type: {post.type}"""
        
        # Prepare image URLs if present
        image_urls = []
        if post.image_url:
            image_urls.append(post.image_url)
            self.logger.info(f"🖼️ Post includes image: {post.image_url}")
            text_content += f"\n\nPlease analyze both the text content and the image. Describe how they work together to create the overall message and impact."
        
        # Create multimodal content
        content = await llama_client.create_multimodal_message(text_content, image_urls)

        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": content}
        ]

        self.logger.info("🧠 Sending request to Llama 4 endpoint...")
        self.logger.info(f"📨 LLM Request - System prompt length: {len(self.system_prompt)} chars")
        self.logger.info(f"📨 LLM Request - User content length: {len(content)} chars")

        try:
            self.logger.info("🔄 Attempting structured output parsing...")
            result = await llama_client.parse_structured_output(
                messages=messages,
                response_format=PostAnalysisResponse
            )
            
            self.logger.info("✅ Structured output successful!")
            self.logger.info(f"📊 Analysis result - Sentiment: {result.sentiment}, Confidence: {result.confidence_score}")
            
            analysis_result = PostAnalysisResult(
                analysis=result.analysis,
                sentiment=result.sentiment,
                confidence_score=result.confidence_score,
                category=result.category
            )
            
            self.logger.info("🎯 Post analysis completed successfully")
            return analysis_result
            
        except Exception as e:
            self.logger.warning(f"⚠️ Structured output failed: {str(e)}")
            self.logger.info("🔄 Falling back to regular chat completion...")
            
            # Fallback to regular chat completion if structured output fails
            regular_result = await llama_client.chat_completion(messages=messages)
            
            self.logger.info("✅ Fallback chat completion successful!")
            self.logger.info(f"📄 LLM Response length: {len(regular_result['content'])} chars")
            
            analysis_result = PostAnalysisResult(
                analysis=regular_result["content"][:300] + "..." if len(regular_result["content"]) > 300 else regular_result["content"],
                sentiment="neutral",
                confidence_score=0.7,
                category="other"
            )
            
            self.logger.info("🎯 Post analysis completed with fallback")
            return analysis_result

    async def handle_tool_call(self, tool_call):
        return "No tools available for post analyzer"
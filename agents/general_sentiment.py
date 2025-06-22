from .base_agent import BaseAgent
from models.schemas import GeneralSentimentResult, PostAnalysisResult, ReplyAnalysisResult
from services.llm_client import llama_client
from pydantic import BaseModel
from typing import List, Dict, Literal
import logging

class GeneralSentimentResponse(BaseModel):
    overall_sentiment: Literal["positive", "negative", "mixed", "neutral"]
    summary: str
    vibe_check: str

class GeneralSentimentAgent(BaseAgent):
    def __init__(self):
        system_prompt = """You're a sharp social media analyst who writes like a human, not a robot. Your job is to give someone a quick, digestible read on how their post is landing with the internet.

**Your Mission:**
Write a paragraph that captures the overall vibe and reception. Think "friend catching you up on drama" energy, but professional enough to be useful.

**What to include:**
- **Overall sentiment**: How are people actually feeling about this?
- **The vibe**: What's the general energy? Supportive? Roasting? Mixed bag?
- **Safety concerns**: If there's harmful content, acknowledge it without being alarmist
- **Notable interactions**: Only mention if someone big (brands, verified accounts, major influencers) jumped in
- **Summary**: Paint the picture in human terms

**Your style:**
- **Conversational but informative** - "People are absolutely loving this" not "Engagement metrics indicate positive sentiment"
- **Specific without being robotic** - "Getting roasted in the replies" not "Negative feedback detected"
- **Focus on the forest, not the trees** - Talk about overall patterns, not individual comments
- **Honest but not harsh** - Tell it like it is without being brutal

**Key rules:**
- Write ONE paragraph (3-5 sentences max)
- Don't quote specific users unless they're actually famous/important
- Use natural language that flows well
- Give actionable insight about the reception
- Be helpful, not just descriptive

**Examples of your tone:**
- "Your post is hitting different - people are genuinely connecting with this and sharing their own stories."
- "Mixed bag here - while most people are vibing with the humor, there's some pushback from folks who think it's tone-deaf."
- "This one's getting the full internet treatment - lots of laughs, memes, and people tagging their friends."
- "Heads up - while there's plenty of positive engagement, you're also getting some genuinely nasty comments that cross the line into harassment."

**Handling harmful content:**
- Acknowledge it clearly but don't catastrophize
- Focus on actionable advice when appropriate
- Use phrases like "some concerning comments," "crossed into harassment," or "getting genuinely nasty responses"""
        
        super().__init__("general_sentiment", system_prompt)
        
        # Set up logging
        self.logger = logging.getLogger("general_sentiment")
        self.logger.setLevel(logging.INFO)
        
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)

    async def analyze_general_sentiment(
        self, 
        post_analysis: PostAnalysisResult,
        reply_analyses: List[ReplyAnalysisResult]
    ) -> GeneralSentimentResult:
        self.logger.info(f"🌡️ Starting general sentiment analysis for post with {len(reply_analyses)} replies")
        
        # Count sentiment distribution
        sentiment_counts = {"friendly": 0, "unfriendly": 0, "harmful": 0, "silly": 0}
        important_authors = []
        
        for reply in reply_analyses:
            sentiment_counts[reply.sentiment] += 1
            if reply.author_important:
                important_authors.append(reply.reply_id)
        
        self.logger.info(f"📊 Sentiment breakdown: {sentiment_counts}")
        self.logger.info(f"⭐ Important authors found: {len(important_authors)}")
        
        # Prepare analysis context
        text_content = f"""ORIGINAL POST ANALYSIS:
Category: {post_analysis.category}
Post Sentiment: {post_analysis.sentiment}
Post Analysis: {post_analysis.analysis}
Confidence: {post_analysis.confidence_score}

REPLY BREAKDOWN:
Total Replies Analyzed: {len(reply_analyses)}
Friendly: {sentiment_counts['friendly']}
Silly/Humorous: {sentiment_counts['silly']}
Unfriendly: {sentiment_counts['unfriendly']}
Harmful: {sentiment_counts['harmful']}
Important/Notable Authors: {len(important_authors)}

SAMPLE REPLY INSIGHTS:"""
        
        # Add sample justifications to give context
        for i, reply in enumerate(reply_analyses[:5]):  # First 5 replies for context
            text_content += f"\n- {reply.sentiment.upper()}: {reply.justification[:100]}..."
        
        text_content += f"\n\nBased on this data, write a conversational paragraph that captures how this post is being received. Focus on the overall vibe and what it means for the poster."
        
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": text_content}
        ]
        
        self.logger.info("🧠 Generating general sentiment summary...")
        
        # Use regular chat completion instead of structured output to avoid tools validation issues
        regular_result = await llama_client.chat_completion(
            messages=messages
            # Not passing tools parameter at all to avoid validation issues
        )
        
        # Determine overall sentiment based on reply distribution with harmful weighting
        total_positive = sentiment_counts['friendly'] + sentiment_counts['silly']
        # Weight harmful content more heavily (count each harmful comment as 3 negatives)
        weighted_harmful = sentiment_counts['harmful'] * 3
        total_negative = sentiment_counts['unfriendly'] + weighted_harmful
        
        # If there's significant harmful content, flag as negative or mixed
        if sentiment_counts['harmful'] > 0:
            if sentiment_counts['harmful'] >= 2 or sentiment_counts['harmful'] > len(reply_analyses) * 0.15:
                # Multiple harmful comments or >15% harmful = negative overall
                overall_sentiment = "negative"
            elif total_positive > total_negative:
                # Some harmful but mostly positive = mixed (with concern)
                overall_sentiment = "mixed"
            else:
                overall_sentiment = "negative"
        elif total_positive > total_negative * 2:
            overall_sentiment = "positive"
        elif total_negative > total_positive * 2:
            overall_sentiment = "negative"
        elif total_positive > 0 and total_negative > 0:
            overall_sentiment = "mixed"
        else:
            overall_sentiment = "neutral"
        
        self.logger.info(f"✅ General sentiment analysis completed: {overall_sentiment}")
        
        # Calculate comprehensive engagement stats
        total_replies = max(len(reply_analyses), 1)
        engagement_stats = {
            "total_replies": len(reply_analyses),
            "sentiment_distribution": sentiment_counts,
            "engagement_rate": round((sentiment_counts['friendly'] + sentiment_counts['silly']) / total_replies * 100, 1),
            "humor_rate": round(sentiment_counts['silly'] / total_replies * 100, 1),
            "negativity_rate": round((sentiment_counts['unfriendly'] + sentiment_counts['harmful']) / total_replies * 100, 1),
            "harmful_content_rate": round(sentiment_counts['harmful'] / total_replies * 100, 1),
            "safety_concern": "high" if sentiment_counts['harmful'] >= 2 or sentiment_counts['harmful'] > total_replies * 0.15 else "low" if sentiment_counts['harmful'] == 0 else "medium"
        }
        
        return GeneralSentimentResult(
            overall_sentiment=overall_sentiment,
            summary=regular_result["content"],
            reasons_for_upset=[],
            notable_figures=[],
            engagement_stats=engagement_stats
        )

    async def handle_tool_call(self, tool_call):
        return "No tools available for general sentiment analyzer"
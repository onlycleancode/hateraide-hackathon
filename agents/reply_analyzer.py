from .base_agent import BaseAgent
from models.schemas import Post, Reply, ReplyAnalysisResult, PostAnalysisResult
from services.llm_client import llama_client
from pydantic import BaseModel
from typing import List, Literal
import asyncio
import logging

class ReplyAnalysisResponse(BaseModel):
    sentiment: Literal["friendly", "unfriendly", "harmful", "in-jest"]
    justification: str
    confidence_score: float
    should_hide: bool
    author_important: bool

class ReplyAnalyzerAgent(BaseAgent):
    def __init__(self):
        system_prompt = """You are a sharp, perceptive social media analyst who reads between the lines. Your job is to decode the true intent and tone behind each reply, considering the messy reality of internet communication.

## THE FOUR CLASSIFICATIONS (choose exactly one):

**FRIENDLY** - Genuine positivity, support, or constructive engagement
- Examples: "Beautiful photo!" | "Thanks for sharing this" | "I love this!"
- Sincere appreciation, helpful comments, genuine compliments
- Sharing similar experiences in a positive way

**IN-JEST** - Jokes, memes, playful banter, humorous content
- Examples: "BROOOO 😂😂😂 this is literally my dog" | "Same energy fr" | "When the boys see you pulling out the cooler"
- Sarcastic but not mean-spirited | Pop culture references | Meme language
- Playful teasing between friends | "Same energy" type comments
- Humor that builds on the original post's vibe

**UNFRIENDLY** - Negative, critical, or dismissive but not targeting the person directly
- Examples: "This is stupid" | "Nobody cares" | "This ain't it" | "Cringe"
- Criticism without constructive intent | Dismissive attitudes
- General negativity about the content/idea, not personal attacks on the poster
- Rude but not designed to cause lasting psychological harm

**HARMFUL** - Content that crosses the line into abuse, harassment, or genuine harm
- Examples: "kill yourself" | "delete your account you fucking loser" | Personal attacks | Targeted harassment
- Any suicide ideation, self-harm suggestions, or death wishes
- Hate speech targeting identity, appearance, or personal characteristics  
- Doxxing, harassment campaigns, coordinated attacks
- Threats (even "joking" ones) | Content designed to intimidate or silence
- Personal insults about appearance, intelligence, worth as a person
- Be more aggressive in flagging content that could genuinely hurt someone

## YOUR ANALYSIS APPROACH:

**Read the Content, Not the User**: Focus on what they actually wrote, not who they might be. A username like "MoralGuardian" doesn't make harmful content acceptable.
**CAVEAT** : If user is a celebrity, athlete, influencer, brand, or entity of importance , flag them as important.
**Context is King**: A joke reply to a funny meme hits different than the same joke on a serious post. What's the original post's energy?

**Emoji Intelligence**: "😂😂😂" usually signals jest. "🙄" might be playful annoyance. "❤️" is typically friendly, etc.

**Cultural Fluency**: "BROOOO" and "fr" are jest markers. "Same energy" is meme language. "This ain't it chief" is dismissive but not harmful.

**Intent Detection**: Is this person trying to be funny, supportive, dismissive, or actually harmful? Sometimes "aggressive" language is just enthusiastic agreement.

**Harm Assessment Priority**: When in doubt between unfriendly and harmful, err on the side of protection. Content that could genuinely hurt someone's mental health or self-esteem should be flagged as harmful, even if the author claims it's "just a joke."

**Visual Analysis**: When replies include images or GIFs:
- Analyze the visual content alongside the text
- Consider how memes, reaction GIFs, or images change the meaning
- A harsh comment with a laughing GIF might be jest, not unfriendly
- Look for visual cues about tone and intent
- Note if images contradict or enhance the text message

## AUTHOR IMPORTANCE:
Look for: Brand names, media outlets, verified-seeming handles, business-related usernames, or usernames suggesting influence (not just random numbers/letters).

## YOUR JUSTIFICATION:
Write like a human, not a bot. Explain the specific language choices, context clues, or cultural markers that led to your classification. Be specific about what you noticed."""
        
        super().__init__("reply_analyzer", system_prompt)
        
        # Set up logging
        self.logger = logging.getLogger("reply_analyzer")
        self.logger.setLevel(logging.INFO)
        
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
        
        # Tools will be used in future iterations for actual moderation actions
        # For now, we focus on analysis only without tool calls

    async def analyze_replies(self, post: Post, replies: List[Reply], post_analysis: PostAnalysisResult) -> List[ReplyAnalysisResult]:
        self.logger.info(f"🔍 Starting reply analysis for {len(replies)} replies")
        self.logger.info(f"📝 Post context: {post_analysis.category} post with {post_analysis.sentiment} sentiment")
        
        # Process replies in batches for efficiency
        batch_size = 12  # Increased from 5 to 12 for better performance
        results = []
        
        for i in range(0, len(replies), batch_size):
            batch = replies[i:i + batch_size]
            self.logger.info(f"📦 Processing batch {i//batch_size + 1}/{(len(replies) + batch_size - 1)//batch_size}")
            
            # Process batch concurrently
            batch_tasks = [self._analyze_single_reply(reply, post, post_analysis) for reply in batch]
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            # Handle results and exceptions
            for j, result in enumerate(batch_results):
                if isinstance(result, Exception):
                    self.logger.error(f"❌ Failed to analyze reply {batch[j].id}: {str(result)}")
                    # Create fallback result
                    fallback_result = ReplyAnalysisResult(
                        reply_id=batch[j].id,
                        sentiment="friendly",  # Default to friendly when analysis fails
                        justification=f"Analysis failed: {str(result)}",
                        should_hide=False,
                        author_important=batch[j].author.important
                    )
                    results.append(fallback_result)
                else:
                    results.append(result)
        
        self.logger.info(f"✅ Completed analysis of {len(results)} replies")
        return results
    
    async def _analyze_single_reply(self, reply: Reply, post: Post, post_analysis: PostAnalysisResult) -> ReplyAnalysisResult:
        self.logger.info(f"🔍 Analyzing reply {reply.id} by {reply.author.name}")
        
        # Prepare text content for analysis
        text_content = f"""ORIGINAL POST ANALYSIS:
Category: {post_analysis.category}
Sentiment: {post_analysis.sentiment}
Analysis: {post_analysis.analysis}
Confidence: {post_analysis.confidence_score}

ORIGINAL POST:
Author: {post.author.name} (verified: {post.author.verified})
Content: {post.content}
Type: {post.type}"""
        
        # Add original post image context if available
        if post.image_url:
            text_content += f"\nOriginal Post Image: {post.image_url}"
        
        text_content += f"""\n\nREPLY TO ANALYZE:
Reply ID: {reply.id}
Author: {reply.author.name} (verified: {reply.author.verified})
Content: {reply.content}
Type: {reply.type}
Language: {reply.language}
Media URL: {reply.media_url or 'None'}"""
        
        # Prepare image URLs for the reply if present
        image_urls = []
        if reply.media_url and (reply.type in ['image', 'gif']):
            image_urls.append(reply.media_url)
            self.logger.info(f"🖼️ Reply {reply.id} includes {reply.type}: {reply.media_url}")
            text_content += f"\n\nPlease analyze both the reply text and the {reply.type} content. Consider how they work together and relate to the original post."
        else:
            text_content += f"\n\nPlease analyze this reply considering the original post's context and provide your assessment."
        
        # Create multimodal content
        content = await llama_client.create_multimodal_message(text_content, image_urls)
        
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": content}
        ]
        
        try:
            # Try structured output first
            self.logger.info(f"🧠 Sending reply {reply.id} to LLM for structured analysis...")
            result = await llama_client.parse_structured_output(
                messages=messages,
                response_format=ReplyAnalysisResponse
            )
            
            self.logger.info(f"✅ Structured analysis completed for reply {reply.id}: {result.sentiment}")
            
            analysis_result = ReplyAnalysisResult(
                reply_id=reply.id,
                sentiment=result.sentiment,
                justification=result.justification,
                should_hide=result.should_hide,
                author_important=result.author_important
            )
            
            return analysis_result
            
        except Exception as e:
            self.logger.warning(f"⚠️ Structured output failed for reply {reply.id}: {str(e)}")
            self.logger.info(f"🔄 Falling back to regular chat completion for reply {reply.id}...")
            
            # Fallback to regular chat completion
            regular_result = await llama_client.chat_completion(messages=messages)
            
            self.logger.info(f"✅ Fallback analysis completed for reply {reply.id}")
            
            analysis_result = ReplyAnalysisResult(
                reply_id=reply.id,
                sentiment="friendly",  # Default to friendly when analysis fails
                justification=regular_result["content"][:200] + "..." if len(regular_result["content"]) > 200 else regular_result["content"],
                should_hide=False,
                author_important=reply.author.important
            )
            
            return analysis_result

    async def handle_tool_call(self, tool_call):
        # No tools currently implemented for reply analyzer
        return "No tools available for reply analyzer"
from .base_agent import BaseAgent
from models.schemas import Post, Reply, ReplyAnalysisResult, PostAnalysisResult
from services.llm_client import llama_client
from services.content_moderation import content_moderation_service
from pydantic import BaseModel
from typing import List, Literal, Optional, Dict, Any
import asyncio
import logging
import json
from datetime import datetime

class ReplyAnalysisResponse(BaseModel):
    sentiment: Literal["friendly", "unfriendly", "harmful", "silly"]
    justification: str
    confidence_score: float
    should_hide: bool
    author_important: bool

class ReplyAnalyzerAgent(BaseAgent):
    def __init__(self):
        system_prompt = """You are a sharp, perceptive social media analyst who reads between the lines. Your job is to decode the true intent and tone behind each reply, considering the messy reality of internet communication.

## THE FOUR CLASSIFICATIONS (choose exactly one):

**FRIENDLY** - Genuine positivity, support, or constructive engagement
- Examples: "Beautiful photo!" | "Thanks for sharing this" | "I love this!" | "Great point!" | "Totally agree"
- Sincere appreciation, helpful comments, genuine compliments
- Sharing similar experiences in a positive way
- Agreement or enthusiasm without jokes/memes
- Straightforward positive reactions, even if brief

**SILLY** - Jokes, memes, playful banter, humorous content  
- Examples: "BROOOO 😂😂😂" | "Same energy fr" | Clear jokes or puns | Obvious meme references
- MUST have clear humorous intent - not just casual language or emojis
- Sarcasm that's clearly meant to be funny, not hurtful
- Actual attempts at comedy, not just informal speech

**UNFRIENDLY** - Negative, critical, or dismissive but not targeting the person directly
- Examples: "This is stupid" | "Nobody cares" | "This ain't it" | "Cringe" | "Who asked?"
- Criticism without constructive intent | Dismissive attitudes
- General negativity about the content/idea, not personal attacks on the poster
- Passive-aggressive comments | Eye-roll energy without humor

**HARMFUL** - Content that crosses the line into abuse, harassment, or genuine harm
- Examples: "kill yourself" | "delete your account loser" | Personal attacks | Targeted harassment
- Any suicide ideation, self-harm suggestions, or death wishes
- Hate speech targeting identity, appearance, or personal characteristics  
- Threats (even "joking" ones) | Content designed to intimidate or silence
- Personal insults about appearance, intelligence, worth as a person
- Slurs or dehumanizing language

## YOUR ANALYSIS APPROACH:

**Balance is Key**: Don't default to "silly" just because someone uses emojis or casual language. Many friendly comments use emojis too. Reserve "silly" for actual attempts at humor.

**Read Intent Carefully**: 
- "Love this!" with hearts = FRIENDLY (not silly)
- "LMAOOO this is me when..." = SILLY (clear humor)
- "Whatever" or "Ok." = UNFRIENDLY (dismissive)
- "You're worthless" = HARMFUL (personal attack)

**Context Matters**: Consider the original post's tone, but don't let it override the actual content of the reply.

**When Uncertain**: 
- Between friendly and silly? Ask: Is this trying to make people laugh or just being positive?
- Between unfriendly and harmful? Ask: Is this attacking the person or just the content?
- Default to the less extreme classification when truly ambiguous

**Visual Analysis**: When replies include images or GIFs:
- Analyze the visual content alongside the text
- A supportive GIF without jokes = FRIENDLY
- Meme images or reaction GIFs with humor = SILLY
- Dismissive or negative images = UNFRIENDLY or HARMFUL based on severity

## AUTHOR IMPORTANCE:
Look for: Brand names, media outlets, verified-seeming handles, business-related usernames, or usernames suggesting influence.

## YOUR JUSTIFICATION:
Explain your reasoning concisely. Focus on the specific elements that drove your classification."""
        
        super().__init__("reply_analyzer", system_prompt)
        
        # Set up logging
        self.logger = logging.getLogger("reply_analyzer")
        self.logger.setLevel(logging.INFO)
        
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
        
        # Define the content moderation tool with strict schema
        self.tools = [
            {
                "type": "function",
                "function": {
                    "name": "hide_harmful_content",
                    "description": "Hide or blur harmful/unfriendly content in the HaterAide UI to protect the user from seeing hateful or negative replies",
                    "strict": True,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "reply_id": {
                                "type": "string",
                                "description": "The ID of the reply to moderate"
                            },
                            "action_type": {
                                "type": "string",
                                "enum": ["blur", "hide"],
                                "description": "Whether to blur the content (still partially visible) or completely hide it"
                            },
                            "reason": {
                                "type": "string",
                                "description": "Brief explanation of why this content is being moderated"
                            },
                            "sentiment": {
                                "type": "string",
                                "enum": ["harmful", "unfriendly"],
                                "description": "The sentiment classification that triggered this moderation"
                            }
                        },
                        "required": ["reply_id", "action_type", "reason", "sentiment"],
                        "additionalProperties": False
                    }
                }
            }
        ]

    async def analyze_replies_with_updates(self, post: Post, replies: List[Reply], post_analysis: PostAnalysisResult, results_file_path: str) -> List[ReplyAnalysisResult]:
        """Analyze replies with incremental updates to JSON file"""
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        accumulated_results = []
        
        # Create mapping of reply_id to original reply
        reply_id_to_data = {reply.id: reply for reply in replies}
        
        # Function to update the JSON file with current progress
        def update_results_file():
            current_output = {
                "hateraide_session": {
                    "session_id": session_id,
                    "timestamp": datetime.now().isoformat(),
                    "trigger": "enable_hateraide_button",
                    "status": "in_progress" if len(accumulated_results) < len(replies) else "success",
                    "post_id": post.id
                },
                "reply_analyzer_results": {
                    "agent": "reply_analyzer",
                    "analysis_timestamp": datetime.now().isoformat(),
                    "llm_endpoint": "llama-4-scout-17b-16e-instruct-fp8",
                    "total_replies_analyzed": len(accumulated_results),
                    "replies_with_harmful_content": len([r for r in accumulated_results if r.sentiment == "harmful"]),
                    "important_authors_found": len([r for r in accumulated_results if r.author_important]),
                    "reply_analyses": [
                        {
                            "reply_id": result.reply_id,
                            "analysis_status": "success",
                            "analysis_result": {
                                "sentiment": result.sentiment,
                                "justification": result.justification,
                                "should_hide": result.should_hide,
                                "author_important": result.author_important,
                                "moderation_actions": self._get_moderation_actions(result.reply_id)
                            },
                            # Add original reply data
                            "original_reply": reply_id_to_data[result.reply_id].dict() if result.reply_id in reply_id_to_data else {}
                        }
                        for result in accumulated_results
                    ],
                    "status": "in_progress" if len(accumulated_results) < len(replies) else "completed"
                },
                "post_context": {
                    "post_id": post.id,
                    "post_content": post.content,
                    "post_category": post_analysis.category,
                    "post_sentiment": post_analysis.sentiment,
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
            
            # Write current results
            with open(results_file_path, 'w') as f:
                json.dump(current_output, f, indent=2)
        
        # Process replies in batches
        batch_size = 12
        
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
                    accumulated_results.append(fallback_result)
                else:
                    accumulated_results.append(result)
            
            # Update the JSON file after each batch
            update_results_file()
            self.logger.info(f"📝 Updated results file with {len(accumulated_results)} analyzed replies")
        
        self.logger.info(f"✅ Completed analysis of {len(accumulated_results)} replies")
        return accumulated_results
    
    def _get_moderation_actions(self, reply_id: str) -> List[dict]:
        """Get moderation actions for a specific reply"""
        from services.content_moderation import content_moderation_service
        action = content_moderation_service.get_moderation_status(reply_id)
        if action:
            return [action]
        return []
    
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
        
        # Add tool usage instructions
        text_content += """\n\nIMPORTANT: If you determine that this reply is HARMFUL or UNFRIENDLY, you MUST use the hide_harmful_content tool to protect the user from seeing this content in the HaterAide UI. 
- For HARMFUL content: use action_type="hide" to completely remove it from view
- For UNFRIENDLY content: use action_type="blur" to make it less prominent but still accessible

Only use the tool for replies that are genuinely harmful or unfriendly. Do not use it for friendly or silly content."""
        
        # Create multimodal content
        content = await llama_client.create_multimodal_message(text_content, image_urls)
        
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": content}
        ]
        
        try:
            # Use regular chat completion with tools for better compatibility
            self.logger.info(f"🧠 Sending reply {reply.id} to LLM for analysis with tool support...")
            
            # Add instructions for structured response
            analysis_messages = messages + [{
                "role": "system",
                "content": """Please analyze this reply and provide a response in the following JSON format:
{
  "sentiment": "friendly" | "unfriendly" | "harmful" | "silly",
  "justification": "Brief explanation of your classification",
  "confidence_score": 0.0 to 1.0,
  "should_hide": true/false,
  "author_important": true/false
}

ALSO: If the sentiment is "harmful" or "unfriendly", you MUST call the hide_harmful_content tool."""
            }]
            
            response = await llama_client.chat_completion(
                messages=analysis_messages,
                tools=self.tools,
                temperature=0.3
            )
            
            # Parse the response
            content = response["content"]
            tool_calls = response.get("tool_calls", [])
            
            # Try to parse JSON from content
            import re
            json_match = re.search(r'\{[^}]+\}', content, re.DOTALL)
            if json_match:
                import json
                try:
                    result_dict = json.loads(json_match.group())
                    result = ReplyAnalysisResponse(**result_dict)
                except:
                    # Fallback values
                    result = ReplyAnalysisResponse(
                        sentiment="friendly",
                        justification=content[:200],
                        confidence_score=0.5,
                        should_hide=False,
                        author_important=False
                    )
            else:
                # Fallback if no JSON found
                result = ReplyAnalysisResponse(
                    sentiment="friendly",
                    justification=content[:200],
                    confidence_score=0.5,
                    should_hide=False,
                    author_important=False
                )
            
            self.logger.info(f"✅ Analysis completed for reply {reply.id}: {result.sentiment}")
            
            # Process any tool calls
            if tool_calls:
                self.logger.info(f"🔧 Processing {len(tool_calls)} tool calls for reply {reply.id}")
                for tool_call in tool_calls:
                    await self._process_tool_call(tool_call, reply)
            # If no tool calls but sentiment needs moderation, call the tool manually
            elif result.sentiment in ["harmful", "unfriendly"]:
                self.logger.info(f"📢 Manually triggering moderation for {result.sentiment} reply {reply.id}")
                await content_moderation_service.hide_harmful_content(
                    reply_id=reply.id,
                    action_type="hide" if result.sentiment == "harmful" else "blur",
                    reason=result.justification[:100],
                    sentiment=result.sentiment
                )
            
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
            
            # If error is media-related, retry with text only
            if "Unable to fetch media" in str(e) or "media from URL" in str(e):
                self.logger.info(f"🔄 Retrying analysis with text only for reply {reply.id}...")
                try:
                    # Create text-only content
                    text_only_content = f"""Analyze this reply (text only, image could not be loaded):

Reply ID: {reply.id}
Author: {reply.author.name}
Content: {reply.content}
Language: {reply.language}

Please provide sentiment classification based on the text alone."""
                    
                    text_only_messages = [
                        {"role": "system", "content": self.system_prompt},
                        {"role": "user", "content": text_only_content}
                    ]
                    
                    # Add structured response instruction
                    text_only_messages.append({
                        "role": "system",
                        "content": """Please analyze this reply and provide a response in the following JSON format:
{
  "sentiment": "friendly" | "unfriendly" | "harmful" | "silly",
  "justification": "Brief explanation of your classification",
  "confidence_score": 0.0 to 1.0,
  "should_hide": true/false,
  "author_important": true/false
}"""
                    })
                    
                    retry_response = await llama_client.chat_completion(
                        messages=text_only_messages,
                        temperature=0.3
                    )
                    
                    # Parse the response
                    content = retry_response["content"]
                    import re
                    json_match = re.search(r'\{[^}]+\}', content, re.DOTALL)
                    if json_match:
                        import json
                        try:
                            result_dict = json.loads(json_match.group())
                            result = ReplyAnalysisResponse(**result_dict)
                            
                            self.logger.info(f"✅ Text-only analysis successful for reply {reply.id}: {result.sentiment}")
                            
                            # Process moderation if needed
                            if result.sentiment in ["harmful", "unfriendly"]:
                                await content_moderation_service.hide_harmful_content(
                                    reply_id=reply.id,
                                    action_type="hide" if result.sentiment == "harmful" else "blur",
                                    reason=result.justification[:100],
                                    sentiment=result.sentiment
                                )
                            
                            return ReplyAnalysisResult(
                                reply_id=reply.id,
                                sentiment=result.sentiment,
                                justification=result.justification + " (Image analysis skipped due to loading error)",
                                should_hide=result.should_hide,
                                author_important=result.author_important
                            )
                        except:
                            pass
                except Exception as retry_error:
                    self.logger.error(f"❌ Text-only retry also failed for reply {reply.id}: {str(retry_error)}")
            
            # Final fallback
            self.logger.info(f"🔄 Falling back to basic completion for reply {reply.id}...")
            
            analysis_result = ReplyAnalysisResult(
                reply_id=reply.id,
                sentiment="friendly",  # Default to friendly when all analysis fails
                justification=f"Analysis failed: {str(e)}",
                should_hide=False,
                author_important=reply.author.important
            )
            
            return analysis_result

    async def _process_tool_call(self, tool_call: Dict[str, Any], reply: Reply):
        """Process a tool call from the LLM"""
        try:
            if tool_call.function.name == "hide_harmful_content":
                # Parse the arguments
                args = json.loads(tool_call.function.arguments)
                
                self.logger.info(f"🛡️ Moderating reply {args['reply_id']}: {args['action_type']} - {args['reason']}")
                
                # Call the content moderation service
                await content_moderation_service.hide_harmful_content(
                    reply_id=args["reply_id"],
                    action_type=args["action_type"],
                    reason=args["reason"],
                    sentiment=args["sentiment"]
                )
                
                self.logger.info(f"✅ Successfully moderated reply {args['reply_id']}")
            else:
                self.logger.warning(f"Unknown tool call: {tool_call.function.name}")
                
        except Exception as e:
            self.logger.error(f"❌ Error processing tool call: {str(e)}")
    
    async def handle_tool_call(self, tool_call):
        # Legacy method for compatibility with BaseAgent
        return "Tool calls are handled inline during reply analysis"
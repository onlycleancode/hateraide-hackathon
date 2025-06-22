import json
import os
from datetime import datetime
from typing import List, Dict, Any
from services.llm_client import llama_client

class NextStepAgent:
    def __init__(self):
        self.name = "next_step"
        self.system_prompt = """You are a strategic advisor for viral social media engagement. 

Analyze reply data to identify important responders (celebrities, brands, verified accounts, influencers) and provide actionable next steps.

For each important responder, consider:
- Their comment content and sentiment
- Their influence/importance level
- The best engagement strategy (reply publicly, send DM, ignore, etc.)
- Potential business opportunities or risks

Provide specific, actionable recommendations in a conversational tone."""

    async def analyze_and_generate_next_steps(self, reply_analyzer_results: Dict) -> Dict[str, Any]:
        """Main method to analyze reply data and generate next steps"""
        
        # Extract important responders from reply analyzer results
        important_responders = []
        all_replies = reply_analyzer_results.get("reply_analyzer_results", {}).get("reply_analyses", [])
        
        for reply in all_replies:
            if reply.get("analysis_result", {}).get("author_important", False):
                original_reply = reply.get("original_reply", {})
                # Extract complete reply information
                important_responders.append({
                    "reply_id": reply.get("reply_id"),
                    "author_name": original_reply.get("author", {}).get("name", f"Unknown_{reply.get('reply_id', 'unknown')}"),
                    "author_avatar": original_reply.get("author", {}).get("avatar", ""),
                    "comment": original_reply.get("content", "No content available"),
                    "comment_type": original_reply.get("type", "text"),
                    "media_url": original_reply.get("media_url"),
                    "sentiment": reply.get("analysis_result", {}).get("sentiment"),
                    "justification": reply.get("analysis_result", {}).get("justification", ""),
                    "is_verified": original_reply.get("author", {}).get("verified", False),
                    "language": original_reply.get("language", "en")
                })
        
        if not important_responders:
            return self._generate_no_important_responders_result()
        
        # Get post context for better analysis
        post_context = reply_analyzer_results.get("post_context", {})
        
        # Generate next steps using LLM
        next_steps = await self._generate_llm_next_steps(important_responders, reply_analyzer_results)
        
        # Create final result structure
        result = {
            "next_step_analysis": {
                "agent": "next_step",
                "analysis_timestamp": datetime.now().isoformat(),
                "important_responders_found": len(important_responders),
                "important_responders": important_responders,
                "recommended_next_steps": next_steps.get("recommended_actions", []),
                "summary": self._generate_summary(important_responders, next_steps.get("recommended_actions", [])),
                "status": "completed"
            },
            "post_context": post_context,
            "hateraide_session": reply_analyzer_results.get("hateraide_session", {}),
            "system_info": {
                "backend_version": "1.0.0",
                "python_agent": "next_step",
                "llm_model": "Llama-4-Scout-17B-16E-Instruct-FP8",
                "processing_method": "strategic_analysis"
            }
        }
        
        # Save to next_steps.json
        await self._save_results(result)
        
        return result

    def _generate_summary(self, important_responders: List[Dict], recommended_actions: List[Dict]) -> str:
        """Generate a summary of important responders and recommended actions"""
        if not important_responders:
            return "No important responders found in this viral post."
        
        summary_parts = []
        summary_parts.append(f"Found {len(important_responders)} important responder(s):")
        
        for responder in important_responders:
            name = responder['author_name']
            verified = "✓" if responder['is_verified'] else ""
            sentiment = responder['sentiment']
            summary_parts.append(f"• {name}{verified} ({sentiment}): \"{responder['comment'][:50]}...\"")
        
        if recommended_actions:
            summary_parts.append("\nKey recommendations:")
            for i, action in enumerate(recommended_actions[:3]):  # Top 3 recommendations
                summary_parts.append(f"{i+1}. {action.get('description', 'No description')}")
        
        return "\n".join(summary_parts)

    def _generate_no_important_responders_result(self) -> Dict[str, Any]:
        """Generate result when no important responders are found"""
        return {
            "next_step_analysis": {
                "agent": "next_step",
                "analysis_timestamp": datetime.now().isoformat(),
                "important_responders_found": 0,
                "important_responders": [],
                "recommended_next_steps": [
                    {
                        "action": "monitor_engagement",
                        "description": "Continue monitoring for important responders as the post gains traction",
                        "priority": "low"
                    },
                    {
                        "action": "engage_community",
                        "description": "Respond to friendly comments to build community engagement",
                        "priority": "medium"
                    }
                ],
                "status": "completed"
            }
        }

    async def _generate_llm_next_steps(self, important_responders: List[Dict], context: Dict) -> Dict[str, Any]:
        """Use LLM to generate strategic next steps"""
        
        prompt = f"""
        Based on the analysis of important responders to a viral social media post, provide strategic next steps.

        Important Responders Found: {len(important_responders)}
        
        Context:
        - Post type: {context.get('post_context', {}).get('post_category', 'unknown')}
        - Post sentiment: {context.get('post_context', {}).get('post_sentiment', 'unknown')}
        - Total replies: {context.get('post_context', {}).get('total_replies', 0)}

        Important Responders Details:
        {json.dumps(important_responders, indent=2)}

        For each important responder, provide specific next step recommendations. Consider:
        1. Their actual comment content and tone
        2. Whether they're verified (blue checkmark) or a known brand
        3. The sentiment of their comment (friendly/silly/unfriendly/harmful)
        4. Language and cultural considerations
        5. Business/networking opportunities
        6. Whether to reply publicly, send DM, or engage differently

        For brands (like Bud Light, Coors Light, etc.):
        - Consider partnership or sponsorship opportunities
        - Craft witty, engaging responses that could lead to collaboration
        - Be playful but professional

        For celebrities/verified accounts:
        - Match their energy and tone
        - Consider the networking value
        - Be authentic but strategic

        Respond ONLY in JSON format with this structure:
        {{
            "recommended_actions": [
                {{
                    "responder": "exact responder name",
                    "reply_id": "reply_id",
                    "action": "reply_publicly|send_dm|ignore|follow_up",
                    "description": "detailed description of what to do and why",
                    "priority": "high|medium|low",
                    "suggested_response": "exact text they should reply with (be creative, match the vibe)",
                    "reasoning": "strategic reasoning for this approach",
                    "opportunity_type": "business|networking|community|brand_partnership|none"
                }}
            ]
        }}
        """

        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": prompt}
        ]

        result = await llama_client.chat_completion(messages=messages)
        
        try:
            # Try to parse JSON from the response
            response_text = result.get("content", "")
            # Extract JSON if it's wrapped in markdown code blocks
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            return json.loads(response_text)
        except (json.JSONDecodeError, KeyError):
            # Fallback if JSON parsing fails
            return {
                "recommended_actions": [
                    {
                        "action": "review_manually",
                        "description": "LLM response requires manual review",
                        "priority": "medium",
                        "reasoning": "Could not parse structured response from LLM"
                    }
                ]
            }

    async def _save_results(self, results: Dict[str, Any]):
        """Save results to next_steps.json"""
        output_file = "frontend/public/next_steps.json"
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Next steps analysis saved to {output_file}")

    async def get_reply_suggestion(self, reply_id: str, author_name: str, comment_content: str, post_context: Dict) -> Dict[str, Any]:
        """Generate a specific reply suggestion for a notable user's comment"""
        
        system_prompt = """You are a social media strategist helping someone craft the perfect reply to an important person's comment on their viral post.

Consider:
- The commenter's status and influence
- The tone and content of their comment
- The original post context
- Potential business/networking opportunities
- Maintaining authenticity while being strategic

Provide a suggested reply that is:
- Engaging and authentic
- Appropriate for the relationship level
- Potentially beneficial for networking/business
- Respectful of the commenter's status
- Natural and conversational

Also explain your reasoning for the suggestion."""

        prompt = f"""
        ORIGINAL POST CONTEXT:
        Content: "{post_context.get('content', '')}"
        Category: {post_context.get('category', 'unknown')}
        Sentiment: {post_context.get('sentiment', 'unknown')}

        NOTABLE COMMENTER:
        Name: {author_name}
        Comment: "{comment_content}"

        Suggest a reply that would be:
        1. Appropriate for this person's status
        2. Engaging and likely to continue positive interaction  
        3. Potentially beneficial for networking/opportunities
        4. Authentic to the original poster's voice

        Respond in JSON format:
        {{
            "suggested_reply": "the actual suggested text to reply with",
            "reasoning": "why this approach works well",
            "tone": "friendly|professional|casual|humorous",
            "opportunity_notes": "any potential networking/business opportunities this might create"
        }}
        """

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]

        result = await llama_client.chat_completion(messages=messages)
        
        try:
            response_text = result.get("content", "")
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            suggestion_data = json.loads(response_text)
            
            return {
                "reply_id": reply_id,
                "author_name": author_name,
                "suggestion": suggestion_data,
                "timestamp": datetime.now().isoformat(),
                "status": "success"
            }
        except (json.JSONDecodeError, KeyError):
            return {
                "reply_id": reply_id,
                "author_name": author_name,
                "suggestion": {
                    "suggested_reply": f"Thanks for the comment, {author_name}! 🙏",
                    "reasoning": "Fallback response - LLM parsing failed",
                    "tone": "friendly",
                    "opportunity_notes": "Manual review recommended"
                },
                "timestamp": datetime.now().isoformat(),
                "status": "fallback"
            }

    async def handle_tool_call(self, tool_call):
        """Handle tool calls (not used in current implementation)"""
        return "Tool calls not implemented in current version"
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
                important_responders.append({
                    "reply_id": reply.get("reply_id"),
                    "author_name": self._extract_author_name(reply),
                    "comment": self._extract_comment_content(reply),
                    "sentiment": reply.get("analysis_result", {}).get("sentiment"),
                    "analysis": reply.get("analysis_result", {})
                })
        
        if not important_responders:
            return self._generate_no_important_responders_result()
        
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
                "status": "completed"
            },
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

    def _extract_author_name(self, reply: Dict) -> str:
        """Extract author name from reply data"""
        # This would normally come from the original reply data structure
        # For now, we'll use a placeholder since the current data doesn't include author names
        return f"Author_{reply.get('reply_id', 'unknown')}"
    
    def _extract_comment_content(self, reply: Dict) -> str:
        """Extract comment content from reply analysis"""
        justification = reply.get("analysis_result", {}).get("justification", "")
        # Extract the actual comment from the justification text
        # This is a temporary solution until we have better data structure
        return "Comment content not available in current data structure"

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

        Important Responders:
        {json.dumps(important_responders, indent=2)}

        For each important responder, provide specific next step recommendations. Consider:
        1. Should they reply publicly or send a DM?
        2. What tone should they use?
        3. Are there business opportunities?
        4. What are the risks/benefits?

        Respond in JSON format with this structure:
        {{
            "recommended_actions": [
                {{
                    "responder": "responder_name",
                    "action": "reply_publicly|send_dm|ignore|follow_up",
                    "description": "detailed description of what to do",
                    "priority": "high|medium|low",
                    "suggested_response": "draft response if applicable",
                    "reasoning": "why this action is recommended"
                }}
            ]
        }}
        """

        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": prompt}
        ]

        result = await llama_client.chat_completion(messages=messages, tools=None)
        
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
        output_file = "next_steps.json"
        
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

    async def handle_tool_call(self, tool_call):
        """Handle tool calls (not used in current implementation)"""
        return "Tool calls not implemented in current version"
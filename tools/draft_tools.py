from typing import Dict, List, Any

class DraftTools:
    @staticmethod
    def draft_business_response(business_name: str, their_message: str, context: str) -> Dict[str, Any]:
        """Draft a response to a business/brand"""
        templates = {
            "positive": f"Thank you {business_name}! We'd love to explore opportunities together.",
            "collaboration": f"Hi {business_name}, thanks for reaching out! Let's connect about potential collaboration.",
            "appreciation": f"Wow, thank you {business_name} for the support! This means a lot."
        }
        
        # Simple sentiment detection for template selection
        if "love" in their_message.lower() or "great" in their_message.lower():
            template_type = "positive"
        elif "collab" in their_message.lower() or "partner" in their_message.lower():
            template_type = "collaboration"
        else:
            template_type = "appreciation"
        
        return {
            "recipient": business_name,
            "draft_message": templates[template_type],
            "template_type": template_type,
            "context": context
        }
    
    @staticmethod
    def draft_influencer_response(influencer_name: str, their_message: str, follower_count: int = 0) -> Dict[str, Any]:
        """Draft a response to an influencer"""
        if follower_count > 100000:
            tone = "professional"
            message = f"Hi {influencer_name}, thank you for the shoutout! Your support means the world."
        else:
            tone = "friendly"
            message = f"Hey {influencer_name}! Thanks for the love, really appreciate you!"
        
        return {
            "recipient": influencer_name,
            "draft_message": message,
            "tone": tone,
            "follower_count": follower_count
        }
    
    @staticmethod
    def draft_generic_response(username: str, their_message: str, sentiment: str) -> Dict[str, Any]:
        """Draft a generic response based on sentiment"""
        responses = {
            "positive": f"Thank you {username}! Really appreciate the kind words.",
            "negative": f"Hi {username}, thanks for the feedback. We appreciate different perspectives.",
            "neutral": f"Hey {username}, thanks for engaging with the post!"
        }
        
        return {
            "recipient": username,
            "draft_message": responses.get(sentiment, responses["neutral"]),
            "sentiment": sentiment
        }
    
    @staticmethod
    def generate_follow_up_content(viral_context: str, engagement_type: str) -> Dict[str, Any]:
        """Generate follow-up content ideas based on viral moment"""
        suggestions = {
            "positive_viral": [
                "Behind-the-scenes content about the viral moment",
                "Thank you post to the community",
                "Related content that builds on the viral topic"
            ],
            "negative_viral": [
                "Clarification or explanation post",
                "Positive content to shift narrative",
                "Community appreciation post"
            ],
            "mixed_viral": [
                "Balanced follow-up addressing different perspectives",
                "Educational content related to the topic",
                "Community engagement post"
            ]
        }
        
        return {
            "content_type": engagement_type,
            "suggestions": suggestions.get(engagement_type, suggestions["mixed_viral"]),
            "context": viral_context
        }
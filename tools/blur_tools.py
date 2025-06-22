from typing import Dict, List, Any
from models.schemas import Reply

class BlurTools:
    @staticmethod
    def should_blur_reply(reply: Reply, sentiment: str) -> bool:
        """Determine if a reply should be blurred based on sentiment"""
        blur_sentiments = ["harmful", "unfriendly"]
        return sentiment in blur_sentiments
    
    @staticmethod
    def apply_blur_filter(replies: List[Reply], analysis_results: List[Dict]) -> List[Dict[str, Any]]:
        """Apply blur filters to replies based on analysis"""
        blur_actions = []
        
        for reply, analysis in zip(replies, analysis_results):
            if BlurTools.should_blur_reply(reply, analysis.get("sentiment", "unknown")):
                blur_action = {
                    "reply_id": reply.id,
                    "action": "blur",
                    "reason": analysis.get("justification", "Inappropriate content"),
                    "blur_level": "full" if analysis.get("sentiment") == "harmful" else "partial"
                }
                blur_actions.append(blur_action)
        
        return blur_actions
    
    @staticmethod
    def create_content_warning(content_type: str, severity: str) -> Dict[str, Any]:
        """Create content warning for sensitive content"""
        warnings = {
            "harmful": "This content may contain harmful language",
            "unfriendly": "This content may be negative or unfriendly",
            "explicit": "This content may be explicit"
        }
        
        return {
            "warning": warnings.get(severity, "This content may be sensitive"),
            "severity": severity,
            "show_anyway": True
        }
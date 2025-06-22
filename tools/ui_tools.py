from typing import Dict, List, Any

class UITools:
    @staticmethod
    def hide_reply(reply_id: str, reason: str) -> Dict[str, Any]:
        """Hide a reply in the UI"""
        return {
            "action": "hide_reply",
            "reply_id": reply_id,
            "reason": reason,
            "hidden": True
        }
    
    @staticmethod
    def blur_reply(reply_id: str, blur_level: str = "partial") -> Dict[str, Any]:
        """Blur a reply in the UI"""
        return {
            "action": "blur_reply",
            "reply_id": reply_id,
            "blur_level": blur_level,
            "blurred": True
        }
    
    @staticmethod
    def highlight_important_reply(reply_id: str, author_type: str) -> Dict[str, Any]:
        """Highlight an important reply"""
        return {
            "action": "highlight_reply",
            "reply_id": reply_id,
            "author_type": author_type,
            "highlighted": True
        }
    
    @staticmethod
    def update_post_metadata(post_id: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Update post metadata like sentiment, analysis results"""
        return {
            "action": "update_metadata",
            "post_id": post_id,
            "metadata": metadata
        }
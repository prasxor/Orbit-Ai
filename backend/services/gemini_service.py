import os
import logging
import requests
import time
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()

class GeminiService:
    def __init__(self):
        keys_str = os.getenv("GEMINI_API_KEYS", "")
        self.api_keys = [k.strip() for k in keys_str.split(",") if k.strip()]
        
        # Fallback to single key if that's what's available
        if not self.api_keys:
            single_key = os.getenv("GEMINI_API_KEY", "")
            if single_key:
                self.api_keys = [single_key.strip()]
                
        self.current_key_index = 0
        self.blocked_keys = {}
        self.cooldown_seconds = 30 * 60 # 30 minutes
        
        # 2.5-flash is fast enough for dynamic sql generation
        self.model = "gemini-2.5-flash"
        self.base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"

    def _get_next_key(self):
        if not self.api_keys:
            raise ValueError("No Gemini API keys configured. Set GEMINI_API_KEYS in .env")
            
        # Clean up expired bans
        current_time = time.time()
        expired_keys = [k for k, unblock_time in self.blocked_keys.items() if current_time >= unblock_time]
        for k in expired_keys:
            del self.blocked_keys[k]

        # Find the next available unblocked key
        start_index = self.current_key_index
        for _ in range(len(self.api_keys)):
            key = self.api_keys[self.current_key_index]
            self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)
            
            if key not in self.blocked_keys:
                return key
                
        # If we reach here, all keys are actively blocked
        raise Exception("All API keys are temporarily rate limited. Please try again later.")

    def generate_content(self, prompt: str) -> str:
        if not self.api_keys:
             raise ValueError("No Gemini API keys configured. Set GEMINI_API_KEYS in .env")

        # max 5 attempts to failover on 429 rate limits
        max_attempts = min(len(self.api_keys) + 2, 5)
        attempts = 0
        last_error = None

        while attempts < max_attempts:
            # cycle to next key
            api_key = self._get_next_key()
            url = f"{self.base_url}?key={api_key}"
            
            # format exactly as gemini rest api expects
            payload = {
                "contents": [{
                    "role": "user",
                    "parts": [{"text": prompt}]
                }],
                "generationConfig": {
                    "temperature": 0.1, # keep low for deterministic json parsing
                }
            }

            try:
                response = requests.post(url, json=payload, timeout=30)
                
                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get("candidates", [])
                    if candidates and candidates[0].get("content", {}).get("parts"):
                        return candidates[0]["content"]["parts"][0].get("text", "")
                    else:
                        raise Exception(f"Unexpected empty response structure: {data}")
                        
                elif response.status_code in [429]:
                    # Rate limited: Block THIS specific key for 30 minutes
                    self.blocked_keys[api_key] = time.time() + self.cooldown_seconds
                    last_error = f"HTTP 429: Rate limited. Blocking key for {self.cooldown_seconds}s."
                    logger.warning(f"Gemini API rate limit hit. Rotating key.")
                
                elif response.status_code in [401, 403, 500, 503]:
                    # Other remote issues, rotate and try next
                    last_error = f"HTTP {response.status_code}: {response.text}"
                    logger.warning(f"Gemini API failure (HTTP {response.status_code}). Rotating key...")
                else:
                    response.raise_for_status()

            except requests.exceptions.RequestException as e:
                last_error = str(e)
                logger.warning(f"Request exception: {str(e)}. Rotating key...")

            attempts += 1

        if last_error and str(last_error).startswith("All API keys"):
            raise Exception(last_error)
            
        raise Exception(f"Failed to generate content from Gemini after {attempts} attempts. Last error: {last_error}")

gemini_service = GeminiService()

def query_gemini(prompt: str) -> str:
    """Helper function to run inference against Gemini API."""
    return gemini_service.generate_content(prompt)

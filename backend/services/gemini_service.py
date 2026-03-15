import os
import logging
import requests
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
        
        # 2.5-flash is fast enough for dynamic sql generation
        self.model = "gemini-2.5-flash"
        self.base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"

    def _get_next_key(self):
        if not self.api_keys:
            raise ValueError("No Gemini API keys configured. Set GEMINI_API_KEYS in .env")
            
        key = self.api_keys[self.current_key_index]
        self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)
        return key

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
                        
                elif response.status_code in [429, 401, 403, 500, 503]:
                    # Rate limits or authentication issues, rotate and try next!
                    last_error = f"HTTP {response.status_code}: {response.text}"
                    logger.warning(f"Gemini API failure (HTTP {response.status_code}). Rotating key...")
                else:
                    response.raise_for_status()

            except requests.exceptions.RequestException as e:
                last_error = str(e)
                logger.warning(f"Request exception: {str(e)}. Rotating key...")

            attempts += 1

        raise Exception(f"Failed to generate content from Gemini after {attempts} attempts. Last error: {last_error}")

gemini_service = GeminiService()

def query_gemini(prompt: str) -> str:
    """Helper function to run inference against Gemini API."""
    return gemini_service.generate_content(prompt)

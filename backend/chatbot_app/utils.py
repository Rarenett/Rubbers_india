import os
import requests
from dotenv import load_dotenv

# Load env variables
load_dotenv()

GEMINI_API_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)

def get_ai_response(user_text):
    """
    Get response from Gemini via REST API (no gRPC / no native DLLs required).
    Returns response text or None if key is missing/error.
    """
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        return None

    context = (
        "You are a helpful assistant for Jampack, a SaaS platform offering "
        "tools, pricing, and analytics. Keep answers concise."
    )
    full_prompt = f"{context}\n\nUser: {user_text}\nAssistant:"

    payload = {
        "contents": [
            {
                "parts": [{"text": full_prompt}]
            }
        ]
    }

    try:
        response = requests.post(
            GEMINI_API_URL,
            params={"key": api_key},
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as e:
        print(f"Gemini Error: {e}")
        return None

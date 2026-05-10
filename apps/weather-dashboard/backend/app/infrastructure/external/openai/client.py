from openai import OpenAI, AuthenticationError, RateLimitError, APIError
from app.config import get_settings
from app.domain.exceptions import OpenAIUnavailableException


class OpenAIClient:
    def __init__(self):
        settings = get_settings()
        if not settings.openai_api_key:
            self._client = None
        else:
            self._client = OpenAI(api_key=settings.openai_api_key)

    def chat(self, system_prompt: str, user_message: str) -> str:
        if not self._client:
            raise OpenAIUnavailableException("OpenAI API key not configured")
        try:
            response = self._client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.3,
                max_tokens=500,
            )
            return response.choices[0].message.content or ""
        except AuthenticationError:
            raise OpenAIUnavailableException("OpenAI API key is invalid or expired. Please update the OPENAI_API_KEY in the server configuration.")
        except RateLimitError:
            raise OpenAIUnavailableException("OpenAI rate limit reached. Please try again in a moment.")
        except APIError as e:
            raise OpenAIUnavailableException(f"OpenAI API error: {str(e)}")

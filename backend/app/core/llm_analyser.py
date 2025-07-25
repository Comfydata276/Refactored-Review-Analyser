from abc import ABC, abstractmethod
import re
import time
import logging
from typing import Any, List, TYPE_CHECKING, cast

# Typing helpers for optional third-party libraries =========================

if TYPE_CHECKING:
    # Import real symbols only for type-checking; at runtime these may be absent.
    import ollama as _ollama_mod  # pragma: no cover
    import openai as _openai_mod  # pragma: no cover
    import google.generativeai as _genai_mod  # pragma: no cover
    import anthropic as _anthropic_mod  # pragma: no cover

# -------------------------------------------------------------------------

# --- Dynamic Imports for LLM Libraries ---
try:
    import ollama
except ImportError:
    ollama = None
try:
    import openai
except ImportError:
    openai = None
try:
    import google.generativeai as genai
except ImportError:
    genai = None
try:
    import anthropic
except ImportError:
    anthropic = None

logger = logging.getLogger(__name__)


# --- LLMAnalyser: The Main Interface for the Orchestrator ---

class LLMAnalyser:
    """
    Manages the overall LLM analysis process. This class acts as the
    primary interface for the AnalysisOrchestrator.
    """

    def __init__(self, config_manager):
        self.config_manager = config_manager
        self.prompt = self._load_prompt()

    def _load_prompt(self):
        """Loads the analysis prompt from the specified file."""
        import os

        # 1) Try explicit path from config
        prompt_path = self.config_manager.get_setting(
            ["analysis", "prompt_file_path"], None
        )

        # 2) If not set, fallback to project-level default
        if not prompt_path:
            # e.g. <repo>/Scripts/topic_modeling_prompt.txt
            prompt_path = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "topic_modeling_prompt.txt")
            )

        # 3) Attempt to read; on failure return minimal default
        try:
            with open(prompt_path, "r", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            logger.error(f"Prompt file not found at: {prompt_path}")
            return "Default prompt: Analyse this text for sentiment."

    def get_selected_models_by_provider(self):
        """
        Reads the config and returns a dictionary of enabled models grouped by provider.
        e.g., {'ollama': ['llama3'], 'openai': ['GPT-4 Turbo']}
        """
        selected = {}
        # Correctly fetch the nested config section. Pass path list to get_setting.
        providers_config = self.config_manager.get_setting(["llm_providers"], {})
        for provider_name, config in providers_config.items():
            if config.get('enabled'):
                enabled_models = config.get('enabled_models', [])
                if enabled_models:
                    selected[provider_name] = enabled_models
        return selected

    def analyse_reviews(self, reviews, app_name, app_id, model_display_name, provider_name, progress_callback, stop_event):
        """
        Analyses a list of reviews using the specified LLM provider.
        Supports batching via analysis.api_batch_size to reduce API calls,
        and can resume from partial progress if enabled.
        """
        from .data_processor import DataProcessor
        from .llm_analyser import get_llm_provider, parse_llm_output

        data_processor = DataProcessor(self.config_manager)

        # ---- 1) Determine how many reviews to analyse and resume ----
        reviews_limit = int(self.config_manager.get_setting(
            ['analysis', 'reviews_to_analyze'], 100))
        enable_resume = self.config_manager.get_setting(
            ['analysis', 'enable_resume'], True)

        if enable_resume:
            existing, is_progress = data_processor.check_existing_analysis(
                app_name, app_id, model_display_name
            )
            if existing and len(existing) >= reviews_limit:
                progress_callback({
                    "type": "log",
                    "message": (
                        f"Already complete for {app_name}@{model_display_name}: "
                        f"{len(existing)}/{reviews_limit}"
                    ),
                    "level": "info"
                })
                return existing

            if existing:
                done = len(existing)
                remaining = reviews_limit - done
                progress_callback({
                    "type": "log",
                    "message": (
                        f"Resuming {app_name}@{model_display_name}: "
                        f"{done} done, {remaining} to go"
                    ),
                    "level": "info"
                })
                all_to_do, _ = data_processor.identify_reviews_to_analyze(
                    reviews, existing
                )
                reviews_to_analyze = all_to_do[:remaining]
                analysed_results = existing.copy()
            else:
                reviews_to_analyze = reviews[:reviews_limit]
                analysed_results = []
        else:
            reviews_to_analyze = reviews[:reviews_limit]
            analysed_results = []

        # ---- 2) Initialise progress ----
        total_target = reviews_limit
        progress_callback({"type": "progress_reviews_total", "value": total_target})
        progress_callback({
            "type": "log",
            "message": f"Target: {total_target} reviews, beginning analysis…",
            "level": "info"
        })

        periodic_interval = int(self.config_manager.get_setting(
            ['analysis', 'periodic_save_interval'], 10))

        # ---- 3) Batch size (unified) ----
        batch_size = int(self.config_manager.get_setting(
            ['analysis', 'api_batch_size'], 1))

        # ---- 4) Initialise provider ----
        api_model = self._get_api_model_name(provider_name, model_display_name)
        if not api_model:
            progress_callback({
                "type": "log",
                "message": (
                    f"Could not find API name for '{model_display_name}' "
                    f"on provider '{provider_name}'."
                ),
                "level": "error"
            })
            return analysed_results

        provider = get_llm_provider(
            provider_name, api_model, self.config_manager, progress_callback
        )
        if not provider:
            progress_callback({
                "type": "log",
                "message": f"Failed to initialise provider '{provider_name}'.",
                "level": "error"
            })
            return analysed_results

        # Pre‐compile our splitter for batched responses
        import re
        splitter = re.compile(r"Review\s*\d+\s*Analysis\s*:")

        # ---- 5) Batched path if supported ----
        can_batch = batch_size > 1 and hasattr(provider, 'analyze_batch')
        if can_batch:
            for start in range(0, len(reviews_to_analyze), batch_size):
                if stop_event.is_set():
                    progress_callback({
                        "type": "log",
                        "message": "Analysis stopped by user.",
                        "level": "info"
                    })
                    break

                chunk = reviews_to_analyze[start:start + batch_size]
                texts = [r.get('review', '') for r in chunk]

                raw_multi = provider.analyze_batch(texts, self.prompt)
                if not raw_multi:
                    continue

                parts = splitter.split(raw_multi)
                # parts[0] is header; parts[1:] map to chunk entries
                for idx, block in enumerate(parts[1:], start=1):
                    snippet = block.strip()
                    if not snippet:
                        continue
                    record = chunk[idx - 1]
                    parsed = parse_llm_output(snippet)
                    analysed_results.append({**record, **parsed})
                    progress_callback({
                        "type": "progress_reviews_current",
                        "value": len(analysed_results)
                    })

                # Periodic save
                if len(analysed_results) % periodic_interval == 0:
                    data_processor.save_analyzed_data_periodic(
                        analysed_results, app_name, app_id, model_display_name
                    )
                    progress_callback({
                        "type": "log",
                        "message": (
                            f"Periodic save: {len(analysed_results)}/"
                            f"{total_target}"
                        ),
                        "level": "info"
                    })

        # ---- 6) Fallback to single‐review loop ----
        else:
            for review in reviews_to_analyze:
                if stop_event.is_set():
                    progress_callback({
                        "type": "log",
                        "message": "Analysis stopped by user.",
                        "level": "info"
                    })
                    break

                progress_callback({
                    "type": "progress_reviews_current",
                    "value": len(analysed_results)
                })
                text = (review.get('review') or '').strip()
                if not text:
                    continue

                try:
                    raw = provider.analyze(text, self.prompt)
                    parsed = parse_llm_output(raw)
                    analysed_results.append({**review, **parsed})
                except Exception as e:
                    progress_callback({
                        "type": "log",
                        "message": f"Error analysing review: {e}",
                        "level": "error"
                    })
                    continue

                if len(analysed_results) % periodic_interval == 0:
                    data_processor.save_analyzed_data_periodic(
                        analysed_results, app_name, app_id, model_display_name
                    )
                    progress_callback({
                        "type": "log",
                        "message": (
                            f"Periodic save: {len(analysed_results)}/"
                            f"{total_target}"
                        ),
                        "level": "info"
                    })

        # ---- 7) Finalise and return ----
        progress_callback({
            "type": "progress_reviews_current",
            "value": len(analysed_results)
        })
        if analysed_results:
            data_processor.save_analyzed_data_periodic(
                analysed_results, app_name, app_id, model_display_name
            )
        progress_callback({
            "type": "log",
            "message": (
                f"Analysis complete: {len(analysed_results)}/"
                f"{total_target}"
            ),
            "level": "info"
        })

        return analysed_results

    def _get_api_model_name(self, provider_name, model_display_name):
        """
        Finds the correct API model name based on the provider and display name.
        """
        if provider_name == 'ollama':
            # For Ollama, the display name IS the API name.
            return model_display_name

        # For cloud providers, look up the api_name from the available_models list.
        available_models = self.config_manager.get_setting(['llm_providers', provider_name, 'available_models'], [])
        for model_info in available_models:
            if isinstance(model_info, dict) and model_info.get('display_name') == model_display_name:
                return model_info.get('api_name')

        logger.warning(
            f"Could not find a matching API name for display name '{model_display_name}' under provider '{provider_name}'.")
        return None


# --- Abstract Base Class for Individual Providers ---
class LLMProvider(ABC):
    def __init__(self, model_name, config_manager, progress_callback=None):
        self.model_name = model_name
        self.config = config_manager
        self.progress_callback = progress_callback
        self.retries = self.config.get_setting(['analysis', 'api_retries'], 2)
        self.retry_delay = self.config.get_setting(['analysis', 'api_retry_delay'], 5)

    def _send_log_to_gui(self, level, message):
        if self.progress_callback:
            self.progress_callback({'type': 'log', 'level': level, 'message': message})
        else:
            print(f"[{level.upper()}] {message}")

    @abstractmethod
    def analyze(self, review_text, prompt):
        pass

    def _construct_full_prompt(self, review_text, prompt):
        return f"Review Text:\n\"\"\"\n{review_text}\n\"\"\"\n\n---\n\n{prompt}"

    def _retry_wrapper(self, analysis_function):
        for attempt in range(self.retries + 1):
            try:
                return analysis_function()
            except Exception as e:
                error_msg = f"Error with {self.__class__.__name__} (Attempt {attempt + 1}): {e}"
                logger.warning(error_msg)
                self._send_log_to_gui('warning', error_msg)
                if attempt < self.retries:
                    time.sleep(self.retry_delay)
                else:
                    self._send_log_to_gui('error',
                                          f"Max retries reached for {self.__class__.__name__}. Aborting this review.")
                    return None

    # Optional – subclasses override if they support batching
    def analyze_batch(self, review_texts: List[str], prompt: str) -> str:  # noqa: D401
        """Batch analyse reviews. Default implementation raises NotImplementedError."""
        raise NotImplementedError


# --- Concrete Provider Implementations ---
class OllamaProvider(LLMProvider):
    def analyze(self, review_text, prompt):
        def do_analysis():
            assert ollama is not None, "Ollama library not available at runtime"
            full_prompt = self._construct_full_prompt(review_text, prompt)

            # Cast to Any so static checker doesn’t complain about dynamic attrs
            client = cast(Any, ollama)
            response = client.chat(
                model=self.model_name,
                messages=[{"role": "user", "content": full_prompt}],
            )
            # Extract exactly as you did in CLI
            # response['message']['content'] on dict or
            # fallback to choices if OpenAI‐compat
            if isinstance(response, dict):
                if "message" in response and "content" in response["message"]:
                    return str(response["message"]["content"]).strip()
                if "choices" in response:
                    return str(response["choices"][0]["message"]["content"]).strip()
            # Pydantic‐style
            # We cast to 'Any' to satisfy static checker for dynamic attrs
            resp_any = cast(Any, response)
            if hasattr(resp_any, "message") and hasattr(resp_any.message, "content"):
                return str(resp_any.message.content).strip()
            if hasattr(resp_any, "choices") and getattr(resp_any, "choices", None):
                return str(resp_any.choices[0].message.content).strip()
            # last resort
            return str(response).strip()

        return self._retry_wrapper(do_analysis)

    def analyze_batch(self, review_texts: List[str], prompt: str) -> str:
        """Simple loop-based batching for Ollama (since native batching is absent)."""
        outputs: List[str] = []
        for idx, txt in enumerate(review_texts, 1):
            single = self.analyze(txt, prompt)
            outputs.append(f"Review {idx} Analysis:\n{single}")
        return "\n\n".join(outputs)


class OpenAIProvider(LLMProvider):
    def __init__(self, model_name, api_key, config_manager, progress_callback=None):
        super().__init__(model_name, config_manager, progress_callback)
        assert openai is not None, "openai library not available at runtime"
        openai_any = cast(Any, openai)
        self.client = openai_any.OpenAI(api_key=api_key)

    def analyze(self, review_text, prompt):
        def do_analysis():
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {
                        "role": "user",
                        "content": self._construct_full_prompt(review_text, prompt),
                    }
                ],
            )
            return str(response.choices[0].message.content).strip()

        return self._retry_wrapper(do_analysis)

    def analyze_batch(self, review_texts, prompt):
        """
        Batch‐analyze multiple reviews in one API call. The model will prefix each
        sub‐analysis with "Review {i} Analysis:" so we can split them later.
        Returns the raw multi‐review output string.
        """
        def do_analysis():
            batch_instructions = (
                "You will analyze each review separately using the same exact "
                "output schema as in single‐review mode. For each review, start "
                "your analysis with 'Review {i} Analysis:' where {i} is the index.\n\n"
            )
            payload = batch_instructions
            for idx, text in enumerate(review_texts, 1):
                payload += f"Review {idx}:\n\"\"\"\n{text}\n\"\"\"\n\n"

            messages = [
                {"role": "system", "content": prompt},
                {"role": "user",   "content": payload}
            ]

            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages
            )
            return str(response.choices[0].message.content).strip()

        return self._retry_wrapper(do_analysis)


class GeminiProvider(LLMProvider):
    def __init__(self, model_name, api_key, config_manager, progress_callback=None):
        super().__init__(model_name, config_manager, progress_callback)
        assert genai is not None, "google-generativeai library not available"
        genai_any = cast(Any, genai)
        genai_any.configure(api_key=api_key)
        self.model = genai_any.GenerativeModel(self.model_name)

    def analyze(self, review_text, prompt):
        def do_analysis():
            response = self.model.generate_content(self._construct_full_prompt(review_text, prompt))
            return str(response.text).strip()

        return self._retry_wrapper(do_analysis)

    def analyze_batch(self, review_texts, prompt):
        """
        Batch-analyze reviews via Gemini in one call.
        """
        def do_analysis():
            batch_header = (
                "For each review below, produce an analysis using the same output schema.\n"
                "Begin each chunk with: 'Review {i} Analysis:'\n\n"
            )
            payload = batch_header
            for idx, text in enumerate(review_texts, 1):
                payload += f"Review {idx}:\n\"\"\"\n{text}\n\"\"\"\n\n"

            # genai.GenerativeModel.generate_content takes a single string
            response = self.model.generate_content(payload)
            return str(response.text).strip()

        return self._retry_wrapper(do_analysis)


class ClaudeProvider(LLMProvider):
    def __init__(self, model_name, api_key, config_manager, progress_callback=None):
        super().__init__(model_name, config_manager, progress_callback)
        assert anthropic is not None, "anthropic library not available"
        self.client = cast(Any, anthropic).Anthropic(api_key=api_key)

    def analyze(self, review_text, prompt):
        def do_analysis():
            message = self.client.messages.create(model=self.model_name, max_tokens=1024, messages=[
                {"role": "user", "content": self._construct_full_prompt(review_text, prompt)}])
            return str(message.content[0].text).strip()

        return self._retry_wrapper(do_analysis)

    def analyze_batch(self, review_texts, prompt):
        """
        Batch-analyze reviews via Claude in one call.
        """
        def do_analysis():
            batch_header = (
                "For each review below, produce an analysis using the same output schema.\n"
                "Begin each chunk with: 'Review {i} Analysis:'\n\n"
            )
            payload = batch_header
            for idx, text in enumerate(review_texts, 1):
                payload += f"Review {idx}:\n\"\"\"\n{text}\n\"\"\"\n\n"

            message = self.client.messages.create(
                model=self.model_name,
                max_tokens=1024,
                messages=[{"role": "user", "content": payload}]
            )
            # Claude response may be in message.content or message.content[0]
            if hasattr(message, "content"):
                # Pydantic style
                return str(message.content[0].text).strip()
            return str(message["content"][0]["text"]).strip()

        return self._retry_wrapper(do_analysis)


# --- Factory Function and Parser ---
def get_llm_provider(provider_name, model_name, config_manager, progress_callback=None):
    provider_name = provider_name.lower()

    def log_error(message):
        if progress_callback:
            progress_callback({'type': 'log', 'level': 'error', 'message': message})
        else:
            print(f"[ERROR] {message}")

    if provider_name == 'ollama':
        if not ollama:
            log_error("'ollama' library not installed.")
            return None
        return OllamaProvider(model_name, config_manager, progress_callback)

    api_key = config_manager.get_setting(['api_keys', provider_name])
    if not api_key or 'YOUR_' in api_key or '_KEY_HERE' in api_key:
        log_error(f"API key for '{provider_name.capitalize()}' is missing or a placeholder. Skipping.")
        return None

    if provider_name == 'openai':
        if not openai:
            log_error("'openai' library not installed.")
            return None
        return OpenAIProvider(model_name, api_key, config_manager, progress_callback)
    elif provider_name == 'gemini':
        if not genai:
            log_error("'google-generativeai' library not installed.")
            return None
        return GeminiProvider(model_name, api_key, config_manager, progress_callback)
    elif provider_name == 'claude':
        if not anthropic:
            log_error("'anthropic' library not installed.")
            return None
        return ClaudeProvider(model_name, api_key, config_manager, progress_callback)
    else:
        log_error(f"Unknown provider '{provider_name}' requested.")
        return None


def parse_llm_output(output):
    construct_keys = ["COMPETENCE SATISFACTION", "COMPETENCE FRUSTRATION", "AUTONOMY SATISFACTION",
                      "AUTONOMY FRUSTRATION", "RELATEDNESS SATISFACTION", "RELATEDNESS FRUSTRATION"]
    result = {}
    if not output:
        for key in construct_keys: result[f"{key}_TF"], result[f"{key}_QUOTE"] = None, ""
        return result
    for key in construct_keys:
        tf_match = re.search(rf"^\s*{re.escape(key)}:\s*\[?\s*(TRUE|FALSE)\s*\]?", output, re.MULTILINE | re.IGNORECASE)
        is_true = tf_match.group(1).upper() == 'TRUE' if tf_match else None
        result[f"{key}_TF"] = is_true
        quote_match = re.search(
            rf"^\s*{re.escape(key)} QUOTE:\s*(.*?)(?=\r?\n\s*(?:[A-Z\s]+ SATISFACTION:|COMPETENCE FRUSTRATION:|AUTONOMY FRUSTRATION:|RELATEDNESS FRUSTRATION:|[A-Z\s]+ QUOTE:|$))",
            output, re.MULTILINE | re.DOTALL | re.IGNORECASE)
        quote_text = quote_match.group(1).strip().replace('"', '') if quote_match else ""
        result[f"{key}_QUOTE"] = quote_text if is_true and quote_text else ""
    result['raw_llm_output'] = output
    return result
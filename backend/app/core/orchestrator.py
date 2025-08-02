import threading
import queue
import time
import logging
import pandas as pd
import os

from typing import Optional, Any, Union

from .config_manager import ConfigManager
from .steam_api import SteamAPI
from .llm_analyser import LLMAnalyser
from .data_processor import DataProcessor

logger = logging.getLogger(__name__)


class AnalysisOrchestrator:
    """
    Orchestrates the analysis workflow and handles graceful interruption.
    """

    def __init__(
        self,
        config_manager: ConfigManager,
        gui_queue: Optional[queue.Queue[Any]] = None,
    ):
        self.config_manager = config_manager
        self.gui_queue = gui_queue
        self.stop_event = threading.Event()
        self.thread = None
        # These will always be bool once set
        self._current_complete_scraping: bool = False
        self._current_skip_scraping: bool = False

    def join(self, timeout: float | None = None):
        if self.thread and self.thread.is_alive():
            self.stop_event.set()           # ask it to finish
            self.thread.join(timeout=timeout)

    def _notify_phase(self, phase: str):
        """
        Emit a phase_change event to the GUI.

        Rules
        -----
        - Consecutive duplicates are suppressed (no spam).
        - When the *idle* phase is requested we always allow it through and
          clear the cached phase so the next real run can fire again.
        """
        # De-duplication guard (not applied to 'idle')
        current = getattr(self, "_current_phase", None)
        if phase != "idle" and current == phase:
            logger.info(f"🔄 Phase '{phase}' already active, skipping notification")
            return

        # Update / clear the cached value
        self._current_phase = None if phase == "idle" else phase

        # Send event
        self._send_to_gui({"type": "phase_change", "phase": phase})

    def _start_process(self, target_function):
        """Generic starter for any process to avoid code duplication."""
        if self.thread and self.thread.is_alive():
            self._send_to_gui({
                "type": "log",
                "message": "A process is already running.",
                "level": "warning"
            })
            return
        self.stop_event.clear()
        self.thread = threading.Thread(target=target_function)
        self.thread.start()

    # --- Public Methods to be Called by the GUI ---
    def start_scraping_only(self, enable_complete_scraping=None):
        """
        Start the scraping-only process.

        Args:
            enable_complete_scraping: If specified, overrides the config
              setting for complete scraping
        """
        raw = (
            enable_complete_scraping
            if enable_complete_scraping is not None
            else self.config_manager.get_setting(
                ["fetching", "enable_complete_scraping"], False
            )
        )
        self._current_complete_scraping = bool(raw)
        logger.info(f"🔍 DEBUG: start_scraping_only called with enable_complete_scraping={enable_complete_scraping}, resolved to {self._current_complete_scraping}")
        self._start_process(self._run_scrape_only_flow)

    def start_analysis(self, enable_complete_scraping: bool | None = None, skip_scraping: bool | None = None):
        """
        Start the full analysis process.

        Args:
            enable_complete_scraping: If specified, overrides the config
              setting for complete scraping
            skip_scraping: If specified, skip the review scraping process
              entirely
        """
        self._current_complete_scraping = (
            enable_complete_scraping
            if enable_complete_scraping is not None
            else self.config_manager.get_setting(
                ["fetching", "enable_complete_scraping"], False)
        )
        self._current_skip_scraping = (
            skip_scraping
            if skip_scraping is not None
            else self.config_manager.get_setting(
                ["analysis", "skip_scraping"], False)
        )
        self._start_process(self._run_analysis_flow)

    def stop_analysis(self):
        """Signals any running process to stop gracefully."""
        if self.thread and self.thread.is_alive():
            self.stop_event.set()
            self._send_to_gui({
                "type": "log",
                "message": "Stop signal sent. Finishing current tasks and saving...",
                "level": "info"
            })
        else:
            self._send_to_gui({
                "type": "log",
                "message": "No process is currently running.",
                "level": "info"
            })

    # --- Private Methods for Thread Execution ---
    def _send_to_gui(self, data):
        """Sends data to the GUI queue if it exists."""
        if self.gui_queue:
            self.gui_queue.put(data)

    def _create_llm_callback(self):
        """
        Create a callback function for LLM analyzer that intercepts
        process_type_change messages and converts them to phase_change.
        """
        def callback(data):
            # Intercept process_type_change from LLM analyzer
            if data.get("type") == "process_type_change":
                process_type = data.get("process_type")
                logger.info(f"🔄 DEBUG: LLM analyzer sent process_type_change: {process_type}")
                if process_type == "batch_analysis":
                    self._notify_phase("batch_analysis")
                elif process_type == "analysis":
                    self._notify_phase("analysis")
                # Don't forward the original message, phase_change handles it
                return
            
            # Forward all other messages normally
            self._send_to_gui(data)
        
        return callback

    def _run_scrape_only_flow(self):
        """Run the scraper without any analysis step."""
        try:
            self._notify_phase("scraping")

            self.config_manager.reload_config()
            enable_complete = bool(self._current_complete_scraping)
            scrape_type = "complete" if enable_complete else "limited"

            self._send_to_gui({
                "type": "log",
                "message": f"Starting {scrape_type} review scraping "
                           f"(enable_complete={enable_complete})",
                "level": "info",
            })

            steam_api = SteamAPI(self.config_manager)
            data_processor = DataProcessor(self.config_manager)
            app_ids = self.config_manager.get_setting(["app_ids"], [])

            if not app_ids:
                raise ValueError("No App IDs configured for scraping.")

            self._send_to_gui({"type": "progress_apps_total",
                               "value": len(app_ids)})

            for idx, app_id in enumerate(app_ids):
                if self.stop_event.is_set():
                    break

                self._send_to_gui({"type": "progress_apps_current",
                                   "value": idx})

                app_name = steam_api.get_app_name(app_id)

                self._send_to_gui({
                    "type": "log",
                    "message": f"Starting {scrape_type} scraping for "
                               f"{app_name} (ID: {app_id})",
                    "level": "info",
                })

                # Periodic save callback (only for complete mode)
                def periodic_save(revs, _aid):
                    data_processor.save_raw_reviews_periodic(revs, app_name, _aid)

                reviews = steam_api.fetch_reviews_for_app(
                    app_id,
                    scrape_all=enable_complete,
                    progress_callback=self._send_to_gui,
                    stop_event=self.stop_event,
                    periodic_save_callback=(periodic_save if enable_complete else None),
                )

                if reviews:
                    data_processor.save_raw_reviews(reviews, app_name, app_id)
                    self._send_to_gui({
                        "type": "log",
                        "message": f"Saved {len(reviews):,} reviews for {app_name}",
                        "level": "info",
                    })
                else:
                    self._send_to_gui({
                        "type": "log",
                        "message": f"No reviews found for {app_name}",
                        "level": "warning",
                    })

            # Force progress bar to 100 %
            self._send_to_gui({"type": "progress_apps_current",
                               "value": len(app_ids)})

        except Exception as exc:
            logger.exception("Scraping flow error")
            self._send_to_gui({"type": "log",
                               "message": f"Error: {exc}",
                               "level": "error"})
        finally:
            final_msg = ("Scraping complete."
                         if not self.stop_event.is_set()
                         else "Scraping stopped. Progress has been saved.")
            self._send_to_gui({"type": "log",
                               "message": final_msg,
                               "level": "info"})

            # ----- NEW: End-of-phase signalling ----------------------------
            self._send_to_gui({
                "type":  "phase_end",
                "phase": self._current_phase or "scraping",
            })
            self._notify_phase("idle")       # tell GUI we're idle again
            # ----------------------------------------------------------------

            # House-keeping
            self.stop_event.clear()
            self._current_complete_scraping = False

    def _run_analysis_flow(self):
        """
        Full workflow: optional scraping phase followed by analysis.
        Respect *skip_scraping* and *enable_complete_scraping* flags.
        """
        try:
            first_phase = "analysis" if self._current_skip_scraping else "scraping"
            self._notify_phase(first_phase)

            self.config_manager.reload_config()
            skip_scraping   = bool(self._current_skip_scraping)
            enable_complete = bool(self._current_complete_scraping)

            desc = ("analysis-only (existing raw reviews)" if skip_scraping else
                    f"{'complete' if enable_complete else 'limited'} analysis workflow")
            self._send_to_gui({"type": "log",
                               "message": f"Starting {desc}…",
                               "level": "info"}
                               )

            steam_api = SteamAPI(self.config_manager)
            llm_analyser = LLMAnalyser(self.config_manager)
            data_processor = DataProcessor(self.config_manager)

            app_ids = self.config_manager.get_setting(["app_ids"], [])
            if not app_ids:
                raise ValueError("No App IDs configured for analysis.")

            selected = llm_analyser.get_selected_models_by_provider()
            if not any(selected.values()):
                raise ValueError("No LLM models have been selected for analysis.")

            if skip_scraping:
                missing = self._validate_raw_reviews_exist(
                    app_ids, data_processor, steam_api
                )
                if missing:
                    self._handle_missing_raw_reviews(missing)
                    return

            self._send_to_gui(
                {"type": "progress_apps_total", "value": len(app_ids)}
            )

            for idx, app_id in enumerate(app_ids):
                if self.stop_event.is_set():
                    break

                self._send_to_gui(
                    {"type": "progress_apps_current", "value": idx}
                )
                app_name = steam_api.get_app_name(app_id)

                self._send_to_gui(
                    {
                        "type": "log",
                        "message": f"Processing {app_name} (ID: {app_id})",
                        "level": "info",
                    }
                )

                # ── SCRAPING (optional) ─────────────────────────────
                if skip_scraping:
                    reviews = self._load_existing_reviews(
                        data_processor, app_id, app_name
                    )
                else:
                    reviews = self._get_or_fetch_reviews(
                        steam_api,
                        data_processor,
                        app_id,
                        app_name,
                        enable_complete,
                    )

                if not reviews:
                    self._send_to_gui(
                        {
                            "type": "log",
                            "message": (
                                f"No reviews available for {app_name}. Skipping."
                            ),
                            "level": "warning",
                        }
                    )
                    continue

                reviews = data_processor.clean_reviews_data(reviews)
                if not reviews:
                    self._send_to_gui(
                        {
                            "type": "log",
                            "message": (
                                f"No valid reviews after cleaning "
                                f"for {app_name}. Skipping."
                            ),
                            "level": "warning",
                        }
                    )
                    continue

                # If we just finished scraping, flip to analysis exactly once.
                if not skip_scraping and self._current_phase != "analysis":
                    self._notify_phase("analysis")

                # ── ANALYSIS ───────────────────────────────────────
                limit = (
                    float("inf")
                    if enable_complete
                    else int(
                        self.config_manager.get_setting(
                            ["analysis", "reviews_to_analyze"], 100
                        )
                    )
                )

                for provider, models in selected.items():
                    if self.stop_event.is_set():
                        break
                    for model in models:
                        if self.stop_event.is_set():
                            break

                        self._send_to_gui(
                            {"type": "status_update", "app": app_name, "model": model}
                        )

                        existing, resumed = data_processor.check_existing_analysis(
                            app_name, app_id, model
                        )
                        if (
                            existing
                            and not resumed
                            and not enable_complete
                            and len(existing) >= limit
                        ):
                            self._send_to_gui(
                                {
                                    "type": "log",
                                    "message": (
                                        f"Analysis already complete for {app_name} "
                                        f"with {model} ({len(existing)} reviews)"
                                    ),
                                    "level": "info",
                                }
                            )
                            continue

                        filtered = data_processor.filter_reviews(reviews)
                        if len(filtered) != len(reviews):
                            self._send_to_gui(
                                {
                                    "type": "log",
                                    "message": (
                                        f"Applied filtering for {app_name}: "
                                        f"{len(reviews):,} → {len(filtered):,}"
                                    ),
                                    "level": "info",
                                }
                            )

                        self._send_to_gui(
                            {
                                "type": "log",
                                "message": (
                                    f"Analyzing {len(filtered):,} reviews "
                                    f"for {app_name} with {model}"
                                ),
                                "level": "info",
                            }
                        )

                        analysed = llm_analyser.analyse_reviews(
                            filtered,
                            app_name,
                            app_id,
                            model,
                            provider,
                            self._create_llm_callback(),
                            self.stop_event,
                            complete_scraping=enable_complete,
                        )

                        if analysed:
                            data_processor.save_analysed_data(
                                analysed, app_name, app_id, model
                            )
                            data_processor.cleanup_progress_file(
                                app_name, app_id, model
                            )
                            self._send_to_gui(
                                {
                                    "type": "log",
                                    "message": (
                                        f"Completed analysis of "
                                        f"{len(analysed):,} reviews with {model}"
                                    ),
                                    "level": "info",
                                }
                            )
                        else:
                            self._send_to_gui(
                                {
                                    "type": "log",
                                    "message": (
                                        f"No analysed data returned for "
                                        f"{app_name} with {model}"
                                    ),
                                    "level": "warning",
                                }
                            )

            # Force progress bar to full
            self._send_to_gui(
                {"type": "progress_apps_current", "value": len(app_ids)}
            )

        except Exception as exc:
            logger.exception("Analysis flow error")
            self._send_to_gui({"type": "log",
                               "message": f"Error: {exc}",
                               "level": "error"})
        finally:
            final_msg = ("Analysis complete."
                         if not self.stop_event.is_set()
                         else "Analysis stopped. Progress has been saved.")
            self._send_to_gui({"type": "log",
                               "message": final_msg,
                               "level": "info"})

            self._send_to_gui({
                "type":  "phase_end",
                "phase": self._current_phase or "analysis",
            })
            self._notify_phase("idle")       # GUI back to idle

            # House-keeping
            self.stop_event.clear()
            self._current_complete_scraping = False
            self._current_skip_scraping     = False

    def _get_or_fetch_reviews(
        self, steam_api, data_processor, app_id, app_name,
        enable_complete
    ):
        """
        Get reviews for an app, either from existing files or by fetching
        from Steam. For complete scraping mode, always re-fetch to ensure
        we get all available reviews.
        """
        sanitised_name = data_processor._sanitise_filename(app_name)
        raw_filename = f"{sanitised_name}_{app_id}_raw_reviews.csv"

        raw_folder = str(
            self.config_manager.get_setting(
                ["file_paths", "raw_output_folder"], "output/raw"
            )
        )
        raw_filepath = os.path.join(raw_folder, raw_filename)

        # For complete scraping, always re-fetch to ensure we get all reviews
        # For normal mode, use existing reviews if available
        if os.path.exists(raw_filepath) and not enable_complete:
            try:
                df = pd.read_csv(raw_filepath, low_memory=False)
                df = df.fillna("")  # Replace NaN with empty strings
                reviews = df.to_dict("records")

                for review in reviews:
                    if "review" in review:
                        review_text = review["review"]
                        if (
                            review_text is None
                            or (
                                isinstance(review_text, float)
                                and pd.isna(review_text)
                            )
                        ):
                            review["review"] = ""
                        elif not isinstance(review_text, str):
                            review["review"] = (
                                str(review_text)
                                if review_text is not None else ""
                            )

                self._send_to_gui({
                    "type": "log",
                    "message": (
                        f"Using existing raw reviews for {app_name}: "
                        f"{len(reviews):,} reviews"
                    ),
                    "level": "info"
                })
                return reviews
            except Exception as e:
                logger.error(f"Error reading existing raw reviews: {e}")
        elif enable_complete and os.path.exists(raw_filepath):
            self._send_to_gui({
                "type": "log",
                "message": (
                    f"Complete scraping enabled - re-fetching all reviews for {app_name} "
                    f"(ignoring existing {raw_filename})"
                ),
                "level": "info"
            })

        # Fetch reviews from Steam (either fresh or complete re-scrape)
        def periodic_save_callback(reviews_snapshot, current_app_id):
            data_processor.save_raw_reviews_periodic(
                reviews_snapshot, app_name, current_app_id
            )

        reviews = steam_api.fetch_reviews_for_app(
            app_id,
            scrape_all=bool(enable_complete),
            progress_callback=self._send_to_gui,
            stop_event=self.stop_event,
            periodic_save_callback=(
                periodic_save_callback if enable_complete else None
            )
        )

        if reviews:
            data_processor.save_raw_reviews(reviews, app_name, app_id)
            scrape_type = "complete" if enable_complete else "limited"
            self._send_to_gui({
                "type": "log",
                "message": (
                    f"Fetched {len(reviews):,} reviews for {app_name} "
                    f"({scrape_type} scraping)"
                ),
                "level": "info"
            })

        return reviews

    def _validate_raw_reviews_exist(
        self, app_ids, data_processor, steam_api
    ):
        """
        Validate that raw review files exist for all configured apps.

        Returns:
            list: List of (app_id, app_name) tuples for apps missing
                  raw reviews
        """
        missing_apps = []

        for app_id in app_ids:
            app_name = steam_api.get_app_name(app_id)
            sanitised_name = data_processor._sanitise_filename(app_name)
            raw_filename = f"{sanitised_name}_{app_id}_raw_reviews.csv"

            raw_folder = str(
                self.config_manager.get_setting(
                    ["file_paths", "raw_output_folder"], "output/raw"
                )
            )
            raw_filepath = os.path.join(raw_folder, raw_filename)

            if not os.path.exists(raw_filepath):
                missing_apps.append((app_id, app_name))

        return missing_apps

    def _load_existing_reviews(self, data_processor, app_id, app_name):
        """
        Load existing raw reviews for an app when skip scraping is enabled.
        All reviews are loaded and filtering will be applied later based on 
        current settings.

        Returns:
            list: List of review dictionaries or empty list if not found
        """
        sanitised_name = data_processor._sanitise_filename(app_name)
        raw_filename = f"{sanitised_name}_{app_id}_raw_reviews.csv"

        raw_folder = str(
            self.config_manager.get_setting(
                ["file_paths", "raw_output_folder"], "output/raw"
            )
        )
        raw_filepath = os.path.join(raw_folder, raw_filename)

        try:
            if os.path.exists(raw_filepath):
                df = pd.read_csv(raw_filepath, low_memory=False)
                df = df.fillna("")  # Replace NaN with empty strings
                reviews = df.to_dict("records")

                for review in reviews:
                    if "review" in review:
                        review_text = review["review"]
                        if (
                            review_text is None
                            or (
                                isinstance(review_text, float)
                                and pd.isna(review_text)
                            )
                        ):
                            review["review"] = ""
                        elif not isinstance(review_text, str):
                            review["review"] = (
                                str(review_text)
                                if review_text is not None else ""
                            )

                # Get current filter settings for informative logging
                min_length = self.config_manager.get_setting(['filtering', 'min_review_length'], 50)
                min_playtime = self.config_manager.get_setting(['filtering', 'min_playtime_hours'], 0)
                
                self._send_to_gui({
                    "type": "log",
                    "message": (
                        f"Loaded {len(reviews):,} existing raw reviews for {app_name}. "
                        f"Will filter based on current settings: min_length={min_length}, "
                        f"min_playtime={min_playtime}h"
                    ),
                    "level": "info"
                })
                return reviews
            else:
                self._send_to_gui({
                    "type": "log",
                    "message": (
                        f"No existing raw reviews found for {app_name}. "
                        f"You need to run scraping first or disable 'Skip Scraping'."
                    ),
                    "level": "error"
                })
                return []
        except Exception as e:
            logger.error(
                f"Error loading existing raw reviews for {app_name}: {e}"
            )
            self._send_to_gui({
                "type": "log",
                "message": (
                    f"Error loading existing raw reviews for "
                    f"{app_name}: {e}"
                ),
                "level": "error"
            })
            return []

    def _handle_missing_raw_reviews(self, missing_apps):
        """
        Handle the case where raw reviews are missing for skip scraping mode.
        """
        missing_list = ", ".join(
            [f"{name} (ID: {app_id})" for app_id, name in missing_apps]
        )

        self._send_to_gui({
            "type": "log",
            "message": (
                "❌ Cannot skip scraping - No raw reviews found for: "
                f"{missing_list}"
            ),
            "level": "error"
        })

        self._send_to_gui({
            "type": "log",
            "message": "💡 To fix this, you can:",
            "level": "info"
        })

        self._send_to_gui({
            "type": "log",
            "message": "   1. Use 'Scrape Reviews' to get raw reviews first",
            "level": "info"
        })

        self._send_to_gui({
            "type": "log",
            "message": (
                "   2. Use 'Analyse Reviews' to scrape and analyze in one step"
            ),
            "level": "info"
        })

        self._send_to_gui({
            "type": "log",
            "message": "   3. Disable 'Skip Review Scraping' option and try again",
            "level": "info"
        })

        self._send_to_gui({
            "type": "missing_raw_reviews",
            "missing_apps": missing_apps,
            "suggestion": "switch_to_scraping"
        })
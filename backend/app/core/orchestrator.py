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

    def start_analysis(self, enable_complete_scraping=None, skip_scraping=None):
        """
        Start the full analysis process.

        Args:
            enable_complete_scraping: If specified, overrides the config
              setting for complete scraping
            skip_scraping: If specified, skip the review scraping process
              entirely
        """
        raw1 = (
            enable_complete_scraping
            if enable_complete_scraping is not None
            else self.config_manager.get_setting(
                ["fetching", "enable_complete_scraping"], False
            )
        )
        self._current_complete_scraping = bool(raw1)

        raw2 = (
            skip_scraping
            if skip_scraping is not None
            else self.config_manager.get_setting(
                ["analysis", "skip_scraping"], False
            )
        )
        self._current_skip_scraping = bool(raw2)

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

    def _run_scrape_only_flow(self):
        """Runs only the review scraping and saving part of the workflow."""
        try:
            self.config_manager.reload_config()
            self._send_to_gui({
                "type": "analysis_started",
                "process_type": "scraping",
                "message": "Starting scraping process..."
            })

            enable_complete = bool(self._current_complete_scraping)
            scrape_type = "complete" if enable_complete else "limited"
            logger.info(f"🔍 DEBUG: _run_scrape_only_flow using enable_complete={enable_complete} (from self._current_complete_scraping={self._current_complete_scraping})")

            self._send_to_gui({
                "type": "log",
                "message": (
                    f"Starting {scrape_type} review scraping..."
                    f" (enable_complete={enable_complete})"
                ),
                "level": "info"
            })

            steam_api = SteamAPI(self.config_manager)
            data_processor = DataProcessor(self.config_manager)
            app_ids = self.config_manager.get_setting(["app_ids"], [])

            if not app_ids:
                raise ValueError("No App IDs configured for scraping.")

            self._send_to_gui({
                "type": "progress_apps_total",
                "value": len(app_ids)
            })

            for i, app_id in enumerate(app_ids):
                if self.stop_event.is_set():
                    break

                self._send_to_gui({
                    "type": "progress_apps_current",
                    "value": i
                })
                app_name = steam_api.get_app_name(app_id)

                self._send_to_gui({
                    "type": "log",
                    "message": (
                        f"Starting {scrape_type} scraping for: "
                        f"{app_name} (ID: {app_id})"
                    ),
                    "level": "info"
                })

                def periodic_save_callback(
                    reviews_snapshot, current_app_id
                ):
                    data_processor.save_raw_reviews_periodic(
                        reviews_snapshot, app_name, current_app_id
                    )

                logger.info(f"🔍 DEBUG: Calling steam_api.fetch_reviews_for_app with scrape_all={bool(enable_complete)} for app {app_id}")
                reviews = steam_api.fetch_reviews_for_app(
                    app_id,
                    scrape_all=bool(enable_complete),
                    progress_callback=self._send_to_gui,
                    stop_event=self.stop_event,
                    periodic_save_callback=(
                        periodic_save_callback if enable_complete else None
                    ),
                )

                if reviews:
                    data_processor.save_raw_reviews(
                        reviews, app_name, app_id
                    )
                    self._send_to_gui({
                        "type": "log",
                        "message": (
                            f"Saved {len(reviews):,} reviews for "
                            f"{app_name}"
                        ),
                        "level": "info"
                    })
                else:
                    self._send_to_gui({
                        "type": "log",
                        "message": f"No reviews found for {app_name}",
                        "level": "warning"
                    })

                if self.stop_event.is_set():
                    break

            self._send_to_gui({
                "type": "progress_apps_current",
                "value": len(app_ids)
            })

        except Exception as e:
            logger.error(
                f"An error occurred during scraping: {e}", exc_info=True
            )
            self._send_to_gui({
                "type": "log",
                "message": f"Error: {e}",
                "level": "error"
            })
        finally:
            final_message = (
                "Scraping complete."
                if not self.stop_event.is_set()
                else "Scraping stopped. All progress has been saved."
            )
            self._send_to_gui({
                "type": "log",
                "message": final_message,
                "level": "info"
            })
            self.stop_event.clear()
            self._send_to_gui({"type": "analysis_finished"})
            self._current_complete_scraping = False

    def _run_analysis_flow(self):
        """The main analysis workflow, now with skip scraping capability."""
        try:
            self.config_manager.reload_config()
            self._send_to_gui({
                "type": "analysis_started", 
                "process_type": "scraping",
                "message": "Starting analysis workflow..."
            })

            skip_scraping = bool(self._current_skip_scraping)
            enable_complete = bool(self._current_complete_scraping)

            if skip_scraping:
                workflow_type = "analysis-only (using existing raw reviews)"
                # Update process type to analysis since we're skipping scraping
                self._send_to_gui({
                    "type": "process_type_change",
                    "process_type": "analysis",
                    "message": f"Starting {workflow_type}..."
                })
            else:
                scrape_type = "complete" if enable_complete else "limited"
                workflow_type = f"{scrape_type} analysis workflow"

            self._send_to_gui({
                "type": "log",
                "message": f"Starting {workflow_type}...",
                "level": "info"
            })

            steam_api = SteamAPI(self.config_manager)
            llm_analyser = LLMAnalyser(self.config_manager)
            data_processor = DataProcessor(self.config_manager)

            app_ids = self.config_manager.get_setting(["app_ids"], [])
            if not app_ids:
                raise ValueError("No App IDs configured for analysis.")

            selected_models_by_provider = \
                llm_analyser.get_selected_models_by_provider()
            if not any(selected_models_by_provider.values()):
                raise ValueError(
                    "No LLM models have been selected for analysis."
                )

            if skip_scraping:
                missing_apps = self._validate_raw_reviews_exist(
                    app_ids, data_processor, steam_api
                )
                if missing_apps:
                    self._handle_missing_raw_reviews(missing_apps)
                    return

            total_apps = len(app_ids)
            self._send_to_gui({
                "type": "progress_apps_total",
                "value": total_apps
            })

            for i, app_id in enumerate(app_ids):
                if self.stop_event.is_set():
                    break

                self._send_to_gui({
                    "type": "progress_apps_current",
                    "value": i
                })
                app_name = steam_api.get_app_name(app_id)

                self._send_to_gui({
                    "type": "log",
                    "message": (
                        f"Processing app: {app_name} (ID: {app_id})"
                    ),
                    "level": "info"
                })

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
                    self._send_to_gui({
                        "type": "log",
                        "message": (
                            f"No reviews found for {app_name}. Skipping."
                        ),
                        "level": "warning"
                    })
                    continue

                reviews = data_processor.clean_reviews_data(reviews)
                if not reviews:
                    self._send_to_gui({
                        "type": "log",
                        "message": (
                            f"No valid reviews after cleaning for "
                            f"{app_name}. Skipping."
                        ),
                        "level": "warning"
                    })
                    continue

                if self.stop_event.is_set():
                    break

                limit_setting = self.config_manager.get_setting(
                    ["analysis", "reviews_to_analyze"], 100
                )
                if isinstance(limit_setting, (int, float, str, bool)):
                    reviews_to_analyze_limit = int(limit_setting)
                else:
                    reviews_to_analyze_limit = 100

                # Transition from scraping to analysis phase
                if not skip_scraping:
                    self._send_to_gui({
                        "type": "process_type_change",
                        "process_type": "analysis",
                        "message": "Transitioning to analysis phase..."
                    })

                for provider, models in \
                        selected_models_by_provider.items():
                    if self.stop_event.is_set():
                        break

                    for model in models:
                        if self.stop_event.is_set():
                            break

                        self._send_to_gui({
                            "type": "status_update",
                            "process_type": "analysis",
                            "app": app_name,
                            "model": model
                        })

                        existing_analysis, is_from_progress = \
                            data_processor.check_existing_analysis(
                                app_name, app_id, model
                            )

                        if (
                            existing_analysis
                            and not is_from_progress
                            and len(existing_analysis)
                            >= reviews_to_analyze_limit
                        ):
                            self._send_to_gui({
                                "type": "log",
                                "message": (
                                    f"Analysis already complete for "
                                    f"{app_name} with {model} "
                                    f"({len(existing_analysis)} reviews, "
                                    f"target: {reviews_to_analyze_limit})"
                                ),
                                "level": "info"
                            })
                            continue
                        elif (
                            existing_analysis
                            and not is_from_progress
                        ):
                            self._send_to_gui({
                                "type": "log",
                                "message": (
                                    f"Analysis partially complete for "
                                    f"{app_name} with {model} "
                                    f"({len(existing_analysis)} reviews, "
                                    f"target: {reviews_to_analyze_limit}). "
                                    "Continuing analysis..."
                                ),
                                "level": "info"
                            })

                        reviews_to_process = \
                            data_processor.filter_reviews(reviews)

                        self._send_to_gui({
                            "type": "log",
                            "message": (
                                f"Analyzing {len(reviews_to_process):,} "
                                f"filtered reviews for {app_name} "
                                f"with {model}"
                            ),
                            "level": "info"
                        })

                        analysed_data = llm_analyser.analyse_reviews(
                            reviews_to_process,
                            app_name,
                            app_id,
                            model,
                            provider,
                            self._send_to_gui,
                            self.stop_event
                        )

                        if analysed_data:
                            data_processor.save_analysed_data(
                                analysed_data, app_name, app_id, model
                            )
                            data_processor.cleanup_progress_file(
                                app_name, app_id, model
                            )
                            self._send_to_gui({
                                "type": "log",
                                "message": (
                                    f"Completed analysis of "
                                    f"{len(analysed_data):,} reviews "
                                    f"with {model}"
                                ),
                                "level": "info"
                            })
                        else:
                            self._send_to_gui({
                                "type": "log",
                                "message": (
                                    f"No analyzed data returned for "
                                    f"{app_name} with {model}"
                                ),
                                "level": "warning"
                            })

                if not self.stop_event.is_set():
                    data_processor.generate_summary_for_app(
                        app_name,
                        app_id,
                        selected_models_by_provider
                    )
                    self._send_to_gui({
                        "type": "log",
                        "message": (
                            f"Generated summary report for {app_name}"
                        ),
                        "level": "info"
                    })

            self._send_to_gui({
                "type": "progress_apps_current",
                "value": total_apps
            })

        except Exception as e:
            logger.error(
                f"An error occurred during analysis: {e}", exc_info=True
            )
            self._send_to_gui({
                "type": "log",
                "message": f"Error: {e}",
                "level": "error"
            })
        finally:
            final_message = (
                "Analysis complete."
                if not self.stop_event.is_set()
                else "Analysis stopped. All progress has been saved."
            )
            self._send_to_gui({
                "type": "log",
                "message": final_message,
                "level": "info"
            })
            self.stop_event.clear()
            self._send_to_gui({"type": "analysis_finished"})
            self._current_complete_scraping = False
            self._current_skip_scraping = False

    def _get_or_fetch_reviews(
        self, steam_api, data_processor, app_id, app_name,
        enable_complete
    ):
        """
        Get reviews for an app, either from existing files or by fetching
        from Steam.
        """
        sanitised_name = data_processor._sanitise_filename(app_name)
        raw_filename = f"{sanitised_name}_{app_id}_raw_reviews.csv"

        raw_folder = str(
            self.config_manager.get_setting(
                ["file_paths", "raw_output_folder"], "output/raw"
            )
        )
        raw_filepath = os.path.join(raw_folder, raw_filename)

        if os.path.exists(raw_filepath):
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

        reviews = steam_api.fetch_reviews_for_app(
            app_id,
            scrape_all=bool(enable_complete),
            progress_callback=self._send_to_gui,
            stop_event=self.stop_event
        )

        if reviews:
            data_processor.save_raw_reviews(reviews, app_name, app_id)
            self._send_to_gui({
                "type": "log",
                "message": (
                    f"Fetched {len(reviews):,} reviews for {app_name}"
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
        Load existing raw reviews for an app.

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

                self._send_to_gui({
                    "type": "log",
                    "message": (
                        f"Loaded existing raw reviews for {app_name}: "
                        f"{len(reviews):,} reviews"
                    ),
                    "level": "info"
                })
                return reviews
            else:
                self._send_to_gui({
                    "type": "log",
                    "message": f"No existing raw reviews found for {app_name}",
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
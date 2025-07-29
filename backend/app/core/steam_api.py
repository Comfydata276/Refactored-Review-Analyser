import requests
import time
import logging
from datetime import datetime, timedelta

# Configure logging
logger = logging.getLogger(__name__)


class SteamAPI:
    """
    Handles all interactions with the Steam Web API, including fetching
    app details, reviews, and the global app list.
    """
    BASE_URL = "https://store.steampowered.com"
    API_URL = "https://api.steampowered.com"

    def __init__(self, config_manager):
        """
        Initialises the SteamAPI client.

        Args:
            config_manager: The shared ConfigManager instance.
        """
        self.config_manager = config_manager
        # Add a cache for the app list to avoid re-fetching
        self._app_list_cache = None

    def get_app_list(self):
        """
        Fetches a list of all apps from the Steam API.
        Results are cached to prevent repeated requests.

        Returns:
            A dictionary mapping app IDs to app names, e.g., {570: "Dota 2"}.
            Returns an empty dictionary if the request fails.
        """
        if self._app_list_cache:
            return self._app_list_cache

        try:
            logger.info("Fetching the global Steam app list for the first time...")
            response = requests.get(f"{self.API_URL}/ISteamApps/GetAppList/v2/")
            response.raise_for_status()

            data = response.json()
            app_list = data.get('applist', {}).get('apps', [])

            self._app_list_cache = {app['appid']: app['name'] for app in app_list}
            logger.info(f"Successfully fetched and cached {len(self._app_list_cache)} apps.")

            return self._app_list_cache

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch Steam app list: {e}")
            return {}

    def get_app_name(self, app_id):
        """
        Fetches the name of an app given its ID.
        Uses the cached global app list for efficiency.
        """
        app_list = self.get_app_list()
        return app_list.get(int(app_id), f"Unknown App (ID: {app_id})")

    def fetch_reviews_for_app(self, app_id, scrape_all=False, progress_callback=None, stop_event=None,
                              periodic_save_callback=None):
        """
        Fetches reviews for a specific app ID from the Steam store with enhanced error handling.
        """
        reviews = []
        cursor = '*'
        review_language = self.config_manager.get_setting(['fetching', 'language'], 'all')
        request_count = 0
        consecutive_empty_batches = 0
        consecutive_same_cursor = 0
        consecutive_errors = 0  # NEW: Track consecutive errors
        max_empty_batches = 3
        max_same_cursor = 3
        max_consecutive_errors = 5  # NEW: Allow some consecutive errors before giving up
        max_total_errors = 20  # NEW: Maximum total errors before stopping
        total_errors = 0  # NEW: Track total errors

        # Get periodic save interval
        periodic_save_interval = self.config_manager.get_setting(['analysis', 'periodic_save_interval'], 100)

        # Track elapsed time for complete scraping
        start_time = datetime.now()

        if scrape_all:
            num_reviews_to_fetch = float('inf')
            max_requests = 2000  # Increased from 1000
            logger.info(f"Starting complete review scrape for app {app_id}")
        else:
            try:
                num_reviews_to_fetch = int(self.config_manager.get_setting(['fetching', 'reviews_per_app'], 100))
                max_requests = int(self.config_manager.get_setting(['fetching', 'max_requests_per_app'], 5))
            except (ValueError, TypeError):
                logger.error("Invalid non-numeric value in fetching settings. Using defaults.")
                num_reviews_to_fetch = 100
                max_requests = 5

        params = {
            'json': 1,
            'filter': 'recent',
            'language': review_language,
            'num_per_page': 100,
        }

        logger.info(f"🔍 DEBUG: fetch_reviews_for_app called with app_id={app_id}, scrape_all={scrape_all} (type: {type(scrape_all)})")
        logger.info(f"Fetching reviews for app {app_id} (scrape_all={scrape_all})")

        while len(reviews) < num_reviews_to_fetch and request_count < max_requests:
            # Check if we should stop
            if stop_event and stop_event.is_set():
                logger.info(f"Stop signal received during scraping of app {app_id}. Stopping gracefully.")
                break

            if consecutive_empty_batches >= max_empty_batches:
                logger.info(f"Stopping scrape for app {app_id} - {consecutive_empty_batches} consecutive empty batches")
                break

            if consecutive_errors >= max_consecutive_errors:
                logger.warning(f"Stopping scrape for app {app_id} - {consecutive_errors} consecutive errors")
                break

            if total_errors >= max_total_errors:
                logger.warning(f"Stopping scrape for app {app_id} - {total_errors} total errors reached")
                break

            params['cursor'] = cursor
            request_count += 1

            try:
                logger.debug(f"Making request {request_count} for app {app_id} with cursor: {cursor}")

                # Add timeout and retry logic
                response = requests.get(
                    f"{self.BASE_URL}/appreviews/{app_id}",
                    params=params,
                    timeout=30,  # 30 second timeout
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                )

                # Handle specific HTTP errors
                if response.status_code == 502:
                    raise requests.exceptions.HTTPError("502 Bad Gateway - Steam servers temporarily unavailable")
                elif response.status_code == 503:
                    raise requests.exceptions.HTTPError("503 Service Unavailable - Steam servers overloaded")
                elif response.status_code == 429:
                    raise requests.exceptions.HTTPError("429 Too Many Requests - Rate limited")

                response.raise_for_status()
                data = response.json()

                if data.get('success') != 1:
                    logger.warning(f"API returned success={data.get('success')} for app {app_id}")
                    consecutive_errors += 1
                    total_errors += 1
                    time.sleep(5)  # Wait before retrying
                    continue

                # Reset error counter on successful request
                consecutive_errors = 0

                batch_reviews = data.get('reviews', [])

                if not batch_reviews:
                    consecutive_empty_batches += 1
                    logger.debug(f"Empty batch {consecutive_empty_batches} for app {app_id}")

                    if scrape_all and consecutive_empty_batches < max_empty_batches:
                        new_cursor = data.get('cursor')
                        if new_cursor and new_cursor != cursor:
                            cursor = new_cursor
                            consecutive_same_cursor = 0
                            time.sleep(2)
                            continue
                        else:
                            consecutive_same_cursor += 1
                            if consecutive_same_cursor >= max_same_cursor:
                                logger.info(
                                    f"No more reviews available for app {app_id} (cursor unchanged {consecutive_same_cursor} times)")
                                break
                            else:
                                logger.debug(
                                    f"Cursor unchanged ({consecutive_same_cursor}/{max_same_cursor}), retrying...")
                                time.sleep(3)
                                continue
                    else:
                        logger.info(f"No reviews found for app {app_id} in batch {request_count}")
                        break
                else:
                    consecutive_empty_batches = 0

                reviews.extend(batch_reviews)

                # Periodic saving for complete scraping
                if scrape_all and len(reviews) % periodic_save_interval == 0 and periodic_save_callback:
                    periodic_save_callback(reviews.copy(), app_id)
                    logger.info(f"Periodic save triggered for app {app_id} at {len(reviews)} reviews")

                # Update cursor for next request
                new_cursor = data.get('cursor')
                if not new_cursor:
                    logger.info(f"No cursor returned for app {app_id}, ending scrape")
                    break
                elif new_cursor == cursor:
                    consecutive_same_cursor += 1
                    if consecutive_same_cursor >= max_same_cursor:
                        logger.info(
                            f"Reached end of reviews for app {app_id} (cursor unchanged {consecutive_same_cursor} times)")
                        break
                    else:
                        logger.debug(
                            f"Same cursor returned ({consecutive_same_cursor}/{max_same_cursor}), continuing with longer wait...")
                        time.sleep(3)
                else:
                    cursor = new_cursor
                    consecutive_same_cursor = 0

                # Progress reporting
                if progress_callback:
                    elapsed_time = datetime.now() - start_time
                    elapsed_str = self._format_elapsed_time(elapsed_time)

                    progress_callback({
                        "type": "scraping_progress",
                        "app_id": app_id,
                        "reviews_scraped": len(reviews),
                        "elapsed_time": elapsed_str,
                        "is_complete_scraping": scrape_all,
                        "total_errors": total_errors
                    })

                logger.debug(
                    f"Batch {request_count} for app {app_id}: got {len(batch_reviews)} reviews, total: {len(reviews)}")

                # Dynamic rate limiting based on errors
                if scrape_all:
                    if total_errors > 5:
                        time.sleep(3)  # Slower when errors occur
                    else:
                        time.sleep(1.5)
                else:
                    time.sleep(0.5)

            except requests.exceptions.HTTPError as e:
                consecutive_errors += 1
                total_errors += 1
                error_msg = f"HTTP error fetching reviews for app {app_id} (request {request_count}): {e}"
                logger.error(error_msg)

                # Progressive backoff for different error types
                if "502" in str(e) or "503" in str(e):
                    wait_time = min(30, 5 * consecutive_errors)  # Up to 30 seconds
                    logger.info(f"Server error detected, waiting {wait_time} seconds before retry...")
                    time.sleep(wait_time)
                elif "429" in str(e):
                    wait_time = min(60, 10 * consecutive_errors)  # Up to 60 seconds for rate limiting
                    logger.info(f"Rate limit detected, waiting {wait_time} seconds before retry...")
                    time.sleep(wait_time)
                else:
                    time.sleep(5)

                continue  # Don't break, try again

            except requests.exceptions.RequestException as e:
                consecutive_errors += 1
                total_errors += 1
                logger.error(f"Request error fetching reviews for app {app_id} (request {request_count}): {e}")
                time.sleep(5)
                continue  # Don't break, try again

            except Exception as e:
                consecutive_errors += 1
                total_errors += 1
                logger.error(f"Unexpected error fetching reviews for app {app_id}: {e}")
                time.sleep(5)
                continue  # Don't break, try again

        # Final cleanup and logging
        final_count = len(reviews)
        elapsed_time = datetime.now() - start_time
        elapsed_str = self._format_elapsed_time(elapsed_time)

        if scrape_all:
            msg = (f"Complete scrape finished for app {app_id}: "
                   f"{final_count:,} reviews in {elapsed_str} (Total errors: {total_errors})")
        else:
            msg = (f"Limited scrape finished for app {app_id}: "
                   f"{final_count:,} reviews in {request_count} requests (Total errors: {total_errors})")

        logger.info(msg)

        if progress_callback:
            progress_callback({
                "type": "log",
                "message": msg,
                "level": "info"
            })

        # For complete scraping, return all reviews. For limited scraping, respect the limit.
        if scrape_all:
            return reviews
        else:
            return reviews[:num_reviews_to_fetch]

    def _format_elapsed_time(self, elapsed_time):
        """Format elapsed time as HH:MM:SS"""
        total_seconds = int(elapsed_time.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60

        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
        else:
            return f"{minutes:02d}:{seconds:02d}"
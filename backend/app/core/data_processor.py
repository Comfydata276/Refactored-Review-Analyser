import time

import pandas as pd
import os
import re
import logging
import json

# Configure logging
logger = logging.getLogger(__name__)


class DataProcessor:
    """
    Handles all data-related tasks: filtering reviews, sanitising filenames,
    and saving raw reviews, analysed data, and final summary reports.
    """

    def __init__(self, config_manager):
        """
        Initialises the DataProcessor.

        Args:
            config_manager: The shared ConfigManager instance.
        """
        self.config_manager = config_manager

    def _sanitise_filename(self, name):
        """Removes illegal characters from a string to make it a valid filename."""
        return re.sub(r'[\\/*?:"<>|]', "", name)

    # Update the filter_reviews method in DataProcessor class (data_processor.py)

    def filter_reviews(self, reviews):
        """
        Filters reviews based on criteria set in the config, such as minimum
        playtime or review length.
        """
        # CORRECTED: Proper type handling with better defaults
        try:
            min_playtime_setting = self.config_manager.get_setting(['filtering', 'min_playtime_hours'], 0)
            min_playtime = int(min_playtime_setting) if min_playtime_setting != "" else 0
        except (ValueError, TypeError):
            logger.warning(f"Invalid min_playtime_hours setting: {min_playtime_setting}. Using default: 0")
            min_playtime = 0

        try:
            min_length_setting = self.config_manager.get_setting(['filtering', 'min_review_length'], 50)
            min_length = int(min_length_setting) if min_length_setting != "" else 50
        except (ValueError, TypeError):
            logger.warning(f"Invalid min_review_length setting: {min_length_setting}. Using default: 50")
            min_length = 50

        # Validate reasonable ranges
        if min_playtime < 0:
            min_playtime = 0
        if min_length < 0:
            min_length = 0

        logger.info(f"Filtering reviews with min_playtime: {min_playtime} hours, min_length: {min_length} characters")

        filtered = []
        for i, review in enumerate(reviews):
            try:
                # Safe extraction of playtime
                playtime_minutes = 0
                if isinstance(review, dict):
                    author_info = review.get('author', {})
                    if isinstance(author_info, dict):
                        playtime_minutes = author_info.get('playtime_forever', 0)
                    else:
                        playtime_minutes = 0

                # Ensure playtime is numeric
                try:
                    playtime_minutes = float(playtime_minutes) if playtime_minutes is not None else 0
                except (ValueError, TypeError):
                    playtime_minutes = 0

                # Safe extraction of review text
                review_text = review.get('review', '') if isinstance(review, dict) else ''

                # Handle NaN, None, and non-string types
                if review_text is None or (isinstance(review_text, float) and pd.isna(review_text)):
                    review_text = ''
                elif not isinstance(review_text, str):
                    review_text = str(review_text) if review_text is not None else ''

                # Check if review passes filters
                playtime_ok = playtime_minutes >= min_playtime * 60
                length_ok = len(review_text) >= min_length

                if playtime_ok and length_ok:
                    filtered.append(review)
                else:
                    logger.debug(
                        f"Review {i + 1} filtered out - playtime: {playtime_minutes}min (need {min_playtime * 60}min), "
                        f"length: {len(review_text)} chars (need {min_length} chars)"
                    )

            except Exception as e:
                logger.warning(f"Error processing review {i + 1}: {e}. Skipping review.")
                continue

        logger.info(f"Filtered {len(reviews)} reviews down to {len(filtered)} reviews")
        return filtered

    def save_raw_reviews(self, reviews, app_name, app_id):
        """
        Saves the raw, unfiltered list of reviews to a CSV file.
        """
        output_dir = self.config_manager.get_setting(['file_paths', 'raw_output_folder'], 'output/raw')
        os.makedirs(output_dir, exist_ok=True)

        sanitised_name = self._sanitise_filename(app_name)
        filename = f"{sanitised_name}_{app_id}_raw_reviews.csv"
        filepath = os.path.join(output_dir, filename)

        try:
            df = pd.json_normalize(reviews)
            df.to_csv(filepath, index=False, encoding='utf-8-sig')
            logger.info(f"Saved {len(reviews)} raw reviews to {filepath}")
        except Exception as e:
            logger.error(f"Failed to save raw reviews for {app_name}: {e}")

    def save_analysed_data(self, analysed_data, app_name, app_id, model_name):
        """
        Saves the data after analysis by an LLM to a CSV file.
        """
        output_dir = self.config_manager.get_setting(['file_paths', 'analysed_output_folder'], 'output/analysed')
        os.makedirs(output_dir, exist_ok=True)

        sanitised_app_name = self._sanitise_filename(app_name)
        sanitised_model_name = self._sanitise_filename(model_name)
        filename = f"{sanitised_app_name}_{app_id}_{sanitised_model_name}_analysed.csv"
        filepath = os.path.join(output_dir, filename)

        try:
            df = pd.DataFrame(analysed_data)
            df.to_csv(filepath, index=False, encoding='utf-8-sig')
            logger.info(f"Saved {len(analysed_data)} analysed reviews to {filepath}")
        except Exception as e:
            logger.error(f"Failed to save analysed data for {app_name}: {e}")

    def generate_summary_for_app(self, app_name, app_id, selected_models_by_provider):
        """
        Generates a final summary JSON file for a given app, aggregating
        results from all analysed models.
        """
        summary_dir = self.config_manager.get_setting(['file_paths', 'summary_output_folder'], 'output/summary')
        os.makedirs(summary_dir, exist_ok=True)

        sanitised_name = self._sanitise_filename(app_name)
        summary_filepath = os.path.join(summary_dir, f"{sanitised_name}_{app_id}_summary.json")

        summary_data = {
            'app_name': app_name,
            'app_id': app_id,
            'models_analysed': [],
            'aggregate_results': {}
        }

        all_models = [model for models in selected_models_by_provider.values() for model in models]

        for model_name in all_models:
            sanitised_model_name = self._sanitise_filename(model_name)
            analysed_filename = f"{sanitised_name}_{app_id}_{sanitised_model_name}_analysed.csv"
            analysed_filepath = os.path.join(
                self.config_manager.get_setting(['file_paths', 'analysed_output_folder'], 'output/analysed'),
                analysed_filename)

            if os.path.exists(analysed_filepath):
                df = pd.read_csv(analysed_filepath)
                summary_data['models_analysed'].append(model_name)

        try:
            with open(summary_filepath, 'w', encoding='utf-8') as f:
                json.dump(summary_data, f, indent=4)
            logger.info(f"Generated summary report for {app_name} at {summary_filepath}")
        except Exception as e:
            logger.error(f"Failed to generate summary for {app_name}: {e}")

    def save_raw_reviews_periodic(self, reviews, app_name, app_id):
        """
        Saves raw reviews to a single progress file that gets overwritten each time.
        """
        output_dir = self.config_manager.get_setting(['file_paths', 'raw_output_folder'], 'output/raw')
        os.makedirs(output_dir, exist_ok=True)

        sanitised_name = self._sanitise_filename(app_name)
        # Use a consistent filename that gets overwritten
        filename = f"{sanitised_name}_{app_id}_raw_reviews_progress.csv"
        filepath = os.path.join(output_dir, filename)

        try:
            df = pd.json_normalize(reviews)
            df.to_csv(filepath, index=False, encoding='utf-8-sig')
            logger.info(f"Saved {len(reviews)} reviews (progress checkpoint) to {filepath}")
        except Exception as e:
            logger.error(f"Failed to save progress checkpoint for {app_name}: {e}")

    def save_analyzed_data_periodic(self, analyzed_data, app_name, app_id, model_name):
        """
        Saves analyzed data to a progress file that gets overwritten each time.
        Enhanced version with better error handling.
        """
        output_dir = self.config_manager.get_setting(['file_paths', 'analysed_output_folder'], 'output/analysed')
        os.makedirs(output_dir, exist_ok=True)

        sanitised_app_name = self._sanitise_filename(app_name)
        sanitised_model_name = self._sanitise_filename(model_name)

        # Use a consistent filename that gets overwritten
        filename = f"{sanitised_app_name}_{app_id}_{sanitised_model_name}_analyzed_progress.csv"
        filepath = os.path.join(output_dir, filename)

        # Create a temporary file first to avoid corruption
        temp_filepath = filepath + '.tmp'

        try:
            df = pd.DataFrame(analyzed_data)
            df.to_csv(temp_filepath, index=False, encoding='utf-8-sig')

            # If temporary file was written successfully, replace the original
            if os.path.exists(temp_filepath):
                if os.path.exists(filepath):
                    os.remove(filepath)
                os.rename(temp_filepath, filepath)

            logger.debug(f"Saved {len(analyzed_data)} analyzed reviews (progress checkpoint) to {filepath}")

        except Exception as e:
            logger.error(f"Failed to save progress checkpoint for {app_name}: {e}")
            # Clean up temp file if it exists
            if os.path.exists(temp_filepath):
                try:
                    os.remove(temp_filepath)
                except:
                    pass

    def check_existing_analysis(self, app_name, app_id, model_name):
        """
        Check if there's an existing analysis file (both final and progress) for the given app and model.

        Returns:
            tuple: (existing_analysis_data, is_from_progress_file)
        """
        sanitised_app_name = self._sanitise_filename(app_name)
        sanitised_model_name = self._sanitise_filename(model_name)

        # Check for final analysis file first
        final_filename = f"{sanitised_app_name}_{app_id}_{sanitised_model_name}_analysed.csv"
        final_filepath = os.path.join(
            self.config_manager.get_setting(['file_paths', 'analysed_output_folder'], 'output/analysed'),
            final_filename
        )

        # Check for progress file
        progress_filename = f"{sanitised_app_name}_{app_id}_{sanitised_model_name}_analyzed_progress.csv"
        progress_filepath = os.path.join(
            self.config_manager.get_setting(['file_paths', 'analysed_output_folder'], 'output/analysed'),
            progress_filename
        )

        try:
            # If final file exists, analysis is complete
            if os.path.exists(final_filepath):
                df = pd.read_csv(final_filepath)
                logger.info(f"Found completed analysis file for {app_name} with {model_name}: {len(df)} reviews")
                return df.to_dict('records'), False

            # If progress file exists, analysis is partial
            elif os.path.exists(progress_filepath):
                df = pd.read_csv(progress_filepath)
                logger.info(f"Found partial analysis file for {app_name} with {model_name}: {len(df)} reviews")
                return df.to_dict('records'), True

            else:
                logger.info(f"No existing analysis found for {app_name} with {model_name}")
                return [], False

        except Exception as e:
            logger.error(f"Error reading existing analysis files: {e}")
            return [], False

    def identify_reviews_to_analyze(self, all_reviews, existing_analysis):
        """
        Identify which reviews still need to be analyzed by comparing with existing analysis.

        Args:
            all_reviews: List of all reviews fetched from Steam
            existing_analysis: List of already analyzed reviews

        Returns:
            tuple: (reviews_to_analyze, already_analyzed_count)
        """
        if not existing_analysis:
            return all_reviews, 0

        # Create a set of review IDs that have already been analyzed
        analyzed_ids = set()

        for analyzed_review in existing_analysis:
            # Create a unique identifier for each review
            review_id = self._create_review_id(analyzed_review)
            analyzed_ids.add(review_id)

        # Filter out reviews that have already been analyzed
        reviews_to_analyze = []
        for review in all_reviews:
            review_id = self._create_review_id(review)
            if review_id not in analyzed_ids:
                reviews_to_analyze.append(review)

        already_analyzed_count = len(all_reviews) - len(reviews_to_analyze)

        logger.info(
            f"Review identification: {len(all_reviews)} total reviews, {already_analyzed_count} already analyzed, {len(reviews_to_analyze)} to analyze")

        return reviews_to_analyze, already_analyzed_count

    def _create_review_id(self, review):
        """
        Create a unique identifier for a review based on its content.

        Args:
            review: Review dictionary

        Returns:
            str: Unique identifier for the review
        """
        # Use timestamp and steamid as unique identifier
        timestamp = review.get('timestamp_created', 0)

        # Handle potential NaN or None values
        if timestamp is None or (isinstance(timestamp, float) and pd.isna(timestamp)):
            timestamp = 0

        # Get steamid safely
        author_info = review.get('author', {})
        if isinstance(author_info, dict):
            steamid = author_info.get('steamid', 'unknown')
        else:
            steamid = 'unknown'

        if steamid is None or (isinstance(steamid, float) and pd.isna(steamid)):
            steamid = 'unknown'

        # Also include first 50 characters of review text as additional uniqueness
        review_text = review.get('review', '')
        if review_text is None or (isinstance(review_text, float) and pd.isna(review_text)):
            review_text = ''
        elif not isinstance(review_text, str):
            review_text = str(review_text) if review_text is not None else ''

        review_text_sample = review_text[:50]

        return f"{timestamp}_{steamid}_{hash(review_text_sample)}"

    def merge_analysis_results(self, existing_analysis, new_analysis):
        """
        Merge existing analysis results with new analysis results.

        Args:
            existing_analysis: List of existing analyzed reviews
            new_analysis: List of newly analyzed reviews

        Returns:
            list: Combined analysis results
        """
        if not existing_analysis:
            return new_analysis

        if not new_analysis:
            return existing_analysis

        # Create a set of existing review IDs to avoid duplicates
        existing_ids = set()
        for review in existing_analysis:
            review_id = self._create_review_id(review)
            existing_ids.add(review_id)

        # Start with existing analysis
        merged_results = existing_analysis.copy()

        # Add new analyses that don't already exist
        for review in new_analysis:
            review_id = self._create_review_id(review)
            if review_id not in existing_ids:
                merged_results.append(review)

        logger.info(
            f"Merged analysis results: {len(existing_analysis)} existing + {len(new_analysis)} new = {len(merged_results)} total")

        return merged_results

    def cleanup_progress_file(self, app_name, app_id, model_name):
        """
        Remove the progress file after successful completion.

        Args:
            app_name: Name of the app
            app_id: Steam app ID
            model_name: Name of the model used
        """
        sanitised_app_name = self._sanitise_filename(app_name)
        sanitised_model_name = self._sanitise_filename(model_name)

        progress_filename = f"{sanitised_app_name}_{app_id}_{sanitised_model_name}_analyzed_progress.csv"
        progress_filepath = os.path.join(
            self.config_manager.get_setting(['file_paths', 'analysed_output_folder'], 'output/analysed'),
            progress_filename
        )

        try:
            if os.path.exists(progress_filepath):
                os.remove(progress_filepath)
                logger.info(f"Cleaned up progress file: {progress_filename}")
        except Exception as e:
            logger.error(f"Error cleaning up progress file: {e}")

    def get_raw_reviews_summary(self, app_ids, steam_api):
        """
        Get a summary of raw reviews availability for all configured apps.

        Args:
            app_ids: List of Steam app IDs
            steam_api: SteamAPI instance

        Returns:
            dict: Summary information about raw reviews availability
        """
        summary = {
            'total_apps': len(app_ids),
            'apps_with_reviews': 0,
            'apps_without_reviews': 0,
            'total_reviews': 0,
            'app_details': []
        }

        for app_id in app_ids:
            app_name = steam_api.get_app_name(app_id)
            exists, filepath, count = self.check_raw_reviews_exist(app_id, app_name)

            app_info = {
                'app_id': app_id,
                'app_name': app_name,
                'has_reviews': exists,
                'review_count': count,
                'file_path': filepath
            }

            summary['app_details'].append(app_info)

            if exists:
                summary['apps_with_reviews'] += 1
                summary['total_reviews'] += count
            else:
                summary['apps_without_reviews'] += 1

        return summary

    def check_raw_reviews_exist(self, app_id, app_name):
        """
        Check if raw reviews exist for a given app.

        Args:
            app_id: Steam app ID
            app_name: Name of the app

        Returns:
            tuple: (file_exists, file_path, review_count)
        """
        sanitised_name = self._sanitise_filename(app_name)
        raw_filename = f"{sanitised_name}_{app_id}_raw_reviews.csv"
        raw_filepath = os.path.join(
            self.config_manager.get_setting(['file_paths', 'raw_output_folder'], 'output/raw'),
            raw_filename
        )

        if os.path.exists(raw_filepath):
            try:
                df = pd.read_csv(raw_filepath)
                return True, raw_filepath, len(df)
            except Exception as e:
                logger.error(f"Error reading raw reviews file {raw_filepath}: {e}")
                return False, raw_filepath, 0
        else:
            return False, raw_filepath, 0

    def clean_reviews_data(self, reviews):
        """
        Clean reviews data to handle NaN values and ensure proper data types.

        Args:
            reviews: List of review dictionaries

        Returns:
            List of cleaned review dictionaries
        """
        cleaned_reviews = []

        for review in reviews:
            try:
                if not isinstance(review, dict):
                    logger.warning(f"Skipping non-dict review: {type(review)}")
                    continue

                cleaned_review = {}

                for key, value in review.items():
                    # Handle NaN values
                    if value is None or (isinstance(value, float) and pd.isna(value)):
                        if key == 'review':
                            cleaned_review[key] = ''
                        elif key in ['timestamp_created', 'timestamp_updated']:
                            cleaned_review[key] = 0
                        else:
                            cleaned_review[key] = '' if isinstance(value, str) else 0
                    else:
                        cleaned_review[key] = value

                # Ensure review text is a string
                if 'review' in cleaned_review:
                    review_text = cleaned_review['review']
                    if not isinstance(review_text, str):
                        cleaned_review['review'] = str(review_text) if review_text is not None else ''

                cleaned_reviews.append(cleaned_review)

            except Exception as e:
                logger.warning(f"Error cleaning review data: {e}. Skipping review.")
                continue

        logger.info(f"Cleaned {len(reviews)} reviews, {len(cleaned_reviews)} valid reviews remaining")
        return cleaned_reviews
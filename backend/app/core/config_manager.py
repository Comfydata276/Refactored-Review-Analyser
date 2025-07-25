import yaml
import os
import logging
from dotenv import load_dotenv, set_key, dotenv_values

# Configure logging
logger = logging.getLogger(__name__)


class ConfigManager:
    """
    Manages loading and saving the application's configuration from a YAML file.
    Also handles sensitive data like API keys using a .env file.
    """

    def __init__(self, config_path='config.yaml', env_path='.env'):
        """
        Initialises the ConfigManager.

        Args:
            config_path (str): The path to the configuration file.
            env_path (str): The path to the .env file.
        """
        self.config_path = config_path
        self.env_path = env_path
        self.config = {}
        self.reload_config()  # Perform initial load
        load_dotenv(self.env_path)  # Load .env file for API keys

    def reload_config(self):
        """
        Forces a reload of the configuration from the YAML file.
        This is crucial for ensuring the latest settings are used.
        """
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                self.config = yaml.safe_load(f)
            if not self.config:
                self.config = {}
            logger.info("Configuration reloaded from disk.")
        except FileNotFoundError:
            logger.warning(f"Config file not found at {self.config_path}. Starting with empty config.")
            self.config = {}
        except Exception as e:
            logger.error(f"Error loading config file: {e}")
            self.config = {}

    def save_config(self):
        """Saves the current in-memory configuration to the YAML file."""
        try:
            with open(self.config_path, 'w', encoding='utf-8') as f:
                yaml.dump(self.config, f, default_flow_style=False, sort_keys=False, indent=2)
            logger.info(f"Configuration saved to {self.config_path}")
        except Exception as e:
            logger.error(f"Error saving config file: {e}")

    def get_setting(self, keys, default=None):
        """
        Retrieves a nested setting from the in-memory configuration.

        Args:
            keys (list): A list of keys representing the path to the setting.
            default: The value to return if the key is not found.

        Returns:
            The value of the setting or the default value.
        """
        # Special handling for API keys to fetch from environment variables first
        if keys[0] == 'api_keys' and len(keys) > 1:
            env_var = f"{keys[1].upper()}_API_KEY"
            from_env = os.getenv(env_var)
            if from_env:
                return from_env

        # Fallback to config file
        temp_dict = self.config
        for key in keys:
            if isinstance(temp_dict, dict) and key in temp_dict:
                temp_dict = temp_dict[key]
            else:
                return default
        return temp_dict

    def set_setting(self, keys, value):
        """
        Sets a nested value in the in-memory configuration.
        You must call save_config() to persist the change to disk.

        Args:
            keys (list): A list of keys representing the path to the setting.
            value: The value to set.
        """
        temp_dict = self.config
        for key in keys[:-1]:
            temp_dict = temp_dict.setdefault(key, {})

        if isinstance(temp_dict, dict):
            temp_dict[keys[-1]] = value
        else:
            logger.error(f"Cannot set key '{keys[-1]}' on a non-dict element.")

    def set_api_key(self, provider_name, api_key):
        """
        Sets an API key both in the config and in the .env file.

        Args:
            provider_name (str): The name of the provider (e.g., 'openai', 'gemini', 'claude')
            api_key (str): The API key value
        """
        # Update in-memory config
        if 'api_keys' not in self.config:
            self.config['api_keys'] = {}
        self.config['api_keys'][provider_name] = api_key

        # Update .env file
        env_var = f"{provider_name.upper()}_API_KEY"
        try:
            # Create .env file if it doesn't exist
            if not os.path.exists(self.env_path):
                with open(self.env_path, 'w', encoding='utf-8') as f:
                    f.write("")

            # Set the key in .env file
            set_key(self.env_path, env_var, api_key)
            logger.info(f"API key for {provider_name} saved to {self.env_path}")

            # Reload environment variables
            load_dotenv(self.env_path, override=True)

        except Exception as e:
            logger.error(f"Error saving API key to .env file: {e}")

    def get_api_key(self, provider_name):
        """
        Gets an API key, checking environment variables first, then config file.

        Args:
            provider_name (str): The name of the provider

        Returns:
            str: The API key or None if not found
        """
        return self.get_setting(['api_keys', provider_name])

    def remove_api_key(self, provider_name):
        """
        Removes an API key from both config and .env file.

        Args:
            provider_name (str): The name of the provider
        """
        # Remove from in-memory config
        if 'api_keys' in self.config and provider_name in self.config['api_keys']:
            del self.config['api_keys'][provider_name]

        # Remove from .env file
        env_var = f"{provider_name.upper()}_API_KEY"
        try:
            if os.path.exists(self.env_path):
                # Read current .env content
                with open(self.env_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()

                # Filter out the line with our key
                filtered_lines = [line for line in lines if not line.strip().startswith(f"{env_var}=")]

                # Write back to .env file
                with open(self.env_path, 'w', encoding='utf-8') as f:
                    f.writelines(filtered_lines)

                logger.info(f"API key for {provider_name} removed from {self.env_path}")

                # Reload environment variables
                load_dotenv(self.env_path, override=True)

        except Exception as e:
            logger.error(f"Error removing API key from .env file: {e}")

    def list_env_api_keys(self):
        """
        Lists all API keys currently in the .env file.

        Returns:
            dict: Dictionary of provider names to API keys
        """
        if not os.path.exists(self.env_path):
            return {}

        try:
            env_vars = dotenv_values(self.env_path)
            api_keys = {}

            for key, value in env_vars.items():
                if key.endswith('_API_KEY'):
                    provider_name = key[:-8].lower()  # Remove '_API_KEY' and convert to lowercase
                    api_keys[provider_name] = value

            return api_keys
        except Exception as e:
            logger.error(f"Error reading .env file: {e}")
            return {}
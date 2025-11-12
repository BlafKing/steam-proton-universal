import Millennium, PluginUtils # type: ignore
import os
import json
import shutil

logger = PluginUtils.Logger()

class PluginConfig:
    """Manages plugin configuration file operations and caching"""
    
    def __init__(self):
        """Initialize plugin configuration with default values"""
        self.config_file = None
        self.config = {"protonDrivePath": ""}
        self._find_config_path()
        self.load_config()
    
    def _find_config_path(self):
        """Locate the plugin's config.json file in the plugin root directory"""
        try:
            # Try to find the plugin directory (go up from backend to plugin root)
            plugin_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            self.config_file = os.path.join(plugin_dir, "config.json")
            logger.log(f"Config file path: {self.config_file}")
        except Exception as e:
            logger.error(f"Failed to determine config path: {e}")
            self.config_file = "config.json"
    
    def load_config(self):
        """Load configuration from config.json file"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    file_config = json.load(f)
                    self.config.update(file_config)
                    logger.log("Configuration loaded from file")
            else:
                # Create default config file
                self.save_config()
                logger.log("Created default configuration file")
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
    
    def save_config(self):
        """Save current configuration to config.json file"""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
            logger.log("Configuration saved to file")
        except Exception as e:
            logger.error(f"Failed to save config: {e}")
    
    def get(self, key, default=None):
        """Get a configuration value by key"""
        return self.config.get(key, default)

plugin_config = PluginConfig()

class Backend:
    """Backend API methods for frontend-backend communication"""
    
    @staticmethod
    def get_config():
        """Get complete plugin configuration as JSON string"""
        return json.dumps(plugin_config.config, indent=2)
    
    @staticmethod
    def get_hook_config():
        """
        Get configuration for frontend hooks
        Always reloads from file to ensure real-time configuration changes
        """
        try:
            # Reload config from file to get latest changes
            plugin_config.load_config()
            
            # Return the values needed by hooks
            hook_config = {
                "protonDrivePath": plugin_config.config.get("protonDrivePath", ""),
            }
            
            return json.dumps(hook_config)
        except Exception as e:
            logger.error(f"Failed to get hook config: {e}")
            # Return safe defaults on error
            return json.dumps({
                "protonDrivePath": ""
            })
    
    @staticmethod
    def set_config(config_json):
        """Update plugin configuration from JSON string"""
        try:
            new_config = json.loads(config_json)
            plugin_config.config.update(new_config)
            plugin_config.save_config()
            return True
        except Exception as e:
            logger.error(f"Failed to update config: {e}")
            return False
    
    @staticmethod
    def reload_config():
        try:
            plugin_config.load_config()
            return True
        except Exception as e:
            logger.error(f"Failed to reload config: {e}")
            return False
    
    @staticmethod
    def create_symlinks(compatdata_path, app_id):
        """
        Create symlinks mirroring the universal proton drive to the app's compatdata folder
        If files exist in the compatdata folder, they are first copied to the universal drive
        (without overwriting) before removing the folder and creating symlinks.
        
        Args:
            compatdata_path: Path to the app's compatdata folder
            app_id: Steam app ID for logging purposes
            
        Returns:
            JSON string with result status and message
        """
        try:
            # Reload config to get latest proton drive path
            plugin_config.load_config()
            proton_drive_path = plugin_config.config.get("protonDrivePath", "")
            
            if not proton_drive_path:
                return json.dumps({
                    "success": False,
                    "message": "No protonDrivePath configured"
                })
            
            if not os.path.exists(proton_drive_path):
                return json.dumps({
                    "success": False,
                    "message": f"Proton drive path does not exist: {proton_drive_path}"
                })
            
            if not os.path.isdir(proton_drive_path):
                return json.dumps({
                    "success": False,
                    "message": f"Proton drive path is not a directory: {proton_drive_path}"
                })
            
            # Check if compatdata folder exists and if it's already a symlink to our universal drive
            files_copied = 0
            if os.path.exists(compatdata_path) or os.path.islink(compatdata_path):
                # Check if it's already a symlink pointing to our universal drive
                if os.path.islink(compatdata_path):
                    link_target = os.readlink(compatdata_path)
                    if os.path.abspath(link_target) == os.path.abspath(proton_drive_path):
                        logger.log(f"Compatdata folder for app {app_id} is already a symlink to universal drive, skipping...")
                        return json.dumps({
                            "success": True,
                            "message": "Symlink already exists",
                            "symlinkCount": 1,
                            "filesCopied": 0
                        })
                    else:
                        # Symlink exists but points somewhere else - remove it
                        logger.log(f"Removing incompatible symlink: {compatdata_path} -> {link_target}")
                        os.unlink(compatdata_path)
                
                # If it's a real directory with content, copy the content first
                elif os.path.isdir(compatdata_path):
                    contents = os.listdir(compatdata_path)
                    if contents:
                        logger.log(f"Compatdata folder for app {app_id} has existing content, copying to universal drive...")
                        
                        # Copy existing files from compatdata to universal drive
                        for item in contents:
                            source_item_path = os.path.join(compatdata_path, item)
                            dest_item_path = os.path.join(proton_drive_path, item)
                            
                            # Skip if destination already exists (don't overwrite)
                            if os.path.exists(dest_item_path) or os.path.islink(dest_item_path):
                                logger.log(f"Destination already exists, skipping copy: {dest_item_path}")
                                continue
                            
                            try:
                                if os.path.isdir(source_item_path) and not os.path.islink(source_item_path):
                                    # Copy directory recursively
                                    shutil.copytree(source_item_path, dest_item_path, symlinks=False)
                                    logger.log(f"Copied directory: {source_item_path} -> {dest_item_path}")
                                    files_copied += 1
                                elif not os.path.islink(source_item_path):
                                    # Copy file
                                    shutil.copy2(source_item_path, dest_item_path)
                                    logger.log(f"Copied file: {source_item_path} -> {dest_item_path}")
                                    files_copied += 1
                            except Exception as e:
                                logger.error(f"Failed to copy {source_item_path}: {e}")
                    
                    # Remove the compatdata folder after copying
                    try:
                        shutil.rmtree(compatdata_path)
                        logger.log(f"Removed compatdata folder: {compatdata_path}")
                    except Exception as e:
                        logger.error(f"Failed to remove compatdata folder: {e}")
                        return json.dumps({
                            "success": False,
                            "message": f"Failed to remove compatdata folder after copying: {e}"
                        })
            
            # Create a symlink from the compatdata path directly to the universal drive
            try:
                os.symlink(proton_drive_path, compatdata_path)
                logger.log(f"Created symlink: {compatdata_path} -> {proton_drive_path}")
                
                result_message = "Created symlink to universal drive"
                if files_copied > 0:
                    result_message += f", copied {files_copied} items from existing compatdata"
                
                logger.log(f"Successfully completed symlink creation for app {app_id}: {result_message}")
                return json.dumps({
                    "success": True,
                    "message": result_message,
                    "symlinkCount": 1,
                    "filesCopied": files_copied
                })
            except Exception as e:
                error_msg = f"Failed to create symlink {compatdata_path} -> {proton_drive_path}: {e}"
                logger.error(error_msg)
                return json.dumps({
                    "success": False,
                    "message": error_msg
                })
            
        except Exception as e:
            error_msg = f"Failed to create symlinks for app {app_id}: {e}"
            logger.error(error_msg)
            return json.dumps({
                "success": False,
                "message": error_msg
            })

class Plugin:
    def _front_end_loaded(self):
        pass

    def _load(self):
        logger.log("Plugin ready!")
        Millennium.ready()

    def _unload(self):
        pass
<div align="center">

# Proton Universal Prefix Plugin

A Millennium plugin that lets you use a unified Proton Windows prefix across all Steam games using symlinks.

</div>

## ✨ Features

- **Unified Prefix**: Share one central Proton prefix folder across all Steam games
- **Automatic Symlinks**: Automatically creates symlinks when games launch
- **Smart Migration**: Copies existing game data to the universal prefix before symlinking
- **Non-Destructive**: Never overwrites existing files in your universal prefix

## 🚀 Installation

1. Open Steam with Millennium installed
2. Navigate to **Millennium** → **Plugins**
3. Click **Install a plugin**
4. Click the URL and search for "Global Launch Options"
5. Copy the Plugin ID and click **Download & Install** in Steam
6. Restart Steam when prompted

## ⚙️ Configuration

Configure the plugin directly in Steam through the Millennium settings interface:

1. Open **Millennium Library Manager**
2. Click on **Proton Universal Prefix**
3. Configure the following settings:

### Settings

- **Proton Prefix Path**: The root path to your proton windows prefix (Use the folder that contains the `pfx` folder)
  - For example, if your proton path is `/home/user/windows/pfx/drive_c/`<div></div>
    Then you should use `/home/user/windows/` as your path.
  - (You can use an empty folder for steam to create a new Proton prefix.)

### Per-Game Exclusion

You can disable symlink creation for specific games by adding `-disableSymlink` to the game's launch options:

1. Right-click the game in your Steam library
2. Select **Properties**
3. In the **Launch Options** field, add `-disableSymlink`
4. The plugin will skip symlink creation for that game


## 🔧 How It Works

The plugin listens for Steam game launch actions and:

1. Detects when a game is being launched
2. Finds the game's compatdata folder location
3. If the folder exists with real files:
   - Copies all content to your universal prefix (without overwriting existing files)
   - Removes the original compatdata folder
4. Creates a single symlink where the entire AppID's compatdata folder points directly to your universal prefix

## 📋 Requirements

- Millennium v2.34.0 or higher
- Steam Client (any recent version)

## 📝 Changelog

### v1.1.1:
    - Listens for Steam's game launch actions instead of patching RunGame
    - Removed custom settings styling
    - Keeps the original compatdata folder if copying it to the universal prefix fails
    - Code cleanup

### v1.1.0:
    - Switched from local config file to Millennium's in-steam config UI
    
### v1.0.0:
    - Initial release

## 📄 License

MIT License - See LICENSE file for details
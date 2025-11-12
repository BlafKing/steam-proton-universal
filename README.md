<div align="center">

# Proton Universal Drive Plugin

A Millennium plugin that lets you use a unified Proton Windows drive across all Steam games using symlinks.

</div>

## ✨ Features

- **Unified Drive**: Share one central Proton C: drive folder across all Steam games
- **Automatic Symlinks**: Automatically creates symlinks when games launch
- **Smart Migration**: Copies existing game data to the universal drive before symlinking</div></div>
- **Non-Destructive**: Never overwrites existing files in your universal drive

## 🚀 Installation Guide

### Method 1: Millennium Plugin Installer (Recommended)

1. **Copy Plugin ID**
   ```
   (Not yet available)
   ```

2. **Install via Millennium**
   - Open Steam with Millennium installed
   - Navigate to **Millennium** → **Plugins**
   - Click **Install a plugin**
   - Paste the Plugin ID into the installer field
   - Click **Install**
   - Restart Steam when prompted

### Method 2: Manual installation

<details>
<summary><b>Option A: Download Pre-built Release (Recommended)</b></summary>

#### Download from Releases

1. Go to the [Releases](https://github.com/BlafKing/steam-proton-universal/releases) page
2. Download the latest release ZIP file
3. Extract the ZIP file to get the plugin folder

* #### Copy the `steam-proton-universal` folder to plugins directory:

```
# Windows
C:\Program Files (x86)\Steam\plugins

# Linux
~/.local/share/millennium/plugins

# macOS
~/Library/Application\ Support/millennium/plugins
```

* #### Activate Plugin in Steam

1. Completely close Steam (including system tray)
2. Restart Steam
3. Go to **Millennium** → **Plugins**
4. Enable "Proton Universal Drive"
5. Restart Steam once more
</details>

<details>
<summary><b>Option B: Build from Source</b></summary>

#### Step 1: Clone the Repository

```bash
git clone https://github.com/BlafKing/steam-proton-universal.git
cd steam-proton-universal
```

#### Step 2: Install Dependencies

**Install Node.js dependencies:**

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install project dependencies
pnpm install
```

#### Step 3: Build the Plugin

**For development:**

```bash
pnpm run dev
```

**For production:**

```bash
pnpm run build
```

* #### Copy the `steam-proton-universal` folder to plugins directory:

```
# Windows
C:\Program Files (x86)\Steam\plugins

# Linux
~/.local/share/millennium/plugins

# macOS
~/Library/Application\ Support/millennium/plugins
```

* #### Activate Plugin in Steam

1. Completely close Steam (including system tray)
2. Restart Steam
3. Go to **Millennium** → **Plugins**
4. Enable "Proton Universal Drive"
5. Restart Steam once more
</details>

## ⚙️ Configuration

The `config.json` file is automatically created in the plugin directory after enabling the plugin. You can then edit it to customize your settings:

```json
{
  "protonDrivePath": "/opt/windows"
}
```

### Settings

- **protonDrivePath**: The root path to your proton windows drive (The folder that contains the `pfx` folder)

## 🔧 How It Works

The plugin hooks into Steam's game launch process and:

1. Detects when a game is being launched
2. Finds the game's compatdata folder location
3. If the folder exists with real files:
   - Copies all content to your universal drive (without overwriting existing files)
   - Removes the original compatdata folder
4. Creates a single symlink where the entire AppID's compatdata folder points directly to your universal drive

## 📋 Requirements

- Millennium (plugin made on v2.30.0+)
- Steam Client (any recent version)

## 📄 License

MIT License - See LICENSE file for details
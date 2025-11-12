import { definePlugin, callable } from '@steambrew/client';

// Plugin state tracking
let hooksInjected = false;

// Configuration caching to avoid excessive backend calls
let configCache: any = null;
let lastConfigFetch = 0;
const CONFIG_CACHE_TTL = 1000; // Cache timeout in milliseconds

const plugin = {
	prefix: '%Proton Universal Drive%c',
	style: 'color: #cdd6f4; background-color: #746292; padding: 2px 4px; border-radius: 3px;',

	log(...args: any[]): void {
		console.log(plugin.prefix, plugin.style, '', ...args);
	},

	error(...args: any[]): void {
		console.error(plugin.prefix, plugin.style, '', ...args);
	},
};

/**
 * Fetches current plugin configuration from backend with caching
 * @returns Current plugin configuration object
 */
async function fetchCurrentConfig() {
	const now = Date.now();

	// Return cached config if still fresh
	if (configCache && (now - lastConfigFetch) < CONFIG_CACHE_TTL) {
		return configCache;
	}

	try {
		// Fetch live config from backend using callable API
		const getHookConfig = callable<[], string>("Backend.get_hook_config");
		const configJson = await getHookConfig();
		const config = JSON.parse(configJson);

		// Update cache
		configCache = config;
		lastConfigFetch = now;

		return config;
	} catch (error) {
		plugin.error('Failed to fetch config from backend:', error);

		// Fallback to safe defaults
		const defaultConfig = {
			protonDrivePath: ''
		};

		configCache = defaultConfig;
		lastConfigFetch = now;
		return defaultConfig;
	}
}

/**
 * Gets the install folder path for a specific app
 * @param appId - The Steam app ID
 * @returns The install folder path or null if not found
 */
async function getAppInstallFolderPath(appId: number): Promise<string | null> {
	try {
		// Get all install folders
		const installFolders = await window.SteamClient.InstallFolder.GetInstallFolders();
		if (!installFolders) {
			plugin.error('Unable to get install folders list');
			return null;
		}

		// Find the folder containing our app
		for (const folder of installFolders) {
			const app = folder.vecApps?.find(a => a.nAppID === appId);
			if (app) {
				return folder.strFolderPath;
			}
		}

		plugin.error(`App ${appId} not found in any install folder`);
		return null;
	} catch (error) {
		plugin.error(`Error getting install folder for app ${appId}:`, error);
		return null;
	}
}

/**
 * Gets the default compatdata path for a specific app
 * @param appId - The Steam app ID
 * @returns The compatdata path or null if not found
 */
async function getAppCompatdataPath(appId: number): Promise<string | null> {
	const installFolderPath = await getAppInstallFolderPath(appId);
	if (!installFolderPath) {
		return null;
	}

	// Construct compatdata path: {installFolder}/steamapps/compatdata/{appId}/
	const compatdataPath = `${installFolderPath}/steamapps/compatdata/${appId}`;

	return compatdataPath;
}

/**
 * Injects hooks into Steam's game launch process
 * Hooks RunGame to capture app launches and create symlinks before game starts
 */
function injectLaunchHooks() {
	if (hooksInjected) return;
	plugin.log('Injecting launch hooks...');

	// Hook Steam's RunGame method to capture app launch attempts
	if (window.SteamClient && window.SteamClient.Apps && window.SteamClient.Apps.RunGame) {
		const originalRunGame = window.SteamClient.Apps.RunGame;
		window.SteamClient.Apps.RunGame = async function (appId: string, ...args: any[]) {
			plugin.log(`Launching app ${appId}`);
			
			const config = await fetchCurrentConfig();

			// Check if protonDrivePath is configured
			if (!config.protonDrivePath) {
				plugin.log('No proton drive path configured, skipping symlink creation.');
				return originalRunGame.apply(this, [appId, ...args]);
			}

			try {
				// Get the compatdata path for this app
				const compatdataPath = await getAppCompatdataPath(parseInt(appId));
				
				if (!compatdataPath) {
					plugin.error(`Failed to get compatdata path for app ${appId}`);
					return originalRunGame.apply(this, [appId, ...args]);
				}

				plugin.log(`Compatdata path for app ${appId}: ${compatdataPath}`);

				// Call backend to create symlinks
				const createSymlinks = callable<[Record<string, string>], string>("Backend.create_symlinks");
				const resultJson = await createSymlinks({ compatdata_path: compatdataPath, app_id: appId }) as string;
				const result = JSON.parse(resultJson);

				if (result.success) {
					plugin.log(`Symlinks created successfully: ${result.message}`);
				} else {
					plugin.log(`Symlink creation skipped or failed: ${result.message}`);
				}

			} catch (error) {
				plugin.error(`Error during symlink creation for app ${appId}:`, error);
			}

			// Continue with normal game launch
			return originalRunGame.apply(this, [appId, ...args]);
		};
	}

	hooksInjected = true;
	plugin.log('Launch hooks injected successfully.');
}

/**
 * Millennium plugin entry point
 * Initializes the Proton Universal Drive plugin
 */
export default definePlugin(() => {
	// Inject hooks on plugin load
	setTimeout(injectLaunchHooks, 500);

	return null; // No UI component needed
});

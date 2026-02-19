import { definePlugin, callable, Field, TextField, IconsModule } from '@steambrew/client';
import React, { useState, useEffect } from 'react';

// JSX namespace declaration for JSX factory
declare global {
	namespace JSX {
		interface IntrinsicElements {
			[elemName: string]: any;
		}
	}
}

// Plugin state tracking
let hooksInjected = false;

// Plugin configuration with defaults
interface PluginConfig {
	protonPrefixPath: string;
}

let pluginConfig: PluginConfig = {
	protonPrefixPath: ''
};

const plugin = {
	prefix: '%cProton Universal Prefix%c',
	style: 'color: #cdd6f4; background-color: #746292; padding: 2px 4px; border-radius: 3px;',

	log(...args: any[]): void {
		console.log(plugin.prefix, plugin.style, '', ...args);
	},

	error(...args: any[]): void {
		console.error(plugin.prefix, plugin.style, '', ...args);
	},
};

/**
 * Gets the current configuration from memory
 * @returns Current plugin configuration object
 */
function getCurrentConfig() {
	return pluginConfig;
}

/**
 * Retrieves current launch options for a specific Steam app
 * Uses Steam's RegisterForAppDetails API to get real-time app data
 * @param appId - Steam App ID as string
 * @returns Promise resolving to current launch options string
 */
async function getCurrentLaunchOptions(appId: string): Promise<string> {
	return new Promise((resolve, reject) => {
		try {
			const numericAppId = parseInt(appId);

			// Register for app details callback
			const unregister = window.SteamClient.Apps.RegisterForAppDetails(numericAppId, (appDetails) => {
				try {
					const launchOptions = appDetails.strLaunchOptions || '';
					unregister.unregister();
					resolve(launchOptions);
				} catch (error) {
					unregister.unregister();
					reject(error);
				}
			});

			// Timeout protection in case callback never fires
			setTimeout(() => {
				unregister.unregister();
				reject(new Error(`Timeout waiting for app details for app ${appId}`));
			}, 5000);

		} catch (error) {
			reject(error);
		}
	});
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

	// Hook Steam's RunGame method to capture app launch attempts and create symlinks
	if (window.SteamClient && window.SteamClient.Apps && window.SteamClient.Apps.RunGame) {
		const originalRunGame = window.SteamClient.Apps.RunGame;
		window.SteamClient.Apps.RunGame = async function (appId: string, ...args: any[]) {
			plugin.log(`Launching app ${appId}`);
			
			const config = getCurrentConfig();

			// Check if protonPrefixPath is configured
			if (!config.protonPrefixPath) {
				plugin.log('No proton prefix path configured, skipping symlink creation.');
				return originalRunGame.apply(this, [appId, ...args]);
			}

			try {
				// Step 1: Fetch launch options to check for -disableSymlink flag
				const launchOptions = await getCurrentLaunchOptions(appId);
				plugin.log(`Launch options: "${launchOptions}"`);

				if (launchOptions.includes('-disableSymlink')) {
					plugin.log(`App ${appId} has -disableSymlink flag, skipping symlink creation.`);
					return originalRunGame.apply(this, [appId, ...args]);
				}

				// Step 2: Get the compatdata path for this app
				const compatdataPath = await getAppCompatdataPath(parseInt(appId));
				
				if (!compatdataPath) {
					plugin.error(`Failed to get compatdata path for app ${appId}`);
					return originalRunGame.apply(this, [appId, ...args]);
				}

				plugin.log(`Compatdata path for app ${appId}: ${compatdataPath}`);

				// Step 3: Call backend to create symlinks BEFORE launching the game
				const createSymlinks = callable<[{ compatdata_path: string; app_id: string; proton_prefix_path: string }], string>("create_symlinks");
				const resultJson = await createSymlinks({ 
					compatdata_path: compatdataPath, 
					app_id: appId, 
					proton_prefix_path: config.protonPrefixPath 
				}) as string;
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
 * Settings component for the in-steam config UI
 */
const SingleSetting = (props: { name: keyof PluginConfig; type: string; label: string; description: string; }) => {
	const [textValue, setTextValue] = useState('');

	const saveConfig = () => {
		localStorage.setItem("proton_universal_prefix.config", JSON.stringify(pluginConfig));
		plugin.log('Configuration saved:', pluginConfig);
	};

	useEffect(() => {
		if (props.type === "text") {
			setTextValue(pluginConfig[props.name]);
		}
	}, []);

	if (props.type === "text") {
		return (
			<Field label={props.label} description={props.description} bottomSeparator="standard" focusable>
				<TextField 
					value={textValue} 
					onChange={(e: React.ChangeEvent<HTMLInputElement>) => { 
						const value = e.currentTarget.value;
						setTextValue(value);
						pluginConfig[props.name] = value; 
						saveConfig(); 
					}} 
				/>
			</Field>
		);
	}
	return null;
};

const SettingsContent = () => {
	return (
		<>
			<style>{`
				.DialogInput_Wrapper._DialogLayout.Panel {
					width: 100%;
					max-width: 400px;
				}
				div:has(> .DialogInput_Wrapper._DialogLayout.Panel) {
					justify-content: flex-end;
				}
				.proton-universal-prefix-settings > div > div > div:nth-child(1) {
					flex-grow: 0 !important;
				}
				.proton-universal-prefix-settings > div > div > div:nth-child(2) {
					flex-grow: 1;
				}
			`}</style>
			<div className="proton-universal-prefix-settings">
				<SingleSetting 
					name="protonPrefixPath" 
					type="text" 
					label="Proton Prefix Path" 
					description="Path to your universal Proton Windows prefix (e.g., /home/user/ProtonPrefix). Leave empty to disable." 
				/>
			</div>
		</>
	);
};

/**
 * Millennium plugin entry point
 * Initializes the Proton Universal Prefix plugin
 */
export default definePlugin(() => {
	plugin.log('Proton Universal Prefix plugin initializing...');
	
	// Load configuration from localStorage
	const storedConfig = JSON.parse(localStorage.getItem("proton_universal_prefix.config") || "{}");
	pluginConfig = { ...pluginConfig, ...storedConfig };
	plugin.log('Loaded config:', pluginConfig);
	
	// Inject hooks on plugin load
	setTimeout(injectLaunchHooks, 500);
	
	plugin.log('Plugin initialization complete');

	return {
		title: "Proton Universal Prefix",
		icon: <IconsModule.Settings />,
		content: <SettingsContent />,
	};
});

import { definePlugin, callable, Field, TextField, IconsModule } from '@steambrew/client';
import React, { useState } from 'react';

// JSX namespace declaration for JSX factory
declare global {
	namespace JSX {
		interface IntrinsicElements {
			[elemName: string]: any;
		}
	}
}

const CONFIG_KEY = 'proton_universal_prefix.config';

const config: { protonPrefixPath: string } = {
	protonPrefixPath: '',
	...JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'),
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

const createSymlinks = callable<[{ app_id: string; compatdata_path: string; proton_prefix_path: string }], string>('create_symlinks');

function getLaunchOptions(appId: number): Promise<string> {
	return new Promise((resolve) => {
		const registration = window.SteamClient.Apps.RegisterForAppDetails(appId, (details) => {
			registration.unregister();
			resolve(details.strLaunchOptions);
		});
	});
}

async function getCompatdataPath(appId: number): Promise<string | undefined> {
	const folders = await window.SteamClient.InstallFolder.GetInstallFolders();
	const folder = folders.find((f) => f.vecApps.some((app) => app.nAppID === appId));
	return folder && `${folder.strFolderPath}/steamapps/compatdata/${appId}`;
}

/**
 * Points the game's compatdata folder at the universal prefix when Steam starts launching it.
 */
async function onGameActionStart(_gameActionId: number, appId: string, action: string) {
	if (action !== 'LaunchApp' || !config.protonPrefixPath) return;

	try {
		const numericAppId = parseInt(appId);
		if ((await getLaunchOptions(numericAppId)).includes('-disableSymlink')) return;

		const compatdataPath = await getCompatdataPath(numericAppId);
		if (!compatdataPath) return;

		plugin.log(await createSymlinks({
			app_id: appId,
			compatdata_path: compatdataPath,
			proton_prefix_path: config.protonPrefixPath,
		}));
	} catch (error) {
		plugin.error(`Error preparing prefix for app ${appId}:`, error);
	}
}

const SettingsContent = () => {
	const [prefixPath, setPrefixPath] = useState(config.protonPrefixPath);

	return (
		<Field
			label="Proton Prefix Path"
			description="Path to your universal Proton Windows prefix (e.g., /home/user/ProtonPrefix). Leave empty to disable."
			bottomSeparator="standard"
			focusable
		>
			<TextField
				value={prefixPath}
				onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
					config.protonPrefixPath = e.currentTarget.value;
					setPrefixPath(config.protonPrefixPath);
					localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
				}}
			/>
		</Field>
	);
};

export default definePlugin(() => {
	window.SteamClient.Apps.RegisterForGameActionStart(onGameActionStart);

	return {
		title: 'Proton Universal Prefix',
		icon: <IconsModule.Settings />,
		content: <SettingsContent />,
	};
});

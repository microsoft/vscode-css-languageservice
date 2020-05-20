/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from "vscode-uri";
import { endsWith, startsWith } from "./strings";

const Slash = '/'.charCodeAt(0);

export function isAbsolutePath(path: string) {
	return path.charCodeAt(0) === Slash;
}

export function dirname(uri: string) {
	const lastIndexOfSlash = uri.lastIndexOf('/');
	return lastIndexOfSlash !== -1 ? uri.substr(0, lastIndexOfSlash) : '';
}

export function basename(uri: string) {
	const lastIndexOfSlash = uri.lastIndexOf('/');
	return uri.substr(lastIndexOfSlash + 1);
}

export function joinPath(uriString: string, ...paths: string[]): string {
	const uri = URI.parse(uriString);
	let uriPath = uri.path;
	for (let path of paths) {
		if (!endsWith(uriPath, '/') && !startsWith(path, '/')) {
			uriPath += '/';
		}
		uriPath += path;
	}
	return uri.with({ path: uriPath }).toString();
}

export function resolvePath(uriString: string, path: string): string {
	if (isAbsolutePath(path)) {
		const uri = URI.parse(uriString);
		return uri.with({ path: path }).toString();
	}
	return joinPath(uriString, path);
}


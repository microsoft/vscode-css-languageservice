/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileSystemProvider, FileType } from "../../cssLanguageTypes";
import { URI } from 'vscode-uri';
import { promises as fs } from 'fs';

export function getFsProvider(): FileSystemProvider {
	return {
		async stat(documentUriString: string) {
			const documentUri = URI.parse(documentUriString);
			if (documentUri.scheme !== 'file') {
				throw new Error('Protocol not supported: ' + documentUri.scheme);
			}
			try {
				const stats = await fs.stat(documentUri.fsPath);
				let type = FileType.Unknown;
				if (stats.isFile()) {
					type = FileType.File;
				} else if (stats.isDirectory()) {
					type = FileType.Directory;
				} else if (stats.isSymbolicLink()) {
					type = FileType.SymbolicLink;
				}
				return {
					type,
					ctime: stats.ctime.getTime(),
					mtime: stats.mtime.getTime(),
					size: stats.size
				};
			} catch (err: any) {
				if (err.code === 'ENOENT') {
					return {
						type: FileType.Unknown,
						ctime: -1,
						mtime: -1,
						size: -1
					};
				} else {
					throw err;
				}
			}
		},
		async readDirectory(locationString: string) {
			const location = URI.parse(locationString);
			if (location.scheme !== 'file') {
				throw new Error('Protocol not supported: ' + location.scheme);
			}
			const children = await fs.readdir(location.fsPath, { withFileTypes: true });
			return children.map(stat => {
				if (stat.isSymbolicLink()) {
					return [stat.name, FileType.SymbolicLink];
				} else if (stat.isDirectory()) {
					return [stat.name, FileType.Directory];
				} else if (stat.isFile()) {
					return [stat.name, FileType.File];
				} else {
					return [stat.name, FileType.Unknown];
				}
			});
		},
		async getContent(locationString, encoding = "utf-8") {
			const location = URI.parse(locationString);
			if (location.scheme !== 'file') {
				throw new Error('Protocol not supported: ' + location.scheme);
			}
			return await fs.readFile(location.fsPath, { encoding: encoding as BufferEncoding });
		}
	};
}
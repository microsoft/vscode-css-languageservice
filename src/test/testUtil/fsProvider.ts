/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileSystemProvider, FileType } from "../../cssLanguageTypes";
import { URI } from 'vscode-uri';
import { stat as fsStat, readdir } from 'fs';

export function getFsProvider(): FileSystemProvider {
	return {
		stat(documentUriString: string) {
			return new Promise((c, e) => {
				const documentUri = URI.parse(documentUriString);
				if (documentUri.scheme !== 'file') {
					e(new Error('Protocol not supported: ' + documentUri.scheme));
					return;
				}
				fsStat(documentUri.fsPath, (err, stats) => {
					if (err) {
						if (err.code === 'ENOENT') {
							return c({
								type: FileType.Unknown,
								ctime: -1,
								mtime: -1,
								size: -1
							});
						} else {
							return e(err);
						}
					}

					let type = FileType.Unknown;
					if (stats.isFile()) {
						type = FileType.File;
					} else if (stats.isDirectory()) {
						type = FileType.Directory;
					} else if (stats.isSymbolicLink()) {
						type = FileType.SymbolicLink;
					}

					c({
						type,
						ctime: stats.ctime.getTime(),
						mtime: stats.mtime.getTime(),
						size: stats.size
					});
				});
			});
		},
		readDirectory(locationString: string) {
			return new Promise((c, e) => {
				const location = URI.parse(locationString);
				if (location.scheme !== 'file') {
					e(new Error('Protocol not supported: ' + location.scheme));
					return;
				}
				readdir(location.fsPath, { withFileTypes: true }, (err, children) => {
					if (err) {
						return e(err);
					}
					c(children.map(stat => {
						if (stat.isSymbolicLink()) {
							return [stat.name, FileType.SymbolicLink];
						} else if (stat.isDirectory()) {
							return [stat.name, FileType.Directory];
						} else if (stat.isFile()) {
							return [stat.name, FileType.File];
						} else {
							return [stat.name, FileType.Unknown];
						}
					}));
				});
			});
		}
	};
}
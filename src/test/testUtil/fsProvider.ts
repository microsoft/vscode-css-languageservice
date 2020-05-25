/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileSystemProvider, FileType } from "../../cssLanguageTypes";
import { URI } from 'vscode-uri';
import { stat as fsStat, readdir } from 'fs';

export function getFsProvider(): FileSystemProvider {
	return {
		stat(documentUri: string) {
			const filePath = URI.parse(documentUri).fsPath;

			return new Promise((c, e) => {
				fsStat(filePath, (err, stats) => {
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
		readDirectory(location: string) {
			return new Promise((c, e) => {
				const path = URI.parse(location).fsPath;

				readdir(path, { withFileTypes: true }, (err, children) => {
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
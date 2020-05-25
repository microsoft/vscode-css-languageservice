/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as url from 'url';

import { DocumentContext } from "../../cssLanguageTypes";
import { startsWith } from "../../utils/strings";
import { joinPath } from "../../utils/resources";

export function getDocumentContext(documentUrl: string, workspaceFolder?: string): DocumentContext {
	return {
		resolveReference: (ref, base = documentUrl) => {
			if (startsWith(ref, '/') && workspaceFolder) {
				return joinPath(workspaceFolder, ref);
			}
			return url.resolve(base, ref);
		}
	};
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as url from 'url';

import { DocumentContext } from '../../cssLanguageTypes';
import { startsWith } from '../../utils/strings';
import { joinPath } from '../../utils/resources';

export function getDocumentContext(workspaceFolder?: string): DocumentContext {
	return {
		resolveReference: (ref, base) => {
			if (startsWith(ref, '/') && workspaceFolder) {
				return joinPath(workspaceFolder, ref);
			}
			try {
				return url.resolve(base, ref);
			} catch (e) {
				return undefined;
			}

		}
	};
}
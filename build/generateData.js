/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const fs = require('fs')
const path = require('path')
const os = require('os')

const customData = require('@vscode/web-custom-data/data/browsers.css-data.json');

function toJavaScript(obj) {
	return JSON.stringify(obj, null, '\t');
}

const DATA_TYPE = 'CSSDataV1';
const output = [
	'/*---------------------------------------------------------------------------------------------',
	' *  Copyright (c) Microsoft Corporation. All rights reserved.',
	' *  Licensed under the MIT License. See License.txt in the project root for license information.',
	' *--------------------------------------------------------------------------------------------*/',
	'// file generated from vscode-web-custom-data NPM package',
	'',
	`import { ${DATA_TYPE} } from '../cssLanguageTypes';`,
	'',
	`export const cssData : ${DATA_TYPE} = ` + toJavaScript(customData) + ';'
];

var outputPath = path.resolve(__dirname, '../src/data/webCustomData.ts');
console.log('Writing to: ' + outputPath);
var content = output.join(os.EOL);
fs.writeFileSync(outputPath, content);
console.log('Done');

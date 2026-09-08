/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function getVersion(moduleName) {
    const packageJSONPath = path.join(__dirname, '..', 'node_modules', moduleName, 'package.json');
    const content = await readFile(packageJSONPath);
    try {
        return JSON.parse(content).version;
    } catch {
        return null;
    }
}

function readFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res.toString());
            }
        });
    });
}

async function update(moduleName, repoPath, dest, addHeader, patch) {
    const contentPath = path.join(__dirname, '..', 'node_modules', moduleName, repoPath);
    console.log('Reading from ' + contentPath);
    try {
        let content = await readFile(contentPath);
        const version = await getVersion(moduleName);
        let header = '';
        if (addHeader) {
            header = '// copied from js-beautify/' + repoPath + '\n';
            if (version) {
                header += '// version: ' + version + '\n';
            }
        }
        if (patch) {
            content = patch(content);
        }
        fs.writeFileSync(dest, header + content);
        if (version) {
            console.log('Updated ' + path.basename(dest) + ' (' + version + ')');
        } else {
            console.log('Updated ' + path.basename(dest));
        }
    } catch (e) {
        console.error(e);
    }
}

await Promise.all([
    update('js-beautify', 'LICENSE', './src/beautify/beautify-license'),
    // Write the ESM-compatible variant directly to the main source path.
    update('js-beautify', 'js/lib/beautify-css.js', './src/beautify/beautify-css.js', true, (contents) => {
        const topLevelFunction = '(function() {';
        const outputVar = 'var legacy_beautify_css';
        const footer = 'var css_beautify = legacy_beautify_css;';
        const index1 = contents.indexOf(topLevelFunction);
        const index2 = contents.indexOf(outputVar, index1);
        const index3 = contents.indexOf(footer, index2);
        if (index1 === -1) {
            throw new Error(`Problem patching beautify.css for ESM: '${topLevelFunction}' not found.`);
        }
        if (index2 === -1) {
            throw new Error(`Problem patching beautify.css for ESM: '${outputVar}' not found after '${topLevelFunction}'.`);
        }
        if (index3 === -1) {
            throw new Error(`Problem patching beautify.css for ESM: '${footer}' not found after '${outputVar}'.`);
        }
        return contents.substring(0, index1) +
            contents.substring(index2, index3) +
            '\nexport var css_beautify = legacy_beautify_css;';
    })
]);

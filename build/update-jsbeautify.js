/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

var path = require('path');
var fs = require('fs');

function getVersion(moduleName) {
    var packageJSONPath = path.join(__dirname, '..', 'node_modules', moduleName, 'package.json');
    return readFile(packageJSONPath).then(function (content) {
        try {
            return JSON.parse(content).version;
        } catch (e) {
            return Promise.resolve(null);
        }
    });
}

function readFile(path) {
    return new Promise((s, e) => {
        fs.readFile(path, (err, res) => {
            if (err) {
                e(err);
            } else {
                s(res.toString());
            }
        });
    });

}

function update(moduleName, repoPath, dest, addHeader, patch) {
    var contentPath = path.join(__dirname, '..', 'node_modules', moduleName, repoPath);
    console.log('Reading from ' + contentPath);
    return readFile(contentPath).then(function (content) {
        return getVersion(moduleName).then(function (version) {
            let header = '';
            if (addHeader) {
                header = '// copied from js-beautify/' + repoPath + '\n';
                if (version) {
                    header += '// version: ' + version + '\n';
                }
            }
            try {
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
        });

    }, console.error);
}

update('js-beautify', 'js/lib/beautify-css.js', './src/beautify/beautify-css.js', true);
update('js-beautify', 'LICENSE', './src/beautify/beautify-license');

// ESM version
update('js-beautify', 'js/lib/beautify-css.js', './src/beautify/esm/beautify-css.js', true, function (contents) {
    let topLevelFunction = '(function() {';
    let outputVar = 'var legacy_beautify_css';
    let footer = 'var css_beautify = legacy_beautify_css;';
    let index1 = contents.indexOf(topLevelFunction);
    let index2 = contents.indexOf(outputVar, index1);
    let index3 = contents.indexOf(footer, index2);
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
        `\nexport var css_beautify = legacy_beautify_css;`;
});

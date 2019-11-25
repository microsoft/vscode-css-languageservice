/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

const cp = require('child_process');
const fs = require('fs');
const readline = require('readline');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function updateNextTag() {
  // read package.json from the current working directory
  var packageJSON = JSON.parse(fs.readFileSync('package.json').toString());
  var name = packageJSON.name;
  var version = packageJSON.version;
  if (version.indexOf('next') !== -1) {
    return;
  }

  console.log(name + ": set 'next' tag to latest version");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.question('Enter OTP token: ', (token) => {
    const result = cp.spawnSync(npm, ['--otp', token, 'dist-tags', 'add', name + '@' + version, 'next'], { stdio: 'inherit' });

    rl.close();

    if (result.error || result.status !== 0) {
      process.exit(1);
    }
  });
}

updateNextTag()
const fs = require('fs');
const path = require('path');

function copy(from, to) {
	if (!fs.existsSync(to)) {
		fs.mkdirSync(to);
	}
	const files = fs.readdirSync(from);
	for (let file of files) {
		if (path.extname(file) === '.js') {
			const fromPath = path.join(from, file);
			const toPath = path.join(to, file);
			console.log(`copy ${fromPath} to ${toPath}`);
			fs.copyFileSync(fromPath, toPath);
		}
	}
}

if (!fs.existsSync(path.join(__dirname, '..', 'lib', 'umd'))) {
	fs.mkdirSync(path.join(__dirname, '..', 'lib', 'umd'));
}

if (!fs.existsSync(path.join(__dirname, '..', 'lib', 'esm'))) {
	fs.mkdirSync(path.join(__dirname, '..', 'lib', 'esm'));
}

const umdDir = path.join(__dirname, '..', 'lib', 'umd', 'beautify');
copy(path.join(__dirname, '..', 'src', 'beautify'), umdDir);

const esmDir = path.join(__dirname, '..', 'lib', 'esm', 'beautify');
copy(path.join(__dirname, '..', 'src', 'beautify', 'esm'), esmDir);

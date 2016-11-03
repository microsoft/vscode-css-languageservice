/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

var gulp = require('gulp');
var tsb = require('gulp-tsb');
var assign = require('object-assign');
var rimraf = require('rimraf');
var merge = require('merge-stream');
var path = require('path');
var uri = require('vscode-uri').default;

// set sourceRoot to an absolute location to workaround https://github.com/jrieken/gulp-tsb/issues/48
var sourceRoot = uri.file(path.join(__dirname, 'src')).toString(); 

var compilation = tsb.create(assign({ verbose: true, sourceRoot: sourceRoot }, require('./src/tsconfig.json').compilerOptions));
var tsSources = 'src/**/*.ts';
var outFolder = 'lib';

function compileTask() {
	return merge(
		gulp.src('src/data/**', { base: 'src' }),
		gulp.src(tsSources).pipe(compilation())
	)
	.pipe(gulp.dest(outFolder));
}

gulp.task('clean-out', function() { rimraf.sync(outFolder, { maxBusyTries: 1 }); });
gulp.task('compile', ['clean-out'], compileTask);
gulp.task('compile-without-clean', compileTask);
gulp.task('watch', ['compile'], function() {
	gulp.watch(tsSources, ['compile-without-clean']);
});
gulp.task('update-browserjs', function() {
	require('./build/generate_browserjs');
});

var vscodeCSSLibFolder = '../vscode/extensions/css/server/node_modules/vscode-css-languageservice/lib';

gulp.task('clean-vscode-css', function() { rimraf.sync(vscodeCSSLibFolder, { maxBusyTries: 1 }); });
gulp.task('compile-vscode-css', ['clean-out', 'clean-vscode-css', 'compile-vscode-css-without-clean']);
gulp.task('compile-vscode-css-without-clean', function() {
	return compileTask().pipe(gulp.dest(vscodeCSSLibFolder));
});
gulp.task('watch-vscode-css', ['compile-vscode-css'], function() {
	gulp.watch(tsSources, ['compile-vscode-css-without-clean']);
});
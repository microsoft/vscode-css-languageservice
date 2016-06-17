/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

var gulp = require('gulp');
var tsb = require('gulp-tsb');
var assign = require('object-assign');
var rimraf = require('rimraf');
var merge = require('merge-stream');

var compilation = tsb.create(assign({ verbose: true }, require('./src/tsconfig.json').compilerOptions));
var tsSources = 'src/**/*.ts';

function compileTask() {
	return merge(
		gulp.src('src/data/**', { base: 'src' }),
		gulp.src(tsSources).pipe(compilation())
	)
	.pipe(gulp.dest('lib'));
}

gulp.task('clean-out', function(cb) { rimraf('lib', { maxBusyTries: 1 }, cb); });
gulp.task('compile', ['clean-out'], compileTask);
gulp.task('compile-without-clean', compileTask);
gulp.task('watch', ['compile'], function() {
	gulp.watch(tsSources, ['compile-without-clean']);
});
gulp.task('update-browserjs', function() {
	require('./build/generate_browserjs')();
});
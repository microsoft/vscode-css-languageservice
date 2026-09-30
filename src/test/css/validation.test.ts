/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { suite, test } from 'node:test';
import * as assert from 'node:assert';
import {
	getCSSLanguageService, getLESSLanguageService, getSCSSLanguageService,
	TextDocument, LanguageSettings, DiagnosticSeverity
} from '../../cssLanguageService.js';

for (const [languageId, createService] of Object.entries({
	css: getCSSLanguageService,
	less: getLESSLanguageService,
	scss: getSCSSLanguageService
})) {
	suite(`${languageId.toUpperCase()} - Validation settings`, () => {
		for (const json of ['null', '{"lint":null}']) {
			for (const configured of [false, true]) {
				test(`${configured ? 'configured' : 'document'} settings ${json} use default lint rules`, () => {
					const service = createService();
					const document = TextDocument.create(`test://test/test.${languageId}`, languageId, 0, '.test { unknown-property: 1; }');
					const stylesheet = service.parseStylesheet(document);
					const expected = service.doValidation(document, stylesheet);
					assert.deepStrictEqual(expected.map(d => [d.code, d.severity]), [['unknownProperties', DiagnosticSeverity.Warning]]);

					// Configuration received over JSON may contain null despite the TypeScript type.
					const settings: LanguageSettings = JSON.parse(json);
					service.configure({ lint: { unknownProperties: 'error' } });
					if (configured) {
						service.configure(settings);
						assert.deepStrictEqual(service.doValidation(document, stylesheet), expected);
					} else {
						assert.deepStrictEqual(service.doValidation(document, stylesheet, settings), expected);
					}
				});
			}
		}

		test('preserves explicit lint settings and disabled validation', () => {
			const service = createService();
			const document = TextDocument.create(`test://test/test.${languageId}`, languageId, 0, '.test { unknown-property: 1; }');
			const stylesheet = service.parseStylesheet(document);

			service.configure({ lint: { unknownProperties: 'ignore' } });
			assert.deepStrictEqual(service.doValidation(document, stylesheet), []);
			const errors = service.doValidation(document, stylesheet, { lint: { unknownProperties: 'error' } });
			assert.deepStrictEqual(errors.map(d => [d.code, d.severity]), [['unknownProperties', DiagnosticSeverity.Error]]);
			assert.deepStrictEqual(service.doValidation(document, stylesheet, { lint: { validProperties: ['unknown-property'] } }), []);
			assert.deepStrictEqual(service.doValidation(document, stylesheet, { validate: false }), []);
		});
	});
}

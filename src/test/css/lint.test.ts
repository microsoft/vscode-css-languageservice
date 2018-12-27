/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import { Node, IRule, Level } from '../../parser/cssNodes';
import { Parser } from '../../parser/cssParser';
import { LintVisitor } from '../../services/lint';
import { Rule, Rules, LintConfigurationSettings } from '../../services/lintRules';
import { TextDocument } from 'vscode-languageserver-types';
import { SCSSParser } from '../../parser/scssParser';
import { LESSParser } from '../../parser/lessParser';

export function assertEntries(node: Node, document: TextDocument, rules: IRule[], settings = new LintConfigurationSettings()): void {

	let entries = LintVisitor.entries(node, document, settings, Level.Error | Level.Warning | Level.Ignore);
	assert.equal(entries.length, rules.length, entries.map(e => e.getRule().id).join(', '));

	for (let entry of entries) {
		assert.ok(rules.indexOf(entry.getRule()) !== -1, `${entry.getRule().id} found but not expected (${rules.map(r => r.id).join(', ')})`);
	}
}
let parsers = [new Parser(), new LESSParser(), new SCSSParser()];

function assertStyleSheet(input: string, ...rules: Rule[]): void {
	for (let p of parsers) {
		let document = TextDocument.create('test://test/test.css', 'css', 0, input);
		let node = p.parseStylesheet(document);

		assertEntries(node, document, rules);
	}
}

function assertRuleSet(input: string, ...rules: Rule[]): void {
	assertRuleSetWithSettings(input, rules);
}

function assertRuleSetWithSettings(input: string, rules: Rule[], settings = new LintConfigurationSettings()): void {
	for (let p of parsers) {
		let document = TextDocument.create('test://test/test.css', 'css', 0, input);
		let node = p.internalParse(input, p._parseRuleset);
		assertEntries(node, document, rules, settings);
	}
}


function assertFontFace(input: string, ...rules: Rule[]): void {
	for (let p of parsers) {
		let document = TextDocument.create('test://test/test.css', 'css', 0, input);
		let node = p.internalParse(input, p._parseFontFace);
		assertEntries(node, document, rules);
	}
}

suite('CSS - Lint', () => {

	test('universal selector, empty rule', function () {
		assertRuleSet('* { color: perty }', Rules.UniversalSelector);
		assertRuleSet('*, div { color: perty }', Rules.UniversalSelector);
		assertRuleSet('div, * { color: perty }', Rules.UniversalSelector);
		assertRuleSet('div > * { color: perty }', Rules.UniversalSelector);
		assertRuleSet('div + * { color: perty }', Rules.UniversalSelector);
	});

	test('empty ruleset', function () {
		assertRuleSet('selector {}', Rules.EmptyRuleSet);
	});

	test('properies ignored due to inline ', function () {
		assertRuleSet('selector { display: inline; height: 100px; }', Rules.PropertyIgnoredDueToDisplay);
		assertRuleSet('selector { display: inline; width: 100px; }', Rules.PropertyIgnoredDueToDisplay);
		assertRuleSet('selector { display: inline; margin-top: 1em; }', Rules.PropertyIgnoredDueToDisplay);
		assertRuleSet('selector { display: inline; margin-bottom: 1em; }', Rules.PropertyIgnoredDueToDisplay);
		assertRuleSet('selector { display: inline; float: right; }', Rules.PropertyIgnoredDueToDisplay, Rules.AvoidFloat);
		assertRuleSet('selector { display: inline; float: none; }', Rules.AvoidFloat);
		assertRuleSet('selector { display: inline-block; float: right; }', Rules.PropertyIgnoredDueToDisplay, Rules.AvoidFloat);
		assertRuleSet('selector { display: inline-block; float: none; }', Rules.AvoidFloat);
		assertRuleSet('selector { display: block; vertical-align: center; }', Rules.PropertyIgnoredDueToDisplay);
	});

	test('avoid !important', function () {
		assertRuleSet('selector { display: inline !important; }', Rules.AvoidImportant);
	});

	test('avoid float', function () {
		assertRuleSet('selector { float: right; }', Rules.AvoidFloat);
	});

	test('avoid id selectors', function () {
		assertRuleSet('#selector {  display: inline; }', Rules.AvoidIdSelector);
	});

	test('zero with unit', function () {
		assertRuleSet('selector { width: 0px }', Rules.ZeroWithUnit);
		assertRuleSet('selector { width: 0Px }', Rules.ZeroWithUnit);
		assertRuleSet('selector { line-height: 0EM }', Rules.ZeroWithUnit);
		assertRuleSet('selector { line-height: 0pc }', Rules.ZeroWithUnit);
		assertRuleSet('selector { outline: black 0em solid; }', Rules.ZeroWithUnit);
		assertRuleSet('selector { grid-template-columns: 40px 50px auto 0px 40px; }', Rules.ZeroWithUnit);
		assertRuleSet('selector { min-height: 0% }');
		assertRuleSet('selector { top: calc(0px - 10vw); }'); // issue 46997
	});

	test('duplicate declarations', function () {
		assertRuleSet('selector { color: perty; color: perty }', Rules.DuplicateDeclarations, Rules.DuplicateDeclarations);
		assertRuleSet('selector { color: -o-perty; color: perty }');
	});

	test('unknown properties', function () {
		assertRuleSet('selector { -ms-property: "rest is missing" }', Rules.UnknownVendorSpecificProperty);
		assertRuleSet('selector { -moz-box-shadow: "rest is missing" }', Rules.UnknownVendorSpecificProperty, Rules.IncludeStandardPropertyWhenUsingVendorPrefix);
		assertRuleSet('selector { box-shadow: none }'); // no error
		assertRuleSet('selector { box-property: "rest is missing" }', Rules.UnknownProperty);
		assertRuleSetWithSettings('selector { foo: "some"; bar: 0px }', [], new LintConfigurationSettings({ validProperties: ['foo', 'bar'] }));
		assertRuleSetWithSettings('selector { foo: "some"; }', [], new LintConfigurationSettings({ validProperties: ['foo', null] }));
		assertRuleSetWithSettings('selector { bar: "some"; }', [Rules.UnknownProperty], new LintConfigurationSettings({ validProperties: ['foo'] }));
	});

	test('box model', function () {
		// border shorthand, zero values
		assertRuleSet('.mybox { height: 100px;         border: initial;           }');
		assertRuleSet('.mybox { height: 100px;         border: unset;             }');
		assertRuleSet('.mybox { height: 100px;         border: none;              }');
		assertRuleSet('.mybox { height: 100px;         border: hidden;            }');
		assertRuleSet('.mybox { height: 100px;         border: 0;                 }');
		assertRuleSet('.mybox { height: 100px;         border: 0 solid;           }');
		assertRuleSet('.mybox { height: 100px;         border: 1px none;          }');
		assertRuleSet('.mybox { height: 100px;         border: 0 solid #ccc;      }');
		// order doesn't matter
		assertRuleSet('.mybox { border: initial;       height: 100px;             }');
		assertRuleSet('.mybox { border: 0;             height: 100px;             }');

		// border shorthand, non-zero values
		assertRuleSet('.mybox { height: 100px;         border: 1px;               }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);
		assertRuleSet('.mybox { height: 100px;         border: 1px solid;         }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);
		assertRuleSet('.mybox { width: 100px;          border: 1px;               }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);
		// order doesn't matter
		assertRuleSet('.mybox { border: 1px;           height: 100px;             }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);
		assertRuleSet('.mybox { border: 1px solid;     height: 100px;             }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);

		// border-top shorthand, zero values
		assertRuleSet('.mybox { height: 100px;         border-top: initial;       }');
		assertRuleSet('.mybox { height: 100px;         border-top: none;          }');
		assertRuleSet('.mybox { height: 100px;         border-top: 0;             }');
		assertRuleSet('.mybox { height: 100px;         border-top: 0 solid;       }');
		assertRuleSet('.mybox { width: 100px;          border-top: 1px;           }');
		assertRuleSet('.mybox { width: 100px;          border-top: 1px solid;     }');

		// border-top shorthand, non-zero values
		assertRuleSet('.mybox { height: 100px;         border-top: 1px;           }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize); // shorthand | single value | 1px
		assertRuleSet('.mybox { height: 100px;         border-top: 1px solid;     }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize); // shorthand |

		// border-width shorthand, zero values
		assertRuleSet('.mybox { height: 100px;         border-width: 0;           }');
		assertRuleSet('.mybox { height: 100px;         border-width: 0 0;         }');
		assertRuleSet('.mybox { height: 100px;         border-width: 0 0 0;       }');
		assertRuleSet('.mybox { height: 100px;         border-width: 0 0 0 0;     }');
		assertRuleSet('.mybox { height: 100px;         border-width: 0 1px;       }');
		assertRuleSet('.mybox { height: 100px;         border-width: 0 1px 0 1px; }');
		assertRuleSet('.mybox { width: 100px;          border-width: 1px 0;       }');
		assertRuleSet('.mybox { width: 100px;          border-width: 1px 0 1px 0; }');

		// border-width shorthand, non-zero values
		assertRuleSet('.mybox { height: 100px;         border-width: 1px;         }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);
		assertRuleSet('.mybox { height: 100px;         border-width: 0 0 1px;     }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);
		assertRuleSet('.mybox { width: 100px;          border-width: 0 1px;       }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);
		assertRuleSet('.mybox { width: 100px;          border-width: 0 0 0 1px;   }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);

		// border-style shorthand, zero values
		assertRuleSet('.mybox { height: 100px;         border-style: unset;       }');
		assertRuleSet('.mybox { height: 100px;         border-style: initial;     }');
		assertRuleSet('.mybox { height: 100px;         border-style: none;        }');
		assertRuleSet('.mybox { height: 100px;         border-style: hidden;      }');

		// border-style shorthand, non-zero values
		assertRuleSet('.mybox { height: 100px;         border-style: solid;       }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);
		assertRuleSet('.mybox { height: 100px;         border-style: dashed;      }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);

		// border-top-width property, zero values
		assertRuleSet('.mybox { height: 100px;         border-top-width: 0;       }');
		assertRuleSet('.mybox { width: 100px;          border-top-width: 1px;     }');

		// border-top-width property, non-zero values
		assertRuleSet('.mybox { height: 100px;         border-top-width: 1px;     }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);

		// border-top-style property, zero values
		assertRuleSet('.mybox { height: 100px;         border-top-style: unset;   }');
		assertRuleSet('.mybox { width: 100px;          border-top-style: solid;   }');

		// border-top-style property, non-zero values
		assertRuleSet('.mybox { height: 100px;         border-top-style: solid;   }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);

		// padding shorthand, zero values
		assertRuleSet('.mybox { height: 100px;         padding: initial;          }');
		assertRuleSet('.mybox { height: 100px;         padding: unset;            }');
		assertRuleSet('.mybox { height: 100px;         padding: 0;                }');
		assertRuleSet('.mybox { height: 100px;         padding: 0 0;              }');
		assertRuleSet('.mybox { height: 100px;         padding: 0 0 0;            }');
		assertRuleSet('.mybox { height: 100px;         padding: 0 0 0 0;          }');
		assertRuleSet('.mybox { height: 100px;         padding: 0 1px;            }');
		assertRuleSet('.mybox { height: 100px;         padding: 0 1px 0 1px;      }');
		assertRuleSet('.mybox { width: 100px;          padding: 1px 0;            }');
		assertRuleSet('.mybox { width: 100px;          padding: 1px 0 1px;        }');

		// padding shorthand, non-zero values
		assertRuleSet('.mybox { height: 100px;         padding: 1px;              }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);
		assertRuleSet('.mybox { height: 100px;         padding: 1px 0;            }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);
		assertRuleSet('.mybox { height: 100px;         padding: 0 0 1px;          }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);

		// box-sizing supress errors
		assertRuleSet('.mybox { height: 100px;         border: 1px;               box-sizing: border-box; }');

		// property be overriden
		assertRuleSet('.mybox { height: 100px;         border: 1px;               border-top: 0; border-bottom: 0; }');
	});

	test('IE hacks', function () {
		assertRuleSet('selector { display: inline-block; *display: inline; }', Rules.IEStarHack);
		assertRuleSet('selector { background: #00f; /* all browsers including Mac IE */ *background: #f00; /* IE 7 and below */ _background: #f60; /* IE 6 and below */  }', Rules.IEStarHack, Rules.IEStarHack);
	});

	test('vendor specific prefixes', function () {
		assertRuleSet('selector { -moz-animation: none }', Rules.AllVendorPrefixes, Rules.IncludeStandardPropertyWhenUsingVendorPrefix);
		assertRuleSet('selector { -moz-transform: none; transform: none }', Rules.AllVendorPrefixes);
		assertRuleSet('selector { transform: none; }');
		assertRuleSet('selector { -moz-transform: none; transform: none; -o-transform: none; -webkit-transform: none; -ms-transform: none; }');
		assertRuleSet('selector { --transform: none; }');
		assertRuleSet('selector { -webkit-appearance: none }');
	});

	test('font-face required properties', function () {
		assertFontFace('@font-face {  }', Rules.RequiredPropertiesForFontFace);
		assertFontFace('@font-face { src: url(test.tff) }', Rules.RequiredPropertiesForFontFace);
		assertFontFace('@font-face { font-family: \'name\' }', Rules.RequiredPropertiesForFontFace);
		assertFontFace('@font-face { src: url(test.tff); font-family: \'name\' }'); // no error
	});

	test('keyframes', function () {
		assertStyleSheet('@keyframes foo { }');
		assertStyleSheet('@keyframes foo { } @-moz-keyframes foo { }', Rules.AllVendorPrefixes);
		assertStyleSheet('@-moz-keyframes foo { }', Rules.AllVendorPrefixes, Rules.IncludeStandardPropertyWhenUsingVendorPrefix);
	});
});

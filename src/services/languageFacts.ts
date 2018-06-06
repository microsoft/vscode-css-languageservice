/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../parser/cssNodes';
import * as browsers from '../data/browsers';

import * as nls from 'vscode-nls';
import { Color } from '../cssLanguageTypes';
import { endsWith } from '../utils/strings';
const localize = nls.loadMessageBundle();

export let colors: { [name: string]: string } = {
	aliceblue: '#f0f8ff',
	antiquewhite: '#faebd7',
	aqua: '#00ffff',
	aquamarine: '#7fffd4',
	azure: '#f0ffff',
	beige: '#f5f5dc',
	bisque: '#ffe4c4',
	black: '#000000',
	blanchedalmond: '#ffebcd',
	blue: '#0000ff',
	blueviolet: '#8a2be2',
	brown: '#a52a2a',
	burlywood: '#deb887',
	cadetblue: '#5f9ea0',
	chartreuse: '#7fff00',
	chocolate: '#d2691e',
	coral: '#ff7f50',
	cornflowerblue: '#6495ed',
	cornsilk: '#fff8dc',
	crimson: '#dc143c',
	cyan: '#00ffff',
	darkblue: '#00008b',
	darkcyan: '#008b8b',
	darkgoldenrod: '#b8860b',
	darkgray: '#a9a9a9',
	darkgrey: '#a9a9a9',
	darkgreen: '#006400',
	darkkhaki: '#bdb76b',
	darkmagenta: '#8b008b',
	darkolivegreen: '#556b2f',
	darkorange: '#ff8c00',
	darkorchid: '#9932cc',
	darkred: '#8b0000',
	darksalmon: '#e9967a',
	darkseagreen: '#8fbc8f',
	darkslateblue: '#483d8b',
	darkslategray: '#2f4f4f',
	darkslategrey: '#2f4f4f',
	darkturquoise: '#00ced1',
	darkviolet: '#9400d3',
	deeppink: '#ff1493',
	deepskyblue: '#00bfff',
	dimgray: '#696969',
	dimgrey: '#696969',
	dodgerblue: '#1e90ff',
	firebrick: '#b22222',
	floralwhite: '#fffaf0',
	forestgreen: '#228b22',
	fuchsia: '#ff00ff',
	gainsboro: '#dcdcdc',
	ghostwhite: '#f8f8ff',
	gold: '#ffd700',
	goldenrod: '#daa520',
	gray: '#808080',
	grey: '#808080',
	green: '#008000',
	greenyellow: '#adff2f',
	honeydew: '#f0fff0',
	hotpink: '#ff69b4',
	indianred: '#cd5c5c',
	indigo: '#4b0082',
	ivory: '#fffff0',
	khaki: '#f0e68c',
	lavender: '#e6e6fa',
	lavenderblush: '#fff0f5',
	lawngreen: '#7cfc00',
	lemonchiffon: '#fffacd',
	lightblue: '#add8e6',
	lightcoral: '#f08080',
	lightcyan: '#e0ffff',
	lightgoldenrodyellow: '#fafad2',
	lightgray: '#d3d3d3',
	lightgrey: '#d3d3d3',
	lightgreen: '#90ee90',
	lightpink: '#ffb6c1',
	lightsalmon: '#ffa07a',
	lightseagreen: '#20b2aa',
	lightskyblue: '#87cefa',
	lightslategray: '#778899',
	lightslategrey: '#778899',
	lightsteelblue: '#b0c4de',
	lightyellow: '#ffffe0',
	lime: '#00ff00',
	limegreen: '#32cd32',
	linen: '#faf0e6',
	magenta: '#ff00ff',
	maroon: '#800000',
	mediumaquamarine: '#66cdaa',
	mediumblue: '#0000cd',
	mediumorchid: '#ba55d3',
	mediumpurple: '#9370d8',
	mediumseagreen: '#3cb371',
	mediumslateblue: '#7b68ee',
	mediumspringgreen: '#00fa9a',
	mediumturquoise: '#48d1cc',
	mediumvioletred: '#c71585',
	midnightblue: '#191970',
	mintcream: '#f5fffa',
	mistyrose: '#ffe4e1',
	moccasin: '#ffe4b5',
	navajowhite: '#ffdead',
	navy: '#000080',
	oldlace: '#fdf5e6',
	olive: '#808000',
	olivedrab: '#6b8e23',
	orange: '#ffa500',
	orangered: '#ff4500',
	orchid: '#da70d6',
	palegoldenrod: '#eee8aa',
	palegreen: '#98fb98',
	paleturquoise: '#afeeee',
	palevioletred: '#d87093',
	papayawhip: '#ffefd5',
	peachpuff: '#ffdab9',
	peru: '#cd853f',
	pink: '#ffc0cb',
	plum: '#dda0dd',
	powderblue: '#b0e0e6',
	purple: '#800080',
	red: '#ff0000',
	rebeccapurple: '#663399',
	rosybrown: '#bc8f8f',
	royalblue: '#4169e1',
	saddlebrown: '#8b4513',
	salmon: '#fa8072',
	sandybrown: '#f4a460',
	seagreen: '#2e8b57',
	seashell: '#fff5ee',
	sienna: '#a0522d',
	silver: '#c0c0c0',
	skyblue: '#87ceeb',
	slateblue: '#6a5acd',
	slategray: '#708090',
	slategrey: '#708090',
	snow: '#fffafa',
	springgreen: '#00ff7f',
	steelblue: '#4682b4',
	tan: '#d2b48c',
	teal: '#008080',
	thistle: '#d8bfd8',
	tomato: '#ff6347',
	turquoise: '#40e0d0',
	violet: '#ee82ee',
	wheat: '#f5deb3',
	white: '#ffffff',
	whitesmoke: '#f5f5f5',
	yellow: '#ffff00',
	yellowgreen: '#9acd32'
};

export let colorKeywords: { [name: string]: string } = {
	'currentColor': 'The value of the \'color\' property. The computed value of the \'currentColor\' keyword is the computed value of the \'color\' property. If the \'currentColor\' keyword is set on the \'color\' property itself, it is treated as \'color:inherit\' at parse time.',
	'transparent': 'Fully transparent. This keyword can be considered a shorthand for rgba(0,0,0,0) which is its computed value.',
};

export let positionKeywords: { [name: string]: string } = {
	'bottom': 'Computes to ‘100%’ for the vertical position if one or two values are given, otherwise specifies the bottom edge as the origin for the next offset.',
	'center': 'Computes to ‘50%’ (‘left 50%’) for the horizontal position if the horizontal position is not otherwise specified, or ‘50%’ (‘top 50%’) for the vertical position if it is.',
	'left': 'Computes to ‘0%’ for the horizontal position if one or two values are given, otherwise specifies the left edge as the origin for the next offset.',
	'right': 'Computes to ‘100%’ for the horizontal position if one or two values are given, otherwise specifies the right edge as the origin for the next offset.',
	'top': 'Computes to ‘0%’ for the vertical position if one or two values are given, otherwise specifies the top edge as the origin for the next offset.'
};

export let repeatStyleKeywords: { [name: string]: string } = {
	'no-repeat': 'Placed once and not repeated in this direction.',
	'repeat': 'Repeated in this direction as often as needed to cover the background painting area.',
	'repeat-x': 'Computes to ‘repeat no-repeat’.',
	'repeat-y': 'Computes to ‘no-repeat repeat’.',
	'round': 'Repeated as often as will fit within the background positioning area. If it doesn’t fit a whole number of times, it is rescaled so that it does.',
	'space': 'Repeated as often as will fit within the background positioning area without being clipped and then the images are spaced out to fill the area.'
};

export let lineStyleKeywords: { [name: string]: string } = {
	'dashed': 'A series of square-ended dashes.',
	'dotted': 'A series of round dots.',
	'double': 'Two parallel solid lines with some space between them.',
	'groove': 'Looks as if it were carved in the canvas.',
	'hidden': 'Same as ‘none’, but has different behavior in the border conflict resolution rules for border-collapsed tables.',
	'inset': 'Looks as if the content on the inside of the border is sunken into the canvas.',
	'none': 'No border. Color and width are ignored.',
	'outset': 'Looks as if the content on the inside of the border is coming out of the canvas.',
	'ridge': 'Looks as if it were coming out of the canvas.',
	'solid': 'A single line segment.'
};

export let lineWidthKeywords = ['medium', 'thick', 'thin'];

export let boxKeywords: { [name: string]: string } = {
	'border-box': 'The background is painted within (clipped to) the border box.',
	'content-box': 'The background is painted within (clipped to) the content box.',
	'padding-box': 'The background is painted within (clipped to) the padding box.'
};

export let geometryBoxKeywords: { [name: string]: string } = {
	'margin-box': 'Uses the margin box as reference box.',
	'fill-box': 'Uses the object bounding box as reference box.',
	'stroke-box': 'Uses the stroke bounding box as reference box.',
	'view-box': 'Uses the nearest SVG viewport as reference box.'
};

export let cssWideKeywords: { [name: string]: string } = {
	'initial': 'Represents the value specified as the property’s initial value.',
	'inherit': 'Represents the computed value of the property on the element’s parent.',
	'unset': 'Acts as either `inherit` or `initial`, depending on whether the property is inherited or not.'
};

export let colorFunctions = [
	{ func: 'rgb($red, $green, $blue)', desc: localize('css.builtin.rgb', 'Creates a Color from red, green, and blue values.') },
	{ func: 'rgba($red, $green, $blue, $alpha)', desc: localize('css.builtin.rgba', 'Creates a Color from red, green, blue, and alpha values.') },
	{ func: 'hsl($hue, $saturation, $lightness)', desc: localize('css.builtin.hsl', 'Creates a Color from hue, saturation, and lightness values.') },
	{ func: 'hsla($hue, $saturation, $lightness, $alpha)', desc: localize('css.builtin.hsla', 'Creates a Color from hue, saturation, lightness, and alpha values.') }
];

export let imageFunctions: { [name: string]: string } = {
	'url()': 'Reference an image file by URL',
	'image()': 'Provide image fallbacks and annotations.',
	'-webkit-image-set()': 'Provide multiple resolutions. Remember to use unprefixed image-set() in addition.',
	'image-set()': 'Provide multiple resolutions of an image and let the UA decide which is most appropriate in a given situation.',
	'-moz-element()': 'Use an element in the document as an image. Remember to use unprefixed element() in addition.',
	'element()': 'Use an element in the document as an image.',
	'cross-fade()': 'Indicates the two images to be combined and how far along in the transition the combination is.',
	'-webkit-gradient()': 'Deprecated. Use modern linear-gradient() or radial-gradient() instead.',
	'-webkit-linear-gradient()': 'Linear gradient. Remember to use unprefixed version in addition.',
	'-moz-linear-gradient()': 'Linear gradient. Remember to use unprefixed version in addition.',
	'-o-linear-gradient()': 'Linear gradient. Remember to use unprefixed version in addition.',
	'linear-gradient()': 'A linear gradient is created by specifying a straight gradient line, and then several colors placed along that line.',
	'-webkit-repeating-linear-gradient()': 'Repeating Linear gradient. Remember to use unprefixed version in addition.',
	'-moz-repeating-linear-gradient()': 'Repeating Linear gradient. Remember to use unprefixed version in addition.',
	'-o-repeating-linear-gradient()': 'RepeatingLinear gradient. Remember to use unprefixed version in addition.',
	'repeating-linear-gradient()': 'Same as linear-gradient, except the color-stops are repeated infinitely in both directions, with their positions shifted by multiples of the difference between the last specified color-stop’s position and the first specified color-stop’s position.',
	'-webkit-radial-gradient()': 'Radial gradient. Remember to use unprefixed version in addition.',
	'-moz-radial-gradient()': 'Radial gradient. Remember to use unprefixed version in addition.',
	'radial-gradient()': 'Colors emerge from a single point and smoothly spread outward in a circular or elliptical shape.',
	'-webkit-repeating-radial-gradient()': 'Repeating radial gradient. Remember to use unprefixed version in addition.',
	'-moz-repeating-radial-gradient()': 'Repeating radial gradient. Remember to use unprefixed version in addition.',
	'repeating-radial-gradient()': 'Same as radial-gradient, except the color-stops are repeated infinitely in both directions, with their positions shifted by multiples of the difference between the last specified color-stop’s position and the first specified color-stop’s position.'
};

export let transitionTimingFunctions: { [name: string]: string } = {
	'ease': 'Equivalent to cubic-bezier(0.25, 0.1, 0.25, 1.0).',
	'ease-in': 'Equivalent to cubic-bezier(0.42, 0, 1.0, 1.0).',
	'ease-in-out': 'Equivalent to cubic-bezier(0.42, 0, 0.58, 1.0).',
	'ease-out': 'Equivalent to cubic-bezier(0, 0, 0.58, 1.0).',
	'linear': 'Equivalent to cubic-bezier(0.0, 0.0, 1.0, 1.0).',
	'step-end': 'Equivalent to steps(1, end).',
	'step-start': 'Equivalent to steps(1, start).',
	'steps()': 'The first parameter specifies the number of intervals in the function. The second parameter, which is optional, is either the value “start” or “end”.',
	'cubic-bezier()': 'Specifies a cubic-bezier curve. The four values specify points P1 and P2  of the curve as (x1, y1, x2, y2).',
	'cubic-bezier(0.6, -0.28, 0.735, 0.045)': 'Ease-in Back. Overshoots.',
	'cubic-bezier(0.68, -0.55, 0.265, 1.55)': 'Ease-in-out Back. Overshoots.',
	'cubic-bezier(0.175, 0.885, 0.32, 1.275)': 'Ease-out Back. Overshoots.',
	'cubic-bezier(0.6, 0.04, 0.98, 0.335)': 'Ease-in Circular. Based on half circle.',
	'cubic-bezier(0.785, 0.135, 0.15, 0.86)': 'Ease-in-out Circular. Based on half circle.',
	'cubic-bezier(0.075, 0.82, 0.165, 1)': 'Ease-out Circular. Based on half circle.',
	'cubic-bezier(0.55, 0.055, 0.675, 0.19)': 'Ease-in Cubic. Based on power of three.',
	'cubic-bezier(0.645, 0.045, 0.355, 1)': 'Ease-in-out Cubic. Based on power of three.',
	'cubic-bezier(0.215, 0.610, 0.355, 1)': 'Ease-out Cubic. Based on power of three.',
	'cubic-bezier(0.95, 0.05, 0.795, 0.035)': 'Ease-in Exponential. Based on two to the power ten.',
	'cubic-bezier(1, 0, 0, 1)': 'Ease-in-out Exponential. Based on two to the power ten.',
	'cubic-bezier(0.19, 1, 0.22, 1)': 'Ease-out Exponential. Based on two to the power ten.',
	'cubic-bezier(0.47, 0, 0.745, 0.715)': 'Ease-in Sine.',
	'cubic-bezier(0.445, 0.05, 0.55, 0.95)': 'Ease-in-out Sine.',
	'cubic-bezier(0.39, 0.575, 0.565, 1)': 'Ease-out Sine.',
	'cubic-bezier(0.55, 0.085, 0.68, 0.53)': 'Ease-in Quadratic. Based on power of two.',
	'cubic-bezier(0.455, 0.03, 0.515, 0.955)': 'Ease-in-out Quadratic. Based on power of two.',
	'cubic-bezier(0.25, 0.46, 0.45, 0.94)': 'Ease-out Quadratic. Based on power of two.',
	'cubic-bezier(0.895, 0.03, 0.685, 0.22)': 'Ease-in Quartic. Based on power of four.',
	'cubic-bezier(0.77, 0, 0.175, 1)': 'Ease-in-out Quartic. Based on power of four.',
	'cubic-bezier(0.165, 0.84, 0.44, 1)': 'Ease-out Quartic. Based on power of four.',
	'cubic-bezier(0.755, 0.05, 0.855, 0.06)': 'Ease-in Quintic. Based on power of five.',
	'cubic-bezier(0.86, 0, 0.07, 1)': 'Ease-in-out Quintic. Based on power of five.',
	'cubic-bezier(0.23, 1, 0.320, 1)': 'Ease-out Quintic. Based on power of five.'
};

export let basicShapeFunctions: { [name: string]: string } = {
	'circle()': 'Defines a circle.',
	'ellipse()': 'Defines an ellipse.',
	'inset()': 'Defines an inset rectangle.',
	'polygon()': 'Defines a polygon.'
};

export let units: { [unitName: string]: string[] } = {
	'length': ['em', 'rem', 'ex', 'px', 'cm', 'mm', 'in', 'pt', 'pc', 'ch', 'vw', 'vh', 'vmin', 'vmax'],
	'angle': ['deg', 'rad', 'grad', 'turn'],
	'time': ['ms', 's'],
	'frequency': ['Hz', 'kHz'],
	'resolution': ['dpi', 'dpcm', 'dppx'],
	'percentage': ['%', 'fr']
};

export let html5Tags = ['a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption',
	'cite', 'code', 'col', 'colgroup', 'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'footer',
	'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'keygen', 'label', 'legend', 'li', 'link',
	'main', 'map', 'mark', 'menu', 'menuitem', 'meta', 'meter', 'nav', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'param', 'picture', 'pre', 'progress', 'q',
	'rb', 'rp', 'rt', 'rtc', 'ruby', 's', 'samp', 'script', 'section', 'select', 'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td',
	'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'u', 'ul', 'let', 'video', 'wbr'];

export let svgElements = ['circle', 'clipPath', 'cursor', 'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting',
	'feDisplacementMap', 'feDistantLight', 'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode', 'feMorphology',
	'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence', 'filter', 'foreignObject', 'g', 'hatch', 'hatchpath', 'image', 'line', 'linearGradient',
	'marker', 'mask', 'mesh', 'meshpatch', 'meshrow', 'metadata', 'mpath', 'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect', 'set', 'solidcolor', 'stop', 'svg', 'switch',
	'symbol', 'text', 'textPath', 'tspan', 'use', 'view'];

export function isColorConstructor(node: nodes.Function): boolean {
	let name = node.getName();
	if (!name) {
		return false;
	}
	return /^(rgb|rgba|hsl|hsla)$/gi.test(name);
}

/**
 * Returns true if the node is a color value - either
 * defined a hex number, as rgb or rgba function, or
 * as color name.
 */
export function isColorValue(node: nodes.Node): boolean {
	if (node.type === nodes.NodeType.HexColorValue) {
		return true;
	} else if (node.type === nodes.NodeType.Function) {
		return isColorConstructor(<nodes.Function>node);
	} else if (node.type === nodes.NodeType.Identifier) {
		if (node.parent && node.parent.type !== nodes.NodeType.Term) {
			return false;
		}
		let candidateColor = node.getText().toLowerCase();
		if (candidateColor === 'none') {
			return false;
		}
		if (colors[candidateColor]) {
			return true;
		}
	}
	return false;
}

const Digit0 = 48;
const Digit9 = 57;
const A = 65;
const F = 70;
const a = 97;
const f = 102;

export function hexDigit(charCode: number) {
	if (charCode < Digit0) {
		return 0;
	}
	if (charCode <= Digit9) {
		return charCode - Digit0;
	}
	if (charCode < a) {
		charCode += (a - A);
	}
	if (charCode >= a && charCode <= f) {
		return charCode - a + 10;
	}
	return 0;
}

export function colorFromHex(text: string): Color {
	if (text[0] !== '#') {
		return null;
	}
	switch (text.length) {
		case 4:
			return {
				red: (hexDigit(text.charCodeAt(1)) * 0x11) / 255.0,
				green: (hexDigit(text.charCodeAt(2)) * 0x11) / 255.0,
				blue: (hexDigit(text.charCodeAt(3)) * 0x11) / 255.0,
				alpha: 1
			};
		case 5:
			return {
				red: (hexDigit(text.charCodeAt(1)) * 0x11) / 255.0,
				green: (hexDigit(text.charCodeAt(2)) * 0x11) / 255.0,
				blue: (hexDigit(text.charCodeAt(3)) * 0x11) / 255.0,
				alpha: (hexDigit(text.charCodeAt(4)) * 0x11) / 255.0,
			};
		case 7:
			return {
				red: (hexDigit(text.charCodeAt(1)) * 0x10 + hexDigit(text.charCodeAt(2))) / 255.0,
				green: (hexDigit(text.charCodeAt(3)) * 0x10 + hexDigit(text.charCodeAt(4))) / 255.0,
				blue: (hexDigit(text.charCodeAt(5)) * 0x10 + hexDigit(text.charCodeAt(6))) / 255.0,
				alpha: 1
			};
		case 9:
			return {
				red: (hexDigit(text.charCodeAt(1)) * 0x10 + hexDigit(text.charCodeAt(2))) / 255.0,
				green: (hexDigit(text.charCodeAt(3)) * 0x10 + hexDigit(text.charCodeAt(4))) / 255.0,
				blue: (hexDigit(text.charCodeAt(5)) * 0x10 + hexDigit(text.charCodeAt(6))) / 255.0,
				alpha: (hexDigit(text.charCodeAt(7)) * 0x10 + hexDigit(text.charCodeAt(8))) / 255.0
			};
	}
	return null;
}

export function colorFrom256RGB(red: number, green: number, blue: number, alpha: number = 1.0): Color {
	return {
		red: red / 255.0,
		green: green / 255.0,
		blue: blue / 255.0,
		alpha
	};
}

export function colorFromHSL(hue: number, sat: number, light: number, alpha: number = 1.0): Color {
	hue = hue / 60.0;
	if (sat === 0) {
		return { red: light, green: light, blue: light, alpha };
	} else {
		let hueToRgb = (t1, t2, hue) => {
			while (hue < 0) { hue += 6; }
			while (hue >= 6) { hue -= 6; }

			if (hue < 1) { return (t2 - t1) * hue + t1; }
			if (hue < 3) { return t2; }
			if (hue < 4) { return (t2 - t1) * (4 - hue) + t1; }
			return t1;
		};
		let t2 = light <= 0.5 ? (light * (sat + 1)) : (light + sat - (light * sat));
		var t1 = light * 2 - t2;
		return { red: hueToRgb(t1, t2, hue + 2), green: hueToRgb(t1, t2, hue), blue: hueToRgb(t1, t2, hue - 2), alpha };
	}
}

export interface HSLA { h: number; s: number; l: number; a: number; }

export function hslFromColor(rgba: Color): HSLA {
	const r = rgba.red;
	const g = rgba.green;
	const b = rgba.blue;
	const a = rgba.alpha;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (min + max) / 2;
	const chroma = max - min;

	if (chroma > 0) {
		s = Math.min((l <= 0.5 ? chroma / (2 * l) : chroma / (2 - (2 * l))), 1);

		switch (max) {
			case r: h = (g - b) / chroma + (g < b ? 6 : 0); break;
			case g: h = (b - r) / chroma + 2; break;
			case b: h = (r - g) / chroma + 4; break;
		}

		h *= 60;
		h = Math.round(h);
	}
	return { h, s, l, a };
}

export function getColorValue(node: nodes.Node): Color {
	if (node.type === nodes.NodeType.HexColorValue) {
		let text = node.getText();
		return colorFromHex(text);
	} else if (node.type === nodes.NodeType.Function) {
		let functionNode = <nodes.Function>node;
		let name = functionNode.getName();
		let colorValues = functionNode.getArguments().getChildren();
		if (!name || colorValues.length < 3 || colorValues.length > 4) {
			return null;
		}
		try {
			let alpha = colorValues.length === 4 ? getNumericValue(colorValues[3], 1) : 1;
			if (name === 'rgb' || name === 'rgba') {
				return {
					red: getNumericValue(colorValues[0], 255.0),
					green: getNumericValue(colorValues[1], 255.0),
					blue: getNumericValue(colorValues[2], 255.0),
					alpha
				};
			} else if (name === 'hsl' || name === 'hsla') {
				let h = getAngle(colorValues[0]);
				let s = getNumericValue(colorValues[1], 100.0);
				let l = getNumericValue(colorValues[2], 100.0);
				return colorFromHSL(h, s, l, alpha);
			}
		} catch (e) {
			// parse error on numeric value
			return null;
		}
	} else if (node.type === nodes.NodeType.Identifier) {
		if (node.parent && node.parent.type !== nodes.NodeType.Term) {
			return null;
		}
		let term = node.parent;
		if (term.parent && term.parent.type === nodes.NodeType.BinaryExpression) {
			let expression = term.parent;
			if (expression.parent && expression.parent.type === nodes.NodeType.ListEntry && (<nodes.ListEntry>expression.parent).key === expression) {
				return null;
			}
		}

		let candidateColor = node.getText().toLowerCase();
		if (candidateColor === 'none') {
			return null;
		}
		let colorHex = colors[candidateColor];
		if (colorHex) {
			return colorFromHex(colorHex);
		}
	}
	return null;
}

function getNumericValue(node: nodes.Node, factor: number) {
	let val = node.getText();
	let m = val.match(/^([-+]?[0-9]*\.?[0-9]+)(%?)$/);
	if (m) {
		if (m[2]) {
			factor = 100.0;
		}
		let result = parseFloat(m[1]) / factor;
		if (result >= 0 && result <= 1) {
			return result;
		}
	}
	throw new Error();
}

function getAngle(node: nodes.Node) {
	let val = node.getText();
	let m = val.match(/^([-+]?[0-9]*\.?[0-9]+)(deg)?$/);
	if (m) {
		return parseFloat(val) % 360;
	}
	throw new Error();
}

/**
 * Returns true if the given name is a known property.
 */
export function isKnownProperty(name: string): boolean {
	if (!name) {
		return false;
	} else {
		name = name.toLowerCase();
		return getProperties().hasOwnProperty(name);
	}
}

export function isStandardProperty(name: string): boolean {
	if (!name) {
		return false;
	} else {
		name = name.toLowerCase();
		let property = getProperties()[name];
		return property && property.status === 'standard';
	}
}

export function isCommonValue(entry: Value): boolean {
	return entry.browsers.count > 1;
}

export function getPageBoxDirectives(): string[] {
	return [
		'@bottom-center', '@bottom-left', '@bottom-left-corner', '@bottom-right', '@bottom-right-corner',
		'@left-bottom', '@left-middle', '@left-top', '@right-bottom', '@right-middle', '@right-top',
		'@top-center', '@top-left', '@top-left-corner', '@top-right', '@top-right-corner'
	];
}

export function getEntryDescription(entry: { description: string; browsers: Browsers, data?: any }): string | null {
	if (!entry.description || entry.description === '') {
		return null;
	}

	let desc: string = '';

	if (entry.data && entry.data.status) {
		desc += getEntryStatus(entry.data.status);
	}

	desc += entry.description;

	let browserLabel = getBrowserLabel(entry.browsers);
	if (browserLabel) {
		desc += '\n\nBrowser Support: ' + browserLabel;
	}
	if (entry.data && entry.data.syntax) {
		desc += `\n\nSyntax: ${entry.data.syntax}`;
	}
	return desc;
}

export function expandEntryStatus(status: string): EntryStatus {
	switch (status) {
		case 'e':
			return 'experimental';
		case 'n':
			return 'nonstandard';
		case 'o':
			return 'obsolete';
		default:
			return 'standard';
	}
}
function getEntryStatus(status: string) {
	switch (status) {
		case 'e':
			return '⚠️ Property is experimental. Be cautious when using it.️\n\n';
		case 'n':
			return '🚨️ Property is nonstandard. Avoid using it.\n\n';
		case 'o':
			return '🚨️️️ Property is obsolete. Avoid using it.\n\n';
		default:
			return '';
	}
}

export function getBrowserLabel(b: Browsers): string {
	let result = '';
	if (!b || b.all || b.count === 0) {
		return null;
	}
	for (let curr in browserNames) {
		if (typeof (<any>b)[curr] === 'string') {
			if (result.length > 0) {
				result = result + ', ';
			}
			result = result + (<any>browserNames)[curr];
			let version = (<any>b)[curr];
			if (version.length > 0) {
				result = result + ' ' + version;
			}
		}
	}
	return result;
}

export interface Browsers {
	E?: string;
	FF?: string;
	IE?: string;
	O?: string;
	C?: string;
	S?: string;
	count: number;
	all: boolean;
	onCodeComplete: boolean;
}

export interface Value {
	name: string;
	description: string;
	browsers: Browsers;
}

export interface IEntry {
	name: string;
	restrictions: string[];
	browsers: Browsers;
	description: string;
	values: Value[];
	status: EntryStatus;
}

export type EntryStatus = 'standard' | 'experimental' | 'nonstandard' | 'obsolete';

function evalBrowserEntry(browsers: string) {
	let browserEntry: Browsers = { all: false, count: 0, onCodeComplete: false };
	let count = 0;
	if (browsers) {
		for (let s of browsers.split(',')) {
			s = s.trim();
			if (s === 'all') {
				browserEntry.all = true;
				count = Number.MAX_VALUE;
			} else if (s !== 'none') {
				for (let key in browserNames) {
					if (s.indexOf(key) === 0) {
						(<any>browserEntry)[key] = s.substring(key.length).trim();
						count++;
					}
				}
			}
		}
	} else {
		browserEntry.all = true;
		count = Number.MAX_VALUE;
	}
	browserEntry.count = count;
	browserEntry.onCodeComplete = count > 0; // to be refined
	return browserEntry;
}


class ValueImpl implements Value {

	private browserEntry: Browsers;

	constructor(public data: any) {
	}

	get name(): string {
		return this.data.name;
	}

	get description(): string {
		return this.data.desc || browsers.descriptions[this.data.name];
	}

	get browsers(): Browsers {
		if (!this.browserEntry) {
			this.browserEntry = evalBrowserEntry(this.data.browsers);
		}
		return this.browserEntry;
	}
}

class EntryImpl implements IEntry {
	private browserEntry: Browsers;

	constructor(public data: any) {
	}

	get name(): string {
		return this.data.name;
	}

	get description(): string {
		return this.data.desc || browsers.descriptions[this.data.name];
	}

	get browsers(): Browsers {
		if (!this.browserEntry) {
			this.browserEntry = evalBrowserEntry(this.data.browsers);
		}
		return this.browserEntry;
	}

	get restrictions(): string[] {
		if (this.data.restriction) {
			return this.data.restriction.split(',').map(function (s: string) { return s.trim(); });
		} else {
			return [];
		}
	}

	get status(): EntryStatus {
		return expandEntryStatus(this.data.status);
	}

	get values(): Value[] {
		if (!this.data.values) {
			return [];
		}
		if (!Array.isArray(this.data.values)) {
			return [new ValueImpl(this.data.values.value)];
		}
		return this.data.values.map(function (v: string) {
			return new ValueImpl(v);
		});
	}
}

let propertySet: { [key: string]: IEntry };
let properties = browsers.data.css.properties;

export function getProperties(): { [name: string]: IEntry; } {
	if (!propertySet) {
		propertySet = {
		};
		for (let i = 0; i < properties.length; i++) {
			let rawEntry = properties[i];
			propertySet[rawEntry.name] = new EntryImpl(rawEntry);
		}

	}
	return propertySet;
}

let atDirectives = browsers.data.css.atdirectives;
let atDirectiveList: IEntry[];
export function getAtDirectives(): IEntry[] {
	if (!atDirectiveList) {
		atDirectiveList = [];
		for (let i = 0; i < atDirectives.length; i++) {
			let rawEntry = atDirectives[i];
			atDirectiveList.push(new EntryImpl(rawEntry));
		}
	}
	return atDirectiveList;
}

let pseudoElements = browsers.data.css.pseudoelements;
let pseudoElementList: IEntry[];
export function getPseudoElements(): IEntry[] {
	if (!pseudoElementList) {
		pseudoElementList = [];
		for (let i = 0; i < pseudoElements.length; i++) {
			let rawEntry = pseudoElements[i];
			pseudoElementList.push(new EntryImpl(rawEntry));
		}
	}
	return pseudoElementList;
}

let pseudoClasses = browsers.data.css.pseudoclasses;
let pseudoClassesList: IEntry[];
export function getPseudoClasses(): IEntry[] {
	if (!pseudoClassesList) {
		pseudoClassesList = [];
		for (let i = 0; i < pseudoClasses.length; i++) {
			let rawEntry = pseudoClasses[i];
			pseudoClassesList.push(new EntryImpl(rawEntry));
		}
	}
	return pseudoClassesList;
}

export let browserNames = {
	E: 'Edge',
	FF: 'Firefox',
	S: 'Safari',
	C: 'Chrome',
	IE: 'IE',
	O: 'Opera'
};

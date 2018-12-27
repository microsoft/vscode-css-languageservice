
import * as nodes from '../parser/cssNodes';
import { includes } from '../utils/arrays';

export class Element {

	public name: string;
	public node: nodes.Declaration;

	constructor(text: string, data: nodes.Declaration) {
		this.name = text;
		this.node = data;
	}
}

interface SideState {
	value: boolean;

	properties: Element[];
}

interface BoxModel {
	width?: Element;

	height?: Element;

	top: SideState;

	right: SideState;

	bottom: SideState;

	left: SideState;
}

function setSide<K extends 'top' | 'right' | 'bottom' | 'left'>(
	model: BoxModel,
	side: K,
	value: boolean,
	property: Element
): void {
	const state = model[side];

	state.value = value;

	if (value) {
		if (!includes(state.properties, property)) {
			state.properties.push(property);
		}
	}
}

function setAllSides(model: BoxModel, value: boolean, property: Element): void {
	setSide(model, 'top', value, property);
	setSide(model, 'right', value, property);
	setSide(model, 'bottom', value, property);
	setSide(model, 'left', value, property);
}

function updateModelWithValue(
	model: BoxModel,
	side: string,
	value: boolean,
	property: Element
): void {
	if (side === 'top' || side === 'right' ||
		side === 'bottom' || side === 'left') {
		setSide(model, side, value, property);
	} else {
		setAllSides(model, value, property);
	}
}

function updateModelWithList(model: BoxModel, values: boolean[], property: Element): void {
	switch (values.length) {
		case 1:
			updateModelWithValue(model, undefined, values[0], property);
			break;
		case 2:
			updateModelWithValue(model, 'top', values[0], property);
			updateModelWithValue(model, 'bottom', values[0], property);
			updateModelWithValue(model, 'right', values[1], property);
			updateModelWithValue(model, 'left', values[1], property);
			break;
		case 3:
			updateModelWithValue(model, 'top', values[0], property);
			updateModelWithValue(model, 'right', values[1], property);
			updateModelWithValue(model, 'left', values[1], property);
			updateModelWithValue(model, 'bottom', values[2], property);
			break;
		case 4:
			updateModelWithValue(model, 'top', values[0], property);
			updateModelWithValue(model, 'right', values[1], property);
			updateModelWithValue(model, 'bottom', values[2], property);
			updateModelWithValue(model, 'left', values[3], property);
			break;
	}
}

/**
 * @param allowsKeywords whether the initial value of property is zero, so keywords `initial` and `unset` count as zero
 * @return `true` if this node represents a non-zero border; otherwise, `false`
 */
function checkLineWidth(value: string, allowsKeywords: boolean = true): boolean {
	if (allowsKeywords && includes(['initial', 'unset'], value)) {
		return false;
	}

	// a <length> is a value and a unit
	// so use `parseFloat` to strip the unit
	return parseFloat(value) !== 0;
}

function checkLineWidthList(nodes: nodes.Node[], allowsKeywords: boolean = true): boolean[] {
	return nodes.map(node => checkLineWidth(node.getText(), allowsKeywords));
}

/**
 * @param allowsKeywords whether keywords `initial` and `unset` count as zero
 * @return `true` if this node represents a non-zero border; otherwise, `false`
 */
function checkLineStyle(value: string, allowsKeywords: boolean = true): boolean {
	if (includes(['none', 'hidden'], value)) {
		return false;
	}

	if (allowsKeywords && includes(['initial', 'unset'], value)) {
		return false;
	}

	return true;
}

function checkLineStyleList(nodes: nodes.Node[], allowsKeywords: boolean = true): boolean[] {
	return nodes.map(node => checkLineStyle(node.getText(), allowsKeywords));
}

function checkBorderShorthand(node: nodes.Node): boolean {
	const children = node.getChildren();

	// the only child can be a keyword, a <line-width>, or a <line-style>
	// if either check returns false, the result is no border
	if (children.length === 1) {
		const value = children[0].getText();
		return checkLineWidth(value) && checkLineStyle(value);
	}

	// multiple children can't contain keywords
	// if any child means no border, the result is no border
	for (const child of children) {
		const value = child.getText();
		if (!checkLineWidth(value) || !checkLineStyle(value, /* allowsKeywords: */ false)) {
			return false;
		}
	}
	return true;
}

export default function calaculateBoxModel(propertyTable: Element[]): BoxModel {
	let model: BoxModel = {
		top: { value: false, properties: [] },
		right: { value: false, properties: [] },
		bottom: { value: false, properties: [] },
		left: { value: false, properties: [] },
	};

	for (const property of propertyTable) {
		const value = property.node.value;

		switch (property.name) {
			case 'box-sizing':
				// has `box-sizing`, bail out
				return {
					top: { value: false, properties: [] },
					right: { value: false, properties: [] },
					bottom: { value: false, properties: [] },
					left: { value: false, properties: [] },
				};
			case 'width':
				model.width = property;
				break;
			case 'height':
				model.height = property;
				break;
			default:
				const segments = property.name.split('-');
				switch (segments[0]) {
					case 'border':
						switch (segments[1]) {
							case undefined:
							case 'top':
							case 'right':
							case 'bottom':
							case 'left':
								switch (segments[2]) {
									case undefined:
										updateModelWithValue(model, segments[1], checkBorderShorthand(value), property);
										break;
									case 'width':
										// the initial value of `border-width` is `medium`, not zero
										updateModelWithValue(model, segments[1], checkLineWidth(value.getText(), false), property);
										break;
									case 'style':
										// the initial value of `border-style` is `none`
										updateModelWithValue(model, segments[1], checkLineStyle(value.getText(), true), property);
										break;
								}
								break;
							case 'width':
								// the initial value of `border-width` is `medium`, not zero
								updateModelWithList(model, checkLineWidthList(value.getChildren(), false), property);
								break;
							case 'style':
								// the initial value of `border-style` is `none`
								updateModelWithList(model, checkLineStyleList(value.getChildren(), true), property);
								break;
						}
						break;
					case 'padding':
						if (segments.length === 1) {
							// the initial value of `padding` is zero
							updateModelWithList(model, checkLineWidthList(value.getChildren(), true), property);
						} else {
							// the initial value of `padding` is zero
							updateModelWithValue(model, segments[1], checkLineWidth(value.getText(), true), property);
						}
						break;
				}
				break;
		}
	}

	return model;
}

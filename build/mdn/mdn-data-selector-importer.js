/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

const mdnData = require('mdn-data')
const { abbreviateStatus } = require('./mdn-data-importer')
const { pseudoSelectorDescriptions, pseudoElementDescriptions } = require('./mdn-documentation')

function addMDNPseudoElements(vscPseudoElements) {
	const mdnSelectors = mdnData.css.selectors
	const allPseudoElements = vscPseudoElements

	const allPseudoElementNames = vscPseudoElements.map(s => s.name)

	for (const selectorName of Object.keys(mdnSelectors)) {
		const selector = mdnSelectors[selectorName]
		if (selector.syntax.startsWith('::')) {
			if (
				!allPseudoElementNames.includes(selectorName) &&
				!allPseudoElementNames.includes(selectorName + '()')
			) {
				allPseudoElements.push({
					name: selectorName,
					desc: pseudoElementDescriptions[selectorName] ? pseudoElementDescriptions[selectorName] : '',
					status: abbreviateStatus(selector.status)
				})
			}
		}
	}
	return allPseudoElements
}

const mdnExcludedPseudoSelectors = [
	/**
	 * See https://developer.mozilla.org/en-US/docs/Web/CSS/:matches
	 * -moz-any and -webkit-any are already in css-schema.xml
	 */
	':any'
]

function addMDNPseudoSelectors(vscPseudoClasses) {
	const mdnSelectors = mdnData.css.selectors
	const allPseudoSelectors = vscPseudoClasses

	const allPseudoSelectorNames = vscPseudoClasses.map(s => s.name)

	for (const selectorName of Object.keys(mdnSelectors)) {
		const selector = mdnSelectors[selectorName]
		if (selector.syntax.startsWith(':') && !selector.syntax.startsWith('::')) {
			if (
				!mdnExcludedPseudoSelectors.includes(selectorName) &&
				!allPseudoSelectorNames.includes(selectorName) &&
				!allPseudoSelectorNames.includes(selectorName + '()')
			) {
				allPseudoSelectors.push({
					name: selectorName,
					desc: pseudoSelectorDescriptions[selectorName] ? pseudoSelectorDescriptions[selectorName] : '',
					status: abbreviateStatus(selector.status)
				})
			}
		}
	}
	return allPseudoSelectors
}

module.exports = {
	addMDNPseudoElements,
	addMDNPseudoSelectors
}
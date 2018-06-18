/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const mdnData = require('mdn-data')
const { pseudoSelectorDescriptions } = require('./mdn-documentation')

const mdnExcludedPseudoSelectors = [
	/**
	 * See https://developer.mozilla.org/en-US/docs/Web/CSS/:matches
	 * -moz-any and -webkit-any are already in css-schema.xml
	 */
	':any'
]

function addMDNPseudoSelectors(vscPseudoClasses) {
	const mdnPseudoSelectors = mdnData.css.selectors
	const allPseudoSelectors = vscPseudoClasses

	const allSelectorNames = vscPseudoClasses.map(s => s.name)

	for (const selectorName of Object.keys(mdnPseudoSelectors)) {
		const selector = mdnPseudoSelectors[selectorName]
		if (selector.syntax.startsWith(':') && !selector.syntax.startsWith('::')) {
			if (
				!mdnExcludedPseudoSelectors.includes(selectorName) &&
				!allSelectorNames.includes(selectorName) &&
				!allSelectorNames.includes(selectorName + '()')
			) {
				allPseudoSelectors.push({
					name: selectorName,
					desc: pseudoSelectorDescriptions[selectorName] ? pseudoSelectorDescriptions[selectorName] : ''
				})
			}
		}
	}
	return allPseudoSelectors
}

module.exports = {
	addMDNPseudoSelectors
}

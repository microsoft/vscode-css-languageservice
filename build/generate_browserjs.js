/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const fs = require('fs')
const path = require('path')
const xml2js = require('xml2js')
const os = require('os')

const { colors, otherColors } = require('./colors')

function clone(obj) {
	var copy = {}
	for (var i in obj) {
		copy[i] = obj[i]
	}
	return copy
}

function getProperties(obj) {
	var res = []
	for (var i in obj) {
		res.push(i)
	}
	return res
}

function getValues(valArr, restriction, ruleName) {
	if (!Array.isArray(valArr)) {
		if (valArr.$) {
			valArr = [valArr]
		} else {
			return []
		}
	}
	var vals = valArr
		.map(function(v) {
			return {
				name: v.$.name,
				desc: v.desc,
				browsers: v.$.browsers !== 'all' ? v.$.browsers : void 0
			}
		})
		.filter(function(v) {
			if (v.browsers === 'none') {
				return false
			}
			return true
		})
	if (restriction.indexOf('color') !== -1) {
		var colorsCopy = clone(colors)
		var otherColorsCopy = clone(otherColors)

		var moreColors = {}

		vals = vals.filter(function(v) {
			if (typeof colorsCopy[v.name] === 'string') {
				delete colorsCopy[v.name]
				return false
			}
			if (typeof otherColorsCopy[v.name] === 'string') {
				delete otherColorsCopy[v.name]
				return false
			}
			moreColors[v.name] = v.desc
			return true
		})
		var notCovered = []
		for (var i in colorsCopy) {
			notCovered.push(i)
		}
		for (var i in otherColorsCopy) {
			notCovered.push(i)
		}
		if (notCovered.length > 0) {
			console.log('***' + ruleName + ' uncovered: ' + notCovered.length) // + ' - ' + JSON.stringify(notCovered));
		}

		if (restriction === 'color') {
			var properties = getProperties(moreColors)

			console.log('---' + ruleName + ' others : ' + properties.length) // + ' - ' + JSON.stringify(properties));
		}
	}

	return vals
}

function internalizeDescriptions(entries) {
	var descriptions = {}
	var conflicts = {}
	entries.forEach(function(e) {
		if (e.values) {
			e.values.forEach(function(d) {
				if (!d.desc) {
					conflicts[d.name] = true
					return
				}
				var existing = descriptions[d.name]
				if (existing) {
					if (existing !== d.desc) {
						conflicts[d.name] = true
					}
				}
				descriptions[d.name] = d.desc
			})
		}
	})
	entries.forEach(function(e) {
		if (e.values) {
			e.values.forEach(function(d) {
				if (!conflicts[d.name]) {
					delete d.desc
				} else {
					delete descriptions[d.name]
				}
			})
		}
	})
	return descriptions
}

function toSource(object, keyName) {
	if (!object.css[keyName]) {
		return []
	}
	var result = []
	var entryArr = object.css[keyName].entry
	entryArr.forEach(function(e) {
		if (e.$.browsers === 'none') {
			return
		}
		var data = {
			name: e.$.name,
			desc: e.desc,
			browsers: e.$.browsers !== 'all' ? e.$.browsers : void 0
		}
		if (e.$.restriction) {
			data.restriction = e.$.restriction
		}
		if (e.values) {
			data.values = getValues(e.values.value, data.restriction || '', data.name)
		}

		result.push(data)
	})

	return result
}

const parser = new xml2js.Parser({ explicitArray: false })
const schemaFileName = 'css-schema.xml'

const { addMDNProperties } = require('./mdn/mdn-data-property-importer')
const { addMDNPseudoElements, addMDNPseudoSelectors } = require('./mdn/mdn-data-selector-importer')
const { addBrowserCompatDataToProperties } = require('./mdn/mdn-browser-compat-data-importer')

fs.readFile(path.resolve(__dirname, schemaFileName), function(err, data) {
	parser.parseString(data, function(err, result) {
		const atdirectives = toSource(result, 'atDirectives')

		let pseudoelements = toSource(result, 'pseudoElements')
		pseudoelements = addMDNPseudoElements(pseudoelements)

		let pseudoclasses = toSource(result, 'pseudoClasses')
		pseudoclasses = addMDNPseudoSelectors(pseudoclasses)

		let properties = toSource(result, 'properties')
		properties = addMDNProperties(properties)

		addBrowserCompatDataToProperties(atdirectives, pseudoclasses, pseudoelements, properties)

		const descriptions = internalizeDescriptions([].concat(atdirectives, pseudoclasses, pseudoelements, properties))

		const resultObject = {
			css: {
				atdirectives: atdirectives,
				pseudoelements: pseudoelements,
				pseudoclasses: pseudoclasses,
				properties: properties
			}
		}

		function toJavaScript(obj) {
			const str = JSON.stringify(obj, null, '\t')
			return str.replace(/\"(name|desc|browsers|restriction|values)\"/g, '$1')
		}

		const output = [
			'/*---------------------------------------------------------------------------------------------',
			' *  Copyright (c) Microsoft Corporation. All rights reserved.',
			' *  Licensed under the MIT License. See License.txt in the project root for license information.',
			' *--------------------------------------------------------------------------------------------*/',
			'// file generated from ' +
				schemaFileName +
				' and https://github.com/mdn/data using css-exclude_generate_browserjs.js',
			'',
			'export const data : any = ' + toJavaScript(resultObject) + ';',
			'export const descriptions : any = ' + toJavaScript(descriptions) + ';'
		]

		const outputPath = path.resolve(__dirname, '../src/data/browsers.ts')
		console.log('Writing to: ' + outputPath)
		const content = output.join(os.EOL)
		fs.writeFileSync(outputPath, content)
		console.log('Done')
	})
})

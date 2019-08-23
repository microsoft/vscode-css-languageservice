/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

const bcd = require('mdn-browser-compat-data')

function addBrowserCompatDataToProperties(atdirectives, pseudoclasses, pseudoelements, properties) {
  atdirectives.forEach(item => {
    if (bcd.css['at-rules'][item.name.slice(1)]) {
      const matchingBCDItem = bcd.css['at-rules'][item.name.slice(1)] 
      addBCDToBrowsers(item, matchingBCDItem)
    }
  })

  pseudoclasses.forEach(item => {
    if (bcd.css.selectors[item.name.slice(1)]) {
      const matchingBCDItem = bcd.css.selectors[item.name.slice(1)]
      addBCDToBrowsers(item, matchingBCDItem)
    }
  })

  pseudoelements.forEach(item => {
    if (bcd.css.selectors[item.name.slice(2)]) {
      const matchingBCDItem = bcd.css.selectors[item.name.slice(2)]
      addBCDToBrowsers(item, matchingBCDItem)
    }
  })

  properties.forEach(item => {
    if (bcd.css.properties[item.name]) {
      const matchingBCDItem = bcd.css.properties[item.name]
      addBCDToBrowsers(item, matchingBCDItem)
    }
  })
}

function addMDNReferences(atdirectives, pseudoclasses, pseudoelements, properties) {
  const addReference = (item, matchingItem) => {
    if (matchingItem.__compat && matchingItem.__compat.mdn_url) {
      if (!item.references) {
        item.references = [];
      }
      item.references.push({
        name: 'MDN Reference',
        url: matchingItem.__compat.mdn_url
      })
    }
  }

  atdirectives.forEach(item => {
    if (bcd.css['at-rules'][item.name.slice(1)]) {
      const matchingBCDItem = bcd.css['at-rules'][item.name.slice(1)]  
      addReference(item, matchingBCDItem);
    }
  })
  
  pseudoclasses.forEach(item => {
    if (bcd.css.selectors[item.name.slice(1)]) {
      const matchingBCDItem = bcd.css.selectors[item.name.slice(1)]
      addReference(item, matchingBCDItem)
    }
  })

  pseudoelements.forEach(item => {
    if (bcd.css.selectors[item.name.slice(2)]) {
      const matchingBCDItem = bcd.css.selectors[item.name.slice(2)]
      addReference(item, matchingBCDItem)
    }
  })

  properties.forEach(item => {
    if (bcd.css.properties[item.name]) {
      const matchingBCDItem = bcd.css.properties[item.name]
      addReference(item, matchingBCDItem)
    }
  })
}

const browserNames = {
	E: 'Edge',
	FF: 'Firefox',
	S: 'Safari',
	C: 'Chrome',
	IE: 'IE',
	O: 'Opera'
}

function addBCDToBrowsers(item, matchingBCDItem) {
  const compatString = toCompatString(matchingBCDItem)

  if (compatString !== '') {
    if (!item.browsers) {
      item.browsers = compatString
    } else {
      if (item.browsers !== compatString) {
        item.browsers = compatString
      }
    }
  }
}

function toCompatString(bcdProperty) {
  if (isSupportedInAllBrowsers(bcdProperty)) {
    return 'all'
  }

	let s = []

	if (bcdProperty.__compat) {
		Object.keys(browserNames).forEach((abbrev) => {
			const browserName = browserNames[abbrev].toLowerCase()
			const browserSupport = bcdProperty.__compat.support[browserName]
			if (browserSupport) {
				const shortCompatString = supportToShortCompatString(browserSupport, abbrev)
				if (shortCompatString) {
					s.push(shortCompatString)
				}
			}
		})
	} else {
		Object.keys(browserNames).forEach((abbrev) => {
			const browserName = browserNames[abbrev].toLowerCase()

			// Select the most recent versions from all contexts as the short compat string
			let shortCompatStringAggregatedFromContexts;

			Object.keys(bcdProperty).forEach(contextName => {
				const context = bcdProperty[contextName]
				if (context.__compat && context.__compat.support[browserName]) {
					const browserSupport = context.__compat.support[browserName]
					const shortCompatString = supportToShortCompatString(browserSupport, abbrev)
					if (!shortCompatStringAggregatedFromContexts || shortCompatString > shortCompatStringAggregatedFromContexts) {
						shortCompatStringAggregatedFromContexts = shortCompatString
					}
				}
			})

			if (shortCompatStringAggregatedFromContexts) {
				s.push(shortCompatStringAggregatedFromContexts)
			}
		})

	}
  return s.join(',')
}

/**
 * Check that a property is supported in all major browsers: Edge, Firefox, Safari, Chrome, IE, Opera
 */
function isSupportedInAllBrowsers(bcdProperty) {
	if (bcdProperty.__compat) {
		return Object.keys(browserNames).every((abbrev) => {
			const browserName = browserNames[abbrev].toLowerCase()
			if (bcdProperty.__compat && bcdProperty.__compat.support[browserName]) {
				const browserSupport = bcdProperty.__compat.support[browserName]
				if (browserSupport) {
					return isSupported(browserSupport)
				}
			}

			return false
		})
	} else {
		return Object.keys(browserNames).every((abbrev) => {
			const browserName = browserNames[abbrev].toLowerCase()

			return Object.keys(bcdProperty).some(contextName => {
				const context = bcdProperty[contextName]
				if (context.__compat && context.__compat.support[browserName]) {
					const browserSupport = context.__compat.support[browserName]
					if (browserSupport) {
						return isSupported(browserSupport)
					}
				}

				return false
			})
		})
	}
}

/**
 * https://github.com/mdn/browser-compat-data/blob/master/schemas/compat-data-schema.md
 * 
 * Convert a support statement to a short compat string.
 * For example:
 * { "ie": { "version_added": "6.0" } } => "IE6.0"
 * {
 *   "support": {
 *     "firefox": [
 *       {
 *         "version_added": "6"
 *       },
 *       {
 *         "prefix": "-moz-",
 *         "version_added": "3.5",
 *         "version_removed": "9"
 *       }
 *     ]
 *   }
 * } => "FF6"
 */
function supportToShortCompatString(support, browserAbbrev) {
  let version_added
  if (Array.isArray(support) && support[0] && support[0].version_added) {
    version_added = support[0].version_added
  } else if (support.version_added) {
    version_added = support.version_added
  }

  if (version_added) {
    if (typeof(version_added) === 'boolean') {
      return browserAbbrev
    } else {
      return `${browserAbbrev}${version_added}`
    }
  }

  return null
}

function isSupported(support) {
  let version_added
  if (Array.isArray(support) && support[0] && support[0].version_added) {
    version_added = support[0].version_added
  } else if (support.version_added) {
    version_added = support.version_added
  }

  if (version_added) {
    if (typeof(version_added) === 'boolean') {
      return version_added
    } else if (typeof(version_added) === 'string') {
      if (typeof(parseInt(version_added)) === 'number') {
        return true
      }
    }
  }

  return false
}

module.exports = {
  addBrowserCompatDataToProperties,
  addMDNReferences
}
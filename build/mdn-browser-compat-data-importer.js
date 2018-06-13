/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const bcd = require('mdn-browser-compat-data')

function addBrowserCompatDataToProperties(atdirectives, pseudoclasses, pseudoelements, properties) {
  atdirectives.forEach(item => {
    if (bcd.css['at-rules'][item.name.slice(1)]) {
      const matchingBCPItem = bcd.css['at-rules'][item.name.slice(1)] 
      updateItemBrowsersWithBCPItem(item, matchingBCPItem)
    }
  })

  pseudoclasses.forEach(item => {
    if (bcd.css.selectors[item.name.slice(1)]) {
      const matchingBCPItem = bcd.css.selectors[item.name.slice(1)]
      updateItemBrowsersWithBCPItem(item, matchingBCPItem)
    }
  })

  pseudoelements.forEach(item => {
    if (bcd.css.selectors[item.name.slice(2)]) {
      const matchingBCPItem = bcd.css.selectors[item.name.slice(2)]
      updateItemBrowsersWithBCPItem(item, matchingBCPItem)
    }
  })

  properties.forEach(item => {
    if (bcd.css.properties[item.name]) {
      const matchingBCPItem = bcd.css.properties[item.name]
      updateItemBrowsersWithBCPItem(item, matchingBCPItem)
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

function updateItemBrowsersWithBCPItem(item, matchingBCPItem) {
  const compatString = toCompatString(matchingBCPItem)

  if (compatString !== '') {
    if (!item.browsers) {
      item.browsers = compatString
    } else if (item.browsers && item.browsers !== compatString) {
      item.browsers = compatString
    }
  }
}

function toCompatString(bcdProperty) {
  let s = []
  Object.keys(browserNames).forEach((abbrev) => {
    if (bcdProperty.__compat && bcdProperty.__compat.support[browserNames[abbrev].toLowerCase()]) {
      const browserSupport = bcdProperty.__compat.support[browserNames[abbrev].toLowerCase()]
      if (browserSupport) {
        const shortCompatString = supportToShortCompatString(browserSupport, abbrev)
        if (shortCompatString) {
          s.push(shortCompatString)
        }
      }
    }
  })
  return s.join(',')
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

module.exports.addBrowserCompatDataToProperties = addBrowserCompatDataToProperties
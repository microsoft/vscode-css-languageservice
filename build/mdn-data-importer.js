/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const path = require('path')
const fs = require('fs')

const mdnDocumentations = require('./mdn-documentation')

const mdnExcludedProperties = [
  '--*', // custom properties
]

function buildPropertiesWithMDNData(vscProperties) {
  const propertyMap = {}

  const mdnProperties = require('mdn-data/css/properties.json')
  const mdnAtRules = require('mdn-data/css/at-rules.json')

  // Flatten at-rule properties and put all properties together
  const allMDNProperties = mdnProperties
  for (const atRuleName of Object.keys(mdnAtRules)) {
    if (mdnAtRules[atRuleName].descriptors) {
      for (const atRulePropertyName of Object.keys(mdnAtRules[atRuleName].descriptors)) {
        allMDNProperties[atRulePropertyName] = mdnAtRules[atRuleName].descriptors[atRulePropertyName]
      }
    }
  }

  mdnExcludedProperties.forEach(p => {
    delete allMDNProperties[p]
  })

  /**
   * 1. Go through VSC properties. For each entry that has a matching entry in MDN, merge both entry.
   */
  vscProperties.forEach(p => {
    if (p.name) {
      if (allMDNProperties[p.name]) {
        propertyMap[p.name] = {
          ...p,
          ...extractMDNProperties(allMDNProperties[p.name])
        }
      } else {
        propertyMap[p.name] = p
      }
    }
  })

  /**
   * 2. Go through MDN properties. For each entry that hasn't been recorded, add it with empty description.
   */
  for (const pn of Object.keys(allMDNProperties)) {
    if (!propertyMap[pn]) {
      propertyMap[pn] = {
        name: pn,
        desc: mdnDocumentations[pn] ? mdnDocumentations[pn] : '',
        restriction: 'none',
        ...extractMDNProperties(allMDNProperties[pn])
      }
    }
  }

  return Object.values(propertyMap)
}

/**
 * Extract only the MDN data that we use
 */
function extractMDNProperties(mdnEntry) {
  return {
    status: abbreviateStatus(mdnEntry.status),
    syntax: mdnEntry.syntax
  }
}

/**
 * Make syntax as small as possible for browser usage
 */
function abbreviateStatus(status) {
  return {
    standard: 's',
    nonstandard: 'n',
    experimental: 'e',
    obsolete: 'o'
  }[status];
}

module.exports = {
  buildPropertiesWithMDNData
}

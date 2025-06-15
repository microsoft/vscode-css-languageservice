import * as assert from 'assert';
import { getSCSSLanguageService } from '../../scssLanguageService';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentContext } from '../../cssLanguageTypes';

function createDocument(contents: string, uri = 'file:///test.scss') {
  return TextDocument.create(uri, 'scss', 0, contents);
}

const dummyContext: DocumentContext = {
  resolveReference: (ref: string, _base: string) => ref
};

const ls = getSCSSLanguageService();

async function getLinks(contents: string) {
  const doc = createDocument(contents);
  const stylesheet = ls.parseStylesheet(doc);
  return ls.findDocumentLinks2(doc, stylesheet, dummyContext);
}

describe('SCSS Navigation – scheme URL imports', () => {
  it('http scheme import is treated as absolute URL, not bare import', async () => {
    const links = await getLinks(`@import "http://example.com/foo.css";`);
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].target, 'http://example.com/foo.css');
  });

  it('https scheme import is treated as absolute URL, not bare import', async () => {
    const links = await getLinks(`@import "https://cdn.example.com/reset.css";`);
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].target, 'https://cdn.example.com/reset.css');
  });

  it('file scheme import is treated as absolute URL, not bare import', async () => {
    const links = await getLinks(`@import "file:///Users/test/project/styles/base.scss";`);
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].target, 'file:///Users/test/project/styles/base.scss');
  });

  it('custom scheme import (vscode-resource) is treated as absolute URL, not bare import', async () => {
    const links = await getLinks(`@import "vscode-resource://file/some.css";`);
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].target, 'vscode-resource://file/some.css');
  });
});

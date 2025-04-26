import { assert } from 'chai';
import { getSCSSLanguageService } from '../../cssLanguageService';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { FileType, getNodeFSRequestService } from '../../nodeFs';

const ls = getSCSSLanguageService();
const mockFS = getNodeFSRequestService();

describe('SCSS link navigation – node_modules', () => {
  it('resolves bootstrap path on Windows', async () => {
    const doc = TextDocument.create('file:///c:/proj/app.scss', 'scss', 1,
        "@import 'bootstrap/scss/variables';");
    const links = await ls.findDocumentLinks2(doc, ls.parseStylesheet(doc), {}, mockFS);
    const target = links[0].target!.replace(/\\/g, '/');
    assert.match(target, /node_modules\/bootstrap\/scss\/_variables\.scss$/);
  });
});

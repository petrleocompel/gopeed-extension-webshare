// A tiny XML tag extractor for Webshare API responses. The responses are flat
// and simple (<response><status>OK</status><name>...</name>...</response>), and
// goja has no DOMParser, so a regular expression per tag is enough.

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, ref) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, ref) ? NAMED_ENTITIES[ref] : whole;
  });
}

// Text content of a tag body: CDATA sections are kept verbatim, everything
// else has its entities decoded.
function textOf(inner) {
  let out = '';
  const cdata = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
  let last = 0;
  let m;
  while ((m = cdata.exec(inner)) !== null) {
    out += decodeEntities(inner.slice(last, m.index)) + m[1];
    last = cdata.lastIndex;
  }
  return out + decodeEntities(inner.slice(last));
}

function tagPattern(tag, flags) {
  if (!/^[A-Za-z_][\w.-]*$/.test(tag)) throw new Error('Invalid XML tag name: ' + tag);
  const name = tag.replace(/[.-]/g, '\\$&');
  // Matches <tag>...</tag>, <tag attr="x">...</tag>, <tag/> and <tag />.
  return new RegExp('<' + name + '(?:\\s[^>]*?)?(?:/>|>([\\s\\S]*?)</' + name + '\\s*>)', flags);
}

// Text of the first <tag> element, '' for an empty one, null when absent.
export function xmlText(xml, tag) {
  const m = tagPattern(tag, '').exec(String(xml));
  if (!m) return null;
  return m[1] === undefined ? '' : textOf(m[1]);
}

// Raw inner XML of every <tag> element, e.g. each <file> of a search result.
export function xmlBlocks(xml, tag) {
  const re = tagPattern(tag, 'g');
  const out = [];
  let m;
  while ((m = re.exec(String(xml))) !== null) out.push(m[1] === undefined ? '' : m[1]);
  return out;
}

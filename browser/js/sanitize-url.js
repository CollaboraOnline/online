const invalidProtocolRegex = /^([^\\w]*)(javascript|data|vbscript)/im;
const htmlEntitiesRegex = /\u0026#(\\w+)(^\\w|;)?/g;
const htmlCtrlEntityRegex = /\u0026(newline|tab);/gi;
const ctrlCharactersRegex = /[\\u0000-\\u001F\\u007F-\\u009F\\u2000-\\u200D\\uFEFF]/gim;
const urlSchemeRegex = /^.+(:|\u0026colon;)/gim;
const relativeFirstCharacters = [".", "/"];
function isRelativeUrlWithoutProtocol(url) {
    return relativeFirstCharacters.indexOf(url[0]) > -1;
}
// adapted from https://stackoverflow.com/a/29824550/2601552
function decodeHtmlCharacters(str) {
    return str.replace(htmlEntitiesRegex, function (match, dec) {
        return String.fromCharCode(dec);
    });
}
function sanitizeUrl(url) {
    const sanitizedUrl = decodeHtmlCharacters(url || "")
        .replace(htmlCtrlEntityRegex, "")
        .replace(ctrlCharactersRegex, "")
        .trim();
    if (!sanitizedUrl) {
        return "about:blank";
    }
    if (isRelativeUrlWithoutProtocol(sanitizedUrl)) {
        return sanitizedUrl;
    }
    const urlSchemeParseResults = sanitizedUrl.match(urlSchemeRegex);
    if (!urlSchemeParseResults) {
        return sanitizedUrl;
    }
    const urlScheme = urlSchemeParseResults[0];
    if (invalidProtocolRegex.test(urlScheme)) {
        return "about:blank";
    }
    return sanitizedUrl;
}

window.sanitizeUrl = sanitizeUrl;

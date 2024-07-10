(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.sanitizeUrl = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
  'use strict';

  var invalidProtocolRegex = /^([^\w]*)(javascript|data|vbscript)/im;
  var htmlEntitiesRegex = /&#(\w+)(^\w|;)?/g;
  var htmlCtrlEntityRegex = /&(newline|tab);/gi;
  var ctrlCharactersRegex = /[\u0000-\u001F\u007F-\u009F\u2000-\u200D\uFEFF]/gim;
  var urlSchemeRegex = /^.+(:|&colon;)/gim;
  var relativeFirstCharacters = [".", "/"];

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
    var sanitizedUrl = decodeHtmlCharacters(url || "")
        .replace(htmlCtrlEntityRegex, "")
        .replace(ctrlCharactersRegex, "")
        .trim();
    if (!sanitizedUrl) {
        return "about:blank";
    }
    if (isRelativeUrlWithoutProtocol(sanitizedUrl)) {
        return sanitizedUrl;
    }
    var urlSchemeParseResults = sanitizedUrl.match(urlSchemeRegex);
    if (!urlSchemeParseResults) {
        return sanitizedUrl;
    }
    var urlScheme = urlSchemeParseResults[0];
    if (invalidProtocolRegex.test(urlScheme)) {
        return "about:blank";
    }
    return sanitizedUrl;
  }

  module.exports = {
    sanitizeUrl: sanitizeUrl
  };

},{}]},{},[1])(1)
});

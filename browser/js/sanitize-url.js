(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.sanitizeUrl = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
  'use strict';

  var invalidPrototcolRegex = /^(%20|\s)*(javascript|data)/im;
  var ctrlCharactersRegex = /[^\x20-\x7EÀ-ž]/gmi;
  var urlSchemeRegex = /^([^:]+):/gm;
  var relativeFirstCharacters = ['.', '/'];
  
  function isRelativeUrlWithoutProtocol(url) {
    return relativeFirstCharacters.indexOf(url[0]) > -1;
  }
  
  function sanitizeUrl(url) {
    var urlScheme, urlSchemeParseResults, sanitizedUrl;
  
    if (!url) {
      return 'about:blank';
    }
  
    sanitizedUrl = url.replace(ctrlCharactersRegex, '').trim();
  
    if (isRelativeUrlWithoutProtocol(sanitizedUrl)) {
      return sanitizedUrl;
    }
  
    urlSchemeParseResults = sanitizedUrl.match(urlSchemeRegex);
  
    if (!urlSchemeParseResults) {
      return sanitizedUrl;
    }
  
    urlScheme = urlSchemeParseResults[0];
  
    if (invalidPrototcolRegex.test(urlScheme)) {
      return 'about:blank';
    }
  
    return sanitizedUrl;
  }
  
  module.exports = {
    sanitizeUrl: sanitizeUrl
  };

},{}]},{},[1])(1)
});

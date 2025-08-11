/*
 * l10n.js
 * 2016-05-17
 *
 * By Eli Grey, http://eligrey.com
 * Licensed under the MIT License
 *   See https://github.com/eligrey/l10n.js/blob/master/LICENSE.md
 */

/*global XMLHttpRequest, setTimeout, document, navigator, ActiveXObject*/

/*! @source http://purl.eligrey.com/github/l10n.js/blob/master/l10n.js*/

(function () {
"use strict";

const undef_type = "undefined";
const string_type = "string";
let nav = {};
const String_ctr = String;
const has_own_prop = Object.prototype.hasOwnProperty;
let load_queues = {};
let localizations = {};
const FALSE = !1;
const TRUE = !0;
let browserless = FALSE;
// the official format is application/vnd.oftn.l10n+json, though l10n.js will also
// accept application/x-l10n+json and application/l10n+json
const l10n_js_media_type = /^\s*application\/(?:vnd\.oftn\.|x-)?l10n\+json\s*(?:$|;)/i;
let XHR;

// property minification aids
const $locale = "locale";
const $default_locale = "defaultLocale";
const $to_locale_string = "toLocaleString";
const $to_lowercase = "toLowerCase";

const array_index_of = Array.prototype.indexOf || function (item) {
	const len = this.length;
	let i = 0;

	for (; i < len; i++) {
		if (i in this && this[i] === item) {
			return i;
		}
	}

	return -1;
};

const request_JSON = function (uri) {
    if(browserless)
        return loadFromDisk(uri);

	const req = new XHR();
	let data = {};

	try {
		// sadly, this has to be blocking to allow for a graceful degrading API
		req.open("GET", uri, FALSE);
		req.send(null);
	} catch (e) {
		console.log('Localization Error: Unable to get localization data: ' + uri, e);
	}

	// Status codes can be inconsistent across browsers so we simply try to parse
	// the response text and catch any errors. This deals with failed requests as
	// well as malformed json files.
	try {
		data = JSON.parse(req.responseText);
	} catch(e) {
		// warn about error without stopping execution
		setTimeout(function () {
			// Error messages are not localized as not to cause an infinite loop
			const l10n_err = new Error("Unable to load localization data: " + uri);
			l10n_err.name = "Localization Error";
			throw l10n_err;
		}, 0);
	}

	return data;
};

const load = String_ctr[$to_locale_string] = function (data) {
	// don't handle function.toLocaleString(indentationAmount:Number)
	if (arguments.length > 0 && typeof data !== "number") {
		if (typeof data === string_type) {
			load(request_JSON(data));
		} else if (data === FALSE) {
			// reset all localizations
			localizations = {};
		} else {
			// Extend current localizations instead of completely overwriting them
			let locale, localization, message;
			for (locale in data) {
				if (has_own_prop.call(data, locale)) {
					localization = data[locale];
					locale = locale[$to_lowercase]();

					if (!(locale in localizations) || localization === FALSE) {
						// reset locale if not existing or reset flag is specified
						localizations[locale] = {};
					}

					if (localization === FALSE) {
						continue;
					}

					// URL specified
					if (typeof localization === string_type) {
						if (String_ctr[$locale][$to_lowercase]().indexOf(locale) === 0) {
							localization = request_JSON(localization);
						} else {
							// queue loading locale if not needed
							if (!(locale in load_queues)) {
								load_queues[locale] = [];
							}
							load_queues[locale].push(localization);
							continue;
						}
					}

					for (message in localization) {
						if (has_own_prop.call(localization, message)) {
							localizations[locale][message] = localization[message];
						}
					}
				}
			}
		}
	}
	// Return what function.toLocaleString() normally returns
	return Function.prototype[$to_locale_string].apply(String_ctr, arguments);
};

const loadFromDisk = function (uri) {
        const fs = require('fs');
        const read = fs.readFileSync(uri, 'utf8');
        return JSON.parse(read);
};

const process_load_queue = function (locale) {
	const queue = load_queues[locale];
	let i = 0;
	const len = queue.length;
	let localization;

	for (; i < len; i++) {
		localization = {};
		localization[locale] = request_JSON(queue[i]);
		load(localization);
	}

	delete load_queues[locale];
};

let use_default; // Must be declared before localize function

const localize = String_ctr.prototype[$to_locale_string] = function () {
	const using_default = use_default;
	const current_locale = String_ctr[using_default ? $default_locale : $locale];
	const parts = current_locale[$to_lowercase]().split("-");
	let i = parts.length;
	const this_val = this.valueOf();
	let locale;

	use_default = FALSE;

	// Iterate through locales starting at most-specific until a localization is found
	do {
		locale = parts.slice(0, i).join("-");
		// load locale if not loaded
		if (locale in load_queues) {
			process_load_queue(locale);
		}
		if (locale in localizations && this_val in localizations[locale]) {
			return localizations[locale][this_val];
		}
	}
	while (i--);

	if (!using_default && String_ctr[$default_locale]) {
		use_default = TRUE;
		return localize.call(this_val);
	}

	return this_val;
};

try
{
    nav = self.navigator;
}
catch(selfNotFoundException)
{
   if(global.nav)
   {
        nav = global.nav;
   }
   else
   {
        const nodeError = "Problem setting nav in L10N. You are most likely running in a non-browser environment like Node." +
         "If this is the case, you can resolve this error by setting global.nav to an object which contains a \"language\"  field. ";
        throw new Error(nodeError);
   }
   browserless = TRUE;
}

if (!browserless && typeof XMLHttpRequest === undef_type && typeof ActiveXObject !== undef_type) {
	const AXO = ActiveXObject;

	XHR = function () {
		try {
			return new AXO("Msxml2.XMLHTTP.6.0");
		} catch (xhrEx1) {}
		try {
			return new AXO("Msxml2.XMLHTTP.3.0");
		} catch (xhrEx2) {}
		try {
			return new AXO("Msxml2.XMLHTTP");
		} catch (xhrEx3) {}

		throw new Error("XMLHttpRequest not supported by this browser.");
	};
} else {
    try
    {
        XHR = XMLHttpRequest;
    }
    catch(xhrEx4)
    {
        if(global.XMLHttpRequest) {
            XHR = global.XMLHttpRequest;
        }
        else {
           const nodeError = "Problem setting XHR in L10N. You are most likely running in a non-browser environment like Node." +
            "If this is the case, you can resolve this error by setting global.XMLHttpRequest to a function which produces XMLHttpRequests. " +
            "\nTip: if you are using node, you might want to use the XHR2 package (usage: global.XMLHttpRequest = require('xhr2')";
            throw new Error(nodeError);
        }
    }
}

String_ctr[$default_locale] = String_ctr[$default_locale] || "";
String_ctr[$locale] = nav && (nav.language || nav.userLanguage) || "";

document.documentElement.lang = window.langParam;

if (!browserless || typeof document !== undef_type) {
	const elts = document.getElementsByTagName("link");
	let i = elts.length;
	let localization;

	while (i--) {
		const elt = elts[i];
		const rel = (elt.getAttribute("rel") || "")[$to_lowercase]().split(/\s+/);

		if (l10n_js_media_type.test(elt.type)) {
			if (array_index_of.call(rel, "localizations") !== -1) {
				// multiple localizations
				load(elt.getAttribute("href"));
			} else if (array_index_of.call(rel, "localization") !== -1) {
				// single localization
				localization = {};
				localization[(elt.getAttribute("hreflang") || "")[$to_lowercase]()] =
					elt.getAttribute("href");
				load(localization);
			}
		}
	}
}
else
{
    if(global.l10NLocalFilePath) {
        load(global.l10NLocalFilePath);
    }
    else {
        const nodeError = "Problem loading localization file. You are most likely running in a non-browser environment like Node." +
            "If this is the case, you can resolve this error by setting global.l10NLocalFilePath to the path of your localization file. ";
        throw new Error(nodeError);
    }
}

}());
/* -*- js-indent-level: 8 -*- */

/* global vex _ getParameterByName */
var errorMessages = {};
var welcomeStrings = {};

vex.defaultOptions.className = 'vex-theme-plain';

var lang = getParameterByName('lang');
if (lang) {
	String.locale = lang;
}

errorMessages.diskfull = _('No disk space left on server, please contact the server administrator to continue.');
errorMessages.emptyhosturl = _('The host URL is empty. The coolwsd server is probably misconfigured, please contact the administrator.');
errorMessages.limitreached = _('This is an unsupported version of {productname}. To avoid the impression that it is suitable for deployment in enterprises, this message appears when more than {docs} documents or {connections} connections are in use concurrently');
errorMessages.infoandsupport = _('More information and support');
errorMessages.limitreachedprod = _('This service is limited to %0 documents, and %1 connections total by the admin. This limit has been reached. Please try again later.');
errorMessages.serviceunavailable = _('Service is unavailable. Please try again later and report to your administrator if the issue persists.');
errorMessages.unauthorized = _('Unauthorized WOPI host. Please try again later and report to your administrator if the issue persists.');
errorMessages.wrongwopisrc = _('Wrong or missing WOPISrc parameter, please contact support.');
errorMessages.sessionexpiry = _('Your session will expire in %time. Please save your work and refresh the session (or webpage) to continue.');
errorMessages.sessionexpired = _('Your session has been expired. Further changes to document might not be saved. Please refresh the session (or webpage) to continue.');
errorMessages.faileddocloading = _('Failed to load the document. Please ensure the file type is supported and not corrupted, and try again.');
errorMessages.invalidLink = _('Invalid link: \'%url\'');
errorMessages.leaving = _('You are leaving the editor, are you sure you want to visit the following URL?');
errorMessages.docloadtimeout = _('Failed to load the document. This document is either malformed or is taking more resources than allowed. Please contact the administrator.');
errorMessages.docunloadingretry = _('Cleaning up the document from the last session.');
errorMessages.docunloadinggiveup = _('We are in the process of cleaning up this document from the last session, please try again later.');

if (window.ThisIsAMobileApp) {
	errorMessages.storage = {
		loadfailed: _('Failed to load document.'),
		savediskfull: _('Save failed due to no disk space left. Document will now be read-only.'),
		saveunauthorized: _('Document cannot be saved due to expired or invalid access token.'),
		savefailed: _('Document cannot be saved.'),
		renamefailed: _('Document cannot be renamed.')
	};
} else {
	errorMessages.storage = {
		loadfailed: _('Failed to read document from storage. Please contact your storage server (%storageserver) administrator.'),
		savediskfull: _('Save failed due to no disk space left on storage server. Document will now be read-only. Please contact the server (%storageserver) administrator to continue editing.'),
		saveunauthorized: _('Document cannot be saved due to expired or invalid access token.'),
		savefailed: _('Document cannot be saved. Check your permissions or contact the storage server administrator.'),
		renamefailed: _('Document cannot be renamed. Check your permissions or contact the storage server administrator.'),
		saveasfailed: _('Document cannot be exported. Please contact the storage server administrator.')
	};
}

errorMessages.uploadfile = {
	notfound: _('Uploading file to server failed, file not found.'),
	toolarge: _('Uploading file to server failed, the file is too large.')
};


welcomeStrings.explore = _('Explore the new ');
welcomeStrings.slide11 = _('Enjoy the latest developments in online productivity, free for you to use, to explore and to use with others in the browser. Various ');
welcomeStrings.slide12 = _('apps');
welcomeStrings.slide13 = _(' are also available for mobile. ');
welcomeStrings.slide14 = _(' introduces important improvements, in the areas of usability, visual presentation and performance.');
welcomeStrings.slide21 = _('Discover all the changes');
welcomeStrings.slide22 = _('Check the ');
welcomeStrings.slide23 = _('release notes');
welcomeStrings.slide24 = _(' and learn all about: The latest milestone in performance particularly for larger groups working on documents; New scrollbars; Improved spreadsheet\'s tabs and more.');
welcomeStrings.slide31 = _('Get involved');
welcomeStrings.slide32 = _('Are you interested in contributing but don’t know where to start? Head over to the ');
welcomeStrings.slide33 = _('step-by-step instructions');
welcomeStrings.slide34 = _('and build CODE from scratch. You can also help out with');
welcomeStrings.slide35 = _('translations');
welcomeStrings.slide36 = _(' or by ');
welcomeStrings.slide37 = _('filing a bug report');
welcomeStrings.slide38 = _(' with all the essential steps on how to reproduce it.');

if (typeof window !== 'undefined') {
	window.errorMessages = errorMessages;
	// silence unused variable welcomeStrings
	window.welcomeStrings = welcomeStrings;
	delete window.welcomeStrings;
}

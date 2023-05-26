/* -*- js-indent-level: 8 -*- */

/* global _ getParameterByName */
var errorMessages = {};

var lang = getParameterByName('lang');
if (lang) {
	String.locale = lang;
} else {
	String.locale = 'en-US';
}

errorMessages.diskfull = _('No disk space left on server.');
errorMessages.emptyhosturl = _('The host URL is empty. The coolwsd server is probably misconfigured, please contact the administrator.');
errorMessages.limitreached = _('This is an unsupported version of {productname}. To avoid the impression that it is suitable for deployment in enterprises, this message appears when more than {docs} documents or {connections} connections are in use concurrently.');
errorMessages.infoandsupport = _('More information and support');
errorMessages.limitreachedprod = _('This service is limited to %0 documents, and %1 connections total by the admin. This limit has been reached. Please try again later.');
errorMessages.serviceunavailable = _('Service is unavailable. Please try again later and report to your administrator if the issue persists.');
errorMessages.unauthorized = _('Unauthorized WOPI host. Please try again later and report to your administrator if the issue persists.');
errorMessages.wrongwopisrc = _('Wrong or missing WOPISrc parameter, please contact support.');
errorMessages.sessionexpiry = _('Your session will expire in %time. Please save your work and refresh the session (or webpage) to continue. You might need to login again.');
errorMessages.sessionexpired = _('Your session has expired. Further changes to the document might not be saved. Please refresh the session (or webpage) to continue. You might need to login again.');
errorMessages.faileddocloading = _('Failed to load the document. Please ensure the file type is supported and not corrupted, and try again.');
errorMessages.invalidLink = _('Invalid link: \'%url\'');
errorMessages.leaving = _('You are leaving the document. The following web page will open in a new tab: ');
errorMessages.docloadtimeout = _('Failed to load the document. This document is either malformed or is taking more resources than allowed. Please contact the administrator.');
errorMessages.docunloadingretry = _('Cleaning up the document from the last session.');
errorMessages.docunloadinggiveup = _('We are in the process of cleaning up this document from the last session, please try again later.');

if (window.ThisIsAMobileApp) {
	errorMessages.storage = {
		loadfailed: _('Failed to load document.'),
		savediskfull: _('Save failed due to no disk space left. Document will now be read-only.'),
		savetoolarge: _('The document is too large or no disk space left to save. Document will now be read-only.'),
		saveunauthorized: _('Document cannot be saved due to expired or invalid access token.'),
		savefailed: _('Document cannot be saved.'),
		renamefailed: _('Document cannot be renamed.')
	};
} else {
	errorMessages.storage = {
		loadfailed: _('Failed to read document from storage, please try to load the document again.'),
		savediskfull: _('Save failed due to no storage space left. Document will now be read-only. Please make sure enough disk space is available and try to save again.'),
		savetoolarge: _('Save failed because the document is too large or exceeds the remaining storage space. The document will now be read-only but you may still download it now to preserve a copy locally.'),
		saveunauthorized: _('Document cannot be saved due to expired or invalid access token.'),
		savefailed: _('Document cannot be saved, please check your permissions.'),
		renamefailed: _('Document cannot be renamed, please check your permissions.'),
		saveasfailed: _('Document cannot be exported. Please try again.')
	};
}

errorMessages.uploadfile = {
	notfound: _('Uploading file to server failed, file not found.'),
	toolarge: _('Uploading file to server failed, the file is too large.')
};

if (typeof window !== 'undefined') {
	window.errorMessages = errorMessages;
}

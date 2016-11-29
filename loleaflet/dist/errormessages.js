exports.diskfull = _('No disk space left on server, please contact the server administrator to continue.');
exports.emptyhosturl = _('The host URL is empty. The loolwsd server is probably misconfigured, please contact the administrator.');
exports.limitreached = _('This development build is limited to %0 documents, and %1 connections - to avoid the impression that it is suitable for deployment in large enterprises. To find out more about deploying and scaling %2 check out: <br/><a href=\"%3\">%3</a>.');
exports.serviceunavailable = _('Service is unavailable. Please try again later and report to your administrator if the issue persists.');
exports.unauthorized = _('Unauthorized WOPI host. Please try again later and report to your administrator if the issue persists.');
exports.wrongwopisrc = _('Wrong WOPISrc, usage: WOPISrc=valid encoded URI, or file_path, usage: file_path=/path/to/doc/');
exports.sessionexpiry = _('Your session will expire in %time. Please save your work and refresh the session (or webpage) to continue.');
exports.sessionexpired = _('Your session has been expired. Further changes to document might not be saved. Please refresh the session (or webpage) to continue.');

exports.storage = {
	savediskfull: _('Save failed due to no disk space left on storage server. Document will now be read-only. Please contact the server administrator to continue editing.'),
	savefailed: _('Document cannot be saved to storage. Check your permissions or contact the storage server administrator.')
};

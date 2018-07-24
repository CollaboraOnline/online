/* -*- js-indent-level: 8 -*- */
var deps = require('./deps.js').deps;

exports.getFiles = function () {
	var files = [];

	for (var i in deps) {
		for (var j = 0, len = deps[i].src.length; j < len; j++) {
			files.push('admin/' + deps[i].src[j]);
		}
	}

	return files;
};

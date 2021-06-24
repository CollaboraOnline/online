/* global require Promise */

var fs = require('fs');
var list = require('./selectorList').list;

function copyFile(args) {
	return new Promise(function(resolve) {
		var sourceFile = args.sourceDir + args.fileName;
		var destFile = args.destDir + args.fileName;

		if (fs.existsSync(sourceFile)) {
			fs.mkdirSync(args.destDir, { recursive: true });
			if (fs.existsSync(destFile)) {
				fs.unlinkSync(destFile);
			}
			fs.writeFileSync(destFile, fs.readFileSync(sourceFile));
			resolve('File ${sourceFile} copied to ${destFile}');
		}
		resolve('File ${sourceFile} does not exist');
	});
}

function getSelectors(args) {
	if (args.mode === 'notebookbar') {
		return list[args.name][0];
	} else {
		return list[args.name][1];
	}
}

module.exports.copyFile = copyFile;
module.exports.getSelectors = getSelectors;

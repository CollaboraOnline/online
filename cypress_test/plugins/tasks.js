/* global require Promise */

var fs = require('fs');

function copyFile(args) {
	return new Promise(function(resolve) {
		var sourceFile = args.sourceDir + args.fileName;
		var destFile = args.destDir + args.fileName;

		if (fs.existsSync(sourceFile)) {
			fs.mkdirSync(args.destDir, { recursive: true });
			fs.writeFileSync(destFile, fs.readFileSync(sourceFile));
			resolve('File ${sourceFile} copied to ${destFile}');
		}
		resolve('File ${sourceFile} does not exist');
	});
}

module.exports.copyFile = copyFile;

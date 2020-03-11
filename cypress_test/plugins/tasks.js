/* global require Promise */

var fs = require('fs');

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

module.exports.copyFile = copyFile;

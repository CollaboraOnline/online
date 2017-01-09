var fs = require('fs'),
    UglifyJS = require('uglify-js'),
    zlib = require('zlib'),
    browserify = require('browserify'),
    browserifyCss = require('browserify-css'),
    exorcist = require('exorcist'),

    deps = require('./deps.js').deps,
    adminDeps = require('./adminDeps.js').adminDeps;

// TODO: Don't hardcode leaflet-draw version here
var JSBundleFiles = [
	'main.js',
	'dist/leaflet-src.js',
	'dist/errormessages.js',
	'dist/plugins/draw-0.2.4/dist/leaflet.draw.js'
];

var CSSBundleFiles = [
	'main.css',
	'dist/leaflet.css',
	'dist/selectionMarkers.css',
	'dist/loleaflet.css',
	'dist/toolbar.css',
	'dist/partsPreviewControl.css',
	'dist/scrollBar.css',
	'dist/searchControl.css',
	'dist/spreadsheet.css',
	'dist/menubar.css',
	'plugins/draw-0.2.4/dist/leaflet.draw.css',
];

var adminBundleFiles = [
	'main-admin.js',
	'dist/admin/admin-src.js',
	'dist/admin/bootstrap/ie10-viewport-bug-workaround.css',
	'admin.strings.js',
	'dist/admin/bootstrap/holder.min.js',
	'dist/admin/bootstrap/ie10-viewport-bug-workaround.js'
];

exports.getBundleFiles = function() {
	return JSBundleFiles.concat(CSSBundleFiles);
};

exports.getAdminBundleFiles = function() {
	return adminBundleFiles;
};

function getFiles(compsBase32) {
	var memo = {},
	    comps;

	if (compsBase32) {
		comps = parseInt(compsBase32, 32).toString(2).split('');
		console.log('Managing dependencies...');
	}

	function addFiles(srcs) {
		for (var j = 0, len = srcs.length; j < len; j++) {
			memo[srcs[j]] = true;
		}
	}

	for (var i in deps) {
		if (comps) {
			if (parseInt(comps.pop(), 2) === 1) {
				console.log(' * ' + i);
				addFiles(deps[i].src);
			} else {
				console.log('   ' + i);
			}
		} else {
			addFiles(deps[i].src);
		}
	}

	console.log('');

	var files = [];

	for (var src in memo) {
		files.push('src/' + src);
	}

	return files;
}

function getAdminFiles() {
	var files = [];

	for (var i in adminDeps) {
		for (var j = 0, len = adminDeps[i].src.length; j < len; j++) {
			files.push('src/' + adminDeps[i].src[j]);
		}
	}

	return files;
}

exports.getFiles = getFiles;
exports.getAdminFiles = getAdminFiles;

function getSizeDelta(newContent, oldContent, fixCRLF) {
	if (!oldContent) {
		return ' (new)';
	}
	if (newContent === oldContent) {
		return ' (unchanged)';
	}
	if (fixCRLF) {
		newContent = newContent.replace(/\r\n?/g, '\n');
		oldContent = oldContent.replace(/\r\n?/g, '\n');
	}
	var delta = newContent.length - oldContent.length;

	return delta === 0 ? '' : ' (' + (delta > 0 ? '+' : '') + delta + ' bytes)';
}

function loadSilently(path) {
	try {
		return fs.readFileSync(path, 'utf8');
	} catch (e) {
		return null;
	}
}

function combineFiles(files) {
	var content = '';
	for (var i = 0, len = files.length; i < len; i++) {
		content += fs.readFileSync(files[i], 'utf8') + '\n\n';
	}
	return content;
}

function bytesToKB(bytes) {
    return (bytes / 1024).toFixed(2) + ' KB';
}

function bundle(files, destFilename, debug, minify, callback) {
	var bundler = browserify(files, {debug: debug});
	bundler = bundler.transform(browserifyCss);
	if (minify) {
		console.log('uglifying');
		bundler.transform({
			global: true
		}, 'uglifyify');
	}
	var bundleFs = fs.createWriteStream('dist/' + destFilename);
	var res = bundler.bundle();
	if (debug) {
		res = res.pipe(exorcist('dist/' + destFilename + '.map'));
	}
	res.pipe(bundleFs);

	bundleFs.on('finish', function() {
		console.log('Finish writing to dist/' + destFilename);
		callback();
	});
};

exports.bundle = function(debug, minify, callback) {
	bundle(['main.js'], 'bundle.js', debug, minify, callback);
};

exports.bundleAdmin = function(debug, minify, callback) {
	bundle(['main-admin.js'], 'admin-bundle.js', debug, minify, callback);
};

exports.build = function (callback, version, compsBase32, buildName) {

	var files = getFiles(compsBase32);

	console.log('Concatenating and compressing ' + files.length + ' files...');

	var copy = fs.readFileSync('src/copyright.js', 'utf8').replace('{VERSION}', version),
	    intro = '(function (window, document, undefined) {',
	    outro = '}(window, document));',
	    newSrc = copy + intro + combineFiles(files) + outro,

	    pathPart = 'dist/leaflet' + (buildName ? '-' + buildName : ''),
	    srcPath = pathPart + '-src.js',

	    oldSrc = loadSilently(srcPath),
	    srcDelta = getSizeDelta(newSrc, oldSrc, true);

	console.log('\tUncompressed: ' + bytesToKB(newSrc.length) + srcDelta);

	if (newSrc !== oldSrc) {
		fs.writeFileSync(srcPath, newSrc);
		console.log('\tSaved to ' + srcPath);
	}

	var path = pathPart + '.js',
	    oldCompressed = loadSilently(path),
	    newCompressed = copy + UglifyJS.minify(newSrc, {
	        warnings: true,
	        fromString: true
	    }).code,
	    delta = getSizeDelta(newCompressed, oldCompressed);

	console.log('\tCompressed: ' + bytesToKB(newCompressed.length) + delta);

	var newGzipped,
	    gzippedDelta = '';

	function done() {
		if (newCompressed !== oldCompressed) {
			fs.writeFileSync(path, newCompressed);
			console.log('\tSaved to ' + path);
		}
		console.log('\tGzipped: ' + bytesToKB(newGzipped.length) + gzippedDelta);
		callback();
	}

	zlib.gzip(newCompressed, function (err, gzipped) {
		if (err) { return; }
		newGzipped = gzipped;
		if (oldCompressed && (oldCompressed !== newCompressed)) {
			zlib.gzip(oldCompressed, function (err, oldGzipped) {
				if (err) { return; }
				gzippedDelta = getSizeDelta(gzipped, oldGzipped);
				done();
			});
		} else {
			done();
		}
	});
};

exports.buildadmin = function(callback) {
	// TODO: Also minify if admin complexity increases in future
	var adminNewSrc = combineFiles(getAdminFiles()),
	    adminPath = 'dist/admin/admin-src.js',
	    adminOldSrc = loadSilently(adminPath),
	    adminSrcDelta = getSizeDelta(adminNewSrc, adminOldSrc, true);

	if (adminSrcDelta !== ' (unchanged)') {
		fs.writeFileSync(adminPath, adminNewSrc);
		console.log('\tAdmin files saved to ' + adminPath);
	}

	callback();
};

exports.test = function(complete, fail) {
	var karma = require('karma'),
	    testConfig = {configFile : __dirname + '/../spec/karma.conf.js'};

	testConfig.browsers = ['PhantomJS'];

	function isArgv(optName) {
		return process.argv.indexOf(optName) !== -1;
	}

	if (isArgv('--chrome')) {
		testConfig.browsers.push('Chrome');
	}
	if (isArgv('--safari')) {
		testConfig.browsers.push('Safari');
	}
	if (isArgv('--ff')) {
		testConfig.browsers.push('Firefox');
	}
	if (isArgv('--ie')) {
		testConfig.browsers.push('IE');
	}

	if (isArgv('--cov')) {
		testConfig.preprocessors = {
			'src/**/*.js': 'coverage'
		};
		testConfig.coverageReporter = {
			type : 'html',
			dir : 'coverage/'
		};
		testConfig.reporters = ['coverage'];
	}

	console.log('Running tests...');

	karma.server.start(testConfig, function(exitCode) {
		if (!exitCode) {
			console.log('\tTests ran successfully.\n');
			complete();
		} else {
			process.exit(exitCode);
		}
	});
};

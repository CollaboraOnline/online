/*
Leaflet building, testing and linting scripts.

To use, install Node, then run the following commands in the project root:

    npm install -g jake
    npm install

To check the code for errors and build Leaflet from source, run "jake".
To run the tests, run "jake test".

For a custom build, open build/build.html in the browser and follow the instructions.
*/

var build = require('./build/build.js'),
    version = require('./src/Leaflet.js').version;

function hint(msg, args) {
	return function () {
		console.log(msg);
		jake.exec('node node_modules/eslint/bin/eslint.js ' + args,
		          {printStdout: true}, function () {
			console.log('\tCheck passed.\n');
			complete();
		});
	};
}

desc('Check Leaflet source for errors with ESLint');
task('lint', {async: true}, hint('Checking for JS errors...', 'src dist --config .eslintrc'));

desc('Check admin source for errors with ESLint');
task('lintadmin', {async: true}, hint('Checking for admin JS errors...', 'src/admin --config .eslintrc'));

desc('Check Leaflet specs source for errors with ESLint');
task('lintspec', {async: true}, hint('Checking for specs JS errors...', 'spec/suites --config spec/.eslintrc'));

desc('Create a combined leaflet file');
file('dist/leaflet-src.js', build.getFiles(), {async: true}, function() {
	var lint = jake.Task['lint'];
	lint.addListener('complete', function(value) {
		var v;
		jake.exec('git log -1 --pretty=format:"%h"', {breakOnError: false}, function () {
			console.log('Building leaflet-src.js ...');
			build.build(complete, v);
		}).on('stdout', function (data) {
			v = version + ' (' + data.toString() + ')';
		}).on('error', function () {
			v = version;
		});
	});
	lint.invoke();
});

desc('Create a combined admin file');
file('dist/admin/admin-src.js', build.getAdminFiles(), {async: true}, function() {
	var lint = jake.Task['lintadmin'];
	lint.addListener('complete', function(value) {
		console.log('Building admin-src.js ...');
		build.buildadmin(complete);
	});
	lint.invoke();
});

desc('Create final bundled js file to be used by main lool editor');
file('dist/bundle.js', build.getBundleFiles(), {async: true}, function() {
	var debug = process.env.debug === 'true';
	var minify = process.env.minify === 'true';

	console.log('Creating bundle.js (debug=' + debug +', minify=' + minify + ') ...');
	build.bundle(debug, minify, complete);
});

desc('Create final bundle js file to be used by admin console');
file('dist/admin-bundle.js', build.getAdminBundleFiles(), {async: true}, function() {
	var debug = process.env.debug === 'true';
	var minify = process.env.minify === 'true';

	console.log('Creating admin-bundle.js (debug=' + debug +', minify=' + minify + ') ...');
	build.bundleAdmin(debug, minify, complete);
});

desc('Create final bundled JS files');
task('build', {async: true}, function () {
	// TODO: Build both admin-bundle and bundle parallely
	var bundlejs = jake.Task['dist/bundle.js'];
	bundlejs.addListener('complete', function(value) {
		console.log('Finished building loleaflet');
		complete();
	});

	var adminbundlejs = jake.Task['dist/admin-bundle.js'];
	adminbundlejs.addListener('complete', function(value) {
		console.log('Finished building admin');
		bundlejs.invoke();
	});

	adminbundlejs.invoke();
});

desc('Run PhantomJS tests');
task('test', ['lint', 'lintspec'], {async: true}, function () {
	build.test(complete);
});

task('default', ['test', 'build']);

jake.addListener('complete', function () {
  process.exit();
});

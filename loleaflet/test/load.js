var vm = require("vm");
var fs = require("fs");
var tmp = require('tmp');

if (process.argv.length < 3 ||
    process.argv[2] == '--help') {
	console.debug('load.js <ssl_true_or_false> <abs_op_builddir> <abs-path-to-file> [bookmark]');
	process.exit(0);
}

var ssl_flag = process.argv[2];
var top_builddir = process.argv[3];

var to_load;
if (process.argv.length > 4) {
	to_load = process.argv[4]
} else {
	var content = fs.readFileSync(top_builddir + '/test/data/perf-test-edit.odt');
	var tmpObj = tmp.fileSync({ mode: 0644, prefix: 'perf-test-', postfix: '.odt' });
	to_load = tmpObj.name;
	fs.writeFileSync(to_load, content);
}

var bookmark;
if (process.argv.length > 5) {
	bookmark = process.argv[5];
}

// jsdom for browser emulation
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

var data = fs.readFileSync(top_builddir + '/loleaflet/dist/loleaflet.html', {encoding: 'utf8'});

data = data.replace(/%SERVICE_ROOT%\/loleaflet\/%VERSION%/g, top_builddir + '/loleaflet/dist');
data = data.replace(/%SERVICE_ROOT%/g, '');
data = data.replace(/%VERSION%/g, 'dist');
if (ssl_flag === 'true')
    data = data.replace(/%HOST%/g, 'wss://localhost:9980');
else
    data = data.replace(/%HOST%/g, 'ws://localhost:9980');
data = data.replace(/%ACCESS_TOKEN%/g, '');
data = data.replace(/%ACCESS_TOKEN_TTL%/g, '0');
data = data.replace(/%ACCESS_HEADER%/g, '');
data = data.replace(/%LOLEAFLET_LOGGING%/g, 'true');
data = data.replace(/%ENABLE_WELCOME_MSG%/g, 'false');
data = data.replace(/%ENABLE_WELCOME_MSG%/g, 'false');
data = data.replace(/%ENABLE_WELCOME_MSG_BTN%/g, 'false');
data = data.replace(/%USER_INTERFACE_MODE%/g, '');
data = data.replace(/%OUT_OF_FOCUS_TIMEOUT_SECS%/g, '1000000');
data = data.replace(/%IDLE_TIMEOUT_SECS%/g, '1000000');
data = data.replace(/%REUSE_COOKIES%/g, 'false');
data = data.replace(/%PROTOCOL_DEBUG%/g, 'true');
data = data.replace(/%FRAME_ANCESTORS%/g, '');
data = data.replace(/%SOCKET_PROXY%/g, 'false');
data = data.replace(/%UI_DEFAULTS%/g, '{}');

window = new JSDOM(data,
		   { runScripts: 'dangerously',
		     pretendToBeVisual: true,
		     includeNodeLocations: true,
		     url: 'file:///tmp/notthere/loleaflet.html?file_path=file:///' + to_load,
		     resources: 'usable',
		     beforeParse(window) {
			     console.debug('Before script parsing');
		     },
		     done(errors, window) {
			     console.debug('Errors ' + errors);
		     }
		   }).window;

// Make it possible to mock sizing properties
Object.defineProperty(window.HTMLElement.prototype, "clientWidth", {
	get: function() {
		return this.___clientWidth || 0;
	}
});
Object.defineProperty(window.HTMLElement.prototype, "clientHeight", {
	get: function() {
		return this.___clientHeight || 0;
	}
});

console.log('Finished bootstrapping: ' + window.L.Browser.mobile + ' desktop ' + window.mode.isDesktop() + ' now running');
console.debug('Window size ' + window.innerWidth + 'x' + window.innerHeight);

window.HTMLElement.prototype.getBoundingClientRect = function() {
	console.debug('getBoundingClientRect for ' + this.id);
	return {
		width: 0, height: 0, top: 0, left: 0
	};
};

function sleep(ms)
{
	return new Promise(r => setTimeout(r, ms));
}

window.onload = function() {
	console.debug('socket ' + window.socket);
	map = window.socket._map;

	console.debug('Initialize / size map pieces ' + map);

	// Force some sizes onto key pieces:
	map._container.___clientWidth = 1024;
	map._container.___clientHeight = 768;

	map.on('docloaded', function(){
		console.debug('document loaded');
		setTimeout(async function() {
			if (bookmark)
			{
				let nodeIndex = parseInt(bookmark.substring(bookmark.lastIndexOf('_')+1));
				nodeIndex = nodeIndex - 1; // starts from 1
				console.debug('Jump to bookmark ' + bookmark);
				var cmd = {
					'Bookmark': { 'type': 'string', 'value': bookmark }
				};
				window.app.socket.sendMessage('uno .uno:JumpToMark ' + JSON.stringify(cmd));
				// set a mixed zoom levels: %50, %100, %200
				// tile sizes:
				let tileSizes = [7963, 3840, 1852];
				let zoomLevels = [50, 100, 200];
				let index = nodeIndex % tileSizes.length;
				// send zoom request
				console.debug('sending zoom request: %', zoomLevels[index]);
				let zoomMessage = `clientzoom tilepixelwidth=256 tilepixelheight=256 tiletwipwidth=${tileSizes[index]} tiletwipheight=${tileSizes[index]}`;
				console.debug(zoomMessage);
				window.app.socket.sendMessage(zoomMessage);
				await sleep(500);
				// mesh the keyboard:
				let dummyInput = 'askdjf ,asdhflkas r;we f;akdn.adh ;o wh;fa he;qw e.fkahsd ;vbawe.kguday;f vas.,mdb kaery kejraerga';
				map.focus();
				for (let i = 0; i < dummyInput.length; i++)
				{
					console.debug('sending input key: ' + dummyInput.charCodeAt(i));
					window.app.socket.sendMessage(
						'key' +
						' type=' + 'input' +
						' char=' + dummyInput.charCodeAt(i) + ' key=0\n'
					);
					await sleep(30);
				}
			}
			else
				console.debug('No bookmark to jump to');
		}, 500);
	});
};

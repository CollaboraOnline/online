var vm = require("vm");
var fs = require("fs");

var top_srcdir = process.argv[2];
var top_builddir = process.argv[3];

var to_load = top_srcdir + '/test/data/hello-world.ods';
if (process.argv.length > 4) {
	to_load = process.argv[4]
}

// jsdom for browser emulation
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

var data = fs.readFileSync(top_builddir + '/loleaflet/dist/loleaflet.html', {encoding: 'utf8'});

data = data.replace(/%SERVICE_ROOT%\/loleaflet\/%VERSION%/g, top_builddir + '/loleaflet/dist');
data = data.replace(/%SERVICE_ROOT%/g, '');
data = data.replace(/%VERSION%/g, 'dist');
data = data.replace(/%HOST%/g, 'wss://localhost:9980');
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
window.onload = function() {
	console.debug('socket ' + window.socket);
	map = window.socket._map;

	console.debug('Initialize / size map pieces ' + map);

	// Force some sizes onto key pieces:
	map._container.___clientWidth = 1024;
	map._container.___clientHeight = 768;
};

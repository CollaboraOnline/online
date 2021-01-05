console.log('Startup')

var vm = require("vm");
var fs = require("fs");

// stubs
/*navigator = {
	userAgent: 'loadtest',
	vendor: 'collabora',
	platform: 'Linux'
}; */

// jsdom for browser emulation
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
window = new JSDOM(`...`).window;
window.host = 'localhost';
window.location = 'https://localhost:9980';

// cf. loleaflet.hml - Window properties:
window.host = '';
window.serviceRoot = '';
window.versionPath = '6.4.3';
window.accessToken = '';
window.accessTokenTTL = '';
window.accessHeader = '';
window.loleafletLogging = 'true';
window.enableWelcomeMessage = false;
window.enableWelcomeMessageButton = false;
window.outOfFocusTimeoutSecs = 1000000;
window.idleTimeoutSecs = 1000000;
window.reuseCookies = '';
window.protocolDebug = false;
window.frameAncestors = '';
window.socketProxy = false;
window.tileSize = 256;
window.uiDefaults = {};

// stub the DOM left and right:

context = vm.createContext(window, {name: 'simulation' })

L = { Browser: {} };

for (var i = 2; i < process.argv.length; ++i)
{
	console.log('load "' + process.argv[i] + '"');

	var data = fs.readFileSync(process.argv[i]);
	const script = new vm.Script(data);
	script.runInContext(context);
}

console.log('Bootstrapped mobile: ' + L.Browser.mobile + ' desktop ' + window.mode.isDesktop());


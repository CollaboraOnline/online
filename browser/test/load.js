var vm = require("vm");
var fs = require("fs");
var tmp = require('tmp');

if (process.argv.length < 3 ||
    process.argv[2] == '--help') {
	console.debug('load.js <ssl_true_or_false> <abs_op_builddir> <abs-path-to-file> [bookmark] [port]');
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

let port = 9980;
if (process.argv.length > 6) {
	port = process.argv[6];
}

let typing_speed = 30;
if (process.argv.length > 7) {
	typing_speed = parseInt(process.argv[7]);
}

let typing_duration = 5000;
if (process.argv.length > 8) {
	typing_duration = parseInt(process.argv[8]);
}

let record_stats = false;
if (process.argv.length > 9) {
	record_stats = process.argv[9] === 'true';
}

let single_view = false;
if (process.argv.length > 10) {
	single_view = process.argv[10] === 'true';
}
/*
global.console = {
  log: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
  log2: () => {}
};
*/
// jsdom for browser emulation
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

var data = fs.readFileSync(top_builddir + '/browser/dist/cool.html', {encoding: 'utf8'});

data = data.replace(/%SERVICE_ROOT%\/browser\/%VERSION%/g, top_builddir + '/browser/dist');
data = data.replace(/%SERVICE_ROOT%/g, '');
data = data.replace(/%VERSION%/g, 'dist');
if (ssl_flag === 'true')
    data = data.replace(/%HOST%/g, `wss://localhost:${port}`);
else
    data = data.replace(/%HOST%/g, `ws://localhost:${port}`);
data = data.replace(/%ACCESS_TOKEN%/g, '');
data = data.replace(/%ACCESS_TOKEN_TTL%/g, '0');
data = data.replace(/%ACCESS_HEADER%/g, '');
data = data.replace(/%BROWSER_LOGGING%/g, 'true');
data = data.replace(/%ENABLE_WELCOME_MSG%/g, 'false');
data = data.replace(/%AUTO_SHOW_WELCOME%/g, 'false');
data = data.replace(/%AUTO_SHOW_FEEDBACK%/g, 'false');
data = data.replace(/%USER_INTERFACE_MODE%/g, '');
data = data.replace(/%USE_INTEGRATION_THEME%/g, 'true');
data = data.replace(/%OUT_OF_FOCUS_TIMEOUT_SECS%/g, '1000000');
data = data.replace(/%IDLE_TIMEOUT_SECS%/g, '1000000');
data = data.replace(/%REUSE_COOKIES%/g, 'false');
data = data.replace(/%PROTOCOL_DEBUG%/g, 'true');
data = data.replace(/%FRAME_ANCESTORS%/g, '');
data = data.replace(/%SOCKET_PROXY%/g, 'false');
data = data.replace(/%UI_DEFAULTS%/g, '{}');
data = data.replace(/%HEXIFY_URL%/g, '""');
data = data.replace(/%GROUP_DOWNLOAD_AS%/g, 'false');

window = new JSDOM(data, {
				runScripts: 'dangerously',
				verbose: false,
				pretendToBeVisual: false,
				includeNodeLocations: false,
				url: 'file:///tmp/notthere/cool.html?file_path=file:///' + to_load,
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

process.stderr.write('Finished bootstrapping: mobile=' + window.L.Browser.mobile + ' desktop=' + window.mode.isDesktop() + ' now running\n');
console.debug('Window size ' + window.innerWidth + 'x' + window.innerHeight);

window.HTMLElement.prototype.getBoundingClientRect = function() {
//	console.debug('getBoundingClientRect for ' + this.id);
	return {
		width: 0, height: 0, top: 0, left: 0
	};
};

// nodejs requires rejectUnauthorized to be set to cope with our https
window.createWebSocket = function(uri) {
        if ('processCoolUrl' in window) {
                uri = window.processCoolUrl({ url: uri, type: 'ws' });
        }

        if (global.socketProxy) {
                window.socketProxy = true;
                return new global.ProxySocket(uri);
        } else {
		// FIXME: rejectUnauthorized: false for SSL?
                return new WebSocket(uri);
        }
};

function sleep(ms)
{
	return new Promise(r => setTimeout(r, ms));
}
var docLoaded = false;
processedTiles = [];
let socketMessageCount = 0;

function dumpStats() {
	let len = processedTiles.length;
	let skipFirst = Math.floor(len * 0.1);
	let delays = [];
	const bucketCount = 10;
	let buckets = new Array(bucketCount).fill(0);
	const bucketSize = 20;
	for (let i = skipFirst; i < len; ++i) {
		let delay = processedTiles[i] - processedTiles[i-1];
		delays.push(delay);
		buckets[Math.min(Math.trunc(delay / bucketSize), bucketCount-1)]++;
	}
	let output = '';
	let now = new Date();
	output += now.getTime() + '\n';
	output += now.toUTCString() + '\n';
	let delayList = `Delay list=${delays.join()}`;
	output += delayList;
	output += '\n';
	for (var i = 0; i < bucketCount; i++) {
		if (i == bucketCount - 1)
			output += `>${i * 20}ms     \t=${buckets[i]} elements\n`;
		else
			output += `${i * 20}-${(i+1)*20}ms     \t=${buckets[i]} elements\n`;
	}
	output += '\n';
	output += `Bucket count=${buckets.length}\n`;
	output += `Bucket size=${bucketSize}ms\n`;
	output += `Num of samples=${delays.length}\n`;
	output += `Delay between each event=${typing_speed}ms\n`;
	output += `Duration=${typing_duration}ms\n`;
	output += `Total num of incoming socket messages=${socketMessageCount}\n`;
	output += `Single view=${single_view}\n`;
	fs.writeFile(top_builddir + '/browser/test/tilestats.txt', output, function (err) {
		if (err) console.log('tilestats: error dumping stats to file!', err);
		else console.log('tilestats: finished dumping the stats to file!');
	});
	process.stderr.write(output);
}

window.onload = function() {
	console.debug('socket ' + window.socket);
	map = window.socket._map;

	// no need to slurp since there's no actual layout rendering
	var original = window.socket._onMessage.bind(window.socket);
	var injectedOnMessage = function(e) {
		if (record_stats)
			socketMessageCount++;
		window.socket._extractTextImg(e);
		let textMsg = e.textMsg;
		if (!single_view) {
			if (!textMsg) return;
			if (textMsg.indexOf('.uno:ModifiedStatus') >= 0)
				map.fire('docloaded');
			if (!record_stats) return;
		}
		// processing images takes significant amount of cpu time on JSDOM
		if (textMsg.startsWith('tile:')) {
			if (record_stats) {
				processedTiles.push(new Date().getTime());
			}
			var command = window.socket.parseServerCmd(textMsg);
			let sendMsg = `tileprocessed tile=0:${command.x}:${command.y}:${command.tileWidth}:${command.tileHeight}:0`;
			window.socket._doSend(sendMsg);
			return;
		}
		if (!single_view && !record_stats)
			return;
		original(e);
	}
	window.socket.socket.onmessage = injectedOnMessage.bind(window.socket);
	window.socket._emitSlurpedEvents = function() {}
	clearTimeout(window.socket._slurpTimer);
	console.debug('Initialize / size map pieces ' + map);

	// Force some sizes onto key pieces:
	map._container.___clientWidth = 1024;
	map._container.___clientHeight = 768;

	map.on('docloaded', function(){
		if (docLoaded) return;
		docLoaded = true;
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
				let inputIndex = 0;
				if (record_stats) {
					console.log('tilestats: recording tile delays starting in one second..');
					await sleep(1000);
					console.log('tilestats: recording started..');
				}
				let timeStart = new Date().getTime();
				let typing = setInterval(() => {
					let now = new Date().getTime();
					if (timeStart + typing_duration < now) {
						if (record_stats) {
							console.log('tilestats: recording ended..');
							record_stats = false;
							dumpStats();
						}
						clearInterval(typing);
						console.log('End typing simulation');
						process.exit(0);
					}
//					console.debug('sending input text= ' + dummyInput[inputIndex]);
					if (dummyInput.charCodeAt(inputIndex) === 32) { // space
						window.socket._doSend(
							'key' +
							' type=' + 'input' +
							' char=' + dummyInput.charCodeAt(inputIndex) + ' key=0\n'
						);
					} else {
						window.socket._doSend(`textinput id=0 text=${dummyInput[inputIndex]}`);
					}
					inputIndex = (inputIndex + 1) % dummyInput.length;
				}, typing_speed);
			}
			else
				console.debug('No bookmark to jump to');
		}, 500);
	});
};

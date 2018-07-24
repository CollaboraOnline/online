/* -*- js-indent-level: 8 -*- */
var WebSocket = require('ws');
var events = require('events');

if (typeof String.prototype.startsWith != 'function') {
	String.prototype.startsWith = function (str){
		return this.indexOf(str) === 0;
	};
}

describe('LoadTest', function () {
	// 30s timeout
	this.timeout(30000);
	// set the slow time to 5ms knowing each test takes more than that,
	// so the run time is always printed
	this.slow(5);
	var testsRan = 0,
		testsToRun = 500;
		tileSize = 256,
		tileSizeTwips = 3840,
		host = 'wss://localhost:9980';

	var _parseServerCmd = function (msg) {
		var tokens = msg.split(/[ \n]+/);
		var command = {};
		for (var i = 0; i < tokens.length; i++) {
			if (tokens[i].substring(0, 9) === 'tileposx=') {
				command.x = parseInt(tokens[i].substring(9));
			}
			else if (tokens[i].substring(0, 9) === 'tileposy=') {
				command.y = parseInt(tokens[i].substring(9));
			}
			else if (tokens[i].substring(0, 10) === 'tilewidth=') {
				command.tileWidth = parseInt(tokens[i].substring(10));
			}
			else if (tokens[i].substring(0, 11) === 'tileheight=') {
				command.tileHeight = parseInt(tokens[i].substring(11));
			}
			else if (tokens[i].substring(0, 6) === 'width=') {
				command.width = parseInt(tokens[i].substring(6));
			}
			else if (tokens[i].substring(0, 7) === 'height=') {
				command.height = parseInt(tokens[i].substring(7));
			}
			else if (tokens[i].substring(0, 5) === 'part=') {
				command.part = parseInt(tokens[i].substring(5));
			}
			else if (tokens[i].substring(0, 6) === 'parts=') {
				command.parts = parseInt(tokens[i].substring(6));
			}
			else if (tokens[i].substring(0, 8) === 'current=') {
				command.currentPart = parseInt(tokens[i].substring(8));
			}
		}
		return command;
	};

	function shuffle(o){
		for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
		return o;
	}

	docPath = 'file://' + __dirname + '/data/load_test/';
	var docs = [];
	for (var i = 1; i <= 125; i++) {
		docs.push('eval' + i + '.odt');
		docs.push('eval' + i + '.odp');
		docs.push('eval' + i + '.ods');
		docs.push('eval' + i + '.odg');
	}
	docs = shuffle(docs);

	docs.forEach(function (testDoc) {
		if (testsRan >= testsToRun) {
			return;
		}
		testsRan += 1;
		describe('Document #' + testsRan + ' (' + testDoc + ')', function () {
			var ws;
			var requestedTiles = 0;
			var docWidthTwips, docHeightTwips, midY, endY;
			var eventEmitter = new events.EventEmitter();

			var onMessage = function (evt) {
				var bytes, index, textMsg;

				if (typeof (evt.data) === 'string') {
					textMsg = evt.data;
				}
				else if (typeof (evt.data) === 'object') {
					bytes = new Uint8Array(evt.data);
					index = 0;
					// search for the first newline which marks the end of the message
					while (index < bytes.length && bytes[index] !== 10) {
						index++;
					}
					textMsg = String.fromCharCode.apply(null, bytes.subarray(0, index));
				}

				if (textMsg.startsWith('status:')) {
					command = _parseServerCmd(textMsg);
					docWidthTwips = command.width;
					docHeightTwips = command.height;
					endY = Math.floor(docHeightTwips / tileSizeTwips);
					midY = Math.floor(endY / 2);
					eventEmitter.emit('status');
				}
				else if (textMsg.startsWith('tile:')) {
					requestedTiles -= 1;
					if (requestedTiles <= 0) {
						eventEmitter.emit('alltilesloaded');
					}
				}
				else if (textMsg.startsWith('error:')) {
					console.log(textMsg);
					throw new Error(textMsg);
				}
			};

			var requestTiles = function (x, y) {
				requestedTiles += 1;
				ws.send('tile ' +
						'part=0 ' +
						'width=' + tileSize + ' ' +
						'height=' + tileSize + ' ' +
						'tileposx=' + x * tileSizeTwips + ' ' +
						'tileposy=' + y * tileSizeTwips + ' ' +
						'tilewidth=' + tileSizeTwips + ' ' +
						'tileheight=' + tileSizeTwips);
			};

			var isValidTile = function (x, y) {
				return x >= 0 && y >= 0 && (x * tileSizeTwips < docWidthTwips) && (y * tileSizeTwips < docHeightTwips);
			};

			after(function (done) {
				ws.onmessage = function () {};
				ws.close();
				done();
			});

			it('Connect to the server', function (done) {
				eventEmitter.once('status', done);
				ws = new WebSocket(host);
				ws.onmessage = onMessage;
				ws.onerror = function (e) {console.log(e)};
				ws.binaryType = 'arraybuffer';
				ws.onopen = function () {
					ws.send('load url=' + docPath + testDoc);
					ws.send('status');
				};
			});

			it('Load the document', function (done) {
				eventEmitter.once('alltilesloaded', done);
				for (var i = 0; i < 3; i++) {
					for (j = 0; j < 5; j++) {
						if (isValidTile(j, i)) {
							requestTiles(j, i);
						}
					}
				}
			});

			it('Scroll to the middle', function (done) {
				eventEmitter.once('alltilesloaded', done);
				for (var i = midY; i < midY + 3; i++) {
					for (j = 0; j < 5; j++) {
						if (isValidTile(j, i)) {
							requestTiles(j, i);
						}
					}
				}
			});

			it('Scroll to the end', function (done) {
				eventEmitter.once('alltilesloaded', done);
				for (var i = endY; i > endY - 3; i--) {
					for (j = 0; j < 5; j++) {
						if (isValidTile(j, i)) {
							requestTiles(j, i);
						}
					}
				}
			});
		});
	});
});

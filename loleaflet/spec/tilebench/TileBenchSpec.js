/* -*- js-indent-level: 8 -*- */
describe('TileBench', function () {
	// 25 s timeout
	this.timeout(25000);
	var map;
	var timeOut

	var log = function (msg) {
		// write custom log messages
		var cont = document.getElementById('mocha-report');
		var li = document.createElement('li');
		li.style.class = 'test pass';
		li.innerHTML = '<h2>' + msg + '</h2>';
		cont.appendChild(li);
	};

	var getParameterByName = function (name) {
		name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
		var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
			results = regex.exec(location.search);
		return results === null ? "" : results[1].replace(/\+/g, " ");
	};

	before(function () {
		var htmlPath = window.location.pathname;
		var dir = htmlPath.substring(0, htmlPath.lastIndexOf('/'));
		var fileURL = 'file://' + dir + '/data/eval.odt';
		fileURL = getParameterByName('file_path') || fileURL;
		var server = getParameterByName('host') || 'wss://localhost:9980';
		// initialize the map and load the document
		map = L.map('map', {
			server: server,
			doc: fileURL,
			edit: false,
			readOnly: false
		});

		// add a timestamp to tile messages so we can identify
		// the response
		map._socket.sendMessage = L.bind(function (msg, coords) {
			var now = Date.now();
			if (msg.startsWith('tile')) {
				msg += ' timestamp=' + now;
			}
			L.Log.log(msg, 'OUTGOING', coords, now);
			this.socket.send(msg);
		}, map._socket);
	});

	afterEach(function () {
		map.off('statusindicator');
	});

	after(function () {
		map.remove();
        document.getElementById('document-container').style.visibility = 'hidden';
	});

	describe('Benchmarking', function () {
		it('Load all new tiles', function (done) {
			map.on('statusindicator', function (e) {
				if (e.statusType === 'alltilesloaded') {
					map.fire('requestloksession');
					map._docLayer._preFetchTiles = function () {};
					done();
				}
			});

		});

		it('Edit the document', function (done) {
			L.Log.clear();

			// allow 2 seconds to pass after the last key input
			var aproxTime = keyInput[keyInput.length - 1][0] + 2000;

			setTimeout(function () {
				map.on('statusindicator', function (e) {
					if (e.statusType === 'alltilesloaded') {
						getTimes(done);
					}
				});


				// request an empty tile and when it arrives we know that the
				// server has finished processing all other messages
				var docLayer = map._docLayer;
				var x = Math.floor(docLayer._docWidthTwips / docLayer._tileWidthTwips);
				var y = Math.floor(docLayer._docHeightTwips / docLayer._tileHeightTwips);
				var coords = new L.Point(x, y);
				coords.z = map.getZoom();
				coords.part = docLayer._selectedPart;
				var key = docLayer._tileCoordsToKey(coords);
				if (docLayer._tiles[key]) {
					// the tile is already here, the whole document is loaded
					getTimes(done);
				}
				var fragment = document.createDocumentFragment();
				docLayer._addTile(coords, fragment);
			}, aproxTime);

			for (var i = 0; i < keyInput.length; i++) {
				setTimeout(L.bind(function () {
					map._socket.sendMessage(keyInput[this][1]);
				}, i), keyInput[i][0]);
			}
		});
	});

	var getTimes = function (done) {
		var incoming = [];
		var outgoing = [];
		var logs = L.Log._logs;
		for (var i = 0; i < logs.length; i++) {
			if (logs[i].coords !== undefined) {
				if (logs[i].direction === 'INCOMING') {
					logs[i].msg = logs[i].msg.replace(':', '');
					incoming.push(logs[i]);
				}
				else if (logs[i].direction === 'OUTGOING') {
					logs[i].msg = logs[i].msg.replace('tilecombine','tile');
					outgoing.push(logs[i]);
				}
			}
		}
		time_deltas = [];
		for (i = 0; i < outgoing.length; i++) {
			for (j = 0; j < incoming.length; j++) {
				if (outgoing[i].msg === incoming[j].msg) {
					time_deltas.push(incoming[j].time - outgoing[i].time);
					break;
				}
			}
		}
		var min = 20000,
			max = 0,
			avg = 0;
		for (i = 0; i < time_deltas.length; i++) {
			min = Math.min(min, time_deltas[i]);
			max = Math.max(max, time_deltas[i]);
			avg += time_deltas[i];
		}
		avg = Math.round(avg / time_deltas.length);

		log('Min time: ' + min + ' ms');
		log('Max time: ' + max + ' ms');
		log('Avg time: ' + avg + ' ms');

		done();
	};

	// since we don't click anywhere, this replay will only work for text documents
	var keyInput = [
		[135, 'key type=input char=84 key=0'],
		[237, 'key type=up char=0 key=16'],
		[254, 'key type=up char=0 key=84'],
		[372, 'key type=input char=104 key=0'],
		[455, 'key type=input char=105 key=0'],
		[510, 'key type=up char=0 key=72'],
		[520, 'key type=input char=115 key=0'],
		[580, 'key type=up char=0 key=73'],
		[603, 'key type=input char=32 key=0'],
		[635, 'key type=up char=0 key=83'],
		[701, 'key type=up char=0 key=1284'],
		[875, 'key type=input char=116 key=0'],
		[915, 'key type=input char=101 key=0'],
		[993, 'key type=up char=0 key=84'],
		[1014, 'key type=up char=0 key=69'],
		[1148, 'key type=input char=115 key=0'],
		[1244, 'key type=up char=0 key=83'],
		[1319, 'key type=input char=116 key=0'],
		[1377, 'key type=input char=115 key=0'],
		[1418, 'key type=up char=0 key=84'],
		[1466, 'key type=input char=32 key=0'],
		[1493, 'key type=up char=0 key=83'],
		[1544, 'key type=up char=0 key=1284'],
		[1687, 'key type=input char=116 key=0'],
		[1760, 'key type=input char=104 key=0'],
		[1773, 'key type=up char=0 key=84'],
		[1828, 'key type=input char=101 key=0'],
		[1886, 'key type=up char=0 key=72'],
		[1952, 'key type=up char=0 key=69'],
		[1957, 'key type=input char=32 key=0'],
		[2071, 'key type=up char=0 key=1284'],
		[2176, 'key type=input char=115 key=0'],
		[2250, 'key type=input char=101 key=0'],
		[2282, 'key type=up char=0 key=83'],
		[2349, 'key type=up char=0 key=69'],
		[2430, 'key type=input char=114 key=0'],
		[2512, 'key type=up char=0 key=82'],
		[2702, 'key type=input char=118 key=0'],
		[2751, 'key type=input char=101 key=0'],
		[2806, 'key type=up char=0 key=86'],
		[2873, 'key type=up char=0 key=69'],
		[2927, 'key type=input char=114 key=0'],
		[3032, 'key type=up char=0 key=82'],
		[3064, 'key type=input char=39 key=0'],
		[3160, 'key type=input char=115 key=0'],
		[3175, 'key type=up char=0 key=222'],
		[3243, 'key type=input char=32 key=0'],
		[3269, 'key type=up char=0 key=83'],
		[3337, 'key type=up char=0 key=1284'],
		[3535, 'key type=input char=114 key=0'],
		[3574, 'key type=input char=101 key=0'],
		[3646, 'key type=up char=0 key=82'],
		[3705, 'key type=up char=0 key=69'],
		[3804, 'key type=input char=112 key=0'],
		[3868, 'key type=input char=111 key=0'],
		[3953, 'key type=up char=0 key=80'],
		[4056, 'key type=up char=0 key=79'],
		[4262, 'key type=input char=110 key=0'],
		[4362, 'key type=input char=115 key=0'],
		[4390, 'key type=up char=0 key=78'],
		[4449, 'key type=input char=101 key=0'],
		[4513, 'key type=up char=0 key=83'],
		[4535, 'key type=input char=32 key=0'],
		[4560, 'key type=up char=0 key=69'],
		[4631, 'key type=up char=0 key=1284'],
		[4771, 'key type=input char=116 key=0'],
		[4818, 'key type=input char=105 key=0'],
		[4853, 'key type=up char=0 key=84'],
		[4908, 'key type=up char=0 key=73'],
		[4990, 'key type=input char=109 key=0'],
		[5038, 'key type=input char=101 key=0'],
		[5118, 'key type=up char=0 key=77'],
		[5157, 'key type=input char=32 key=0'],
		[5195, 'key type=up char=0 key=69'],
		[5273, 'key type=up char=0 key=1284'],
		[5410, 'key type=input char=119 key=0'],
		[5462, 'key type=input char=104 key=0'],
		[5522, 'key type=up char=0 key=87'],
		[5523, 'key type=input char=105 key=0'],
		[5591, 'key type=up char=0 key=72'],
		[5632, 'key type=up char=0 key=73'],
		[5857, 'key type=input char=108 key=0'],
		[5941, 'key type=input char=101 key=0'],
		[5990, 'key type=up char=0 key=76'],
		[6039, 'key type=input char=32 key=0'],
		[6057, 'key type=up char=0 key=69'],
		[6126, 'key type=up char=0 key=1284'],
		[6274, 'key type=input char=101 key=0'],
		[6354, 'key type=up char=0 key=69'],
		[6450, 'key type=input char=100 key=0'],
		[6563, 'key type=input char=105 key=0'],
		[6566, 'key type=up char=0 key=68'],
		[6673, 'key type=up char=0 key=73'],
		[6695, 'key type=input char=116 key=0'],
		[6794, 'key type=input char=105 key=0'],
		[6799, 'key type=up char=0 key=84'],
		[6850, 'key type=input char=110 key=0'],
		[6885, 'key type=up char=0 key=73'],
		[6970, 'key type=input char=103 key=0'],
		[6974, 'key type=up char=0 key=78'],
		[7064, 'key type=up char=0 key=71'],
		[7176, 'key type=input char=46 key=0'],
		[7297, 'key type=up char=0 key=190'],
		[7323, 'key type=input char=32 key=0'],
		[7422, 'key type=up char=0 key=1284'],
		[7580, 'key type=input char=73 key=0'],
		[7655, 'key type=up char=0 key=16'],
		[7679, 'key type=up char=0 key=73'],
		[7829, 'key type=input char=39 key=0'],
		[7875, 'key type=up char=0 key=222'],
		[7922, 'key type=input char=109 key=0'],
		[8072, 'key type=input char=32 key=0'],
		[8082, 'key type=up char=0 key=77'],
		[8169, 'key type=up char=0 key=1284'],
		[8340, 'key type=input char=116 key=0'],
		[8399, 'key type=up char=0 key=84'],
		[8503, 'key type=input char=114 key=0'],
		[8553, 'key type=input char=121 key=0'],
		[8618, 'key type=up char=0 key=82'],
		[8640, 'key type=up char=0 key=89'],
		[8773, 'key type=input char=105 key=0'],
		[8862, 'key type=input char=110 key=0'],
		[8935, 'key type=input char=103 key=0'],
		[8945, 'key type=up char=0 key=73'],
		[9019, 'key type=input char=32 key=0'],
		[9025, 'key type=up char=0 key=78'],
		[9047, 'key type=up char=0 key=71'],
		[9124, 'key type=up char=0 key=1284'],
		[9257, 'key type=input char=116 key=0'],
		[9357, 'key type=input char=111 key=0'],
		[9396, 'key type=input char=32 key=0'],
		[9397, 'key type=up char=0 key=84'],
		[9487, 'key type=up char=0 key=79'],
		[9488, 'key type=up char=0 key=1284'],
		[9646, 'key type=input char=119 key=0'],
		[9766, 'key type=up char=0 key=87'],
		[9919, 'key type=input char=114 key=0'],
		[9988, 'key type=input char=105 key=0'],
		[10024, 'key type=up char=0 key=82'],
		[10098, 'key type=up char=0 key=73'],
		[10200, 'key type=input char=116 key=0'],
		[10253, 'key type=input char=101 key=0'],
		[10334, 'key type=up char=0 key=84'],
		[10349, 'key type=input char=32 key=0'],
		[10388, 'key type=up char=0 key=69'],
		[10462, 'key type=up char=0 key=1284'],
		[10620, 'key type=input char=97 key=0'],
		[10727, 'key type=up char=0 key=65'],
		[10847, 'key type=input char=115 key=0'],
		[10953, 'key type=input char=32 key=0'],
		[10978, 'key type=up char=0 key=83'],
		[11059, 'key type=up char=0 key=1284'],
		[11262, 'key type=input char=105 key=0'],
		[11341, 'key type=input char=102 key=0'],
		[11385, 'key type=up char=0 key=73'],
		[11428, 'key type=input char=32 key=0'],
		[11454, 'key type=up char=0 key=70'],
		[11537, 'key type=up char=0 key=1284'],
		[11696, 'key type=input char=73 key=0'],
		[11797, 'key type=up char=0 key=73'],
		[11814, 'key type=up char=0 key=16'],
		[11917, 'key type=input char=39 key=0'],
		[12028, 'key type=input char=109 key=0'],
		[12034, 'key type=up char=0 key=222'],
		[12171, 'key type=up char=0 key=77'],
		[12195, 'key type=input char=32 key=0'],
		[12302, 'key type=up char=0 key=1284'],
		[12422, 'key type=input char=110 key=0'],
		[12510, 'key type=input char=111 key=0'],
		[12565, 'key type=up char=0 key=78'],
		[12631, 'key type=input char=116 key=0'],
		[12654, 'key type=up char=0 key=79'],
		[12726, 'key type=input char=32 key=0'],
		[12751, 'key type=up char=0 key=84'],
		[12830, 'key type=up char=0 key=1284'],
		[12963, 'key type=input char=101 key=0'],
		[13044, 'key type=up char=0 key=69'],
		[13176, 'key type=input char=120 key=0'],
		[13319, 'key type=up char=0 key=88'],
		[13460, 'key type=input char=112 key=0'],
		[13542, 'key type=input char=101 key=0'],
		[13606, 'key type=up char=0 key=80'],
		[13637, 'key type=up char=0 key=69'],
		[13788, 'key type=input char=99 key=0'],
		[13908, 'key type=up char=0 key=67'],
		[14061, 'key type=input char=116 key=0'],
		[14130, 'key type=input char=105 key=0'],
		[14167, 'key type=up char=0 key=84'],
		[14216, 'key type=input char=110 key=0'],
		[14272, 'key type=up char=0 key=73'],
		[14339, 'key type=input char=103 key=0'],
		[14363, 'key type=up char=0 key=78'],
		[14457, 'key type=up char=0 key=71'],
		[14500, 'key type=input char=32 key=0'],
		[14590, 'key type=up char=0 key=1284'],
		[15056, 'key type=input char=97 key=0'],
		[15139, 'key type=input char=110 key=0'],
		[15158, 'key type=up char=0 key=65'],
		[15268, 'key type=up char=0 key=78'],
		[15383, 'key type=input char=121 key=0'],
		[15503, 'key type=input char=32 key=0'],
		[15505, 'key type=up char=0 key=89'],
		[15613, 'key type=up char=0 key=1284'],
		[15769, 'key type=input char=108 key=0'],
		[15888, 'key type=input char=97 key=0'],
		[15903, 'key type=up char=0 key=76'],
		[15981, 'key type=up char=0 key=65'],
		[16148, 'key type=input char=116 key=0'],
		[16196, 'key type=input char=101 key=0'],
		[16275, 'key type=up char=0 key=84'],
		[16308, 'key type=input char=110 key=0'],
		[16341, 'key type=up char=0 key=69'],
		[16441, 'key type=up char=0 key=78'],
		[16833, 'key type=input char=99 key=0'],
		[16875, 'key type=input char=121 key=0'],
		[16948, 'key type=up char=0 key=67'],
		[16966, 'key type=up char=0 key=89'],
		[17582, 'key type=input char=32 key=0'],
		[17672, 'key type=up char=0 key=1284'],
		[17773, 'key type=input char=102 key=0'],
		[17898, 'key type=up char=0 key=70'],
		[17962, 'key type=input char=111 key=0'],
		[18102, 'key type=input char=114 key=0'],
		[18133, 'key type=up char=0 key=79'],
		[18214, 'key type=up char=0 key=82'],
		[18294, 'key type=input char=109 key=0'],
		[18423, 'key type=input char=32 key=0'],
		[18428, 'key type=up char=0 key=77'],
		[18529, 'key type=up char=0 key=1284'],
		[18563, 'key type=input char=105 key=0'],
		[18674, 'key type=up char=0 key=73'],
		[18703, 'key type=input char=116 key=0'],
		[18799, 'key type=up char=0 key=84'],
		[19067, 'key type=input char=46 key=0'],
		[19147, 'key type=up char=0 key=190'],
		[19440, 'key type=input char=32 key=0'],
		[19511, 'key type=up char=0 key=1284'],
	];
});

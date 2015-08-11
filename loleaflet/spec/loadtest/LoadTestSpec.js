describe('LoadTest', function () {
	// 25 s timeout
	this.timeout(25000);
	var testsRan = 0,
		checkTimeOut = null,
		map = null,
		docLayer = null,
		x = 0,
		y = 0;

	before(function() {
		map = L.map('map-test', {
			center: [0, 0],
			zoom: 10,
			minZoom: 1,
			maxZoom: 20,
			server: 'ws://localhost:9980',
			doubleClickZoom: false
		});
		map.on('docsize', function (e) { x = e.x; y = e.y; }, this);
	});

	var docPath = 'file:///PATH';
	var docs = ['eval.odt', 'lorem.odt'];

	docs.forEach(function (testDoc) {
		testsRan += 1;
		describe('Document #' + testsRan + ' (' + testDoc + ')', function () {

			afterEach(function () {
				map.off('statusindicator');
			});

			after(function () {
				map.socket.onmessage = function () {};
				map.socket.onclose = function () {};
				map.socket.onerror = function () {};
				map.socket.close();
			});

			it('Load the document', function (done) {
				map._initSocket();
				map.on('statusindicator', function (e) {
					if (e.statusType === 'alltilesloaded') {
						done();
					}
				});

				if (docLayer) {
					map.removeLayer(docLayer);
				}

				docLayer = new L.TileLayer('', {
					doc: docPath + testDoc,
					useSocket : true,
					edit: false,
					readOnly: false
				});

				// don't pre-fetch tiles
				docLayer._preFetchTiles = L.Util.falseFn;

				map.addLayer(docLayer);
			});

			it('Scroll to the middle', function (done) {
				map.on('statusindicator', function (e) {
					if (e.statusType === 'alltilesloaded') {
						clearTimeout(checkTimeOut);
						done();
					}
				});
				map.scrollTop(y / 2);
				checkTimeOut = setTimeout(function () {
					expect(map._docLayer._emptyTilesCount).to.eql(1);
					done();
				}, 2000);
			});

			it('Scroll to the bottom', function (done) {
				map.on('statusindicator', function (e) {
					if (e.statusType === 'alltilesloaded') {
						clearTimeout(checkTimeOut);
						done();
					}
				});
				map.scrollTop(y);
				checkTimeOut = setTimeout(function () {
					expect(map._docLayer._emptyTilesCount).to.eql(1);
					done();
				}, 2000);
			});

		});
	});
});

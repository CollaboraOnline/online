describe('LoadTest', function () {
	// 25 s timeout
	this.timeout(25000);
	// set the slow time to 5ms knowing each test takes more than that,
	// so the run time is always printed
	this.slow(5);
	var testsRan = 0,
		checkTimeOut = null,
		map = null,
		docLayer = null,
		x = 0,
		y = 0;

	before(function() {
		if (docPath === 'file:///PATH') {
			throw new Error('Document file path not set');
		}
		else if (docPath[docPath.length - 1] !== '/') {
			docPath += '/';
		}
	});

	var docPath = 'file:///PATH';
	var docs = ['eval.odt'];

	docs.forEach(function (testDoc) {
		testsRan += 1;
		describe('Document #' + testsRan + ' (' + testDoc + ')', function () {

			afterEach(function () {
				map.off('statusindicator');
			});

			after(function () {
				map.remove();
			});

			it('Load the document', function (done) {
				map = L.map('map-test', {
					server: 'ws://localhost:9980',
					doc: docPath + testDoc,
					edit: false,
					readOnly: false
				});

				map.on('statusindicator', function (e) {
					if (e.statusType === 'alltilesloaded') {
						y = map.getDocSize().y;
						done();
					}
				});
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

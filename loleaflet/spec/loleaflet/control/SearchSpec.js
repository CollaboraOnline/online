describe('Search', function () {
	this.timeout(10000);
	var map;

	before(function (done) {
		var htmlPath = window.location.pathname;
		var dir = htmlPath.substring(0, htmlPath.lastIndexOf('/'));
		var fileURL = 'file://' + dir + '/data/eval.odt';
		// initialize the map and load the document
		map = L.map('map', {
			server: 'ws://localhost:9980',
			doc: fileURL,
			edit: false,
			readOnly: false
		});

		map.once('partpagerectangles', function(e) {
			done();
		});

		setTimeout(function() {
			done(new Error('No response for partpagerectangles'));
		}, 5000);
	});

	afterEach(function () {
		map.off('statusindicator');
	});

	after(function () {
		map.remove();
	});

	describe('Load the document', function () {
		it('All tiles loaded', function (done) {
			map.on('statusindicator', function (e) {
				if (e.statusType === 'alltilesloaded') {
					done();
				}
			});
		});
	});

	describe('Search', function () {
		it('Search forward', function (done) {
			map.once('search', function (e) {
				expect(e.originalPhrase).to.be('doc');
				expect(e.count).to.be(1);
				expect(e.results[0].part).to.be(0);
				// the first page contains the search result
				expect(map.getPageSizes().pixels[0].contains(e.results[0].rectangles[0])).to.be.ok();
				done();
			});
			map.search('doc');
		});

		it('Search backward', function (done) {
			map.once('search', function (e) {
				expect(e.originalPhrase).to.be('doc');
				expect(e.count).to.be(1);
				expect(e.results[0].part).to.be(0);
				// the second page contains the search result
				expect(map.getPageSizes().pixels[1].contains(e.results[0].rectangles[0])).to.be.ok();
				done();
			});
			map.search('doc', true);
		});

		it('Search not found', function (done) {
			map.once('search', function (e) {
				expect(e.originalPhrase).to.be('something-not-found');
				expect(e.count).to.be(0);
				expect(e.results).to.be(undefined);
				done();
			});
			map.search('something-not-found', true);
		});
	});

	describe('Search all', function () {
		it('Search forward', function (done) {
			map.once('search', function (e) {
				expect(e.originalPhrase).to.be('doc');
				expect(e.count).to.be(5);
				expect(e.results.length).to.be(5);
				done();
			});
			map.searchAll('doc');
		});

		it('Search backward', function (done) {
			map.once('search', function (e) {
				expect(e.originalPhrase).to.be('doc');
				expect(e.count).to.be(5);
				expect(e.results.length).to.be(5);
				done();
			});
			map.searchAll('doc', true);
		});

		it('Search not found', function (done) {
			map.once('search', function (e) {
				expect(e.originalPhrase).to.be('something-not-found');
				expect(e.count).to.be(0);
				expect(e.results).to.be(undefined);
				done();
			});
			map.searchAll('something-not-found', true);
		});
	});
});

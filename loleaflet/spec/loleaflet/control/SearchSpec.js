/* -*- js-indent-level: 8 -*- */
describe('Search', function () {
	this.timeout(10000);
	var map;

	before(function (done) {
		var htmlPath = window.location.pathname;
		var dir = htmlPath.substring(0, htmlPath.lastIndexOf('/'));
		var fileURL = 'file://' + dir + '/data/eval.odt';
		// initialize the map and load the document
		map = L.map('map', {
			server: 'wss://localhost:9980',
			doc: fileURL,
			edit: false,
			readOnly: false
		});
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
		afterEach(function () {
			map.off('search');
		});

		it('Search forward', function (done) {
			map.once('search', function (e) {
				expect(e.originalPhrase).to.be('doc');
				expect(e.count).to.be(1);
				expect(e.results[0].part).to.be(0);
				// the first page contains the search result
				//expect(map.getPageSizes().pixels[0].contains(e.results[0].rectangles[0])).to.be.ok();
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
				//expect(map.getPageSizes().pixels[1].contains(e.results[0].rectangles[0])).to.be.ok();
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

	describe('Search with highlight all', function () {
		afterEach(function () {
			map.off('search');
		});

		it('Highlight all', function (done) {
			map.once('search', function (e) {
				expect(e.originalPhrase).to.be('doc');
				expect(e.highlightAll).to.be('true');
				expect(e.count).to.be(5);
				expect(e.results.length).to.be(5);
				// first 4 results are in first page
				for (var i = 0; i < e.count - 1; i++) {
					//expect(map.getPageSizes().pixels[0].contains(e.results[i].rectangles[0])).to.be.ok();
				}
				// last result is in second page
				//expect(map.getPageSizes().pixels[1].contains(e.results[e.count - 1].rectangles[0])).to.be.ok();
				done();
			});
			map.highlightAll('doc');
		});

		it('Search forward', function (done) {
			map.once('search', function (e) {
				expect(e.originalPhrase).to.be('doc');
				expect(e.count).to.be(1);
				expect(e.results.length).to.be(1);
				// Output of previous highlight all operation is still cached
				expect(map._docLayer._searchResults.length).to.be(5);
				// the first page contains the search result
				//expect(map.getPageSizes().pixels[0].contains(e.results[0].rectangles[0])).to.be.ok();
				done();
			});
			map.search('doc');
		});

		it('Search backward', function (done) {
			map.once('search', function (e) {
				expect(e.originalPhrase).to.be('doc');
				expect(e.count).to.be(1);
				expect(e.results.length).to.be(1);
				// Output of previous highlight all operation is still cached
				expect(map._docLayer._searchResults.length).to.be(5);
				// the second page contains the search result
				//expect(map.getPageSizes().pixels[1].contains(e.results[0].rectangles[0])).to.be.ok();
				done();
			});
			map.search('doc', true);
		});

		it('Search not found', function (done) {
			map.once('search', function (e) {
				expect(e.originalPhrase).to.be('something-not-found');
				expect(e.count).to.be(0);
				expect(e.results).to.be(undefined);
				// All cached search results from previous highlight all operations are cleared
				expect(map._docLayer._searchResults).to.be(null);
				done();
			});
			map.search('something-not-found');
		});
	});
});

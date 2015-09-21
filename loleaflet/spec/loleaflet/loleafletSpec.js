describe('LOLeaflet test', function () {
	this.timeout(10000);
	var map;
	var timeOut

	var log = function (msg) {
		// write custom log messages
		var cont = document.getElementById('mocha-report');
		var li = document.createElement('li');
		li.style.class = 'test pass';
		li.innerHTML = '<h2>' + msg + '</h2>';
		cont.appendChild(li);
	}

	before(function () {
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

		map.on('scrollto', function (e) {
			map.scrollTop(e.y);
			map.scrollLeft(e.x);
		});
	});

	afterEach(function () {
		map.off('statusindicator');
	});

	after(function () {
		map.remove();
	});

	describe('', function () {
		it('Load all new tiles', function (done) {
			map.on('statusindicator', function (e) {
				if (e.statusType === 'alltilesloaded') {
					done();
				}
			});
		});

		it('Set permission to "readonly"', function (done) {
			map.once('updatepermission', function (e) {
				expect(e.perm).to.be('readonly');
				done();
			});
			map.setPermission('readonly');
		});

		it('Set permission to "edit"', function (done) {
			map.once('updatepermission', function (e) {
				expect(e.perm).to.be('edit');
				done();
			});
			map.setPermission('edit');
		});

		it('Set permission to "view"', function (done) {
			map.once('updatepermission', function (e) {
				expect(e.perm).to.be('view');
				done();
			});
			map.setPermission('view');
		});

		it('Place the coursor by clicking', function () {
			map._docLayer._postMouseEvent('buttondown', 2500, 3515, 1);
			map._docLayer._postMouseEvent('buttonup', 2500, 3515, 1);
			map.setPermission('edit');
		});

		it('Make a word Bold', function (done) {
			map.once('commandstatechanged', function (e) {
				expect(e.commandName).to.be('.uno:Bold');
				expect(e.state).to.be('false');
				done();
			});
			map.toggleCommandState('Bold')
		});

		it('Get document size', function () {
			var size = map.getDocSize();
			expect(Math.round(size.x)).to.be(1064);
			expect(Math.round(size.y)).to.be(2946);
		});

		it('Get document type', function () {
			expect(map.getDocType()).to.be('text');
		});

		it('Check pages', function () {
			expect(map.getNumberOfPages()).to.be(2);
			expect(map.getNumberOfParts()).to.be(1);
			expect(map.getCurrentPageNumber()).to.be(0);
		});

		it('Go to the next page', function (done) {
			map.once('pagenumberchanged', function (e) {
				expect(e.currentPage).to.be(1);
				expect(e.pages).to.be(2);
				expect(e.docType).to.be('text');
				done();
			});
			map.goToPage(1);
		});

		it('Search backwards', function (done) {
			map.once('scrollto', function (e) {
				expect(e.x).to.be(0);
				expect(e.y).to.be(174);
				//expect(e.y).to.be(2321);
				done();
			});
			map.search('document', true);
		});

		it('Search not found', function (done) {
			map.once('search', function (e) {
				expect(e.originalPhrase).to.be('something-not-found');
				expect(e.count).to.be(0);
				done();
			});
			map.search('something-not-found');
		});


		it('Scroll to the top', function (done) {
			map.once('updatescrolloffset', function (e) {
				expect(e.x).to.be(0);
				expect(e.y).to.be(0);
				done();
			});
			map.scrollTop(0, {update: true});
		});

		it('Scroll to the middle', function (done) {
			var size = map.getDocSize();
			var x = Math.round(size.x / 2);
			var y = Math.round(size.y / 2);
			map.once('updatescrolloffset', function (e) {
				expect(e.x).to.be(0);
				expect(e.y).to.be(y);
				done();
			});
			map.scroll(x, y, {update: true});
		});

		it('Check if pre-fetching works', function (done) {
			// clear the tiles
			map._docLayer._tiles = {};
			map._docLayer._resetPreFetching(true);

			this.timeout(7000);
			// tiles are pre-fetched after 6seconds
			setTimeout(function () {
				expect(Object.keys(map._docLayer._tiles).length).to.be.above(5);
				done();
			}, 6000);
		});
	});
});

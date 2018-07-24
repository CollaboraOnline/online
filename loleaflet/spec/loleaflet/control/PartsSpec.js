/* -*- js-indent-level: 8 -*- */
describe('Parts and Pages', function () {
	this.timeout(10000);
	var map;

	before(function () {
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

	describe('Document preview', function () {
		it('Page preview', function (done) {
			map.once('tilepreview', function (e) {
				expect(e.id).to.be('1');
				expect(e.width).to.be.within(0, 100);
				expect(e.height).to.be.within(0, 200);
				expect(e.part).to.be(0);
				expect(e.docType).to.be('text');
				done();
			});
			map.getPreview(1, 0, 100, 200, {autoUpdate: true});
		});

		it('Page custom preview', function (done) {
			map.once('tilepreview', function (e) {
				expect(e.id).to.be('2');
				expect(e.width).to.be(100);
				expect(e.height).to.be(200);
				expect(e.part).to.be(0);
				expect(e.docType).to.be('text');
				done();
			});
			map.getCustomPreview(2, 0, 100, 200, 0, 0, 3840, 7680, {autoUpdate: true});
		});


		it('Automatic preview invalidation', function (done) {
			var count = 0;
			map.on('tilepreview', function (e) {
				if (e.id === '1' || e.id === '2') {
					count += 1;
				}
				if (count === 2) {
					// as we have 2 previews
					map.off('tilepreview');
					done();
				}
			});
			map._socket.sendMessage('uno .uno:LeftPara');
		});

		it('Remove the first preview', function (done) {
			map.once('tilepreview', function (e) {
				expect(e.id).to.be('2');
				map.removePreviewUpdate(2);
				done();
			});
			map.removePreviewUpdate(1);
			map._socket.sendMessage('uno .uno:CenterPara');
		});
	});

	describe('Page navigation', function () {
		it('Get current page number', function () {
			expect(map.getCurrentPageNumber()).to.be(0);
		});

		it('Go to the second page', function (done) {
			map.once('updatescrolloffset', function (e) {
				expect(e.y).to.be.above(1000);
				done();
			});
			map.goToPage(1);
		});

		it('Go to the first page by following the cursor', function (done) {
			map.once('scrollto', function (e) {
				expect(e.y).to.be(0);
				done();
			});
			map.once('updatepermission', function (e) {
				if (e.perm === 'edit') {
					map.goToPage(0);
				}
			});
			map.setPermission('edit');
		});


		it('Scroll to the first page', function (done) {
			map.once('pagenumberchanged', function (e) {
				expect(e.currentPage).to.be(0);
				expect(e.pages).to.be(2);
				expect(e.docType).to.be('text');
				done();
			});
			map.scrollTop(0);
		});
	});

	describe('Doc stats', function () {
		it('Get number of pages', function () {
			expect(map.getNumberOfPages()).to.be(2);
		});

		it('Get number of parts', function () {
			expect(map.getNumberOfParts()).to.be(1);
		});

		it('Get current page number', function () {
			expect(map.getCurrentPageNumber()).to.be(0);
		});

		it('Get current part number', function () {
			expect(map.getCurrentPartNumber()).to.be(0);
		});

		it('Get document size', function () {
			expect(Math.floor(map.getDocSize().x)).to.be(1064);
			expect(Math.floor(map.getDocSize().y)).to.be(2946);
		});

		it('Get document type', function () {
			expect(map.getDocType()).to.be('text');
		});
	});
});

/* -*- js-indent-level: 8 -*- */
describe('Toolbar', function () {
	this.timeout(10000);
	var map;
	var url;

	before(function () {
		var htmlPath = window.location.pathname;
		var dir = htmlPath.substring(0, htmlPath.lastIndexOf('/'));
		var fileURL = 'file://' + dir + '/data/eval.odt';
		// initialize the map and load the document
		map = L.map('map', {
			server: 'wss://localhost:9980',
			doc: fileURL,
			edit: false,
			readOnly: false,
			print: false
		});
	});

	afterEach(function () {
		map.off('statusindicator');
	});

	after(function () {
		map.remove();
	});

	describe('Load the document', function () {
		it('Loleaflet initialized', function (done) {
			map.on('statusindicator', function (e) {
				if (e.statusType === 'loleafletloaded') {
					done();
				}
			});
		});
	});

	describe('Download as', function () {
		it('Request pdf export url', function (done) {
			map.once('print', function (e) {
				console.log(e.url);
				url = e.url;
				console.log(url);
				done();
			});
			map.downloadAs('test.pdf', 'pdf', null, 'print');
		});

		it('Download the pdf export', function (done) {
			var xmlHttp = new XMLHttpRequest();
			xmlHttp.onreadystatechange = function () {
				if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
					done();
				}
			};
			xmlHttp.open('GET', url, true);
			xmlHttp.responseType = 'blob';
			xmlHttp.send();
		});
	});
});

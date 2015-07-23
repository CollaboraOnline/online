describe('TileBench', function () {
	// 20 s timeout
	this.timeout(20000);
	var map;
	var loadCount = 0;

	var log = function (msg) {
		// write custom log messages
		var cont = document.getElementById('mocha-report');
		var li = document.createElement('li');
		li.style.class = 'test pass';
		li.innerHTML = '<h2>' + msg + '</h2>';
		cont.appendChild(li);
	}

	before(function () {
		// initialize the map and load the document
		map = L.map('map', 'scroll-container', 'mock-document', {
			center: [0, 0],
			zoom: 10,
			minZoom: 1,
			maxZoom: 20,
			server: 'ws://localhost:9980',
			doubleClickZoom: false
		});

		var docLayer = new L.TileLayer('', {
			doc: 'file:///home/mihai/Desktop/test_docs/eval.odt',
			useSocket : true,
			edit: false,
			readOnly: false
		});
		map.addLayer(docLayer);

		////// Scrollbar /////
		(function($){
				$("#scroll-container").mCustomScrollbar({
					axis: 'yx',
					theme: 'dark-thick',
					scrollInertia: 0,
					callbacks:{
						onScroll: function(){
							docLayer._onScrollEnd(this);
						},
						whileScrolling: function(){
							docLayer._onScroll(this);
						},
						alwaysTriggerOffsets:false
					}
				});
		})(jQuery);
	});

	afterEach(function () {
		map.off('alltilesloaded');
	});

	after(function () {
		map.socket.onclose = undefined;
		map.socket.onerror = undefined;
		map.socket.close();
	});

	describe('Benchmarking', function () {
		it('Load all new tiles', function (done) {
			map.on('alltilesloaded', L.bind(function () {
				loadCount += 1;
				console.log(loadCount);
				done();
			}, done));

		});

		it('Scroll to the bottom', function (done) {
			$('#scroll-container').mCustomScrollbar('scrollTo', 'bottom', {scrollInertia: 3000});
			// check how we're doing 200ms after the scroll has ended
			// (allow enough time to request new tiles)
			this.timeOut = setTimeout(L.bind(function () {
				if (map._docLayer._emptyTilesCount === 0) {
					// no pending tile requests
					done();
				}
				else {
					map.on('alltilesloaded', L.bind(function () {
						loadCount += 1;
						clearTimeout(this.timeOut);
						done();
					}, done));
				}
			}, done), 3200);
		});
	});
});

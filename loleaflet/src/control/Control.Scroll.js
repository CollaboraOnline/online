/*
 * L.Control.Scroll handles scrollbars
 */

L.Control.Scroll = L.Control.extend({

	onAdd: function (map) {
		this._scrollContainer = L.DomUtil.create('div', 'scroll-container', map._container.parentElement);
		this._mockDoc = L.DomUtil.create('div', '', this._scrollContainer);
		this._mockDoc.id = 'mock-doc';

		map.on('scrollto', this._onScrollTo, this);
		map.on('scrollby', this._onScrollBy, this);
		map.on('scrollvelocity', this._onScrollVelocity, this);
		map.on('docsize', this._onUpdateSize, this);
		map.on('updatescrolloffset', this._onUpdateScrollOffset, this);

		var control = this;
		$('.scroll-container').mCustomScrollbar({
			axis: 'yx',
			theme: 'dark-thick',
			scrollInertia: 0,
			callbacks:{
				onScroll: function() {
					control._onScrollEnd(this);
				},
				whileScrolling: function() {
					control._onScroll(this);
				},
				alwaysTriggerOffsets: false
			}
		});
		return document.createElement('div');
	},

	_onScroll: function (e) {
		if (this._ignoreScroll) {
			return;
		}
		if (this._prevScrollY === undefined) {
			this._prevScrollY = 0;
		}
		if (this._prevScrollX === undefined) {
			this._prevScrollX = 0;
		}
		var offset = new L.Point(
				-e.mcs.left - this._prevScrollX,
				-e.mcs.top - this._prevScrollY);

		if (!offset.equals(new L.Point(0, 0))) {
			this._prevScrollY = -e.mcs.top;
			this._prevScrollX = -e.mcs.left;
			this._map.scroll(offset.x, offset.y);
		}
	},

	_onScrollEnd: function (e) {
		this._prevScrollY = -e.mcs.top;
		this._prevScrollX = -e.mcs.left;
	},

	_onScrollTo: function (e) {
		// triggered by the document (e.g. search result out of the viewing area)
		$('.scroll-container').mCustomScrollbar('scrollTo', [e.y, e.x]);
	},

	_onScrollBy: function (e) {
		e.y *= (-1);
		var y = '+=' + e.y;
		if (e.y < 0) {
			y = '-=' + Math.abs(e.y);
		}
		e.x *= (-1);
		var x = '+=' + e.x;
		if (e.x < 0) {
			x = '-=' + Math.abs(e.x);
		}
		$('.scroll-container').mCustomScrollbar('scrollTo', [y, x]);
	},

	_onScrollVelocity: function (e) {
		if (e.vx == 0 && e.vy == 0) {
			clearInterval(this._autoScrollTimer);
			this._autoScrollTimer = null;
			this._map.isAutoScrolling = false;
		} else {
			clearInterval(this._autoScrollTimer);
			this._map.isAutoScrolling = true;
			this._autoScrollTimer = setInterval(L.bind(function() {
				this._onScrollBy({x: e.vx, y: e.vy});
			}, this), 100);
		}
	},

	_onUpdateSize: function (e) {
		this._ignoreScroll = true;
		setTimeout(L.bind(function() {this._ignoreScroll = null;}, this), 200);
		L.DomUtil.setStyle(this._mockDoc, 'width', e.x + 'px');
		L.DomUtil.setStyle(this._mockDoc, 'height', e.y + 'px');
	},

	_onUpdateScrollOffset: function (e) {
		this._ignoreScroll = null;
		$('.scroll-container').mCustomScrollbar('stop');
		this._prevScrollY = e.y;
		this._prevScrollX = e.x;
		$('.scroll-container').mCustomScrollbar('scrollTo', [e.y, e.x], {callbacks: false, timeout:0});
	}
});

L.control.scroll = function (options) {
	return new L.Control.Scroll(options);
};

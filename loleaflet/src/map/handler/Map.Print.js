/*
 * L.Map.Print is handling the print action
 */

L.Map.mergeOptions({
	printHandler: true
});

L.Map.Print = L.Handler.extend({

	initialize: function (map) {
		this._map = map;
	},

	addHooks: function () {
		this._map.on('filedownloadready', this._onFileReady, this);
	},

	removeHooks: function () {
		this._map.off('filedownloadready', this._onFileReady, this);
	},

	_onFileReady: function (e) {
		// we need to load the pdf document and pass it to the iframe as an
		// object URL, because else we might have cross origin security problems
		var xmlHttp = new XMLHttpRequest();
		xmlHttp.onreadystatechange = L.bind(function () {
			if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
				this._onInitPrint(xmlHttp);
			}
		}, this);
		xmlHttp.open('GET', e.url, true);
		xmlHttp.responseType = 'blob';
		xmlHttp.send();
	},

	_onInitPrint: function (e) {
		var blob = new Blob([e.response], {type: 'application/pdf'});
		var url = URL.createObjectURL(blob);
		this._printIframe = L.DomUtil.create('iframe', '', document.body);
		this._printIframe.onload = L.bind(this._onIframeLoaded, this);
		L.DomUtil.setStyle(this._printIframe, 'visibility', 'hidden');
		L.DomUtil.setStyle(this._printIframe, 'position', 'fixed');
		L.DomUtil.setStyle(this._printIframe, 'right', '0');
		L.DomUtil.setStyle(this._printIframe, 'bottom', '0');
		this._printIframe.src = url;
	},

	_onIframeLoaded: function () {
		this._printIframe.contentWindow.focus(); // Required for IE
		this._printIframe.contentWindow.print();
		// couldn't find another way to remove it
		setTimeout(L.bind(this._closePrintIframe, this, this._printIframe), 300 * 1000);
	},

	_closePrintIframe: function (printIframe) {
		L.DomUtil.remove(printIframe);
		this._map.focus();
	}
});

L.Map.addInitHook('addHandler', 'printHandler', L.Map.Print);

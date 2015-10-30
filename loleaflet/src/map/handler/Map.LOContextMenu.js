/*
 * L.Map.ContextMenu handles any document-related context menus
 */

L.Map.mergeOptions({
	contextmenu: true, // enables contextmenu plugin
	locontextmenu: true, // enables our internal contextmenu
	contextmenuWidth: 140,
	contextmenuItems: [{
		text: 'Copy',
		callback: function (e) { 
			this.locontextmenu.menuCopy(e);
		}
	},
	'-',
	{
		text: 'Paste',
		callback: function (e) { 
			this.locontextmenu.menuPaste(e);
			
		}
	}]
});

L.Map.LOContextMenu = L.Handler.extend({

	menuCopy: function(e) {
		window.getSelection().removeAllRanges();
		var hidden = L.DomUtil.create('div', 'hidden-clipboard');
		hidden.textContent = decodeURIComponent(escape(this._map._docLayer._selectionTextContent));
		this._map._container.appendChild(hidden);
		var range = document.createRange();
		range.selectNode(hidden);
		window.getSelection().addRange(range);

		document.execCommand('copy');

		window.getSelection().removeAllRanges();
		this._map._container.removeChild(hidden);
	},
	
	menuPaste: function(e) {
		// THIS DOESN'T WORK
		// execCommand('paste') isn't supported by most (all?) browsers
		// We most likely can't actually access the clipboard.
		var hidden = L.DomUtil.create('div', 'hidden-clipboard');
		this._map._container.appendChild(hidden);
		var range = document.createRange();
		range.selectNode(hidden);
		window.getSelection().addRange(range);
		hidden.focus();

		document.execCommand('paste');

		if (hidden.textContent && hidden.textContent.length > 0) {
			L.Socket.sendMessage('paste mimetype=text/plain;charset=utf-8 data=' + hidden.textContent);
		}

		window.getSelection().removeAllRanges();
		this._map._container.removeChild(hidden);
	},

	initialize: function (map) {
		this._map = map;
	},

	addHooks: function () {
		this._map.on('contextmenu',
			this._onContextMenu, this);
	},

	removeHooks: function () {
		this._map.off('contextmenu',
			this._onContextMenu, this);
	},

	_onContextMenu: function (e) {
		this._map.contextmenu.showAt(e.latlng, {});
	},
});

L.Map.addInitHook('addHandler', 'locontextmenu', L.Map.LOContextMenu);

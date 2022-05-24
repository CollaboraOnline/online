/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.AutofilterDropdown
 */

/* global app $ */
L.Control.AutofilterDropdown = L.Control.extend({
	container: null,
	subMenu: null,
	builder: null,
	subMenuBuilder: null,
	position: {x: 0, y: 0},

	onAdd: function (map) {
		this.map = map;

		this.map.on('autofilterdropdown', this.onAutofilterDropdown, this);
		this.map.on('closepopup', this.onClosePopup, this);
		this.map.on('closepopups', this.onClosePopup, this);
		L.DomEvent.on(this.map, 'mouseup', this.onClosePopup, this);
		this.map.on('jsdialogupdate', this.onJSUpdate, this);

		this.builder = new L.control.jsDialogBuilder({mobileWizard: this, map: this.map, cssClass: 'autofilter jsdialog'});
		this.subMenuBuilder = new L.control.jsDialogBuilder({mobileWizard: this, map: this.map, cssClass: 'autofilter jsdialog'});
	},

	onRemove: function() {
		this.map.off('autofilterdropdown', this.onAutofilterDropdown, this);
		this.map.off('closepopup', this.onClosePopup, this);
		this.map.off('closepopups', this.onClosePopup, this);
		L.DomEvent.off(this.map, 'mouseup', this.onClosePopup, this);
		this.map.off('jsdialogupdate', this.onJSUpdate, this);
	},

	countVisible: function(elements) {
		var count = 0;
		for (var i in elements) {
			if (elements[i].visible !== false)
				count++;
		}
		return count;
	},

	removeSubMenuData: function(data) {
		if (data.children && data.children.length !== 1) {
			for (var i in data.children) {
				if (data.children[i].type === 'dockingwindow') {
					data.children.splice(i);
				}
			}
		}
	},

	onAutofilterDropdown: function(data) {
		this.removeSubMenuData(data);

		var hasElements = data.children && data.children.length && data.children[0].children &&
			data.children[0].children.length;
		var visibleElements = hasElements ? this.countVisible(data.children[0].children[0].children) : 0;

		var isSubMenu = visibleElements < 3;

		if (!isSubMenu && this.container) {
			L.DomUtil.remove(this.container);
			L.DomUtil.remove(this.subMenu);
			this.container = null;
			this.subMenu = null;
		} else if (isSubMenu && this.subMenu) {
			L.DomUtil.remove(this.subMenu);
			this.subMenu = null;
		}

		if (data.action === 'close') {
			L.DomUtil.remove(this.container);
			L.DomUtil.remove(this.subMenu);
			this.container = null;
			this.subMenu = null;

			this.builder.setWindowId(null);
			this.subMenuBuilder.setWindowId(null);

			this.map.focus();
			return;
		}

		if (!isSubMenu && this.subMenu)
			L.DomUtil.remove(this.subMenu);

		// only difference is when file is RTL not UI
		// var isViewRTL = document.documentElement.dir === 'rtl';
		var isSpreadsheetRTL = this._map._docLayer.isCalcRTL();

		var scale = this._map.zoomToFactor(this._map.getZoom());
		var origin = this._map.getPixelOrigin();
		var panePos = this._map._getMapPanePos();

		var offsetX = isSpreadsheetRTL ? 0 : app.sectionContainer.getSectionWithName(L.CSections.RowHeader.name).size[0];
		var offsetY = app.sectionContainer.getSectionWithName(L.CSections.ColumnHeader.name).size[1];

		var left = parseInt(data.posx) * scale;
		var top = parseInt(data.posy) * scale;

		if (left < 0)
			left = -1 * left;

		var splitPanesContext = this._map.getSplitPanesContext();
		var splitPos = new L.Point(0, 0);

		if (splitPanesContext)
			splitPos = splitPanesContext.getSplitPos();

		var newLeft = left + panePos.x - origin.x;
		if (left >= splitPos.x && newLeft >= 0)
			left = newLeft;

		var newTop = top + panePos.y - origin.y;
		if (top >= splitPos.y && newTop >= 0)
			top = newTop;

		if (isSpreadsheetRTL)
			left = this._map._size.x - left;

		left = left + offsetX;
		top = top + offsetY;

		var mainContainer = null;
		var builder = null;
		if (isSubMenu) {
			this.subMenu = L.DomUtil.create('div', 'autofilter-container-submenu');
			this.subMenu.id = data.id;
			this.container.parentNode.insertBefore(this.subMenu, this.container.nextSibling);

			var innerContainer = L.DomUtil.create('div', 'autofilter-container', this.subMenu);
			mainContainer = innerContainer;

			left = this.position.x + this.container.offsetWidth - 30;
			top = this.position.y + 50;

			if (data.visible === 'false' || data.visible === false)
				$(this.subMenu).hide();

			this.subMenuBuilder.setWindowId(data.id);
			builder = this.subMenuBuilder;
		} else {
			this.container = L.DomUtil.create('div', 'autofilter-container', $('#document-container').get(0));
			this.container.id = data.id;
			mainContainer = this.container;

			this.position.x = left;
			this.position.y = top;

			this.builder.setWindowId(data.id);
			builder = this.builder;
		}

		L.DomUtil.setStyle(mainContainer, 'margin-left', left + 'px');
		L.DomUtil.setStyle(mainContainer, 'margin-top', top + 'px');

		builder.build(mainContainer, [data]);
		mainContainer.firstChild.dir = document.documentElement.dir;

		var height = $(mainContainer).height();
		if (top + height > $('#document-container').height()) {
			var newTopPosition = top - height;
			if (newTopPosition < 0)
				newTopPosition = 0;
			L.DomUtil.setStyle(mainContainer, 'margin-top', newTopPosition + 'px');
			this.position.y = newTopPosition;
		}

		var width = $(mainContainer).width();
		if (left + width > $('#document-container').width()) {
			var newLeftPosition = left - width;
			if (newTopPosition < 0)
				newTopPosition = 0;
			L.DomUtil.setStyle(mainContainer, 'margin-left', newLeftPosition + 'px');
			this.position.x = newLeftPosition;
		}

		var okButton = mainContainer.querySelector('#ok');
		if (okButton)
			okButton.focus();

		// close when focus goes out using 'tab' key
		var that = this;

		var beginMarker = L.DomUtil.create('div', 'jsdialog autofilter jsdialog-begin-marker');
		var endMarker = L.DomUtil.create('div', 'jsdialog autofilter jsdialog-end-marker');

		beginMarker.tabIndex = 0;
		endMarker.tabIndex = 0;

		mainContainer.insertBefore(beginMarker, mainContainer.firstChild);
		mainContainer.appendChild(endMarker);

		mainContainer.addEventListener('focusin', function(event) {
			if (event.target == beginMarker || event.target == endMarker)
				that.onClosePopup();
		});
	},

	onJSUpdate: function (e) {
		var data = e.data;

		if (data.jsontype !== 'autofilter')
			return;

		if (!this.container)
			return;

		var targetWindow = null;
		var builder = null;
		if (this.container && this.container.id == data.id) {
			targetWindow = this.container;
			builder = this.builder;
		} else if (this.subMenu && this.subMenu.id == data.id) {
			targetWindow = this.subMenu;
			builder = this.subMenuBuilder;
		}

		if (!targetWindow)
			return;

		var control = targetWindow.querySelector('#' + data.control.id);
		if (!control)
			return;

		var parent = control.parentNode;
		if (!parent)
			return;

		var scrollTop = control.scrollTop;
		control.style.visibility = 'hidden';
		builder.build(parent, [data.control], false);
		L.DomUtil.remove(control);

		var newControl = targetWindow.querySelector('#' + data.control.id);
		newControl.scrollTop = scrollTop;
	},

	onClosePopup: function() {
		if (this.builder.windowId)
			this.builder.callback('pushbutton', 'click', {id: 'cancel'}, null, this.builder);
	}
});

L.control.autofilterDropdown = function (options) {
	return new L.Control.AutofilterDropdown(options);
};

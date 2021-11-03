/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.AutofilterDropdown
 */

/* global $ */
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

		this.builder = new L.control.jsDialogBuilder({mobileWizard: this, map: this.map, cssClass: 'autofilter'});
		this.subMenuBuilder = new L.control.jsDialogBuilder({mobileWizard: this, map: this.map, cssClass: 'autofilter'});
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
			return;
		}

		if (!isSubMenu && this.subMenu)
			L.DomUtil.remove(this.subMenu);

		var scale = this._map.getZoomScale(this._map.getZoom(), this._map.options.defaultZoom);
		var origin = this._map.getPixelOrigin();
		var panePos = this._map._getMapPanePos();
		var cursorPos = this._map._docLayer.getCursorPos();

		// autofilter docking window position is relative to the main window
		// we have to take into account calc input bar and notebookbar height (where spreadsheet starts)
		// best to base on input bar position and size (it can be also expanded)
		var spreadsheetAreaOffset = new L.Point(35, 75); // in classic toolbar mode

		var calcInputBar = this._map.dialog._calcInputBar;
		var offsetX = spreadsheetAreaOffset.x;
		var offsetY = calcInputBar ?
			(spreadsheetAreaOffset.y + (calcInputBar.top - 28) + (calcInputBar.height - 29))
			: spreadsheetAreaOffset.y;

		if (parseInt(data.posx) === 0 && parseInt(data.posy) === 0)
			var corePoint = new L.Point(this.position.x, this.position.y);
		else
			corePoint = new L.Point(parseInt(data.posx) - offsetX, parseInt(data.posy) - offsetY);

		var left = corePoint.x * scale;
		var top = corePoint.y * scale;

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

		// some documents with split panes have coordinates increased by split position...
		if (left >= L.Map.THIS._docLayer._painter._sectionContainer.getSectionWithName(L.CSections.ColumnHeader.name).size[0]) {
			if (cursorPos.x >= splitPos.x && left >= splitPos.x)
				left = left - splitPos.x;

			if (cursorPos.y >= splitPos.y && top >= splitPos.y)
				top = top - splitPos.y;
		}

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
		if (this.container)
			L.DomUtil.remove(this.container);
		if (this.subMenu)
			L.DomUtil.remove(this.subMenu);

		this.container = null;
		this.subMenu = null;

		if (this.builder.windowId)
			this.builder.callback('button', 'click', {id: 'cancel'}, null, this.builder);
		this.builder.setWindowId(null);
		this.subMenuBuilder.setWindowId(null);
	}
});

L.control.autofilterDropdown = function (options) {
	return new L.Control.AutofilterDropdown(options);
};
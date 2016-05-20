/*
* Control.Menubar
*/

/* global $ _ map */
L.Control.menubar = L.Control.extend({
	options: {
		text:  [
			{name: 'File', type: 'menu', menu: [{name: 'Save', type: 'unocommand', uno: '.uno:Save'},
												{name: 'Print', id: 'print', type: 'action'},
												{name: 'Download as', type: 'menu', menu: [{name: 'PDF Document (.pdf)', id: 'downloadas-pdf', type: 'action'},
																						   {name: 'ODF text document (.odt)', id: 'downloadas-odt', type: 'action'},
																						   {name: 'Microsoft Word 2003 (.doc)', id: 'downloadas-doc', type: 'action'},
																						   {name: 'Microsoft Word (.docx)', id: 'downloadas-docx', type: 'action'}]}]
			},
			{name: 'Edit', type: 'menu', menu: [{name: 'Undo', type: 'unocommand', uno: '.uno:Undo'},
												{name: 'Redo', type: 'unocommand', uno: '.uno:Redo'},
												{type: 'separator'},
												{name: 'Cut', type: 'unocommand', uno: '.uno:Cut'},
												{name: 'Copy', type: 'unocommand', uno: '.uno:Copy'},
												{name: 'Paste', type: 'unocommand', uno: '.uno:Paste'},
												{type: 'separator'},
												{name: 'Select All', type: 'unocommand', uno: '.uno:SelectAll'}]
			},
			{name: 'Insert', type: 'menu', menu: [{name: 'Image', id: 'insertgraphic', type: 'action'},
												  {name: 'Comment', type: 'unocommand', uno: '.uno:InsertAnnotation'}]
			},
			{name: 'View', type: 'menu', menu: [{name: 'Full screen', id: 'fullscreen', type: 'action'},
												{type: 'separator'},
												{name: 'Zoom in', id: 'zoomin', type: 'action'},
												{name: 'Zoom out', id: 'zoomout', type: 'action'},
												{name: 'Zoom reset', id: 'zoomreset', type: 'action'}]
			},
			{name: 'Tables', type: 'menu', menu: [{name: 'Insert row before', type: 'unocommand', uno: '.uno:InsertRowsBefore'},
												  {name: 'Insert row after', type: 'unocommand', uno: '.uno:InsertRowsAfter'},
												  {type: 'separator'},
												  {name: 'Insert column before', type: 'unocommand', uno: '.uno:InsertColumnsBefore'},
												  {name: 'Insert column after', type: 'unocommand', uno: '.uno:InsertColumnsAfter'},
												  {type: 'separator'},
												  {name: 'Delete row', type: 'unocommand', uno: '.uno:DeleteRows'},
												  {name: 'Delete column', type: 'unocommand', uno: '.uno:DeleteColumns'},
												  {name: 'Delete table', type: 'unocommand', uno: '.uno:DeleteTable'},
												  {type: 'separator'},
												  {name: 'Merge cells', type: 'unocommand', uno: '.uno:MergeCells'}]
			}
		],

		presentation: [
			{name: 'File', type: 'menu', menu: [{name: 'Save', type: 'unocommand', uno: '.uno:Save'},
												{name: 'Print', id: 'print', type: 'action'},
												{name: 'Download as', type: 'menu', menu:  [{name: 'PDF Document (.pdf)', id: 'downloadas-pdf', type: 'action'},
																							{name: 'ODF presentation (.odp)', id: 'downloadas-odp', type: 'action'},
																							{name: 'Microsoft Powerpoint 2003 (.ppt)', id: 'downloadas-ppt', type: 'action'},
																							{name: 'Microsoft Powerpoint (.pptx)', id: 'downloadas-pptx', type: 'action'}]}]
			},
			{name: 'Edit', type: 'menu', menu: [{name: 'Undo', type: 'unocommand', uno: '.uno:Undo'},
												{name: 'Redo', type: 'unocommand', uno: '.uno:Redo'},
												{type: 'separator'},
												{name: 'Cut', type: 'unocommand', uno: '.uno:Cut'},
												{name: 'Copy', type: 'unocommand', uno: '.uno:Copy'},
												{name: 'Paste', type: 'unocommand', uno: '.uno:Paste'},
												{type: 'separator'},
												{name: 'Select All', type: 'unocommand', uno: '.uno:SelectAll'}]
			},
			{name: 'Insert', type: 'menu', menu: [{name: 'Image', id: 'insertgraphic', type: 'action'}]
			},
			{name: 'View', type: 'menu', menu: [{name: 'Full Screen', id: 'fullscreen', type: 'action'},
												{type: 'separator'},
												{name: 'Zoom in', id: 'zoomin', type: 'action'},
												{name: 'Zoom out', id: 'zoomout', type: 'action'},
												{name: 'Zoom reset', id: 'zoomreset', type: 'action'}]
			},
			{name: 'Tables', type: 'menu', menu: [{name: 'Insert row before', type: 'unocommand', uno: '.uno:InsertRowsBefore'},
												  {name: 'Insert row after', type: 'unocommand', uno: '.uno:InsertRowsAfter'},
												  {type: 'separator'},
												  {name: 'Insert column before', type: 'unocommand', uno: '.uno:InsertColumnsBefore'},
												  {name: 'Insert column after', type: 'unocommand', uno: '.uno:InsertColumnsAfter'},
												  {type: 'separator'},
												  {name: 'Delete row', type: 'unocommand', uno: '.uno:DeleteRows'},
												  {name: 'Delete column', type: 'unocommand', uno: '.uno:DeleteColumns'},
												  {name: 'Delete table', type: 'unocommand', uno: '.uno:DeleteTable'},
												  {type: 'separator'},
												  {name: 'Merge cells', type: 'unocommand', uno: '.uno:MergeCells'}]
			},
			{name: 'Slide', type: 'menu', menu: [{name: 'New slide', id: 'insertpage', type: 'action'},
												 {name: 'Duplicate slide', id: 'duplicatepage', type: 'action'},
												 {name: 'Delete slide', id: 'deletepage', type: 'action'},
												 {type: 'separator'},
												 {name: 'Fullscreen Presentation', id: 'fullscreen-presentation', type: 'action'}]
			}
		],

		spreadsheet: [
			{name: 'File', type: 'menu', menu: [{name: 'Save', type: 'unocommand', uno: '.uno:Save'},
												{name: 'Print', id: 'print', type: 'action'},
												{name: 'Download as', type: 'menu', menu: [{name: 'PDF Document (.pdf)', id: 'downloadas-pdf', type: 'action'},
																						   {name: 'ODF spreadsheet (.ods)', id: 'downloadas-ods', type: 'action'},
																						   {name: 'Microsoft Excel 2003 (.xls)', id: 'downloadas-xls', type: 'action'},
																						   {name: 'Microsoft Excel (.xlsx)', id: 'downloadas-xlsx', type: 'action'}]}]
			},
			{name: 'Edit', type: 'menu', menu: [{name: 'Undo', type: 'unocommand', uno: '.uno:Undo'},
												{name: 'Redo', type: 'unocommand', uno: '.uno:Redo'},
												{type: 'separator'},
												{name: 'Cut', type: 'unocommand', uno: '.uno:Cut'},
												{name: 'Copy', type: 'unocommand', uno: '.uno:Copy'},
												{name: 'Paste', type: 'unocommand', uno: '.uno:Paste'},
												{type: 'separator'},
												{name: 'Select All', type: 'unocommand', uno: '.uno:SelectAll'}]
			},
			{name: 'Insert', type: 'menu', menu: [{name: 'Image', id: 'insertgraphic', type: 'action'},
												  {type: 'separator'},
												  {name: 'Row above', type: 'unocommand', uno: '.uno:InsertRows'},
												  {name: 'Column before', type: 'unocommand', uno: '.uno:InsertColumns'},
												  {type: 'separator'},
												  {name: 'Delete row', type: 'unocommand', uno: '.uno:DeleteRows'},
												  {name: 'Delete column', type: 'unocommand', uno: '.uno:DeleteColumns'}]
			},
			{name: 'View', type: 'menu', menu: [{name: 'Full Screen', id: 'fullscreen', type: 'action'},
												{type: 'separator'},
												{name: 'Zoom in', id: 'zoomin', type: 'action'},
												{name: 'Zoom out', id: 'zoomout', type: 'action'},
												{name: 'Zoom reset', id: 'zoomreset', type: 'action'}]
			}
		],

		commandStates: {}
	},

	onAdd: function (map) {
		this._initialized = false;
		var docContainer = map.options.documentContainer;
		this._menubarCont = L.DomUtil.create('ul', 'sm sm-simple', docContainer.parentElement);
		this._menubarCont.id = 'main-menu';

		map.on('updatepermission', this._onUpdatePermission, this);
		map.on('commandstatechanged', this._onCommandStateChanged, this);
	},

	_onCommandStateChanged: function(e) {
		// Store information about enabled/disabled commands
		// Used later just before showing menu to enable/disable menu items
		if (e.state === 'enabled' || e.state === 'disabled') {
			this.options.commandStates[e.commandName] = e.state;
		}
	},

	_onUpdatePermission: function() {
		if (this._initialized || !this._menubarCont)
			return;

		// Add dcoument specific menu
		var docType = this._map.getDocType();
		if (docType === 'text') {
			this._initializeMenu(this.options.text);
		} else if (docType === 'spreadsheet') {
			this._initializeMenu(this.options.spreadsheet);
		} else if (docType === 'presentation' || docType === 'drawing') {
			this._initializeMenu(this.options.presentation);
		}

		// initialize menubar plugin
		$('#main-menu').smartmenus({
			hideOnClick: true,
			showOnClick: true,
			hideTimeout: 0,
			hideDuration: 0,
			collapsibleHideDuration: 0,
			subIndicatorsPos: 'append',
			subIndicatorsText: '&#8250;'
		});
		this._initialized = true;

		$('#main-menu').bind('select.smapi', {self: this}, this._onItemSelected);
		$('#main-menu').bind('beforeshow.smapi', {self: this}, this._beforeFirstShow);
	},

	_beforeFirstShow: function(e, menu) {
		var self = e.data.self;
		var items = $(menu).children().children('a').not('.has-submenu');
		$(items).each(function() {
			var aItem = this;
			var type = $(aItem).data('type');
			if (type === 'unocommand') {
				var unoCommand = $(aItem).data('uno');
				if (self.options.commandStates[unoCommand] === 'disabled') {
					$(aItem).addClass('disabled');
				} else if (self.options.commandStates[unoCommand] === 'enabled') {
					$(aItem).removeClass('disabled');
				}
			}
		});
	},

	_executeAction: function(id) {
		if (id === 'print') {
			map.print();
		} else if (id.startsWith('downloadas-')) {
			var format = id.substring('downloadas-'.length);
			// remove the extension if any
			var fileName = title.substr(0, title.lastIndexOf('.')) || title;
			// check if it is empty
			fileName = fileName === '' ? 'document' : fileName;
			map.downloadAs(fileName + '.' + format, format);
		} else if (id === 'insertgraphic') {
			L.DomUtil.get('insertgraphic').click();
		} else if (id === 'zoomin' && map.getZoom() < map.getMaxZoom()) {
			map.zoomIn(1);
		} else if (id === 'zoomout' && map.getZoom() > map.getMinZoom()) {
			map.zoomOut(1);
		} else if (id === 'zoomreset') {
			map.setZoom(map.options.zoom);
		} else if (id === 'fullscreen') {
			if (!document.fullscreenElement &&
				!document.mozFullscreenElement &&
				!document.msFullscreenElement &&
				!document.webkitFullscreenElement) {
				if (document.documentElement.requestFullscreen) {
					document.documentElement.requestFullscreen();
				} else if (document.documentElement.msRequestFullscreen) {
					document.documentElement.msRequestFullscreen();
				} else if (document.documentElement.mozRequestFullScreen) {
					document.documentElement.mozRequestFullScreen();
				} else if (document.documentElement.webkitRequestFullscreen) {
					document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
				}
			} else {
				if (document.exitFullscreen) {
					document.exitFullscreen();
				} else if (document.msExitFullscreen) {
					document.msExitFullscreen();
				} else if (document.mozCancelFullScreen) {
					document.mozCancelFullScreen();
				} else if (document.webkitExitFullscreen) {
					document.webkitExitFullscreen();
				}
			}
		} else if (id === 'fullscreen-presentation' && map.getDocType() === 'presentation') {
			map.fire('fullscreen');
		} else if (id === 'insertpage') {
			map.insertPage();
		} else if (id === 'duplicatepage') {
			map.duplicatePage();
		} else if (id === 'deletepage') {
			vex.dialog.confirm({
				message: _("Are you sure you want to delete this slide?"),
				callback: this._onDeleteSlide
			}, this);
		}
	},

	_onDeleteSlide: function(e) {
		if (e) {
			map.deletePage();
		}
	},

	_onItemSelected: function(e, item) {
		var self = e.data.self;
		var type = $(item).data('type');
		if (type === 'unocommand') {
			var unoCommand = $(item).data('uno');
			map.sendUnoCommand(unoCommand);
		} else if (type === 'action') {
			var id = $(item).data('id');
			self._executeAction(id);
		}
	},

	_createMenu: function(menu) {
		var itemList = [];
		for (var i in menu) {
			var liItem = L.DomUtil.create('li', '');
			var aItem = L.DomUtil.create('a', '', liItem);
			aItem.innerHTML = menu[i]['name'];

			if (menu[i]['type'] === 'menu') {
				var ulItem = L.DomUtil.create('ul', '', liItem);
				var subitemList = this._createMenu(menu[i]['menu']);
				for (var j in subitemList) {
					ulItem.appendChild(subitemList[j]);
				}
			} else if (menu[i]['type'] === 'unocommand') {
				$(aItem).data('type', 'unocommand');
				$(aItem).data('uno', menu[i]['uno']);
			} else if (menu[i]['type'] === 'separator') {
				$(aItem).addClass('separator');
			} else if (menu[i]['type'] === 'action') {
				$(aItem).data('type', 'action');
				$(aItem).data('id', menu[i]['id']);
			}

			itemList.push(liItem);
		}

		return itemList;
	},

	_initializeMenu: function(menu) {
		var menuHtml = this._createMenu(menu);
		for (var i in menuHtml) {
			this._menubarCont.appendChild(menuHtml[i]);
		}
	}
});

L.control.menubar = function (options) {
	return new L.Control.menubar(options);
};

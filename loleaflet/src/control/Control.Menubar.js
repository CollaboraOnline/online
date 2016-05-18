/*
* Control.Menubar
*/

/* global $ */
L.Control.menubar = L.Control.extend({
	options: {
		common: [
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
			}
		],

		text:  [
			{name: 'Insert', type: 'menu', menu: [{name: 'Image', id: 'insertgraphic', type: 'action'},
												  {name: 'Comment', type: 'unocommand', uno: '.uno:InsertAnnotation'}]
			},
			{name: 'View', type: 'menu', menu: [{name: 'Full screen', id: 'fullscreen', type: 'action'},
												{name: 'Zoom in', id: 'zoomin', type: 'action'},
												{name: 'Zoom out', id: 'zoomout', type: 'action'},
												{name: 'Zoom reset', id: 'zoomreset', type: 'action'}]
			},
			{name: 'Layout', type: 'menu', menu: [{name: 'Clear formatting', type: 'unocommand', uno: '.uno:ResetAttributes'}]
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
			{name: 'Review', type: 'menu', menu: [{name: 'Add comment', type: 'unocommand', uno: '.uno:InsertAnnotation'}]
			}
		],

		presentation: [
			{name: 'Insert', type: 'menu', menu: [{name: 'Image', type: 'command'},
												  {name: 'Shape', type: 'command'},
												  {name: 'Line', type: 'command'},
												  {name: 'Table', type: 'command'},
												  {name: 'Video', type: 'command'},
												  {name: 'Slide', type: 'command'},
												  {name: 'Slide numbering', type: 'command'},
												  {name: 'Text space', type: 'command'},
												  {name: 'Chart', type: 'command'},
												  {name: 'Symbol', type: 'command'},
												  {name: 'Remark', type: 'command'}]
			},
			{name: 'View', type: 'menu', menu: [{name: 'Full Screen', type: 'command'},
												{name: 'Presentation views', type: 'command'},
												{name: 'Master views', type: 'command'},
												{name: 'Zoom', type: 'command'},
												{name: 'Show rulers', type: 'command'}]
			}
		],

		spreadsheet: [
			{name: 'Insert', type: 'menu', menu: [{name: 'Row', type: 'command'},
												  {name: 'Column', type: 'command'},
												  {name: 'Function', type: 'command'},
												  {name: 'Page', type: 'command'}]
			},
			{name: 'View', type: 'menu', menu: [{name: 'Full screen', type: 'command'},
												{name: 'Formula bar', type: 'command'},
												{name: 'Zoom', type: 'command'},
												{name: 'Headings', type: 'command'}]
			}
		]
	},

	onAdd: function (map) {
		this._initialized = false;
		var docContainer = map.options.documentContainer;
		this._menubarCont = L.DomUtil.create('ul', 'sm sm-simple', docContainer.parentElement);
		this._menubarCont.id = 'main-menu';

		map.on('updatepermission', this._onUpdatePermission, this);
	},

	_onUpdatePermission: function() {
		if (this._initialized || !this._menubarCont)
			return;

		// Intialize menu that is common to all documents
		this._initializeMenu(this.options.common);

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
			showOnClick: true,
			hideTimeout: 0,
			hideDuration: 0,
			collapsibleHideDuration: 0,
			subIndicatorsPos: 'append',
			subIndicatorsText: '&#8250;'
		});
		this._initialized = true;

		$('#main-menu').bind('select.smapi', {self: this}, this._onItemSelected);
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

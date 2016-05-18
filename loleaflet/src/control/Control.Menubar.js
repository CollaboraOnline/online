/*
* Control.Menubar
*/

/* global $ */
L.Control.menubar = L.Control.extend({
	options: {
		common: [
			{name: 'File', type: 'menu', menu: [{name: 'New', type: 'command'},
												{name: 'Open', type: 'command'},
												{name: 'Save', type: 'command'},
												{name: 'Print', type: 'command'}]
			},
			{name: 'Edit', type: 'menu', menu: [{name: 'Undo', type: 'command'},
												{name: 'Redo', type: 'command'},
												{name: 'Cut', type: 'command'},
												{name: 'Copy', type: 'command'},
												{name: 'Paste', type: 'command'},
												{name: 'Select All', type: 'command'}]
			}
		],

		text:  [
			{name: 'Insert', type: 'menu', menu: [{name: 'Image', type: 'command'},
												  {name: 'Link', type: 'command'},
												  {name: 'Table', type: 'command'},
												  {name: 'Footer', type: 'command'},
												  {name: 'Page number', type: 'command'},
												  {name: 'Index', type: 'command'},
												  {name: 'Horizontal Line', type: 'command'},
												  {name: 'Chart', type: 'command'},
												  {name: 'Symbol', type: 'command'},
												  {name: 'Remark', type: 'command'}]
			},
			{name: 'View', type: 'menu', menu: [{name: 'Full screen', type: 'command'},
												{name: 'Rulers', type: 'command'},
												{name: 'Zoom', type: 'command'},
												{name: 'Web Layout', type: 'command'}]
			},
			{name: 'Layout', type: 'menu', menu: [{name: 'Text editor', type: 'command'},
												  {name: 'Columns', type: 'command'},
												  {name: 'Image crop', type: 'command'},
												  {name: 'Page layout', type: 'command'},
												  {name: 'Clear styling', type: 'command'}]
			},
			{name: 'Tables', type: 'menu', menu: [{name: 'Insert Table', type: 'command'},
												  {name: 'Insert row', type: 'command'},
												  {name: 'Insert column', type: 'command'},
												  {name: 'Submenus', type: 'menu', menu: [{name: 'Item1', type: 'command'},
																						  {name: 'Item2', type: 'command'},
																						  {name: 'Item3', type: 'command'}]},
												  {name: 'Remove row', type: 'command'},
												  {name: 'Remove column', type: 'command'},
												  {name: 'Split cells', type: 'command'},
												  {name: 'Merge cells', type: 'command'}]
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

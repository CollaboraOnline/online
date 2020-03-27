/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
* Control.ContextMenu
*/

/* global $ _ _UNO vex */
L.Control.ContextMenu = L.Control.extend({
	options: {
		SEPARATOR: '---------',
		/*
		 * Enter UNO commands that should appear in the context menu.
		 * Entering a UNO command under `general' would enable it for all types
		 * of documents. If you do not want that, whitelist it in document specific filter.
		 *
		 * UNOCOMMANDS_EXTRACT_START <- don't remove this line, it's used by unocommands.py
		 */
		whitelist: {
			/*
			 * UNO commands for menus are not available sometimes. Presence of Menu commands
			 * in following list is just for reference and ease of locating uno command
			 * from context menu structure.
			 */
			general: ['Cut', 'Copy', 'Paste', 'Delete',
					  'NumberingStart', 'ContinueNumbering', 'IncrementLevel', 'DecrementLevel',
					  'OpenHyperlinkOnCursor', 'CopyHyperlinkLocation', 'RemoveHyperlink',
					  'AnchorMenu', 'SetAnchorToPage', 'SetAnchorToPara', 'SetAnchorAtChar',
					  'SetAnchorToChar', 'SetAnchorToFrame',
					  'WrapMenu', 'WrapOff', 'WrapOn', 'WrapIdeal', 'WrapLeft', 'WrapRight', 'WrapThrough',
					  'WrapThroughTransparencyToggle', 'WrapContour', 'WrapAnchorOnly',
					  'ArrangeFrameMenu', 'ArrangeMenu', 'BringToFront', 'ObjectForwardOne', 'ObjectBackOne', 'SendToBack',
					  'RotateMenu', 'RotateLeft', 'RotateRight', 'TransformDialog', 'FormatLine', 'FormatArea',
					  'FormatChartArea', 'InsertTitles', 'InsertRemoveAxes',
					  'DeleteLegend', 'DiagramType', 'DataRanges', 'DiagramData', 'View3D',
					  'FormatWall', 'FormatFloor', 'FormatLegend', 'FormatTitle', 'FormatDataSeries',
					  'FormatAxis', 'FormatMajorGrid', 'FormatMinorGrid', 'FormatDataLabels',
					  'FormatDataLabel', 'FormatDataPoint', 'FormatMeanValue', 'FormatXErrorBars', 'FormatYErrorBars',
					  'FormatTrendline', 'FormatTrendlineEquation', 'FormatSelection', 'FormatStockLoss',
					  'FormatStockGain', 'InsertDataLabel' , 'DeleteDataLabel', 'ResetDataPoint',
					  'InsertTrendline', 'InsertMeanValue', 'InsertXErrorBars' , 'InsertYErrorBars', 'ResetAllDataPoints' , 'DeleteAxis',
					  'InsertAxisTitle', 'InsertMinorGrid', 'InsertMajorGrid' , 'InsertAxis', 'DeleteMajorGrid' , 'DeleteMinorGrid',
					  'SpellCheckIgnoreAll', 'LanguageStatus', 'SpellCheckApplySuggestion'],

			text: ['TableInsertMenu',
				   'InsertRowsBefore', 'InsertRowsAfter', 'InsertColumnsBefore', 'InsertColumnsAfter',
				   'TableDeleteMenu', 'SetObjectToBackground', 'SetObjectToForeground',
				   'DeleteRows', 'DeleteColumns', 'DeleteTable',
				   'MergeCells', 'SetOptimalColumnWidth', 'SetOptimalRowHeight',
				   'UpdateCurIndex','RemoveTableOf',
				   'ReplyComment', 'DeleteComment', 'DeleteAuthor', 'DeleteAllNotes',
				   'SpellingAndGrammarDialog', 'FontDialog', 'FontDialogForParagraph',
				   'SpellCheckIgnore'],

			spreadsheet: ['MergeCells', 'SplitCell', 'RecalcPivotTable', 'FormatCellDialog',
				          'ShowNote', 'DeleteNote', 'SetAnchorToCell', 'SetAnchorToCellResize'],

			presentation: [],
			drawing: []
		},
		// UNOCOMMANDS_EXTRACT_END <- don't remove this line, it's used by unocommands.py

		// This blacklist contains those menu items which should be disabled on mobile
		// phones even if they are allowed in general. We need to have only those items here
		// which are also part of the whitelist, otherwise the menu items are not visible
		// anyway.

		// For clarity, please keep this list in sections that are sorted in the same order
		// as the items appear in the whitelist arrays above. Also keep items on separate
		// lines as in the arrays above.
		mobileBlackList: [
			// general
			'TransformDialog', 'FormatLine', 'FormatArea',
			'InsertTitles', 'InsertRemoveAxes',
			'DiagramType', 'DataRanges',
			'FormatWall', 'FormatDataSeries',
			'FormatDataPoint', 'FormatAxis', 'FormatMajorGrid', 'FormatMinorGrid',
			'InsertTrendline', 'InsertXErrorBars' , 'InsertYErrorBars',
			// text
			'SpellingAndGrammarDialog', 'FontDialog', 'FontDialogForParagraph',
			// spreadsheet
			'FormatCellDialog',
			'ShowNote', 'DeleteNote',
		]
	},



	onAdd: function (map) {
		this._prevMousePos = null;

		map._contextMenu = this;
		map.on('locontextmenu', this._onContextMenu, this);
		map.on('mousedown', this._onMouseDown, this);
		map.on('keydown', this._onKeyDown, this);
		map.on('closepopups', this._onClosePopup, this);
	},

	_onClosePopup: function () {
		$.contextMenu('destroy', '.leaflet-layer');
		this.hasContextMenu = false;
	},

	_onMouseDown: function(e) {
		this._prevMousePos = {x: e.originalEvent.pageX, y: e.originalEvent.pageY};

		this._onClosePopup();
	},

	_onKeyDown: function(e) {
		if (e.originalEvent.keyCode === 27 /* ESC */) {
			$.contextMenu('destroy', '.leaflet-layer');
		}
	},

	_onContextMenu: function(obj) {
		var map = this._map;
		if (map._permission !== 'edit') {
			return;
		}

		if (this.hasContextMenu) {
			this._onClosePopup();
		}

		this._amendContextMenuData(obj);

		var contextMenu = this._createContextMenuStructure(obj);
		var spellingContextMenu = false;
		for (var menuItem in contextMenu) {
			if ($.inArray('.uno:SpellCheckIgnore', menuItem) !== -1) {
				spellingContextMenu = true;
				break;
			}
		}
		if (window.mode.isMobile()) {
			window.contextMenuWizard = true;
			var menuData = L.Control.JSDialogBuilder.getMenuStructureForMobileWizard(contextMenu, true, '');
			if (spellingContextMenu === true) {
				vex.timer = setInterval(function() {
					map.fire('mobilewizard', menuData);
					clearTimeout(vex.timer);
				}, 200);
			} else {
				map.fire('mobilewizard', menuData);
			}
		} else {
			L.installContextMenu({
				selector: '.leaflet-layer',
				className: 'loleaflet-font',
				trigger: 'none',
				build: function() {
					return {
						callback: function(key) {
							if (map.getDocType() == 'spreadsheet' && key == '.uno:ShowNote') {
								map._docLayer.showAnnotationFromCurrentCell();
							} else if (map.getDocType() == 'spreadsheet' && key == '.uno:HideNote') {
								map._docLayer.hideAnnotationFromCurrentCell();
							} else if (map._clip === undefined || !map._clip.filterExecCopyPaste(key)) {
								map.sendUnoCommand(key);
								// For spelling context menu we need to remove selection
								if (spellingContextMenu)
									map._docLayer._clearSelections();
								// Give the stolen focus back to map
								map.focus();
							}
						},
						items: contextMenu
					};
				}
			});

			$('.leaflet-layer').contextMenu(this._prevMousePos);
			this.hasContextMenu = true;
		}
	},

	_amendContextMenuData: function(obj) {
		// Add a 'delete' entry for mobile for graphic selection.
		if (this._map._docLayer.hasGraphicSelection() && window.mode.isMobile()) {
			var insertIndex = -1;
			obj.menu.forEach(function(item, index) {
				if (item.command === '.uno:Paste') {
					insertIndex = index + 1;
				}
			});

			if (insertIndex != -1) {
				obj.menu.splice(insertIndex, 0,
					{ text: _('Delete'), type: 'command', command: '.uno:Delete', enabled: true });
			}
		}
	},

	_createContextMenuStructure: function(obj) {
		var docType = this._map.getDocType();
		var contextMenu = {};
		var sepIdx = 1, itemName;
		var subMenuIdx = 1;
		var isLastItemText = false;
		for (var idx in obj.menu) {
			var item = obj.menu[idx];
			if (item.enabled === 'false') {
				continue;
			}

			if (item.type === 'separator') {
				if (isLastItemText) {
					contextMenu['sep' + sepIdx++] = this.options.SEPARATOR;
				}
				isLastItemText = false;
			}
			else if (item.type === 'command') {
				// Only show whitelisted items
				// Command name (excluding '.uno:') starts from index = 5
				var commandName = item.command.substring(5);

				// Command might have paramateres (e.g. .uno:SpellCheckIgnore?Type:string=Grammar)
				var hasParam = false;
				if (commandName.indexOf('?')!== -1) {
					commandName = commandName.substring(0, commandName.indexOf('?'));
					hasParam = true;
				}

				// We use a special character dialog in spelling context menu with a parameter
				if (commandName === 'FontDialog' && !hasParam)
					continue;

				if (commandName !== 'None' &&
					this.options.whitelist.general.indexOf(commandName) === -1 &&
					!(docType === 'text' && this.options.whitelist.text.indexOf(commandName) !== -1) &&
					!(docType === 'spreadsheet' && this.options.whitelist.spreadsheet.indexOf(commandName) !== -1) &&
					!(docType === 'presentation' && this.options.whitelist.presentation.indexOf(commandName) !== -1) &&
					!(docType === 'drawing' && this.options.whitelist.drawing.indexOf(commandName) !== -1)) {
					continue;
				}

				if (window.mode.isMobile() && this.options.mobileBlackList.indexOf(commandName) !== -1)
					continue;

				if (this._map.getDocType() == 'spreadsheet' && commandName == 'ShowNote') {
					if (this._map._docLayer.isCurrentCellCommentShown())
						item.command = '.uno:HideNote';
				}

				if (hasParam || commandName === 'None' || commandName === 'FontDialogForParagraph' || commandName === 'Delete') {
					itemName = window.removeAccessKey(item.text);
					itemName = itemName.replace(' ', '\u00a0');
				} else {
					// Get the translated text associated with the command
					itemName = _UNO(item.command, docType, true);
				}

				contextMenu[item.command] = {
					// Using 'click' and <a href='#' is vital for copy/paste security context.
					name: (window.mode.isMobile() ? _(itemName) : '<a href="#" class="context-menu-link">' +  _(itemName) + '</a'),
					isHtmlName: true,
				};

				if (item.checktype === 'checkmark') {
					if (item.checked === 'true') {
						contextMenu[item.command]['icon'] = 'lo-checkmark';
					}
				} else if (item.checktype === 'radio') {
					if (item.checked === 'true') {
						contextMenu[item.command]['icon'] = 'radio';
					}
				}

				isLastItemText = true;
			} else if (item.type === 'menu') {
				itemName = item.text;
				if (itemName.replace('~', '') === 'Paste Special') {
					itemName = _('Paste Special');
					continue; // Kill paste special for now.
				}
				var submenu = this._createContextMenuStructure(item);
				// ignore submenus with all items disabled
				if (Object.keys(submenu).length === 0) {
					continue;
				}

				contextMenu['submenu' + subMenuIdx++] = {
					name: _(itemName).replace(/\(~[A-Za-z]\)/, '').replace('~', ''),
					command: item.command,
					items: submenu
				};
				isLastItemText = true;
			}
		}

		// Remove separator, if present, at the end
		var lastItem = Object.keys(contextMenu)[Object.keys(contextMenu).length - 1];
		if (lastItem !== undefined && lastItem.startsWith('sep')) {
			delete contextMenu[lastItem];
		}

		return contextMenu;
	}
});

L.control.contextMenu = function (options) {
	return new L.Control.ContextMenu(options);
};

// Using 'click' and <a href='#' is vital for copy/paste security context.
L.installContextMenu = function(options) {
	options.itemClickEvent = 'click';
	var rewrite = function(items) {
		if (items === undefined)
			return;
		var keys = Object.keys(items);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			if (items[key] === undefined)
				continue;
			if (!items[key].isHtmlName) {
				console.log('re-write name ' + items[key].name);
				items[key].name = '<a href="#" class="context-menu-link">' + items[key].name + '</a';
				items[key].isHtmlName = true;
			}
			rewrite(items[key].items);
		}
	};
	rewrite(options.items);
	$.contextMenu(options);
};

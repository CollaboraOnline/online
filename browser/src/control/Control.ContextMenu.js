/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/*
 * Control.ContextMenu
 */

/* global $ _ _UNO app GraphicSelection */
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
			general: ['Cut', 'Copy', 'Paste', 'PasteSpecial', 'Delete',
					  'FormatPaintbrush', 'ResetAttributes',
					  'NumberingStart', 'ContinueNumbering', 'IncrementLevel', 'DecrementLevel',
					  'OpenHyperlinkOnCursor', 'EditHyperlink', 'CopyHyperlinkLocation', 'RemoveHyperlink',
					  'AnchorMenu', 'SetAnchorToPage', 'SetAnchorToPara', 'SetAnchorAtChar',
					  'SetAnchorToChar', 'SetAnchorToFrame', 'Crop',
					  'WrapMenu', 'WrapOff', 'WrapOn', 'WrapIdeal', 'WrapLeft', 'WrapRight', 'WrapThrough',
					  'WrapThroughTransparencyToggle', 'WrapContour', 'WrapAnchorOnly',
					  'ConvertMenu', 'ChangeBezier',
					  'DistributeHorzCenter', 'DistributeHorzDistance','DistributeHorzLeft','DistributeHorzRight',
					  'DistributeVertBottom', 'DistributeVertCenter', 'DistributeVertDistance', 'DistributeVertTop',
					  'ArrangeFrameMenu', 'ArrangeMenu', 'BringToFront', 'ObjectForwardOne', 'ObjectBackOne', 'SendToBack',
					  'RotateMenu', 'RotateLeft', 'RotateRight', 'TransformDialog', 'FormatLine', 'FormatArea',
					  'FormatChartArea', 'InsertTitles', 'InsertRemoveAxes',
					  'DeleteLegend', 'DiagramType', 'DataRanges', 'DiagramData', 'View3D',
					  'FormatWall', 'FormatFloor', 'FormatLegend', 'FormatTitle', 'FormatDataSeries',
					  'FormatAxis', 'FormatMajorGrid', 'FormatMinorGrid', 'FormatDataLabels',
					  'FormatDataLabel', 'FormatDataPoint', 'FormatMeanValue', 'FormatXErrorBars', 'FormatYErrorBars',
					  'FormatTrendline', 'FormatTrendlineEquation', 'FormatSelection', 'FormatStockLoss',
					  'FormatStockGain', 'InsertDataLabel', 'InsertDataLabels' , 'DeleteDataLabel', 'DeleteDataLabels', 'ResetDataPoint',
					  'InsertTrendline', 'InsertMeanValue', 'InsertXErrorBars' , 'InsertYErrorBars', 'ResetAllDataPoints' , 'DeleteAxis',
					  'InsertAxisTitle', 'InsertMinorGrid', 'InsertMajorGrid' , 'InsertAxis', 'DeleteMajorGrid' , 'DeleteMinorGrid',
					  'SpellCheckIgnoreAll', 'LanguageStatus', 'SpellCheckApplySuggestion', 'PageDialog',
					  'CompressGraphic', 'GraphicDialog', 'InsertCaptionDialog',
					  'AnimationEffects', 'ExecuteAnimationEffect',
					  'NextTrackedChange', 'PreviousTrackedChange', 'RejectTrackedChange', 'AcceptTrackedChange', 'ReinstateTrackedChange', 'InsertAnnotation'],

			text: ['TableInsertMenu',
				   'InsertRowsBefore', 'InsertRowsAfter', 'InsertColumnsBefore', 'InsertColumnsAfter',
				   'TableDeleteMenu', 'SetObjectToBackground', 'SetObjectToForeground',
				   'DeleteRows', 'DeleteColumns', 'DeleteTable', 'EditCurrentRegion',
				   'MergeCells', 'SetOptimalColumnWidth', 'SetOptimalRowHeight',
				   'UpdateCurIndex','RemoveTableOf',
				   'ReplyComment', 'DeleteComment', 'DeleteAuthor', 'DeleteAllNotes',
				   'SpellingAndGrammarDialog', 'FontDialog', 'FontDialogForParagraph', 'TableDialog',
				   'SpellCheckIgnore', 'FrameDialog', 'UnfloatFrame', 'ContentControlProperties', 'DeleteContentControl',
				   'AddToWordbook'],

			spreadsheet: ['MergeCells', 'SplitCell', 'InsertCell', 'DeleteCell',
				      'RecalcPivotTable', 'DataDataPilotRun', 'DeletePivotTable',
				      'FormatCellDialog', 'DeleteNote', 'SetAnchorToCell', 'SetAnchorToCellResize',
				      'FormatSparklineMenu', 'InsertSparkline', 'DeleteSparkline', 'DeleteSparklineGroup',
				      'EditSparklineGroup', 'EditSparkline', 'GroupSparklines', 'UngroupSparklines', 'AutoFill'],

			presentation: ['SetDefault'],
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
			'PasteSpecial',
			'TransformDialog', 'FormatLine', 'FormatArea',
			'InsertTitles', 'InsertRemoveAxes',
			'DiagramType', 'DataRanges',
			'FormatWall', 'FormatDataSeries', 'FormatXErrorBars', 'FormatYErrorBars',
			'FormatDataPoint', 'FormatAxis', 'FormatMajorGrid', 'FormatMinorGrid',
			'InsertTrendline', 'InsertXErrorBars' , 'InsertYErrorBars', 'FormatChartArea',
			'FormatMeanValue', 'DiagramData', 'FormatLegend', 'FormatTrendline',
			'FormatTrendlineEquation', 'FormatStockLoss', 'FormatStockGain', 'LanguageStatus',
			'PageDialog',
			// text
			'SpellingAndGrammarDialog', 'FontDialog', 'FontDialogForParagraph',
			// spreadsheet
			'FormatCellDialog', 'DataDataPilotRun',
			'GroupSparklines', 'UngroupSparklines', 'AutoFill'
		]
	},



	onAdd: function (map) {
		this._prevMousePos = null;
		this._autoFillContextMenu = false;

		map._contextMenu = this;
		map.on('locontextmenu', this._onContextMenu, this);
		map.on('mousedown', this._onMouseDown, this);
		map.on('mouseup', this._onMouseUp, this);
		map.on('keydown', this._onKeyDown, this);
		map.on('closepopups', this._onClosePopup, this);
	},

	_onClosePopup: function () {

		if (this._autoFillContextMenu) {
			this._autoFillContextMenu = false;
			app.map._docLayer._resetReferencesMarks();
		}

		$.contextMenu('destroy', '.leaflet-layer');
		this.hasContextMenu = false;
	},

	_onMouseDown: function(e) {
		this._prevMousePos = {x: e.originalEvent.pageX, y: e.originalEvent.pageY};

		this._onClosePopup();
	},

	_onMouseUp: function (e) {
		this._currMousePos = { x: e.originalEvent.pageX, y: e.originalEvent.pageY };
	},

	_onKeyDown: function(e) {
		if (e.originalEvent.keyCode === 27 /* ESC */) {
			$.contextMenu('destroy', '.leaflet-layer');
			this.hasContextMenu = false;
		}
	},

	_onContextMenu: function(obj) {
		var map = this._map;
		if (!map.isEditMode()) {
			return;
		}

		if (this.hasContextMenu) {
			this._onClosePopup();
		}

		this._amendContextMenuData(obj);

		var contextMenu = this._createContextMenuStructure(obj);

		if (Object.keys(contextMenu).length == 0) {
			// We can sometimes end up filtering out everything in the menu ... in this case, there's nothing to display
			return;
		}

		var spellingContextMenu = false;
		var autoFillContextMenu = false;
		for (var menuItem in contextMenu) {
			if (menuItem.indexOf('.uno:SpellCheckIgnore') !== -1) {
				spellingContextMenu = true;
				break;
			} else if (menuItem.indexOf('.uno:AutoFill') !== -1) {
				// we should close the autofill preview popup before open autofill context menu
				map.fire('closeautofillpreviewpopup');
				this._autoFillContextMenu = autoFillContextMenu = true;
				break;
			}
		}
		if (window.mode.isMobile()) {
			window.contextMenuWizard = true;
			var menuData = L.Control.JSDialogBuilder.getMenuStructureForMobileWizard(contextMenu, true, '');
			map.fire('mobilewizard', {data: menuData});
		} else {
			L.installContextMenu({
				selector: '.leaflet-layer',
				className: 'cool-font on-the-fly-context-menu',
				trigger: 'none',
				zIndex: 1500,
				build: function() {
					return {
						callback: function(key) {
							if (key === '.uno:InsertAnnotation') {
								app.map.insertComment();
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
				},
				events: {
					show: function (opt) {
						var $menu = opt.$menu;
						$menu.attr('tabindex', 0); // Make the context menu focusable
					},
					activated: function (opt) {
						if (autoFillContextMenu) {
							var $layer = opt.$layer;
							$layer.css('pointer-events', 'none'); // disable mouse clicks for the layer
						}
					},
					hide: function() {
						if(autoFillContextMenu)
							app.map._docLayer._resetReferencesMarks();
						map.focus();
					}
				}
			});
			if (autoFillContextMenu)
				$('.leaflet-layer').contextMenu(this._currMousePos);
			else
				$('.leaflet-layer').contextMenu(this._prevMousePos);
			$('.context-menu-root').focus();
			this.hasContextMenu = true;
		}
	},

	_amendContextMenuData: function(obj) {
		// Add a 'delete' entry  for graphic selection on desktop and mobile device (in browser or app).
		if (GraphicSelection.hasActiveSelection()) {
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

	_getContextMenuIcon: function(command, commandName) {
		const commandsWithIcons = new Set([
			'Cut', 'Copy', 'Paste', 'Delete', 'CompressGraphic', 'Crop', 'FormatPaintbrush', 'ResetAttributes',
			'NextTrackedChange', 'PreviousTrackedChange', 'PageDialog', 'MergeCells', 'DeleteCell', 'InsertCell',
			'InsertRowsBefore', 'InsertRowsAfter', 'InsertColumnsBefore', 'InsertColumnsAfter', 'InsertColumnsMenu',
			'DeleteRows', 'DeleteColumns', 'DeleteTable', 'SetOptimalColumnWidth', 'TableDialog', 'GraphicDialog',
			'InsertAnnotation', 'SpellingAndGrammarDialog', 'DecrementLevel', 'TransformDialog', 'FormatLine',
			'FormatArea', 'SetAnchorToPara', 'SetAnchorAtChar', 'SetAnchorToChar', 'WrapOff', 'WrapOn', 'WrapIdeal',
			'WrapLeft', 'WrapRight', 'WrapThrough', 'WrapThroughTransparencyToggle', 'WrapAnchorOnly', 'WrapContour',
			'BringToFront', 'ObjectForwardOne', 'ObjectBackOne', 'SendToBack', 'SetObjectToForeground',
			'SetObjectToBackground', 'InsertCaptionDialog', 'OpenHyperlinkOnCursor', 'EditHyperlink',
			'CopyHyperlinkLocation', 'RemoveHyperlink', 'RotateRight', 'RotateLeft', 'SetAnchorToCell',
			'SetAnchorToCellResize', 'SetAnchorToPage', 'FormatCellDialog', 'InsertSparkline', 'AcceptTrackedChange',
			'RejectTrackedChange', 'ReinstateTrackedChange'
		]);

		if (!commandsWithIcons.has(commandName)) {
			return '<span class="context-menu-icon-spacer"></span>';
		}

		const iconName = app.LOUtil.getIconNameOfCommand(command);
		const iconUrl = app.LOUtil.getImageURL(iconName);
		const imgId = 'context-menu-icon-' + iconName.replace(/[^a-z0-9]/gi, '-').toLowerCase();

		return '<img id="' + imgId + '" class="context-menu-icon" src="' + iconUrl + '" alt="' + iconName + '" />';
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

			// If the command was hidden with the Hide_Command postmessage...
			if (this._map.uiManager.hiddenCommands[item.command]) {
				continue;
			}

			// reduce Paste Special submenu
			if (item.type === 'menu' && item.text && item.text.replace('~', '') === 'Paste Special'
				&& item.menu && item.menu.length) {
				item.text = _('Paste Special');
				item.command = '.uno:PasteSpecial';
				item.type = item.menu[0].type;
				item.menu = undefined;
			}

			if (item.type === 'command' && item.text && item.text.replace('~', '') === 'Copy Cells') {
				item.text = _('Copy Cells');
				item.command = '.uno:AutoFill?Copy:bool=true';
			}

			if (item.type === 'command' && item.text && item.text.replace('~', '') === 'Fill Series') {
				item.text = _('Fill Series');
				item.command = '.uno:AutoFill?Copy:bool=false';
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

				if (commandName == 'None' && !item.text)
					continue;

				if (hasParam || commandName === 'None' || commandName === 'FontDialogForParagraph' || commandName === 'Delete' || commandName == 'PasteSpecial') {
					// These commands have a custom item.text, don't overwrite
					// that with a label based on 'item.command'.
					itemName = window.removeAccessKey(item.text);
					itemName = itemName.replace(' ', '\u00a0');
				} else {
					// Get the translated text associated with the command
					itemName = _UNO(item.command, docType, true);
				}

				var toSnakeCase = function (text) {
					return text.replace(/[ _]/gi, '-').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
				};

				var iconHtml = this._getContextMenuIcon(item.command, commandName);
				
				contextMenu[item.command] = {
					// Using 'click' and <a href='#' is vital for copy/paste security context.
					name: (window.mode.isMobile() ? _(itemName) : 
					'<a href="#" class="context-menu-link ' + toSnakeCase(commandName) + '">' + iconHtml + _(itemName) + '</a>'),
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
	},

    // Prevents right mouse button's mouseup event from triggering menu item accidentally.
    stopRightMouseUpEvent: function() {
        var menuItems = document.getElementsByClassName('context-menu-item');

        for (var i = 0 ; i < menuItems.length; i++) {
            menuItems[i].addEventListener('mouseup', function(e) {
                if (e.button == 2) // Is a right mouse button event?
                    e.stopPropagation();
            });
        }
    }
});

L.control.contextMenu = function (options) {
	return new L.Control.ContextMenu(options);
};

// Using 'click' and <a href='#' is vital for copy/paste security context.
L.installContextMenu = function(options) {
	var rewrite = function(items) {
		if (items === undefined)
			return;
		var keys = Object.keys(items);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			if (items[key] === undefined)
				continue;
			if (!items[key].isHtmlName) {
				// window.app.console.log('re-write name ' + items[key].name);
				items[key].name = '<a href="#" class="context-menu-link">' + items[key].name + '</a>';
				items[key].isHtmlName = true;
			}
			rewrite(items[key].items);
		}
	};
	rewrite(options.items);

	if (document.documentElement.dir === 'rtl') {
		options.positionSubmenu = function($menu) {
			if (typeof $menu === 'undefined') {
				return;
			}

			$menu.css('right', 'auto');
			$.contextMenu.defaults.positionSubmenu.call(this, $menu);
			$menu.css('right', $menu.css('left'));
		};
	}
	$.contextMenu(options);
};

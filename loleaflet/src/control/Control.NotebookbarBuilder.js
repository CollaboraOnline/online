/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarBuilder
 */

/* global $ _ _UNO */
L.Control.NotebookbarBuilder = L.Control.JSDialogBuilder.extend({

	_customizeOptions: function() {
		this.options.noLabelsForUnoButtons = true;
		this.options.useInLineLabelsForUnoButtons = false;
		this.options.cssClass = 'notebookbar';
	},

	_overrideHandlers: function() {
		this._controlHandlers['combobox'] = this._comboboxControlHandler;
		this._controlHandlers['listbox'] = this._comboboxControlHandler;
		this._controlHandlers['tabcontrol'] = this._overridenTabsControlHandler;

		this._controlHandlers['pushbutton'] = function() { return false; };
		this._controlHandlers['spinfield'] = function() { return false; };
		this._controlHandlers['formattedfield'] = function() { return false; };
		this._controlHandlers['metricfield'] = function() { return false; };

		this._toolitemHandlers['.uno:XLineColor'] = this._colorControl;
		this._toolitemHandlers['.uno:FontColor'] = this._colorControl;
		this._toolitemHandlers['.uno:BackColor'] = this._colorControl;
		this._toolitemHandlers['.uno:CharBackColor'] = this._colorControl;
		this._toolitemHandlers['.uno:BackgroundColor'] = this._colorControl;
		this._toolitemHandlers['.uno:FrameLineColor'] = this._colorControl;
		this._toolitemHandlers['.uno:Color'] = this._colorControl;
		this._toolitemHandlers['.uno:FillColor'] = this._colorControl;

		this._toolitemHandlers['.uno:InsertTable'] = this._insertTableControl;
		this._toolitemHandlers['.uno:InsertGraphic'] = this._insertGraphicControl;
		this._toolitemHandlers['.uno:InsertAnnotation'] = this._insertAnnotationControl;
		this._toolitemHandlers['.uno:LineSpacing'] = this._lineSpacingControl;
		this._toolitemHandlers['.uno:CharmapControl'] = this._symbolControl;
		this._toolitemHandlers['.uno:Cut'] = this._clipboardButtonControl;
		this._toolitemHandlers['.uno:Copy'] = this._clipboardButtonControl;
		this._toolitemHandlers['.uno:Paste'] = this._clipboardButtonControl;
		this._toolitemHandlers['.uno:BasicShapes'] = this._shapesControl;
		this._toolitemHandlers['.uno:ConditionalFormatMenu'] = this._conditionalFormatControl;
		this._toolitemHandlers['.uno:SetDefault'] = this._clearFormattingControl;
		this._toolitemHandlers['.uno:Presentation'] = this._startPresentationControl;
		this._toolitemHandlers['.uno:Save'] = this._saveControl;

		this._toolitemHandlers['up'] = this._toolbarItemControl;
		this._toolitemHandlers['down'] = this._toolbarItemControl;

		this._toolitemHandlers['.uno:SelectWidth'] = function() {};
		this._toolitemHandlers['.uno:SetOutline'] = function() {};
		this._toolitemHandlers['.uno:DesignerDialog'] = function() {};
		this._toolitemHandlers['.uno:Zoom'] = function() {};
		this._toolitemHandlers['.uno:PrintPreview'] = function() {};
		this._toolitemHandlers['.uno:Navigator'] = function() {};
		this._toolitemHandlers['.uno:InsertObject'] = function() {};
		this._toolitemHandlers['.uno:Gallery'] = function() {};
		this._toolitemHandlers['.uno:InsertAVMedia'] = function() {};
		this._toolitemHandlers['.uno:Line'] = function() {};
		this._toolitemHandlers['.uno:Polygon_Unfilled'] = function() {};
		this._toolitemHandlers['.uno:Bezier_Unfilled'] = function() {};
		this._toolitemHandlers['.uno:ArrowsToolbox'] = function() {};
		this._toolitemHandlers['.uno:BasicShapes.ellipse'] = function() {};
		this._toolitemHandlers['.uno:DrawCaption'] = function() {};
		this._toolitemHandlers['.uno:LineToolbox'] = function() {};
		this._toolitemHandlers['.uno:BasicShapes.rectangle'] = function() {};
		this._toolitemHandlers['.uno:SymbolShapes'] = function() {};
		this._toolitemHandlers['.uno:ArrowShapes'] = function() {};
		this._toolitemHandlers['.uno:StarShapes'] = function() {};
		this._toolitemHandlers['.uno:CalloutShapes'] = function() {};
		this._toolitemHandlers['.uno:FlowChartShapes'] = function() {};
		this._toolitemHandlers['.uno:InsertObjectStarMath'] = function() {};
		this._toolitemHandlers['.uno:EmojiControl'] = function() {};
		this._toolitemHandlers['.uno:InsertDraw'] = function() {};
		this._toolitemHandlers['.uno:EditGlossary'] = function() {};
		this._toolitemHandlers['.uno:PageMargin'] = function() {};
		this._toolitemHandlers['.uno:Orientation'] = function() {};
		this._toolitemHandlers['.uno:AttributePageSize'] = function() {};
		this._toolitemHandlers['.uno:PageColumnType'] = function() {};
		this._toolitemHandlers['.uno:SelectObject'] = function() {};
		this._toolitemHandlers['.uno:BibliographyComponent'] = function() {};
		this._toolitemHandlers['.uno:ViewDataSourceBrowser'] = function() {};
		this._toolitemHandlers['.uno:FormatArea'] = function() {};
		this._toolitemHandlers['.uno:SetBorderStyle'] = function() {};
		this._toolitemHandlers['.uno:LineStyle'] = function() {};
		this._toolitemHandlers['.uno:InsertFormula'] = function() {};
		this._toolitemHandlers['.uno:AutoSum'] = function() {};
		this._toolitemHandlers['.uno:ReplyComment'] = function() {};
		this._toolitemHandlers['.uno:DeleteComment'] = function() {};
		this._toolitemHandlers['.uno:CompareDocuments'] = function() {};
		this._toolitemHandlers['.uno:MergeDocuments'] = function() {};
		this._toolitemHandlers['.uno:FunctionBox'] = function() {};
		this._toolitemHandlers['.uno:EditAnnotation'] = function() {};
		this._toolitemHandlers['.uno:ShowAllNotes'] = function() {};
		this._toolitemHandlers['.uno:HideAllNotes'] = function() {};
		this._toolitemHandlers['.uno:ShareDocument'] = function() {};
		this._toolitemHandlers['.uno:EditDoc'] = function() {};
		this._toolitemHandlers['.uno:AssignLayout'] = function() {};
		this._toolitemHandlers['.uno:ConnectorToolbox'] = function() {};
		this._toolitemHandlers['.uno:PresentationCurrentSlide'] = function() {};
		this._toolitemHandlers['.uno:PresentationLayout'] = function() {};
		this._toolitemHandlers['.uno:FontworkGalleryFloater'] = function() {};
		this._toolitemHandlers['.uno:CapturePoint'] = function() {};
		this._toolitemHandlers['.uno:Objects3DToolbox'] = function() {};
		this._toolitemHandlers['.uno:InsertMath'] = function() {};
		this._toolitemHandlers['.uno:ShowAnnotations'] = function() {};
		this._toolitemHandlers['.uno:DeleteAnnotation'] = function() {};
		this._toolitemHandlers['.uno:NextAnnotation'] = function() {};
		this._toolitemHandlers['.uno:PreviousAnnotation'] = function() {};
		this._toolitemHandlers['.uno:AnimationEffects'] = function() {};
		this._toolitemHandlers['.uno:OptimizeTable'] = function() {};
		this._toolitemHandlers['.uno:TableDesign'] = function() {};
		this._toolitemHandlers['.uno:ContourDialog'] = function() {};
		this._toolitemHandlers['.uno:TextWrap'] = function() {};
		this._toolitemHandlers['.uno:AcceptTrackedChangeToNext'] = function() {};
		this._toolitemHandlers['.uno:RejectTrackedChangeToNext'] = function() {};
		this._toolitemHandlers['.uno:RedactDoc'] = function() {};
		this._toolitemHandlers['.uno:TableCellBackgroundColor'] = function() {};
		this._toolitemHandlers['.uno:FrameLineColor'] = function() {};
		this._toolitemHandlers['.uno:ProtectTraceChangeMode'] = function() {};
		this._toolitemHandlers['.uno:RowOperations'] = function() {};
		this._toolitemHandlers['.uno:ColumnOperations'] = function() {};
		this._toolitemHandlers['.uno:Insert'] = function() {};
		this._toolitemHandlers['.uno:InsertCell'] = function() {};
		this._toolitemHandlers['.uno:AddName'] = function() {};
		this._toolitemHandlers['.uno:DefineName'] = function() {};
		this._toolitemHandlers['.uno:ToolProtectionDocument'] = function() {};
		this._toolitemHandlers['.uno:Protect'] = function() {};
		this._toolitemHandlers['.uno:ImportFromFile'] = function() {};
		this._toolitemHandlers['.uno:PhotoAlbumDialog'] = function() {};
		this._toolitemHandlers['.uno:AutoFormat'] = function() {};
		this._toolitemHandlers['.uno:Spacing'] = function() {};

		this._toolitemHandlers['vnd.sun.star.findbar:FocusToFindbar'] = function() {};
	},

	onCommandStateChanged: function(e) {
		var commandName = e.commandName;
		var state = e.state;

		if (commandName === '.uno:CharFontName') {
			$('#fontnamecombobox').val(state).trigger('change');
		} else if (commandName === '.uno:FontHeight') {
			$('#fontsize').val(parseFloat(state)).trigger('change');
		} else if (commandName === '.uno:StyleApply') {
			$('#applystyle').val(state).trigger('change');
		}
	},

	_setupComboboxSelectionHandler: function(combobox, id, builder) {
		var items = builder.map['stateChangeHandler'];

		if (id === 'fontnamecombobox') {
			$(combobox).on('select2:select', function (e) {
				var font = e.params.data.text;
				builder.map.applyFont(font);
				builder.map.focus();
			});

			var state = items.getItemValue('.uno:CharFontName');
			$(combobox).val(state).trigger('change');
		}
		else if (id === 'fontsize') {
			$(combobox).on('select2:select', function (e) {
				builder.map.applyFontSize(parseFloat(e.params.data.text));
				builder.map.focus();
			});

			state = items.getItemValue('.uno:FontHeight');
			$(combobox).val(state).trigger('change');
		}
		else if (id === 'applystyle') {
			$(combobox).on('select2:select', function (e) {
				var style = e.target.value;
				var docType = builder.map.getDocType();

				if (style.startsWith('.uno:'))
					builder.map.sendUnoCommand(style);
				else if (docType === 'text')
					builder.map.applyStyle(style, 'ParagraphStyles');
				else if (docType === 'spreadsheet')
					builder.map.applyStyle(style, 'CellStyles');
				else if (docType === 'presentation' || docType === 'drawing')
					builder.map.applyLayout(style);

				builder.map.focus();
			});

			state = items.getItemValue('.uno:StyleApply');
			$(combobox).val(state).trigger('change');
		} else {
			$(combobox).on('select2:select', function (e) {
				var value = e.params.data.id + ';' + e.params.data.text;
				builder.callback('combobox', 'selected', combobox, value, builder);
			});
		}
	},

	_comboboxControl: function(parentContainer, data, builder) {
		if (!data.entries || data.entries.length === 0)
			return false;

		var select = L.DomUtil.createWithId('select', data.id, parentContainer);
		$(select).addClass(builder.options.cssClass);

		var processedData = [];

		data.entries.forEach(function (value, index) {
			var selected = parseInt(data.selectedEntries[0]) == index;
			var id = index;
			if (data.id === 'fontsize')
				id = parseFloat(value);
			if (data.id === 'fontnamecombobox')
				id = value;
			processedData.push({id: id, text: value, selected: selected});
		});
		console.log(processedData);

		$(select).select2({
			data: processedData,
			placeholder: _(builder._cleanText(data.text))
		});

		builder._setupComboboxSelectionHandler(select, data.id, builder);

		return false;
	},

	_comboboxControlHandler: function(parentContainer, data, builder) {
		if ((data.command === '.uno:StyleApply' && builder.map.getDocType() === 'spreadsheet') ||
			(data.id === ''))
			return false;

		return builder._comboboxControl(parentContainer, data, builder);
	},

	_overridenTabsControlHandler: function(parentContainer, data, builder) {
		data.tabs = builder.wizard.getTabs();
		return builder._tabsControlHandler(parentContainer, data, builder);
	},

	_colorControl: function(parentContainer, data, builder) {
		var commandOverride = data.command === '.uno:Color' && builder.map.getDocType() === 'text';
		if (commandOverride)
			data.command = '.uno:FontColor';

		var titleOverride = builder._getTitleForControlWithId(data.id);
		if (titleOverride)
			data.text = titleOverride;

		data.id = data.id ? data.id : (data.command ? data.command.replace('.uno:', '') : undefined);

		data.text = builder._cleanText(data.text);

		if (data.command) {
			var div = builder._createIdentifiable('div', 'unotoolbutton ' + builder.options.cssClass + ' ui-content unospan', parentContainer, data);

			var id = data.command.substr('.uno:'.length);
			div.id = id;

			div.title = data.text;
			$(div).tooltip();

			var icon = builder._createIconURL(data.command);
			var buttonId = id + 'img';

			var button = L.DomUtil.create('img', 'ui-content unobutton', div);
			button.src = icon;
			button.id = buttonId;

			var valueNode =  L.DomUtil.create('div', 'selected-color', div);

			var selectedColor;

			var updateFunction = function (color) {
				selectedColor = builder._getCurrentColor(data, builder);
				valueNode.style.backgroundColor = color ? color : selectedColor;
			};

			updateFunction();

			builder.map.on('commandstatechanged', function(e) {
				if (e.commandName === data.command)
					updateFunction();
			}, this);

			var noColorControl = (data.command !== '.uno:FontColor' && data.command !== '.uno:Color');

			$(div).click(function() {
				$(div).w2color({ color: selectedColor, transparent: noColorControl }, function (color) {
					if (color != null) {
						if (color) {
							updateFunction('#' + color);
							builder._sendColorCommand(builder, data, color);
						} else {
							updateFunction('#FFFFFF');
							builder._sendColorCommand(builder, data, 'transparent');
						}
					}
				});
			});
		}

		return false;
	},

	_insertTableControl: function(parentContainer, data, builder) {
		var control = builder._unoToolButton(parentContainer, data, builder);

		$(control.container).unbind('click');
		$(control.container).click(function () {
			if (!$('.inserttable-grid').length) {
				$(control.container).w2overlay(window.getInsertTablePopupHtml());
				window.insertTable();

				$('.inserttable-grid .row .col').click(function () {
					$(control.container).w2overlay();
				});
			}
		});
	},

	_shapesControl: function(parentContainer, data, builder) {
		var control = builder._unoToolButton(parentContainer, data, builder);

		$(control.container).unbind('click');
		$(control.container).click(function () {
			if (!$('.insertshape-grid').length) {
				$(control.container).w2overlay(window.getShapesPopupHtml());
				window.insertShapes();

				$('.insertshape-grid .row .col').click(function () {
					$(control.container).w2overlay();
				});
			}
		});
	},

	_conditionalFormatControl: function(parentContainer, data, builder) {
		var control = builder._unoToolButton(parentContainer, data, builder);

		$(control.container).unbind('click');
		$(control.container).click(function () {
			if (!$('#conditionalformatmenu-grid').length) {
				$(control.container).w2overlay(window.getConditionalFormatMenuHtml());

				$('#conditionalformatmenu-grid tr td').click(function () {
					$(control.container).w2overlay();
				});
			}
		});
	},

	_insertGraphicControl: function(parentContainer, data, builder) {
		var control = builder._unoToolButton(parentContainer, data, builder);

		$(control.container).unbind('click');
		$(control.container).click(function () {
			if (builder.map['wopi'].EnableInsertRemoteImage) {
				$(control.container).w2menu({
					items: [
						{id: 'localgraphic', text: _('Insert Local Image')},
						{id: 'remotegraphic', text: _UNO('.uno:InsertGraphic', '', true)}
					],
					onSelect: function (event) {
						if (event.item.id === 'localgraphic') {
							L.DomUtil.get('insertgraphic').click();
						} else if (event.item.id === 'remotegraphic') {
							builder.map.fire('postMessage', {msgId: 'UI_InsertGraphic'});
						}
					}
				});
			} else {
				L.DomUtil.get('insertgraphic').click();
			}
		});
	},

	_insertAnnotationControl: function(parentContainer, data, builder) {
		var control = builder._unoToolButton(parentContainer, data, builder);

		$(control.container).unbind('click');
		$(control.container).click(function () {builder.map.insertComment();});
	},

	_clipboardButtonControl: function(parentContainer, data, builder) {
		var control = builder._unoToolButton(parentContainer, data, builder);

		if (builder.map._clip) {
			$(control.container).unbind('click');
			$(control.container).click(function () {
				builder.map._clip.filterExecCopyPaste(data.command);
			});
		}
	},

	_toolbarItemControl: function(parentContainer, data, builder) {
		builder.options.useInLineLabelsForUnoButtons = false;
		var control = builder._unoToolButton(parentContainer, data, builder);

		$(control.container).unbind('click');
		$(control.container).click(function () {
			builder.callback('toolbox', 'click', {id: data.parent.id}, data.command, builder);
		});
	},

	_lineSpacingControl: function(parentContainer, data, builder) {
		var control = builder._unoToolButton(parentContainer, data, builder);

		$(control.container).unbind('click');
		$(control.container).click(function () {
			$(control.container).w2menu({
				items: [
					{id: 'spacepara1', text: _UNO('.uno:SpacePara1'), uno: 'SpacePara1'},
					{id: 'spacepara15', text: _UNO('.uno:SpacePara15'), uno: 'SpacePara15'},
					{id: 'spacepara2', text: _UNO('.uno:SpacePara2'), uno: 'SpacePara2'},
					{type: 'break'},
					{id: 'paraspaceincrease', text: _UNO('.uno:ParaspaceIncrease'), uno: 'ParaspaceIncrease'},
					{id: 'paraspacedecrease', text: _UNO('.uno:ParaspaceDecrease'), uno: 'ParaspaceDecrease'}
				],
				onSelect: function (event) {
					builder.map.sendUnoCommand('.uno:' + event.item.uno);
				}
			});
		});
	},

	_symbolControl: function(parentContainer, data, builder) {
		var control = builder._unoToolButton(parentContainer, data, builder);

		$(control.container).unbind('click');
		$(control.container).click(function () {
			builder.map.sendUnoCommand('.uno:InsertSymbol');
		});
	},

	_startPresentationControl: function(parentContainer, data, builder) {
		var control = builder._unoToolButton(parentContainer, data, builder);

		$(control.container).unbind('click');
		$(control.container).click(function () {
			builder.map.fire('fullscreen');
		});
	},

	_saveControl: function(parentContainer, data, builder) {
		var control = builder._unoToolButton(parentContainer, data, builder);

		$(control.container).unbind('click');
		$(control.container).click(function () {
			// Save only when not read-only.
			if (builder.map._permission !== 'readonly') {
				builder.map.fire('postMessage', {msgId: 'UI_Save'});
				if (!builder.map._disableDefaultAction['UI_Save']) {
					builder.map.save(false, false);
				}
			}
		});
	},

	build: function(parent, data, hasVerticalParent, parentHasManyChildren) {
		this._amendJSDialogData(data);

		if (hasVerticalParent === undefined) {
			parent = L.DomUtil.create('table', 'root-container ' + this.options.cssClass, parent);
			parent = L.DomUtil.create('tr', '', parent);
		}

		var containerToInsert = parent;

		for (var childIndex in data) {
			var childData = data[childIndex];
			if (!childData)
				continue;

			var childType = childData.type;
			if (childType === 'toolbox' && !childData.id)
				continue;

			if (parentHasManyChildren) {
				if (!hasVerticalParent)
					var td = L.DomUtil.create('td', '', containerToInsert);
				else {
					containerToInsert = L.DomUtil.create('tr', '', parent);
					td = L.DomUtil.create('td', '', containerToInsert);
				}
			} else {
				td = containerToInsert;
			}

			var isVertical = childData.vertical === 'true' ? true : false;

			this._parentize(childData);
			var processChildren = true;

			if ((childData.id === undefined || childData.id === '' || childData.id === null)
				&& (childType == 'checkbox' || childType == 'radiobutton')) {
				continue;
			}

			var hasManyChildren = childData.children && childData.children.length > 1;
			if (hasManyChildren) {
				var tableId = childData.id ? childData.id.replace(' ', '') : 'undefined';
				var table = L.DomUtil.createWithId('table', 'table-' + tableId, td);
				$(table).addClass(this.options.cssClass);
				var childObject = L.DomUtil.create('tr', '', table);
			} else {
				childObject = td;
			}

			var handler = this._controlHandlers[childType];
			var twoPanelsAsChildren =
			    childData.children && childData.children.length == 2
			    && childData.children[0] && childData.children[0].type == 'panel'
			    && childData.children[1] && childData.children[1].type == 'panel';

			if (twoPanelsAsChildren) {
				handler = this._controlHandlers['paneltabs'];
				processChildren = handler(childObject, childData.children, this);
			} else {
				if (handler)
					processChildren = handler(childObject, childData, this);
				else
					console.warn('Unsupported control type: \"' + childType + '\"');

				if (childType === 'toolbox' && hasVerticalParent === true && childData.children.length === 1)
					this.options.useInLineLabelsForUnoButtons = true;

				if (processChildren && childData.children != undefined)
					this.build(childObject, childData.children, isVertical, hasManyChildren);
				else if (childData.visible && (childData.visible === false || childData.visible === 'false')) {
					$('#' + childData.id).addClass('hidden-from-event');
				}

				this.options.useInLineLabelsForUnoButtons = false;
			}
		}
	}

});

L.control.notebookbarBuilder = function (options) {
	var builder = new L.Control.NotebookbarBuilder(options);
	builder._setup(options);
	builder._overrideHandlers();
	builder._customizeOptions();
	options.map.on('commandstatechanged', builder.onCommandStateChanged, builder);
	return builder;
};

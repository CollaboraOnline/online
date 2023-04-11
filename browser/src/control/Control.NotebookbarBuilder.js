/* -*- js-indent-level: 8 -*- */
/*
 * L.Control.NotebookbarBuilder
 */

/* global $ _ _UNO JSDialog */
L.Control.NotebookbarBuilder = L.Control.JSDialogBuilder.extend({

	_customizeOptions: function() {
		this.options.noLabelsForUnoButtons = true;
		this.options.useInLineLabelsForUnoButtons = false;
		this.options.cssClass = 'notebookbar';
	},

	_overrideHandlers: function() {
		this._controlHandlers['combobox'] = this._comboboxControlHandler;
		this._controlHandlers['listbox'] = this._comboboxControlHandler;
		this._controlHandlers['tabcontrol'] = this._overriddenTabsControlHandler;
		this._controlHandlers['menubartoolitem'] = this._inlineMenubarToolItemHandler;
		this._controlHandlers['bigmenubartoolitem'] = this._bigMenubarToolItemHandler;
		this._controlHandlers['bigtoolitem'] = this._bigtoolitemHandler;
		this._controlHandlers['toolbox'] = this._toolboxHandler;

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
		this._toolitemHandlers['.uno:CharSpacing'] = this._CharSpacing;
		this._toolitemHandlers['.uno:Cut'] = this._clipboardButtonControl;
		this._toolitemHandlers['.uno:Copy'] = this._clipboardButtonControl;
		this._toolitemHandlers['.uno:Paste'] = this._clipboardButtonControl;
		this._toolitemHandlers['.uno:BasicShapes'] = this._shapesControl;
		this._toolitemHandlers['.uno:ConditionalFormatMenu'] = this._conditionalFormatControl;
		this._toolitemHandlers['.uno:SetBorderStyle'] = this._borderStyleControl;
		this._toolitemHandlers['.uno:SetDefault'] = this._formattingControl;
		this._toolitemHandlers['.uno:Save'] = this._saveControl;
		this._toolitemHandlers['.uno:SaveAs'] = this._saveAsControl;
		this._toolitemHandlers['.uno:Print'] = this._printControl;
		this._toolitemHandlers['.uno:InsertPageHeader'] = this._headerFooterControl;
		this._toolitemHandlers['.uno:InsertPageFooter'] = this._headerFooterControl;
		this._toolitemHandlers['.uno:Text'] = this._insertTextBoxControl;
		this._toolitemHandlers['.uno:DrawText'] = this._insertTextBoxControl;
		this._toolitemHandlers['.uno:VerticalText'] = this._insertTextBoxControl;
		this._toolitemHandlers['.uno:OnlineHelp'] = this._onlineHelpControl;
		this._toolitemHandlers['.uno:ForumHelp'] = this._onlineHelpControl;
		this._toolitemHandlers['.uno:KeyboardShortcuts'] = this._onlineHelpControl;
		this._toolitemHandlers['.uno:ReportIssue'] = this._onlineHelpControl;
		this._toolitemHandlers['.uno:LatestUpdates'] = this._onlineHelpControl;
		this._toolitemHandlers['.uno:Feedback'] = this._onlineHelpControl;
		this._toolitemHandlers['.uno:About'] = this._onlineHelpControl;
		this._toolitemHandlers['.uno:FullScreen'] = this._onlineHelpControl;
		this._toolitemHandlers['.uno:LanguageMenu'] = JSDialog.notebookbarLanguageSelector;

		this._toolitemHandlers['.uno:SelectWidth'] = function() {};
		this._toolitemHandlers['.uno:SetOutline'] = function() {};
		this._toolitemHandlers['.uno:DesignerDialog'] = function() {};
		this._toolitemHandlers['.uno:Zoom'] = function() {};
		this._toolitemHandlers['.uno:PrintPreview'] = function() {};
		this._toolitemHandlers['.uno:InsertObject'] = function() {};
		this._toolitemHandlers['.uno:Gallery'] = function() {};
		this._toolitemHandlers['.uno:InsertAVMedia'] = function() {};
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
		this._toolitemHandlers['.uno:ConnectorToolbox'] = this._shapesControl;
		this._toolitemHandlers['.uno:PresentationCurrentSlide'] = function() {};
		this._toolitemHandlers['.uno:PresentationLayout'] = function() {};
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
		this._toolitemHandlers['.uno:ToolProtectionDocument'] = function() {};
		this._toolitemHandlers['.uno:ImportFromFile'] = function() {};
		this._toolitemHandlers['.uno:PhotoAlbumDialog'] = function() {};
		this._toolitemHandlers['.uno:AutoFormat'] = function() {};
		this._toolitemHandlers['.uno:Spacing'] = function() {};
		this._toolitemHandlers['.uno:ToggleObjectRotateMode'] = function() {};
		this._toolitemHandlers['.uno:RotateRight'] = function() {};
		this._toolitemHandlers['.uno:ToggleObjectBezierMode'] = function() {};
		this._toolitemHandlers['.uno:AnchorMenu'] = function() {};
		this._toolitemHandlers['.uno:ExtrusionToggle'] = function() {};
		this._toolitemHandlers['.uno:ExtrusionDepthFloater'] = function() {};
		this._toolitemHandlers['.uno:ExtrusionDirectionFloater'] = function() {};
		this._toolitemHandlers['.uno:Extrusion3DColor'] = function() {};
		this._toolitemHandlers['.uno:ExtrusionSurfaceFloater'] = function() {};
		this._toolitemHandlers['.uno:FontworkShapeType'] = function() {};
		this._toolitemHandlers['.uno:FontworkSameLetterHeights'] = function() {};
		this._toolitemHandlers['.uno:FontworkAlignmentFloater'] = function() {};
		this._toolitemHandlers['.uno:FontworkCharacterSpacingFloater'] = function() {};
		this._toolitemHandlers['.uno:AdvancedMode'] = function() {};
		this._toolitemHandlers['.uno:Shear'] = function() {};
		this._toolitemHandlers['.uno:CrookSlant'] = function() {};
		this._toolitemHandlers['.uno:LineEndStyle'] = function() {};
		this._toolitemHandlers['.uno:FillShadow'] = function() {};
		this._toolitemHandlers['.uno:BezierConvert'] = function() {};
		this._toolitemHandlers['.uno:BezierSymmetric'] = function() {};
		this._toolitemHandlers['.uno:BezierClose'] = function() {};
		this._toolitemHandlers['.uno:BezierEliminatePoints'] = function() {};
		this._toolitemHandlers['.uno:BezierMove'] = function() {};
		this._toolitemHandlers['.uno:BezierCutLine'] = function() {};
		this._toolitemHandlers['.uno:BezierInsert'] = function() {};
		this._toolitemHandlers['.uno:BezierEdge'] = function() {};
		this._toolitemHandlers['.uno:BezierDelete'] = function() {};
		this._toolitemHandlers['.uno:BezierSmooth'] = function() {};
		this._toolitemHandlers['.uno:GlueEditMode'] = function() {};

		/*Draw Home Tab*/
		this._toolitemHandlers['.uno:ZoomMode'] = function() {};
		this._toolitemHandlers['.uno:ObjectAlign'] = function() {};
		this._toolitemHandlers['.uno:ObjectPosition'] = function() {};
		this._toolitemHandlers['.uno:GlueInsertPoint'] = function() {};
		this._toolitemHandlers['.uno:SnapPoints'] = function() {};
		this._toolitemHandlers['.uno:SnapBorder'] = function() {};
		this._toolitemHandlers['.uno:HelplinesMove'] = function() {};
		this._toolitemHandlers['.uno:SnapFrame'] = function() {};
		this._toolitemHandlers['.uno:HelplinesVisible'] = function() {};
		this._toolitemHandlers['.uno:HelplinesUse'] = function() {};
		this._toolitemHandlers['.uno:GridVisible'] = function() {};
		this._toolitemHandlers['.uno:GridUse'] = function() {};

		/*Graphic Tab*/
		this._toolitemHandlers['.uno:Crop'] = function() {};
		this._toolitemHandlers['.uno:GraphicFilterToolbox'] = function() {};
		this._toolitemHandlers['.uno:SaveGraphic'] = function() {};
		this._toolitemHandlers['.uno:InsertCaptionDialog'] = function() {};
		this._toolitemHandlers['.uno:CompressGraphic'] = function() {};
		this._toolitemHandlers['.uno:GraphicDialog'] = function() {};
		this._toolitemHandlers['.uno:BorderDialog'] = function() {};
		this._toolitemHandlers['.uno:FormatArea'] = function() {};

		/*Calc: Data Tab*/
		this._toolitemHandlers['.uno:DataProvider'] = function() {};
		this._toolitemHandlers['.uno:ManageXMLSource'] = function() {};
		this._toolitemHandlers['.uno:DataStreams'] = function() {};
		this._toolitemHandlers['.uno:InsertExternalDataSource'] = function() {};
		this._toolitemHandlers['.uno:DataProviderRefresh'] = function() {};
		this._toolitemHandlers['.uno:DataSubTotals'] = function() {};
		this._toolitemHandlers['.uno:DefineDBName'] = function() {};
		this._toolitemHandlers['.uno:SelectDB'] = function() {};
		this._toolitemHandlers['.uno:DataAreaRefresh'] = function() {};
		this._toolitemHandlers['.uno:TextToColumns'] = function() {};
		this._toolitemHandlers['.uno:DataConsolidate'] = function() {};

		this._toolitemHandlers['vnd.sun.star.findbar:FocusToFindbar'] = function() {};
	},

	_bigtoolitemHandler: function(parentContainer, data, builder) {
		var noLabels = builder.options.noLabelsForUnoButtons;
		builder.options.noLabelsForUnoButtons = false;

		builder._toolitemHandler(parentContainer, data, builder);

		builder.options.noLabelsForUnoButtons = noLabels;

		return false;
	},

	onCommandStateChanged: function(e) {
		var commandName = e.commandName;
		var state = e.state;

		if (commandName === '.uno:CharFontName') {
			if (window.ThisIsTheiOSApp) {
				if (state === '')
					$('#fontnamecomboboxios').html(_('Font Name'));
				else
					$('#fontnamecomboboxios').html(state);
				window.LastSetiOSFontNameButtonFont = state;
			}
		} else if (commandName === '.uno:StyleApply') {
			$('#applystyle').val(state).trigger('change');
		}
		else if (commandName === '.uno:ModifiedStatus') {
			if (e.state === 'true') {
				$('#Save1').addClass('savemodified');
				$('#Save').addClass('savemodified');
			}
			else {
				$('#Save1').removeClass('savemodified');
				$('#Save').removeClass('savemodified');
			}
		}
	},

	_createiOsFontButton: function(parentContainer, data, builder) {
		// Fix issue #5838 Use unique IDs for font name combobox elements
		var table = L.DomUtil.createWithId('div', data.id, parentContainer);
		var row = L.DomUtil.create('div', 'notebookbar row', table);
		var button = L.DomUtil.createWithId('button', data.id + 'ios', row);

		$(table).addClass('select2 select2-container select2-container--default');
		// Fix issue #5838 Don't add the "select2-selection--single" class
		$(row).addClass('select2-selection');
		$(button).addClass('select2-selection__rendered');

		if (data.selectedEntries.length && data.entries[data.selectedEntries[0]])
			button.innerText = data.entries[data.selectedEntries[0]];
		else if (window.LastSetiOSFontNameButtonFont)
			button.innerText = window.LastSetiOSFontNameButtonFont;
		else if (data.text)
			button.innerText = data.text;
		var map = builder.map;
		window.MagicFontNameCallback = function(font) {
			button.innerText = font;
			map.applyFont(font);
			map.focus();
		};
		button.onclick = function() {

			// There doesn't seem to be a way to pre-select an entry in the
			// UIFontPickerViewController so no need to pass the
			// current font here.
			window.postMobileMessage('FONTPICKER');
		};
	},

	_comboboxControl: function(parentContainer, data, builder) {
		if (!data.entries || data.entries.length === 0)
			return false;

		if (window.ThisIsTheiOSApp && data.id === 'fontnamecombobox') {
			this._createiOsFontButton(parentContainer, data, builder);
			return false;
		}

		var container = L.DomUtil.createWithId('div', data.id, parentContainer);
		L.DomUtil.addClass(container, builder.options.cssClass);
		L.DomUtil.addClass(container, 'ui-combobox');
		var select = L.DomUtil.create('select', builder.options.cssClass, container);
		builder.map.uiManager.enableTooltip(container);

		var processedData = [];

		var isFontSizeSelector = (data.id === 'fontsize' || data.id === 'fontsizecombobox');
		var isFontSelector = (data.id === 'fontnamecombobox');

		if (isFontSelector) {
			builder.map.createFontSelector('.notebookbar #' + data.id + ' select');
			return;
		} else if (isFontSizeSelector) {
			builder.map.createFontSizeSelector('.notebookbar #' + data.id + ' select');
			return;
		}

		data.entries.forEach(function (value, index) {
			var selected = parseInt(data.selectedEntries[0]) == index;
			var id = index;
			if (isFontSizeSelector)
				id = parseFloat(value);
			if (isFontSelector)
				id = value;
			processedData.push({id: id, text: value, selected: selected});
		});

		$(select).select2({
			data: processedData,
			placeholder: _(builder._cleanText(data.text))
		});

		$(select).on('select2:select', function (e) {
			var value = e.params.data.id + ';' + e.params.data.text;
			builder.callback('combobox', 'selected', container, value, builder);
		});

		return false;
	},

	_comboboxControlHandler: function(parentContainer, data, builder) {
		if ((data.command === '.uno:StyleApply' && builder.map.getDocType() === 'spreadsheet') ||
			(data.id === ''))
			return false;

		return builder._comboboxControl(parentContainer, data, builder);
	},

	// overriden
	_createTabClick: function(builder, t, tabs, contentDivs, tabIds)
	{
		var tooltipCollapsed = _('Tap to expand');
		var tooltipExpanded = _('Tap to collapse');
		$(tabs[t]).prop('title', tooltipExpanded);
		return function(event) {
			var tabIsSelected = $(tabs[t]).hasClass('selected');
			var notebookbarIsCollapsed = builder.wizard.isCollapsed();

			if (tabIsSelected && !notebookbarIsCollapsed) {
				builder.wizard.collapse();
				$(tabs[t]).prop('title', tooltipCollapsed);
			} else if (notebookbarIsCollapsed) {
				builder.wizard.extend();
				$(tabs[t]).prop('title', tooltipExpanded);
			}

			$(tabs[t]).addClass('selected');
			tabs[t].setAttribute('aria-selected', 'true');
			tabs[t].removeAttribute('tabindex');
			for (var i = 0; i < tabs.length; i++) {
				if (i !== t) {
					$(tabs[i]).removeClass('selected');
					tabs[i].setAttribute('aria-selected', 'false');
					tabs[i].tabIndex = -1;
					$(tabs[i]).prop('title', '');
					$(contentDivs[i]).hide();
				}
			}
			$(contentDivs[t]).show();
			$(window).resize();
			builder.wizard.selectedTab(tabIds[t]);

			// Keep focus if user is navigating via keyboard.
			if (!tabs[t].enterPressed) {
				// don't lose focus on tab change
				event.preventDefault();
				builder.map.focus();
				t.enterPressed = false;
			}
		};
	},

	_overriddenTabsControlHandler: function(parentContainer, data, builder) {
		data.tabs = builder.wizard.getTabs();
		return builder._tabsControlHandler(parentContainer, data, builder, _('Tap to collapse'));
	},

	_toolboxHandler: function(parentContainer, data) {
		if (data.enabled === false || data.enabled === 'false') {
			for (var index in data.children) {
				data.children[index].enabled = false;
			}
		}

		return true;
	},

	_makeW2MenuFocusable: function(builder, id, menu, parentId, itemCallback) {
		var element = document.getElementById(id);
		var rows = element.getElementsByTagName('tr');
		rows = Array.from(rows);

		if (rows.length > 0) {
			var tabStartIndex = 1000; // Shouldn't be 0 (zero).
			// Loop focus inside menu - start.
			var parentNode = rows[0].parentNode;
			var trBegin = document.createElement('tr');
			trBegin.tabIndex = tabStartIndex - 1;
			trBegin.id = id + '-beginning';
			parentNode.insertBefore(trBegin, parentNode.children[0]);

			var trEnd = document.createElement('tr');
			trEnd.id = id + '-ending';
			trEnd.tabIndex = tabStartIndex + rows.length;
			parentNode.appendChild(trEnd);

			trBegin.addEventListener('focusin', function() {
				rows[rows.length - 1].focus();
			});

			trEnd.addEventListener('focusin', function() {
				rows[0].focus();
			});
			// Loop focus inside menu - end.

			rows.forEach(function(row, index) {
				if (!menu[index].type || (menu[index].type !== 'break' && menu[index].type !== 'separator'))
					row.tabIndex = index + tabStartIndex;

				row.onkeydown = function(e) {
					var elementToHide = document.getElementById(id);
					if (e.code === 'Enter' || e.code === 'Space') {
						itemCallback({ item: menu[index] });
						if (elementToHide)
							elementToHide.style.display = 'none';
					}
					else if (e.code === 'Escape') {
						if (elementToHide)
							elementToHide.style.display = 'none';
						document.getElementById(parentId).focus();
					}
				};
			});

			trEnd.focus();
		}
	},

	_menubarToolItemHandler: function(parentContainer, data, builder) {
		if (data.id && data.id.startsWith('downloadas-')) {
			var format = data.id.substring('downloadas-'.length);
			builder.map._docLayer.registerExportFormat(data.text, format);

			if (builder.map['wopi'].HideExportOption)
				return false;
		}

		data.command = data.id;

		var isDownloadAsGroup = data.id === 'downloadas';
		var isSaveAsGroup = data.id === 'saveas';
		var isExportAsGroup = data.id === 'exportas';
		var options = {};
		var hasCustomMenu = isDownloadAsGroup || isSaveAsGroup || isExportAsGroup;
		if (hasCustomMenu) {
			options.hasDropdownArrow = true;
		}

		var control = builder._unoToolButton(parentContainer, data, builder, options);
		var submenuOpts = builder._getSubmenuOpts(builder.options.map._docLayer._docType, data.id, builder);

		$(control.container).unbind('click.toolbutton');
		if (!builder.map.isLockedItem(data)) {
			$(control.container).click(function () {
				if (!hasCustomMenu) {
					L.control.menubar()._executeAction.bind({_map: builder.options.map})(undefined, {id: data.id});
					return;
				}

				var itemCallback = function(event) {
					builder.map.dispatch(event.item.id);
				};

				$(control.container).w2menu({
					name: 'download-as-menu',
					items: submenuOpts,
					onSelect: itemCallback
				});

				builder._makeW2MenuFocusable(builder, 'w2ui-overlay-download-as-menu', submenuOpts, data.id, itemCallback);
			});
		}

		for (var i in submenuOpts) {
			var item = submenuOpts[i];

			if (item.id.startsWith('export')) {
				var format = item.id.substring('export'.length);
				builder.map._docLayer.registerExportFormat(item.text, format);
			}
			else if (item.id.startsWith('downloadas-')) {
				var format = item.id.substring('downloadas-'.length);
				builder.map._docLayer.registerExportFormat(item.text, format);
			}
		}
	},

	_inlineMenubarToolItemHandler: function(parentContainer, data, builder) {
		var originalInLineState = builder.options.useInLineLabelsForUnoButtons;
		builder.options.useInLineLabelsForUnoButtons = true;

		builder._menubarToolItemHandler(parentContainer, data, builder);

		builder.options.useInLineLabelsForUnoButtons = originalInLineState;

		return false;
	},

	_bigMenubarToolItemHandler: function(parentContainer, data, builder) {
		var noLabels = builder.options.noLabelsForUnoButtons;
		builder.options.noLabelsForUnoButtons = false;

		builder._menubarToolItemHandler(parentContainer, data, builder);

		builder.options.noLabelsForUnoButtons = noLabels;

		return false;
	},

	_getSubmenuOpts: function(docType, id, builder) {
		switch (id) {
		case 'downloadas':
			return builder._getDownloadAsSubmenuOpts(docType);
		case 'saveas':
			return builder._getSaveAsSubmenuOpts(docType);
		case 'exportas':
			return builder._getExportAsSubmenuOpts(docType);
		}
		return [];
	},

	_getDownloadAsSubmenuOpts: function(docType) {
		var submenuOpts = [];

		if (docType === 'text') {
			submenuOpts = [
				{
					'id': 'downloadas-odt',
					'text': _('ODF text document (.odt)')
				},
				{
					'id': 'downloadas-rtf',
					'text': _('Rich Text (.rtf)')
				},
				{
					'id': 'downloadas-docx',
					'text': _('Word Document (.docx)')
				},
				{
					'id': 'downloadas-doc',
					'text': _('Word 2003 Document (.doc)')
				},
				{
					'id': !window.ThisIsAMobileApp ? 'exportepub' : 'downloadas-epub',
					'text': _('EPUB (.epub)'),
					'command': !window.ThisIsAMobileApp ? 'exportepub' : 'downloadas-epub'
				},
				{
					'id': !window.ThisIsAMobileApp ? 'exportpdf' : 'downloadas-pdf',
					'text': _('PDF Document (.pdf)'),
					'command': !window.ThisIsAMobileApp ? 'exportpdf' : 'downloadas-pdf'
				}
			];
		} else if (docType === 'spreadsheet') {
			submenuOpts = [
				{
					'id': 'downloadas-ods',
					'text': _('ODF spreadsheet (.ods)')
				},
				{
					'id': 'downloadas-xlsx',
					'text': _('Excel Spreadsheet (.xlsx)')
				},
				{
					'id': 'downloadas-xls',
					'text': _('Excel 2003 Spreadsheet (.xls)')
				},
				{
					'id': 'downloadas-csv',
					'text': _('CSV File (.csv)')
				},
				{
					'id': !window.ThisIsAMobileApp ? 'exportpdf' : 'downloadas-pdf',
					'text': _('PDF Document (.pdf)'),
					'command': !window.ThisIsAMobileApp ? 'exportpdf' : 'downloadas-pdf'
				}
			];
		} else if (docType === 'presentation') {
			submenuOpts = [
				{
					'id': 'downloadas-odp',
					'text': _('ODF presentation (.odp)')
				},
				{
					'id': 'downloadas-odg',
					'text': _('ODF Drawing (.odg)')
				},
				{
					'id': 'downloadas-pptx',
					'text': _('PowerPoint Presentation (.pptx)')
				},
				{
					'id': 'downloadas-ppt',
					'text': _('PowerPoint 2003 Presentation (.ppt)')
				},
				{
					'id': !window.ThisIsAMobileApp ? 'exportpdf' : 'downloadas-pdf',
					'text': _('PDF Document (.pdf)'),
					'command': !window.ThisIsAMobileApp ? 'exportpdf' : 'downloadas-pdf'
				}
			];
		}

		submenuOpts.forEach(function mapIconToItem(menuItem) {
			menuItem.icon = menuItem.id + '-submenu-icon';
		});

		return submenuOpts;
	},

	_getSaveAsSubmenuOpts: function(docType) {
		var submenuOpts = [];

		if (docType === 'text') {
			submenuOpts = [
				{
					'id': 'saveas-odt',
					'text': _('ODF text document (.odt)')
				},
				{
					'id': 'saveas-rtf',
					'text': _('Rich Text (.rtf)')
				},
				{
					'id': 'saveas-docx',
					'text': _('Word Document (.docx)')
				},
				{
					'id': 'saveas-doc',
					'text': _('Word 2003 Document (.doc)')
				}
			];
		} else if (docType === 'spreadsheet') {
			submenuOpts = [
				{
					'id': 'saveas-ods',
					'text': _('ODF spreadsheet (.ods)')
				},
				{
					'id': 'saveas-xlsx',
					'text': _('Excel Spreadsheet (.xlsx)')
				},
				{
					'id': 'saveas-xls',
					'text': _('Excel 2003 Spreadsheet (.xls)')
				}
			];
		} else if (docType === 'presentation') {
			submenuOpts = [
				{
					'id': 'saveas-odp',
					'text': _('ODF presentation (.odp)')
				},
				{
					'id': 'saveas-pptx',
					'text': _('PowerPoint Presentation (.pptx)')
				},
				{
					'id': 'saveas-ppt',
					'text': _('PowerPoint 2003 Presentation (.ppt)')
				}
			];
		}

		submenuOpts.forEach(function mapIconToItem(menuItem) {
			menuItem.icon = menuItem.id + '-submenu-icon';
		});

		return submenuOpts;
	},

	_getExportAsSubmenuOpts: function(docType) {
		var submenuOpts = [];

		if (docType === 'text') {
			submenuOpts = [
				{
					'id': 'exportas-pdf',
					'text': _('PDF Document (.pdf)')
				},
				{
					'id': 'exportas-epub',
					'text': _('EPUB (.epub)')
				}
			];
		} else if (docType === 'spreadsheet') {
			submenuOpts = [
				{
					'id': 'exportas-pdf',
					'text': _('PDF Document (.pdf)')
				}
			];
		} else if (docType === 'presentation') {
			submenuOpts = [
				{
					'id': 'exportas-pdf',
					'text': _('PDF Document (.pdf)')
				}
			];
		} else if (docType === 'drawing') {
			submenuOpts = [
				{
					'id': 'exportas-pdf',
					'text': _('PDF Document (.pdf)')
				}
			];
		}

		submenuOpts.forEach(function mapIconToItem(menuItem) {
			menuItem.icon = menuItem.id + '-submenu-icon';
		});

		return submenuOpts;
	},

	_headerFooterControl: function(parentContainer, data, builder) {
		var control = builder._unoToolButton(parentContainer, data, builder);

		$(control.container).unbind('click.toolbutton');
		$(control.container).click(function () {
			if (!$(control.container).hasClass('disabled')) {
				builder.refreshSidebar = true;
				var command = data.command + '?On:bool=true';
				builder.callback('toolbutton', 'click', control.button, command, builder);
			}
		});
		builder._preventDocumentLosingFocusOnClick(control.container);
	},

	_insertTextBoxControl: function(parentContainer, data, builder) {
		var control = builder._unoToolButton(parentContainer, data, builder);

		$(control.container).unbind('click.toolbutton');
		$(control.container).click(function () {
			builder.map.sendUnoCommand(data.command + '?CreateDirectly:bool=true');
		});
		builder._preventDocumentLosingFocusOnClick(control.container);
	},

	_onlineHelpControl: function(parentContainer, data, builder) {
		var originalDataId = data.id; // builder can change this
		var control = builder._unoToolButton(parentContainer, data, builder);

		$(control.container).unbind('click.toolbutton');
		$(control.container).click(function () {
			L.control.menubar()._executeAction.bind({_map: builder.options.map})(undefined, {id: originalDataId});
		});
		builder._preventDocumentLosingFocusOnClick(control.container);
	},

	_insertTableControl: function(parentContainer, data, builder) {
		var options = {hasDropdownArrow: true};
		var control = builder._unoToolButton(parentContainer, data, builder, options);

		$(control.container).unbind('click.toolbutton');
		$(control.container).click(function () {
			if (!$('.inserttable-grid').length) {
				$(control.container).w2overlay(window.getInsertTablePopupHtml());
				window.insertTable();

				$('.inserttable-grid .row .col').click(function () {
					$(control.container).w2overlay();
				});
			}
		});
		builder._preventDocumentLosingFocusOnClick(control.container);
	},

	_shapesControl: function(parentContainer, data, builder) {
		var options = {hasDropdownArrow: true};
		var control = builder._unoToolButton(parentContainer, data, builder, options);

		$(control.container).unbind('click.toolbutton');
		$(control.container).click(function () {
			if (!$('.insertshape-grid').length) {
				$(control.container).w2overlay(window.getShapesPopupHtml());
				if (data.command === '.uno:ConnectorToolbox') {
					window.insertShapes('insertconnectors');
				} else {
					window.insertShapes('insertshapes');
				}

				$('.insertshape-grid .row .col').click(function () {
					$(control.container).w2overlay();
				});
			}
		});
		builder._preventDocumentLosingFocusOnClick(control.container);
	},

	_conditionalFormatControl: function(parentContainer, data, builder) {
		var options = {hasDropdownArrow: true};
		var control = builder._unoToolButton(parentContainer, data, builder, options);

		var closeAll = function (skip) {
			var menus = ['conditionalformatmenu', 'conditionalformatmenu-sub'];
			for (var i = 0; i < menus.length; ++i) {
				// called on onHide so skip it, it is already being hidden
				if (skip === menus[i])
					continue;
				var div = $('#w2ui-overlay-'+ menus[i]);
				if (div.length && div[0])
					div[0].hide();
			}
		};

		var menu = [
			{text: _UNO('.uno:ConditionalFormatDialog', 'spreadsheet'), uno: 'ConditionalFormatDialog'},
			{text: _UNO('.uno:ColorScaleFormatDialog', 'spreadsheet'), uno: 'ColorScaleFormatDialog'},
			{text: _UNO('.uno:DataBarFormatDialog', 'spreadsheet'), uno: 'DataBarFormatDialog'},
			{text: _UNO('.uno:IconSetFormatDialog', 'spreadsheet'), uno: 'IconSetFormatDialog', html: window.getConditionalFormatMenuHtml('iconsetoverlay') },
			{text: _UNO('.uno:CondDateFormatDialog', 'spreadsheet'), uno: 'CondDateFormatDialog'},
			{type: 'separator'},
			{text: _UNO('.uno:ConditionalFormatManagerDialog', 'spreadsheet'), uno: 'ConditionalFormatManagerDialog'}
		];

		$(control.container).unbind('click.toolbutton');
		$(control.container).click(function () {
			if (!$('#conditionalformatmenu-grid').length) {
				var itemCallback = function(event) {
					if (event.item.html && !$('#w2ui-overlay-conditionalformatmenu-sub').length) {
						$(event.originalEvent.target).w2overlay({
							name: 'conditionalformatmenu-sub',
							html: event.item.html,
							left: 100,
							top: -20,
							noTip: true,
							onHide: function() {
								closeAll(this.name);
							}
						});
						if ($('#iconsetoverlay').length) {
							$('#iconsetoverlay').click(function() {
								builder.map.sendUnoCommand('.uno:IconSetFormatDialog');
								closeAll();
							});
						}
					} else if (!event.item.html) {
						builder.map.sendUnoCommand('.uno:' + event.item.uno);
						closeAll();
					}
				};

				$(control.container).w2menu({
					name: 'conditionalformatmenu',
					items: menu,
					keepOpen: true,
					onSelect: itemCallback
				});

				builder._makeW2MenuFocusable(builder, 'w2ui-overlay-conditionalformatmenu', menu, data.id, itemCallback);
			}
		});
		builder._preventDocumentLosingFocusOnClick(control.container);
	},

	_borderStyleControl: function(parentContainer, data, builder) {
		var options = {hasDropdownArrow: true};
		var control = builder._unoToolButton(parentContainer, data, builder, options);

		$(control.container).unbind('click.toolbutton');
		$(control.container).click(function () {
			if (!$('#setborderstyle-grid').length) {
				$(control.container).w2overlay(window.getBorderStyleMenuHtml());

				$('#setborderstyle-grid tr td').click(function () {
					$(control.container).w2overlay();
				});
			}
		});
		builder._preventDocumentLosingFocusOnClick(control.container);
	},

	_insertGraphicControl: function(parentContainer, data, builder) {
		var options = {hasDropdownArrow: builder.map['wopi'].EnableInsertRemoteImage};
		var control = builder._unoToolButton(parentContainer, data, builder, options);

		$(control.container).unbind('click.toolbutton');
		$(control.container).click(function () {
			if (builder.map['wopi'].EnableInsertRemoteImage) {
				var menu = [
					{id: 'localgraphic', text: _('Insert Local Image')},
					{id: 'remotegraphic', text: _UNO('.uno:InsertGraphic', '', true)}
				];

				var itemCallback = function(event) {
					if (event.item.id === 'localgraphic') {
						L.DomUtil.get('insertgraphic').click();
					} else if (event.item.id === 'remotegraphic') {
						builder.map.fire('postMessage', {msgId: 'UI_InsertGraphic'});
					}
				};

				$(control.container).w2menu({
					name: 'insert-graphic-menu',
					items: menu,
					onSelect: itemCallback
				});
				builder._makeW2MenuFocusable(builder, 'w2ui-overlay-insert-graphic-menu', menu, data.id, itemCallback);
			} else {
				L.DomUtil.get('insertgraphic').click();
			}
		});
		builder._preventDocumentLosingFocusOnClick(control.container);
	},

	_insertAnnotationControl: function(parentContainer, data, builder) {
		var control = builder._unoToolButton(parentContainer, data, builder);
		$(control.container).unbind('click.toolbutton');
		$(control.container).click(function () {
			var docLayer = builder.map._docLayer;
			if (!(docLayer._docType === 'spreadsheet' && docLayer._hasActiveSelection)) {
				builder.map.insertComment();
			}
		});
		builder._preventDocumentLosingFocusOnClick(control.container);
	},

	_clipboardButtonControl: function(parentContainer, data, builder) {
		var isPaste = data.command === '.uno:Paste';
		var options = {hasDropdownArrow: isPaste};
		var control = builder._unoToolButton(parentContainer, data, builder, options);

		if (builder.map._clip) {
			if (isPaste) {
				var menu = [
					{text: _UNO('.uno:Paste', 'text'), uno: 'Paste', hint: L.Control.MenubarShortcuts.shortcuts.PASTE},
					{text: _UNO('.uno:PasteSpecial', 'text'), uno: 'PasteSpecial', hint: L.Control.MenubarShortcuts.shortcuts.PASTE_SPECIAL},
				];

				var itemCallback = function(event) {
					if (event.item)
						builder.map._clip.filterExecCopyPaste('.uno:' + event.item.uno);
				};

				$(control.container).unbind('click.toolbutton');
				$(control.container).click(function () {
					$(control.container).w2menu({
						name: 'pastemenu',
						items: menu,
						onSelect: itemCallback
					});
					builder._makeW2MenuFocusable(builder, 'w2ui-overlay-pastemenu', menu, data.id, itemCallback);
				});
			} else {
				$(control.container).unbind('click.toolbutton');
				$(control.container).click(function () {
					builder.map._clip.filterExecCopyPaste(data.command);
				});
			}
		}

		builder._preventDocumentLosingFocusOnClick(control.container);
	},

	_CharSpacing: function(parentContainer, data, builder) {
		var options = {hasDropdownArrow: true};
		var control = builder._unoToolButton(parentContainer, data, builder, options);

		$(control.container).unbind('click');
		$(control.container).click(function () {
			// TODO: this doesn't work, we need to send that status from the core
			var isChecked = function(value) {
				var items = builder.map['stateChangeHandler'];
				var val = items.getItemValue('.uno:Spacing');
				if (val && val === value)
					return true;
				else
					return false;
			};

			var menu = [
				{id: 'space1', text: _('Very Tight'), uno: 'Spacing?Spacing:short=-60', checked: isChecked(-60)},
				{id: 'space1', text: _('Tight'), uno: 'Spacing?Spacing:short=-30', checked: isChecked(-30)},
				{id: 'space15', text: _('Normal'), uno: 'Spacing?Spacing:short=0', checked: isChecked(0)},
				{id: 'space2', text: _('Loose'), uno: 'Spacing?Spacing:short=60', checked: isChecked(60)},
				{id: 'space2', text: _('Very Loose'), uno: 'Spacing?Spacing:short=120', checked: isChecked(120)},
			];

			var itemCallback = function(event) {
				builder.map.sendUnoCommand('.uno:' + event.item.uno);
			};

			$(control.container).w2menu({
				name: 'char-space-menu',
				items: menu,
				type: 'menu',
				onSelect: itemCallback
			});
			builder._makeW2MenuFocusable(builder, 'w2ui-overlay-char-space-menu', menu, data.id, itemCallback);
		});
	},

	_lineSpacingControl: function(parentContainer, data, builder) {
		var options = {hasDropdownArrow: true};
		var control = builder._unoToolButton(parentContainer, data, builder, options);

		$(control.container).unbind('click.toolbutton');
		$(control.container).click(function () {
			var isChecked = function(command) {
				var items = builder.map['stateChangeHandler'];
				var val = items.getItemValue(command);
				if (val && (val === 'true' || val === true))
					return true;
				else
					return false;
			};

			var menu = [
				{id: 'spacepara1', img: 'spacepara1', text: _UNO('.uno:SpacePara1'), uno: 'SpacePara1', checked: isChecked('.uno:SpacePara1')},
				{id: 'spacepara15', img: 'spacepara15', text: _UNO('.uno:SpacePara15'), uno: 'SpacePara15', checked: isChecked('.uno:SpacePara15')},
				{id: 'spacepara2', img: 'spacepara2', text: _UNO('.uno:SpacePara2'), uno: 'SpacePara2', checked: isChecked('.uno:SpacePara2')},
				{type: 'break'},
				{id: 'paraspaceincrease', img: 'paraspaceincrease', text: _UNO('.uno:ParaspaceIncrease'), uno: 'ParaspaceIncrease'},
				{id: 'paraspacedecrease', img: 'paraspacedecrease', text: _UNO('.uno:ParaspaceDecrease'), uno: 'ParaspaceDecrease'}
			];

			var itemCallback = function(event) {
				builder.map.sendUnoCommand('.uno:' + event.item.uno);
			};

			$(control.container).w2menu({
				items: menu,
				name: 'line-spacing-menu',
				type: 'menu',
				onSelect: itemCallback
			});
			builder._makeW2MenuFocusable(builder, 'w2ui-overlay-line-spacing-menu', menu, data.id, itemCallback);
		});
		builder._preventDocumentLosingFocusOnClick(control.container);
	},

	_saveControl: function(parentContainer, data, builder) {
		var control = builder._unoToolButton(parentContainer, data, builder);

		$(control.container).unbind('click.toolbutton');
		$(control.container).click(function () {
			// Save only when not read-only.
			if (!builder.map.isReadOnlyMode()) {
				builder.map.fire('postMessage', {msgId: 'UI_Save', args: { source: 'notebookbar' }});
				if (!builder.map._disableDefaultAction['UI_Save']) {
					builder.map.save(false, false);
				}
			}
		});
		builder._preventDocumentLosingFocusOnClick(control.container);
	},

	_saveAsControl: function(parentContainer, data, builder) {
		data.text = data.text.replace('...', '');
		var control = builder._unoToolButton(parentContainer, data, builder);

		$(control.container).unbind('click.toolbutton');
		$(control.container).click(function () {
			builder.map.openSaveAs();
		});
		builder._preventDocumentLosingFocusOnClick(control.container);
	},

	_printControl: function(parentContainer, data, builder) {
		data.text = data.text.replace('...', '');
		var control = builder._unoToolButton(parentContainer, data, builder);

		$(control.container).unbind('click.toolbutton');
		$(control.container).click(function () {
			builder.map.print();
		});
		builder._preventDocumentLosingFocusOnClick(control.container);
	},

	buildControl: function(parent, data) {
		var type = data.type;
		var handler = this._controlHandlers[type];

		var isVertical = (data.vertical === 'true' || data.vertical === true);
		var hasManyChildren = data.children && data.children.length > 1;

		if (handler)
			var processChildren = handler(parent, data, this);
		else
			window.app.console.warn('NotebookbarBuilder: Unsupported control type: "' + type + '"');

		if (processChildren && data.children != undefined)
			this.build(parent, data.children, isVertical, hasManyChildren);
		else if (data.visible && (data.visible === false || data.visible === 'false')) {
			$('#' + data.id).addClass('hidden-from-event');
		}

		this.options.useInLineLabelsForUnoButtons = false;
	},

	build: function(parent, data, hasVerticalParent, parentHasManyChildren) {
		if (hasVerticalParent === undefined) {
			parent = L.DomUtil.create('div', 'root-container ' + this.options.cssClass, parent);
			parent = L.DomUtil.create('div', 'vertical ' + this.options.cssClass, parent);
		}

		var containerToInsert = parent;

		for (var childIndex in data) {
			var childData = data[childIndex];
			if (!childData)
				continue;

			var childType = childData.type;

			if (parentHasManyChildren) {
				if (!hasVerticalParent)
					var td = L.DomUtil.create('div', 'cell ' + this.options.cssClass, containerToInsert);
				else {
					containerToInsert = L.DomUtil.create('div', 'row ' + this.options.cssClass, parent);
					td = L.DomUtil.create('div', 'cell ' + this.options.cssClass, containerToInsert);
				}
			} else {
				td = containerToInsert;
			}

			var isVertical = (childData.vertical === 'true' || childData.vertical === true) ? true : false;

			this._parentize(childData);
			var processChildren = true;

			if ((childData.id === undefined || childData.id === '' || childData.id === null)
				&& (childType == 'checkbox' || childType == 'radiobutton')) {
				continue;
			}

			var hasManyChildren = childData.children && childData.children.length > 1;
			if (hasManyChildren) {
				var tableId = childData.id ? childData.id.replace(' ', '') : '';
				var table = L.DomUtil.createWithId('div', tableId, td);
				$(table).addClass(this.options.cssClass);
				$(table).addClass('vertical');
				var childObject = L.DomUtil.create('div', 'row ' + this.options.cssClass, table);
				childObject.id = tableId ? tableId + '-row' : '';
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
				if (handler) {
					processChildren = handler(childObject, childData, this);
					this.postProcess(childObject, childData);
				} else
					window.app.console.warn('NotebookbarBuilder: Unsupported control type: "' + childType + '"');

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

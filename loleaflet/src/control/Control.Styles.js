/*
 * L.Control.Styles is used to display a dropdown list of styles
 */

L.Control.Styles = L.Control.extend({
	options: {
		info: '- Styles -'
	},

	// Programming names -> UI names mapping
	styleMappings: {
		"Default":"Default",
		"Result":"Result",
		"Result2":"Result2",
		"Heading":"Heading",
		"Heading1":"Heading1",
		"Default":"Default",
		"Report":"Report",
		"standard":"Default",
		"objectwitharrow":"Object with arrow",
		"objectwithshadow":"Object with shadow",
		"objectwithoutfill":"Object without fill",
		"Object with no fill and no line":"Object with no fill and no line",
		"text":"Text",
		"textbody":"Text body",
		"textbodyjustfied":"Text body justified",
		"textbodyindent":"First line indent",
		"title":"Title",
		"title1":"Title1",
		"title2":"Title2",
		"headline":"Heading",
		"headline1":"Heading1",
		"headline2":"Heading2",
		"measure":"Dimension Line",
		"Normal":"Normal",
		"Heading 1":"Heading 1",
		"Heading 2":"Heading 2",
		"Heading 3":"Heading 3",
		"Numbering Symbols":"Numbering Symbols",
		"Bullets":"Bullets",
		"Table Contents":"Table Contents",
		"Quotations":"Quotations",
		"Index":"Index",
		"Caption":"Caption",
		"List":"List",
		"Text Body":"Text Body",
		"default":"default",
		"gray1":"gray1",
		"gray2":"gray2",
		"gray3":"gray3",
		"bw1":"bw1",
		"bw2":"bw2",
		"bw3":"bw3",
		"orange1":"orange1",
		"orange2":"orange2",
		"orange3":"orange3",
		"turquoise1":"turquoise1",
		"turquoise2":"turquoise2",
		"turquoise3":"turquoise3",
		"blue1":"blue1",
		"blue2":"blue2",
		"blue3":"blue3",
		"sun1":"sun1",
		"sun2":"sun2",
		"sun3":"sun3",
		"earth1":"earth1",
		"earth2":"earth2",
		"earth3":"earth3",
		"green1":"green1",
		"green2":"green2",
		"green3":"green3",
		"seetang1":"seetang1",
		"seetang2":"seetang2",
		"seetang3":"seetang3",
		"lightblue1":"lightblue1",
		"lightblue2":"lightblue2",
		"lightblue3":"lightblue3",
		"yellow1":"yellow1",
		"yellow2":"yellow2",
		"yellow3":"yellow3",
		"default":"default",
		"bw":"bw",
		"orange":"orange",
		"turquoise":"turquoise",
		"blue":"blue",
		"sun":"sun",
		"earth":"earth",
		"green":"green",
		"seetang":"seetang",
		"lightblue":"lightblue",
		"yellow":"yellow",
		"background":"Background",
		"backgroundobjects":"Background objects",
		"notes":"Notes",
		"outline1":"Outline 1",
		"outline2":"Outline 2",
		"outline3":"Outline 3",
		"outline4":"Outline 4",
		"outline5":"Outline 5",
		"outline6":"Outline 6",
		"outline7":"Outline 7",
		"outline8":"Outline 8",
		"outline9":"Outline 9",
		"subtitle":"Subtitle",
		"title":"Title",
		"Clear formatting":"Clear formatting",
		"Default Style":"Default Style",
		"Bullet Symbols":"Bullets",
		"Numbering Symbols":"Numbering Symbols",
		"Footnote Symbol":"Footnote Characters",
		"Page Number":"Page Number",
		"Caption characters":"Caption Characters",
		"Drop Caps":"Drop Caps",
		"Internet link":"Internet Link",
		"Visited Internet Link":"Visited Internet Link",
		"Placeholder":"Placeholder",
		"Index Link":"Index Link",
		"Endnote Symbol":"Endnote Characters",
		"Line numbering":"Line Numbering",
		"Main index entry":"Main Index Entry",
		"Footnote anchor":"Footnote Anchor",
		"Endnote anchor":"Endnote Anchor",
		"Rubies":"Rubies",
		"Vertical Numbering Symbols":"Vertical Numbering Symbols",
		"Emphasis":"Emphasis",
		"Citation":"Quotation",
		"Strong Emphasis":"Strong Emphasis",
		"Source Text":"Source Text",
		"Example":"Example",
		"User Entry":"User Entry",
		"Variable":"Variable",
		"Definition":"Definition",
		"Teletype":"Teletype",
		"Text body":"Text Body",
		"Quotations":"Quotations",
		"Title":"Title",
		"Subtitle":"Subtitle",
		"Heading 1":"Heading 1",
		"Heading 2":"Heading 2",
		"Heading 3":"Heading 3",
		"Standard":"Default Style",
		"Heading":"Heading",
		"List":"List",
		"Caption":"Caption",
		"Index":"Index",
		"Table Contents":"Table Contents",
		"First line indent":"First Line Indent",
		"Hanging indent":"Hanging Indent",
		"Text body indent":"Text Body Indent",
		"Salutation":"Complimentary Close",
		"Signature":"Signature",
		"List Indent":"List Indent",
		"Marginalia":"Marginalia",
		"Heading 4":"Heading 4",
		"Heading 5":"Heading 5",
		"Heading 6":"Heading 6",
		"Heading 7":"Heading 7",
		"Heading 8":"Heading 8",
		"Heading 9":"Heading 9",
		"Heading 10":"Heading 10",
		"Numbering 1 Start":"Numbering 1 Start",
		"Numbering 1":"Numbering 1",
		"Numbering 1 End":"Numbering 1 End",
		"Numbering 1 Cont.":"Numbering 1 Cont.",
		"Numbering 2 Start":"Numbering 2 Start",
		"Numbering 2":"Numbering 2",
		"Numbering 2 End":"Numbering 2 End",
		"Numbering 2 Cont.":"Numbering 2 Cont.",
		"Numbering 3 Start":"Numbering 3 Start",
		"Numbering 3":"Numbering 3",
		"Numbering 3 End":"Numbering 3 End",
		"Numbering 3 Cont.":"Numbering 3 Cont.",
		"Numbering 4 Start":"Numbering 4 Start",
		"Numbering 4":"Numbering 4",
		"Numbering 4 End":"Numbering 4 End",
		"Numbering 4 Cont.":"Numbering 4 Cont.",
		"Numbering 5 Start":"Numbering 5 Start",
		"Numbering 5":"Numbering 5",
		"Numbering 5 End":"Numbering 5 End",
		"Numbering 5 Cont.":"Numbering 5 Cont.",
		"List 1 Start":"List 1 Start",
		"List 1":"List 1",
		"List 1 End":"List 1 End",
		"List 1 Cont.":"List 1 Cont.",
		"List 2 Start":"List 2 Start",
		"List 2":"List 2",
		"List 2 End":"List 2 End",
		"List 2 Cont.":"List 2 Cont.",
		"List 3 Start":"List 3 Start",
		"List 3":"List 3",
		"List 3 End":"List 3 End",
		"List 3 Cont.":"List 3 Cont.",
		"List 4 Start":"List 4 Start",
		"List 4":"List 4",
		"List 4 End":"List 4 End",
		"List 4 Cont.":"List 4 Cont.",
		"List 5 Start":"List 5 Start",
		"List 5":"List 5",
		"List 5 End":"List 5 End",
		"List 5 Cont.":"List 5 Cont.",
		"Index Heading":"Index Heading",
		"Index 1":"Index 1",
		"Index 2":"Index 2",
		"Index 3":"Index 3",
		"Index Separator":"Index Separator",
		"Contents Heading":"Contents Heading",
		"Contents 1":"Contents 1",
		"Contents 2":"Contents 2",
		"Contents 3":"Contents 3",
		"Contents 4":"Contents 4",
		"Contents 5":"Contents 5",
		"User Index Heading":"User Index Heading",
		"User Index 1":"User Index 1",
		"User Index 2":"User Index 2",
		"User Index 3":"User Index 3",
		"User Index 4":"User Index 4",
		"User Index 5":"User Index 5",
		"Contents 6":"Contents 6",
		"Contents 7":"Contents 7",
		"Contents 8":"Contents 8",
		"Contents 9":"Contents 9",
		"Contents 10":"Contents 10",
		"Illustration Index Heading":"Illustration Index Heading",
		"Illustration Index 1":"Illustration Index 1",
		"Object index heading":"Object Index Heading",
		"Object index 1":"Object Index 1",
		"Table index heading":"Table Index Heading",
		"Table index 1":"Table Index 1",
		"Bibliography Heading":"Bibliography Heading",
		"Bibliography 1":"Bibliography 1",
		"User Index 6":"User Index 6",
		"User Index 7":"User Index 7",
		"User Index 8":"User Index 8",
		"User Index 9":"User Index 9",
		"User Index 10":"User Index 10",
		"Header":"Header",
		"Header left":"Header Left",
		"Header right":"Header Right",
		"Footer":"Footer",
		"Footer left":"Footer Left",
		"Footer right":"Footer Right",
		"Table Heading":"Table Heading",
		"Illustration":"Illustration",
		"Table":"Table",
		"Text":"Text",
		"Frame contents":"Frame Contents",
		"Footnote":"Footnote",
		"Addressee":"Addressee",
		"Sender":"Sender",
		"Endnote":"Endnote",
		"Drawing":"Drawing",
		"Preformatted Text":"Preformatted Text",
		"Horizontal Line":"Horizontal Line",
		"List Contents":"List Contents",
		"List Heading":"List Heading",
		"Standard":"Default Style",
		"First Page":"First Page",
		"Left Page":"Left Page",
		"Right Page":"Right Page",
		"Envelope":"Envelope",
		"Index":"Index",
		"HTML":"HTML",
		"Footnote":"Footnote",
		"Endnote":"Endnote",
		"Landscape":"Landscape",
		"Graphics":"Graphics",
		"Frame":"Frame",
		"OLE":"OLE",
		"Formula":"Formula",
		"Marginalia":"Marginalia",
		"Watermark":"Watermark",
		"Labels":"Labels",
		"Numbering 1":"Numbering 1",
		"Numbering 2":"Numbering 2",
		"Numbering 3":"Numbering 3",
		"Numbering 4":"Numbering 4",
		"Numbering 5":"Numbering 5",
		"List 1":"List 1",
		"List 2":"List 2",
		"List 3":"List 3",
		"List 4":"List 4",
		"List 5":"List 5"
	},

	onAdd: function (map) {
		var stylesName = 'leaflet-control-styles';
		this._container = L.DomUtil.create('select', stylesName + ' leaflet-bar');

		map.on('updatepermission', this._onUpdatePermission, this);
		map.on('updatetoolbarcommandvalues', this._initList, this);
		map.on('commandstatechanged', this._onStateChange, this);
		L.DomEvent.on(this._container, 'change', this._onChange, this);

		return this._container;
	},

	onRemove: function (map) {
		map.off('updatepermission', this._searchResultFound, this);
	},

	_addSeparator: function () {
		var item = L.DomUtil.create('option', '', this._container);
		item.disabled = true;
		item.value = 'separator';
		item.innerHTML = '&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;';
	},

	_initList: function (e) {
		if (e.commandName === '.uno:StyleApply') {
			var container = this._container;
			var first = L.DomUtil.create('option', '', container);
			first.innerHTML = this.options.info;

			var styles = [];
			var topStyles = [];
			if (this._map.getDocType() === 'text') {
				// The list contains a total of 100+ styles, the first 7 are
				// the default styles (as shown on desktop writer), we then
				// also show a selection of 12 more styles.
				styles = e.commandValues.ParagraphStyles.slice(7, 19);
				topStyles = e.commandValues.ParagraphStyles.slice(0, 7);
			}
			else if (this._map.getDocType() === 'presentation' ||
				       this._map.getDocType() === 'drawing') {
				styles = e.commandValues.Default;
			}
			else if (this._map.getDocType() === 'spreadsheet') {
				styles = e.commandValues.CellStyles;
			}

			var commands = e.commandValues.Commands;
			if (commands && commands.length > 0) {
				this._addSeparator();

				commands.forEach(function (command) {
					var item = L.DomUtil.create('option', '', container);
					item.value = command.id;
					item.innerHTML = this.styleMappings[command.text].toLocaleString();;
				}, this);
			}

			if (topStyles.length > 0) {
				this._addSeparator();
				topStyles.forEach(function (style) {
					var item = L.DomUtil.create('option', '', container);
					item.value = style;
					item.innerHTML = this.styleMappings[style].toLocaleString();
				}, this);
			}

			if (styles.length > 0) {
				this._addSeparator();
				styles.forEach(function (style) {
					var item = L.DomUtil.create('option', '', container);
					item.value = style;
					var localeStyle;
					if (style.startsWith('Outline')) {
						var outlineLevel = style.split('Outline')[1];
						localeStyle = 'Outline'.toLocaleString() + outlineLevel;
					} else {
						localeStyle = this.styleMappings[style].toLocaleString();
					}

					item.innerHTML = localeStyle;
				}, this);
			}
		}
	},

	_onUpdatePermission: function (e) {
		if (e.perm === 'edit') {
			this._container.disabled = false;
		}
		else {
			this._container.disabled = true;
		}
	},

	_onChange: function (e) {
		var style = e.target.value;
		if (style === this.options.info) {
			return;
		}
		if (style.startsWith('.uno:')) {
			this._map.sendUnoCommand(style);
		}
		else if (this._map.getDocType() === 'text') {
			this._map.applyStyle(style, 'ParagraphStyles');
		}
		else if (this._map.getDocType() === 'presentation') {
			this._map.applyStyle(style, 'Default');
		}
		this._refocusOnMap();
	},

	_onStateChange: function (e) {
		if (!e.state) {
			return;
		}
		// For impress documents, LOK STATE_CHANGED callback return these internal names
		// which are different from what is returned by initial .uno:StyleApply.
		// Convert these names to our stored internal names before processing
		var impressMapping = {'Titel':'title', 'Untertitel':'subtitle',
					'Gliederung 1':'outline1', 'Gliederung 2':'outline2', 'Gliederung 3':'outline3',
					'Gliederung 4':'outline4', 'Gliederung 5':'outline5', 'Gliederung 6':'outline6',
					'Gliederung 7':'outline7', 'Gliederung 8':'outline8', 'Gliederung 9':'outline9',
					'Hintergrund':'background', 'Hintergrundobjekte':'backgroundobjects', 'Notizen':'notes'};

		// For impress documents, template name is prefixed with style name.
		// Strip the template name until we support it
		if (this._map.getDocType() === 'presentation') {
			e.state = e.state.split('~LT~')[1];
			e.state = impressMapping[e.state];
		}
		if (e.commandName === '.uno:StyleApply') {
			for (var i = 0; i < this._container.length; i++) {
				var value = this._container[i].value;
				var innerHTML = this._container[i].innerHTML;
				// For writer, we get UI names, but for others we seem to get internal names
				// (likely to be fixed in core to keep it consistent)
				if (value === e.state || innerHTML === e.state) {
					this._container.value = value;
					return;
				}
			}
		}
	}
});

L.control.styles = function (options) {
	return new L.Control.Styles(options);
};

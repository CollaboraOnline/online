declare var L: any;
declare var app: any;

app.definitions.ContentControlSection =

class ContentControlSection {
    context: CanvasRenderingContext2D = null;
    processingOrder: number = L.CSections.ContentControl.processingOrder;
	drawingOrder: number = L.CSections.ContentControl.drawingOrder;
	zIndex: number = L.CSections.ContentControl.zIndex;
    name: string = L.CSections.ContentControl.name;
	interactable: boolean = false;
    documentObject: boolean = true;
	sectionProperties: any = {};
	myTopLeft: Array<number> = [0, 0];
	position: Array<number> = [0, 0];
	size: Array<number> = new Array(0);
	expand: Array<string> = new Array(0);
	anchor: Array<any> = new Array(0);
	map: any;

	// Implemented by section container. Document objects only.
	setPosition: (x: number, y: number) => void;

	public onInitialize() {
		this.sectionProperties.rectangles = [];
		this.sectionProperties.strokeStyle = '#000000';
		this.sectionProperties.dropdownButton = L.marker(new L.LatLng(0, 0), {
			icon: L.divIcon({
				className: 'writer-drop-down-marker',
				iconSize: null
			}),
			interactive: true
		});
		this.onClickDropdown = this.onClickDropdown.bind(this);
		this.sectionProperties.dropdownButton.addEventListener('click', this.onClickDropdown, false);
		var container = L.DomUtil.createWithId('div', 'datepicker');
		container.style.zIndex = '12';
		container.style.position = 'absolute';
		document.getElementById('document-container').appendChild(container);
		this.sectionProperties.datePicker = false;
	}

	constructor() {
		this.map = L.Map.THIS;
		this.sectionProperties.rectangles = null;
		this.sectionProperties.strokeStyle = null;
		this.sectionProperties.json = null;
		this.sectionProperties.datePicker = null;
	}

	public drawContentControl(json: any) {
		this.sectionProperties.json = json;
		this.sectionProperties.datePicker = false;
		if (this.sectionProperties.dropdownButton)
			this.map.removeLayer(this.sectionProperties.dropdownButton);

		if (json.date) {
			this.sectionProperties.datePicker = true;
			$('#datepicker').datepicker({
				onSelect: function (date: any, datepicker: any) {
					if (date != '') {
						var message = 'contentcontrolevent {"type": "date",' +
								'"selected": "' + date + '"}';
						app.socket.sendMessage(message);
					}
				}
			});
			$('#datepicker').hide();
		} else {
			$('#datepicker').datepicker('destroy');
		}

		if (json.action === 'show')	{
			//convert string to number coordinates
			var matches = this.sectionProperties.json.rectangles.match(/\d+/g);
			this.sectionProperties.rectangles = [];
			if (matches !== null) {
				for (var i: number = 0; i < matches.length; i += 4) {
					this.sectionProperties.rectangles.push([parseInt(matches[i]), parseInt(matches[i + 1]), parseInt(matches[i + 2]), parseInt(matches[i + 3])]);
				}
			}
		} else if (json.action === 'hide') {
			this.sectionProperties.rectangles = [];
		} else if (json.action === 'change-picture') {
			if (!this.map.wopi.EnableInsertRemoteImage)
				L.DomUtil.get('insertgraphic').click();
			else
				this.map.fire('postMessage', {msgId: 'UI_InsertGraphic'});
		}

		this.setPositionAndSize();
		app.sectionContainer.requestReDraw();
	}

	private setPositionAndSize () {
		var rectangles = this.sectionProperties.rectangles;
		var xMin: number = Infinity, yMin: number = Infinity, xMax: number = 0, yMax: number = 0;
		for (var i = 0; i < rectangles.length; i++) {
			if (rectangles[i][0] < xMin)
				xMin = rectangles[i][0];

			if (rectangles[i][1] < yMin)
				yMin = rectangles[i][1];

			if (rectangles[i][0] + rectangles[i][2] > xMax)
				xMax = rectangles[i][0] + rectangles[i][2];

			if (rectangles[i][1] + rectangles[i][3] > yMax)
				yMax = rectangles[i][1] + rectangles[i][3];
		}
		// Rectangles are in twips. Convert them to core pixels.
		var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
		xMin = Math.round(xMin * ratio);
		yMin = Math.round(yMin * ratio);
		xMax = Math.round(xMax * ratio);
		yMax = Math.round(yMax * ratio);

		this.setPosition(xMin, yMin); // This function is added by section container.
		this.size = [xMax - xMin, yMax - yMin];
		if (this.size[0] < 5)
			this.size[0] = 5;
	}

	public onResize () {
		this.setPositionAndSize();
	}

	public onDraw() {
		var rectangles = this.sectionProperties.rectangles;
		for (var i: number = 0; i < rectangles.length; i++) {
			var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
			var x: number = rectangles[i][0] * ratio;
			var y: number = rectangles[i][1] * ratio;
			var w: number = rectangles[i][2] * ratio;
			var h: number = rectangles[i][3] * ratio;

			this.context.strokeStyle = this.sectionProperties.strokeStyle;
			this.context.strokeRect(x - this.position[0], y - this.position[1], w, h);
		}
		if (this.sectionProperties.json.items || this.sectionProperties.datePicker) {
			this.addDropDownBtn();
		}
	}

	public onNewDocumentTopLeft () {
		this.setPositionAndSize();
	}

	private callback(objectType:any , eventType:any, object:any, data:any, builder:any) {
		var closeDropdownJson = {
			'jsontype': 'dialog',
			'type': 'modalpopup',
			'action': 'close',
			'id': builder.windowId,
		};

		if (eventType === 'close') {
			this.map.fire('jsdialog', {data: closeDropdownJson, callback: undefined});
		} else if (eventType === 'select') {
			var message = 'contentcontrolevent {"type": "drop-down",' +
					'"selected": "' + data + '"}';
			app.socket.sendMessage(message);
			this.map.fire('jsdialog', {data: closeDropdownJson, callback: undefined});
		}
	}

	private addDropDownBtn() {
		var matches = this.sectionProperties.json.rectangles.match(/\d+/g);

		//consider first rectangle to position dropdownbutton
		var rectangle = [parseInt(matches[0]), parseInt(matches[1]), parseInt(matches[2]), parseInt(matches[3])];

		var topLeftTwips = new L.Point(rectangle[0], rectangle[1]);
		var offset = new L.Point(rectangle[2], rectangle[3]);
		var bottomRightTwips = topLeftTwips.add(offset);
		var buttonAreaTwips = [topLeftTwips, bottomRightTwips];

		var frameArea = new L.Bounds(
			this.map._docLayer._twipsToPixels(topLeftTwips),
			this.map._docLayer._twipsToPixels(bottomRightTwips));

		var size = frameArea.getSize();
		var origin = this.map.getPixelOrigin();
		var panePos = this.map._getMapPanePos();
		this.sectionProperties.framePos = new L.Point(Math.round(frameArea.min.x + panePos.x - origin.x), Math.round(frameArea.min.y + panePos.y - origin.y));
		this.sectionProperties.frameWidth = Math.round(size.x);
		this.sectionProperties.frameHeight = Math.round(size.y);

		var icon =  L.divIcon({
			className: 'writer-drop-down-marker',
			iconSize: [this.sectionProperties.frameHeight, this.sectionProperties.frameHeight],
			iconAnchor: [0, 0]
		});

		this.sectionProperties.dropdownButton.setIcon(icon);

		// Then convert to unit which can be used on the layer.
		var buttonAreaLatLng = new L.LatLngBounds(
			this.map._docLayer._twipsToLatLng(buttonAreaTwips[0], this.map.getZoom()),
			this.map._docLayer._twipsToLatLng(buttonAreaTwips[1], this.map.getZoom()));

		var pos = buttonAreaLatLng.getNorthEast();
		this.sectionProperties.dropdownButton.setLatLng(pos);
		this.map.addLayer(this.sectionProperties.dropdownButton);
	}

	private openDropdownJson() {
		if (!this.sectionProperties.json.items)
			return;

		var json: any = {
			'children': [
				{
					'id': 'container',
					'type': 'container',
					'text': '',
					'enabled': true,
					'children': [
						{
							'id': 'dropdownlist',
							'type': 'treelistbox',
							'text': '',
							'enabled': true,
							'singleclickactivate': true,
						}
					],
					'vertical': true
				}
			],
			'jsontype': 'dialog',
			'type': 'modalpopup',
			'cancellable': true,
			'popupParent': '_POPOVER_',
			'clickToClose': '_POPOVER_',
			'id': '0'
		};

		var entries = [];
		var items = this.sectionProperties.json.items;

		//add entries
		for (var i in items) {
			var entry = {
				'text' : items[i],
				'columns': [
					{
						'text': items[i]
					}
				],
				'row': i.toString()
			};
			entries.push(entry);
		}
		json.children[0].children[0].entries = entries;

		//add position
		json.posx = this.sectionProperties.framePos.x + this.sectionProperties.frameWidth;
		json.posy = this.sectionProperties.framePos.y + this.sectionProperties.frameHeight;

		return json;
	}

	private onClickDropdown(event: any) {
		if (this.sectionProperties.datePicker) {
			this.showDatePicker();
		} else if (this.sectionProperties.json.items) {
			this.map.fire('jsdialog', {data: this.openDropdownJson(), callback: this.callback});
		}
		L.DomEvent.stopPropagation(event);
	}

	private showDatePicker() {
		if ($('#datepicker').is(':visible')) {
			$('#datepicker').hide();
		} else {
			var datePicker = document.getElementById('datepicker');
			datePicker.style.left = this.sectionProperties.framePos.x + this.sectionProperties.frameWidth + 'px';
			datePicker.style.top = this.sectionProperties.framePos.y + this.sectionProperties.frameHeight + 'px';
			$('#datepicker').show();
		}
	}
};

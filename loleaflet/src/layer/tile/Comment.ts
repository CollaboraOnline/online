/* eslint-disable */
/* See CanvasSectionContainer.ts for explanations. */

declare var L: any;
declare var app: any;
declare var _: any;
declare var Autolinker: any;

app.definitions.Comment =
class Comment {
	context: CanvasRenderingContext2D = null;
	myTopLeft: Array<number> = null;
	documentTopLeft: Array<number> = null;
	containerObject: any = null;
	dpiScale: number = null;
	name: string = L.CSections.Comment.name;
	backgroundColor: string = 'black';
	borderColor: string = null;
	boundToSection: string = null;
	anchor: Array<any> = new Array(0);
	documentObject: boolean = true;
	position: Array<number> = new Array(0);
	size: Array<number> = new Array(0);
	expand: Array<string> = new Array(0);
	isLocated: boolean = false;
	showSection: boolean = true;
	processingOrder: number = L.CSections.Comment.processingOrder;
	drawingOrder: number = L.CSections.Comment.drawingOrder;
	zIndex: number = L.CSections.Comment.zIndex;
	interactable: boolean = true;
	sectionProperties: any = {};
	stopPropagating: Function; // Implemented by section container.
	setPosition: Function; // Implemented by section container. Document objects only.
	map: any;

	constructor (data: any, options: any) {
		this.map = L.Map.THIS;

		if (!options)
			options = {};

		this.sectionProperties.docLayer = this.map._docLayer;
		this.sectionProperties.selectedAreaPoint = null;
		this.sectionProperties.cellCursorPoint = null;

		this.sectionProperties.draggingStarted = false;
		this.sectionProperties.dragStartPosition = null;

		this.sectionProperties.mapPane = (<HTMLElement>(document.querySelectorAll('.leaflet-map-pane')[0]));

		this.sectionProperties.minWidth = options.minWidth ? options.minWidth : 160;
		this.sectionProperties.maxHeight = options.maxHeight ? options.maxHeight : 50;
		this.sectionProperties.imgSize = options.imgSize ? options.imgSize : [32, 32];
		this.sectionProperties.margin = options.margin ? options.margin : [40, 40];
		this.sectionProperties.noMenu = options.noMenu ? options.noMenu : false;

		this.sectionProperties.data = data;
		this.sectionProperties.skipCheckBounds = false;
		this.sectionProperties.annotationMarker = null;
		this.sectionProperties.wrapper = null;
		this.sectionProperties.container = null;
		this.sectionProperties.author = null;
		this.sectionProperties.resolvedTextElement = null;
		this.sectionProperties.authorAvatarImg = null;
		this.sectionProperties.authorAvatartdImg = null;
		this.sectionProperties.contentAuthor = null;
		this.sectionProperties.contentDate = null;
		this.sectionProperties.acceptButton = null;
		this.sectionProperties.rejectButton = null;
		this.sectionProperties.menu = null;
		this.sectionProperties.captionNode = null;
		this.sectionProperties.captionText = null;

		this.sectionProperties.contentNode = null;
		this.sectionProperties.nodeModify = null;
		this.sectionProperties.nodeModifyText = null;
		this.sectionProperties.contentText = null;
		this.sectionProperties.nodeReply = null;
		this.sectionProperties.nodeReplyText = null;
		this.sectionProperties.contextMenu = false;
	}

	private createContainerAndWrapper () {
		this.sectionProperties.container = L.DomUtil.create('div', 'loleaflet-annotation');

		if (this.sectionProperties.data.trackchange) {
			this.sectionProperties.wrapper = L.DomUtil.create('div', 'loleaflet-annotation-redline-content-wrapper', this.sectionProperties.container);
		} else {
			this.sectionProperties.wrapper = L.DomUtil.create('div', 'loleaflet-annotation-content-wrapper', this.sectionProperties.container);
		}
	}

	private createAuthorTable () {
		this.sectionProperties.author = L.DomUtil.create('table', 'loleaflet-annotation-table', this.sectionProperties.wrapper);

		var tbody = L.DomUtil.create('tbody', '', this.sectionProperties.author);
		var rowResolved = L.DomUtil.create('tr', '', tbody);
		var tdResolved = L.DomUtil.create('td', 'loleaflet-annotation-resolved', rowResolved);
		var pResolved = L.DomUtil.create('div', 'loleaflet-annotation-content-resolved', tdResolved);
		this.sectionProperties.resolvedTextElement = pResolved;

		this.updateResolvedField(this.sectionProperties.data.resolved);

		var tr = L.DomUtil.create('tr', '', tbody);
		tr.id = 'author table row';
		var tdImg = L.DomUtil.create('td', 'loleaflet-annotation-img', tr);
		var tdAuthor = L.DomUtil.create('td', 'loleaflet-annotation-author', tr);
		var imgAuthor = L.DomUtil.create('img', 'avatar-img', tdImg);

		imgAuthor.setAttribute('src', L.LOUtil.getImageURL('user.svg'));
		imgAuthor.setAttribute('width', this.sectionProperties.imgSize[0]);
		imgAuthor.setAttribute('height', this.sectionProperties.imgSize[1]);
		imgAuthor.onerror = function () { imgAuthor.setAttribute('src', L.LOUtil.getImageURL('user.svg')); };

		this.sectionProperties.authorAvatarImg = imgAuthor;
		this.sectionProperties.authorAvatartdImg = tdImg;
		this.sectionProperties.contentAuthor = L.DomUtil.create('div', 'loleaflet-annotation-content-author', tdAuthor);
		this.sectionProperties.contentDate = L.DomUtil.create('div', 'loleaflet-annotation-date', tdAuthor);
	}

	private createMenu () {
		var tdMenu = L.DomUtil.create('td', 'loleaflet-annotation-menubar', document.getElementById('author table row'));
		this.sectionProperties.menu = L.DomUtil.create('div', this.sectionProperties.data.trackchange ? 'loleaflet-annotation-menu-redline' : 'loleaflet-annotation-menu', tdMenu);
		var divMenuTooltipText = _('Open menu');
		this.sectionProperties.menu.dataset.title = divMenuTooltipText;
		this.sectionProperties.menu.setAttribute('aria-label', divMenuTooltipText);
		this.sectionProperties.menu.annotation = this;
	}

	private createTrackChangeButtons () {
		var tdAccept = L.DomUtil.create('td', 'loleaflet-annotation-menubar', document.getElementById('author table row'));
		var acceptButton = this.sectionProperties.acceptButton = L.DomUtil.create('button', 'loleaflet-redline-accept-button', tdAccept);

		var tdReject = L.DomUtil.create('td', 'loleaflet-annotation-menubar', document.getElementById('author table row'));
		var rejectButton = this.sectionProperties.rejectButton = L.DomUtil.create('button', 'loleaflet-redline-reject-button', tdReject);

		acceptButton.dataset.title = _('Accept change');
		acceptButton.setAttribute('aria-label', _('Accept change'));

		L.DomEvent.on(acceptButton, 'click', function() {
			this._map.fire('RedlineAccept', {id: this.sectionProperties.data.id});
		}, this);

		rejectButton.dataset.title = _('Reject change');
		rejectButton.setAttribute('aria-label', _('Reject change'));

		L.DomEvent.on(rejectButton, 'click', function() {
			this._map.fire('RedlineReject', {id: this.sectionProperties.data.id});
		}, this);
	}

	private createButton (container: any, id: any, value: any, handler: any) {
		var button = L.DomUtil.create('input', 'annotation-button', container);
		button.id = id;
		button.type = 'button';
		button.value = value;
		L.DomEvent.on(button, 'mousedown', L.DomEvent.preventDefault);
		L.DomEvent.on(button, 'click', handler, this);
	}

	private updateResolvedField (state: string) {
		this.sectionProperties.resolvedTextElement.text = state === 'true' ? 'Resolved' : '';
	}

	private updateContent () {
		// .text() method will escape the string, does not interpret the string as HTML
		this.sectionProperties.contentText.innerText(this.sectionProperties.data.text);
		// Get the escaped HTML out and find for possible, useful links
		var linkedText = Autolinker.link(this.sectionProperties.contentText.outerHTML);
		// Set the property of text field directly. This is insecure otherwise because it doesn't escape the input
		// But we have already escaped the input before and only thing we are adding on top of that is Autolinker
		// generated text.
		this.sectionProperties.contentText.innerHTML = linkedText;
		// Original unlinked text
		this.sectionProperties.contentText.origText = this.sectionProperties.data.text;
		this.sectionProperties.nodeModifyText.innerText = this.sectionProperties.data.text;
		this.sectionProperties.contentAuthor.innerText = this.sectionProperties.data.author;

		this.updateResolvedField(this.sectionProperties.data.resolved);
		this.sectionProperties.authorAvatarImg.setAttribute('src', this.sectionProperties.data.avatar);

		if (!this.sectionProperties.data.avatar) {
			$(this.sectionProperties.authorAvatarImg).css('padding-top', '4px');
		}
		var user = this.map.getViewId(this.sectionProperties.data.author);
		if (user >= 0) {
			var color = L.LOUtil.rgbToHex(this.map.getViewColor(user));
			this.sectionProperties.authorAvatartdImg.style.borderColor = color;
		}

		var d = new Date(this.sectionProperties.data.dateTime.replace(/,.*/, 'Z'));
		var dateOptions: any = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
		this.sectionProperties.contentDate.innerText(isNaN(d.getTime()) ? this.sectionProperties.data.dateTime: d.toLocaleDateString((<any>String).locale, dateOptions));

		if (this.sectionProperties.data.trackchange) {
			this.sectionProperties.captionText.innerText(this.sectionProperties.data.description);
		}
	}

	private updateLayout () {
		var style = this.sectionProperties.wrapper.style;
		style.width = '';
		style.whiteSpace = 'nowrap';

		style.whiteSpace = '';
	}

	private updatePosition () {
		if (this.map) {
			//var pos = this._map.latLngToLayerPoint(this._latlng);
			//L.DomUtil.setPosition(this.sectionProperties.container, pos);
		}
		this.checkBounds();
	}

	private updateAnnotationMarker () {
		// Make sure to place the markers only for presentations and draw documents
		if (this.map._docLayer._docType !== 'presentation' && this.map._docLayer._docType !== 'drawing')
			return;

		if (this.sectionProperties.data == null)
			return;

		if (this.sectionProperties.annotationMarker == null) {
			this.sectionProperties.annotationMarker = L.marker(new L.LatLng(0, 0), {
				icon: L.divIcon({
					className: 'annotation-marker',
					iconSize: null
				}),
				draggable: true
			});
			if (this.map._docLayer._partHashes[this.map._docLayer._selectedPart] == this.sectionProperties.data.parthash)
				this.map.addLayer(this.sectionProperties.annotationMarker);
		}
		if (this.sectionProperties.data.rectangle != null) {
			var stringTwips = this.sectionProperties.data.rectangle.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(stringTwips[0]), parseInt(stringTwips[1]));
			var offset = new L.Point(parseInt(stringTwips[2]), parseInt(stringTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			var bounds = new L.LatLngBounds(
				this.map._docLayer._twipsToLatLng(topLeftTwips, this.map.getZoom()),
				this.map._docLayer._twipsToLatLng(bottomRightTwips, this.map.getZoom()));
			this.sectionProperties._annotationMarker.setLatLng(bounds.getNorthWest());
			this.sectionProperties._annotationMarker.on('dragstart drag dragend', this.onMarkerDrag, this);
			this.sectionProperties._annotationMarker.on('click', this.onMarkerClick, this);
		}
		if (this.sectionProperties.annotationMarker._icon) {
			(new Hammer(this.sectionProperties.annotationMarker._icon, {recognizers: [[Hammer.Tap]]}))
				.on('tap', function() {
					this._map._docLayer._openCommentWizard(this);
				}.bind(this));
		}
	}

	private getBounds (): any {
		//var point = this._map.latLngToLayerPoint(this._latlng);
		//return L.bounds(point, point.add(L.point(this._container.offsetWidth, this._container.offsetHeight)));
	}

	private isContainerVisible () {
		return (this.sectionProperties.container.style && this.sectionProperties.container.style.visibility === '');
	}

	private checkBounds () {
		if (this.sectionProperties.skipCheckBounds || !this.map || this.map.animatingZoom || !this.isContainerVisible()) {
			return;
		}
		var maxBounds = this.map.getLayerMaxBounds();
		var thisBounds = this.getBounds();
		if (!maxBounds.contains(thisBounds)) {
			var docBounds = this.map.getLayerDocBounds();
			var delta = L.point(Math.max(thisBounds.max.x - docBounds.max.x, 0), Math.max(thisBounds.max.y - docBounds.max.y, 0));
			if (delta.x > 0) {
				delta.x += this.sectionProperties.margin.x;
			}
			if (delta.y > 0) {
				delta.y += this.sectionProperties.margin.y;
			}
			this.map._docLayer._extraScollSizeCSS.x = delta.x;
			this.map._docLayer._extraScollSizeCSS.y = delta.y;
			this.map._docLayer._updateMaxBounds(true);
		}
	}

	private update () {
		this.updateContent();
		this.updateLayout();
		this.updatePosition();
		this.updateAnnotationMarker();
	}

	private showMarker () {
		if (this.sectionProperties.annotationMarker != null) {
			this.map.addLayer(this.sectionProperties.annotationMarker);
		}
	}

	private hideMarker () {
		if (this.sectionProperties.annotationMarker != null) {
			this.map.removeLayer(this.sectionProperties.annotationMarker);
		}
	}

	private show () {
		this.showMarker();
		if (this.sectionProperties.data.textSelected && this.map.hasLayer && !this.map.hasLayer(this.sectionProperties.data.textSelected)) {
			this.map.addLayer(this.sectionProperties.data.textSelected);
		}

		if ((<any>window).mode.isMobile())
			return;

		this.sectionProperties.container.style.visibility = '';
		this.sectionProperties.contentNode.style.display = '';
		this.sectionProperties.nodeModify.style.display = 'none';
		this.sectionProperties.nodeReply.style.display = 'none';
	}

	private hide () {
		this.sectionProperties.container.style.visibility = 'hidden';
		this.sectionProperties.contentNode.style.display = 'none';
		this.sectionProperties.nodeModify.style.display = 'none';
		this.sectionProperties.nodeReply.style.display = 'none';
		if (this.sectionProperties.data.textSelected && this.map.hasLayer(this.sectionProperties.data.textSelected)) {
			this.map.removeLayer(this.sectionProperties.data.textSelected);
		}
		this.hideMarker();
	}

	private isEdit () {
		return (this.sectionProperties.nodeModify && this.sectionProperties.nodeModify.style.display !== 'none') ||
		       (this.sectionProperties.nodeReply && this.sectionProperties.nodeReply.style.display !== 'none');
	}

	private sendAnnotationPositionChange (newPosition: any) {
		var comment = {
			Id: {
				type: 'string',
				value: this.sectionProperties.data.id
			},
			PositionX: {
				type: 'int32',
				value: newPosition.x
			},
			PositionY: {
				type: 'int32',
				value: newPosition.y
			}
		};
		this.map.sendUnoCommand('.uno:EditAnnotation', comment);
	}

	private containerMouseClick (e: any) {
		var target = e.target;
		L.DomEvent.stopPropagation(e);
		if (L.DomUtil.hasClass(target, 'loleaflet-annotation-menu') || L.DomUtil.hasClass(target, 'loleaflet-annotation-menu-redline')) {
			$(target).contextMenu();
			return;
		} else if (((<any>window).mode.isMobile() || (<any>window).mode.isTablet())
			&& this.map.getDocType() == 'spreadsheet') {
			this.hide();
		}
		L.DomEvent.stopPropagation(e);
		this.map.fire('AnnotationClick', {annotation: this});
	}

	private onMarkerClick () {
		this.map.fire('AnnotationSelect', {annotation: this});
	}

	private onMarkerDrag (event: any) {
		if (this.sectionProperties.annotationMarker == null)
			return;

		if (event.type === 'dragend') {
			var pointTwip = this.map._docLayer._latLngToTwips(this.sectionProperties.annotationMarker.getLatLng());
			this.sendAnnotationPositionChange(pointTwip);
		}
	}

	private containerCancelClick (e: any) {
		L.DomEvent.stopPropagation(e);
		this.sectionProperties.nodeModifyText.value = this.sectionProperties.contentText.origText;
		this.sectionProperties.nodeReplyText.value = '';
		this.show();
		if (this.map)
			this.map.fire('AnnotationCancel', {annotation: this});
	}

	private containerSaveComment (e: any) {
		L.DomEvent.stopPropagation(e);
		this.sectionProperties.data.text = this.sectionProperties.nodeModifyText.value;
		this.updateContent();
		this.show();
		this.checkBounds();
		this.map.fire('AnnotationSave', {annotation: this});
	}

	private containerLostFocus (e: any) {
		$(this.sectionProperties.container).removeClass('annotation-active');
		if (this.sectionProperties.contentText.origText !== this.sectionProperties.nodeModifyText.value) {
			this.containerSaveComment(e);
		}
		else if (this.sectionProperties.nodeModifyText.value == '') {
			// Implies that this._contentText.origText == ''
			this.containerCancelClick(e);
		}
	}

	private containerLostFocusReply (e: any) {
		if (this.sectionProperties.nodeReplyText.value !== '') {
			this.containerReplyClick(e);
		}
	}

	private containerReplyClick (e: any) {
		L.DomEvent.stopPropagation(e);
		if ((<any>window).mode.isMobile() || (<any>window).mode.isTablet()) {
			e.annotation._data.reply = e.annotation._data.text;
			e.annotation.show();
			e.annotation._checkBounds();
			this.map.fire('AnnotationReply', {annotation: e.annotation});
		} else {
			this.sectionProperties.data.reply = this.sectionProperties.nodeReplyText.value;
			// Assigning an empty string to .innerHTML property in some browsers will convert it to 'null'
			// While in browsers like Chrome and Firefox, a null value is automatically converted to ''
			// Better to assign '' here instead of null to keep the behavior same for all
			this.sectionProperties.nodeReplyText.value = '';
			this.show();
			this.checkBounds();
			this.map.fire('AnnotationReply', {annotation: this});
		}
	}

	private containerMouseLeave (e: any) {
		var layerPoint = this.map.mouseEventToLayerPoint(e),
		    latlng = this.map.layerPointToLatLng(layerPoint);
		L.DomEvent.stopPropagation(e);
		if (this.sectionProperties.contextMenu || this.isEdit()) {
			return;
		}
		//this.fire('AnnotationMouseLeave', {
		//	originalEvent: e,
		//	latlng: latlng,
		//	layerPoint: layerPoint
		//});
	}

	public onInitialize () {
		this.createContainerAndWrapper();

		this.createAuthorTable();

		if (this.sectionProperties.data.trackchange && !this.map.isPermissionReadOnly()) {
			this.createTrackChangeButtons();
		}

		if (this.sectionProperties.noMenu !== true && this.map.isPermissionEditForComments()) {
			this.createMenu();
		}

		if (this.sectionProperties.data.trackchange) {
			this.sectionProperties.captionNode = L.DomUtil.create('div', 'loleaflet-annotation-caption', this.sectionProperties.wrapper);
			this.sectionProperties.captionText = L.DomUtil.create('div', '', this.sectionProperties.captionNode);
		}

		this.sectionProperties.contentNode = L.DomUtil.create('div', 'loleaflet-annotation-content loleaflet-dont-break', this.sectionProperties.wrapper);
		this.sectionProperties.nodeModify = L.DomUtil.create('div', 'loleaflet-annotation-edit' + ' modify-annotation', this.sectionProperties.wrapper);
		this.sectionProperties.nodeModifyText = L.DomUtil.create('textarea', 'loleaflet-annotation-textarea', this.sectionProperties.nodeModify);
		this.sectionProperties.contentText = L.DomUtil.create('div', '', this.sectionProperties.contentNode);
		this.sectionProperties.nodeReply = L.DomUtil.create('div', 'loleaflet-annotation-edit' + ' reply-annotation', this.sectionProperties.wrapper);
		this.sectionProperties.nodeReplyText = L.DomUtil.create('textarea', 'loleaflet-annotation-textarea', this.sectionProperties.nodeReply);

		var button = L.DomUtil.create('div', '', this.sectionProperties.nodeModify);
		L.DomEvent.on(this.sectionProperties.nodeModifyText, 'blur', this.containerLostFocus, this);
		L.DomEvent.on(this.sectionProperties.nodeReplyText, 'blur', this.containerLostFocusReply, this);
		this.createButton(button, 'annotation-cancel', _('Cancel'), this.containerCancelClick);
		this.createButton(button, 'annotation-save', _('Save'), this.containerSaveComment);
		button = L.DomUtil.create('div', '', this.sectionProperties.nodeReply);
		this.createButton(button, 'annotation-cancel', _('Cancel'), this.containerCancelClick);
		this.createButton(button, 'annotation-reply', _('Reply'), this.containerReplyClick);
		L.DomEvent.disableScrollPropagation(this.sectionProperties.container);

		this.sectionProperties.container.style.visibility = 'hidden';
		this.sectionProperties.nodeModify.style.display = 'none';
		this.sectionProperties.nodeReply.style.display = 'none';

		var events = ['click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'keydown', 'keypress', 'keyup', 'touchstart', 'touchmove', 'touchend'];
		L.DomEvent.on(this.sectionProperties.container, 'click', this.containerMouseClick, this);
		L.DomEvent.on(this.sectionProperties.container, 'mouseleave', this.containerMouseLeave, this);
		for (var it = 0; it < events.length; it++) {
			L.DomEvent.on(this.sectionProperties.container, events[it], L.DomEvent.stopPropagation, this);
		}

		L.DomEvent.on(this.sectionProperties.container, 'touchstart',
			function (e: TouchEvent) {
				if (e && e.touches.length > 1) {
					L.DomEvent.preventDefault(e);
				}
			},
			this);

		if ((<any>window).mode.isDesktop()) {
			L.DomEvent.on(this.sectionProperties.container, {
				mousewheel: this.map.scrollHandler._onWheelScroll,
				MozMousePixelScroll: L.DomEvent.preventDefault
			}, this.map.scrollHandler);
		}

		//this.map._panes.popupPane.appendChild(this._container);
		this.update();
	}

	public onResize () {

	}

	private setMarkerPosition () {
		var center: number = 0;
		if (!(<any>window).mode.isDesktop() && this.map._docLayer._cellCursorPixels) {
			center = this.map._docLayer._cellCursorPixels.getWidth() * 0.5;
		}

		var position: Array<number> = [0, 0];
		this.showSection = true;

		if (this.sectionProperties.selectedAreaPoint !== null)
			position = [this.sectionProperties.selectedAreaPoint[0] - center, this.sectionProperties.selectedAreaPoint[1]];
		else if (this.sectionProperties.cellCursorPoint !== null)
			position = [this.sectionProperties.cellCursorPoint[0] - center, this.sectionProperties.cellCursorPoint[1]];
		else
			this.showSection = false;

		// At this point, position is calculated without taking splitter into account.
		var splitPosCore = {x: 0, y: 0};
		if (this.map._docLayer.getSplitPanesContext())
			splitPosCore = this.map._docLayer.getSplitPanesContext().getSplitPos();

		splitPosCore.x *= this.dpiScale;
		splitPosCore.y *= this.dpiScale;

		if (position[0] <= splitPosCore.x)
			position[0] += this.documentTopLeft[0];
		else if (position[0] - this.documentTopLeft[0] <= splitPosCore.x)
			this.showSection = false;

		if (position[1] <= splitPosCore.y)
			position[1] += this.documentTopLeft[1];
		else if (position[1] - this.documentTopLeft[1] <= splitPosCore.y)
			this.showSection = false;

		this.setPosition(position[0], position[1]);
	}

	// Give bottom right position of selected area, in core pixels. Call with null parameter when auto fill marker is not visible.
	public calculatePositionViaCellSelection (point: Array<number>) {
		if (point === null) {
			this.sectionProperties.selectedAreaPoint = null;
		}
		else {
			this.sectionProperties.selectedAreaPoint = [point[0] - this.size[0] * 0.5, point[1] - this.size[1] * 0.5];
		}
		this.setMarkerPosition();
	}

	// Give bottom right position of cell cursor, in core pixels. Call with null parameter when auto fill marker is not visible.
	public calculatePositionViaCellCursor (point: Array<number>) {
		if (point === null) {
			this.sectionProperties.cellCursorPoint = null;
		}
		else {
			this.sectionProperties.cellCursorPoint = [point[0] - this.size[0] * 0.5, point[1] - this.size[1] * 0.5];
		}
		this.setMarkerPosition();
	}

	public onDraw () {

	}

	public onMouseMove (point: Array<number>, dragDistance: Array<number>, e: MouseEvent) {
		if (dragDistance === null || !this.sectionProperties.docLayer._cellAutoFillAreaPixels)
			return; // No dragging or no event handling or auto fill marker is not visible.

		var pos: any;

		if (!this.sectionProperties.draggingStarted) { // Is it first move?
			this.sectionProperties.draggingStarted = true;
			this.sectionProperties.dragStartPosition = this.sectionProperties.docLayer._cellAutoFillAreaPixels.getCenter();
			pos = new L.Point(this.sectionProperties.dragStartPosition[0], this.sectionProperties.dragStartPosition[1]);
			pos = this.sectionProperties.docLayer._corePixelsToTwips(pos);
			this.sectionProperties.docLayer._postMouseEvent('buttondown', pos.x, pos.y, 1, 1, 0);
		}

		point[0] = this.sectionProperties.dragStartPosition[0] + dragDistance[0];
		point[1] = this.sectionProperties.dragStartPosition[1] + dragDistance[1];
		pos = this.sectionProperties.docLayer._corePixelsToTwips(new L.Point(point[0], point[1]));

		this.sectionProperties.docLayer._postMouseEvent('move', pos.x, pos.y, 1, 1, 0);

		this.map.scrollingIsHandled = true;
		this.stopPropagating(); // Stop propagating to sections.
		e.stopPropagation(); // Stop native event.
	}

	public onMouseUp (point: Array<number>, e: MouseEvent) {
		if (this.sectionProperties.draggingStarted) {
			this.sectionProperties.draggingStarted = false;
			point[0] += this.myTopLeft[0] + this.size[0] * 0.5;
			point[1] += this.myTopLeft[1] + this.size[1] * 0.5;
			var pos = this.sectionProperties.docLayer._corePixelsToTwips(new L.Point(point[0], point[1]));
			this.sectionProperties.docLayer._postMouseEvent('buttonup', pos.x, pos.y, 1, 1, 0);
		}

		this.map.scrollingIsHandled = false;
		this.stopPropagating();
		e.stopPropagation();
		(<any>window).IgnorePanning = false;
	}

	public onMouseDown (point: Array<number>, e: MouseEvent) {
		// Just to be safe. We don't need this, but it makes no harm.
		this.stopPropagating();
		e.stopPropagation();
		(<any>window).IgnorePanning = true; // We'll keep this until we have consistent sections and remove map element.
	}

	public onMouseEnter () {
		this.sectionProperties.mapPane.style.cursor = 'crosshair';
	}

	public onMouseLeave () {
		this.sectionProperties.mapPane.style.cursor = 'default';
	}

	public onNewDocumentTopLeft () {
		this.setMarkerPosition();
	}

	public onClick () {}
	public onMouseWheel () {}
	public onDoubleClick () {}
	public onContextMenu () {}
	public onLongPress () {}
	public onMultiTouchStart () {}
	public onMultiTouchMove () {}
	public onMultiTouchEnd () {}
}
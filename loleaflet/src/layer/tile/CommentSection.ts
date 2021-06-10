/* eslint-disable */
/* See CanvasSectionContainer.ts for explanations. */

declare var L: any;
declare var app: any;
declare var _: any;
declare var Autolinker: any;

app.definitions.Comment =
class Comment {
	context: CanvasRenderingContext2D = null;
	myTopLeft: Array<number> = [0, 0];
	documentTopLeft: Array<number> = null;
	containerObject: any = null;
	dpiScale: number = null;
	name: string = L.CSections.Comment.name;
	backgroundColor: string = '';
	backgroundOpacity: number = 1; // Valid when backgroundColor is valid.
	borderColor: string = null;
	boundToSection: string = null;
	anchor: Array<any> = new Array(0);
	documentObject: boolean = true;
	position: Array<number> = [0, 0];
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

	constructor (data: any, options: any, commentListSectionPointer: any) {
		this.map = L.Map.THIS;

		if (!options)
			options = {};

		this.sectionProperties.commentListSection = commentListSectionPointer;

		this.sectionProperties.docLayer = this.map._docLayer;
		this.sectionProperties.selectedAreaPoint = null;
		this.sectionProperties.cellCursorPoint = null;

		this.sectionProperties.draggingStarted = false;
		this.sectionProperties.dragStartPosition = null;

		this.sectionProperties.minWidth = options.minWidth ? options.minWidth : 160;
		this.sectionProperties.maxHeight = options.maxHeight ? options.maxHeight : 50;
		this.sectionProperties.imgSize = options.imgSize ? options.imgSize : [32, 32];
		this.sectionProperties.margin = options.margin ? options.margin : [40, 40];
		this.sectionProperties.noMenu = options.noMenu ? options.noMenu : false;

		this.sectionProperties.data = data;
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

		this.sectionProperties.highlightedTextColor = '#777777'; // Writer.
		this.sectionProperties.usedTextColor = this.sectionProperties.data.color; // Writer.
		this.sectionProperties.showSelectedCoordinate = true; // Writer.

		if (this.sectionProperties.docLayer._docType === 'presentation' || this.sectionProperties.docLayer._docType === 'drawing') {
			this.sectionProperties.parthash = this.sectionProperties.data.parthash;
			this.sectionProperties.partIndex = this.sectionProperties.docLayer._partHashes.indexOf(this.sectionProperties.parthash);
		}

		this.sectionProperties.isHighlighted = false;

		this.name = data.id === 'new' ? 'new comment': 'comment ' + data.id;
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
		this.sectionProperties.contentNode.id = 'annotation-content-area-' + this.sectionProperties.data.id;
		this.sectionProperties.nodeModify = L.DomUtil.create('div', 'loleaflet-annotation-edit' + ' modify-annotation', this.sectionProperties.wrapper);
		this.sectionProperties.nodeModifyText = L.DomUtil.create('textarea', 'loleaflet-annotation-textarea', this.sectionProperties.nodeModify);
		this.sectionProperties.nodeModifyText.id = 'annotation-modify-textarea-' + this.sectionProperties.data.id;
		this.sectionProperties.contentText = L.DomUtil.create('div', '', this.sectionProperties.contentNode);
		this.sectionProperties.nodeReply = L.DomUtil.create('div', 'loleaflet-annotation-edit' + ' reply-annotation', this.sectionProperties.wrapper);
		this.sectionProperties.nodeReplyText = L.DomUtil.create('textarea', 'loleaflet-annotation-textarea', this.sectionProperties.nodeReply);
		this.sectionProperties.nodeReplyText.id = 'annotation-reply-textarea-' + this.sectionProperties.data.id;

		var button = L.DomUtil.create('div', '', this.sectionProperties.nodeModify);
		L.DomEvent.on(this.sectionProperties.nodeModifyText, 'blur', this.onLostFocus, this);
		L.DomEvent.on(this.sectionProperties.nodeReplyText, 'blur', this.onLostFocusReply, this);
		this.createButton(button, 'annotation-cancel-' + this.sectionProperties.data.id, _('Cancel'), this.onCancelClick);
		this.createButton(button, 'annotation-save-' + this.sectionProperties.data.id, _('Save'), this.onSaveComment);
		button = L.DomUtil.create('div', '', this.sectionProperties.nodeReply);
		this.createButton(button, 'annotation-cancel-reply-' + this.sectionProperties.data.id, _('Cancel'), this.onCancelClick);
		this.createButton(button, 'annotation-reply-' + this.sectionProperties.data.id, _('Reply'), this.onReplyClick);
		L.DomEvent.disableScrollPropagation(this.sectionProperties.container);

		this.sectionProperties.container.style.visibility = 'hidden';
		this.sectionProperties.nodeModify.style.display = 'none';
		this.sectionProperties.nodeReply.style.display = 'none';

		var events = ['click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'keydown', 'keypress', 'keyup', 'touchstart', 'touchmove', 'touchend'];
		L.DomEvent.on(this.sectionProperties.container, 'click', this.onMouseClick, this);
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

		this.update();
	}

	private createContainerAndWrapper () {
		this.sectionProperties.container = L.DomUtil.create('div', 'loleaflet-annotation');
		this.sectionProperties.container.id = 'comment-container-' + this.sectionProperties.data.id;

		var mobileClass = (<any>window).mode.isMobile() ? ' wizard-comment-box': '';

		if (this.sectionProperties.data.trackchange) {
			this.sectionProperties.wrapper = L.DomUtil.create('div', 'loleaflet-annotation-redline-content-wrapper' + mobileClass, this.sectionProperties.container);
		} else {
			this.sectionProperties.wrapper = L.DomUtil.create('div', 'loleaflet-annotation-content-wrapper' + mobileClass, this.sectionProperties.container);
		}

		document.getElementById('document-container').appendChild(this.sectionProperties.container);
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
		tr.id = 'author table row ' + this.sectionProperties.data.id;
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
		var tdMenu = L.DomUtil.create('td', 'loleaflet-annotation-menubar', document.getElementById('author table row ' + this.sectionProperties.data.id));
		this.sectionProperties.menu = L.DomUtil.create('div', this.sectionProperties.data.trackchange ? 'loleaflet-annotation-menu-redline' : 'loleaflet-annotation-menu', tdMenu);
		this.sectionProperties.menu.id = 'comment-annotation-menu-' + this.sectionProperties.data.id;
		this.sectionProperties.menu.onclick = this.menuOnMouseClick.bind(this);
		var divMenuTooltipText = _('Open menu');
		this.sectionProperties.menu.dataset.title = divMenuTooltipText;
		this.sectionProperties.menu.setAttribute('aria-label', divMenuTooltipText);
		this.sectionProperties.menu.annotation = this;
	}

	public setData (data: any) {
		this.sectionProperties.data = data;
	}

	private createTrackChangeButtons () {
		var tdAccept = L.DomUtil.create('td', 'loleaflet-annotation-menubar', document.getElementById('author table row ' + this.sectionProperties.data.id));
		var acceptButton = this.sectionProperties.acceptButton = L.DomUtil.create('button', 'loleaflet-redline-accept-button', tdAccept);

		var tdReject = L.DomUtil.create('td', 'loleaflet-annotation-menubar', document.getElementById('author table row ' + this.sectionProperties.data.id));
		var rejectButton = this.sectionProperties.rejectButton = L.DomUtil.create('button', 'loleaflet-redline-reject-button', tdReject);

		acceptButton.dataset.title = _('Accept change');
		acceptButton.setAttribute('aria-label', _('Accept change'));

		L.DomEvent.on(acceptButton, 'click', function() {
			this.map.fire('RedlineAccept', {id: this.sectionProperties.data.id});
		}, this);

		rejectButton.dataset.title = _('Reject change');
		rejectButton.setAttribute('aria-label', _('Reject change'));

		L.DomEvent.on(rejectButton, 'click', function() {
			this.map.fire('RedlineReject', {id: this.sectionProperties.data.id});
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

	public parentOf (comment: any) {
		return this.sectionProperties.data.id === comment.sectionProperties.data.parent;
	}

	public updateResolvedField (state: string) {
		this.sectionProperties.resolvedTextElement.text = state === 'true' ? 'Resolved' : '';
	}

	private updateContent () {
		this.sectionProperties.contentText.innerText = this.sectionProperties.data.text ? this.sectionProperties.data.text: '';
		// Get the escaped HTML out and find for possible, useful links
		var linkedText = Autolinker.link(this.sectionProperties.contentText.outerHTML);
		// Set the property of text field directly. This is insecure otherwise because it doesn't escape the input
		// But we have already escaped the input before and only thing we are adding on top of that is Autolinker
		// generated text.
		this.sectionProperties.contentText.innerHTML = linkedText;
		// Original unlinked text
		this.sectionProperties.contentText.origText = this.sectionProperties.data.text ? this.sectionProperties.data.text: '';
		this.sectionProperties.nodeModifyText.innerText = this.sectionProperties.data.text ? this.sectionProperties.data.text: '';
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
		this.sectionProperties.contentDate.innerText = isNaN(d.getTime()) ? this.sectionProperties.data.dateTime: d.toLocaleDateString((<any>String).locale, dateOptions);

		if (this.sectionProperties.data.trackchange) {
			this.sectionProperties.captionText.innerText = this.sectionProperties.data.description;
		}
	}

	private updateLayout () {
		var style = this.sectionProperties.wrapper.style;
		style.width = '';
		style.whiteSpace = 'nowrap';

		style.whiteSpace = '';
	}

	private setPositionAndSize () {
		var rectangles = this.sectionProperties.data.rectanglesOriginal;
		if (rectangles && this.sectionProperties.docLayer._docType === 'text') {
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
		else if (this.sectionProperties.data.cellPos && this.sectionProperties.docLayer._docType === 'spreadsheet') {
			var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
			this.size = [Math.round(this.sectionProperties.data.cellPos[2] * ratio), Math.round(this.sectionProperties.data.cellPos[3] * ratio)];
			this.setPosition(Math.round(this.sectionProperties.data.cellPos[0] * ratio), Math.round(this.sectionProperties.data.cellPos[1] * ratio));
		}
		else if (this.sectionProperties.docLayer._docType === 'presentation' || this.sectionProperties.docLayer._docType === 'drawing') {
			var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
			this.size = [Math.round(this.sectionProperties.imgSize[0] * this.dpiScale), Math.round(this.sectionProperties.imgSize[1] * this.dpiScale)];
			this.setPosition(Math.round(this.sectionProperties.data.rectangle[0] * ratio), Math.round(this.sectionProperties.data.rectangle[1] * ratio));
		}
	}

	public removeHighlight () {
		if (this.sectionProperties.docLayer._docType === 'text') {
			this.sectionProperties.usedTextColor = this.sectionProperties.data.color;

			this.sectionProperties.isHighlighted = false;
		}
		else if (this.sectionProperties.docLayer._docType === 'spreadsheet') {
			this.backgroundColor = null;
			this.backgroundOpacity = 1;
		}
	}

	public highlight () {
		if (this.sectionProperties.docLayer._docType === 'text') {
			this.sectionProperties.usedTextColor = this.sectionProperties.highlightedTextColor;

			var x: number = Math.round(this.position[0] / this.dpiScale);
			var y: number = Math.round(this.position[1] / this.dpiScale);
			this.containerObject.getSectionWithName(L.CSections.Scroll.name).onScrollTo({x: x, y: y});
		}
		else if (this.sectionProperties.docLayer._docType === 'spreadsheet') {
			this.backgroundColor = '#777777'; //background: rgba(119, 119, 119, 0.25);
			this.backgroundOpacity = 0.25;

			var x: number = Math.round(this.position[0] / this.dpiScale);
			var y: number = Math.round(this.position[1] / this.dpiScale);
			this.containerObject.getSectionWithName(L.CSections.Scroll.name).onScrollTo({x: x, y: y});
		}
		else if (this.sectionProperties.docLayer._docType === 'presentation' || this.sectionProperties.docLayer._docType === 'drawing') {
			var x: number = Math.round(this.position[0] / this.dpiScale);
			var y: number = Math.round(this.position[1] / this.dpiScale);
			this.containerObject.getSectionWithName(L.CSections.Scroll.name).onScrollTo({x: x, y: y});
		}

		this.containerObject.requestReDraw();
		this.sectionProperties.isHighlighted = true;
	}

	// This is for svg elements that will be bound to document-container.
	private convertRectanglesToCoreCoordinates () {
		var rectangles = this.sectionProperties.data.rectangles;
		var originals = this.sectionProperties.data.rectanglesOriginal;

		if (rectangles) {
			var documentAnchorSection = this.containerObject.getDocumentAnchorSection();
			var diff = [documentAnchorSection.myTopLeft[0] - this.documentTopLeft[0], documentAnchorSection.myTopLeft[1] - this.documentTopLeft[1]];

			var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
			for (var i = 0; i < rectangles.length; i++) {
				rectangles[i][0] = Math.round(originals[i][0] * ratio) + diff[0];
				rectangles[i][1] = Math.round(originals[i][1] * ratio) + diff[1];
				rectangles[i][2] = Math.round(originals[i][2] * ratio);
				rectangles[i][3] = Math.round(originals[i][3] * ratio);
			}
		}
	}

	private updatePosition () {
		this.convertRectanglesToCoreCoordinates();
		this.setPositionAndSize();
	}

	private updateAnnotationMarker () {
		// Make sure to place the markers only for presentations and draw documents
		if (this.sectionProperties.docLayer._docType !== 'presentation' && this.sectionProperties.docLayer._docType !== 'drawing')
			return;

		if (this.sectionProperties.data == null)
			return;

		if (this.sectionProperties.annotationMarker === null) {
			this.sectionProperties.annotationMarker = L.marker(new L.LatLng(0, 0), {
				icon: L.divIcon({
					className: 'annotation-marker',
					iconSize: null
				}),
				draggable: true
			});
			if (this.sectionProperties.docLayer._partHashes[this.sectionProperties.docLayer._selectedPart] === this.sectionProperties.data.parthash || app.file.fileBasedView)
				this.map.addLayer(this.sectionProperties.annotationMarker);
		}
		if (this.sectionProperties.data.rectangle != null) {
			this.sectionProperties.annotationMarker.setLatLng(this.sectionProperties.docLayer._twipsToLatLng(new L.Point(this.sectionProperties.data.rectangle[0], this.sectionProperties.data.rectangle[1])));
			this.sectionProperties.annotationMarker.on('dragstart drag dragend', this.onMarkerDrag, this);
			//this.sectionProperties.annotationMarker.on('click', this.onMarkerClick, this);
		}
	}

	public isContainerVisible () {
		return (this.sectionProperties.container.style && this.sectionProperties.container.style.visibility === '');
	}

	public updateScaling (scaleFactor: number, initialLayoutData: any) {
		if ((<any>window).mode.isDesktop())
			return;

		var wrapperWidth = Math.round(initialLayoutData.wrapperWidth * scaleFactor);
		this.sectionProperties.wrapper.style.width = wrapperWidth + 'px';
		var wrapperFontSize = Math.round(initialLayoutData.wrapperFontSize * scaleFactor);
		this.sectionProperties.wrapper.style.fontSize = wrapperFontSize + 'px';
		var contentAuthorHeight = Math.round(initialLayoutData.authorContentHeight * scaleFactor);
		this.sectionProperties.contentAuthor.style.height = contentAuthorHeight + 'px';
		var dateFontSize = Math.round(initialLayoutData.dateFontSize * scaleFactor);
		this.sectionProperties.contentDate.style.fontSize = dateFontSize + 'px';
		if (this.sectionProperties.menu) {
			var menuWidth = Math.round(initialLayoutData.menuWidth * scaleFactor);
			this.sectionProperties.menu.style.width = menuWidth + 'px';
			var menuHeight = Math.round(initialLayoutData.menuHeight * scaleFactor);
			this.sectionProperties.menu.style.height = menuHeight + 'px';

			if (this.sectionProperties.acceptButton) {
				this.sectionProperties.acceptButton.style.width = menuWidth + 'px';
				this.sectionProperties.acceptButton.style.height = menuHeight + 'px';
			}
			if (this.sectionProperties.rejectButton) {
				this.sectionProperties.rejectButton.style.width = menuWidth + 'px';
				this.sectionProperties.rejectButton.style.height = menuHeight + 'px';
			}
		}

		var authorImageWidth = Math.round(this.sectionProperties.imgSize[0] * scaleFactor);
		var authorImageHeight = Math.round(this.sectionProperties.imgSize[1] * scaleFactor);
		this.sectionProperties.authorAvatarImg.setAttribute('width', authorImageWidth);
		this.sectionProperties.authorAvatarImg.setAttribute('height', authorImageHeight);
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

		// On mobile, container shouldn't be 'document-container', but it is 'document-container' on initialization. So we hide the comment until comment wizard is opened.
		if ((<any>window).mode.isMobile() && this.sectionProperties.container.parentElement === document.getElementById('document-container'))
			this.sectionProperties.container.style.visibility = 'hidden';
		else
			this.sectionProperties.container.style.visibility = '';

		this.sectionProperties.contentNode.style.display = '';
		this.sectionProperties.nodeModify.style.display = 'none';
		this.sectionProperties.nodeReply.style.display = 'none';

		this.sectionProperties.showSelectedCoordinate = true; // Writer.

		if (this.sectionProperties.docLayer._docType === 'spreadsheet' && !(<any>window).mode.isMobile()) {
			var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
			var originalSize = [Math.round((this.sectionProperties.data.cellPos[2]) * ratio), Math.round((this.sectionProperties.data.cellPos[3]) * ratio)];

			var pos: Array<number> = [Math.round((this.myTopLeft[0] + originalSize[0] - 3) / this.dpiScale), Math.round(this.myTopLeft[1] / this.dpiScale)];
			(new L.PosAnimation()).run(this.sectionProperties.container, {x: pos[0], y: pos[1]});
		}
	}

	private hide () {
		if (this.sectionProperties.data.id === 'new') {
			this.containerObject.removeSection(this.name);
			return;
		}

		this.sectionProperties.container.style.visibility = 'hidden';
		//this.sectionProperties.contentNode.style.display = 'none';
		this.sectionProperties.nodeModify.style.display = 'none';
		this.sectionProperties.nodeReply.style.display = 'none';

		this.sectionProperties.showSelectedCoordinate = false; // Writer.

		this.hideMarker();
	}

	private menuOnMouseClick (e: any) {
		$(this.sectionProperties.menu).contextMenu();
		L.DomEvent.stopPropagation(e);
	}

	private onMouseClick (e: any) {
		if (((<any>window).mode.isMobile() || (<any>window).mode.isTablet())
			&& this.map.getDocType() == 'spreadsheet') {
			this.hide();
		}
		L.DomEvent.stopPropagation(e);
		this.sectionProperties.commentListSection.click(this);
	}

	public onReplyClick (e: any) {
		L.DomEvent.stopPropagation(e);
		if ((<any>window).mode.isMobile() || (<any>window).mode.isTablet()) {
			this.sectionProperties.data.reply = this.sectionProperties.data.text;
			this.show();
			this.sectionProperties.commentListSection.saveReply(this);
		} else {
			this.sectionProperties.data.reply = this.sectionProperties.nodeReplyText.value;
			// Assigning an empty string to .innerHTML property in some browsers will convert it to 'null'
			// While in browsers like Chrome and Firefox, a null value is automatically converted to ''
			// Better to assign '' here instead of null to keep the behavior same for all
			this.sectionProperties.nodeReplyText.value = '';
			this.show();
			this.sectionProperties.commentListSection.saveReply(this);
		}
	}

	public onCancelClick (e: any) {
		if (e)
			L.DomEvent.stopPropagation(e);
		this.sectionProperties.nodeModifyText.value = this.sectionProperties.contentText.origText;
		this.sectionProperties.nodeReplyText.value = '';
		this.show();
		this.sectionProperties.commentListSection.cancel(this);
	}

	public onSaveComment (e: any) {
		L.DomEvent.stopPropagation(e);
		this.sectionProperties.data.text = this.sectionProperties.nodeModifyText.value;
		this.updateContent();
		this.show();
		this.sectionProperties.commentListSection.save(this);
	}

	public onLostFocus (e: any) {
		$(this.sectionProperties.container).removeClass('annotation-active');
		if (this.sectionProperties.contentText.origText !== this.sectionProperties.nodeModifyText.value) {
			this.onSaveComment(e);
		}
		else {
			this.onCancelClick(e);
		}
	}

	public onLostFocusReply (e: any) {
		if (this.sectionProperties.nodeReplyText.value !== '') {
			this.onReplyClick(e);
		}
		else {
            this.sectionProperties.nodeReply.style.display = 'none';
        }
	}

	public focus () {
		this.sectionProperties.container.classList.add('annotation-active');
		this.sectionProperties.nodeModifyText.focus();
		this.sectionProperties.nodeReplyText.focus();
	}

	public reply () {
		this.sectionProperties.container.style.visibility = '';
		this.sectionProperties.contentNode.style.display = '';
		this.sectionProperties.nodeModify.style.display = 'none';
		this.sectionProperties.nodeReply.style.display = '';
		return this;
	}

	public edit () {
		this.sectionProperties.nodeModify.style.display = '';
		this.sectionProperties.nodeReply.style.display = 'none';
		this.sectionProperties.container.style.visibility = '';
		this.sectionProperties.contentNode.style.display = 'none';
		return this;
	}

	public isEdit () {
		return (this.sectionProperties.nodeModify && this.sectionProperties.nodeModify.style.display !== 'none') ||
		       (this.sectionProperties.nodeReply && this.sectionProperties.nodeReply.style.display !== 'none');
	}

	private sendAnnotationPositionChange (newPosition: any) {
		if (app.file.fileBasedView) {
			this.map.setPart(this.sectionProperties.docLayer._selectedPart, false);
			newPosition.y -= this.sectionProperties.data.yAddition;
		}

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

		if (app.file.fileBasedView)
			this.map.setPart(0, false);
	}

	private onMarkerDrag (event: any) {
		if (this.sectionProperties.annotationMarker == null)
			return;

		if (event.type === 'dragend') {
			var pointTwip = this.sectionProperties.docLayer._latLngToTwips(this.sectionProperties.annotationMarker.getLatLng());
			this.sendAnnotationPositionChange(pointTwip);
		}
	}

	public isDisplayed () {
		return (this.sectionProperties.container.style && this.sectionProperties.container.style.visibility === '');
	}

	public onResize () {
		this.updatePosition();
	}

	private doesRectangleContainPoint (rectangle: any, point: Array<number>): boolean {
        if (point[0] >= rectangle[0] && point[0] <= rectangle[0] + rectangle[2]) {
            if (point[1] >= rectangle[1] && point[1] <= rectangle[1] + rectangle[3]) {
                return true;
            }
        }
        return false;
	}

	public onClick (point: Array<number>, e: MouseEvent) {
		if (this.sectionProperties.docLayer._docType === 'text') {
			var rectangles = this.sectionProperties.data.rectangles;
			point[0] = point[0] + this.myTopLeft[0];
			point[1] = point[1] + this.myTopLeft[1];
			if (rectangles) { // A text file.
				for (var i: number = 0; i < rectangles.length; i++) {
					if (this.doesRectangleContainPoint(rectangles[i], point)) {
						this.sectionProperties.commentListSection.selectById(this.sectionProperties.data.id);
						e.stopPropagation();
						this.stopPropagating();
					}
				}
			}
		}
		else if (this.sectionProperties.docLayer._docType === 'presentation' || this.sectionProperties.docLayer._docType === 'drawing') {
			this.sectionProperties.commentListSection.selectById(this.sectionProperties.data.id);
			e.stopPropagation();
			this.stopPropagating();
		}
	}

	public onDraw () {
		if (this.sectionProperties.docLayer._docType === 'text' && this.sectionProperties.showSelectedCoordinate) {
			var rectangles: Array<any> = this.sectionProperties.data.rectangles;
			if (rectangles) {
				this.context.fillStyle = this.sectionProperties.usedTextColor;
				this.context.globalAlpha = 0.25;

				for (var i: number = 0; i < this.sectionProperties.data.rectangles.length;i ++) {
					var x = rectangles[i][0] - this.myTopLeft[0];
                    var y = rectangles[i][1] - this.myTopLeft[1];
                    var w = rectangles[i][2] > 3 ? rectangles[i][2]: 3;
                    var h = rectangles[i][3];

                    this.context.fillRect(x, y, w , h);
				}

				this.context.globalAlpha = 1;
			}
		}
	}

	public onMouseMove (point: Array<number>, dragDistance: Array<number>, e: MouseEvent) {}

	public onMouseUp (point: Array<number>, e: MouseEvent) {
		// Hammer.js doesn't fire onClick event after touchEnd event.
		// CanvasSectionContainer fires the onClick event. But since Hammer.js is used for map, it disables the onClick for SectionContainer.
		// We will use this event as click event on touch devices, until we remove Hammer.js (then this code will be removed from here).
		// Control.ColumnHeader.js file is not affected by this situation, because map element (so Hammer.js) doesn't cover headers.
		if (!this.containerObject.draggingSomething && (<any>window).mode.isMobile() || (<any>window).mode.isTablet()) {
			if (this.sectionProperties.docLayer._docType === 'presentataion' || this.sectionProperties.docLayer._docType === 'drawing')
				this.sectionProperties.docLayer._openCommentWizard(this);
			this.onMouseEnter();
			this.onClick(point, e);
		}
	}

	public onMouseDown (point: Array<number>, e: MouseEvent) {}

	public onMouseEnter () {
		if (this.sectionProperties.docLayer._docType === 'spreadsheet') {
			// When mouse is above this section, comment's HTML element will be shown.
			// If mouse pointer goes to HTML element, onMouseLeave event shouldn't be fired.
			// But mouse pointer will have left the borders of this section and onMouseLeave event will be fired.
			// Let's do it properly, when mouse is above this section, we will make this section's size bigger and onMouseLeave event will not be fired.
			if (parseInt(this.sectionProperties.data.tab) === this.sectionProperties.docLayer._selectedPart) {
				var containerWidth: number = this.sectionProperties.container.getBoundingClientRect().width;
				var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
				this.size = [Math.round((this.sectionProperties.data.cellPos[2]) * ratio + containerWidth), Math.round((this.sectionProperties.data.cellPos[3]) * ratio)];
				this.sectionProperties.commentListSection.selectById(this.sectionProperties.data.id);
				this.show();
			}
		}
	}

	public onMouseLeave (point: Array<number>) {
		if (this.sectionProperties.docLayer._docType === 'spreadsheet') {
			if (parseInt(this.sectionProperties.data.tab) === this.sectionProperties.docLayer._selectedPart) {
				// Revert the changes we did on "onMouseEnter" event.
				var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
				this.size = [Math.round((this.sectionProperties.data.cellPos[2]) * ratio), Math.round((this.sectionProperties.data.cellPos[3]) * ratio)];
				if (point) {
					this.hide();
				}
			}
		}
	}

	public onNewDocumentTopLeft () {
		this.updatePosition();
	}

	public onRemove () {
		this.sectionProperties.commentListSection.hideArrow();
		var that = this;
		var container = this.sectionProperties.container;
		if (container && container.parentElement) {
			setTimeout(function () {
				container.parentElement.removeChild(container);
				that.hideMarker();
			}, 100);
		}
	}

	public onMouseWheel () {}
	public onDoubleClick () {}
	public onContextMenu () {}
	public onLongPress () {}
	public onMultiTouchStart () {}
	public onMultiTouchMove () {}
	public onMultiTouchEnd () {}
}
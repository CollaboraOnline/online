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
		this.sectionProperties.nodeModify = L.DomUtil.create('div', 'loleaflet-annotation-edit' + ' modify-annotation', this.sectionProperties.wrapper);
		this.sectionProperties.nodeModifyText = L.DomUtil.create('textarea', 'loleaflet-annotation-textarea', this.sectionProperties.nodeModify);
		this.sectionProperties.contentText = L.DomUtil.create('div', '', this.sectionProperties.contentNode);
		this.sectionProperties.nodeReply = L.DomUtil.create('div', 'loleaflet-annotation-edit' + ' reply-annotation', this.sectionProperties.wrapper);
		this.sectionProperties.nodeReplyText = L.DomUtil.create('textarea', 'loleaflet-annotation-textarea', this.sectionProperties.nodeReply);

		var button = L.DomUtil.create('div', '', this.sectionProperties.nodeModify);
		L.DomEvent.on(this.sectionProperties.nodeModifyText, 'blur', this.onLostFocus, this);
		L.DomEvent.on(this.sectionProperties.nodeReplyText, 'blur', this.onLostFocusReply, this);
		this.createButton(button, 'annotation-cancel-' + this.sectionProperties.data.id, _('Cancel'), this.onCancelClick);
		this.createButton(button, 'annotation-save-' + this.sectionProperties.data.id, _('Save'), this.onSaveComment);
		button = L.DomUtil.create('div', '', this.sectionProperties.nodeReply);
		this.createButton(button, 'annotation-cancel-reply-' + this.sectionProperties.data.id, _('Cancel'), this.onCancelClick);
		this.createButton(button, 'annotation-reply', _('Reply'), this.onReplyClick);
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

		document.getElementById('document-container').appendChild(this.sectionProperties.container);
		this.update();
	}

	private createContainerAndWrapper () {
		this.sectionProperties.container = L.DomUtil.create('div', 'loleaflet-annotation');

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
		// .text() method will escape the string, does not interpret the string as HTML
		this.sectionProperties.contentText.innerText = this.sectionProperties.data.text;
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

	// This returns the svg element for the commented portion of the document. Doesn't set the coordinates of it.
	private getContainerForCommentedText () {
		var data = this.sectionProperties.data;

		var container = document.getElementById('commented-text-container-' + data.id);
		if (container)
			data.textSelected = container;

		if (data.textSelected) {
			data.textSelected.setAttribute('width', String(this.context.canvas.width));
			data.textSelected.setAttribute('height', String(this.context.canvas.height));
			return data.textSelected;
		}
		else {
			var svg: SVGElement = (<any>document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
			svg.setAttribute('version', '1.1');
			svg.style.zIndex = '9';
			svg.id = 'commented-text-container-' + data.id;
			svg.style.position = 'absolute';
			svg.style.top = svg.style.left = svg.style.right = svg.style.bottom = '0';
			svg.setAttribute('width', String(this.context.canvas.width));
			svg.setAttribute('height', String(this.context.canvas.height));

			document.getElementById('document-container').appendChild(svg);
			data.textSelected = svg;
			return svg;
		}
	}

	private setPositionAndSize () {
		var rectangles = this.sectionProperties.data.rectangles;
		if (rectangles) { // A text file.
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
			var documentAnchorSection = this.containerObject.getDocumentAnchorSection();
			var diff = [documentAnchorSection.myTopLeft[0] - this.documentTopLeft[0], documentAnchorSection.myTopLeft[1] - this.documentTopLeft[1]];
			this.setPosition(xMin - diff[0], yMin - diff[1]); // This function is added by section container.
			this.size = [xMax - xMin, yMax - yMin];
		}
	}

	private createRectanglesForSelectedText (container: any) {
		var rectangles = this.sectionProperties.data.rectangles;
		var data = this.sectionProperties.data;
		if (rectangles && container) {
			for (var i = 0; i < rectangles.length; i++) {
				var rectangle: SVGRectElement = <SVGRectElement>(<any>document.getElementById('commented-text-rectangle-' + data.id + '-' + String(i)));
				if (!rectangle) {
					rectangle = document.createElementNS('http://www.w3.org/2000/svg','rect');
					rectangle.id = 'commented-text-rectangle-' + data.id + '-' + String(i);
					rectangle.setAttribute('fill-opacity', '1');
					rectangle.setAttribute('weight', '2');
					rectangle.setAttribute('opacity', '0.25');
					container.append(rectangle);
				}

				// Svg elements are added into document-container. Their coordinates are in CSS units.
				rectangle.setAttributeNS(null, 'x', String(Math.round(rectangles[i][0] / this.dpiScale)));
				rectangle.setAttributeNS(null, 'y', String(Math.round(rectangles[i][1] / this.dpiScale)));
				rectangle.setAttributeNS(null, 'width', String(Math.round(rectangles[i][2] / this.dpiScale) > 1 ? Math.round(rectangles[i][2] / this.dpiScale): 1));
				rectangle.setAttributeNS(null, 'height', String(Math.round(rectangles[i][3] / this.dpiScale) > 1 ? Math.round(rectangles[i][3] / this.dpiScale): 1));
				rectangle.setAttributeNS(null, 'fill', data.color);
				rectangle.setAttributeNS(null, 'stroke', data.color);
			}

			// Remove extra elements (Example: user added a multi line comment and deleted some lines).
			for (i = container.children.length - 1; i > -1; i--) {
				var rectElement = container.children[i];
				var number = parseInt(rectElement.id.replace('commented-text-rectangle-' + data.id + '-', ''));
				if (number >= rectangles.length) {
					container.removeChild(container.children[i]);
				}
			}
		}
	}

	private removeHighlight () {
		var selectionContainer = this.getContainerForCommentedText();
		if (selectionContainer)
			selectionContainer.style.display = 'block';

		var element = document.getElementById('commented-text-highlighter-container-' + this.sectionProperties.data.id);
		if (element)
			element.parentElement.removeChild(element);

			this.sectionProperties.isHighlighted = false;
	}

	public highlightSelectedText () {
		var selectionContainer = this.getContainerForCommentedText();

		if (selectionContainer) {
			selectionContainer.style.display = 'none';
			var highlighterContainer: SVGElement = (<any>document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
			highlighterContainer = selectionContainer.cloneNode();
			highlighterContainer.id = 'commented-text-highlighter-container-' + this.sectionProperties.data.id;
			selectionContainer.parentElement.append(highlighterContainer);
			for (var i = 0; i < selectionContainer.children.length; i++) {
				selectionContainer.children[i].setAttribute('stroke', '#777777');
				selectionContainer.children[i].setAttribute('fill', '#777777');
			}
			this.sectionProperties.isHighlighted = true;
		}
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
		var data = this.sectionProperties.data;
		this.convertRectanglesToCoreCoordinates();
		this.setPositionAndSize();
		var container = this.getContainerForCommentedText();
		this.createRectanglesForSelectedText(container);

		// If text is highlighted, refresh it.
		if (document.getElementById('commented-text-highlighter-container-' + data.id)) {
			this.removeHighlight();
			this.highlightSelectedText();
		}
	}

	private updateAnnotationMarker () {
		// Make sure to place the markers only for presentations and draw documents
		if (this.sectionProperties.docLayer._docType !== 'presentation' && this.sectionProperties.docLayer._docType !== 'drawing')
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
			if (this.sectionProperties.docLayer._partHashes[this.sectionProperties.docLayer._selectedPart] == this.sectionProperties.data.parthash)
				this.map.addLayer(this.sectionProperties.annotationMarker);
		}
		if (this.sectionProperties.data.rectangle != null) {
			var stringTwips = this.sectionProperties.data.rectangle.match(/\d+/g);
			var topLeftTwips = new L.Point(parseInt(stringTwips[0]), parseInt(stringTwips[1]));
			var offset = new L.Point(parseInt(stringTwips[2]), parseInt(stringTwips[3]));
			var bottomRightTwips = topLeftTwips.add(offset);
			var bounds = new L.LatLngBounds(
				this.sectionProperties.docLayer._twipsToLatLng(topLeftTwips, this.map.getZoom()),
				this.sectionProperties.docLayer._twipsToLatLng(bottomRightTwips, this.map.getZoom()));
			this.sectionProperties._annotationMarker.setLatLng(bounds.getNorthWest());
			this.sectionProperties._annotationMarker.on('dragstart drag dragend', this.onMarkerDrag, this);
			this.sectionProperties._annotationMarker.on('click', this.onMarkerClick, this);
		}
		if (this.sectionProperties.annotationMarker._icon) {
			(new Hammer(this.sectionProperties.annotationMarker._icon, {recognizers: [[Hammer.Tap]]}))
				.on('tap', function() {
					this.sectionProperties.docLayer._openCommentWizard(this);
				}.bind(this));
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

		var authorImageWidth = Math.round(this.sectionProperties.imgSize.x * scaleFactor);
		var authorImageHeight = Math.round(this.sectionProperties.imgSize.y * scaleFactor);
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
		else if (this.sectionProperties.nodeModifyText.value === '') {
			this.onCancelClick(e);
		}
	}

	public onLostFocusReply (e: any) {
		if (this.sectionProperties.nodeReplyText.value !== '') {
			this.onReplyClick(e);
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

	private onMarkerClick () {
		this.map.fire('AnnotationSelect', {annotation: this});
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
		var rectangles = this.sectionProperties.data.rectangles;
		point[0] = point[0] + this.myTopLeft[0];
		point[1] = point[1] + this.myTopLeft[1];
		if (rectangles) { // A text file.
			for (var i: number = 0; i < rectangles.length; i++) {
				if (this.doesRectangleContainPoint(rectangles[i], point)) {
					this.sectionProperties.commentListSection.selectById(this.sectionProperties.data.id);
					e.stopPropagation();
					this.stopPropagating();
					return;
				}
			}
		}
	}

	public onDraw () {}

	public onMouseMove (point: Array<number>, dragDistance: Array<number>, e: MouseEvent) {}

	public onMouseUp (point: Array<number>, e: MouseEvent) {}

	public onMouseDown (point: Array<number>, e: MouseEvent) {}

	public onMouseEnter () {}

	public onMouseLeave () {}

	public onNewDocumentTopLeft () {
		this.updatePosition();
	}

	public onRemove () {
		var data = this.sectionProperties.data;
		if (data.textSelected) {
			data.textSelected.parentElement.removeChild(data.textSelected);
		}

		var highlighter = document.getElementById('commented-text-highlighter-container-' + data.id);
		if (highlighter)
			highlighter.parentElement.removeChild(highlighter);
	}

	public onMouseWheel () {}
	public onDoubleClick () {}
	public onContextMenu () {}
	public onLongPress () {}
	public onMultiTouchStart () {}
	public onMultiTouchMove () {}
	public onMultiTouchEnd () {}
}
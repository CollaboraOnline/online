/* -*- js-indent-level: 8 -*- */

/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
/* See CanvasSectionContainer.ts for explanations. */

declare var L: any;
declare var app: any;
declare var _: any;
declare var Autolinker: any;
declare var DOMPurify : any;

namespace cool {

/*
	data.layoutStatus: Enumartion sent from the core side.
	0: INVISIBLE, 1: VISIBLE, 2: INSERTED, 3: DELETED, 4: NONE, 5: HIDDEN
	Ex: "DELETED" means that the comment is deleted while the "track changes" is on.
*/
export enum CommentLayoutStatus {
	INVISIBLE,
	VISIBLE,
	INSERTED,
	DELETED,
	NONE,
	HIDDEN
}

export class Comment extends CanvasSectionObject {
	name: string = L.CSections.Comment.name;
	processingOrder: number = L.CSections.Comment.processingOrder;
	drawingOrder: number = L.CSections.Comment.drawingOrder;
	zIndex: number = L.CSections.Comment.zIndex;

	valid: boolean = true;
	map: any;
	pendingInit: boolean = true;

	cachedCommentHeight: number | null = null;
	cachedIsEdit: boolean = false;
	hidden: boolean | null = null;

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	constructor (data: any, options: any, commentListSectionPointer: cool.CommentSection) {
		super();

		this.myTopLeft = [0, 0];
		this.documentObject = true;
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

		if (data.parent === undefined)
			data.parent = '0';

		this.sectionProperties.data = data;

		/*
			possibleParentCommentId:
				* User deletes a parent comment.
				* User deletes also its child comment.
				* User reverts the last change (deletion of child comment).
				* A comment "Add" action is sent from the core side.
				* The child comment has also its parent id.
				* But there is no such parent at the moment.
				* So we will remember its possible parent comment in case user also reverts the deletion of parent comment.
				* In that case, parent comment will come with its old id.
				* Child comment can now find its parent.
				* We will check child comment to see if its parent has also been revived.
		*/
		this.sectionProperties.possibleParentCommentId = null;
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

		if (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing') {
			this.sectionProperties.parthash = parseInt(this.sectionProperties.data.parthash);
			this.sectionProperties.partIndex = app.impress.getIndexFromSlideHash(this.sectionProperties.parthash);
		}

		this.sectionProperties.isHighlighted = false;

		this.name = data.id === 'new' ? 'new comment': 'comment ' + data.id;

		this.sectionProperties.commentContainerRemoved = false;
		this.sectionProperties.children = []; // This is used for Writer comments. There is parent / child relationship between comments in Writer files.
		this.sectionProperties.childLinesNode = null;
		this.sectionProperties.childLines = [];
		this.sectionProperties.childCommentOffset = 8;
		this.sectionProperties.commentMarkerSubSection = null; // For Impress and Draw documents.

		this.convertRectanglesToCoreCoordinates(); // Convert rectangle coordiantes into core pixels on initialization.

		app.map.on('sheetgeometrychanged', this.setPositionAndSize.bind(this));
	}

	// Comments import can be costly if the document has a lot of them. If they are all imported/initialized
	// when online gets comments message from core, the initial doc render is delayed. To avoid that we do
	// lazy import of each comment when it needs to be shown (based on its coordinates).
	private doPendingInitializationInView (force: boolean = false): void {
		if (!this.pendingInit)
			return;

		if (!force && !this.convertRectanglesToViewCoordinates())
			return;

		var button = L.DomUtil.create('div', 'annotation-btns-container', this.sectionProperties.nodeModify);
		L.DomEvent.on(this.sectionProperties.nodeModifyText, 'input', this.textAreaInput, this);
		L.DomEvent.on(this.sectionProperties.nodeReplyText, 'input', this.textAreaInput, this);
		L.DomEvent.on(this.sectionProperties.nodeModifyText, 'keydown', this.textAreaKeyDown, this);
		L.DomEvent.on(this.sectionProperties.nodeReplyText, 'keydown', this.textAreaKeyDown, this);
		this.createButton(button, 'annotation-cancel-' + this.sectionProperties.data.id, 'annotation-button button-secondary', _('Cancel'), this.handleCancelCommentButton);
		this.createButton(button, 'annotation-save-' + this.sectionProperties.data.id, 'annotation-button button-primary',_('Save'), this.handleSaveCommentButton);
		button = L.DomUtil.create('div', '', this.sectionProperties.nodeReply);
		this.createButton(button, 'annotation-cancel-reply-' + this.sectionProperties.data.id, 'annotation-button button-secondary', _('Cancel'), this.handleCancelCommentButton);
		this.createButton(button, 'annotation-reply-' + this.sectionProperties.data.id, 'annotation-button button-primary', _('Reply'), this.handleReplyCommentButton);
		L.DomEvent.disableScrollPropagation(this.sectionProperties.container);

		// Since this is a late called function, if the width is enough, we shouldn't collapse the comments.
		if (app.map._docLayer._docType !== 'text' || this.sectionProperties.commentListSection.isCollapsed === true)
			this.sectionProperties.container.style.visibility = 'hidden';

		this.sectionProperties.nodeModify.style.display = 'none';
		this.sectionProperties.nodeReply.style.display = 'none';

		var events = ['click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 'keydown', 'keypress', 'keyup', 'touchstart', 'touchmove', 'touchend'];
		L.DomEvent.on(this.sectionProperties.container, 'click', this.onMouseClick, this);
		L.DomEvent.on(this.sectionProperties.container, 'keydown', this.onEscKey, this);

		this.sectionProperties.container.onwheel = function(e: WheelEvent) {
			// Don't scroll the document if mouse is over comment content. Scrolling the comment content is priority.
			if (!this.sectionProperties.contentNode.matches(':hover')) {
				e.preventDefault();
				app.sectionContainer.onMouseWheel(e);
			}
		}.bind(this);

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

		this.update();

		this.pendingInit = false;
	}

	public onInitialize (): void {
		this.createContainerAndWrapper();

		this.createAuthorTable();

		if (this.sectionProperties.data.trackchange && !this.map.isReadOnlyMode()) {
			this.createTrackChangeButtons();
		}

		if (this.sectionProperties.noMenu !== true && app.isCommentEditingAllowed()) {
			this.createMenu();
		}

		if (this.sectionProperties.data.trackchange) {
			this.sectionProperties.captionNode = L.DomUtil.create('div', 'cool-annotation-caption', this.sectionProperties.wrapper);
			this.sectionProperties.captionText = L.DomUtil.create('div', '', this.sectionProperties.captionNode);
		}

		this.sectionProperties.contentNode = L.DomUtil.create('div', 'cool-annotation-content cool-dont-break', this.sectionProperties.wrapper);
		this.sectionProperties.contentNode.id = 'annotation-content-area-' + this.sectionProperties.data.id;
		this.sectionProperties.nodeModify = L.DomUtil.create('div', 'cool-annotation-edit' + ' modify-annotation', this.sectionProperties.wrapper);
		this.sectionProperties.nodeModifyText = L.DomUtil.create('div', 'cool-annotation-textarea', this.sectionProperties.nodeModify);
		this.sectionProperties.nodeModifyText.setAttribute('contenteditable', 'true');
		this.sectionProperties.nodeModifyText.id = 'annotation-modify-textarea-' + this.sectionProperties.data.id;
		this.sectionProperties.contentText = L.DomUtil.create('div', '', this.sectionProperties.contentNode);
		this.sectionProperties.nodeReply = L.DomUtil.create('div', 'cool-annotation-edit' + ' reply-annotation', this.sectionProperties.wrapper);
		this.sectionProperties.nodeReplyText = L.DomUtil.create('div', 'cool-annotation-textarea', this.sectionProperties.nodeReply);
		this.sectionProperties.nodeReplyText.setAttribute('contenteditable', 'true');
		this.sectionProperties.nodeReplyText.id = 'annotation-reply-textarea-' + this.sectionProperties.data.id;
		this.createChildLinesNode();

		this.sectionProperties.container.style.visibility = 'hidden';

		if (this.sectionProperties.commentMarkerSubSection === null && app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing')
			this.createMarkerSubSection();

		this.doPendingInitializationInView();
	}

	private createContainerAndWrapper (): void {
		var isRTL = document.documentElement.dir === 'rtl';
		this.sectionProperties.container = L.DomUtil.create('div', 'cool-annotation' + (isRTL ? ' rtl' : ''));
		this.sectionProperties.container.id = 'comment-container-' + this.sectionProperties.data.id;
		L.DomEvent.on(this.sectionProperties.container, 'focusout', this.onLostFocus, this);

		var mobileClass = (<any>window).mode.isMobile() ? ' wizard-comment-box': '';

		if (this.sectionProperties.data.trackchange) {
			this.sectionProperties.wrapper = L.DomUtil.create('div', 'cool-annotation-redline-content-wrapper' + mobileClass, this.sectionProperties.container);
		} else {
			this.sectionProperties.wrapper = L.DomUtil.create('div', 'cool-annotation-content-wrapper' + mobileClass, this.sectionProperties.container);
		}

		this.sectionProperties.wrapper.style.marginLeft = this.sectionProperties.childCommentOffset*this.getChildLevel() + 'px';

		if (!(<any>window).mode.isMobile())
			document.getElementById('document-container').appendChild(this.sectionProperties.container);

		// We make comment directly visible when its transitioned to its determined position
		if (cool.CommentSection.autoSavedComment)
			this.sectionProperties.container.style.visibility = 'hidden';
	}

	private createAuthorTable (): void {
		this.sectionProperties.author = L.DomUtil.create('table', 'cool-annotation-table', this.sectionProperties.wrapper);

		var tbody = L.DomUtil.create('tbody', '', this.sectionProperties.author);
		var rowResolved = L.DomUtil.create('tr', '', tbody);
		var tdResolved = L.DomUtil.create('td', 'cool-annotation-resolved', rowResolved);
		var pResolved = L.DomUtil.create('div', 'cool-annotation-content-resolved', tdResolved);
		this.sectionProperties.resolvedTextElement = pResolved;

		this.updateResolvedField(this.sectionProperties.data.resolved);

		var tr = L.DomUtil.create('tr', '', tbody);
		this.sectionProperties.authorRow = tr;
		tr.id = 'author table row ' + this.sectionProperties.data.id;
		var tdImg = L.DomUtil.create('td', 'cool-annotation-img', tr);
		var tdAuthor = L.DomUtil.create('td', 'cool-annotation-author', tr);
		var imgAuthor = L.DomUtil.create('img', 'avatar-img', tdImg);
		var viewId = this.map.getViewId(this.sectionProperties.data.author);
		app.LOUtil.setUserImage(imgAuthor, this.map, viewId);
		imgAuthor.setAttribute('width', this.sectionProperties.imgSize[0]);
		imgAuthor.setAttribute('height', this.sectionProperties.imgSize[1]);

		if (app.map._docLayer._docType !== 'spreadsheet') {
			this.sectionProperties.collapsedInfoNode = L.DomUtil.create('div', 'cool-annotation-info-collapsed', tdImg);
			this.sectionProperties.collapsedInfoNode.style.display = 'none';
		}

		this.sectionProperties.authorAvatarImg = imgAuthor;
		this.sectionProperties.authorAvatartdImg = tdImg;
		this.sectionProperties.contentAuthor = L.DomUtil.create('div', 'cool-annotation-content-author', tdAuthor);
		this.sectionProperties.contentDate = L.DomUtil.create('div', 'cool-annotation-date', tdAuthor);
		this.sectionProperties.autoSave = L.DomUtil.create('div', 'cool-annotation-autosavelabel', tdAuthor);
	}

	private createMenu (): void {
		var tdMenu = L.DomUtil.create('td', 'cool-annotation-menubar', this.sectionProperties.authorRow);
		this.sectionProperties.menu = L.DomUtil.create('div', this.sectionProperties.data.trackchange ? 'cool-annotation-menu-redline' : 'cool-annotation-menu', tdMenu);
		this.sectionProperties.menu.id = 'comment-annotation-menu-' + this.sectionProperties.data.id;
		this.sectionProperties.menu.tabIndex = 0;
		this.sectionProperties.menu.onclick = this.menuOnMouseClick.bind(this);
		this.sectionProperties.menu.onkeypress = this.menuOnKeyPress.bind(this);
		var divMenuTooltipText = _('Open menu');
		this.sectionProperties.menu.dataset.title = divMenuTooltipText;
		this.sectionProperties.menu.setAttribute('aria-label', divMenuTooltipText);
		this.sectionProperties.menu.annotation = this;
	}

	private createChildLinesNode (): void {
		this.sectionProperties.childLinesNode = L.DomUtil.create('div', '', this.sectionProperties.container);
		this.sectionProperties.childLinesNode.id = 'annotation-child-lines-' + this.sectionProperties.data.id;
		this.sectionProperties.childLinesNode.style.width = this.sectionProperties.childCommentOffset*(this.getChildLevel() + 1) + 'px';
	}

	public updateChildLines (): void {
		if (!this.isContainerVisible())
			return;
		this.sectionProperties.wrapper.style.marginLeft =  this.sectionProperties.childCommentOffset*this.getChildLevel() + 'px';
		this.sectionProperties.childLinesNode.style.width = this.sectionProperties.childCommentOffset*(this.getChildLevel() + 1) + 'px';

		const childPositions = [];
		for (let i = 0; i < this.sectionProperties.children.length; i++) {
			if (this.sectionProperties.children[i].isContainerVisible())
				childPositions.push({ id: this.sectionProperties.children[i].sectionProperties.data.id,
									posY: this.sectionProperties.children[i].sectionProperties.container._leaflet_pos.y});
		}
		childPositions.sort((a, b) => { return a.posY - b.posY; });
		let lastPosY = this.sectionProperties.container._leaflet_pos.y + this.getCommentHeight(false);
		let i = 0;
		for (; i < childPositions.length; i++) {
			if (this.sectionProperties.childLines[i] === undefined) {
				this.sectionProperties.childLines[i] = L.DomUtil.create('div', 'cool-annotation-child-line', this.sectionProperties.childLinesNode);
				this.sectionProperties.childLines[i].id = 'annotation-child-line-' + this.sectionProperties.data.id + '-' + i;
				this.sectionProperties.childLines[i].style.width = this.sectionProperties.childCommentOffset/2 + 'px';
				// this.sectionProperties.childLines[i].style.borderStyle = 'none none dashed dashed';
				// this.sectionProperties.childLines[i].style.borderWidth = 'thin';
				// this.sectionProperties.childLines[i].style.borderColor = 'darkgray';
			}
			this.sectionProperties.childLines[i].style.marginLeft =  (this.sectionProperties.childCommentOffset*this.getChildLevel() + 4) + 'px';
			this.sectionProperties.childLines[i].style.height = (childPositions[i].posY + 24 - lastPosY) + 'px';
			lastPosY = childPositions[i].posY + 24;
		}
		if (i < this.sectionProperties.childLines.length) {
			for (let j = i; j < this.sectionProperties.childLines.length; j++) {
				this.sectionProperties.childLinesNode.removeChild(this.sectionProperties.childLines[i]);
				this.sectionProperties.childLines.splice(i);
			}
		}

	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public setData (data: any): void {
		this.sectionProperties.data = data;
	}

	private createTrackChangeButtons (): void {
		var tdAccept = L.DomUtil.create('td', 'cool-annotation-menubar', this.sectionProperties.authorRow);
		var acceptButton = this.sectionProperties.acceptButton = L.DomUtil.create('button', 'cool-redline-accept-button', tdAccept);

		var tdReject = L.DomUtil.create('td', 'cool-annotation-menubar', this.sectionProperties.authorRow);
		var rejectButton = this.sectionProperties.rejectButton = L.DomUtil.create('button', 'cool-redline-reject-button', tdReject);

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

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	private createButton (container: any, id: any, cssClass: string, value: any, handler: any): void {
		var button = L.DomUtil.create('input', cssClass, container);
		button.id = id;
		button.type = 'button';
		button.value = value;
		L.DomEvent.on(button, 'mousedown', L.DomEvent.preventDefault);
		L.DomEvent.on(button, 'click', handler, this);
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public parentOf (comment: any): boolean {
		return this.sectionProperties.data.id === comment.sectionProperties.data.parent;
	}

	public updateResolvedField (state: string): void {
		this.sectionProperties.resolvedTextElement.innerText = state === 'true' ? _('Resolved') : '';
	}

	private isNewPara(): boolean {
		const selection = window.getSelection();
		if (!selection.rangeCount) return;

		const range = selection.getRangeAt(0);
		const cursorPosition = range.startOffset;
		const node = range.startContainer;

		const beforeCursor = node.textContent.slice(0, cursorPosition);
		return /^\s*$/.test(beforeCursor.slice(0, -1));
	}

	private textAreaInput(ev: any): void {
		this.sectionProperties.autoSave.innerText = '';

		if (ev && app.map._docLayer._docType === 'text') {
			// special handling for mentions
			this.map?.mention.handleMentionInput(ev, this.isNewPara());
		}
	}

	private handleKeyDownForPopup (ev: any, id: string): void {
		var popup = this.map._textInput._handleKeyDownForPopup(ev, id);
		// Block Esc from propogating if it closes the comment mention Popup
		if (popup && id === 'mentionPopup' && ev.key === 'Escape') {
			ev.preventDefault();
			ev.stopPropagation();
		}
	}

	private textAreaKeyDown (ev: any): void {
		if (ev && ev.ctrlKey && ev.key === "Enter") {
			this.map.mention?.closeMentionPopup(false);

			if (this.sectionProperties.nodeReplyText.id == ev.srcElement.id) {
				this.handleReplyCommentButton(ev);
			} else {
				this.handleSaveCommentButton(ev);
			}
			return;
		}

		this.handleKeyDownForPopup(ev, 'mentionPopup');
	}

	private sanitize (html: string): string {
		if (DOMPurify.isSupported) {
			return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
		}
		return '';
	}

	private updateContent (): void {
		if(this.sectionProperties.data.html)
			this.sectionProperties.contentText.innerHTML = this.sanitize(this.sectionProperties.data.html);
		else
			this.sectionProperties.contentText.innerText = this.sectionProperties.data.text ? this.sectionProperties.data.text: '';
		// Get the escaped HTML out and find for possible, useful links
		var linkedText = Autolinker.link(this.sectionProperties.contentText.outerHTML);
		this.sectionProperties.contentText.innerHTML = this.sanitize(linkedText);
		// Original unlinked text
		this.sectionProperties.contentText.origText = this.sectionProperties.data.text ? this.sectionProperties.data.text: '';
		this.sectionProperties.contentText.origHTML = this.sectionProperties.data.html ? this.sectionProperties.data.html: '';
		this.sectionProperties.nodeModifyText.innerText = this.sectionProperties.data.text ? this.sectionProperties.data.text: '';
		if (this.sectionProperties.data.html) {
			this.sectionProperties.nodeModifyText.innerHTML = this.sanitize(this.sectionProperties.data.html);
		}
		this.sectionProperties.contentAuthor.innerText = this.sectionProperties.data.author;

		this.updateResolvedField(this.sectionProperties.data.resolved);
		if (this.sectionProperties.data.avatar) {
			this.sectionProperties.authorAvatarImg.setAttribute('src', this.sectionProperties.data.avatar);
		}
		else {
			$(this.sectionProperties.authorAvatarImg).css('padding-top', '4px');
		}
		var user = this.map.getViewId(this.sectionProperties.data.author);
		if (user >= 0) {
			var color = app.LOUtil.rgbToHex(this.map.getViewColor(user));
			this.sectionProperties.authorAvatartdImg.style.borderColor = color;
		}

		// dateTime is already in UTC, so we will not append Z that will create issues while converting date
		var d = new Date(this.sectionProperties.data.dateTime.replace(/,.*/, ''));
		var dateOptions: any = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric'};
		this.sectionProperties.contentDate.innerText = isNaN(d.getTime()) ? this.sectionProperties.data.dateTime: d.toLocaleDateString((<any>String).locale, dateOptions);

		if (this.sectionProperties.data.trackchange) {
			this.sectionProperties.captionText.innerText = this.sectionProperties.data.description;
		}
	}

	private updateLayout (): void {
		var style = this.sectionProperties.wrapper.style;
		style.width = '';
		style.whiteSpace = 'nowrap';

		style.whiteSpace = '';
	}

	private setPositionAndSize (): void {
		var rectangles = this.sectionProperties.data.rectanglesOriginal;
		if (rectangles && app.map._docLayer._docType === 'text') {
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
		else if (this.sectionProperties.data.cellRange && app.map._docLayer._docType === 'spreadsheet') {
			var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
			this.size = this.calcCellSize();
			var cellPos = app.map._docLayer._cellRangeToTwipRect(this.sectionProperties.data.cellRange).toRectangle();
			let startX = cellPos[0];
			if (this.isCalcRTL()) { // Mirroring is done in setPosition
				const sizeX = cellPos[2];
				startX += sizeX;  // but adjust for width of the cell.
			}
			this.setShowSection(true);
			var position: Array<number> = [Math.round(cellPos[0] * ratio), Math.round(cellPos[1] * ratio)];
			var splitPosCore = {x: 0, y: 0};
			if (app.map._docLayer.getSplitPanesContext())
				splitPosCore = app.map._docLayer.getSplitPanesContext().getSplitPos();

			splitPosCore.x *= app.dpiScale;
			splitPosCore.y *= app.dpiScale;

			if (position[0] < splitPosCore.x)
				position[0] += this.documentTopLeft[0];
			else if (position[0] - this.documentTopLeft[0] < splitPosCore.x)
				this.setShowSection(false);

			if (position[1] < splitPosCore.y)
				position[1] += this.documentTopLeft[1];
			else if (position[1] - this.documentTopLeft[1] < splitPosCore.y)
				this.setShowSection(false);

			this.setPosition(position[0], position[1]);
		}
		else if (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing') {
			var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
			this.size = [Math.round(this.sectionProperties.imgSize[0] * app.dpiScale), Math.round(this.sectionProperties.imgSize[1] * app.dpiScale)];
			this.setPosition(Math.round(this.sectionProperties.data.rectangle[0] * ratio), Math.round(this.sectionProperties.data.rectangle[1] * ratio));
		}
	}

	public removeHighlight (): void {
		if (app.map._docLayer._docType === 'text') {
			this.sectionProperties.usedTextColor = this.sectionProperties.data.color;

			this.sectionProperties.isHighlighted = false;
		}
		else if (app.map._docLayer._docType === 'spreadsheet') {
			this.backgroundColor = null;
			this.backgroundOpacity = 1;
		}
	}

	public highlight (): void {
		if (app.map._docLayer._docType === 'text') {
			this.sectionProperties.usedTextColor = this.sectionProperties.highlightedTextColor;

			var x: number = Math.round(this.position[0] / app.dpiScale);
			var y: number = Math.round(this.position[1] / app.dpiScale);
			(this.containerObject.getSectionWithName(L.CSections.Scroll.name) as any as cool.ScrollSection).onScrollTo({x: x, y: y});
		}
		else if (app.map._docLayer._docType === 'spreadsheet') {
			this.backgroundColor = '#777777'; //background: rgba(119, 119, 119, 0.25);
			this.backgroundOpacity = 0.25;

			var x: number = Math.round(this.position[0] / app.dpiScale);
			var y: number = Math.round(this.position[1] / app.dpiScale);
			(this.containerObject.getSectionWithName(L.CSections.Scroll.name) as any as cool.ScrollSection).onScrollTo({x: x, y: y});
		}
		else if (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing') {
			var x: number = Math.round(this.position[0] / app.dpiScale);
			var y: number = Math.round(this.position[1] / app.dpiScale);
			(this.containerObject.getSectionWithName(L.CSections.Scroll.name) as any as cool.ScrollSection).onScrollTo({x: x, y: y});
		}

		this.containerObject.requestReDraw();
		this.sectionProperties.isHighlighted = true;
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	private static doesRectIntersectView(pos: number[], size: number[], viewContext: any): boolean {
		var paneBoundsList = <any[]>viewContext.paneBoundsList;
		var endPos = [pos[0] + size[0], pos[1] + size[1]];
		for (var i = 0; i < paneBoundsList.length; ++i) {
			var paneBounds = paneBoundsList[i];
			var rectInvisible = (endPos[0] < paneBounds.min.x || endPos[1] < paneBounds.min.y ||
				pos[0] > paneBounds.max.x || pos[1] > paneBounds.max.y);
			if (!rectInvisible)
				return true;
		}
		return false;
	}

	/*
		This function doesn't take topleft positions of sections into account.
		This just returns bare pixel coordinates of the rectangles.
	*/
	private convertRectanglesToCoreCoordinates() {
		var pixelBasedOrgRectangles = new Array<Array<number>>();

		var originals = this.sectionProperties.data.rectanglesOriginal;
		var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
		var pos: number[], size: number[];

		if (originals) {
			for (var i = 0; i < originals.length; i++) {
				pos = [
					Math.round(originals[i][0] * ratio),
					Math.round(originals[i][1] * ratio)
				];
				size = [
					Math.round(originals[i][2] * ratio),
					Math.round(originals[i][3] * ratio)
				];

				pixelBasedOrgRectangles.push([pos[0], pos[1], size[0], size[1]]);
			}

			this.sectionProperties.pixelBasedOrgRectangles = pixelBasedOrgRectangles;
		}
	}

	// This is for svg elements that will be bound to document-container.
	// This also returns whether any rectangle has an intersection with the visible area/panes.
	// This function calculates the core pixel coordinates then converts them into view coordinates.
	private convertRectanglesToViewCoordinates () : boolean {
		var rectangles = this.sectionProperties.data.rectangles;
		var originals = this.sectionProperties.data.rectanglesOriginal;
		var viewContext = this.map.getTileSectionMgr()._paintContext();
		var intersectsVisibleArea = false;
		var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
		var pos: number[], size: number[];

		if (rectangles) {
			var documentAnchorSection = this.containerObject.getDocumentAnchorSection();
			var diff = [documentAnchorSection.myTopLeft[0] - this.documentTopLeft[0], documentAnchorSection.myTopLeft[1] - this.documentTopLeft[1]];

			for (var i = 0; i < rectangles.length; i++) {
				pos = [
					Math.round(originals[i][0] * ratio),
					Math.round(originals[i][1] * ratio)
				];
				size = [
					Math.round(originals[i][2] * ratio),
					Math.round(originals[i][3] * ratio)
				];

				if (!intersectsVisibleArea && Comment.doesRectIntersectView(pos, size, viewContext))
					intersectsVisibleArea = true;

				rectangles[i][0] = pos[0] + diff[0];
				rectangles[i][1] = pos[1] + diff[1];
				rectangles[i][2] = size[0];
				rectangles[i][3] = size[1];
			}
		} else if (this.sectionProperties.data.trackchange && this.sectionProperties.data.anchorPos) {
			// For redline comments there are no 'rectangles' or 'rectangleOriginal' properties in sectionProperties.data
			// So use the comment rectangle stored in anchorPos (in display? twips).
			pos = this.getPosition();
			size = this.getSize();

			intersectsVisibleArea = Comment.doesRectIntersectView(pos, size, viewContext);
		}

		return intersectsVisibleArea;
	}

	public getPosition (): number[] {
		// For redline comments there are no 'rectangles' or 'rectangleOriginal' properties in sectionProperties.data
		// So use the comment rectangle stored in anchorPos (in display? twips).
		if (this.sectionProperties.data.trackchange && this.sectionProperties.data.anchorPos) {
			var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
			var anchorPos = this.sectionProperties.data.anchorPos;
			return [
				Math.round(anchorPos[0] * ratio),
				Math.round(anchorPos[1] * ratio)
			];
		} else {
			return this.position;
		}
	}

	public getSize(): number[] {
		// For redline comments there are no 'rectangles' or 'rectangleOriginal' properties in sectionProperties.data
		// So use the comment rectangle stored in anchorPos (in display? twips).
		if (this.sectionProperties.data.trackchange && this.sectionProperties.data.anchorPos) {
			var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
			var anchorPos = this.sectionProperties.data.anchorPos;
			return [
				Math.round(anchorPos[2] * ratio),
				Math.round(anchorPos[3] * ratio)
			];
		} else {
			return this.size;
		}
	}

	private updatePosition (): void {
		this.convertRectanglesToViewCoordinates();
		this.convertRectanglesToCoreCoordinates();
		this.setPositionAndSize();
		if (app.map._docLayer._docType === 'spreadsheet')
			this.positionCalcComment();
		else if (app.map._docLayer._docType === "presentation" || app.map._docLayer._docType === "drawing") {
			if (this.sectionProperties.commentMarkerSubSection !== null) {
				this.sectionProperties.commentMarkerSubSection.sectionProperties.data = this.sectionProperties.data;
				this.sectionProperties.commentMarkerSubSection.setPosition(
					this.sectionProperties.data.anchorPos[0] * app.twipsToPixels,
					this.sectionProperties.data.anchorPos[1] * app.twipsToPixels
				);
			}
		}
	}

	private createMarkerSubSection() {
		if (this.sectionProperties.data.rectangle === null)
			return;

		const showMarker = app.impress.partList[app.map._docLayer._selectedPart].hash === this.sectionProperties.data.parthash ||
							app.file.fileBasedView;

		this.sectionProperties.commentMarkerSubSection = new CommentMarkerSubSection(
			this.name + this.sectionProperties.data.id + String(Math.random()), // Section name - only as a placeholder.
			28, 28, // Width and height.
			new SimplePoint(this.sectionProperties.data.anchorPos[0], this.sectionProperties.data.anchorPos[1]), // Document position.
			'annotation-marker', // Extra class.
			showMarker, // Show section.
			this, // Parent section.
			this.sectionProperties.data
		);

		app.sectionContainer.addSection(this.sectionProperties.commentMarkerSubSection);
	}

	public isContainerVisible (): boolean {
		return this.sectionProperties.container.style &&
			this.sectionProperties.container.style.display !== 'none' &&
			(
				this.sectionProperties.container.style.visibility === 'visible' ||
				this.sectionProperties.container.style.visibility === ''
			);
	}

	public update (): void {
		this.updateContent();
		this.updateLayout();
		this.updatePosition();
	}

	private showMarker (): void {
		if (this.sectionProperties.commentMarkerSubSection != null) {
			this.sectionProperties.commentMarkerSubSection.showSection = true;
			this.sectionProperties.commentMarkerSubSection.onSectionShowStatusChange();
		}
	}

	private hideMarker (): void {
		if (this.sectionProperties.commentMarkerSubSection != null) {
			this.sectionProperties.commentMarkerSubSection.showSection = false;
			this.sectionProperties.commentMarkerSubSection.onSectionShowStatusChange();
		}
	}

	private showWriter() {
		if (!this.isCollapsed || this.isSelected()) {
			this.sectionProperties.container.style.visibility = '';
			this.sectionProperties.container.style.display = '';
		}
		if (this.sectionProperties.data.resolved !== 'true' || this.sectionProperties.commentListSection.sectionProperties.showResolved) {
			L.DomUtil.addClass(this.sectionProperties.container, 'cool-annotation-collapsed-show');
			this.sectionProperties.showSelectedCoordinate = true;
		}
		this.sectionProperties.contentNode.style.display = '';
		this.sectionProperties.nodeModify.style.display = 'none';
		this.sectionProperties.nodeReply.style.display = 'none';
		this.sectionProperties.collapsedInfoNode.style.visibility = '';
		this.cachedIsEdit = false;
	}

	private showCalc() {
		this.sectionProperties.container.style.display = '';
		this.sectionProperties.contentNode.style.display = '';
		this.sectionProperties.nodeModify.style.display = 'none';
		this.sectionProperties.nodeReply.style.display = 'none';
		this.cachedIsEdit = false;

		this.positionCalcComment();
		if (!(<any>window).mode.isMobile()) {
			this.sectionProperties.commentListSection.select(this);
		}
		this.sectionProperties.container.style.visibility = '';
	}

	private getCommentWidth() {
		// note: getComputedStyle can be an exceptional bottle-neck with many comments
		return parseFloat(getComputedStyle(this.sectionProperties.container).width) * app.dpiScale;
	}

	public positionCalcComment(): void {
		if (!(<any>window).mode.isMobile()) {
			var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
			var cellPos = app.map._docLayer._cellRangeToTwipRect(this.sectionProperties.data.cellRange).toRectangle();
			var originalSize = [Math.round((cellPos[2]) * ratio), Math.round((cellPos[3]) * ratio)];

			const startX = this.isCalcRTL() ? this.myTopLeft[0] - this.getCommentWidth() : this.myTopLeft[0] + originalSize[0] - 3;

			var pos: Array<number> = [Math.round(startX / app.dpiScale), Math.round(this.myTopLeft[1] / app.dpiScale)];
			this.sectionProperties.container.style.transform = 'translate3d(' + pos[0] + 'px, ' + pos[1] + 'px, 0px)';
		}
	}

	private showImpressDraw() {
		if (this.isInsideActivePart()) {
			this.sectionProperties.container.style.display = '';
			this.sectionProperties.nodeModify.style.display = 'none';
			this.sectionProperties.nodeReply.style.display = 'none';
			this.sectionProperties.contentNode.style.display = '';
			this.cachedIsEdit = false;
			if (this.isSelected() || !this.isCollapsed) {
				this.sectionProperties.container.style.visibility = '';
			}
			else {
				this.sectionProperties.container.style.visibility = 'hidden';
			}
			L.DomUtil.addClass(this.sectionProperties.container, 'cool-annotation-collapsed-show');
		}
	}

	public setLayoutClass(): void {
		this.sectionProperties.container.classList.remove('tracked-deleted-comment-show');
		this.sectionProperties.container.classList.remove('tracked-deleted-comment-hide');

		var showTrackedChanges: boolean = this.map['stateChangeHandler'].getItemValue('.uno:ShowTrackedChanges') === 'true';
		var layoutClass: string = showTrackedChanges ? 'tracked-deleted-comment-show' : 'tracked-deleted-comment-hide';
		if (this.sectionProperties.data.layoutStatus === CommentLayoutStatus.DELETED) {
			this.sectionProperties.container.classList.add(layoutClass);
		}
	}

	public show(): void {
		this.doPendingInitializationInView(true /* force */);

		if (this.hidden === false && !this.isEdit()) return;

		this.showMarker();

		// On mobile, container shouldn't be 'document-container', but it is 'document-container' on initialization. So we hide the comment until comment wizard is opened.
		if ((<any>window).mode.isMobile() && this.sectionProperties.container.parentElement === document.getElementById('document-container'))
			this.sectionProperties.container.style.visibility = 'hidden';

		if (cool.CommentSection.commentWasAutoAdded)
			return;

		// We don't cache the hidden state for spreadsheets. Only one comment can be
		// visible and they're hidden when scrolling, so it's easier this way.
		if (app.map._docLayer._docType === 'text') {
			this.showWriter();
			this.hidden = false;
		} else if (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing') {
			this.showImpressDraw();
			this.hidden = false;
		} else if (app.map._docLayer._docType === 'spreadsheet')
			this.showCalc();

		this.setLayoutClass();
	}

	private hideWriter() {
		this.sectionProperties.container.style.visibility = 'hidden';
		this.sectionProperties.nodeModify.style.display = 'none';
		this.sectionProperties.nodeReply.style.display = 'none';
		this.sectionProperties.showSelectedCoordinate = false;
		L.DomUtil.removeClass(this.sectionProperties.container, 'cool-annotation-collapsed-show');
		this.cachedIsEdit = false;
		this.hidden = true;
	}

	private hideCalc() {
		this.sectionProperties.container.style.visibility = 'hidden';
		this.sectionProperties.nodeModify.style.display = 'none';
		this.sectionProperties.nodeReply.style.display = 'none';
		this.cachedIsEdit = false;

		if (this.sectionProperties.commentListSection.sectionProperties.selectedComment === this)
			this.sectionProperties.commentListSection.sectionProperties.selectedComment = null;
	}

	private hideImpressDraw() {
		if (!this.isInsideActivePart()) {
			this.sectionProperties.container.style.display = 'none';
			this.hideMarker();
		}
		else {
			this.sectionProperties.container.style.display = '';
			if (this.isCollapsed)
				this.sectionProperties.container.style.visibility = 'hidden';

			this.sectionProperties.nodeModify.style.display = 'none';
			this.sectionProperties.nodeReply.style.display = 'none';
			this.cachedIsEdit = false;
		}
		L.DomUtil.removeClass(this.sectionProperties.container, 'cool-annotation-collapsed-show');
		this.hidden = true;
	}

	// check if this is "our" autosaved comment
	// core is not aware it's autosaved one so use this simplified detection based on content
	public isAutoSaved (): boolean {
		var autoSavedComment = cool.CommentSection.autoSavedComment;
		if (!autoSavedComment)
			return false;

		var authorMatch = this.sectionProperties.data.author === this.map.getViewName(app.map._docLayer._viewId);
		return authorMatch;
	}

	public hide (): void {
		if (this.hidden === true || this.isEdit()) {
			return;
		}

		if (this.sectionProperties.data.id === 'new') {
			this.sectionProperties.commentListSection.removeItem(this.sectionProperties.data.id);
			return;
		}

		if (app.map._docLayer._docType === 'text')
			this.hideWriter();
		else if (app.map._docLayer._docType === 'spreadsheet')
			this.hideCalc();
		else if (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing')
			this.hideImpressDraw();
	}

	private isInsideActivePart() {
		// Impress and Draw only.
		return this.sectionProperties.partIndex === app.map._docLayer._selectedPart;
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	private menuOnMouseClick (e: any): void {
		$(this.sectionProperties.menu).contextMenu();
		L.DomEvent.stopPropagation(e);
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	private menuOnKeyPress (e: any): void {
		if (e.code === 'Space' || e.code === 'Enter')
			$(this.sectionProperties.menu).contextMenu();
		L.DomEvent.stopPropagation(e);
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	private onMouseClick (e: any): void {
		if (((<any>window).mode.isMobile() || (<any>window).mode.isTablet())
			&& this.map.getDocType() == 'spreadsheet'
			&& !this.map.uiManager.mobileWizard.isOpen()) {
			this.hide();
		}
		L.DomEvent.stopPropagation(e);
		this.sectionProperties.commentListSection.click(this);
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	private onEscKey (e: any): void {
		if ((<any>window).mode.isDesktop()) {
			if (e.keyCode === 27) {
				this.onCancelClick(e);
			} else if (e.keyCode === 33 /*PageUp*/ || e.keyCode === 34 /*PageDown*/) {
				// work around for a chrome issue https://issues.chromium.org/issues/41417806
				L.DomEvent.preventDefault(e);
				var pos = e.keyCode === 33 ? 0 : e.target.textLength;
				var currentPos = e.target.selectionStart;
				if (e.shiftKey) {
					var [start, end] = currentPos <= pos ? [currentPos, pos] : [pos, currentPos];
					e.target.setSelectionRange(start, end, currentPos > pos ? 'backward' : 'forward');
				} else {
					e.target.setSelectionRange(pos, pos);
				}
			}
		}

	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public handleReplyCommentButton (e: any): void {
		cool.CommentSection.autoSavedComment = null;
		cool.CommentSection.commentWasAutoAdded = false;
		this.textAreaInput(null);
		this.onReplyClick(e);
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public onReplyClick (e: any): void {
		L.DomEvent.stopPropagation(e);
		if ((<any>window).mode.isMobile()) {
			this.sectionProperties.data.reply = this.sectionProperties.data.text;
			this.sectionProperties.commentListSection.saveReply(this);
		} else {
			this.removeLastBRTag(this.sectionProperties.nodeReplyText);
			this.sectionProperties.data.reply = this.sectionProperties.nodeReplyText.innerText;
			this.sectionProperties.data.html = this.sectionProperties.nodeReplyText.innerHTML;
			// Assigning an empty string to .innerHTML property in some browsers will convert it to 'null'
			// While in browsers like Chrome and Firefox, a null value is automatically converted to ''
			// Better to assign '' here instead of null to keep the behavior same for all
			this.sectionProperties.nodeReplyText.innerText = '';
			this.show();
			this.sectionProperties.commentListSection.saveReply(this);
		}
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public handleCancelCommentButton (e: any): void {
		if (cool.CommentSection.commentWasAutoAdded) {
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).remove(this.sectionProperties.data.id);
		}

		if (cool.CommentSection.autoSavedComment) {
			this.sectionProperties.contentText.origText = this.sectionProperties.contentText.uneditedText;
			this.sectionProperties.contentText.uneditedText = null;
			this.sectionProperties.contentText.origHTML = this.sectionProperties.contentText.uneditedHTML;
			this.sectionProperties.contentText.uneditedHTML = null;
		}

		// These lines are repeated in onCancelClick,
		// it makes things simple by not adding so many condition for different apps and different situation
		// It is mandatory to change these values before handleSaveCommentButton is called
		// calling handleSaveCommentButton in onCancelClick causes problem because that is also called from many other events/function (i.e: onPartChange)
		if (this.sectionProperties.contentText.origHTML) {
			this.sectionProperties.nodeModifyText.innerHTML = this.sanitize(this.sectionProperties.contentText.origHTML);
		}
		else {
			this.sectionProperties.nodeModifyText.innerText = this.sectionProperties.contentText.origText;
		}
		this.sectionProperties.nodeReplyText.innerText = '';

		if (cool.CommentSection.autoSavedComment)
			this.handleSaveCommentButton(e);

		this.onCancelClick(e);
		if (app.map._docLayer._docType === 'spreadsheet')
			this.hideCalc();
		cool.CommentSection.commentWasAutoAdded = false;
		cool.CommentSection.autoSavedComment = null;
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public onCancelClick (e: any): void {
		if (e)
			L.DomEvent.stopPropagation(e);
		if (this.sectionProperties.contentText.origHTML) {
			this.sectionProperties.nodeModifyText.innerHTML = this.sanitize(this.sectionProperties.contentText.origHTML);
		}
		else {
			this.sectionProperties.nodeModifyText.innerText = this.sectionProperties.contentText.origText;
		}
		this.sectionProperties.nodeReplyText.innerText = '';
		if (app.map._docLayer._docType !== 'spreadsheet')
			this.show();
		this.sectionProperties.commentListSection.cancel(this);
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public handleSaveCommentButton (e: any): void {
		cool.CommentSection.autoSavedComment = null;
		cool.CommentSection.commentWasAutoAdded = false;
		this.sectionProperties.contentText.uneditedText = null;
		this.sectionProperties.contentText.uneditedHTML = null;
		this.textAreaInput(null);
		this.onSaveComment(e);
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public onSaveComment (e: any): void {
		this.sectionProperties.commentContainerRemoved = true;
		L.DomEvent.stopPropagation(e);
		this.removeLastBRTag(this.sectionProperties.nodeModifyText);
		this.sectionProperties.data.text = this.sectionProperties.nodeModifyText.innerText;
		this.sectionProperties.data.html = this.sectionProperties.nodeModifyText.innerHTML;
		this.updateContent();
		if (!cool.CommentSection.autoSavedComment)
			this.show();
		this.sectionProperties.commentListSection.save(this);
	}

	// for some reason firefox adds <br> at of the end of text in contenteditable div
	// there have been similar reports: https://bugzilla.mozilla.org/show_bug.cgi?id=1615852
	private removeLastBRTag(element: HTMLElement) {
		if (!L.Browser.gecko)
			return;
		const brElements = element.querySelectorAll('br');
		if (brElements.length > 0)
			brElements[brElements.length-1].remove();
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public onLostFocus (e: any): void {

		if (!this.isEdit() || this.sectionProperties.container.contains(e.relatedTarget))
			return;
		if (this.sectionProperties.nodeReply.contains(e.target)) {
			this.onLostFocusReply(e);
			return;
		}

		if (app.map._docLayer._docType === 'text' && this.map.mention?.isTypingMention()) {
			return;
		}
		if (!this.sectionProperties.commentContainerRemoved) {
			this.cachedIsEdit = false;
			$(this.sectionProperties.container).removeClass('annotation-active reply-annotation-container modify-annotation-container');
			this.removeLastBRTag(this.sectionProperties.nodeModifyText);
			if (this.sectionProperties.contentText.origText !== this.sectionProperties.nodeModifyText.innerText ||
			    this.sectionProperties.contentText.origHTML !== this.sectionProperties.nodeModifyText.innerHTML) {
				if(!document.hasFocus())
					app.definitions.CommentSection.needFocus = this;
				if (!this.sectionProperties.contentText.uneditedHTML)
					this.sectionProperties.contentText.uneditedHTML = this.sectionProperties.contentText.origHTML;
				if (!this.sectionProperties.contentText.uneditedText)
					this.sectionProperties.contentText.uneditedText = this.sectionProperties.contentText.origText;
				cool.CommentSection.autoSavedComment = this;
				this.onSaveComment(e);
			}
			else if (this.containerObject.testing) {
				var insertButton = document.getElementById('menu-insertcomment');
				if (insertButton) {
					if (window.getComputedStyle(insertButton).display === 'none') {
						this.onCancelClick(e);
					}
				}
			}
		}
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public onLostFocusReply (e: any): void {
		if (app.map._docLayer._docType === 'text' && this.map.mention?.isTypingMention()) {
			return;
		}
		if (this.sectionProperties.nodeReplyText.innerText !== '') {
			if(!document.hasFocus())
				app.definitions.CommentSection.needFocus = this;
			if (!this.sectionProperties.contentText.uneditedHTML)
				this.sectionProperties.contentText.uneditedHTML = this.sectionProperties.contentText.origHTML;
			if (!this.sectionProperties.contentText.uneditedText)
				this.sectionProperties.contentText.uneditedText = this.sectionProperties.contentText.origText;
			cool.CommentSection.autoSavedComment = this;
			this.onReplyClick(e);
		}
		else {
			this.sectionProperties.nodeReply.style.display = 'none';
			if (!this.sectionProperties.nodeModify || this.sectionProperties.nodeModify.style.display === 'none')
				this.cachedIsEdit = false;
		}
	}

	public focus (): void {
		this.sectionProperties.container.classList.add('annotation-active');
		this.sectionProperties.nodeModifyText.focus({ focusVisible: true });
		this.sectionProperties.nodeReplyText.focus({ focusVisible: true });

		// set cursor at the last position on refocus after autosave
		if (this.isModifying() && this.sectionProperties.nodeModifyText.childNodes.length > 0) {
			var range = document.createRange()
			var sel = document.getSelection()
			range.setStartAfter(this.sectionProperties.nodeModifyText.lastChild)
			range.collapse(true)
			sel.removeAllRanges()
			sel.addRange(range)
		}

	}

	public reply (): Comment {
		this.sectionProperties.container.classList.add('reply-annotation-container');
		this.sectionProperties.container.style.visibility = '';
		this.sectionProperties.contentNode.style.display = '';
		this.sectionProperties.nodeModify.style.display = 'none';
		this.sectionProperties.nodeReply.style.display = '';
		this.cachedIsEdit = true;
		return this;
	}

	public edit (): Comment {
		this.doPendingInitializationInView(true /* force */);
		this.sectionProperties.container.classList.add('modify-annotation-container');
		this.sectionProperties.nodeModify.style.display = '';
		this.sectionProperties.nodeReply.style.display = 'none';
		this.sectionProperties.container.style.visibility = '';
		this.sectionProperties.contentNode.style.display = 'none';
		this.cachedIsEdit = true;
		return this;
	}

	public isEdit (): boolean {
		return this.cachedIsEdit;
	}

	public isModifying(): boolean {
		return !this.pendingInit && this.sectionProperties.nodeModify && this.sectionProperties.nodeModify.style.display !== 'none';
	}

	public static isAnyEdit (): Comment {
		var section = app.sectionContainer && app.sectionContainer instanceof CanvasSectionContainer ?
			app.sectionContainer.getSectionWithName(L.CSections.CommentList.name) : null;
		if (!section) {
			return null;
		}

		var commentList = section.sectionProperties.commentList;
		for (var i in commentList) {
			var modifyNode = commentList[i].sectionProperties.nodeModify;
			var replyNode = commentList[i].sectionProperties.nodeReply;
			if (!commentList[i].pendingInit &&
				((modifyNode && modifyNode.style.display !== 'none') ||
				(replyNode && replyNode.style.display !== 'none')))
					return commentList[i];
		}
		return null;
	}

	public static isAnyFocus(): boolean {
		const comment_: Comment = Comment.isAnyEdit();

		// We have a comment in edit mode. Is it focused?
		if (comment_ && (document.activeElement === comment_.sectionProperties.nodeModifyText || document.activeElement === comment_.sectionProperties.nodeReplyText))
			return true;

		return false;
	}

	public isDisplayed (): boolean {
		return (this.sectionProperties.container.style && this.sectionProperties.container.style.visibility === '');
	}

	public onResize (): void {
		this.updatePosition();
	}

	private isSelected(): boolean {
		return this.sectionProperties.commentListSection.sectionProperties.selectedComment === this;
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	private doesRectangleContainPoint (rectangle: any, point: Array<number>): boolean {
		if (point[0] >= rectangle[0] && point[0] <= rectangle[0] + rectangle[2]) {
			if (point[1] >= rectangle[1] && point[1] <= rectangle[1] + rectangle[3]) {
				return true;
			}
		}
		return false;
	}

	/*
		point is the core pixel coordinate of the cursor.
		Not adjusted according to the view.
		For adjusting, we need to take document top left and documentAnchor top left into account.
		No need to do that for now.
	*/
	private checkIfCursorIsOnThisCommentWriter(rectangles: any, point: Array<number>) {
		for (var i: number = 0; i < rectangles.length; i++) {
			if (this.doesRectangleContainPoint(rectangles[i], point)) {
				if (!this.isSelected()) {
					this.sectionProperties.commentListSection.selectById(this.sectionProperties.data.id);
				}
				this.stopPropagating();
				return;
			}
		}

		// If we are here, this comment is not selected.
		if (this.isSelected()) {
			if (this.isCollapsed)
				this.setCollapsed();
			this.sectionProperties.commentListSection.unselect();
		}
	}

	/// This event is Writer-only. Fired by CanvasSectionContainer.
	public onCursorPositionChanged(newPosition: cool.SimpleRectangle): void {
		var x = newPosition.pX1;
		var y = Math.round(newPosition.pCenter[1]);
		if (this.sectionProperties.pixelBasedOrgRectangles) {
			this.checkIfCursorIsOnThisCommentWriter(this.sectionProperties.pixelBasedOrgRectangles, [x, y]);
		}
	}

	/// This event is Calc-only. Fired by CanvasSectionContainer.
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	public onCellAddressChanged(): void {
		if (this.sectionProperties.data.rectangles) {
			var midX = this.containerObject.getDocumentAnchor()[0] + Math.round(app.calc.cellCursorRectangle.pCenter[0]);
			var midY = this.containerObject.getDocumentAnchor()[1] + Math.round(app.calc.cellCursorRectangle.pCenter[1]);

			if (midX > this.sectionProperties.data.rectangles[0][0] && midX < this.sectionProperties.data.rectangles[0][0] + this.sectionProperties.data.rectangles[0][2]
				&& midY > this.sectionProperties.data.rectangles[0][1] && midY < this.sectionProperties.data.rectangles[0][1] + this.sectionProperties.data.rectangles[0][3]) {
				this.sectionProperties.commentListSection.sectionProperties.calcCurrentComment = this;
			}
			else if (this.isSelected()) {
				this.hide();
				this.sectionProperties.commentListSection.sectionProperties.calcCurrentComment = null;
			}
			else if (this.sectionProperties.commentListSection.sectionProperties.calcCurrentComment == this)
				this.sectionProperties.commentListSection.sectionProperties.calcCurrentComment = null;
		}
	}

	public onClick (point: Array<number>, e: MouseEvent): void {
		if (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing') {
			this.sectionProperties.commentListSection.selectById(this.sectionProperties.data.id);
			e.stopPropagation();
			this.stopPropagating();
		}
	}

	public onDraw (): void {
		if (this.sectionProperties.showSelectedCoordinate) {
			if (app.map._docLayer._docType === 'text') {
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
			else if (app.map._docLayer._docType === 'spreadsheet' &&
				 parseInt(this.sectionProperties.data.tab) === app.map._docLayer._selectedPart) {

				var cellSize = this.calcCellSize();
				if (cellSize[0] !== 0 && cellSize[1] !== 0) { // don't draw notes in hidden cells
					// `zoom` represents the current zoom level of the map, retrieved from `this.map.getZoom()`.
					// `baseSize` is a constant that defines the base size of the square at the initial zoom level.
					// `squareDim` calculates the dimension of the square, which dynamically adjusts based on the current zoom level.
					// The dimension increases proportionally to the zoom level by adding `zoom` to `baseSize`.
					var margin = 1;
					var baseSize = 2;
					var zoom = this.map.getZoom();
					var squareDim = baseSize + zoom;

					const isRTL = this.isCalcRTL();

					// this.size may currently have an artificially wide size if mouseEnter without moveLeave seen
					// so fetch the real size
					var x = isRTL ? margin : cellSize[0] - squareDim - margin;
					var commentColor = getComputedStyle(document.body).getPropertyValue('--color-calc-comment');
					this.context.fillStyle = commentColor;
					var region = new Path2D();
					region.moveTo(x, 0);
					region.lineTo(x + squareDim, 0);
					region.lineTo(x + (isRTL ? 0 : squareDim), squareDim);
					region.closePath();
					this.context.fill(region);
				}
			}
		}
	}

	public onMouseMove (point: Array<number>, dragDistance: Array<number>, e: MouseEvent): void {
		return;
	}

	public onMouseUp (point: Array<number>, e: MouseEvent): void {
		// Hammer.js doesn't fire onClick event after touchEnd event.
		// CanvasSectionContainer fires the onClick event. But since Hammer.js is used for map, it disables the onClick for SectionContainer.
		// We will use this event as click event on touch devices, until we remove Hammer.js (then this code will be removed from here).
		// Control.ColumnHeader.js file is not affected by this situation, because map element (so Hammer.js) doesn't cover headers.
		if (!this.containerObject.isDraggingSomething() && (<any>window).mode.isMobile() || (<any>window).mode.isTablet()) {
			if (app.map._docLayer._docType === 'presentataion' || app.map._docLayer._docType === 'drawing')
				app.map._docLayer._openCommentWizard(this);
			this.onMouseEnter();
			this.onClick(point, e);
		}
	}

	public onMouseDown (point: Array<number>, e: MouseEvent): void {
		return;
	}

	private calcContinueWithMouseEvent (): boolean {
		if (app.map._docLayer._docType === 'spreadsheet') {
			var conditions: boolean = !this.isEdit();
			if (conditions) {
				var sc = this.sectionProperties.commentListSection.sectionProperties.selectedComment;
				if (sc)
					conditions = sc.sectionProperties.data.id !== 'new';
			}
			return conditions;
		}
		else {
			return false;
		}
	}

	public calcCellSize (): number[] {
		var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
		var cellPos = app.map._docLayer._cellRangeToTwipRect(this.sectionProperties.data.cellRange).toRectangle();
		return [Math.round((cellPos[2]) * ratio), Math.round((cellPos[3]) * ratio)];
	}

	public onMouseEnter (): void {
		if (this.calcContinueWithMouseEvent()) {
			// When mouse is above this section, comment's HTML element will be shown.
			// If mouse pointer goes to HTML element, onMouseLeave event shouldn't be fired.
			// But mouse pointer will have left the borders of this section and onMouseLeave event will be fired.
			// Let's do it properly, when mouse is above this section, we will make this section's size bigger and onMouseLeave event will not be fired.
			if (parseInt(this.sectionProperties.data.tab) === app.map._docLayer._selectedPart) {
				var sc = this.sectionProperties.commentListSection.sectionProperties.selectedComment;
				if (sc) {
					if (!sc.isEdit())
						sc.hide();
					else
						return; // Another comment is being edited. Return.
				}

				var containerWidth: number = this.sectionProperties.container.getBoundingClientRect().width;
				var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);
				var cellPos = app.map._docLayer._cellRangeToTwipRect(this.sectionProperties.data.cellRange).toRectangle();
				this.size = [Math.round((cellPos[2]) * ratio + containerWidth), Math.round((cellPos[3]) * ratio)];
				this.sectionProperties.commentListSection.selectById(this.sectionProperties.data.id);
				this.show();
			}
		}
	}

	public onMouseLeave (point: Array<number>): void {
		if (this.calcContinueWithMouseEvent()) {
			if (parseInt(this.sectionProperties.data.tab) === app.map._docLayer._selectedPart) {
				// Revert the changes we did on "onMouseEnter" event.
				this.size = this.calcCellSize();
				if (point) {
					this.hide();
				}
			}
		}
	}

	public onNewDocumentTopLeft (): void {
		this.doPendingInitializationInView();
		this.updatePosition();
	}

	public onCommentDataUpdate(): void {
		this.doPendingInitializationInView();
		this.updatePosition();
	}

	public onRemove (): void {
		this.sectionProperties.commentContainerRemoved = true;

		if (this.sectionProperties.commentListSection.sectionProperties.selectedComment === this)
			this.sectionProperties.commentListSection.sectionProperties.selectedComment = null;

		this.sectionProperties.commentListSection.hideArrow();
		var container = this.sectionProperties.container;

		if (this.sectionProperties.commentMarkerSubSection !== null)
			app.sectionContainer.removeSection(this.sectionProperties.commentMarkerSubSection.name);

		if (container && container.parentElement) {
			var c: number = 0;
			while (c < 10) {
				try {
					container.parentElement.removeChild(container);
					break;
				}
				catch (e) {
					c++;
				}
			}
		}
	}

	public isRootComment(): boolean {
		return this.sectionProperties.data.parent === '0';
	}

	public setAsRootComment(): void {
		this.sectionProperties.data.parent = '0';
		if (app.map._docLayer._docType === 'text')
			this.sectionProperties.data.parentId = '0';
	}

	public getChildrenLength(): number {
		return this.sectionProperties.children.length;
	}

	public getChildByIndex(index: number): Comment {
		if (this.sectionProperties.children.length > index)
			return this.sectionProperties.children[index];
		else
			return null;
	}

	public removeChildByIndex(index: number): void {
		if (this.sectionProperties.children.length > index)
			this.sectionProperties.children.splice(index, 1);
	}

	public getParentCommentId(): string {
		if (this.sectionProperties.data.parent && this.sectionProperties.data.parent !== '0')
			return this.sectionProperties.data.parent;
		else
			return null;
	}

	public getIndexOfChild(comment: Comment): number {
		return this.sectionProperties.children.indexOf(comment);
	}

	public getChildLevel(): number {
		if (this.isRootComment()) return 0;
		const parentComment = this.sectionProperties.commentListSection.getComment(this.getParentCommentId());
		if (parentComment) return parentComment.getChildLevel() + 1;
		return 1; // Comment list not fully initialized but we know we are not root
	}

	public getCommentHeight(invalidateCache: boolean = true): number {
		if (invalidateCache)
			this.cachedCommentHeight = null;
		if (this.cachedCommentHeight === null)
			this.cachedCommentHeight = this.sectionProperties.container.getBoundingClientRect().height
			- this.sectionProperties.childLinesNode.getBoundingClientRect().height;
		return this.cachedCommentHeight;
	}

	public setCollapsed(): void {
		this.isCollapsed = true;

		if (!this.isEdit())
			this.show();

		if (this.isRootComment() || app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing') {
			this.sectionProperties.container.style.display = '';
			this.sectionProperties.container.style.visibility = 'hidden';
		}
		this.updateThreadInfoIndicator();
		if (this.sectionProperties.data.resolved === 'false'
		|| this.sectionProperties.commentListSection.sectionProperties.showResolved
		|| app.map._docLayer._docType === 'presentation'
		|| app.map._docLayer._docType === 'drawing')
			L.DomUtil.addClass(this.sectionProperties.container, 'cool-annotation-collapsed-show');
	}

	public updateThreadInfoIndicator(replycount:number | string = -1): void {
		if (app.map._docLayer._docType === 'spreadsheet')
			return;

		var innerText;
		if (this.isEdit())
			innerText = '!';
		else if (replycount === '!' || typeof replycount === "number" && replycount > 0)
			innerText = replycount;
		else
			innerText = '';

		if (this.sectionProperties.collapsedInfoNode.innerText != innerText)
			this.sectionProperties.collapsedInfoNode.innerText = innerText;

		if (innerText === '' || this.isContainerVisible())
			this.sectionProperties.collapsedInfoNode.style.display = 'none';
		else if ((!this.isContainerVisible() && this.sectionProperties.collapsedInfoNode.innerText !== ''))
			this.sectionProperties.collapsedInfoNode.style.display = '';
	}

	public setExpanded(): void {
		if (!this.isCollapsed)
			return;
		this.isCollapsed = false;
		if (this.sectionProperties.data.resolved === 'false' || this.sectionProperties.commentListSection.sectionProperties.showResolved) {
			this.sectionProperties.container.style.display = '';
			this.sectionProperties.container.style.visibility = '';
		}
		if (app.map._docLayer._docType === 'text')
			this.sectionProperties.collapsedInfoNode.style.display = 'none';
		L.DomUtil.removeClass(this.sectionProperties.container, 'cool-annotation-collapsed-show');
	}

	public autoCompleteMention(username: string, profileLink: string, replacement: string): void {
		const selection = window.getSelection();
		if (!selection.rangeCount) return;

		const range = selection.getRangeAt(0);

		const cursorPosition = range.endOffset;
		const container = range.startContainer;

		const containerText = container.textContent || '';
		const mentionStart = containerText.lastIndexOf(replacement, cursorPosition);

		if (mentionStart !== -1) {
			const mentionEnd = mentionStart + replacement.length;

			const beforeMention = containerText.substring(0, mentionStart);
			const afterMention = containerText.substring(mentionEnd);

			const hyperlink = document.createElement('a');
			hyperlink.href = profileLink;
			hyperlink.textContent = `@${username}`;

			container.textContent = beforeMention;
			container.parentNode?.insertBefore(hyperlink, container.nextSibling);

			const afterTextNode = document.createTextNode(afterMention);
			const extraSpaceNode = document.createTextNode('\u00A0');
			hyperlink.parentNode?.insertBefore(extraSpaceNode, hyperlink.nextSibling);
			hyperlink.parentNode?.insertBefore(afterTextNode, extraSpaceNode.nextSibling);

			const newRange = document.createRange();
			newRange.setStartAfter(extraSpaceNode);
			newRange.setEndAfter(extraSpaceNode);

			selection.removeAllRanges();
			selection.addRange(newRange);
		}
	}
}

}

app.definitions.Comment = cool.Comment;

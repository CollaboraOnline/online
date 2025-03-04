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
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

/* See CanvasSectionContainer.ts for explanations. */

L.Map.include({
	insertComment: function() {
		if (this.stateChangeHandler.getItemValue('InsertAnnotation') === 'disabled')
			return;
		if (cool.Comment.isAnyEdit()) {
			cool.CommentSection.showCommentEditingWarning();
			return;
		}
		var avatar = undefined;
		var author = this.getViewName(this._docLayer._viewId);
		if (author in this._viewInfoByUserName) {
			avatar = this._viewInfoByUserName[author].userextrainfo.avatar;
		}
		this._docLayer.newAnnotation({
			text: '',
			textrange: '',
			author: author,
			dateTime: new Date().toISOString(),
			id: 'new', // 'new' only when added by us
			avatar: avatar
		});
	},

	showResolvedComments: function(on: any) {
		var unoCommand = '.uno:ShowResolvedAnnotations';
		this.sendUnoCommand(unoCommand);
		app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).setViewResolved(on);
		this.uiManager.setDocTypePref('ShowResolved', on ? true : false);
	},

	showComments: function(on: any) {
		app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).setView(on);
		this.uiManager.setDocTypePref('showannotations', on ? true : false);
		this.fire('commandstatechanged', {commandName : 'showannotations', state : on ? 'true': 'false'});
		this.fire('showannotationschanged', {state: on ? 'true': 'false'});
	}
});


declare var L: any;
declare var app: any;
declare var _: any;
declare var JSDialog: any;

namespace cool {

export class CommentSection extends app.definitions.canvasSectionObject {
	name: string = L.CSections.CommentList.name;
	backgroundColor: string = app.sectionContainer.clearColor;
	expand: string[] = ['bottom'];
	processingOrder: number = L.CSections.CommentList.processingOrder;
	drawingOrder: number = L.CSections.CommentList.drawingOrder;
	zIndex: number = L.CSections.CommentList.zIndex;
	interactable: boolean = false;
	sectionProperties: {
		commentList: Array<Comment>;
		selectedComment: Comment | null;
		calcCurrentComment: Comment | null;
		marginY: number;
		offset: number;
		width: number;
		commentWidth: number;
		collapsedMarginToTheEdge: number;
		deflectionOfSelectedComment: number;
		showSelectedBigger: boolean;
		commentsAreListed: boolean;
		[key: string]: any;
	};
	disableLayoutAnimation: boolean = false;
	mobileCommentId: string = 'new-annotation-dialog';
	mobileCommentModalId: string;

	map: any;
	static autoSavedComment: cool.Comment;
	static needFocus: cool.Comment;
	static commentWasAutoAdded: boolean = false;
	static pendingImport: boolean = false;
	static importingComments: boolean = false; // active during comments insertion, disable scroll

	// To associate comment id with its index in commentList array.
	private idIndexMap: Map<any, number>;

	private annotationMinSize: number;
	private annotationMaxSize: number;

	constructor () {
		super();

		this.map = L.Map.THIS;
		this.anchor = ['top', 'right'];
		this.sectionProperties.docLayer = this.map._docLayer;
		this.sectionProperties.commentList = new Array(0);
		this.sectionProperties.selectedComment = null;
		this.sectionProperties.arrow = null;
		this.sectionProperties.show = null;
		this.sectionProperties.showResolved = null;
		this.sectionProperties.marginY = 10 * app.dpiScale;
		this.sectionProperties.offset = 5 * app.dpiScale;
		this.sectionProperties.layoutTimer = null;
		this.sectionProperties.width = Math.round(1 * app.dpiScale); // Configurable variable.
		this.sectionProperties.scrollAnnotation = null; // For impress, when 1 or more comments exist.
		this.sectionProperties.commentWidth = 200 * 1.3; // CSS pixels.
		this.sectionProperties.collapsedMarginToTheEdge = 120; // CSS pixels.
		this.sectionProperties.deflectionOfSelectedComment = 160; // CSS pixels.
		this.sectionProperties.showSelectedBigger = false;
		this.sectionProperties.calcCurrentComment = null; // We don't automatically show a Calc comment when cursor is on its cell. But we remember it to show if user presses Alt+C keys.
		// This (commentsAreListed) variable means that comments are shown as a list on the right side of the document.
		this.sectionProperties.commentsAreListed = (app.map._docLayer._docType === 'text' || app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing') && !(<any>window).mode.isMobile();
		this.idIndexMap = new Map<any, number>();
		this.mobileCommentModalId = this.map.uiManager.generateModalId(this.mobileCommentId);
		this.annotationMinSize = Number(getComputedStyle(document.documentElement).getPropertyValue('--annotation-min-size'));
		this.annotationMaxSize = Number(getComputedStyle(document.documentElement).getPropertyValue('--annotation-max-size'));
	}

	public onInitialize (): void {
		this.checkCollapseState();

		this.map.on('RedlineAccept', this.onRedlineAccept, this);
		this.map.on('RedlineReject', this.onRedlineReject, this);
		this.map.on('updateparts', this.showHideComments, this);
		this.map.on('AnnotationScrollUp', this.onAnnotationScrollUp, this);
		this.map.on('AnnotationScrollDown', this.onAnnotationScrollDown, this);

		this.map.on('commandstatechanged', function (event: any) {
			if (event.commandName === '.uno:ShowResolvedAnnotations')
				this.setViewResolved(event.state === 'true');
			else if (event.commandName === 'showannotations')
				this.setView(event.state === 'true');
			else if (event.commandName === '.uno:ShowTrackedChanges' && event.state === 'true')
				app.socket.sendMessage('commandvalues command=.uno:ViewAnnotations');
		}, this);

		this.map.on('zoomend', function() {
			this.checkCollapseState();
			this.layout(true);
		}, this);

		this.backgroundColor = this.containerObject.getClearColor();
		this.initializeContextMenus();

		if ((<any>window).mode.isMobile()) {
			this.setShowSection(false);
			this.size[0] = 0;
		}
	}

	public static showCommentEditingWarning (): void {
		L.Map.THIS.uiManager.showInfoModal('annotation-editing', _('A comment is being edited'),
		_('Please save or discard the comment currently being edited.'), null, _('Close'));
	}

	private checkCollapseState(): void {
		if (!(<any>window).mode.isMobile() && app.map._docLayer._docType !== 'spreadsheet') {
			if (this.shouldCollapse()) {
				this.sectionProperties.deflectionOfSelectedComment = 180;
				this.setCollapsed();
			}
			else {
				this.sectionProperties.deflectionOfSelectedComment = 70;
				this.setExpanded();
			}

			if (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing')
				this.showHideComments();
		}
	}

	private findNextPartWithComment (currentPart: number): number {
		for (var i = 0;  i < this.sectionProperties.commentList.length; i++) {
			if (this.sectionProperties.commentList[i].sectionProperties.partIndex > currentPart) {
				return this.sectionProperties.commentList[i].sectionProperties.partIndex;
			}
		}
		return -1;
	}

	private findPreviousPartWithComment (currentPart: number): number {
		for (var i = this.sectionProperties.commentList.length - 1;  i > -1; i--) {
			if (this.sectionProperties.commentList[i].sectionProperties.partIndex < currentPart) {
				return this.sectionProperties.commentList[i].sectionProperties.partIndex;
			}
		}
		return -1;
	}

	public onAnnotationScrollDown (): void {
		var index = this.findNextPartWithComment(app.map._docLayer._selectedPart);
		if (index >= 0) {
			this.map.setPart(index);
		}
	}

	public onAnnotationScrollUp (): void {
		var index = this.findPreviousPartWithComment(app.map._docLayer._selectedPart);
		if (index >= 0) {
			this.map.setPart(index);
		}
	}

	private checkSize (): void {
		// When there is no comment || file is a spreadsheet || view type is mobile, we set this section's size to [0, 0].
		if (app.map._docLayer._docType === 'spreadsheet' || (<any>window).mode.isMobile() || this.sectionProperties.commentList.length === 0)
		{
			if (app.map._docLayer._docType === 'presentation' && this.sectionProperties.scrollAnnotation) {
				this.map.removeControl(this.sectionProperties.scrollAnnotation);
				this.sectionProperties.scrollAnnotation = null;
			}
		}
		else if (app.map._docLayer._docType === 'presentation') { // If there are comments but none of them are on the selected part.
			if (!this.sectionProperties.scrollAnnotation) {
				this.sectionProperties.scrollAnnotation = L.control.scrollannotation();
				this.sectionProperties.scrollAnnotation.addTo(this.map);
			}
		}
	}

	private isEditing(): boolean {
		const sections = this.containerObject.sections;
		const textBoxes = sections
			.flatMap((section: any) => [section.sectionProperties.nodeModifyText, section.sectionProperties.nodeReplyText])
			.filter((textBox: any) => textBox !== undefined);

		return textBoxes.includes(document.activeElement);
	}

	public getActiveEdit(): Comment {
		if (!this.sectionProperties.selectedComment) {
			return null;
		}
		if (this.sectionProperties.selectedComment.isEdit()) {
			return this.sectionProperties.selectedComment;
		}
		var openArray: Comment[] = [];
		this.getChildren(this.sectionProperties.selectedComment, openArray);
		for (var i = 0; i < openArray.length; i++) {
			if (openArray[i].isEdit()) {
				return openArray[i];
			}
		}
		return null;
	}

	public setCollapsed(): void {
		if (this.isEditing()) {
			return;
		}

		this.isCollapsed = true;
		this.unselect();
		for (var i: number = 0; i < this.sectionProperties.commentList.length; i++) {
			if (this.sectionProperties.commentList[i].sectionProperties.data.id !== 'new')
				this.sectionProperties.commentList[i].setCollapsed();
				$(this.sectionProperties.commentList[i].sectionProperties.container).addClass('collapsed-comment');
			if (this.sectionProperties.commentList[i].isRootComment())
				this.collapseReplies(i, this.sectionProperties.commentList[i].sectionProperties.data.id);
		}
	}

	public setExpanded(): void {
		this.isCollapsed = false;
		for (var i: number = 0; i < this.sectionProperties.commentList.length; i++) {
			this.sectionProperties.commentList[i].setExpanded();
			$(this.sectionProperties.commentList[i].sectionProperties.container).removeClass('collapsed-comment');
		}
	}

	private calculateAvailableSpace() {
		var availableSpace = (this.containerObject.getDocumentAnchorSection().size[0] - app.file.size.pX) * 0.5;
		availableSpace = Math.round(availableSpace / app.dpiScale);
		return availableSpace;
	}

	public shouldCollapse (): boolean {
		if (!this.containerObject.getDocumentAnchorSection() || app.map._docLayer._docType === 'spreadsheet' || (<any>window).mode.isMobile())
			return false;

		return this.calculateAvailableSpace() < this.sectionProperties.commentWidth;
	}

	public hideAllComments (): void {
		for (var i: number = 0; i < this.sectionProperties.commentList.length; i++) {
			this.sectionProperties.commentList[i].hide();
			var part = app.map._docLayer._selectedPart;
			if (app.map._docLayer._docType === 'spreadsheet') {
				// Change drawing order so they don't prevent each other from being shown.
				if (parseInt(this.sectionProperties.commentList[i].sectionProperties.data.tab) === part) {
					this.sectionProperties.commentList[i].drawingOrder = 2;
				}
				else {
					this.sectionProperties.commentList[i].drawingOrder = 1;
				}
			}
		}

		if (app.map._docLayer._docType === 'spreadsheet')
			this.containerObject.applyDrawingOrders();
	}

	// Mobile.
	private getChildren(comment: any, array: Array<any>) {
		for (var i = 0; i < comment.sectionProperties.children.length; i++) {
			array.push(comment.sectionProperties.children[i]);
			if (comment.sectionProperties.children[i].sectionProperties.children.length > 0)
				this.getChildren(comment.sectionProperties.children[i], array);
		}
	}

	// Mobile.
	private getCommentListOneDimensionalArray() {
		// 1 dimensional array of ordered comments.
		var openArray = [];

		for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
			if (this.sectionProperties.commentList[i].isRootComment()) {
				openArray.push(this.sectionProperties.commentList[i]);
				if (this.sectionProperties.commentList[i].sectionProperties.children.length > 0)
					this.getChildren(this.sectionProperties.commentList[i], openArray);
			}
		}
		return openArray;
	}

	private createCommentStructureWriter (menuStructure: any, threadOnly: any): void {
		var rootComment, comment;
		var commentList = this.getCommentListOneDimensionalArray();
		var showResolved = this.sectionProperties.showResolved;

		if (threadOnly) {
			if (!threadOnly.sectionProperties.data.trackchange && threadOnly.sectionProperties.data.parent !== '0')
				threadOnly = commentList[this.getIndexOf(threadOnly.sectionProperties.data.parent)];
		}

		for (var i = 0; i < commentList.length; i++) {
			if (commentList[i].isRootComment() || commentList[i].sectionProperties.data.trackchange) {
				var commentThread = [];
				do {
					comment = {
						id: 'comment' + commentList[i].sectionProperties.data.id,
						enable: true,
						data: commentList[i].sectionProperties.data,
						type: 'comment',
						text: commentList[i].sectionProperties.data.text,
						annotation: commentList[i],
						children: []
					};

					if (showResolved || comment.data.resolved !== 'true') {
						commentThread.unshift(comment);
					}
					i++;
				} while (commentList[i] && commentList[i].sectionProperties.data.parent !== '0');
				i--;

				if (commentThread.length > 0)
				{
					rootComment = {
						id: commentThread[commentThread.length - 1].id,
						enable: true,
						data: commentThread[commentThread.length - 1].data,
						type: 'rootcomment',
						text: commentThread[commentThread.length - 1].data.text,
						annotation: commentThread[commentThread.length - 1].annotation,
						children: commentThread
					};

					var matchingThread = threadOnly && threadOnly.sectionProperties.data.id === commentThread[0].data.id;
					if (matchingThread)
						menuStructure['children'] = commentThread;
					else if (!threadOnly)
						menuStructure['children'].push(rootComment);
				}
			}
		}
	}

	public createCommentStructureImpress (menuStructure: any, threadOnly: any): void {
		var rootComment;

		for (var i in this.sectionProperties.commentList) {
			var matchingThread = !threadOnly || (threadOnly && threadOnly.sectionProperties.data.id === this.sectionProperties.commentList[i].sectionProperties.data.id);
			if (matchingThread && (this.sectionProperties.commentList[i].sectionProperties.partIndex === app.map._docLayer._selectedPart || app.file.fileBasedView)) {
				rootComment = {
					id: 'comment' + this.sectionProperties.commentList[i].sectionProperties.data.id,
					enable: true,
					data: this.sectionProperties.commentList[i].sectionProperties.data,
					type: threadOnly ? 'comment' : 'rootcomment',
					text: this.sectionProperties.commentList[i].sectionProperties.data.text,
					annotation: this.sectionProperties.commentList[i],
					children: []
				};
				menuStructure['children'].push(rootComment);
			}
		}
	}

	public createCommentStructureCalc (menuStructure: any, threadOnly: any): void {
		var rootComment;
		var commentList = this.sectionProperties.commentList;
		var selectedTab = app.map._docLayer._selectedPart;

		for (var i: number = 0; i < commentList.length; i++) {
			var matchingThread = !threadOnly || (threadOnly && threadOnly.sectionProperties.data.id === commentList[i].sectionProperties.data.id);
			if (parseInt(commentList[i].sectionProperties.data.tab) === selectedTab && matchingThread) {
				rootComment = {
					id: 'comment' + commentList[i].sectionProperties.data.id,
					enable: true,
					data: commentList[i].sectionProperties.data,
					type: threadOnly ? 'comment' : 'rootcomment',
					text: commentList[i].sectionProperties.data.text,
					annotation: commentList[i],
					children: []
				};
				menuStructure['children'].push(rootComment);
			}
		}
	}

	// threadOnly - takes annotation indicating which thread will be generated
	public createCommentStructure (menuStructure: any, threadOnly: any): void {
		if (app.map._docLayer._docType === 'text') {
			this.createCommentStructureWriter(menuStructure, threadOnly);
		}
		else if (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing') {
			this.createCommentStructureImpress(menuStructure, threadOnly);
		}
		else if (app.map._docLayer._docType === 'spreadsheet') {
			this.createCommentStructureCalc(menuStructure, threadOnly);
		}
	}

	public isMobileCommentActive (): boolean {
		const newComment = document.getElementById(this.mobileCommentId);
		if (!newComment)
			return false;
		return newComment.style.display !== 'none'
	}

	public getMobileCommentModalId (): string {
		return this.mobileCommentModalId;
	}

	public newAnnotationMobile (comment: any, addCommentFn: any, isMod: any): void {
		var commentData = comment.sectionProperties.data;

		var callback = function(div: HTMLDivElement) {
			if (div.textContent || div.innerHTML) {
				var annotation = comment;

				annotation.sectionProperties.data.text = div.textContent;
				annotation.sectionProperties.data.html = div.innerHTML;
				comment.text = div.textContent;

				addCommentFn.call(annotation, annotation, comment);
				if (!isMod)
					this.containerObject.removeSection(annotation);
			}
			else {
				this.cancel(comment);
			}
		}.bind(this);

		let listId = 'mentionPopupList';
		if (this.map.mention)
			listId = this.map.mention.getPopupId() + 'List';
		var json = this.map.uiManager._modalDialogJSON(this.mobileCommentId, '', true, [
			{
				id: 'input-modal-input',
				type: 'multilineedit',
				text: (commentData.text && isMod ? commentData.text: ''),
				html: (commentData.html && isMod ? commentData.html: ''),
				contenteditable: true
			},
			{
				id: listId,
				type: 'treelistbox',
				text: '',
				enabled: true,
				singleclickactivate: false,
				fireKeyEvents: true,
				hideIfEmpty: true,
				entries: [] as Array<TreeEntryJSON>,
			},
			{
				id: '',
				type: 'buttonbox',
				text: '',
				enabled: true,
				children: [
					{
						id: 'response-cancel',
						type: 'pushbutton',
						text: _('Cancel'),
					},
					{
						id: 'response-ok',
						type: 'pushbutton',
						text: _('Save'),
						'has_default': true,
					}
				],
				vertical: false,
				layoutstyle: 'end'
			},
		]);

		var cancelFunction = function() {
			this.cancel(comment);
			this.map.uiManager.closeModal(this.mobileCommentModalId);
		}.bind(this);

		const mentionListCallback = function(objectType: any, eventType: any, object: any, index: number) {
				const mention = this.map.mention;
				if (eventType === 'close')
					mention.closeMentionPopup(false);
				else if (eventType === 'select' || eventType === 'activate') {
					const item = mention.getMentionUserData(index);
					const replacement = '@' + mention.getPartialMention();
					const uid = item.label ?? item.username
					if (uid !== '' && item.profile !== '')
						comment.autoCompleteMention(uid, item.profile, replacement)
					mention.closeMentionPopup(false);
				}
		}.bind(this);

		this.map.uiManager.showModal(json, [
			{id: 'response-ok', func: function() {
				if (typeof callback === 'function') {
					var input = document.getElementById('input-modal-input') as HTMLDivElement;
					callback(input);
				}
				this.map.uiManager.closeModal(this.mobileCommentModalId);
			}.bind(this)},
			{id: 'response-cancel', func: cancelFunction},
			{id: '__POPOVER__', func: cancelFunction},
			{id: '__DIALOG__', func: cancelFunction},
			{id: listId, func: mentionListCallback}
		]);

	  const multilineEditDiv = document.getElementById('input-modal-input');
		multilineEditDiv.addEventListener('input', function(ev: any){
			if (ev && app.map._docLayer._docType === 'text') {
				// special handling for mentions
				this.map?.mention.handleMentionInput(ev, comment.isNewPara());
			}
		}.bind(this));

		var tagTd = 'td',
		empty = '',
		tagDiv = 'div';
		var author = L.DomUtil.create('table', 'cool-annotation-table');
		var tbody = L.DomUtil.create('tbody', empty, author);
		var tr = L.DomUtil.create('tr', empty, tbody);
		var tdImg = L.DomUtil.create(tagTd, 'cool-annotation-img', tr);
		var tdAuthor = L.DomUtil.create(tagTd, 'cool-annotation-author', tr);
		var imgAuthor = L.DomUtil.create('img', 'avatar-img', tdImg);
		var user = this.map.getViewId(commentData.author);
		app.LOUtil.setUserImage(imgAuthor, this.map, user);
		imgAuthor.setAttribute('width', 32);
		imgAuthor.setAttribute('height', 32);
		var authorAvatarImg = imgAuthor;
		var contentAuthor = L.DomUtil.create(tagDiv, 'cool-annotation-content-author', tdAuthor);
		var contentDate = L.DomUtil.create(tagDiv, 'cool-annotation-date', tdAuthor);

		$(contentAuthor).text(commentData.author);
		$(authorAvatarImg).attr('src', commentData.avatar);
		if (user >= 0) {
			var color = app.LOUtil.rgbToHex(this.map.getViewColor(user));
			$(authorAvatarImg).css('border-color', color);
		}

		if (commentData.dateTime) {
			var d = new Date(commentData.dateTime.replace(/,.*/, 'Z'));
			var dateOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
			$(contentDate).text(isNaN(d.getTime()) ? comment.dateTime: d.toLocaleDateString((<any>String).locale, <any>dateOptions));
		}

		var newAnnotationDialog = document.getElementById(this.mobileCommentId);
		$(newAnnotationDialog).css('width', '100%');
		var dialogInput = newAnnotationDialog.children[0];
		$(dialogInput).css('height', '30vh');
		var parent = newAnnotationDialog.parentElement;
		parent.insertBefore(author, parent.childNodes[0]);
		document.getElementById('input-modal-input').focus();
	}

	public highlightComment (comment: any): void {
		this.removeHighlighters();

		var commentList = this.sectionProperties.commentList;

		var lastChild: any = this.getLastChildIndexOf(comment.sectionProperties.data.id);

		while (true && lastChild >= 0) {
			commentList[lastChild].highlight();

			if (commentList[lastChild].isRootComment())
				break;

			lastChild = this.getIndexOf(commentList[lastChild].sectionProperties.data.parent);
		}
	}

	public removeHighlighters (): void {
		var commentList = this.sectionProperties.commentList;
		for (var i: number = 0; i < commentList.length; i++) {
			if (commentList[i].sectionProperties.isHighlighted) {
				commentList[i].removeHighlight();
			}
		}
	}

	public removeItem (id: any): void {
		var annotation;
		for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
			annotation = this.sectionProperties.commentList[i];
			if (annotation.sectionProperties.data.id === id) {
				this.containerObject.removeSection(annotation.name);
				this.sectionProperties.commentList.splice(i, 1);
				this.updateIdIndexMap();
				break;
			}
		}
		this.checkSize();
	}

	public click (annotation: any): void {
		this.select(annotation);
	}

	public save (annotation: any): void {
		var comment;
		if (annotation.sectionProperties.data.id === 'new') {
			comment = {
				Author: {
					type: 'string',
					value: annotation.sectionProperties.data.author
				},
				// send if html exists, and it's writer send just html, otherwise text
				... (app.map._docLayer._docType === 'text' &&
				     annotation.sectionProperties.data.html) ?
					{ Html: {
						type: 'string',
						value: annotation.sectionProperties.data.html
					} } :
					{ Text: {
						type: 'string',
						value: annotation.sectionProperties.data.text
					} }
			};
			if (app.file.fileBasedView) {
				this.map.setPart(app.map._docLayer._selectedPart, false);
				this.map.sendUnoCommand('.uno:InsertAnnotation', comment, true /* force */);
				this.map.setPart(0, false);
			}
			else {
				this.map.sendUnoCommand('.uno:InsertAnnotation', comment, true /* force */);
			}

			// Object is later removed in onACKComment when newly inserted comment object is available
			// It's to reduce the flicker when using comment autosave
			if (!CommentSection.autoSavedComment)
				this.removeItem(annotation.sectionProperties.data.id);
		} else if (annotation.sectionProperties.data.trackchange) {
			comment = {
				ChangeTrackingId: {
					type: 'long',
					value: annotation.sectionProperties.data.index
				},
				Text: {
					type: 'string',
					value: annotation.sectionProperties.data.text
				}
			};
			this.map.sendUnoCommand('.uno:CommentChangeTracking', comment, true /* force */);
		} else {
			comment = {
				Id: {
					type: 'string',
					value: annotation.sectionProperties.data.id
				},
				Author: {
					type: 'string',
					value: annotation.sectionProperties.data.author
				},
				// send if html exists, and it's writer send just html, otherwise text
				... (app.map._docLayer._docType === 'text' &&
				     annotation.sectionProperties.data.html) ?
					{ Html: {
						type: 'string',
						value: annotation.sectionProperties.data.html
					} } :
					{ Text: {
						type: 'string',
						value: annotation.sectionProperties.data.text
					} }
			};
			this.map.sendUnoCommand('.uno:EditAnnotation', comment, true /* force */);
		}
		this.unselect();
		this.map.focus();
	}

	public reply (annotation: any): void {
		if (cool.Comment.isAnyEdit()) {
			cool.CommentSection.showCommentEditingWarning();
			return;
		}
		if ((<any>window).mode.isMobile()) {
			var avatar = undefined;
			var author = this.map.getViewName(app.map._docLayer._viewId);
			if (author in this.map._viewInfoByUserName) {
				avatar = this.map._viewInfoByUserName[author].userextrainfo.avatar;
			}

			if (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing') {
				this.newAnnotationMobile(annotation, annotation.onReplyClick, /* isMod */ false);
			}
			else {
				var replyAnnotation = {
					text: '',
					textrange: '',
					author: author,
					dateTime: new Date().toDateString(),
					id: annotation.sectionProperties.data.id,
					avatar: avatar,
					parent: annotation.sectionProperties.data.parent,
					anchorPos: [annotation.sectionProperties.data.anchorPos[0], annotation.sectionProperties.data.anchorPos[1]],
				};

				var replyAnnotationSection = new cool.Comment(replyAnnotation, replyAnnotation.id === 'new' ? {noMenu: true} : {}, this);
				replyAnnotationSection.name += '-reply';

				this.newAnnotationMobile(replyAnnotationSection, annotation.onReplyClick, /* isMod */ false);
			}
		}
		else {
			annotation.reply();
			this.select(annotation, true);
			annotation.focus();
		}
	}

	public modify (annotation: any): void {
		if (cool.Comment.isAnyEdit()) {
			cool.CommentSection.showCommentEditingWarning();
			return;
		}
		if ((<any>window).mode.isMobile()) {
			this.newAnnotationMobile(annotation, function(annotation: any) {
				this.save(annotation);
			}.bind(this), /* isMod */ true);
		}
		else {
			// Make sure that comment is not transitioning and comment menu is not open.
			var tempFunction = function() {
				setTimeout(function() {
					if (annotation.sectionProperties.container && annotation.sectionProperties.contextMenu === true
					) {
						tempFunction();
					}
					else {
						annotation.edit();
						this.select(annotation, true);
						annotation.focus();
					}
				}.bind(this), 1);
			}.bind(this);
			tempFunction();
		}
	}

	private showCollapsedReplies(rootIndex: number) {
		if (!this.sectionProperties.commentList.length)
			return;
		var lastIndex = this.getLastChildIndexOf(this.sectionProperties.commentList[rootIndex].sectionProperties.data.id);
		var rootComment = this.sectionProperties.commentList[rootIndex];

		while (rootIndex <= lastIndex) {
			this.sectionProperties.commentList[rootIndex].sectionProperties.container.style.display = '';
			this.sectionProperties.commentList[rootIndex].sectionProperties.container.style.visibility = '';
			$(this.sectionProperties.commentList[rootIndex].sectionProperties.container).removeClass('collapsed-comment');
			rootIndex++;
		}
		rootComment.updateThreadInfoIndicator();
	}

	private collapseReplies(rootIndex: number, rootId: number) {
		var lastChild = this.getLastChildIndexOf(rootId);

		$(this.sectionProperties.commentList[rootIndex].sectionProperties.container).addClass('collapsed-comment');
		for (var i = lastChild; i > rootIndex; i--) {
			this.sectionProperties.commentList[i].sectionProperties.container.style.display = 'none';
			$(this.sectionProperties.commentList[i].sectionProperties.container).addClass('collapsed-comment');
		}
		this.sectionProperties.commentList[i].updateThreadInfoIndicator();
	}

	private cssToCorePixels(cssPixels: number) {
		return cssPixels * app.dpiScale;
	}

	public select (annotation: Comment, force: boolean = false): void {
		if (force
			|| (annotation && !annotation.pendingInit && annotation !== this.sectionProperties.selectedComment
			&& (annotation.sectionProperties.data.resolved !== 'true' || this.sectionProperties.showResolved)
			)) {
			// Select the root comment
			var idx = this.getRootIndexOf(annotation.sectionProperties.data.id);

			// no need to reselect comment, it will cause to scroll to root comment unnecessarily
			if (this.sectionProperties.selectedComment === this.sectionProperties.commentList[idx]) {
				this.update();
				return;
			}

			// Unselect first if there anything selected
			if (this.sectionProperties.selectedComment)
				this.unselect();

			this.sectionProperties.selectedComment = this.sectionProperties.commentList[idx];

			if (this.sectionProperties.selectedComment && !$(this.sectionProperties.selectedComment.sectionProperties.container).hasClass('annotation-active')) {
				$(this.sectionProperties.selectedComment.sectionProperties.container).addClass('annotation-active');
			}

			if (app.map._docLayer._docType === 'text' && this.sectionProperties.showSelectedBigger) {
				this.setThreadPopup(this.sectionProperties.selectedComment, true);
			}

			this.scrollCommentIntoView(annotation);

			const selectedComment = this.sectionProperties.selectedComment;
			if (this.isCollapsed) {
				this.showCollapsedReplies(idx);
				selectedComment.updateThreadInfoIndicator();
			}

			this.update();
		}
	}

	private scrollCommentIntoView (comment: Comment) {
		if (CommentSection.importingComments)
			return;

		const docType = app.map._docLayer._docType;
		let anchorPosition: Array<number> = null;
		const rootComment = this.sectionProperties.commentList[this.getRootIndexOf(comment.sectionProperties.data.id)];

		switch (docType) {
			case 'text':
			{
				anchorPosition = this.numberArrayToCorePixFromTwips(
					rootComment.sectionProperties.data.anchorPos, 0, 2);
				break;
			}

			case 'spreadsheet':
			{
				// in calc comments are not visible on canvas, anchor vertical position is always 1
				// position is already in core pixels
				anchorPosition = rootComment.getPosition();
				break;
			}

			default:
				break;
		}

		if (anchorPosition && anchorPosition[1] > 0) {
			let annotationTop = anchorPosition[1];
			const firstIdx = this.getIndexOf(rootComment.sectionProperties.data.id);
			const lastIdx = this.getIndexOf(comment.sectionProperties.data.id);
			for (let i = firstIdx; i < lastIdx; i++) {
				annotationTop += this.cssToCorePixels(this.sectionProperties.commentList[i].getCommentHeight());
			}
			const annotationBottom = annotationTop + this.cssToCorePixels(comment.getCommentHeight());

			if (!this.isInViewPort([annotationTop, annotationBottom])) {
				const scrollSection = app.sectionContainer.getSectionWithName(L.CSections.Scroll.name);
				const screenTopBottom = this.getScreenTopBottom();

				if (annotationTop < screenTopBottom[0]) {
					scrollSection.scrollVerticalWithOffset(annotationTop - screenTopBottom[0]);
				}
				else
					scrollSection.scrollVerticalWithOffset(annotationBottom - screenTopBottom[1]);

				if (docType === 'spreadsheet' && rootComment) {
					rootComment.positionCalcComment();
					rootComment.focus();
				}
			}
		}
	}

	/// returns canvas top and bottom position in core pixels
	public getScreenTopBottom(): Array<number> {
		const scrollSection = app.sectionContainer.getSectionWithName(L.CSections.Scroll.name);
		const screenTop = scrollSection.containerObject.getDocumentTopLeft()[1];
		const screenBottom = screenTop + this.cssToCorePixels($('#map').height());

		return [screenTop, screenBottom];
	}

	/// checks if vertical top and bottom point (in core pixels) is shown on the screen currently
	private isInViewPort(positionTopBotton: Array<number>): boolean {
		const screenTopBottom = this.getScreenTopBottom();
		const top = positionTopBotton[0];
		const bottom = positionTopBotton[1];

		return (
			screenTopBottom[0] <= top &&
			screenTopBottom[1] >= bottom
		);
	}

	public unselect (): void {
		if (this.sectionProperties.selectedComment && this.sectionProperties.selectedComment.sectionProperties.data.id != 'new') {
			if (this.sectionProperties.selectedComment && $(this.sectionProperties.selectedComment.sectionProperties.container).hasClass('annotation-active'))
				$(this.sectionProperties.selectedComment.sectionProperties.container).removeClass('annotation-active');

			if (app.map._docLayer._docType === 'spreadsheet')
				this.sectionProperties.selectedComment.hide();

			if (this.sectionProperties.commentsAreListed && this.isCollapsed) {
				this.sectionProperties.selectedComment.setCollapsed();
				this.collapseReplies(this.getRootIndexOf(this.sectionProperties.selectedComment.sectionProperties.data.id), this.sectionProperties.selectedComment.sectionProperties.data.id);
			}
			if (app.map._docLayer._docType === 'text' && this.sectionProperties.showSelectedBigger) {
				this.setThreadPopup(this.sectionProperties.selectedComment, false);
				this.sectionProperties.showSelectedBigger = false;
			}
			this.sectionProperties.selectedComment = null;

			this.update();
		}
	}

	private setThreadPopup (comment: Comment, popup: boolean) {
		if (popup && !$(comment.sectionProperties.container).hasClass('annotation-pop-up'))
			$(comment.sectionProperties.container).addClass('annotation-pop-up');
		else if (!popup && $(comment.sectionProperties.container).hasClass('annotation-pop-up'))
			$(comment.sectionProperties.container).removeClass('annotation-pop-up');

		for (const childComment of comment.sectionProperties.children) {
			this.setThreadPopup(childComment, popup);
		}
	}

	public toggleShowBigger (comment: Comment) {
		const rootComment = this.sectionProperties.commentList[this.getRootIndexOf(comment.sectionProperties.data.id)];
		const isSelected = this.sectionProperties.selectedComment === rootComment;
		if (this.sectionProperties.showSelectedBigger && isSelected) {
			this.sectionProperties.showSelectedBigger = false;
			this.setThreadPopup(this.sectionProperties.selectedComment, false);
		}
		else if (!isSelected) {
			if (this.sectionProperties.selectedComment)
				this.unselect();
			this.sectionProperties.showSelectedBigger = true;
			this.select(comment);
		}
		else {
			this.sectionProperties.showSelectedBigger = true;
			this.setThreadPopup(rootComment, true);
			this.scrollCommentIntoView(comment);
		}
		this.update();
	}

	public saveReply (annotation: any): void {
		var comment = {
			Id: {
				type: 'string',
				value: annotation.sectionProperties.data.id
			},
			// send if html exists, and it's writer send just html, otherwise text
			... (app.map._docLayer._docType === 'text' &&
			     annotation.sectionProperties.data.html) ?
				{ Html: {
					type: 'string',
					value: annotation.sectionProperties.data.html
				} } :
				{ Text: {
					type: 'string',
					value: annotation.sectionProperties.data.reply
				} }
		};

		if (app.map._docLayer._docType === 'text' || app.map._docLayer._docType === 'spreadsheet')
			this.map.sendUnoCommand('.uno:ReplyComment', comment);
		else if (app.map._docLayer._docType === 'presentation')
			this.map.sendUnoCommand('.uno:ReplyToAnnotation', comment);

		this.unselect();
		this.map.focus();
	}

	public cancel (annotation: any): void {
		if (annotation.sectionProperties.data.id === 'new') {
			this.removeItem(annotation.sectionProperties.data.id);
		}
		if (this.sectionProperties.selectedComment === annotation) {
			this.unselect();
		} else {
			this.update();
		}
		this.map.focus();
	}

	public onRedlineAccept (e: any): void {
		var command = {
			AcceptTrackedChange: {
				type: 'unsigned short',
				value: e.id.substring('change-'.length)
			}
		};
		this.map.sendUnoCommand('.uno:AcceptTrackedChange', command);
		this.unselect();
		this.map.focus();
	}

	public onRedlineReject (e: any): void {
		var command = {
			RejectTrackedChange: {
				type: 'unsigned short',
				value: e.id.substring('change-'.length)
			}
		};
		this.map.sendUnoCommand('.uno:RejectTrackedChange', command);
		this.unselect();
		this.map.focus();
	}

	public remove (id: any): void {
		var comment = {
			Id: {
				type: 'string',
				value: id
			}
		};

		var removedComment = this.getComment(id);
		removedComment.sectionProperties.selfRemoved = true;
		if (app.file.fileBasedView) // We have to set the part from which the comment will be removed as selected part before the process.
			this.map.setPart(app.map._docLayer._selectedPart, false);

		if (app.map._docLayer._docType === 'text')
			this.map.sendUnoCommand('.uno:DeleteComment', comment);
		else if (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing')
			this.map.sendUnoCommand('.uno:DeleteAnnotation', comment);
		else if (app.map._docLayer._docType === 'spreadsheet')
			this.map.sendUnoCommand('.uno:DeleteNote', comment);

		if (app.file.fileBasedView)
			this.map.setPart(0, false);

		this.unselect();
		this.map.focus();
	}

	public removeThread (id: any): void {
		var comment = {
			Id: {
				type: 'string',
				value: id
			}
		};
		this.map.sendUnoCommand('.uno:DeleteCommentThread', comment);
		this.unselect();
		this.map.focus();
	}

	public resolve (annotation: any): void {
		var comment = {
			Id: {
				type: 'string',
				value: annotation.sectionProperties.data.id
			}
		};
		this.map.sendUnoCommand('.uno:ResolveComment', comment);
	}

	public resolveThread (annotation: any): void {
		var comment = {
			Id: {
				type: 'string',
				value: annotation.sectionProperties.data.id
			}
		};
		this.map.sendUnoCommand('.uno:ResolveCommentThread', comment);
	}

	public promote(annotation: any): void {
		var comment = {
			Id: {
				type: 'string',
				value: annotation.sectionProperties.data.id
			}
		};
		this.map.sendUnoCommand('.uno:PromoteComment', comment);
	}

	public getIndexOf (id: any): number {
		const index = this.idIndexMap.get(id);
		return (index === undefined) ? -1 : index;
	}

	public isThreadResolved (annotation: any): boolean {
		// If comment has children.
		if (annotation.sectionProperties.children.length > 0) {
			for (var i = 0; i < annotation.sectionProperties.children.length; i++) {
				if (annotation.sectionProperties.children[i].sectionProperties.data.resolved !== 'true')
					return false;
			}
			return true;
		}
		// If it has a parent.
		else if (annotation.sectionProperties.data.parent !== '0') {
			var index = this.getSubRootIndexOf(annotation.sectionProperties.data.parent);
			var comment = this.sectionProperties.commentList[index];
			if (comment.sectionProperties.data.resolved !== 'true')
				return false;
			else if (comment.sectionProperties.children.length > 0) {
				for (var i = 0; i < comment.sectionProperties.children.length; i++) {
					if (comment.sectionProperties.children[i].sectionProperties.data.resolved !== 'true')
						return false;
				}
				return true;
			}
		}
	}

	private initializeContextMenus (): void {
		var docLayer = app.map._docLayer;
		L.installContextMenu({
			selector: '.cool-annotation-menu',
			trigger: 'none',
			zIndex: 1500,
			className: 'cool-font',
			build: function ($trigger: any) {
				const blockChangeFromDifferentAuthor = this.map.isReadOnlyMode() && docLayer._docType === 'text' && this.map.getViewName(docLayer._viewId) !== $trigger[0].annotation.sectionProperties.data.author;
				const isShownBig = this.sectionProperties.showSelectedBigger && this.sectionProperties.selectedComment === this.sectionProperties.commentList[this.getRootIndexOf($trigger[0].annotation.sectionProperties.data.id)];
				return {
					autoHide: true,
					items: {
						modify: blockChangeFromDifferentAuthor ? undefined : {
							name: _('Modify'),
							callback: function (key: any, options: any) {
								this.modify.call(this, options.$trigger[0].annotation);
							}.bind(this)
						},
						reply: (docLayer._docType !== 'text' && docLayer._docType !== 'presentation') ? undefined : {
							name: _('Reply'),
							callback: function (key: any, options: any) {
								this.reply.call(this, options.$trigger[0].annotation);
							}.bind(this)
						},
						remove: blockChangeFromDifferentAuthor ? undefined : {
							name: _('Remove'),
							callback: function (key: any, options: any) {
								this.remove.call(this, options.$trigger[0].annotation.sectionProperties.data.id);
							}.bind(this)
						},
						removeThread: docLayer._docType !== 'text' || !$trigger[0].annotation.isRootComment() || blockChangeFromDifferentAuthor ? undefined : {
							name: _('Remove Thread'),
							callback: function (key: any, options: any) {
								this.removeThread.call(this, options.$trigger[0].annotation.sectionProperties.data.id);
							}.bind(this)
						},
						resolve: docLayer._docType !== 'text' ? undefined : {
							name: $trigger[0].annotation.sectionProperties.data.resolved === 'false' ? _('Resolve') : _('Unresolve'),
							callback: function (key: any, options: any) {
								this.resolve.call(this, options.$trigger[0].annotation);
							}.bind(this)
						},
						resolveThread: docLayer._docType !== 'text' || !$trigger[0].annotation.isRootComment() ? undefined : {
							name: this.isThreadResolved($trigger[0].annotation) ? _('Unresolve Thread') : _('Resolve Thread'),
							callback: function (key: any, options: any) {
								this.resolveThread.call(this, options.$trigger[0].annotation);
							}.bind(this)
						},
						promote: docLayer._docType !== 'text' || $trigger[0].annotation.isRootComment() || blockChangeFromDifferentAuthor ? undefined : {
							name: _('Promote to top comment'),
							callback: function (key: any, options: any) {
								this.promote.call(this, options.$trigger[0].annotation);
							}.bind(this)
						},
						showBigger: docLayer._docType !== 'text' || (<any>window).mode.isMobile() ? undefined : {
							name: isShownBig ? _('Show on the side') : _('Open in full view'),
							callback: function (key: any, options: any) {
								this.toggleShowBigger.call(this, options.$trigger[0].annotation);
							}.bind(this)
						}
					},
				};
			}.bind(this),
			events: {
				show: function (options: any) {
					options.$trigger[0].annotation.sectionProperties.contextMenu = true;
					setTimeout(function() {
						options.items.modify.$node[0].tabIndex = 0;
						options.items.modify.$node[0].focus();
					}.bind(this), 10);
				},
				hide: function (options: any) {
					options.$trigger[0].annotation.sectionProperties.contextMenu = false;
				}
			}
		});
		L.installContextMenu({
			selector: '.cool-annotation-menu-redline',
			trigger: 'none',
			zIndex: 1500,
			className: 'cool-font',
			items: {
				modify: {
					name: _('Comment'),
					callback: function (key: any, options: any) {
						this.modify.call(this, options.$trigger[0].annotation);
					}.bind(this)
				}
			},
			events: {
				show: function (options: any) {
					options.$trigger[0].annotation.sectionProperties.contextMenu = true;
				},
				hide: function (options: any) {
					options.$trigger[0].annotation.sectionProperties.contextMenu = false;
				}
			}
		});
	}

	public onResize (): void {
		this.checkCollapseState();
		this.update();
		// When window is resized, it may mean that comment wizard is closed. So we hide the highlights.
		this.removeHighlighters();
		this.containerObject.requestReDraw();
	}

	public onNewDocumentTopLeft (): void {
		if (app.map._docLayer._docType === 'spreadsheet') {
			if (this.sectionProperties.selectedComment)
				this.sectionProperties.selectedComment.hide();
		}

		var previousAnimationState = this.disableLayoutAnimation;
		this.disableLayoutAnimation = true;
		this.update(true, false);
		this.disableLayoutAnimation = previousAnimationState;
	}

	private showHideComments (): void {
		for (var i: number = 0; i < this.sectionProperties.commentList.length; i++) {
			this.showHideComment(this.sectionProperties.commentList[i]);
		}
	}

	public showHideComment (annotation: any): void {
		// This manually shows/hides comments
		if (!this.sectionProperties.showResolved && app.map._docLayer._docType === 'text') {
			if (annotation.isContainerVisible() && annotation.sectionProperties.data.resolved === 'true') {
				if (this.sectionProperties.selectedComment == annotation) {
					this.unselect();
				}
				annotation.hide();
				annotation.update();
			} else if (!annotation.isContainerVisible() && annotation.sectionProperties.data.resolved === 'false') {
				annotation.show();
				annotation.update();
			}
			this.update();
		}
		else if (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing') {
			if (annotation.sectionProperties.partIndex === app.map._docLayer._selectedPart || app.file.fileBasedView) {
				if (!annotation.isContainerVisible()) {
					annotation.show();
					annotation.update();
					this.update();
				}
			}
			else {
				annotation.hide();
				annotation.update();
				this.update();
			}
		}
	}

	public add (comment: any): cool.Comment {
		if (!comment.sectionProperties) {
			const temp = new cool.Comment(comment, comment.id === 'new' ? {noMenu: true} : {}, this);
			temp.sectionProperties.data = comment;
			comment = temp;
		}

		comment.sectionProperties.noMenu  = comment.sectionProperties.data.id === 'new' ? true : false;

		/*
			Remove if a comment with the same id exists.
			When user deletes a parent and a child of that parent and undoes the operation respectively:
				* The first undo: Core side sends the deleted child - this is fine.
				* The second undo: Core side sends parent and child together - which is not fine. We already had the child with the first undo command.
			So, delete if a comment already exists and trust core side about the ids of the comments.
		*/
		if (this.containerObject.doesSectionExist(comment.name))
			this.removeItem(comment.name);

		this.containerObject.addSection(comment);
		this.sectionProperties.commentList.push(comment);

		this.adjustParentAdd(comment);
		this.orderCommentList(); // Also updates the index map.
		this.checkSize();

		if (this.isCollapsed && comment.sectionProperties.data.id !== 'new')
			comment.setCollapsed();
		else
		comment.setExpanded();

		// check if we are the author
		// then select it so it does not get lost in a long list of comments and replies.
		const authorName = this.map.getViewName(app.map._docLayer._viewId);
		const newComment = comment.sectionProperties.data.id === 'new';
		if (!newComment && (authorName === comment.sectionProperties.data.author)) {
			this.select(comment);
		}

		return comment;
	}

	public adjustRedLine (redline: any): boolean {
		// All sane values ?
		if (!redline.textRange) {
			console.warn('Redline received has invalid textRange');
			return false;
		}

		// transform change tracking index into an id
		redline.id = 'change-' + redline.index;
		redline.parent = '0'; // Redlines don't have parents, we need to specify this for consistency.
		redline.anchorPos = this.stringToRectangles(redline.textRange)[0];
		redline.anchorPix = this.numberArrayToCorePixFromTwips(redline.anchorPos, 0, 2);
		redline.trackchange = true;
		redline.text = redline.comment;
		var rectangles = L.PolyUtil.rectanglesToPolygons(app.LOUtil.stringToRectangles(redline.textRange), app.map._docLayer);
		if (rectangles.length > 0) {
			redline.textSelected = L.polygon(rectangles, {
				pointerEvents: 'all',
				interactive: false,
				fillOpacity: 0,
				opacity: 0
			});
			redline.textSelected.addEventParent(this.map);
			redline.textSelected.on('click', function() {
				this.selectById(redline.id);
			}, this);
		}

		return true;
	}

	public getComment (id: any): any {
		const index = this.getIndexOf(id);
		return index == -1 ? null : this.sectionProperties.commentList[index];
	}

	private checkIfCommentHasPreAssignedChildren(comment: CommentSection) {
		for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
			var possibleChild: Comment = this.sectionProperties.commentList[i];
			if (possibleChild.sectionProperties.possibleParentCommentId !== null) {
				if (possibleChild.sectionProperties.possibleParentCommentId === comment.sectionProperties.data.id) {
					if (!comment.sectionProperties.children.includes(possibleChild))
						comment.sectionProperties.children.push(possibleChild);
				}
			}
		}
	}

	// Adjust parent-child relationship, if required, after `comment` is added
	public adjustParentAdd (comment: any): void {
		if (comment.sectionProperties.data.parent === undefined)
			comment.sectionProperties.data.parent = '0';

		if (comment.sectionProperties.data.parent !== '0') {
			var parentIdx = this.getIndexOf(comment.sectionProperties.data.parent);
			if (parentIdx === -1) {
				console.warn('adjustParentAdd: No parent comment to attach received comment to. ' +
					'Parent comment ID sought is :' + comment.sectionProperties.data.parent + ' for current comment with ID : ' + comment.sectionProperties.data.id);
				comment.sectionProperties.possibleParentCommentId = comment.sectionProperties.data.parent; // Save the proposed parentId so we can remember if such parent appears.
				comment.setAsRootComment(); // Set this to default since there is no such parent at the moment.
			}
			else {
				var parentComment = this.sectionProperties.commentList[parentIdx];
				if (parentComment && !parentComment.sectionProperties.children.includes(comment))
					parentComment.sectionProperties.children.unshift(comment);
			}
		}

		// Check if any of the child comments targets the newly added comment as parent.
		this.checkIfCommentHasPreAssignedChildren(comment);
	}

	// Adjust parent-child relationship, if required, after `comment` is removed
	public adjustParentRemove (comment: any): void {
		var parentIdx = this.getIndexOf(comment.getParentCommentId());

		// If a child comment is removed.
		var parentComment = this.sectionProperties.commentList[parentIdx];
		if (parentComment) {
			var index = parentComment.getIndexOfChild(comment);
			if (index >= 0)
				parentComment.removeChildByIndex(index); // Removed comment has a parent. Remove the comment also from its parent's list.
		}

		// If a parent comment is removed.
		for (var i = 0; i < comment.getChildrenLength(); i++) { // Loop over removed comment's children.
			var childComment = comment.getChildByIndex(i);
			if (childComment)
				childComment.setAsRootComment(); // The children have no parent comment any more.
		}
	}

	public overWriteCommentChanges(obj: any, editComment: Comment) {
		this.clearAutoSaveStatus();
		editComment.onCancelClick(null);
		this.onACKComment(obj);
	}

	public handleCommentConflict(obj: any, editComment: Comment) {
		if (document.getElementById(this.map.uiManager.generateModalId('comments-update')))
			return;

		if (obj.comment.action === 'Remove' || obj.comment.action === 'RedlinedDeletion') {
			JSDialog.showInfoModalWithOptions(
				'comments-update', {
				'title':_('Comments Updated'),
				'messages': [_('Another user has removed this comment.')],
				'buttons': [{'text': _('OK'),
				'callback': () => {
					this.overWriteCommentChanges(obj, editComment);
				}}],
				'withCancel': false}
			);
			return;
		}

		this.map.uiManager.showYesNoButton(
			'comments-update',
			_('Comments Updated'),
			_('Another user has updated the comment. Would you like to overwrite those changes?'),
			_('Overwrite'),
			_('Update'),
			null,
			() => {
				this.overWriteCommentChanges(obj, editComment);
			}, false
		);
	}

	public checkIfOnlyAnchorPosChanged(obj: any, editComment: Comment): boolean {
		if (obj.comment.action !== 'Modify')
			return false;

		var newComment = obj.comment;
		var editCommentData = editComment.sectionProperties.data;

		if (newComment.author !== editCommentData.author
		|| newComment.dateTime !== editCommentData.dateTime
		|| newComment.html !== editCommentData.html
		|| newComment.layoutStatus !== editCommentData.layoutStatus.toString()
		|| newComment.parentId !== editCommentData.parentId
		|| newComment.resolved !== editCommentData.resolved
		|| newComment.textRange !== editCommentData.textRange)
			return false;

		if (newComment.anchorPos.replaceAll(" ", '') !== editCommentData.anchorPos.toString())
			return true;
		return false;
	}

	private actionPerformedByCurrentUser(obj: any): boolean {
		return obj.comment.author === this.map._viewInfo[this.map._docLayer._editorId].username;
	}

	public onACKComment (obj: any): void {
		var id;
		const anyEdit = Comment.isAnyEdit();
		if (anyEdit
			&& !this.checkIfOnlyAnchorPosChanged(obj, anyEdit)
			&& !anyEdit.sectionProperties.selfRemoved
			&& anyEdit.sectionProperties.data.id === obj.comment.id
			&& CommentSection.autoSavedComment !== anyEdit
			&& !this.actionPerformedByCurrentUser(obj)) {
			this.handleCommentConflict(obj, anyEdit);
			return;
		}
		var changetrack = obj.redline ? true : false;
		var dataroot = changetrack ? 'redline' : 'comment';
		if (changetrack) {
			obj.redline.id = 'change-' + obj.redline.index;
		}
		var action = changetrack ? obj.redline.action : obj.comment.action;

		if (!changetrack && obj.comment.parent === undefined) {
			if (obj.comment.parentId)
				obj.comment.parent = String(obj.comment.parentId);
			else
				obj.comment.parent = '0';
		}

		if (changetrack && obj.redline.author in this.map._viewInfoByUserName) {
			obj.redline.avatar = this.map._viewInfoByUserName[obj.redline.author].userextrainfo.avatar;
		}
		else if (!changetrack && obj.comment.author in this.map._viewInfoByUserName) {
			obj.comment.avatar = this.map._viewInfoByUserName[obj.comment.author].userextrainfo.avatar;
		}

		if ((<any>window).mode.isMobile()) {
			var annotation = this.sectionProperties.commentList[this.getRootIndexOf(obj[dataroot].id)];
			if (!annotation)
				annotation = this.sectionProperties.commentList[this.getRootIndexOf(obj[dataroot].parent)]; //this is required for reload after reply in writer
		}
		if (action === 'Add') {
			if (changetrack) {
				if (!this.adjustRedLine(obj.redline)) {
					// something wrong in this redline
					return;
				}
				this.add(obj.redline);
			} else {
				const currentComment = this.getComment(obj[dataroot].id);
				if (currentComment !== null) {
					if (obj[dataroot].layoutStatus !== undefined) {
						currentComment.sectionProperties.data.layoutStatus = parseInt(obj[dataroot].layoutStatus);
						currentComment.setLayoutClass();
					}
					return;
				}

				this.adjustComment(obj.comment);
				annotation = this.add(obj.comment);
				if (app.map._docLayer._docType === 'spreadsheet')
					annotation.hide();

				var autoSavedComment = CommentSection.autoSavedComment;
				if (autoSavedComment) {
					var isOurComment = annotation.isAutoSaved();
					if (isOurComment) {
						if (app.definitions.CommentSection.needFocus) {
							app.definitions.CommentSection.needFocus = annotation;
						}
						annotation.sectionProperties.container.style.visibility = 'visible';
						annotation.sectionProperties.autoSave.innerText = _('Autosaved');
						if (app.map._docLayer._docType === 'spreadsheet')
							annotation.show();
						annotation.edit();
						if (autoSavedComment.sectionProperties.data.id === 'new')
							this.removeItem(autoSavedComment.sectionProperties.data.id);
						CommentSection.autoSavedComment = null;
						CommentSection.commentWasAutoAdded = true;
					}
				}
			}
			if (this.sectionProperties.selectedComment && !this.sectionProperties.selectedComment.isEdit()) {
				this.map.focus();
			}
		} else if (action === 'Remove') {
			id = obj[dataroot].id;
			var removed = this.getComment(id);
			if (removed) {
				this.adjustParentRemove(removed);
				if (this.sectionProperties.selectedComment === removed) {
					this.unselect();
					this.removeItem(id);
				}
				else {
					this.removeItem(id);
					this.update();
				}
			}
		} else if (action === 'RedlinedDeletion') {
			id = obj[dataroot].id;
			var _redlined = this.getComment(id);
			if (_redlined && _redlined.sectionProperties.data.layoutStatus === CommentLayoutStatus.INSERTED) {
				// Do normal removal if comment was added while recording was on
				// No need to keep the deleted comment
				obj[dataroot].action = 'Remove';
				this.onACKComment(obj);
				return;
			}
			if (_redlined) {
				_redlined.sectionProperties.data.layoutStatus = CommentLayoutStatus.DELETED;
				_redlined.setLayoutClass();
			}
		} else if (action === 'Modify') {
			id = obj[dataroot].id;
			var modified = this.getComment(id);
			if (modified) {
				var modifiedObj;
				if (changetrack) {
					if (!this.adjustRedLine(obj.redline)) {
						// something wrong in this redline
						return;
					}
					modifiedObj = obj.redline;
				} else {
					this.adjustComment(obj.comment);
					modifiedObj = obj.comment;
				}
				const oldParent = modified.getParentCommentId();
				modified.setData(modifiedObj);
				modified.update();
				if (oldParent !== null && modified.isRootComment()) {
					const parentIdx = this.getIndexOf(oldParent);
					const parentComment = this.sectionProperties.commentList[parentIdx];
					if (parentComment) {
						const index = parentComment.getIndexOfChild(modified);
						if (index >= 0)
							parentComment.removeChildByIndex(index);
					}
				}
				this.update();

				if (CommentSection.autoSavedComment) {
					CommentSection.autoSavedComment.sectionProperties.autoSave.innerText = _('Autosaved');
					if (app.map._docLayer._docType === 'spreadsheet')
						modified.show();
					modified.edit();
					if(this.shouldCollapse())
						modified.setCollapsed();
				}
			}
		} else if (action === 'Resolve') {
			id = obj[dataroot].id;
			var resolved = this.getComment(id);
			if (resolved) {
				var resolvedObj;
				if (changetrack) {
					if (!this.adjustRedLine(obj.redline)) {
						// something wrong in this redline
						return;
					}
					resolvedObj = obj.redline;
				} else {
					this.adjustComment(obj.comment);
					resolvedObj = obj.comment;
				}
				resolved.setData(resolvedObj);
				resolved.update();
				this.showHideComment(resolved);
				this.update();
			}
		}
		if ((<any>window).mode.isMobile()) {
			var shouldOpenWizard = false;
			var wePerformedAction = obj.comment.author === this.map.getViewName(app.map._docLayer._viewId);

			if ((<any>window).commentWizard || (action === 'Add' && wePerformedAction))
				shouldOpenWizard = true;

			if (shouldOpenWizard) {
				app.map._docLayer._openCommentWizard(annotation);
			}
		}

		if (app.map._docLayer._docType === 'text') {
			this.updateThreadInfoIndicator();
		}

		if (CommentSection.pendingImport) {
			app.socket.sendMessage('commandvalues command=.uno:ViewAnnotations');
			CommentSection.pendingImport = false;
		}
	}

	public selectById (commentId: any): void {
		var idx = this.getRootIndexOf(commentId);
		var annotation = this.sectionProperties.commentList[idx];
		this.select(annotation);
	}

	public stringToRectangles (str: string): number[][] {
		var strString = typeof str !== 'string' ? String(str) : str;
		var matches = strString.match(/\d+/g);
		var rectangles: number[][] = [];
		if (matches !== null) {
			for (var i: number = 0; i < matches.length; i += 4) {
				rectangles.push([parseInt(matches[i]), parseInt(matches[i + 1]), parseInt(matches[i + 2]), parseInt(matches[i + 3])]);
			}
		}
		return rectangles;
	}

	public onPartChange (): void {
		for (var i: number = 0; i < this.sectionProperties.commentList.length; i++) {
			this.showHideComment(this.sectionProperties.commentList[i]);
		}
		if (this.sectionProperties.selectedComment)
			this.sectionProperties.selectedComment.onCancelClick(null);

		this.checkSize();
	}

	// This converts the specified number of values into core pixels from twips.
	// Returns a new array with the length of specified numbers.
	private numberArrayToCorePixFromTwips (numberArray: Array<number>, startIndex: number = 0, length: number = null): Array<number> {
		if (!length)
			length = numberArray.length;

		if (startIndex < 0)
			startIndex = 0;

		if (length < 0)
			length = 0;

		if (startIndex + length > numberArray.length)
			length = numberArray.length - startIndex;

		var result = new Array(length);
		var ratio: number = (app.tile.size.pixels[0] / app.tile.size.twips[0]);

		for (var i = startIndex; i < length; i++) {
			result[i] = Math.round(numberArray[i] * ratio);
		}

		return result;
	}

	// In file based view, we need to move comments to their part's position.
	// Because all parts are drawn on the screen. Core side doesn't have this feature.
	// Core side sends the information in part coordinates.
	// When a coordinate like [0, 0] is inside 2nd part for example, that coordinate should correspond to a value like (just guessing) [0, 45646].
	// See that y value is different. Because there is 1st part above the 2nd one in the view.
	// We will add their part's position to comment's variables.
	// When we are saving their position, we will remove the additions before sending the information.
	private adjustCommentFileBasedView (comment: any): void {
		// Below calculations are the same with the ones we do while drawing tiles in fileBasedView.
		var partHeightTwips = app.map._docLayer._partHeightTwips + app.map._docLayer._spaceBetweenParts;
		var index = app.impress.getIndexFromSlideHash(parseInt(comment.parthash));
		var yAddition = index * partHeightTwips;
		comment.yAddition = yAddition; // We'll use this while we save the new position of the comment.

		comment.trackchange = false;

		comment.rectangles = this.stringToRectangles(comment.textRange || comment.anchorPos || comment.rectangle); // Simple array of point arrays [x1, y1, x2, y2].
		comment.rectangles[0][1] += yAddition; // There is only one rectangle for our case.

		comment.rectanglesOriginal = this.stringToRectangles(comment.textRange || comment.anchorPos || comment.rectangle); // This unmodified version will be kept for re-calculations.
		comment.rectanglesOriginal[0][1] += yAddition;

		comment.anchorPos = this.stringToRectangles(comment.anchorPos || comment.rectangle)[0];
		comment.anchorPos[1] += yAddition;

		if (comment.rectangle) {
			comment.rectangle = this.stringToRectangles(comment.rectangle)[0]; // This is the position of the marker.
			comment.rectangle[1] += yAddition;
		}

		comment.anchorPix = this.numberArrayToCorePixFromTwips(comment.anchorPos, 0, 2);

		comment.parthash = comment.parthash ? comment.parthash: null;

		var viewId = this.map.getViewId(comment.author);
		var color = viewId >= 0 ? app.LOUtil.rgbToHex(this.map.getViewColor(viewId)) : '#43ACE8';
		comment.color = color;
	}

	// Normally, a comment's position information is the same with the desktop version.
	// So we can use it directly.
	private adjustCommentNormal (comment: any): void {
		comment.trackchange = false;

		if (comment.cellRange) {
			// turn cell range string into cell bounds
			comment.cellRange = app.map._docLayer._parseCellRange(comment.cellRange);
		}

		var cellPos = comment.cellRange ? app.map._docLayer._cellRangeToTwipRect(comment.cellRange).toRectangle() : null;
		comment.rectangles = this.stringToRectangles(comment.textRange || comment.anchorPos || comment.rectangle || cellPos); // Simple array of point arrays [x1, y1, x2, y2].
		comment.rectanglesOriginal = this.stringToRectangles(comment.textRange || comment.anchorPos || comment.rectangle || cellPos); // This unmodified version will be kept for re-calculations.
		comment.anchorPos = this.stringToRectangles(comment.anchorPos || comment.rectangle || cellPos)[0];
		comment.anchorPix = this.numberArrayToCorePixFromTwips(comment.anchorPos, 0, 2);
		comment.parthash = comment.parthash ? comment.parthash: null;
		comment.tab = (comment.tab || comment.tab === 0) ? comment.tab: null;
		comment.layoutStatus = comment.layoutStatus !== undefined ? parseInt(comment.layoutStatus): null;

		if (comment.parentId)
			comment.parent = String(comment.parentId);

		if (comment.rectangle) {
			comment.rectangle = this.stringToRectangles(comment.rectangle)[0]; // This is the position of the marker (Impress & Draw).
		}

		var viewId = this.map.getViewId(comment.author);
		var color = viewId >= 0 ? app.LOUtil.rgbToHex(this.map.getViewColor(viewId)) : '#43ACE8';
		comment.color = color;
	}

	private adjustComment (comment: any): void {
		if (!app.file.fileBasedView)
			this.adjustCommentNormal(comment);
		else
			this.adjustCommentFileBasedView(comment);
	}

	// Returns the last comment id of comment thread containing the given id
	private getLastChildIndexOf (id: any): number {
		var index = this.getIndexOf(id);
		index = this.getRootIndexOf(this.sectionProperties.commentList[index].sectionProperties.data.id);

		while
		(
			this.sectionProperties.commentList[index + 1] &&
			index + 1 < this.sectionProperties.commentList.length &&
			this.sectionProperties.commentList[index + 1].sectionProperties.data.parent !== '0'
		) {
			index++;
		}

		return index;
	}

	// If the file type is presentation or drawing then we shall check the selected part in order to hide comments from other parts.
	// But if file is in fileBasedView, then we will not hide any comments from not-selected/viewed parts.
	private mustCheckSelectedPart (): boolean {
		return (app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing') && !app.file.fileBasedView;
	}

	private getAnimationDuration() :number {
		return this.disableLayoutAnimation ? 0 : undefined; // undefined means it will use default value
	}

	private layoutUp (subList: any, actualPosition: Array<number>, lastY: number, relayout: boolean = true): number {
		var height: number;
		for (var i = 0; i < subList.length; i++) {
			height = subList[i].getCommentHeight(relayout);
			lastY = subList[i].sectionProperties.data.anchorPix[1] + height < lastY ? subList[i].sectionProperties.data.anchorPix[1]: lastY - (height * app.dpiScale);
			(new L.PosAnimation()).run(subList[i].sectionProperties.container, {x: Math.round(actualPosition[0] / app.dpiScale), y: Math.round(lastY / app.dpiScale)}, this.getAnimationDuration());
			if (!subList[i].isEdit())
				subList[i].show();
		}
		return lastY;
	}

	private loopUp (startIndex: number, x: number, startY: number, relayout: boolean = true): number {
		var tmpIdx = 0;
		var checkSelectedPart: boolean = this.mustCheckSelectedPart();
		startY -= this.sectionProperties.marginY;
		// Pass over all comments present
		for (var i = startIndex; i > -1;) {
			var subList = [];
			tmpIdx = i;
			do {
				this.sectionProperties.commentList[tmpIdx].sectionProperties.data.anchorPix = this.numberArrayToCorePixFromTwips(this.sectionProperties.commentList[tmpIdx].sectionProperties.data.anchorPos, 0, 2);
				this.sectionProperties.commentList[tmpIdx].sectionProperties.data.anchorPix[1] -= this.documentTopLeft[1];
				// Add this item to the list of comments.
				if (this.sectionProperties.commentList[tmpIdx].sectionProperties.data.resolved !== 'true' || this.sectionProperties.showResolved) {
					if (!checkSelectedPart || app.map._docLayer._selectedPart === this.sectionProperties.commentList[tmpIdx].sectionProperties.partIndex)
						subList.push(this.sectionProperties.commentList[tmpIdx]);
				}
				tmpIdx = tmpIdx - 1;
				// Continue this loop, until we reach the last item, or an item which is not a direct descendant of the previous item.
			} while (tmpIdx > -1 && this.sectionProperties.commentList[tmpIdx].sectionProperties.data.parent === this.sectionProperties.commentList[tmpIdx + 1].sectionProperties.data.id);

			if (subList.length > 0) {
				startY = this.layoutUp(subList, [x, subList[0].sectionProperties.data.anchorPix[1]], startY, relayout);
				i = i - subList.length;
			} else {
				i = tmpIdx;
			}
			startY -= this.sectionProperties.marginY;
		}
		return startY;
	}

	private layoutDown (subList: any, actualPosition: Array<number>, lastY: number, relayout: boolean = true): number {
		var selectedComment = subList[0] === this.sectionProperties.selectedComment;
		for (var i = 0; i < subList.length; i++) {
			lastY = subList[i].sectionProperties.data.anchorPix[1] > lastY ? subList[i].sectionProperties.data.anchorPix[1]: lastY;

			var isRTL = document.documentElement.dir === 'rtl';

			if (selectedComment) {
				// FIXME: getBoundingClientRect is expensive and this is a hot path (called continuously during animations and scrolling)
				const posX = (this.sectionProperties.showSelectedBigger ?
								Math.round((document.getElementById('document-container').getBoundingClientRect().width - subList[i].sectionProperties.container.getBoundingClientRect().width)/2) :
								Math.round(actualPosition[0] / app.dpiScale) - this.sectionProperties.deflectionOfSelectedComment * (isRTL ? -1 : 1));
				(new L.PosAnimation()).run(subList[i].sectionProperties.container, {x: posX, y: Math.round(lastY / app.dpiScale)}, this.getAnimationDuration());
			}
			else
				(new L.PosAnimation()).run(subList[i].sectionProperties.container, {x: Math.round(actualPosition[0] / app.dpiScale), y: Math.round(lastY / app.dpiScale)}, this.getAnimationDuration());

			lastY += (subList[i].getCommentHeight(relayout) * app.dpiScale);
			if (!subList[i].isEdit())
				subList[i].show();
		}
		return lastY;
	}

	private loopDown (startIndex: number, x: number, startY: number, relayout: boolean = true): number {
		var tmpIdx = 0;
		var checkSelectedPart: boolean = this.mustCheckSelectedPart();
		// Pass over all comments present
		for (var i = startIndex; i < this.sectionProperties.commentList.length;) {
			var subList = [];
			tmpIdx = i;
			do {
				this.sectionProperties.commentList[tmpIdx].sectionProperties.data.anchorPix = this.numberArrayToCorePixFromTwips(this.sectionProperties.commentList[tmpIdx].sectionProperties.data.anchorPos, 0, 2);
				this.sectionProperties.commentList[tmpIdx].sectionProperties.data.anchorPix[1] -= this.documentTopLeft[1];
				// Add this item to the list of comments.
				if (this.sectionProperties.commentList[tmpIdx].sectionProperties.data.resolved !== 'true' || this.sectionProperties.showResolved) {
					if (!checkSelectedPart || app.map._docLayer._selectedPart === this.sectionProperties.commentList[tmpIdx].sectionProperties.partIndex)
						subList.push(this.sectionProperties.commentList[tmpIdx]);
				}
				tmpIdx = tmpIdx + 1;
				// Continue this loop, until we reach the last item, or an item which is not a direct descendant of the previous item.
			} while (tmpIdx < this.sectionProperties.commentList.length && this.sectionProperties.commentList[tmpIdx].sectionProperties.data.parent !== '0');

			if (subList.length > 0) {
				startY = this.layoutDown(subList, [x, subList[0].sectionProperties.data.anchorPix[1]], startY, relayout);
				i = i + subList.length;
			} else {
				i = tmpIdx;
			}
			startY += this.sectionProperties.marginY;
		}
		return startY;
	}

	public hideArrow (): void {
		if (this.sectionProperties.arrow) {
			document.getElementById('document-container').removeChild(this.sectionProperties.arrow);
			this.sectionProperties.arrow = null;
			app.sectionContainer.requestReDraw();
		}
	}

	private showArrow (startPoint: Array<number>, endPoint: Array<number>): void {
		var anchorSection = this.containerObject.getDocumentAnchorSection();
		startPoint[0] -= anchorSection.myTopLeft[0] + this.documentTopLeft[0];
		startPoint[1] -= anchorSection.myTopLeft[1] + this.documentTopLeft[1];
		endPoint[1] -= anchorSection.myTopLeft[1] + this.documentTopLeft[1];

		startPoint[0] = Math.floor(startPoint[0] / app.dpiScale);
		startPoint[1] = Math.floor(startPoint[1] / app.dpiScale);
		endPoint[0] = Math.floor(endPoint[0] / app.dpiScale);
		endPoint[1] = Math.floor(endPoint[1] / app.dpiScale);

		if (this.sectionProperties.arrow !== null) {
			var line: SVGLineElement = <SVGLineElement>(this.sectionProperties.arrow.firstElementChild);
			line.setAttribute('x1', String(startPoint[0]));
			line.setAttribute('y1', String(startPoint[1]));
			line.setAttribute('x2', String(endPoint[0]));
			line.setAttribute('y2', String(endPoint[1]));
		}
		else {
			var svg: SVGElement = (<any>document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
			svg.setAttribute('version', '1.1');
			svg.style.zIndex = '9';
			svg.id = 'comment-arrow-container';
			svg.style.position = 'absolute';
			svg.style.top = svg.style.left = svg.style.right = svg.style.bottom = '0';
			svg.setAttribute('width', String(this.context.canvas.width));
			svg.setAttribute('height', String(this.context.canvas.height));
			var line  = document.createElementNS('http://www.w3.org/2000/svg','line');
			line.id = 'comment-arrow-line';
			line.setAttribute('x1', String(startPoint[0]));
			line.setAttribute('y1', String(startPoint[1]));
			line.setAttribute('x2', String(endPoint[0]));
			line.setAttribute('y2', String(endPoint[1]));
			line.setAttribute('stroke', 'darkblue');
			line.setAttribute('stroke-width', '1');
			svg.appendChild(line);
			document.getElementById('document-container').appendChild(svg);
			this.sectionProperties.arrow = svg;
		}
	}

	private doLayout (relayout: boolean = true): void {
		if ((<any>window).mode.isMobile() || app.map._docLayer._docType === 'spreadsheet') {
			if (this.sectionProperties.commentList.length > 0)
				this.orderCommentList();
			return; // No adjustments for Calc, since only one comment can be shown at a time and that comment is shown at its belonging cell.
		}

		if (this.sectionProperties.commentList.length > 0) {
			this.orderCommentList();
			if (relayout)
				this.resetCommentsSize();

			var isRTL = document.documentElement.dir === 'rtl';

			var topRight: Array<number> = [this.myTopLeft[0], this.myTopLeft[1] + this.sectionProperties.marginY - this.documentTopLeft[1]];
			var yOrigin = null;
			var selectedIndex = null;
			var x = isRTL ? 0 : topRight[0];
			var availableSpace = this.calculateAvailableSpace();

			if (availableSpace > this.sectionProperties.commentWidth) {
				if (isRTL)
					x = Math.round((this.containerObject.getDocumentAnchorSection().size[0] - app.file.size.pX) * 0.5) - this.containerObject.getDocumentAnchorSection().size[0];
				else
					x = topRight[0] - Math.round((this.containerObject.getDocumentAnchorSection().size[0] - app.file.size.pX) * 0.5);
			} else if (isRTL)
				x = -this.containerObject.getDocumentAnchorSection().size[0];
			else
				x -= this.sectionProperties.collapsedMarginToTheEdge;

			if (this.sectionProperties.selectedComment) {
				selectedIndex = this.getRootIndexOf(this.sectionProperties.selectedComment.sectionProperties.data.id);
				this.sectionProperties.commentList[selectedIndex].sectionProperties.data.anchorPix = this.numberArrayToCorePixFromTwips(this.sectionProperties.commentList[selectedIndex].sectionProperties.data.anchorPos, 0, 2);
				this.sectionProperties.commentList[selectedIndex].sectionProperties.data.anchorPix[1];
				yOrigin = this.sectionProperties.commentList[selectedIndex].sectionProperties.data.anchorPix[1] - this.documentTopLeft[1];
				var tempCrd: Array<number> = this.sectionProperties.commentList[selectedIndex].sectionProperties.data.anchorPix;
				var resolved:string = this.sectionProperties.commentList[selectedIndex].sectionProperties.data.resolved;
				if (!resolved || resolved === 'false' || this.sectionProperties.showResolved) {
					var posX = isRTL ? (this.containerObject.getDocumentAnchorSection().size[0] + x + 15) : x;
					this.showArrow([tempCrd[0], tempCrd[1]], [posX, tempCrd[1]]);
				}
			}
			else
				this.hideArrow();

			var lastY = 0;
			if (selectedIndex) {
				this.loopUp(selectedIndex - 1, x, yOrigin, relayout);
				lastY = this.loopDown(selectedIndex, x, yOrigin, relayout);
			}
			else {
				lastY = this.loopDown(0, x, topRight[1], relayout);
			}
		}
		if (relayout)
			this.resizeComments();

		lastY += this.containerObject.getDocumentTopLeft()[1];
		if (lastY > app.file.size.pY) {
			app.view.size.pY = lastY;
			this.containerObject.requestReDraw();
		}
		else
			app.view.size.pY = app.file.size.pY;

		this.disableLayoutAnimation = false;
	}

	private layout (immediate: any = null, relayout: boolean = true): void {
		if (immediate)
			this.doLayout(relayout);
		else if (!this.sectionProperties.layoutTimer) {
			this.sectionProperties.layoutTimer = setTimeout(() => {
				delete this.sectionProperties.layoutTimer;
				this.doLayout(relayout);
			}, 10 /* ms */);
		} // else - avoid excessive re-layout
	}

	private update (immediate: boolean = false, relayout: boolean = true): void {
		if (relayout && app.map._docLayer._docType === 'text')
			this.updateThreadInfoIndicator();
		this.layout(immediate, relayout);
	}

	private updateThreadInfoIndicator(): void {
		for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
			var comment = this.sectionProperties.commentList[i];
			var replyCount = 0;
			var anyEdit = false;

			if (comment && comment.isRootComment()) {
				var lastIndex = this.getLastChildIndexOf(comment.sectionProperties.data.id);
				var j = i;
				while (this.sectionProperties.commentList[j] && j <= lastIndex) {
					anyEdit = this.sectionProperties.commentList[j].isEdit() || anyEdit;
					if (this.sectionProperties.commentList[j].sectionProperties.data.parent !== '0') {
						if ((this.sectionProperties.commentList[j].sectionProperties.data.layoutStatus !== CommentLayoutStatus.DELETED ||
							this.map['stateChangeHandler'].getItemValue('.uno:ShowTrackedChanges') === 'true') &&
							this.sectionProperties.commentList[j].sectionProperties.data.resolved !== 'true') {
							replyCount++;
						}
					}
					j++;
				}
			}
			if (anyEdit)
				comment.updateThreadInfoIndicator('!');
			else
				comment.updateThreadInfoIndicator(replyCount);
		}
	}

	private updateChildLines () : void {
		for (let i = 0; i < this.sectionProperties.commentList.length; i++) {
			this.sectionProperties.commentList[i].updateChildLines();
		}
	}

	// Returns the root comment index of given id
	private getRootIndexOf (id: any): number {
		var index = this.getIndexOf(id);

		while (index >= 0) {
			if (this.sectionProperties.commentList[index].sectionProperties.data.parent !== '0')
				index--;
			else
				break;
		}

		return index;
	}

	// Returns the sub-root comment index of given id
	private getSubRootIndexOf (id: any): number {
		var index = this.getIndexOf(id);

		if (index !== -1)
		{
			var comment = this.sectionProperties.commentList[index];
			var parentId = comment.sectionProperties.data.parent;

			while (index >= 0) {
				if (this.sectionProperties.commentList[index].sectionProperties.data.id !== parentId && this.sectionProperties.commentList[index].sectionProperties.data.parent !== '0')
					index--;
				else
					break;
			}
		}

		return index;
	}

	public setViewResolved (state: any): void {
		this.sectionProperties.showResolved = state;

		for (var idx = 0; idx < this.sectionProperties.commentList.length;idx++) {
			if (this.sectionProperties.commentList[idx].sectionProperties.data.resolved === 'true') {
				if (state==false) {
					if (this.sectionProperties.selectedComment == this.sectionProperties.commentList[idx]) {
						this.unselect();
					}
					this.sectionProperties.commentList[idx].hide();
				} else {
					this.sectionProperties.commentList[idx].show();
				}
			}
			this.sectionProperties.commentList[idx].update();
		}
		this.update();
	}

	public setView (state: any): void {
		this.sectionProperties.show = state;
		for (var idx = 0; idx < this.sectionProperties.commentList.length;idx++) {
			if (state == false)
				this.sectionProperties.commentList[idx].hide();
			else
				this.sectionProperties.commentList[idx].show();
		}
	}

	private orderCommentList (): void {
		this.sectionProperties.commentList.sort(function(a: any, b: any) {
			return Math.abs(a.sectionProperties.data.anchorPos[1]) - Math.abs(b.sectionProperties.data.anchorPos[1]) ||
				Math.abs(a.sectionProperties.data.anchorPos[0]) - Math.abs(b.sectionProperties.data.anchorPos[0]);
		});

		if (app.map._docLayer._docType === 'text')
			this.orderTextComments();

		// idIndexMap is now invalid, update it.
		this.updateIdIndexMap();
	}

	// reset theis size to default (100px text)
	private resetCommentsSize (): void {
		if (app.map._docLayer._docType === 'text') {
			for (var i = 0; i < this.sectionProperties.commentList.length;i++) {
				if (this.sectionProperties.commentList[i].sectionProperties.contentNode.style.display !== 'none') {
					const maxHeight = (this.sectionProperties.commentList[i] === this.sectionProperties.selectedComment) ?
						this.annotationMaxSize : this.annotationMinSize;
					this.sectionProperties.commentList[i].sectionProperties.contentNode.style.maxHeight = maxHeight + 'px';
				}
			}
		}
	}

	// grow comments size if they have more text, and there is enought space between other comments
	private resizeComments (): void {
		// Change it true, if comments are allowed to grow up direction.
		// Now it is disabled, because without constant indicator of the comments anchor, it can be confusing.
		var growUp = false;
		if (app.map._docLayer._docType === 'text') {
			const minMaxHeight = Number(getComputedStyle(document.documentElement).getPropertyValue('--annotation-min-size'));
			const maxMaxHeight = Number(getComputedStyle(document.documentElement).getPropertyValue('--annotation-max-size'));
			for (var i = 0; i < this.sectionProperties.commentList.length;i++) {
				// Only if ContentNode is displayed.
				if (this.sectionProperties.commentList[i].sectionProperties.contentNode.style.display !== 'none'
				&& !this.sectionProperties.commentList[i].isEdit()) {
					// act commentText height
					var actHeight = this.sectionProperties.commentList[i].sectionProperties.contentText.getBoundingClientRect().height;
					// if the comment is taller then minimal, we may want to make it taller
					if (actHeight > minMaxHeight) {
						// but we don't want to make it taller then the maximum
						if (actHeight > maxMaxHeight) {
							actHeight = maxMaxHeight;
						}
						// if _leaflet_pos are not calculated (undefined) then don't do it (leave the comment at default size)
						if (typeof this.sectionProperties.commentList[i].sectionProperties.container._leaflet_pos !== 'undefined'
							 && (i+1 >= this.sectionProperties.commentList.length
							 || typeof this.sectionProperties.commentList[i+1].sectionProperties.container._leaflet_pos !== 'undefined'))
						{
							// check if there is more space after this commit
							var maxSize = maxMaxHeight;
							if (i+1 < this.sectionProperties.commentList.length)
								// max size of text should be the space between comments - size of non text parts
								maxSize = this.sectionProperties.commentList[i+1].sectionProperties.container._leaflet_pos.y
									- this.sectionProperties.commentList[i].sectionProperties.container._leaflet_pos.y
									- this.sectionProperties.commentList[i].sectionProperties.author.getBoundingClientRect().height
									- 3 * this.sectionProperties.marginY //top/bottom of comment window + space between comments
									- 2; // not sure why

							if (maxSize > maxMaxHeight) {
								maxSize = maxMaxHeight;
							} else if (growUp && actHeight > maxSize) {
								// if more space needed as we have after the comment
								// check it there is any space before the comment
								var spaceBefore = this.sectionProperties.commentList[i].sectionProperties.container._leaflet_pos.y;
								if (i > 0) {
									spaceBefore -= this.sectionProperties.commentList[i-1].sectionProperties.container._leaflet_pos.y
										+ this.sectionProperties.commentList[i-1].getCommentHeight()
										+ this.sectionProperties.marginY;
								} else {
									spaceBefore += this.documentTopLeft[1];
								}
								// if there is more space
								if (spaceBefore > 0) {
									var moveUp = 0;
									if (actHeight - maxSize < spaceBefore) {
										// there is enought space, move up as much as we can;
										moveUp = actHeight - maxSize;
									} else {
										// there is not enought space
										moveUp = spaceBefore;
									}
									// move up
									var posX = this.sectionProperties.commentList[i].sectionProperties.container._leaflet_pos.x;
									var posY = this.sectionProperties.commentList[i].sectionProperties.container._leaflet_pos.y-moveUp;
									(new L.PosAnimation()).run(this.sectionProperties.commentList[i].sectionProperties.container, {x: Math.round(posX), y: Math.round(posY)}, this.getAnimationDuration());
									// increase comment height
									maxSize += moveUp;
								}
							}
							if (maxSize > minMaxHeight)
								this.sectionProperties.commentList[i].sectionProperties.contentNode.style.maxHeight = Math.round(maxSize) + 'px';
						}
					}
				}
			}
			this.updateChildLines();
		}
	}

	private updateIdIndexMap(): void {
		this.idIndexMap.clear();
		const commentList = this.sectionProperties.commentList;
		for (var idx = 0; idx < commentList.length; idx++) {
			const comment = commentList[idx];
			console.assert(comment.sectionProperties && comment.sectionProperties.data, 'no sectionProperties.data!');
			this.idIndexMap.set(comment.sectionProperties.data.id, idx);
		}
	}

	private turnIntoAList (commentList: any): any[] {
		var newArray;
		if (!Array.isArray(commentList)) {
			newArray = new Array(0);
			for (var prop in commentList) {
				if (Object.prototype.hasOwnProperty.call(commentList, prop)) {
					newArray.push(commentList[prop]);
				}
			}
		}
		else {
			newArray = commentList;
		}
		return newArray;
	}

	private addUpdateChildGroups() {
		var parentCommentList: Array<any> = [];
		for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
			var comment = this.sectionProperties.commentList[i];
			comment.sectionProperties.children = [];
			if (comment.sectionProperties.data.parent !== '0')
			{
				if (!parentCommentList.includes(comment.sectionProperties.data.parent))
					parentCommentList.push(comment.sectionProperties.data.parent);
			}
		}

		for (var i = 0; i < parentCommentList.length; i++) {
			var parentComment;
			for (var j = 0; j < this.sectionProperties.commentList.length; j++) {
				if (this.sectionProperties.commentList[j].sectionProperties.data.id === parentCommentList[i]) {
					parentComment = this.sectionProperties.commentList[j];
					break;
				}
			}

			if (parentComment) {
				for (var j = 0; j < this.sectionProperties.commentList.length; j++) {
					if (this.sectionProperties.commentList[j].sectionProperties.data.parent === parentCommentList[i])
						parentComment.sectionProperties.children.push(this.sectionProperties.commentList[j]);
				}
			}
			else
				console.warn('Couldn\'t find parent comment.');
		}
	}

	private addChildrenCommentsToList(comment: any, newOrder: Array<any>) {
		comment.sectionProperties.children.forEach(function(element: any) {
			newOrder.push(element);
			if (element.sectionProperties.children.length > 0)
				this.addChildrenCommentsToList(element, newOrder);
		}.bind(this));
	}

	private orderTextComments() {
		var newOrder = [];

		for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
			var comment = this.sectionProperties.commentList[i];

			if (comment.isRootComment()) {
				newOrder.push(comment);

				if (comment.sectionProperties.children.length > 0)
					this.addChildrenCommentsToList(comment, newOrder);
			}
		}

		this.sectionProperties.commentList = newOrder;
	}

	public importComments (commentList: any): void {
		this.disableLayoutAnimation = true;
		var comment;
		if (Comment.isAnyEdit()) {
			CommentSection.pendingImport = true;
			return;
		}

		CommentSection.importingComments = true;

		this.clearList();
		commentList = this.turnIntoAList(commentList);

		if (commentList.length > 0) {
			for (var i = 0; i < commentList.length; i++) {
				comment = commentList[i];

				this.adjustComment(comment);
				if (comment.author in this.map._viewInfoByUserName) {
					comment.avatar = this.map._viewInfoByUserName[comment.author].userextrainfo.avatar;
				}
				var commentSection = new cool.Comment(comment, {}, this);
				if (!this.containerObject.addSection(commentSection))
					continue;
				this.sectionProperties.commentList.push(commentSection);
				this.idIndexMap.set(commentSection.sectionProperties.data.id, i);
			}

			if (app.map._docLayer._docType === 'text')
				this.addUpdateChildGroups();

			this.orderCommentList();
			this.checkSize();
			this.update();
		}

		var show = this.map.stateChangeHandler.getItemValue('showannotations');
		this.setView(show === true || show === 'true');

		var showResolved = this.map.stateChangeHandler.getItemValue('ShowResolvedAnnotations');
		this.setViewResolved(showResolved === true || showResolved === 'true');

		if (app.map._docLayer._docType === 'spreadsheet')
			this.hideAllComments(); // Apply drawing orders.

		if ((app.map._docLayer._docType === 'presentation' || app.map._docLayer._docType === 'drawing'))
			this.showHideComments();

		CommentSection.importingComments = false;
	}

	// Accepts redlines/changes comments.
	public importChanges (changesList: any): void {
		var changeComment;
		this.clearChanges();
		changesList = this.turnIntoAList(changesList);

		if (changesList.length > 0) {
			for (var i = 0; i < changesList.length; i++) {
				changeComment = changesList[i];
				if (!this.adjustRedLine(changeComment))
					// something wrong in this redline, skip this one
					continue;

				if (changeComment.author in this.map._viewInfoByUserName) {
					changeComment.avatar = this.map._viewInfoByUserName[changeComment.author].userextrainfo.avatar;
				}
				var commentSection = new cool.Comment(changeComment, {}, this);
				if (!this.containerObject.addSection(commentSection))
					continue;
				this.sectionProperties.commentList.push(commentSection);
			}

			this.orderCommentList();
			this.checkSize();
			this.update();
		}

		if (app.map._docLayer._docType === 'spreadsheet')
			this.hideAllComments(); // Apply drawing orders.
	}

	// Remove redline comments.
	private clearChanges(): void {
		this.containerObject.pauseDrawing();
		for (var i: number = this.sectionProperties.commentList.length -1; i > -1; i--) {
			if (this.sectionProperties.commentList[i].sectionProperties.data.trackchange) {
				this.containerObject.removeSection(this.sectionProperties.commentList[i].name);
				this.sectionProperties.commentList.splice(i, 1);
			}
		}
		this.updateIdIndexMap();
		this.containerObject.resumeDrawing();

		this.sectionProperties.selectedComment = null;
		this.checkSize();
	}

	private clearAutoSaveStatus () {
		CommentSection.autoSavedComment = null;
		CommentSection.commentWasAutoAdded = false;
	}

	// Remove only text comments from the document (excluding change tracking comments)
	private clearList (): void {
		this.containerObject.pauseDrawing();
		for (var i: number = this.sectionProperties.commentList.length -1; i > -1; i--) {
			if (!this.sectionProperties.commentList[i].sectionProperties.data.trackchange) {
				this.containerObject.removeSection(this.sectionProperties.commentList[i].name);
				this.sectionProperties.commentList.splice(i, 1);
			}
		}
		this.updateIdIndexMap();
		this.containerObject.resumeDrawing();

		this.sectionProperties.selectedComment = null;
		this.checkSize();
		this.clearAutoSaveStatus();
	}

	public onCommentsDataUpdate(): void {
		for (var i: number = this.sectionProperties.commentList.length -1; i > -1; i--) {
			var comment = this.sectionProperties.commentList[i];
			if (!comment.valid && comment.sectionProperties.data.id !== 'new') {
				comment.sectionProperties.commentListSection.removeItem(comment.sectionProperties.data.id);
			}
			comment.onCommentDataUpdate();
		}
	}

	public rejectAllTrackedCommentChanges(): void {
		for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
			var comment = this.sectionProperties.commentList[i];
			if (comment.sectionProperties.data.layoutStatus === CommentLayoutStatus.DELETED) {
				comment.sectionProperties.data.layoutStatus = CommentLayoutStatus.VISIBLE;
				comment.sectionProperties.container.classList.remove('tracked-deleted-comment-show');
			}
		}
	}

	public hasAnyComments(): boolean {
		return this.containerObject.sections.some((x: any) => x.constructor.name == "Comment")
	}
}

}

app.definitions.CommentSection = cool.CommentSection;

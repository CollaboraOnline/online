/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

/* See CanvasSectionContainer.ts for explanations. */

L.Map.include({
	insertComment: function() {
		var avatar = undefined;
		var author = this.getViewName(this._docLayer._viewId);
		if (author in this._viewInfoByUserName) {
			avatar = this._viewInfoByUserName[author].userextrainfo.avatar;
		}
		this._docLayer.newAnnotation({
			text: '',
			textrange: '',
			author: author,
			dateTime: new Date().toDateString(),
			id: 'new', // 'new' only when added by us
			avatar: avatar
		});
	},

	showResolvedComments: function(on: any) {
		var unoCommand = '.uno:ShowResolvedAnnotations';
		this.sendUnoCommand(unoCommand);
		app.sectionContainer.getSectionWithName(L.CSections.CommentList.name).setViewResolved(on);
		this.uiManager.setSavedState('ShowResolved', on ? true : false);
	}
});


declare var L: any;
declare var app: any;
declare var $: any;
declare var _: any;

namespace cool {

export class CommentSection extends CanvasSectionObject {
	map: any;

	// To associate comment id with its index in commentList array.
	private idIndexMap: Map<any, number>;

	constructor () {
		super({
			name: L.CSections.CommentList.name,
			backgroundColor: app.sectionContainer.clearColor,
			borderColor: null,
			anchor: [],
			position: [0, 0],
			size: [0, 0],
			expand: 'bottom',
			showSection: true,
			processingOrder: L.CSections.CommentList.processingOrder,
			drawingOrder: L.CSections.CommentList.drawingOrder,
			zIndex: L.CSections.CommentList.zIndex,
			interactable: false,
			sectionProperties: {},
		});
		this.map = L.Map.THIS;
		this.anchor = ['top', 'right'];
		this.sectionProperties.docLayer = this.map._docLayer;
		this.sectionProperties.commentList = new Array(0);
		this.sectionProperties.selectedComment = null;
		this.sectionProperties.arrow = null;
		this.sectionProperties.showResolved = null;
		this.sectionProperties.marginY = 10 * app.dpiScale;
		this.sectionProperties.offset = 5 * app.dpiScale;
		this.sectionProperties.layoutTimer = null;
		this.sectionProperties.width = Math.round(1 * app.dpiScale); // Configurable variable.
		this.sectionProperties.scrollAnnotation = null; // For impress, when 1 or more comments exist.
		this.sectionProperties.commentWidth = 200 * 1.3; // CSS pixels.
		this.sectionProperties.collapsedMarginToTheEdge = (<any>window).mode.isTablet() ? 120: 70; // CSS pixels.
		this.sectionProperties.deflectionOfSelectedComment = 160; // CSS pixels.
		this.sectionProperties.calcCurrentComment = null; // We don't automatically show a Calc comment when cursor is on its cell. But we remember it to show if user presses Alt+C keys.
		// This (commentsAreListed) variable means that comments are shown as a list on the right side of the document.
		this.sectionProperties.commentsAreListed = (this.sectionProperties.docLayer._docType === 'text' || this.sectionProperties.docLayer._docType === 'presentation' || this.sectionProperties.docLayer._docType === 'drawing') && !(<any>window).mode.isMobile();
		this.idIndexMap = new Map<any, number>();
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
		}, this);

		this.map.on('zoomend', function() {
			this.checkCollapseState();
			this.layout(true);
		}, this);

		this.backgroundColor = this.containerObject.getClearColor();
		this.initializeContextMenus();

		if ((<any>window).mode.isMobile()) {
			this.showSection = false;
			this.size[0] = 0;
		}

		// For setting some css styles.
		if (app.file.fileBasedView && (<any>window).mode.isMobile()) {
			this.map.uiManager.mobileWizard._hideSlideSorter();
		}
	}

	private checkCollapseState(): void {
		if (!(<any>window).mode.isMobile() && this.sectionProperties.docLayer._docType !== 'spreadsheet') {
			if (this.shouldCollapse()) {
				this.sectionProperties.deflectionOfSelectedComment = 180;
				this.setCollapsed();
			}
			else {
				this.sectionProperties.deflectionOfSelectedComment = 70;
				this.setExpanded();
			}

			if (this.sectionProperties.docLayer._docType === 'presentation' || this.sectionProperties.docLayer._docType === 'drawing')
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
		var index = this.findNextPartWithComment(this.sectionProperties.docLayer._selectedPart);
		if (index >= 0) {
			this.map.setPart(index);
		}
	}

	public onAnnotationScrollUp (): void {
		var index = this.findPreviousPartWithComment(this.sectionProperties.docLayer._selectedPart);
		if (index >= 0) {
			this.map.setPart(index);
		}
	}

	private checkSize (): void {
		// When there is no comment || file is a spreadsheet || view type is mobile, we set this section's size to [0, 0].
		if (this.sectionProperties.docLayer._docType === 'spreadsheet' || (<any>window).mode.isMobile() || this.sectionProperties.commentList.length === 0)
		{
			if (this.sectionProperties.docLayer._docType === 'presentation' && this.sectionProperties.scrollAnnotation) {
				this.map.removeControl(this.sectionProperties.scrollAnnotation);
				this.sectionProperties.scrollAnnotation = null;
			}
		}
		else if (this.sectionProperties.docLayer._docType === 'presentation') { // If there are comments but none of them are on the selected part.
			if (!this.sectionProperties.scrollAnnotation) {
				this.sectionProperties.scrollAnnotation = L.control.scrollannotation();
				this.sectionProperties.scrollAnnotation.addTo(this.map);
			}
		}
	}

	public setCollapsed(): void {
		this.isCollapsed = true;
		this.unselect();
		for (var i: number = 0; i < this.sectionProperties.commentList.length; i++) {
			if (this.sectionProperties.commentList[i].sectionProperties.data.id !== 'new')
				this.sectionProperties.commentList[i].setCollapsed();
		}
	}

	public setExpanded(): void {
		this.isCollapsed = false;
		for (var i: number = 0; i < this.sectionProperties.commentList.length; i++) {
			this.sectionProperties.commentList[i].setExpanded();
		}
	}

	private calculateAvailableSpace() {
		var availableSpace = (this.containerObject.getDocumentAnchorSection().size[0] - app.file.size.pixels[0]) * 0.5;
		availableSpace = Math.round(availableSpace / app.dpiScale);
		return availableSpace;
	}

	public shouldCollapse (): boolean {
		if (!this.containerObject.getDocumentAnchorSection() || this.sectionProperties.docLayer._docType === 'spreadsheet' || (<any>window).mode.isMobile())
			return false;

		return this.calculateAvailableSpace() < this.sectionProperties.commentWidth;
	}

	public hideAllComments (): void {
		for (var i: number = 0; i < this.sectionProperties.commentList.length; i++) {
			this.sectionProperties.commentList[i].hide();
			var part = this.sectionProperties.docLayer._selectedPart;
			if (this.sectionProperties.docLayer._docType === 'spreadsheet') {
				// Change drawing order so they don't prevent each other from being shown.
				if (parseInt(this.sectionProperties.commentList[i].sectionProperties.data.tab) === part) {
					this.sectionProperties.commentList[i].drawingOrder = 2;
				}
				else {
					this.sectionProperties.commentList[i].drawingOrder = 1;
				}
			}
		}
		this.containerObject.applyDrawingOrders();
	}

	private createCommentStructureWriter (menuStructure: any, threadOnly: any): void {
		var rootComment, lastChild, comment;
		var commentList = this.sectionProperties.commentList;
		var showResolved = this.sectionProperties.showResolved;

		if (threadOnly) {
			if (!threadOnly.sectionProperties.data.trackchange && threadOnly.sectionProperties.data.parent !== '0')
				threadOnly = commentList[this.getIndexOf(threadOnly.sectionProperties.data.parent)];
		}

		for (var i = 0; i < commentList.length; i++) {
			if (commentList[i].sectionProperties.data.parent === '0' || commentList[i].sectionProperties.data.trackchange) {
				lastChild = this.getLastChildIndexOf(commentList[i].sectionProperties.data.id);
				var commentThread = [];
				while (true) {
					comment = {
						id: 'comment' + commentList[lastChild].sectionProperties.data.id,
						enable: true,
						data: commentList[lastChild].sectionProperties.data,
						type: 'comment',
						text: commentList[lastChild].sectionProperties.data.text,
						annotation: commentList[lastChild],
						children: []
					};

					if (showResolved || comment.data.resolved !== 'true') {
						commentThread.unshift(comment);
					}

					if (commentList[lastChild].sectionProperties.data.parent === '0' || commentList[lastChild].sectionProperties.data.trackchange)
						break;

					lastChild = this.getIndexOf(commentList[lastChild].sectionProperties.data.parent);
				}

				if (commentThread.length > 0)
				{
					rootComment = {
						id: commentThread[0].id,
						enable: true,
						data: commentThread[0].data,
						type: 'rootcomment',
						text: commentThread[0].data.text,
						annotation: commentThread[0].annotation,
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
			if (matchingThread && (this.sectionProperties.commentList[i].sectionProperties.partIndex === this.sectionProperties.docLayer._selectedPart || app.file.fileBasedView)) {
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
		var selectedTab = this.sectionProperties.docLayer._selectedPart;

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
		if (this.sectionProperties.docLayer._docType === 'text') {
			this.createCommentStructureWriter(menuStructure, threadOnly);
		}
		else if (this.sectionProperties.docLayer._docType === 'presentation' || this.sectionProperties.docLayer._docType === 'drawing') {
			this.createCommentStructureImpress(menuStructure, threadOnly);
		}
		else if (this.sectionProperties.docLayer._docType === 'spreadsheet') {
			this.createCommentStructureCalc(menuStructure, threadOnly);
		}
	}

	public newAnnotationMobile (comment: any, addCommentFn: any, isMod: any): void {
		var commentData = comment.sectionProperties.data;

		var callback = function(data: string) {
			if (data) {
				var annotation = comment;

				annotation.sectionProperties.data.text = data;
				comment.text = data;

				addCommentFn.call(annotation, annotation, comment);
				if (!isMod)
					this.containerObject.removeSection(annotation);
			}
			else {
				this.cancel(comment);
			}
		}.bind(this);

		var id = 'new-annotation-dialog';
		var dialogId = this.map.uiManager.generateModalId(id);
		var json = this.map.uiManager._modalDialogJSON(id, '', true, [
			{
				id: 'input-modal-input',
				type: 'multilineedit',
				text: (commentData.text && isMod ? commentData.text: '')
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
			this.map.uiManager.closeModal(dialogId);
		}.bind(this);

		this.map.uiManager.showModal(json, [
			{id: 'response-ok', func: function() {
				if (typeof callback === 'function') {
					var input = document.getElementById('input-modal-input') as HTMLTextAreaElement;
					callback(input.value);
				}
				this.map.uiManager.closeModal(dialogId);
			}.bind(this)},
			{id: 'response-cancel', func: cancelFunction},
			{id: '__POPOVER__', func: cancelFunction},
			{id: '__DIALOG__', func: cancelFunction}
		]);

		var tagTd = 'td',
		empty = '',
		tagDiv = 'div';
		var author = L.DomUtil.create('table', 'cool-annotation-table');
		var tbody = L.DomUtil.create('tbody', empty, author);
		var tr = L.DomUtil.create('tr', empty, tbody);
		var tdImg = L.DomUtil.create(tagTd, 'cool-annotation-img', tr);
		var tdAuthor = L.DomUtil.create(tagTd, 'cool-annotation-author', tr);
		var imgAuthor = L.DomUtil.create('img', 'avatar-img', tdImg);
		L.LOUtil.setImage(imgAuthor, 'user.svg', this.sectionProperties.docLayer._docType);
		imgAuthor.setAttribute('width', 32);
		imgAuthor.setAttribute('height', 32);
		var authorAvatarImg = imgAuthor;
		var contentAuthor = L.DomUtil.create(tagDiv, 'cool-annotation-content-author', tdAuthor);
		var contentDate = L.DomUtil.create(tagDiv, 'cool-annotation-date', tdAuthor);

		$(contentAuthor).text(commentData.author);
		$(authorAvatarImg).attr('src', commentData.avatar);
		var user = this.map.getViewId(commentData.author);
		if (user >= 0) {
			var color = L.LOUtil.rgbToHex(this.map.getViewColor(user));
			$(authorAvatarImg).css('border-color', color);
		}

		if (commentData.dateTime) {
			var d = new Date(commentData.dateTime.replace(/,.*/, 'Z'));
			var dateOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
			$(contentDate).text(isNaN(d.getTime()) ? comment.dateTime: d.toLocaleDateString((<any>String).locale, <any>dateOptions));
		}

		var parent = document.getElementById('new-annotation-dialog').parentElement;
		parent.insertBefore(author, parent.childNodes[0]);
		document.getElementById('input-modal-input').focus();
	}

	public hightlightComment (comment: any): void {
		this.removeHighlighters();

		var commentList = this.sectionProperties.commentList;

		var lastChild: any = this.getLastChildIndexOf(comment.sectionProperties.data.id);

		while (true && lastChild >= 0) {
			commentList[lastChild].highlight();

			if (commentList[lastChild].sectionProperties.data.parent === '0')
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
				Text: {
					type: 'string',
					value: annotation.sectionProperties.data.text
				},
				Author: {
					type: 'string',
					value: annotation.sectionProperties.data.author
				}
			};
			if (app.file.fileBasedView) {
				this.map.setPart(this.sectionProperties.docLayer._selectedPart, false);
				this.map.sendUnoCommand('.uno:InsertAnnotation', comment, true /* force */);
				this.map.setPart(0, false);
			}
			else {
				this.map.sendUnoCommand('.uno:InsertAnnotation', comment, true /* force */);
			}

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
				Text: {
					type: 'string',
					value: annotation.sectionProperties.data.text
				}
			};
			this.map.sendUnoCommand('.uno:EditAnnotation', comment, true /* force */);
		}
		this.unselect();
		this.map.focus();
	}

	public reply (annotation: any): void {
		if ((<any>window).mode.isMobile()) {
			var avatar = undefined;
			var author = this.map.getViewName(this.sectionProperties.docLayer._viewId);
			if (author in this.map._viewInfoByUserName) {
				avatar = this.map._viewInfoByUserName[author].userextrainfo.avatar;
			}

			if (this.sectionProperties.docLayer._docType === 'presentation' || this.sectionProperties.docLayer._docType === 'drawing') {
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
			this.unselect();
			annotation.reply();
			this.select(annotation);
			annotation.focus();
		}
	}

	public modify (annotation: any): void {
		if ((<any>window).mode.isMobile()) {
			this.newAnnotationMobile(annotation, function(annotation: any) {
				this.save(annotation);
			}.bind(this), /* isMod */ true);
		}
		else {
			if (this.sectionProperties.docLayer._docType !== 'spreadsheet' && this.sectionProperties.selectedComment !== annotation) {
				this.unselect();
				this.select(annotation);
			}

			// Make sure that comment is not transitioning and comment menu is not open.
			var tempFunction = function() {
				setTimeout(function() {
					if (String(annotation.sectionProperties.container.dataset.transitioning) === 'true' || annotation.sectionProperties.contextMenu === true) {
						tempFunction();
					}
					else {
						annotation.edit();
						this.select(annotation);
						annotation.focus();
					}
				}.bind(this), 1);
			}.bind(this);
			tempFunction();
		}
	}

	private showCollapsedReplies(rootIndex: number, rootId: number) {
		var lastChild = this.getLastChildIndexOf(rootId);

		for (var i = lastChild; i > rootIndex; i--) {
			this.sectionProperties.commentList[i].sectionProperties.container.style.display = '';
			this.sectionProperties.commentList[i].sectionProperties.container.style.visibility = '';
		}
	}

	private collapseReplies(rootIndex: number, rootId: number) {
		var lastChild = this.getLastChildIndexOf(rootId);

		for (var i = lastChild; i > rootIndex; i--)
			this.sectionProperties.commentList[i].sectionProperties.container.style.display = 'none';
	}

	public select (annotation: any): void {
		if (annotation && annotation !== this.sectionProperties.selectedComment) {
			// Unselect first if there anything selected.
			if (this.sectionProperties.selectedComment)
				this.unselect();

			// Select the root comment
			var idx = this.getRootIndexOf(annotation.sectionProperties.data.id);

			if (this.sectionProperties.selectedComment && $(this.sectionProperties.selectedComment.sectionProperties.container).hasClass('annotation-active'))
				$(this.sectionProperties.selectedComment.sectionProperties.container).removeClass('annotation-active');

			this.sectionProperties.selectedComment = this.sectionProperties.commentList[idx];

			if (this.sectionProperties.selectedComment && !$(this.sectionProperties.selectedComment.sectionProperties.container).hasClass('annotation-active')) {
				$(this.sectionProperties.selectedComment.sectionProperties.container).addClass('annotation-active');
				if (this.sectionProperties.docLayer._docType === 'text') {
					// check it is visible in the screen and not a new comment
					const id = this.sectionProperties.selectedComment.sectionProperties.data.id;
					const position = this.sectionProperties.selectedComment.getPosition();
					if (id.indexOf('new') < 0 && !this.isInViewPort(this.sectionProperties.selectedComment) && position[1] !== 0) {
						this.map.scrollTop(position[1] < 0 ? 0 : position[1]);
					}
				}
			}

			if (this.isCollapsed) {
				this.showCollapsedReplies(idx, annotation.sectionProperties.data.id);
				if (this.sectionProperties.docLayer._docType === 'text')
					this.sectionProperties.selectedComment.sectionProperties.replyCountNode.style.display = 'none';
			}

			this.update();
		}
	}

	private isInViewPort(annotation: any): boolean {
		const rect = annotation.sectionProperties.container.getBoundingClientRect();
		const scrollSection = app.sectionContainer.getSectionWithName(L.CSections.Scroll.name);
		const screenTop = scrollSection.containerObject.getDocumentTopLeft()[1];
		const screenBottom = screenTop + (window.innerHeight || document.documentElement.clientHeight);
		const position = annotation.getPosition();
		const annotationTop = position[1];
		const annotationBottom = position[1] + rect.bottom - rect.top;

		return (
			screenTop <= annotationTop &&
			screenBottom >= annotationBottom
		);
	}

	public unselect (): void {
		if (this.sectionProperties.selectedComment) {
			if (this.sectionProperties.selectedComment && $(this.sectionProperties.selectedComment.sectionProperties.container).hasClass('annotation-active'))
				$(this.sectionProperties.selectedComment.sectionProperties.container).removeClass('annotation-active');

			if (this.sectionProperties.docLayer._docType === 'spreadsheet')
				this.sectionProperties.selectedComment.hide();

			if (this.sectionProperties.commentsAreListed && this.isCollapsed) {
				this.sectionProperties.selectedComment.setCollapsed();
				this.collapseReplies(this.getRootIndexOf(this.sectionProperties.selectedComment.sectionProperties.data.id), this.sectionProperties.selectedComment.sectionProperties.data.id);
			}
			this.sectionProperties.selectedComment = null;

			this.update();
		}
	}

	public saveReply (annotation: any): void {
		var comment = {
			Id: {
				type: 'string',
				value: annotation.sectionProperties.data.id
			},
			Text: {
				type: 'string',
				value: annotation.sectionProperties.data.reply
			}
		};

		if (this.sectionProperties.docLayer._docType === 'text' || this.sectionProperties.docLayer._docType === 'spreadsheet')
			this.map.sendUnoCommand('.uno:ReplyComment', comment);
		else if (this.sectionProperties.docLayer._docType === 'presentation')
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

		if (app.file.fileBasedView) // We have to set the part from which the comment will be removed as selected part before the process.
			this.map.setPart(this.sectionProperties.docLayer._selectedPart, false);

		if (this.sectionProperties.docLayer._docType === 'text')
			this.map.sendUnoCommand('.uno:DeleteComment', comment);
		else if (this.sectionProperties.docLayer._docType === 'presentation' || this.sectionProperties.docLayer._docType === 'drawing')
			this.map.sendUnoCommand('.uno:DeleteAnnotation', comment);
		else if (this.sectionProperties.docLayer._docType === 'spreadsheet')
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

	public getIndexOf (id: any): number {
		const index = this.idIndexMap.get(id);
		return (index === undefined) ? -1 : index;
	}

	public isThreadResolved (annotation: any): boolean {
		var lastChild = this.getLastChildIndexOf(annotation.sectionProperties.data.id);

		while (this.sectionProperties.commentList[lastChild].sectionProperties.data.parent !== '0') {
			if (this.sectionProperties.commentList[lastChild].sectionProperties.data.resolved === 'false')
				return false;
			lastChild = this.getIndexOf(this.sectionProperties.commentList[lastChild].sectionProperties.data.parent);
		}
		if (this.sectionProperties.commentList[lastChild].sectionProperties.data.resolved === 'false')
			return false;
		return true;
	}

	private initializeContextMenus (): void {
		var docLayer = this.sectionProperties.docLayer;
		L.installContextMenu({
			selector: '.cool-annotation-menu',
			trigger: 'none',
			className: 'cool-font',
			build: function ($trigger: any) {
				return {
					autoHide: true,
					items: {
						modify: {
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
						remove: {
							name: _('Remove'),
							callback: function (key: any, options: any) {
								this.remove.call(this, options.$trigger[0].annotation.sectionProperties.data.id);
							}.bind(this)
						},
						removeThread: docLayer._docType !== 'text' || $trigger[0].isRoot === true ? undefined : {
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
						resolveThread: docLayer._docType !== 'text' || $trigger[0].isRoot === true ? undefined : {
							name: this.isThreadResolved($trigger[0].annotation) ? _('Unresolve Thread') : _('Resolve Thread'),
							callback: function (key: any, options: any) {
								this.resolveThread.call(this, options.$trigger[0].annotation);
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
		if (this.sectionProperties.docLayer._docType === 'spreadsheet') {
			if (this.sectionProperties.selectedComment)
				this.sectionProperties.selectedComment.hide();
		}

		this.update();
	}

	private showHideComments (): void {
		for (var i: number = 0; i < this.sectionProperties.commentList.length; i++) {
			this.showHideComment(this.sectionProperties.commentList[i]);
		}
	}

	public showHideComment (annotation: any): void {
		// This manually shows/hides comments
		if (!this.sectionProperties.showResolved && this.sectionProperties.docLayer._docType === 'text') {
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
		else if (this.sectionProperties.docLayer._docType === 'presentation' || this.sectionProperties.docLayer._docType === 'drawing') {
			if (annotation.sectionProperties.partIndex === this.sectionProperties.docLayer._selectedPart || app.file.fileBasedView) {
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

	public add (comment: any, mobileReply: boolean = false): cool.Comment {
		var annotation = new cool.Comment(comment, comment.id === 'new' ? {noMenu: true} : {}, this);
		if (mobileReply)
			annotation.name += '-reply'; // Section name.

		if (comment.parent && comment.parent > '0') {
			var parentIdx = this.getIndexOf(comment.parent);

			if (!this.containerObject.addSection(annotation))
				return;
			this.sectionProperties.commentList.splice(parentIdx + 1, 0, annotation);
			this.updateIdIndexMap();

			this.updateResolvedState(annotation);
			this.showHideComment(annotation);
		}
		else {
			if (!this.containerObject.addSection(annotation))
				return;
			this.sectionProperties.commentList.push(annotation);
		}

		this.orderCommentList();
		this.checkSize();

		if (this.isCollapsed && comment.id !== 'new')
			annotation.setCollapsed();

		// check if we are the author
		// then select it so it does not get lost in a long list of comments and replies.
		const authorName = this.map.getViewName(this.sectionProperties.docLayer._viewId);
		const newComment = annotation.sectionProperties.data.id === 'new';
		if (!newComment && (authorName === annotation.sectionProperties.data.author)) {
			this.unselect();
			this.select(annotation);
		}

		return annotation;
	}

	public adjustRedLine (redline: any): boolean {
		// All sane values ?
		if (!redline.textRange) {
			console.warn('Redline received has invalid textRange');
			return false;
		}

		// transform change tracking index into an id
		redline.id = 'change-' + redline.index;
		redline.anchorPos = this.stringToRectangles(redline.textRange)[0];
		redline.anchorPix = this.numberArrayToCorePixFromTwips(redline.anchorPos, 0, 2);
		redline.trackchange = true;
		redline.text = redline.comment;
		var rectangles = L.PolyUtil.rectanglesToPolygons(L.LOUtil.stringToRectangles(redline.textRange), this.sectionProperties.docLayer);
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

	// Adjust parent-child relationship, if required, after `comment` is added
	public adjustParentAdd (comment: any): void {
		if (comment.parent && comment.parent > '0') {
			var parentIdx = this.getIndexOf(comment.parent);
			if (parentIdx === -1) {
				console.warn('adjustParentAdd: No parent comment to attach received comment to. ' +
				             'Parent comment ID sought is :' + comment.parent + ' for current comment with ID : ' + comment.id);
				return;
			}
			if (this.sectionProperties.commentList[parentIdx + 1] && this.sectionProperties.commentList[parentIdx + 1].sectionProperties.data.parent === this.sectionProperties.commentList[parentIdx].sectionProperties.data.id) {
				this.sectionProperties.commentList[parentIdx + 1].sectionProperties.data.parent = comment.id;
			}
		}
	}

	// Adjust parent-child relationship, if required, after `comment` is removed
	public adjustParentRemove (comment: any): void {
		var newId = '0';
		var parentIdx = this.getIndexOf(comment.sectionProperties.data.parent);
		if (parentIdx >= 0) {
			newId = this.sectionProperties.commentList[parentIdx].sectionProperties.data.id;
		}
		var currentIdx = this.getIndexOf(comment.sectionProperties.data.id);
		if (this.sectionProperties.commentList[currentIdx + 1] && this.sectionProperties.commentList[currentIdx].parentOf(this.sectionProperties.commentList[currentIdx + 1])) {
			this.sectionProperties.commentList[currentIdx + 1].sectionProperties.data.parent = newId;
		}
	}

	public onACKComment (obj: any): void {
		var id;
		var changetrack = obj.redline ? true : false;
		var dataroot = changetrack ? 'redline' : 'comment';
		if (changetrack) {
			obj.redline.id = 'change-' + obj.redline.index;
		}
		var action = changetrack ? obj.redline.action : obj.comment.action;

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
				this.adjustComment(obj.comment);
				this.adjustParentAdd(obj.comment);
				this.add(obj.comment);
			}
			if (this.sectionProperties.selectedComment && !this.sectionProperties.selectedComment.isEdit()) {
				this.map.focus();
			}
			annotation = this.sectionProperties.commentList[this.getRootIndexOf(obj[dataroot].id)];
		} else if (action === 'Remove') {
			if ((<any>window).mode.isMobile() && obj[dataroot].id === annotation.sectionProperties.data.id) {
				var child = this.sectionProperties.commentList[this.getIndexOf(obj[dataroot].id) + 1];
				if (child && child.sectionProperties.data.parent === annotation.sectionProperties.data.id)
					annotation = child;
				else
					annotation = undefined;
			}
			id = obj[dataroot].id;
			var removed = this.getComment(id);
			if (removed) {
				this.adjustParentRemove(removed);
				this.removeItem(id);
				if (this.sectionProperties.selectedComment === removed) {
					this.unselect();
				}
				else {
					this.update();
				}
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
				modified.setData(modifiedObj);
				modified.update();
				this.update();
			}
		} else if (action === 'Resolve') {
			id = obj[dataroot].id;
			var resolved = this.getComment(id);
			if (resolved) {
				var parent = this.sectionProperties.commentList[this.getRootIndexOf(resolved.sectionProperties.data.id)];
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
			var wePerformedAction = obj.comment.author === this.map.getViewName(this.sectionProperties.docLayer._viewId);

			if ((<any>window).commentWizard || (action === 'Add' && wePerformedAction))
				shouldOpenWizard = true;

			if (shouldOpenWizard) {
				this.sectionProperties.docLayer._openCommentWizard(annotation);
			}
		}
	}

	public selectById (commentId: any): void {
		var idx = this.getRootIndexOf(commentId);
		var annotation = this.sectionProperties.commentList[idx];
		this.select(annotation);
	}

	public stringToRectangles (str: string): number[][] {
		var matches = str.match(/\d+/g);
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
		var partHeightTwips = this.sectionProperties.docLayer._partHeightTwips + this.sectionProperties.docLayer._spaceBetweenParts;
		var index = this.sectionProperties.docLayer._partHashes.indexOf(String(comment.parthash));
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
		var color = viewId >= 0 ? L.LOUtil.rgbToHex(this.map.getViewColor(viewId)) : '#43ACE8';
		comment.color = color;
	}

	// Normally, a comment's position information is the same with the desktop version.
	// So we can use it directly.
	private adjustCommentNormal (comment: any): void {
		comment.trackchange = false;
		comment.rectangles = this.stringToRectangles(comment.textRange || comment.anchorPos || comment.rectangle || comment.cellPos); // Simple array of point arrays [x1, y1, x2, y2].
		comment.rectanglesOriginal = this.stringToRectangles(comment.textRange || comment.anchorPos || comment.rectangle || comment.cellPos); // This unmodified version will be kept for re-calculations.
		comment.anchorPos = this.stringToRectangles(comment.anchorPos || comment.rectangle || comment.cellPos)[0];
		comment.anchorPix = this.numberArrayToCorePixFromTwips(comment.anchorPos, 0, 2);
		comment.parthash = comment.parthash ? comment.parthash: null;
		comment.tab = (comment.tab || comment.tab === 0) ? comment.tab: null;

		if (comment.rectangle) {
			comment.rectangle = this.stringToRectangles(comment.rectangle)[0]; // This is the position of the marker (Impress & Draw).
		}
		else if (comment.cellPos) {
			comment.cellPos = this.stringToRectangles(comment.cellPos)[0]; // Calc.
		}

		var viewId = this.map.getViewId(comment.author);
		var color = viewId >= 0 ? L.LOUtil.rgbToHex(this.map.getViewColor(viewId)) : '#43ACE8';
		comment.color = color;
	}

	private adjustComment (comment: any): void {
		if (!app.file.fileBasedView)
			this.adjustCommentNormal(comment);
		else
			this.adjustCommentFileBasedView(comment);
	}

	private getScaleFactor (): number {
		var scaleFactor = 1.0 / this.map.getZoomScale(this.map.options.zoom, this.map.getZoom());
		if (scaleFactor < 0.4)
			scaleFactor = 0.4;
		else if (scaleFactor < 0.6)
			scaleFactor = 0.6 - (0.6 - scaleFactor) / 2.0;
		else if (scaleFactor < 0.8)
			scaleFactor = 0.8;
		else if (scaleFactor <= 2)
			scaleFactor = 1;
		else if (scaleFactor > 2) {
			scaleFactor = 1 + (scaleFactor - 1) / 10.0;
			if (scaleFactor > 1.5)
				scaleFactor = 1.5;
		}
		return scaleFactor;
	}

	// Returns the last comment id of comment thread containing the given id
	private getLastChildIndexOf (id: any): number {
		var index = this.getIndexOf(id);
		if (index < 0)
			return undefined;
		for (var idx = index + 1;
		     idx < this.sectionProperties.commentList.length && this.sectionProperties.commentList[idx].sectionProperties.data.parent === this.sectionProperties.commentList[idx - 1].sectionProperties.data.id;
		     idx++)
		{
			index = idx;
		}

		return index;
	}

	// If the file type is presentation or drawing then we shall check the selected part in order to hide comments from other parts.
	// But if file is in fileBasedView, then we will not hide any comments from not-selected/viewed parts.
	private mustCheckSelectedPart (): boolean {
		return (this.sectionProperties.docLayer._docType === 'presentation' || this.sectionProperties.docLayer._docType === 'drawing') && !app.file.fileBasedView;
	}

	private layoutUp (subList: any, actualPosition: Array<number>, lastY: number): number {
		var height: number;
		for (var i = 0; i < subList.length; i++) {
			height = subList[i].sectionProperties.container.getBoundingClientRect().height;
			lastY = subList[i].sectionProperties.data.anchorPix[1] + height < lastY ? subList[i].sectionProperties.data.anchorPix[1]: lastY - height;
			(new L.PosAnimation()).run(subList[i].sectionProperties.container, {x: Math.round(actualPosition[0] / app.dpiScale), y: Math.round(lastY / app.dpiScale)});
			subList[i].show();
		}
		return lastY;
	}

	private loopUp (startIndex: number, x: number, startY: number): number {
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
					if (!checkSelectedPart || this.sectionProperties.docLayer._selectedPart === this.sectionProperties.commentList[tmpIdx].sectionProperties.partIndex)
						subList.push(this.sectionProperties.commentList[tmpIdx]);
				}
				tmpIdx = tmpIdx - 1;
				// Continue this loop, until we reach the last item, or an item which is not a direct descendant of the previous item.
			} while (tmpIdx > -1 && this.sectionProperties.commentList[tmpIdx].sectionProperties.data.parent === this.sectionProperties.commentList[tmpIdx + 1].sectionProperties.data.id);

			if (subList.length > 0) {
				startY = this.layoutUp(subList, [x, subList[0].sectionProperties.data.anchorPix[1]], startY);
				i = i - subList.length;
			} else {
				i = tmpIdx;
			}
			startY -= this.sectionProperties.marginY;
		}
		return startY;
	}

	private layoutDown (subList: any, actualPosition: Array<number>, lastY: number): number {
		var selectedComment = subList[0] === this.sectionProperties.selectedComment;
		for (var i = 0; i < subList.length; i++) {
			lastY = subList[i].sectionProperties.data.anchorPix[1] > lastY ? subList[i].sectionProperties.data.anchorPix[1]: lastY;

			var isRTL = document.documentElement.dir === 'rtl';

			if (selectedComment)
				(new L.PosAnimation()).run(subList[i].sectionProperties.container, {x: Math.round(actualPosition[0] / app.dpiScale) - this.sectionProperties.deflectionOfSelectedComment * (isRTL ? -1 : 1), y: Math.round(lastY / app.dpiScale)});
			else
				(new L.PosAnimation()).run(subList[i].sectionProperties.container, {x: Math.round(actualPosition[0] / app.dpiScale), y: Math.round(lastY / app.dpiScale)});

			lastY += (subList[i].sectionProperties.container.getBoundingClientRect().height * app.dpiScale);
			if (!subList[i].isEdit())
				subList[i].show();
		}
		return lastY;
	}

	private loopDown (startIndex: number, x: number, startY: number): number {
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
					if (!checkSelectedPart || this.sectionProperties.docLayer._selectedPart === this.sectionProperties.commentList[tmpIdx].sectionProperties.partIndex)
						subList.push(this.sectionProperties.commentList[tmpIdx]);
				}
				tmpIdx = tmpIdx + 1;
				// Continue this loop, until we reach the last item, or an item which is not a direct descendant of the previous item.
			} while (tmpIdx < this.sectionProperties.commentList.length && this.sectionProperties.commentList[tmpIdx].sectionProperties.data.parent === this.sectionProperties.commentList[tmpIdx - 1].sectionProperties.data.id);

			if (subList.length > 0) {
				startY = this.layoutDown(subList, [x, subList[0].sectionProperties.data.anchorPix[1]], startY);
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
			var line: SVGLineElement = <SVGLineElement>(<any>document.getElementById('comment-arrow-line'));
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

	private doLayout (): void {
		if ((<any>window).mode.isMobile() || this.sectionProperties.docLayer._docType === 'spreadsheet') {
			if (this.sectionProperties.commentList.length > 0)
				this.orderCommentList();
			return; // No adjustments for Calc, since only one comment can be shown at a time and that comment is shown at its belonging cell.
		}

		if (this.sectionProperties.commentList.length > 0) {
			this.orderCommentList();

			var isRTL = document.documentElement.dir === 'rtl';

			var topRight: Array<number> = [this.myTopLeft[0], this.myTopLeft[1] + this.sectionProperties.marginY - this.documentTopLeft[1]];
			var yOrigin = null;
			var selectedIndex = null;
			var x = isRTL ? 0 : topRight[0];
			var availableSpace = this.calculateAvailableSpace();

			if (availableSpace > this.sectionProperties.commentWidth) {
				if (isRTL)
					x = Math.round((this.containerObject.getDocumentAnchorSection().size[0] - app.file.size.pixels[0]) * 0.5) - this.containerObject.getDocumentAnchorSection().size[0];
				else
					x = topRight[0] - Math.round((this.containerObject.getDocumentAnchorSection().size[0] - app.file.size.pixels[0]) * 0.5);
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
			else {
				this.hideArrow();
				app.sectionContainer.requestReDraw();
			}

			var lastY = 0;
			if (selectedIndex) {
				this.loopUp(selectedIndex - 1, x, yOrigin);
				lastY = this.loopDown(selectedIndex, x, yOrigin);
			}
			else {
				lastY = this.loopDown(0, x, topRight[1]);
			}
		}

		lastY += this.containerObject.getDocumentTopLeft()[1];
		if (lastY > app.file.size.pixels[1])
			app.view.size.pixels[1] = lastY;
		else
			app.view.size.pixels[1] = app.file.size.pixels[1];
	}

	private layout (zoom: any = null): void {
		if (zoom)
			this.doLayout();
		else if (!this.sectionProperties.layoutTimer) {
			this.sectionProperties.layoutTimer = setTimeout(function() {
				delete this.sectionProperties.layoutTimer;
				this.doLayout();
			}.bind(this), 10 /* ms */);
		} // else - avoid excessive re-layout
	}

	private update (): void {
		if (this.sectionProperties.docLayer._docType === 'text')
			this.updateReplyCount();
		this.layout();
	}

	private updateReplyCount(): void {
		for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
			var comment = this.sectionProperties.commentList[i];
			var replyCount = 0;

			for (var j = 0; j < this.sectionProperties.commentList.length; j++) {
				var anotherComment = this.sectionProperties.commentList[j];
				if (this.getRootIndexOf(anotherComment.sectionProperties.data.id) === i
					&& anotherComment.sectionProperties.data.resolved !== 'true')
					replyCount++;
			}

			if (replyCount > 1)
				comment.sectionProperties.replyCountNode.innerText = replyCount;
			else
				comment.sectionProperties.replyCountNode.innerText = '';
		}
	}

	// Returns the root comment index of given id
	private getRootIndexOf (id: any): number {
		var index = this.getIndexOf(id);
		for (var idx = index - 1;
			     idx >=0 &&
				 this.sectionProperties.commentList[idx] &&
				 this.sectionProperties.commentList[idx + 1] &&
				 this.sectionProperties.commentList[idx].sectionProperties.data.id === this.sectionProperties.commentList[idx + 1].sectionProperties.data.parent;
			     idx--)
		{
			index = idx;
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

	private updateResolvedState (comment: any): void {
		var threadIndexFirst = this.getRootIndexOf(comment.sectionProperties.data.id);
		if (this.sectionProperties.commentList[threadIndexFirst].sectionProperties.data.resolved !== comment.sectionProperties.data.resolved) {
			comment.sectionProperties.data.resolved = this.sectionProperties.commentList[threadIndexFirst].sectionProperties.data.resolved;
			comment.update();
			this.update();
		}
	}

	private orderCommentList (): void {
		this.sectionProperties.commentList.sort(function(a: any, b: any) {
			return Math.abs(a.sectionProperties.data.anchorPos[1]) - Math.abs(b.sectionProperties.data.anchorPos[1]) ||
				Math.abs(a.sectionProperties.data.anchorPos[0]) - Math.abs(b.sectionProperties.data.anchorPos[0]);
		});

		// idIndexMap is now invalid, update it.
		this.updateIdIndexMap();
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

	public importComments (commentList: any): void {
		var comment;
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
				this.updateResolvedState(this.sectionProperties.commentList[i]);
			}

			this.orderCommentList();
			this.checkSize();
			this.update();
		}

		if (this.sectionProperties.docLayer._docType === 'spreadsheet')
			this.hideAllComments(); // Apply drawing orders.

		if (!(<any>window).mode.isMobile() && (this.sectionProperties.docLayer._docType === 'presentation' || this.sectionProperties.docLayer._docType === 'drawing'))
			this.showHideComments();
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

		if (this.sectionProperties.docLayer._docType === 'spreadsheet')
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
	}

	public onCommentsDataUpdate(): void {
		for (var i: number = this.sectionProperties.commentList.length -1; i > -1; i--) {
			var comment = this.sectionProperties.commentList[i];
			if (!comment.valid) {
				comment.sectionProperties.commentListSection.removeItem(comment.sectionProperties.data.id);
			}
			comment.onCommentDataUpdate();
		}
	}
}

}

app.definitions.CommentSection = cool.CommentSection;

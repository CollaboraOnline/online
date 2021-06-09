/* eslint-disable */
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
	}
});


declare var L: any;
declare var app: any;
declare var vex: any;

app.definitions.CommentSection =
class CommentSection {
	context: CanvasRenderingContext2D = null;
	myTopLeft: Array<number> = null;
	documentTopLeft: Array<number> = null;
	containerObject: any = null;
	dpiScale: number = null;
	name: string = L.CSections.CommentList.name;
	backgroundColor: string = app.sectionContainer.clearColor;
	borderColor: string = null;
	boundToSection: string = null;
	anchor: Array<any> = new Array(0);
	documentObject: boolean = false;
	position: Array<number> = [0, 0];
	size: Array<number> = [0, 0];
	expand: Array<string> = ['bottom'];
	isLocated: boolean = false;
	showSection: boolean = true;
	processingOrder: number = L.CSections.CommentList.processingOrder;
	drawingOrder: number = L.CSections.CommentList.drawingOrder;
	zIndex: number = L.CSections.CommentList.zIndex;
	interactable: boolean = false;
	sectionProperties: any = {};
	stopPropagating: Function; // Implemented by section container.
	setPosition: Function; // Implemented by section container. Document objects only.
	map: any;

	constructor () {
		this.map = L.Map.THIS;
		this.anchor = ['top', 'right'];
		this.sectionProperties.docLayer = this.map._docLayer;
		this.sectionProperties.commentList = new Array(0);
		this.sectionProperties.selectedComment = null;
		this.sectionProperties.arrow = null;
		this.sectionProperties.initialLayoutData = null;
		this.sectionProperties.showResolved = null;
		this.sectionProperties.marginY = 10 * app.dpiScale;
		this.sectionProperties.offset = 5 * app.dpiScale;
		this.sectionProperties.layoutTimer = null;
		this.sectionProperties.width = Math.round(290 * app.dpiScale); // Configurable variable.
	}

	public onInitialize () {
		this.map.on('RedlineAccept', this.onRedlineAccept, this);
		this.map.on('RedlineReject', this.onRedlineReject, this);
		this.map.on('updateparts', this.showHideComments, this);
		this.map.on('zoomend', function() {
			var that = this;
			that.layout(true);
		}, this);

		this.backgroundColor = this.containerObject.getClearColor();
		this.initializeContextMenus();

		if ((<any>window).mode.isMobile()) {
			this.showSection = false;
			this.size[0] = 0;
		}

		// For setting some css styles.
		if (app.file.fileBasedView && (<any>window).mode.isMobile()) {
			this.map.uiManager.mobileWizard._showSlideSorter();
			this.map.uiManager.mobileWizard._hideSlideSorter();
		}
	}

	private checkSize () {
		// When there is no comment || file is a spreadsheet || view type is mobile, we set this section's size to [0, 0].
		if (this.sectionProperties.docLayer._docType === 'spreadsheet' || (<any>window).mode.isMobile() || this.sectionProperties.commentList.length === 0)
		{
			if (this.size[0] !== 0) {
				this.size[0] = 0;
				this.containerObject.reNewAllSections(true);
			}
		}
		else {
			if (this.size[0] !== this.sectionProperties.width) {
				this.size[0] = this.sectionProperties.width;
				this.containerObject.reNewAllSections(true);
			}
		}
	}

	public hideAllComments () {
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

	private createCommentStructureWriter (menuStructure: any) {
		var rootComment, lastChild, comment;
		var commentList = this.sectionProperties.commentList;
		var showResolved = this.sectionProperties.showResolved;

		for (var i = 0; i < commentList.length; i++) {
			if (commentList[i].sectionProperties.data.parent === '0') {

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

					if (commentList[lastChild].sectionProperties.data.parent === '0')
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

					menuStructure['children'].push(rootComment);
				}
			}
		}
	}

	public createCommentStructureImpress (menuStructure: any) {
		var rootComment;

		for (var i in this.sectionProperties.commentList) {
			if (this.sectionProperties.commentList[i].sectionProperties.partIndex === this.sectionProperties.docLayer._selectedPart || app.file.fileBasedView) {
				rootComment = {
					id: 'comment' + this.sectionProperties.commentList[i].sectionProperties.data.id,
					enable: true,
					data: this.sectionProperties.commentList[i].sectionProperties.data,
					type: 'rootcomment',
					text: this.sectionProperties.commentList[i].sectionProperties.data.text,
					annotation: this.sectionProperties.commentList[i],
					children: []
				};
				menuStructure['children'].push(rootComment);
			}
		}
	}

	public createCommentStructureCalc (menuStructure: any) {
		var rootComment;
		var commentList = this.sectionProperties.commentList;
		var selectedTab = this.sectionProperties.docLayer._selectedPart;

		for (var i: number = 0; i < commentList.length; i++) {
			if (parseInt(commentList[i].sectionProperties.data.tab) === selectedTab) {
				rootComment = {
					id: 'comment' + commentList[i].sectionProperties.data.id,
					enable: true,
					data: commentList[i].sectionProperties.data,
					type: 'rootcomment',
					text: commentList[i].sectionProperties.data.text,
					annotation: commentList[i],
					children: []
				};
				menuStructure['children'].push(rootComment);
			}
		}
	}

	public createCommentStructure (menuStructure: any) {
		if (this.sectionProperties.docLayer._docType === 'text') {
			this.createCommentStructureWriter(menuStructure);
		}
		else if (this.sectionProperties.docLayer._docType === 'presentation' || this.sectionProperties.docLayer._docType === 'drawing') {
			this.createCommentStructureImpress(menuStructure);
		}
		else if (this.sectionProperties.docLayer._docType === 'spreadsheet') {
			this.createCommentStructureCalc(menuStructure);
		}
	}

	public newAnnotationVex (comment: any, addCommentFn: any, isMod: any) {
		var that = this;
		var commentData = comment.sectionProperties.data;

		var dialog = vex.dialog.open({
			message: '',
			input: [
				'<textarea name="comment" class="loleaflet-annotation-textarea" required>' + (commentData.text && isMod ? commentData.text: '') + '</textarea>'
			].join(''),
			buttons: [
				$.extend({}, vex.dialog.buttons.YES, { text: _('Save') }),
				$.extend({}, vex.dialog.buttons.NO, { text: _('Cancel') })
			],
			callback: function (data: any) {
				if (data) {
					var annotation = comment;

					annotation.sectionProperties.data.text = data.comment;
					comment.text = data.comment;

					addCommentFn.call(annotation, annotation, comment);
					if (!isMod)
						that.containerObject.removeSection(annotation);
				}
				else {
					that.cancel(comment);
				}
			}
		});

		var tagTd = 'td',
		empty = '',
		tagDiv = 'div';
		var author = L.DomUtil.create('table', 'loleaflet-annotation-table');
		var tbody = L.DomUtil.create('tbody', empty, author);
		var tr = L.DomUtil.create('tr', empty, tbody);
		var tdImg = L.DomUtil.create(tagTd, 'loleaflet-annotation-img', tr);
		var tdAuthor = L.DomUtil.create(tagTd, 'loleaflet-annotation-author', tr);
		var imgAuthor = L.DomUtil.create('img', 'avatar-img', tdImg);
		imgAuthor.setAttribute('src', L.LOUtil.getImageURL('user.svg'));
		imgAuthor.setAttribute('width', 32);
		imgAuthor.setAttribute('height', 32);
		var authorAvatarImg = imgAuthor;
		var contentAuthor = L.DomUtil.create(tagDiv, 'loleaflet-annotation-content-author', tdAuthor);
		var contentDate = L.DomUtil.create(tagDiv, 'loleaflet-annotation-date', tdAuthor);

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

		dialog.contentEl.insertBefore(author, dialog.contentEl.childNodes[0]);

		$(dialog.contentEl).find('textarea').focus();
	}

	public hightlightComment (comment: any) {
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

	public removeHighlighters () {
		var commentList = this.sectionProperties.commentList;
		for (var i: number = 0; i < commentList.length; i++) {
			if (commentList[i].sectionProperties.isHighlighted) {
				commentList[i].removeHighlight();
			}
		}
	}

	public removeItem (id: any) {
		var annotation;
		for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
			annotation = this.sectionProperties.commentList[i];
			if (annotation.sectionProperties.data.id === id) {
				this.containerObject.removeSection(annotation.name);
				this.sectionProperties.commentList.splice(i, 1);
				break;
			}
		}
		this.checkSize();
	}

	public click (annotation: any) {
		this.select(annotation);
	}

	public save (annotation: any) {
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
				this.map.sendUnoCommand('.uno:InsertAnnotation', comment);
				this.map.setPart(0, false);
			}
			else {
				this.map.sendUnoCommand('.uno:InsertAnnotation', comment);
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
			this.map.sendUnoCommand('.uno:CommentChangeTracking', comment);
		} else {
			comment = {
				Id: {
					type: 'string',
					value: annotation.sectionProperties.data.id
				},
				Text: {
					type: 'string',
					value: annotation.sectionProperties.data.text
				}
			};
			this.map.sendUnoCommand('.uno:EditAnnotation', comment);
		}
		this.unselect();
		this.map.focus();
	}

	public reply (annotation: any) {
		if ((<any>window).mode.isMobile() || (<any>window).mode.isTablet()) {
			var avatar = undefined;
			var author = this.map.getViewName(this.sectionProperties.docLayer._viewId);
			if (author in this.map._viewInfoByUserName) {
				avatar = this.map._viewInfoByUserName[author].userextrainfo.avatar;
			}

			if (this.sectionProperties.docLayer._docType === 'presentation' || this.sectionProperties.docLayer._docType === 'drawing') {
				this.newAnnotationVex(annotation, annotation.onReplyClick, /* isMod */ false);
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

				this.newAnnotationVex(this.add(replyAnnotation, true), annotation.onReplyClick, /* isMod */ false);
			}
		}
		else {
			annotation.reply();
			this.select(annotation);
			annotation.focus();
		}
	}

	public modify (annotation: any) {
		if ((<any>window).mode.isMobile() || (<any>window).mode.isTablet()) {
			var that = this;
			this.newAnnotationVex(annotation, function(annotation: any) { that.save(annotation); }, /* isMod */ true);
		} else {
			annotation.edit();
			this.select(annotation);
			annotation.focus();
		}
	}

	public select (annotation: any) {
		if (annotation) {
			// Select the root comment
			var idx = this.getRootIndexOf(annotation.sectionProperties.data.id);

			if (this.sectionProperties.selectedComment && $(this.sectionProperties.selectedComment.sectionProperties.container).hasClass('annotation-active'))
				$(this.sectionProperties.selectedComment.sectionProperties.container).removeClass('annotation-active');

			this.sectionProperties.selectedComment = this.sectionProperties.commentList[idx];

			if (this.sectionProperties.selectedComment && !$(this.sectionProperties.selectedComment.sectionProperties.container).hasClass('annotation-active'))
				$(this.sectionProperties.selectedComment.sectionProperties.container).addClass('annotation-active');

			this.update();
		}
	}

	public unselect () {
		if (this.sectionProperties.selectedComment) {
			if (this.sectionProperties.selectedComment && $(this.sectionProperties.selectedComment.sectionProperties.container).hasClass('annotation-active'))
				$(this.sectionProperties.selectedComment.sectionProperties.container).removeClass('annotation-active');

			if (this.sectionProperties.docLayer._docType === 'spreadsheet')
				this.sectionProperties.selectedComment.hide();

			this.sectionProperties.selectedComment = null;

			this.update();
		}
	}

	public saveReply (annotation: any) {
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

	public cancel (annotation: any) {
		if (annotation.sectionProperties.data.id === 'new') {
			this.removeItem(annotation.sectionProperties.data.id);
		}
		if (this.sectionProperties.selectedComment === annotation) {
			this.unselect();
		} else {
			this.layout();
		}
		this.map.focus();
	}

	public onRedlineAccept (e: any) {
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

	public onRedlineReject (e: any) {
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

	public remove (id: any) {
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

	public removeThread (id: any) {
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

	public resolve (annotation: any) {
		var comment = {
			Id: {
				type: 'string',
				value: annotation.sectionProperties.data.id
			}
		};
		this.map.sendUnoCommand('.uno:ResolveComment', comment);
	}

	public resolveThread (annotation: any) {
		var comment = {
			Id: {
				type: 'string',
				value: annotation.sectionProperties.data.id
			}
		};
		this.map.sendUnoCommand('.uno:ResolveCommentThread', comment);
	}

	public getIndexOf (id: any): number {
		for (var index = 0; index < this.sectionProperties.commentList.length; index++) {
			if (this.sectionProperties.commentList[index].sectionProperties.data.id === id) {
				return index;
			}
		}
		return -1;
	}

	public isThreadResolved (annotation: any) {
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

	private initializeContextMenus () {
		var that = this;
		var docLayer = this.sectionProperties.docLayer;
		L.installContextMenu({
			selector: '.loleaflet-annotation-menu',
			trigger: 'none',
			className: 'loleaflet-font',
			build: function ($trigger: any) {
				return {
					items: {
						modify: {
							name: _('Modify'),
							callback: function (key: any, options: any) {
								that.modify.call(that, options.$trigger[0].annotation);
							}
						},
						reply: (docLayer._docType !== 'text' && docLayer._docType !== 'presentation') ? undefined : {
							name: _('Reply'),
							callback: function (key: any, options: any) {
								that.reply.call(that, options.$trigger[0].annotation);
							}
						},
						remove: {
							name: _('Remove'),
							callback: function (key: any, options: any) {
								that.remove.call(that, options.$trigger[0].annotation.sectionProperties.data.id);
							}
						},
						removeThread: docLayer._docType !== 'text' || $trigger[0].isRoot === true ? undefined : {
							name: _('Remove Thread'),
							callback: function (key: any, options: any) {
								that.removeThread.call(that, options.$trigger[0].annotation.sectionProperties.data.id);
							}
						},
						resolve: docLayer._docType !== 'text' ? undefined : {
							name: $trigger[0].annotation.sectionProperties.data.resolved === 'false' ? _('Resolve') : _('Unresolve'),
							callback: function (key: any, options: any) {
								that.resolve.call(that, options.$trigger[0].annotation);
							}
						},
						resolveThread: docLayer._docType !== 'text' || $trigger[0].isRoot === true ? undefined : {
							name: that.isThreadResolved($trigger[0].annotation) ? _('Unresolve Thread') : _('Resolve Thread'),
							callback: function (key: any, options: any) {
								that.resolveThread.call(that, options.$trigger[0].annotation);
							}
						}
					},
				};
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
		L.installContextMenu({
			selector: '.loleaflet-annotation-menu-redline',
			trigger: 'none',
			className: 'loleaflet-font',
			items: {
				modify: {
					name: _('Comment'),
					callback: function (key: any, options: any) {
						that.modify.call(that, options.$trigger[0].annotation);
					}
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

	public onResize () {
		this.layout();
		// When window is resized, it may mean that comment wizard is closed. So we hide the highlights.
		this.removeHighlighters();
		this.containerObject.requestReDraw();
	}

	public onDraw () {

	}

	public onMouseMove (point: Array<number>, dragDistance: Array<number>, e: MouseEvent) {

	}

	public onNewDocumentTopLeft () {
		this.layout();
	}

	private showHideComments () {
		for (var i: number = 0; i < this.sectionProperties.commentList.length; i++) {
			this.showHideComment(this.sectionProperties.commentList[i]);
		}
	}

	public showHideComment (annotation: any) {
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
			this.layout();
			this.update();
		}
		else if (this.sectionProperties.docLayer._docType === 'presentation' || this.sectionProperties.docLayer._docType === 'drawing') {
			if (annotation.sectionProperties.partIndex === this.sectionProperties.docLayer._selectedPart || app.file.fileBasedView) {
				if (!annotation.isContainerVisible()) {
					annotation.show();
					annotation.update();
					this.layout();
					this.update();
				}
			}
			else {
				annotation.hide();
				annotation.update();
				this.layout();
				this.update();
			}
		}
	}

	public add (comment: any, mobileReply: boolean = false) {
		var annotation = new app.definitions.Comment(comment, comment.id === 'new' ? {noMenu: true} : {}, this);
		if (mobileReply)
			annotation.name += '-reply'; // Section name.

		if (comment.parent && comment.parent > '0') {
			var parentIdx = this.getIndexOf(comment.parent);

			this.containerObject.addSection(annotation);
			this.sectionProperties.commentList.splice(parentIdx + 1, 0, annotation);

			this.updateResolvedState(annotation);
			this.showHideComment(annotation);
		}
		else {
			this.containerObject.addSection(annotation);
			this.sectionProperties.commentList.push(annotation);
		}

		this.orderCommentList();
		this.checkSize();
		return annotation;
	}

	public adjustRedLine (redline: any) {
		// All sane values ?
		if (!redline.textRange) {
			console.warn('Redline received has invalid textRange');
			return false;
		}

		// transform change tracking index into an id
		redline.id = 'change-' + redline.index;
		redline.anchorPos = L.LOUtil.stringToBounds(redline.textRange);
		redline.anchorPix = this.sectionProperties.docLayer._twipsToPixels(redline.anchorPos.min);
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

	public getComment (id: any) {
		for (var i = 0; i < this.sectionProperties.commentList.length; i++) {
			if (this.sectionProperties.commentList[i].sectionProperties.data.id === id) {
				return this.sectionProperties.commentList[i];
			}
		}
		return null;
	}

	// Adjust parent-child relationship, if required, after `comment` is added
	public adjustParentAdd (comment: any) {
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
	public adjustParentRemove (comment: any) {
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

	public onACKComment (obj: any) {
		var id;
		var changetrack = obj.redline ? true : false;
		var action = changetrack ? obj.redline.action : obj.comment.action;

		if (changetrack && obj.redline.author in this.map._viewInfoByUserName) {
			obj.redline.avatar = this.map._viewInfoByUserName[obj.redline.author].userextrainfo.avatar;
		}
		else if (!changetrack && obj.comment.author in this.map._viewInfoByUserName) {
			obj.comment.avatar = this.map._viewInfoByUserName[obj.comment.author].userextrainfo.avatar;
		}

		if ((<any>window).mode.isMobile()) {
			var annotation = this.sectionProperties.commentList[this.getRootIndexOf(obj.comment.id)];
			if (!annotation)
				annotation = this.sectionProperties.commentList[this.getRootIndexOf(obj.comment.parent)]; //this is required for reload after reply in writer
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
			annotation = this.sectionProperties.commentList[this.getRootIndexOf(obj.comment.id)];
			if (!(<any>window).mode.isMobile())
				this.layout();
		} else if (action === 'Remove') {
			if ((<any>window).mode.isMobile() && obj.comment.id === annotation.sectionProperties.data.id) {
				var child = this.sectionProperties.commentList[this.getIndexOf(obj.comment.id) + 1];
				if (child && child.sectionProperties.data.parent === annotation.sectionProperties.data.id)
					annotation = child;
				else
					annotation = undefined;
			}
			id = changetrack ? 'change-' + obj.redline.index : obj.comment.id;
			var removed = this.getComment(id);
			if (removed) {
				this.adjustParentRemove(removed);
				this.removeItem(id);
				if (this.sectionProperties.selectedComment === removed) {
					this.unselect();
				} else {
					this.layout();
				}
			}
		} else if (action === 'Modify') {
			id = changetrack ? 'change-' + obj.redline.index : obj.comment.id;
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
			id = changetrack ? 'change-' + obj.redline.index : obj.comment.id;
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
			var wePerformedAction = obj.comment.author === this.map.getViewName(this.sectionProperties.docLayer._viewId);

			if ((<any>window).commentWizard || (action === 'Add' && wePerformedAction))
				shouldOpenWizard = true;

			if (shouldOpenWizard) {
				this.sectionProperties.docLayer._openCommentWizard(annotation);
			}
		}
	}

	public selectById (commentId: any) {
		var idx = this.getRootIndexOf(commentId);
		this.sectionProperties.selectedComment = this.sectionProperties.commentList[idx];
		this.update();
	}

	public stringToRectangles (str: string) {
		var matches = str.match(/\d+/g);
		var rectangles = [];
		if (matches !== null) {
			for (var i: number = 0; i < matches.length; i += 4) {
				rectangles.push([parseInt(matches[i]), parseInt(matches[i + 1]), parseInt(matches[i + 2]), parseInt(matches[i + 3])]);
			}
		}
		return rectangles;
	}

	public onPartChange () {
		for (var i: number = 0; i < this.sectionProperties.commentList.length; i++) {
			this.showHideComment(this.sectionProperties.commentList[i]);
		}
		if (this.sectionProperties.selectedComment)
			this.sectionProperties.selectedComment.onCancelClick(null);
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
	private adjustCommentFileBasedView (comment: any) {
		// Below calculations are the same with the ones we do while drawing tiles in fileBasedView.
		var partHeightTwips = this.sectionProperties.docLayer._partHeightTwips + this.sectionProperties.docLayer._spaceBetweenParts;
		var index = this.sectionProperties.docLayer._partHashes.indexOf(comment.parthash);
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
	private adjustCommentNormal (comment: any) {
		comment.trackchange = false;
		comment.rectangles = this.stringToRectangles(comment.textRange || comment.anchorPos || comment.rectangle || comment.cellPos); // Simple array of point arrays [x1, y1, x2, y2].
		comment.rectanglesOriginal = this.stringToRectangles(comment.textRange || comment.anchorPos || comment.rectangle || comment.cellPos); // This unmodified version will be kept for re-calculations.
		comment.anchorPos = this.stringToRectangles(comment.anchorPos || comment.rectangle || comment.cellPos)[0];
		comment.anchorPix = this.numberArrayToCorePixFromTwips(comment.anchorPos, 0, 2);
		comment.parthash = comment.parthash ? comment.parthash: null;
		comment.tab = comment.tab ? comment.tab: null;

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

	private adjustComment (comment: any) {
		if (!app.file.fileBasedView)
			this.adjustCommentNormal(comment);
		else
			this.adjustCommentFileBasedView(comment);
	}

	private getScaleFactor () {
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
	private getLastChildIndexOf (id: any) {
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

	private updateScaling () {
		if ((<any>window).mode.isDesktop() || this.sectionProperties.commentList.length === 0)
			return;

		var contentWrapperClassName, menuClassName;
		if (this.sectionProperties.commentList[0].sectionProperties.data.trackchange) {
			contentWrapperClassName = '.loleaflet-annotation-redline-content-wrapper';
			menuClassName = '.loleaflet-annotation-menu-redline';
		} else {
			contentWrapperClassName = '.loleaflet-annotation-content-wrapper';
			menuClassName = '.loleaflet-annotation-menu';
		}

		var initNeeded = (this.sectionProperties.initialLayoutData === null);
		var contentWrapperClass = $(contentWrapperClassName);

		if (initNeeded) {
			var contentAuthor = $('.loleaflet-annotation-content-author');
			var dateClass = $('.loleaflet-annotation-date');

			this.sectionProperties.initialLayoutData = {
				wrapperWidth: parseInt(contentWrapperClass.css('width')),
				wrapperFontSize: parseInt(contentWrapperClass.css('font-size')),
				authorContentHeight: parseInt(contentAuthor.css('height')),
				dateFontSize: parseInt(dateClass.css('font-size')),
			};
		}

		var menuClass = $(menuClassName);
		if ((this.sectionProperties.initialLayoutData.menuWidth === undefined) && menuClass.length > 0) {
			this.sectionProperties.initialLayoutData.menuWidth = parseInt(menuClass.css('width'));
			this.sectionProperties.initialLayoutData.menuHeight = parseInt(menuClass.css('height'));
		}

		var scaleFactor = this.getScaleFactor();
		var idx;
		if (this.sectionProperties.selectedComment) {
			var selectIndexFirst = this.getRootIndexOf(this.sectionProperties.selectedComment.sectionProperties.data.id);
			var selectIndexLast = this.getLastChildIndexOf(this.sectionProperties.selectedComment.sectionProperties.data.id);
			for (idx = 0; idx < this.sectionProperties.commentList.length; idx++) {
				if (idx < selectIndexFirst || idx >  selectIndexLast) {
					this.sectionProperties.commentList[idx].updateScaling(scaleFactor, this.sectionProperties.initialLayoutData);
				}
				else {
					this.sectionProperties.commentList[idx].updateScaling(1, this.sectionProperties.initialLayoutData);
				}
			}
		}
		else {
			for (idx = 0; idx < this.sectionProperties.commentList.length; idx++) {
				this.sectionProperties.commentList[idx].updateScaling(scaleFactor, this.sectionProperties.initialLayoutData);
			}
		}
	}

	private twipsToCorePixels (twips: any) {
		return [twips.x / this.sectionProperties.docLayer._tileWidthTwips * this.sectionProperties.docLayer._tileSize, twips.y / this.sectionProperties.docLayer._tileHeightTwips * this.sectionProperties.docLayer._tileSize];
	}

	// If the file type is presentation or drawing then we shall check the selected part in order to hide comments from other parts.
	// But if file is in fileBasedView, then we will not hide any comments from not-selected/viewed parts.
	private mustCheckSelectedPart () {
		return (this.sectionProperties.docLayer._docType === 'presentation' || this.sectionProperties.docLayer._docType === 'drawing') && !app.file.fileBasedView;
	}

	private layoutUp (subList: any, actualPosition: Array<number>, lastY: number) {
		var height: number;
		for (var i = 0; i < subList.length; i++) {
			height = subList[i].sectionProperties.container.getBoundingClientRect().height;
			lastY = subList[i].sectionProperties.data.anchorPix[1] + height < lastY ? subList[i].sectionProperties.data.anchorPix[1]: lastY - height;
			(new L.PosAnimation()).run(subList[i].sectionProperties.container, {x: Math.round(actualPosition[0] / app.dpiScale), y: Math.round(lastY / app.dpiScale)});
			subList[i].show();
		}
		return lastY;
	}

	private loopUp (startIndex: number, x: number, startY: number) {
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

	private layoutDown (subList: any, actualPosition: Array<number>, lastY: number) {
		var selectedComment = subList[0] === this.sectionProperties.selectedComment;
		for (var i = 0; i < subList.length; i++) {
			lastY = subList[i].sectionProperties.data.anchorPix[1] > lastY ? subList[i].sectionProperties.data.anchorPix[1]: lastY;

			if (selectedComment)
				(new L.PosAnimation()).run(subList[i].sectionProperties.container, {x: Math.round(actualPosition[0] / app.dpiScale) - 60, y: Math.round(lastY / app.dpiScale)});
			else
				(new L.PosAnimation()).run(subList[i].sectionProperties.container, {x: Math.round(actualPosition[0] / app.dpiScale), y: Math.round(lastY / app.dpiScale)});

			lastY += (subList[i].sectionProperties.container.getBoundingClientRect().height * app.dpiScale);
			if (!subList[i].isEdit())
				subList[i].show();
		}
		return lastY;
	}

	private loopDown (startIndex: number, x: number, startY: number) {
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

	private hideArrow () {
		if (this.sectionProperties.arrow) {
			document.getElementById('document-container').removeChild(this.sectionProperties.arrow);
			this.sectionProperties.arrow = null;
		}
	}

	private showArrow (startPoint: Array<number>, endPoint: Array<number>) {
		var anchorSection = this.containerObject.getDocumentAnchorSection();
		startPoint[0] -= anchorSection.myTopLeft[0] + this.documentTopLeft[0];
		startPoint[1] -= anchorSection.myTopLeft[1] + this.documentTopLeft[1];
		endPoint[0] -= anchorSection.myTopLeft[0] + this.documentTopLeft[0];
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
			svg.append(line);
			document.getElementById('document-container').appendChild(svg);
			this.sectionProperties.arrow = svg;
		}
	}

	private doLayout () {
		if ((<any>window).mode.isMobile() || this.sectionProperties.docLayer._docType === 'spreadsheet') {
			if (this.sectionProperties.commentList.length > 0)
				this.orderCommentList();
			return; // No adjustments for Calc, since only one comment can be shown at a time and that comment is shown at its belonging cell.
		}

		if (this.sectionProperties.commentList.length > 0) {
			this.orderCommentList();

			this.updateScaling();

			var topRight: Array<number> = [this.myTopLeft[0], this.myTopLeft[1] + this.sectionProperties.marginY - this.documentTopLeft[1]];
			var yOrigin = null;
			var selectedIndex = null;
			var x = topRight[0];
			if (this.containerObject.getDocumentAnchorSection().size[0] > app.file.size.pixels[0]) {
				x = topRight[0] - Math.round((this.containerObject.getDocumentAnchorSection().size[0] - app.file.size.pixels[0]) * 0.5);
			}

			if (this.sectionProperties.selectedComment) {
				selectedIndex = this.getRootIndexOf(this.sectionProperties.selectedComment.sectionProperties.data.id);
				this.sectionProperties.commentList[selectedIndex].sectionProperties.data.anchorPix = this.numberArrayToCorePixFromTwips(this.sectionProperties.commentList[selectedIndex].sectionProperties.data.anchorPos, 0, 2);
				this.sectionProperties.commentList[selectedIndex].sectionProperties.data.anchorPix[1];
				yOrigin = this.sectionProperties.commentList[selectedIndex].sectionProperties.data.anchorPix[1] - this.documentTopLeft[1];
				var tempCrd: Array<number> = this.sectionProperties.commentList[selectedIndex].sectionProperties.data.anchorPix;
				this.showArrow([tempCrd[0], tempCrd[1]], [x, tempCrd[1]]);
			}
			else {
				this.hideArrow();
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

        if (lastY > this.containerObject.getDocumentAnchorSection().size[1])
            app.view.size.pixels[1] = lastY + app.file.size.pixels[1];
        else
            app.view.size.pixels[1] = app.file.size.pixels[1];
	}

	private layout (zoom: any = null) {
		if (zoom)
			this.doLayout();
		else if (!this.sectionProperties.layoutTimer) {
			var that = this;
			that.sectionProperties.layoutTimer = setTimeout(function() {
				delete that.sectionProperties.layoutTimer;
				that.doLayout();
			}, 10 /* ms */);
		} // else - avoid excessive re-layout
	}

	private update () {
		this.layout();
	}

	// Returns the root comment index of given id
	private getRootIndexOf (id: any) {
		var index = this.getIndexOf(id);
		for (var idx = index - 1;
			     idx >=0 && this.sectionProperties.commentList[idx].sectionProperties.data.id === this.sectionProperties.commentList[idx + 1].sectionProperties.data.parent;
			     idx--)
		{
			index = idx;
		}

		return index;
	}

	public setViewResolved (state: any) {
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
		this.layout();
		this.update();
	}

	private updateResolvedState (comment: any) {
		var threadIndexFirst = this.getRootIndexOf(comment.sectionProperties.data.id);
		if (this.sectionProperties.commentList[threadIndexFirst].sectionProperties.data.resolved !== comment.sectionProperties.data.resolved) {
			comment.sectionProperties.data.resolved = this.sectionProperties.commentList[threadIndexFirst].sectionProperties.data.resolved;
			comment.update();
			this.update();
		}
	}

	private orderCommentList () {
		this.sectionProperties.commentList.sort(function(a: any, b: any) {
			return Math.abs(a.sectionProperties.data.anchorPos[1]) - Math.abs(b.sectionProperties.data.anchorPos[1]) ||
				Math.abs(a.sectionProperties.data.anchorPos[0]) - Math.abs(b.sectionProperties.data.anchorPos[0]);
		});
	}

	private turnIntoAList (commentList: any) {
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

	public importComments (commentList: any) {
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
				var commentSection = new app.definitions.Comment(comment, {}, this);
				this.containerObject.addSection(commentSection);
				this.sectionProperties.commentList.push(commentSection);
				this.updateResolvedState(this.sectionProperties.commentList[i]);
			}

			this.orderCommentList();
			this.checkSize();
			this.layout();
		}

		if (this.sectionProperties.docLayer._docType === 'spreadsheet')
			this.hideAllComments(); // Apply drawing orders.
	}

	// Remove only text comments from the document (excluding change tracking comments)
	private clearList () {
		for (var i: number = this.sectionProperties.commentList.length -1; i > -1; i--) {
			if (!this.sectionProperties.commentList[i].trackchange) {
				this.containerObject.removeSection(this.sectionProperties.commentList[i].name);
				this.sectionProperties.commentList.splice(i, 1);
			}
		}

		this.sectionProperties.selectedComment = null;
		this.checkSize();
	}

	public onMouseUp () {}
	public onMouseDown () {}
	public onMouseEnter () {}
	public onMouseLeave () {}
	public onMouseWheel () {}
	public onClick () {}
	public onDoubleClick () {}
	public onContextMenu () {}
	public onLongPress () {}
	public onMultiTouchStart () {}
	public onMultiTouchMove () {}
	public onMultiTouchEnd () {}
}
/* global Proxy _ */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

/*
	This class is for the modifier handles of shape objects.
	Shape is rendered on the core side. Only the handles are drawn here and modification commands are sent to the core side.
*/

class ShapeHandlesSection extends CanvasSectionObject {
	name: string = "shapeHandlesSection";
	processingOrder: number = L.CSections.DefaultForDocumentObjects.processingOrder;
	drawingOrder: number = L.CSections.DefaultForDocumentObjects.drawingOrder;
	zIndex: number = L.CSections.DefaultForDocumentObjects.zIndex;
	documentObject: boolean = true;
	showSection: boolean = false;

	constructor (info: any) {
        super();

		this.sectionProperties.info = null;
		this.sectionProperties.handles = [];
		this.sectionProperties.subSections = [];
		this.sectionProperties.activeHandleIndex = null;
		this.sectionProperties.mouseIsInside = false;
		this.sectionProperties.handleWidth = 12 * app.dpiScale;
		this.sectionProperties.handleHeight = 12 * app.dpiScale;
		this.sectionProperties.anchorWidth = 20 * app.dpiScale;
		this.sectionProperties.anchorHeight = 20 * app.dpiScale;
		this.sectionProperties.rotationHandleWidth = 15 * app.dpiScale;
		this.sectionProperties.rotationHandleHeight = 15 * app.dpiScale;
		this.sectionProperties.gluePointRadius = 10 * app.dpiScale;
		this.sectionProperties.subSectionPrefix = 'shape-handle-';
		this.sectionProperties.previousCursorStyle = null;
		this.sectionProperties.svg = null; // This is for preview of modifications.
		this.sectionProperties.hasVideo = false; // Don't hide svg when there is video content.
		this.sectionProperties.shapeRectangleProperties = null; // Not null when there are scaling handles.
		this.sectionProperties.lastDragDistance = [0, 0];

		this.refreshInfo(info);
	}

	public refreshInfo(info: any) {
		this.sectionProperties.info = info;
		this.getHandles();
		this.updateSize();
		this.addSubSections();
		this.sectionProperties.shapeRectangleProperties = this.getShapeRectangleProperties();
		this.calculateInitialAnglesOfShapeHandlers();
	}

	public calculateInitialAnglesOfShapeHandlers(shapeRecProps?: any) {
		if (this.sectionProperties.info?.handles?.kinds?.rectangle) {
			if (!shapeRecProps)
				shapeRecProps = this.sectionProperties.shapeRectangleProperties;

			const halfDiagonal = Math.pow(Math.pow(shapeRecProps.width * 0.5, 2) + Math.pow(shapeRecProps.height * 0.5, 2), 0.5);
			for (let i = 0; i < this.sectionProperties.subSections.length; i++) {
				const subSection = this.sectionProperties.subSections[i];

				if (subSection.sectionProperties.ownInfo.kind === '1') {
					subSection.sectionProperties.distanceToCenter = halfDiagonal;
					subSection.sectionProperties.initialAngle = Math.atan2(shapeRecProps.height * 0.5, -shapeRecProps.width * 0.5);
				}
				else if (subSection.sectionProperties.ownInfo.kind === '2') {
					subSection.sectionProperties.distanceToCenter = shapeRecProps.height * 0.5;
					subSection.sectionProperties.initialAngle = Math.atan2(shapeRecProps.height * 0.5, 0);
				}
				else if (subSection.sectionProperties.ownInfo.kind === '3') {
					subSection.sectionProperties.distanceToCenter = halfDiagonal;
					subSection.sectionProperties.initialAngle = Math.atan2(shapeRecProps.height * 0.5, shapeRecProps.width * 0.5);
				}
				else if (subSection.sectionProperties.ownInfo.kind === '4') {
					subSection.sectionProperties.distanceToCenter = shapeRecProps.width * 0.5;
					subSection.sectionProperties.initialAngle = Math.atan2(0, -shapeRecProps.width * 0.5);
				}
				else if (subSection.sectionProperties.ownInfo.kind === '5') {
					subSection.sectionProperties.distanceToCenter = shapeRecProps.width * 0.5;
					subSection.sectionProperties.initialAngle = Math.atan2(0, shapeRecProps.width * 0.5);
				}
				else if (subSection.sectionProperties.ownInfo.kind === '6') {
					subSection.sectionProperties.distanceToCenter = halfDiagonal;
					subSection.sectionProperties.initialAngle = Math.atan2(-shapeRecProps.height * 0.5, -shapeRecProps.width * 0.5);
				}
				else if (subSection.sectionProperties.ownInfo.kind === '7') {
					subSection.sectionProperties.distanceToCenter = shapeRecProps.height * 0.5;
					subSection.sectionProperties.initialAngle = Math.atan2(-shapeRecProps.height * 0.5, 0);
				}
				else if (subSection.sectionProperties.ownInfo.kind === '8') {
					subSection.sectionProperties.distanceToCenter = halfDiagonal;
					subSection.sectionProperties.initialAngle = Math.atan2(-shapeRecProps.height * 0.5, shapeRecProps.width * 0.5);
				}
			}
		}
	}

	public static moveHTMLObjectToMapElement(htmlObjectSection: HTMLObjectSection) {
		htmlObjectSection.getHTMLObject().remove();
		document.getElementById('map').appendChild(htmlObjectSection.getHTMLObject());
	}

	public static mirrorEventsFromSourceToCanvasSectionContainer (sourceElement: HTMLElement): void {
		sourceElement.addEventListener('mousedown', function (e) { app.sectionContainer.onMouseDown(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('click', function (e) { app.sectionContainer.onClick(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('dblclick', function (e) { app.sectionContainer.onDoubleClick(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('contextmenu', function (e) { app.sectionContainer.onContextMenu(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('wheel', function (e) { app.sectionContainer.onMouseWheel(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('mouseleave', function (e) { app.sectionContainer.onMouseLeave(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('mouseenter', function (e) { app.sectionContainer.onMouseEnter(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('touchstart', function (e) { app.sectionContainer.onTouchStart(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('touchmove', function (e) { app.sectionContainer.onTouchMove(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('touchend', function (e) { app.sectionContainer.onTouchEnd(e); e.stopPropagation(); }, true);
		sourceElement.addEventListener('touchcancel', function (e) { app.sectionContainer.onTouchCancel(e); e.stopPropagation(); }, true);
	}

	getShapeWidth() {
		let middleLeft = this.sectionProperties.info.handles.kinds.rectangle['4'][0];
		middleLeft = new cool.SimplePoint(parseInt(middleLeft.point.x), parseInt(middleLeft.point.y));

		let middleRight = this.sectionProperties.info.handles.kinds.rectangle['5'][0];
		middleRight = new cool.SimplePoint(parseInt(middleRight.point.x), parseInt(middleRight.point.y));

		return Math.abs(middleLeft.distanceTo(middleRight.toArray()));
	}

	getShapeHeight() {
		let topMiddle = this.sectionProperties.info.handles.kinds.rectangle['2'][0];
		topMiddle = new cool.SimplePoint(parseInt(topMiddle.point.x), parseInt(topMiddle.point.y));

		let bottomMiddle = this.sectionProperties.info.handles.kinds.rectangle['7'][0];
		bottomMiddle = new cool.SimplePoint(parseInt(bottomMiddle.point.x), parseInt(bottomMiddle.point.y));

		return Math.abs(topMiddle.distanceTo(bottomMiddle.toArray()));
	}

	/*
		This is also sent from the core side.
	*/
	getShapeAngleRadians() {
		let topMiddle = this.sectionProperties.info.handles.kinds.rectangle['2'][0];
		topMiddle = new cool.SimplePoint(parseInt(topMiddle.point.x), parseInt(topMiddle.point.y));

		const center = app.map._docLayer._graphicSelection.center; // number array in twips.

		const radians = Math.atan2((center[1] - topMiddle.y), (topMiddle.x - center[0]));
		return radians - Math.PI * 0.5;
	}

	/*
		Selection rectangle is different from the object's inner rectangle.
		Handlers are positioned based on object's inner rectangle (~borders). So we need to get the object's inner rectangle and its rotation angle.
	*/
	getShapeRectangleProperties() {
		if (!this.sectionProperties.info.handles?.kinds?.rectangle)
			return null;

		return {
			angleRadian: this.getShapeAngleRadians(),
			center: app.map._docLayer._graphicSelection.pCenter.slice(),
			height: this.getShapeHeight() * app.twipsToPixels,
			width: this.getShapeWidth() * app.twipsToPixels
		};
	}

	getScalingHandles(halfWidth: number, halfHeight: number) {
		if (this.sectionProperties.info?.handles?.kinds?.rectangle) {
			const topLeft = this.sectionProperties.info.handles.kinds.rectangle['1'][0];
			const topMiddle = this.sectionProperties.info.handles.kinds.rectangle['2'][0];
			const topRight = this.sectionProperties.info.handles.kinds.rectangle['3'][0];
			const middleLeft = this.sectionProperties.info.handles.kinds.rectangle['4'][0];
			const middleRight = this.sectionProperties.info.handles.kinds.rectangle['5'][0];
			const bottomLeft = this.sectionProperties.info.handles.kinds.rectangle['6'][0];
			const bottomMiddle = this.sectionProperties.info.handles.kinds.rectangle['7'][0];
			const bottomRight = this.sectionProperties.info.handles.kinds.rectangle['8'][0];

			this.sectionProperties.handles.push({ info: topLeft, point: new app.definitions.simplePoint(topLeft.point.x - halfWidth, topLeft.point.y - halfHeight) });
			this.sectionProperties.handles.push({ info: topMiddle, point: new app.definitions.simplePoint(topMiddle.point.x - halfWidth, topMiddle.point.y - halfHeight) });
			this.sectionProperties.handles.push({ info: topRight, point: new app.definitions.simplePoint(topRight.point.x - halfWidth, topRight.point.y - halfHeight) });
			this.sectionProperties.handles.push({ info: middleLeft, point: new app.definitions.simplePoint(middleLeft.point.x - halfWidth, middleLeft.point.y - halfHeight) });
			this.sectionProperties.handles.push({ info: middleRight, point: new app.definitions.simplePoint(middleRight.point.x - halfWidth, middleRight.point.y - halfHeight) });
			this.sectionProperties.handles.push({ info: bottomLeft, point: new app.definitions.simplePoint(bottomLeft.point.x - halfWidth, bottomLeft.point.y - halfHeight) });
			this.sectionProperties.handles.push({ info: bottomMiddle, point: new app.definitions.simplePoint(bottomMiddle.point.x - halfWidth, bottomMiddle.point.y - halfHeight) });
			this.sectionProperties.handles.push({ info: bottomRight, point: new app.definitions.simplePoint(bottomRight.point.x - halfWidth, bottomRight.point.y - halfHeight) });
		}
	}

	getAnchorHandle(halfWidth: number, halfHeight: number) {
		if (this.sectionProperties.info?.handles?.kinds?.anchor) {
			const anchor = this.sectionProperties.info.handles.kinds.anchor['16'][0];
			this.sectionProperties.handles.push({ info: anchor, point: new app.definitions.simplePoint(anchor.point.x - halfWidth, anchor.point.y - halfHeight) });
		}
	}

	public getRotationInfo(): any {
		if (!this.sectionProperties.info?.handles?.kinds?.rectangle)
			return;

		let coreAngle = app.map._docLayer._graphicSelectionAngle;
		if (this.sectionProperties.svg)
			coreAngle = this.sectionProperties.svg.innerHTML.includes('class="Group"') ? 0: coreAngle;

		if (coreAngle !== undefined && coreAngle !== null) {
			coreAngle = coreAngle / 100;
			coreAngle = (coreAngle * Math.PI) / 180;

			while (coreAngle > Math.PI * 2) coreAngle -= Math.PI * 2;
			while (coreAngle < 0) coreAngle += Math.PI * 2;
		}
		else
			coreAngle = null;

		const result = {
			kind: 'ShapeRotationHandle',
			coreAngle: coreAngle
		};

		return result;
	}

	getRotationHandlePosition(rotationInfo: any) {
		const centerX = parseInt(this.sectionProperties.info.handles.kinds.rectangle['2'][0].point.x) * app.twipsToPixels - this.position[0];
		const centerY = parseInt(this.sectionProperties.info.handles.kinds.rectangle['2'][0].point.y) * app.twipsToPixels - this.position[1];
		const diff = 30 * app.dpiScale;

		let y = centerY - diff * Math.sin(rotationInfo.coreAngle + Math.PI * 0.5);
		let x = centerX + diff * Math.cos(rotationInfo.coreAngle + Math.PI * 0.5);

		x -= this.sectionProperties.rotationHandleWidth * 0.5;
		y -= this.sectionProperties.rotationHandleHeight * 0.5;

		return new app.definitions.simplePoint((this.position[0] + x) * app.pixelsToTwips, (this.position[1] + y) * app.pixelsToTwips);
	}

	getRotationHandle() {
		if (this.sectionProperties.info?.handles?.kinds?.rectangle && !this.sectionProperties.hasVideo) {
			const rotationInfo = this.getRotationInfo(); // Rotation section will read the information from this (parent) class.
			const rotationHandlePosition: cool.SimplePoint = this.getRotationHandlePosition(rotationInfo);
			rotationInfo.initialPosition = rotationHandlePosition.clone();

			// Core side doesn't send a position information for rotation handle. We add this.
			this.sectionProperties.handles.push({ info: rotationInfo, point: rotationHandlePosition });
		}
	}

	getCustomHandles(halfWidth: number, halfHeight: number) {
		if (this.sectionProperties.info?.handles?.kinds?.custom) {
			const customHandleList = this.sectionProperties.info.handles.kinds.custom['22'];

			if (customHandleList && customHandleList.length > 0) {
				for (let i = 0; i < customHandleList.length; i++) {
					const customHandler = customHandleList[i];
					this.sectionProperties.handles.push({ info: customHandler, point: new app.definitions.simplePoint(customHandler.point.x - halfWidth, customHandler.point.y - halfHeight) });
				}
			}
		}
	}

	getPolyHandles(halfWidth: number, halfHeight: number) {
		if (this.sectionProperties.info?.handles?.kinds?.poly) {
			if (Array.isArray(this.sectionProperties.info.handles.kinds.poly['9'])) {
				const polyArray = this.sectionProperties.info.handles.kinds.poly['9'];

				for (let i = 0; i < polyArray.length; i++) {
					const poly = polyArray[i];
					this.sectionProperties.handles.push({ info: poly, point: new app.definitions.simplePoint(poly.point.x - halfWidth, poly.point.y - halfHeight) });
				}
			}
		}
	}

	getGluePoints() {
		if (this.sectionProperties.info?.GluePoints?.shapes) {
			if (Array.isArray(this.sectionProperties.info.GluePoints.shapes)) {
				const shapeArray = this.sectionProperties.info.GluePoints.shapes;

				for (let i = 0; i < shapeArray.length; i++) {
					const shape = shapeArray[i];
					shape.kind = 'GluePoint';
					const glueArray = shape.gluepoints;

					for (let j = 0; j < glueArray.length; j++) {
						const info = Object.assign({}, shape);
						info.id = String(i) + String(j);
						this.sectionProperties.handles.push({ info: info, point: new app.definitions.simplePoint(glueArray[j].point.x, glueArray[j].point.y) });
					}
				}
			}
		}
	}

	// Get the handle positions and other information from the info that core side sent us.
	getHandles() {
		this.sectionProperties.handles = [];

		const halfWidth = app.pixelsToTwips * (this.sectionProperties.handleWidth * 0.5);
		const halfHeight = app.pixelsToTwips * (this.sectionProperties.handleHeight * 0.5);

		this.getScalingHandles(halfWidth, halfHeight);
		this.getAnchorHandle(halfWidth, halfHeight);
		this.getRotationHandle();
		this.getCustomHandles(halfWidth, halfHeight);
		this.getPolyHandles(halfWidth, halfHeight);
		this.getGluePoints();
	}

	// Update this section's size according to handle coordinates.
	updateSize() {
		this.size = [0, 0];

		if (app.map._docLayer._graphicSelection)
			this.size = [app.map._docLayer._graphicSelection.pWidth, app.map._docLayer._graphicSelection.pHeight];
	}

	isSVGVisible() {
		if (this.sectionProperties.svg)
			return this.sectionProperties.svg.style.display === '';
		else
			return false;
	}

	removeSVG() {
		if (this.sectionProperties.svg)
			this.sectionProperties.svg.remove();
	}

	addVideoSupportHandlers(videos: any) {
		if (!videos)
			return;

		// slide show may have more than one video and it does not require any selection
		for (var i = 0; i < videos.length; i++) {
			var video = videos[i];
			var sources = video.getElementsByTagName('source');

			video.addEventListener('playing', function() {
				window.setTimeout(function() {
					if (video.webkitDecodedFrameCount === 0) {
						this.showUnsupportedVideoWarning();
					}
				}.bind(this), 1000);
			}.bind(this));

			video.addEventListener('error', function() {
				this.showUnsupportedVideoWarning();
			}.bind(this));

			if (sources.length) {
				sources[0].addEventListener('error', function(error: string) {
					this.showUnsupportedVideoWarning();
				}.bind(this));
			}
		}
	}

	showUnsupportedVideoWarning() {
		var videoWarning = _('Document contains unsupported video');
		L.Map.THIS.uiManager.showSnackbar(videoWarning);
	}

	addEmbeddedVideo(svgString: any) {
		this.sectionProperties.hasVideo = true;
		this.setSVG(svgString);
		this.sectionProperties.svg.remove();
		document.getElementById('map').appendChild(this.sectionProperties.svg);
		this.sectionProperties.svg.style.zIndex = 11; // Update z-index or video buttons are unreachable.

		if (!this.sectionProperties.svg.innerHTML.includes('foreignobject')) {
			console.error('Failed to parse svg for embedded video');
			return;
		}

		var videoContainer = this.sectionProperties.svg;
		var videos = this.sectionProperties.svg.getElementsByTagName('video');

		// fix URL, it's important to have correct WOPISrc, we need to decode "&" before other params
		// like ServerId and Tag so load balancer will not use it as a part of WOPISrc
		// this has to be done here (after parseSVG), because it other case we will fail to get
		// the svg object
		var source = this.sectionProperties.svg.getElementsByTagName('source');
		source[0].src = decodeURIComponent(source[0].src);

		this.addVideoSupportHandlers(videos);

		function _fixSVGPos() {
			var mat = this.sectionProperties.svg.getScreenCTM();
			var boundingBox = this.context.canvas.getBoundingClientRect();
			videoContainer.style.transform = 'matrix(' + [mat.a, mat.b, mat.c, mat.d, mat.e - boundingBox.x, mat.f - boundingBox.y].join(', ') + ')';
		}
		var fixSVGPos = _fixSVGPos.bind(this);

		if (L.Browser.safari) {
			fixSVGPos();
			var observer = new MutationObserver(fixSVGPos);

			observer.observe(this.context.canvas, {
				attributes: true
			});
		}
	}

	setSVG(data: string) {
		this.removeSVG();

		this.sectionProperties.svg = document.createElement('svg');
		document.getElementById('canvas-container').appendChild(this.sectionProperties.svg);
		this.sectionProperties.svg.innerHTML = data; // Sanitize data here before pushing.
		this.sectionProperties.svg.style.position = 'absolute';

		this.sectionProperties.svg.children[0].style.width = this.sectionProperties.svg.children[0].style.height = 'auto';
		this.sectionProperties.svg.children[0].style.transformOrigin = 'center';
		this.sectionProperties.svg.children[0].setAttribute('preserveAspectRatio', 'none');

		this.adjustSVGProperties();
	}

	showSVG() {
		if (this.sectionProperties.svg)
			this.sectionProperties.svg.style.display = '';
	}

	hideSVG() {
		if (this.sectionProperties.svg && !this.sectionProperties.hasVideo)
			this.sectionProperties.svg.style.display = 'none';
	}

	onSectionShowStatusChange() {
		for (let i = 0; i < this.sectionProperties.subSections.length; i++)
			this.sectionProperties.subSections[i].setShowSection(this.showSection);

		if (this.showSection)
			this.showSVG();
		else
			this.hideSVG();
	}

	checkAnchorSubSection(handle: any): any {
		let newSubSection = app.sectionContainer.getSectionWithName(this.sectionProperties.subSectionPrefix + handle.info.id);

		if (!newSubSection) {
			newSubSection = new app.definitions.shapeHandleAnchorSubSection(
				this,
				this.sectionProperties.subSectionPrefix + handle.info.id,
				[this.sectionProperties.anchorWidth / app.dpiScale, this.sectionProperties.anchorHeight / app.dpiScale],
				handle.point.clone(),
				handle.info
			);
			return newSubSection;
		}
		else {
			newSubSection.sectionProperties.ownInfo = handle.info;
			newSubSection.setPosition(handle.point.pX, handle.point.pY);
			return null;
		}
	}

	checkScalingSubSection(handle: any): any {
		let newSubSection = app.sectionContainer.getSectionWithName(this.sectionProperties.subSectionPrefix + handle.info.id);

		if (!newSubSection) {
			newSubSection = new app.definitions.shapeHandleScalingSubSection(
				this,
				this.sectionProperties.subSectionPrefix + handle.info.id,
				[this.sectionProperties.handleWidth, this.sectionProperties.handleHeight],
				handle.point.clone(),
				handle.info
			);
			return newSubSection;
		}
		else {
			newSubSection.sectionProperties.ownInfo = handle.info;
			newSubSection.setPosition(handle.point.pX, handle.point.pY);
			return null;
		}
	}

	checkRotationSubSection(handle: any) {
		let newSubSection = app.sectionContainer.getSectionWithName(this.sectionProperties.subSectionPrefix + 'rotation');

		if (!newSubSection) {
			newSubSection = new app.definitions.shapeHandleRotationSubSection(
				this,
				this.sectionProperties.subSectionPrefix + 'rotation',
				[this.sectionProperties.rotationHandleWidth / app.dpiScale, this.sectionProperties.rotationHandleHeight / app.dpiScale],
				handle.point.clone(),
				handle.info
			);
			return newSubSection;
		}
		else {
			newSubSection.sectionProperties.ownInfo = handle.info;
			newSubSection.setPosition(handle.point.pX, handle.point.pY);
			return null;
		}
	}

	checkCustomSubSection(handle: any): any {
		let newSubSection = app.sectionContainer.getSectionWithName(this.sectionProperties.subSectionPrefix + handle.info.id);

		if (!newSubSection) {
			newSubSection = new app.definitions.shapeHandleCustomSubSection(
				this,
				this.sectionProperties.subSectionPrefix + handle.info.id,
				[this.sectionProperties.handleWidth, this.sectionProperties.handleHeight],
				handle.point.clone(),
				handle.info
			);
			return newSubSection;
		}
		else {
			newSubSection.sectionProperties.ownInfo = handle.info;
			newSubSection.setPosition(handle.point.pX, handle.point.pY);
			return null;
		}
	}

	checkPolySubSection(handle: any): any {
		let newSubSection = app.sectionContainer.getSectionWithName(this.sectionProperties.subSectionPrefix + handle.info.id);

		if (!newSubSection) {
			newSubSection = new app.definitions.shapeHandlePolySubSection(
				this,
				this.sectionProperties.subSectionPrefix + handle.info.id,
				[this.sectionProperties.handleWidth, this.sectionProperties.handleHeight],
				handle.point.clone(),
				handle.info
			);
			return newSubSection;
		}
		else {
			newSubSection.sectionProperties.ownInfo = handle.info;
			newSubSection.setPosition(handle.point.pX, handle.point.pY);
			return null;
		}
	}

	checkGluePointSubSection(handle: any): any {
		let newSubSection = app.sectionContainer.getSectionWithName(this.sectionProperties.subSectionPrefix + handle.info.id);

		if (!newSubSection) {
			newSubSection = new app.definitions.shapeHandleGluePointSubSection(
				this,
				this.sectionProperties.subSectionPrefix + handle.info.id,
				[this.sectionProperties.gluePointRadius, this.sectionProperties.gluePointRadius],
				handle.point.clone(),
				handle.info
			);
			return newSubSection;
		}
		else {
			newSubSection.sectionProperties.ownInfo = handle.info;
			newSubSection.setPosition(handle.point.pX, handle.point.pY);
			return null;
		}
	}

	addSubSections() {
		for (let i = 0; i < this.sectionProperties.handles.length; i++) {
			let newSubSection: any = null;
			if (this.sectionProperties.handles[i].info.kind === '16')
				newSubSection = this.checkAnchorSubSection(this.sectionProperties.handles[i]);
			else if (['1', '2', '3', '4', '5', '6', '7', '8'].includes(this.sectionProperties.handles[i].info.kind))
				newSubSection = this.checkScalingSubSection(this.sectionProperties.handles[i]);
			else if (this.sectionProperties.handles[i].info.kind === 'ShapeRotationHandle')
				newSubSection = this.checkRotationSubSection(this.sectionProperties.handles[i]);
			else if (this.sectionProperties.handles[i].info.kind === '22')
				newSubSection = this.checkCustomSubSection(this.sectionProperties.handles[i]);
			else if (this.sectionProperties.handles[i].info.kind === '9')
				newSubSection = this.checkPolySubSection(this.sectionProperties.handles[i]);
			else if (this.sectionProperties.handles[i].info.kind === 'GluePoint')
				newSubSection = this.checkGluePointSubSection(this.sectionProperties.handles[i]);

			if (newSubSection) {
				this.containerObject.addSection(newSubSection as any);
				this.sectionProperties.subSections.push(newSubSection);
			}
		}
	}

	onMouseEnter() {
		this.sectionProperties.previousCursorStyle = this.context.canvas.style.cursor;
		this.context.canvas.style.cursor = 'move';
		this.sectionProperties.mouseIsInside = true;
	}

	onMouseLeave() {
		this.context.canvas.style.cursor = this.sectionProperties.previousCursorStyle;
		this.sectionProperties.mouseIsInside = false;
	}

	sendTransformCommand(point: number[]) {
		const parameters = {
			'TransformPosX': {
				'type': 'long',
				'value': Math.round((this.sectionProperties.lastDragDistance[0] + this.position[0]) * app.pixelsToTwips)
			},
			'TransformPosY': {
				'type': 'long',
				'value': Math.round((this.sectionProperties.lastDragDistance[1] + this.position[1]) * app.pixelsToTwips)
			}
		};

		app.map.sendUnoCommand('.uno:TransformDialog', parameters);
	}

	onMouseUp(point: number[], e: MouseEvent): void {
		if (this.sectionProperties.svg)
			this.sectionProperties.svg.style.opacity = 1;

		this.hideSVG();

		(window as any).IgnorePanning = false;

		// This is for tablet and mobbile but we can use this for also desktop, if we want to avoid sending mouse events for shapes to core side.
		if (this.containerObject.isDraggingSomething() && ((window as any).mode.isTablet() || (window as any).mode.isMobile()))
			this.sendTransformCommand(point);
	}

	onMouseMove(position: number[], dragDistance: number[]) {
		if (this.containerObject.isDraggingSomething() && this.sectionProperties.svg) {
			(window as any).IgnorePanning = true;

			this.sectionProperties.svg.style.left = String((this.myTopLeft[0] + dragDistance[0]) / app.dpiScale) + 'px';
			this.sectionProperties.svg.style.top = String((this.myTopLeft[1] + dragDistance[1]) / app.dpiScale) + 'px';
			this.sectionProperties.svg.style.opacity = 0.5;
			this.sectionProperties.lastDragDistance = [dragDistance[0], dragDistance[1]];
			this.showSVG();
		}
		else
			(window as any).IgnorePanning = false;
	}

	getViewBox(svg: any): number[] {
		let viewBox: any = svg.getAttribute('viewBox');

		if (viewBox) {
			viewBox = viewBox.split(' ');
			for (let i = 0; i < viewBox.length; i++) viewBox[i] = parseInt(viewBox[i]);
		}
		else
			viewBox = null;

		return viewBox;
	}

	adjustSVGProperties() {
		if (this.sectionProperties.svg && this.sectionProperties.svg.style.display === '' && app.map._docLayer._graphicSelection) {

			const clientRect = (this.sectionProperties.svg.children[0] as SVGElement).getBoundingClientRect();
			let width: number = clientRect.width;
			let height: number = clientRect.height;

			if (app.map._docLayer._docType !== 'presentation') {
				width *= app.getScale();
				height *= app.getScale();
			}

			let left = 0, top = 0;

			const viewBox: number[] = this.getViewBox(this.sectionProperties.svg.children[0]);
			const isImage = this.sectionProperties.svg.querySelectorAll('.Graphic').length > 0;
			if (viewBox && clientRect.width > 0 && clientRect.height > 0 && !isImage) {
				this.sectionProperties.svg.children[0].style.width = (width / app.dpiScale) + 'px';
				this.sectionProperties.svg.children[0].style.height = (height / app.dpiScale) + 'px';

				const widthPixelRatio = viewBox[2] / width;
				const heightPixelRatio = viewBox[3] / height;

				left = (viewBox[0] / widthPixelRatio) / app.dpiScale;
				top = (viewBox[1] / heightPixelRatio) / app.dpiScale;
			}
			else {
				left = (this.position[0] / app.dpiScale);
				top = (this.position[1] / app.dpiScale);
				const widthText = (this.size[0] / app.dpiScale) + 'px';
				const heightText = (this.size[1] / app.dpiScale) + 'px';

				this.sectionProperties.svg.style.width = widthText;
				this.sectionProperties.svg.style.height = heightText;
				if (isImage) {
					this.sectionProperties.svg.children[0].setAttribute('width', widthText);
					this.sectionProperties.svg.children[0].setAttribute('height', heightText);
				}
			}

			this.sectionProperties.svg.style.left = (left - (this.documentTopLeft[0] - this.containerObject.getDocumentAnchor()[0]) / app.dpiScale) + 'px';
			this.sectionProperties.svg.style.top = (top - (this.documentTopLeft[1] - this.containerObject.getDocumentAnchor()[1]) / app.dpiScale) + 'px';
			this.sectionProperties.svgPosition = [left, top];
		}
		this.hideSVG();
	}

	onNewDocumentTopLeft(size: number[]): void {
		if (this.sectionProperties.svgPosition) {
			this.sectionProperties.svg.style.left = (this.sectionProperties.svgPosition[0] - (this.documentTopLeft[0] + this.containerObject.getDocumentAnchor()[0]) / app.dpiScale) + 'px';
			this.sectionProperties.svg.style.top = (this.sectionProperties.svgPosition[1] - (this.documentTopLeft[1] + this.containerObject.getDocumentAnchor()[1]) / app.dpiScale) + 'px';
		}
	}

	public onDraw() {
		if (!this.showSection || !this.isVisible)
			this.hideSVG();
	}

	removeSubSections(): void {
		this.removeSVG();
		for (let i = 0; i < this.sectionProperties.subSections.length; i++) {
			this.containerObject.removeSection(this.sectionProperties.subSections[i].name);
		}
	}
}

app.definitions.shapeHandlesSection = ShapeHandlesSection;

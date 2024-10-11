/* -*- js-indent-level: 8; fill-column: 100 -*- */

/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

declare var JSDialog: any;

class GraphicSelection {
	public static rectangle: cool.SimpleRectangle = null;
	public static extraInfo: any = null;
	public static selectionAngle: number = 0;
	public static handlesSection: ShapeHandlesSection = null;

	public static hasActiveSelection() {
		return this.rectangle !== null;
	}

	public static onUpdatePermission() {
		this.rectangle = null;
		this.updateGraphicSelection();
	}

	static resetSelectionRanges() {
		this.rectangle = null;
		this.extraInfo = null;

		if (this.handlesSection) {
			this.handlesSection.removeSubSections();
			app.sectionContainer.removeSection(this.handlesSection.name);
			this.handlesSection = null;
		}
	}

	// shows the video inside current selection marker
	static onEmbeddedVideoContent(textMsg: string) {
		if (!this.handlesSection) return;

		var videoDesc = JSON.parse(textMsg);

		if (this.hasActiveSelection()) {
			videoDesc.width = this.rectangle.cWidth;
			videoDesc.height = this.rectangle.cHeight;
		}

		// proxy cannot identify RouteToken if it is encoded
		var routeTokenIndex = videoDesc.url.indexOf('%26RouteToken=');
		if (routeTokenIndex != -1) {
			videoDesc.url = videoDesc.url.replace(
				'%26RouteToken=',
				'&amp;RouteToken=',
			);
		}

		var videoToInsert =
			'<?xml version="1.0" encoding="UTF-8"?>\
		<foreignObject xmlns="http://www.w3.org/2000/svg" overflow="visible" width="' +
			videoDesc.width +
			'" height="' +
			videoDesc.height +
			'">\
			<body xmlns="http://www.w3.org/1999/xhtml">\
				<video controls="controls" width="' +
			videoDesc.width +
			'" height="' +
			videoDesc.height +
			'">\
					<source src="' +
			videoDesc.url +
			'" type="' +
			videoDesc.mimeType +
			'"/>\
				</video>\
			</body>\
		</foreignObject>';

		this.handlesSection.addEmbeddedVideo(videoToInsert);
	}

	static renderDarkOverlay() {
		var topLeft = new L.Point(this.rectangle.pX1, this.rectangle.pY1);
		var bottomRight = new L.Point(this.rectangle.pX2, this.rectangle.pY2);

		if (app.map._docLayer.isCalcRTL()) {
			// Dark overlays (like any other overlay) need regular document coordinates.
			// But in calc-rtl mode, charts (like shapes) have negative x document coordinate
			// internal representation.
			topLeft.x = Math.abs(topLeft.x);
			bottomRight.x = Math.abs(bottomRight.x);
		}

		var bounds = new L.Bounds(topLeft, bottomRight);

		app.map._docLayer._oleCSelections.setPointSet(CPointSet.fromBounds(bounds));
	}

	// When a shape is selected, the rectangles of other shapes are also sent from the core side.
	// They are in twips units.
	static convertObjectRectangleTwipsToPixels() {
		const correction = 0.567; // Correction for impress case.

		if (this.extraInfo && this.extraInfo.ObjectRectangles) {
			for (let i = 0; i < this.extraInfo.ObjectRectangles.length; i++) {
				for (let j = 0; j < 4; j++)
					this.extraInfo.ObjectRectangles[i][j] *=
						app.twipsToPixels * correction;
			}
		}
	}

	static extractAndSetGraphicSelection(messageJSON: any) {
		var signX = app.map._docLayer.isCalcRTL() ? -1 : 1;
		var hasExtraInfo = messageJSON.length > 5;
		var hasGridOffset = false;
		var extraInfo = null;
		if (hasExtraInfo) {
			extraInfo = messageJSON[5];
			if (extraInfo.gridOffsetX || extraInfo.gridOffsetY) {
				app.map._docLayer._shapeGridOffset = new app.definitions.simplePoint(
					signX * extraInfo.gridOffsetX,
					extraInfo.gridOffsetY,
				);
				hasGridOffset = true;
			}
		}

		// Calc RTL: Negate positive X coordinates from core if grid offset is available.
		signX = hasGridOffset && app.map._docLayer.isCalcRTL() ? -1 : 1;
		this.rectangle = new app.definitions.simpleRectangle(
			signX * messageJSON[0],
			messageJSON[1],
			signX * messageJSON[2],
			messageJSON[3],
		);

		if (hasGridOffset)
			this.rectangle.moveBy([
				app.map._docLayer._shapeGridOffset.x,
				app.map._docLayer._shapeGridOffset.y,
			]);

		this.extraInfo = extraInfo;

		if (app.map._docLayer._docType === 'presentation')
			this.convertObjectRectangleTwipsToPixels();
	}

	public static updateGraphicSelection() {
		if (this.hasActiveSelection()) {
			// Hide the keyboard on graphic selection, unless cursor is visible.
			// Don't interrupt editing in dialogs
			if (!JSDialog.IsAnyInputFocused())
				app.map.focus(app.file.textCursor.visible);

			if (!app.map.isEditMode()) {
				return;
			}

			var extraInfo = this.extraInfo;
			let addHandlesSection = false;

			if (!this.handlesSection) addHandlesSection = true;
			else if (extraInfo.id !== this.handlesSection.sectionProperties.info.id) {
				// Another shape is selected.
				this.handlesSection.removeSubSections();
				app.sectionContainer.removeSection(this.handlesSection.name);
				this.handlesSection = null;
				addHandlesSection = true;
			}

			if (addHandlesSection) {
				this.handlesSection = new app.definitions.shapeHandlesSection({});
				app.sectionContainer.addSection(this.handlesSection);
			}

			this.handlesSection.setPosition(this.rectangle.pX1, this.rectangle.pY1);
			extraInfo.hasTableSelection = app.map._docLayer.hasTableSelection(); // scaleSouthAndEastOnly
			this.handlesSection.refreshInfo(this.extraInfo);
			this.handlesSection.setShowSection(true);
			app.sectionContainer.requestReDraw();
		} else if (
			this.handlesSection &&
			app.sectionContainer.doesSectionExist(this.handlesSection.name)
		) {
			this.handlesSection.removeSubSections();
			app.sectionContainer.removeSection(this.handlesSection.name);
			this.handlesSection = null;
		}
		app.map._docLayer._updateCursorAndOverlay();
	}

	public static onShapeSelectionContent(textMsg: string) {
		textMsg = textMsg.substring('shapeselectioncontent:'.length + 1);

		var extraInfo = this.extraInfo;
		if (extraInfo && extraInfo.id) {
			app.map._cacheSVG[extraInfo.id] = textMsg;
		}

		// video is handled in _onEmbeddedVideoContent
		if (this.handlesSection && this.handlesSection.sectionProperties.hasVideo)
			app.map._cacheSVG[extraInfo.id] = undefined;
		else if (this.handlesSection) this.handlesSection.setSVG(textMsg);
	}

	public static onMessage(textMsg: string) {
		app.definitions.urlPopUpSection.closeURLPopUp();

		if (textMsg.match('EMPTY')) {
			this.resetSelectionRanges();
		} else if (textMsg.match('INPLACE EXIT')) {
			app.map._docLayer._oleCSelections.clear();
		} else if (textMsg.match('INPLACE')) {
			if (app.map._docLayer._oleCSelections.empty()) {
				textMsg = '[' + textMsg.substr('graphicselection:'.length) + ']';
				try {
					var msgData = JSON.parse(textMsg);
					if (msgData.length > 1) this.extractAndSetGraphicSelection(msgData);
				} catch (error) {
					window.app.console.warn('cannot parse graphicselection command');
				}
				this.renderDarkOverlay();

				this.rectangle = null;
				this.updateGraphicSelection();
			}
		} else {
			textMsg = '[' + textMsg.substr('graphicselection:'.length) + ']';
			msgData = JSON.parse(textMsg);
			this.extractAndSetGraphicSelection(msgData);

			// Update the dark overlay on zooming & scrolling
			if (!app.map._docLayer._oleCSelections.empty()) {
				app.map._docLayer._oleCSelections.clear();
				this.renderDarkOverlay();
			}

			this.selectionAngle = msgData.length > 4 ? msgData[4] : 0;

			if (this.extraInfo) {
				var dragInfo = this.extraInfo.dragInfo;
				if (dragInfo && dragInfo.dragMethod === 'PieSegmentDragging') {
					dragInfo.initialOffset /= 100.0;
					var dragDir = dragInfo.dragDirection;
					dragInfo.dragDirection = app.map._docLayer._twipsToPixels(
						new L.Point(dragDir[0], dragDir[1]),
					);
					dragDir = dragInfo.dragDirection;
					dragInfo.range2 = dragDir.x * dragDir.x + dragDir.y * dragDir.y;
				}
			}

			// defaults
			var extraInfo = this.extraInfo;
			if (extraInfo) {
				if (extraInfo.isDraggable === undefined) extraInfo.isDraggable = true;
				if (extraInfo.isResizable === undefined) extraInfo.isResizable = true;
				if (extraInfo.isRotatable === undefined) extraInfo.isRotatable = true;
			}

			// Workaround for tdf#123874. For some reason the handling of the
			// shapeselectioncontent messages that we get back causes the WebKit process
			// to crash on iOS.

			// Note2: scroll to frame in writer would result an error:
			//   svgexport.cxx:810: ...UnknownPropertyException message: "Background
			var isFrame = extraInfo.type == 601 && !extraInfo.isWriterGraphic;

			if (
				!window.ThisIsTheiOSApp &&
				this.extraInfo.isDraggable &&
				!this.extraInfo.svg &&
				!isFrame
			) {
				app.socket.sendMessage('rendershapeselection mimetype=image/svg+xml');
			}

			// scroll to selected graphics, if it has no cursor
			if (
				!app.map._docLayer.isWriter() &&
				this.rectangle &&
				app.map._docLayer._allowViewJump()
			) {
				if (
					(!app.isPointVisibleInTheDisplayedArea([
						this.rectangle.x1,
						this.rectangle.y1,
					]) ||
						!app.isPointVisibleInTheDisplayedArea([
							this.rectangle.x2,
							this.rectangle.y2,
						])) &&
					!app.map._docLayer._selectionHandles.active &&
					!(app.isFollowingEditor() || app.isFollowingUser()) &&
					!app.map.calcInputBarHasFocus()
				) {
					app.map._docLayer.scrollToPos(
						new app.definitions.simplePoint(
							this.rectangle.x1,
							this.rectangle.y1,
						),
					);
				}
			}
		}

		// Graphics are by default complex selections, unless Core tells us otherwise.
		if (app.map._clip) app.map._clip.onComplexSelection('');

		// Reset text selection - important for textboxes in Impress
		if (app.map._docLayer._selectionContentRequest)
			clearTimeout(app.map._docLayer._selectionContentRequest);
		app.map._docLayer._onMessage('textselectioncontent:');

		this.updateGraphicSelection();

		if (msgData && msgData.length > 5) {
			var extraInfo = msgData[5];
			if (extraInfo.url !== undefined) {
				this.onEmbeddedVideoContent(JSON.stringify(extraInfo));
			}
		}
	}
}

app.events.on(
	'updatepermission',
	GraphicSelection.onUpdatePermission.bind(GraphicSelection),
);

app.definitions.graphicSelection = GraphicSelection;

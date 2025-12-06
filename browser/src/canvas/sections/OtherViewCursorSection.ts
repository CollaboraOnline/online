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

// This is used for other views' cursors.

class TextCursorSection extends HTMLObjectSection {
	documentObject: boolean = true;
	interactable: boolean = false; // We don't bother with events.
	zIndex: number = app.CSections.DefaultForDocumentObjects.processingOrder;
	drawingOrder: number = app.CSections.DefaultForDocumentObjects.drawingOrder;
	processingOrder: number =
		app.CSections.DefaultForDocumentObjects.processingOrder;

	static sectionNamePrefix = 'OtherViewCursor ';
	static sectionPointers: Array<TextCursorSection> = [];

	constructor(
		viewId: number,
		color: string,
		rectangle: cool.SimpleRectangle,
		part: number,
		mode: number,
	) {
		super(
			TextCursorSection.sectionNamePrefix + viewId,
			rectangle.pWidth / app.dpiScale,
			rectangle.pHeight / app.dpiScale,
			new cool.SimplePoint(rectangle.x1, rectangle.y1),
		);

		this.sectionProperties.color = color;
		this.sectionProperties.viewId = viewId;
		this.sectionProperties.part = part;
		this.sectionProperties.mode = mode;
		this.sectionProperties.showCursor = true;
		this.showSection = true;
		this.getHTMLObject().style.backgroundColor = this.sectionProperties.color;
	}

	checkMyVisibility() {
		let result = this.sectionProperties.showCursor && this.size[1] > 0;

		if (result) {
			if (!app.map._docLayer.isWriter()) {
				if (
					this.sectionProperties.part !== app.map._docLayer._selectedPart ||
					this.sectionProperties.mode !== app.map._docLayer._selectedMode
				)
					result = false;
			}
		}

		if (result && app.file.textCursor.visible) {
			Util.ensureValue(app.file.textCursor.rectangle);
			const pos = [
				app.file.textCursor.rectangle.pX1,
				app.file.textCursor.rectangle.pY1,
			];
			if (this.position[0] === pos[0] && this.position[1] === pos[1])
				result = false;
		}

		if (result && app.map.isViewReadOnly(this.sectionProperties.viewId))
			result = false;

		return result;
	}

	public static addOrUpdateOtherViewCursor(
		viewId: number,
		username: string,
		rectangleData: Array<string>,
		part: number,
		mode: number,
	) {
		let rectangle = new cool.SimpleRectangle(0, 0, 0, 0);
		const color = app.LOUtil.rgbToHex(app.LOUtil.getViewIdColor(viewId));

		if (rectangleData) {
			rectangle = new cool.SimpleRectangle(
				parseInt(rectangleData[0]),
				parseInt(rectangleData[1]),
				parseInt(rectangleData[2]),
				parseInt(rectangleData[3]),
			);
		}

		rectangle.pWidth = 2 * app.dpiScale; // Width of the cursor.

		const sectionName = TextCursorSection.sectionNamePrefix + viewId;
		let section: TextCursorSection;
		if (app.sectionContainer.doesSectionExist(sectionName)) {
			section = app.sectionContainer.getSectionWithName(
				sectionName,
			) as TextCursorSection;
			section.sectionProperties.part = part;
			section.sectionProperties.mode = mode;
			section.size[0] = rectangle.pWidth;
			section.size[1] = rectangle.pHeight;

			section.getHTMLObject().style.width =
				section.size[0] / app.dpiScale + 'px';
			section.getHTMLObject().style.height =
				section.size[1] / app.dpiScale + 'px';

			section.setPosition(rectangle.pX1, rectangle.pY1);
		} else {
			section = new TextCursorSection(viewId, color, rectangle, part, mode);
			app.sectionContainer.addSection(section);
			TextCursorSection.sectionPointers.push(section);
		}

		section.setShowSection(section.checkMyVisibility());
		section.onNewDocumentTopLeft();
		section.adjustHTMLObjectPosition();
		const documentPosition = new cool.SimplePoint(
			section.position[0] * app.pixelsToTwips,
			(section.position[1] - 20) * app.pixelsToTwips,
		);

		if (section.showSection && section.isVisible)
			app.definitions.cursorHeaderSection.showCursorHeader(
				viewId,
				username,
				documentPosition,
				color,
			);

		app.sectionContainer.requestReDraw();
	}

	public static removeView(viewId: number) {
		const sectionName = TextCursorSection.sectionNamePrefix + viewId;
		if (app.sectionContainer.doesSectionExist(sectionName)) {
			const section = app.sectionContainer.getSectionWithName(
				sectionName,
			) as TextCursorSection;
			TextCursorSection.sectionPointers.splice(
				TextCursorSection.sectionPointers.indexOf(section),
				1,
			);
			app.sectionContainer.removeSection(sectionName);
			app.sectionContainer.requestReDraw();
		}
	}

	public static doesViewCursorSectionExist(viewId: number) {
		const name = TextCursorSection.sectionNamePrefix + viewId;
		return app.sectionContainer.doesSectionExist(name);
	}

	public static getViewCursorSection(viewId: number) {
		if (TextCursorSection.doesViewCursorSectionExist(viewId)) {
			const name = TextCursorSection.sectionNamePrefix + viewId;
			return app.sectionContainer.getSectionWithName(name);
		} else return null;
	}

	public static updateVisibilities(hideCursors: boolean = false) {
		for (let i = 0; i < TextCursorSection.sectionPointers.length; i++) {
			const section = TextCursorSection.sectionPointers[i];
			section.setShowSection(section.checkMyVisibility());
			if (hideCursors) section.getHTMLObject().style.opacity = '0';
			else section.getHTMLObject().style.opacity = '1';
		}
		app.sectionContainer.requestReDraw();
	}
}

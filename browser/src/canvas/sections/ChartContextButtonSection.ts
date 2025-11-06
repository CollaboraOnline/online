/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

class ChartContextButtonSection extends HTMLObjectSection {
	static readonly namePrefix: string = 'ChartContextButton_';
	static readonly classNames: string[] = [
		'chart-select-theme',
		'chart-save-to-new-theme',
	];
	// Predefined sizes in pixel
	static readonly sizeButtons: number = 32;
	static readonly sizeSpaceBetweenButtons: number = 5;

	lastZoom: number = 0;

	constructor(buttonType: number) {
		super(
			ChartContextButtonSection.namePrefix + buttonType,
			32,
			32,
			new cool.SimplePoint(
				GraphicSelection.rectangle.x2 +
					ChartContextButtonSection.sizeSpaceBetweenButtons * app.pixelsToTwips,
				GraphicSelection.rectangle.y1 +
					buttonType *
						app.pixelsToTwips *
						(ChartContextButtonSection.sizeButtons +
							ChartContextButtonSection.sizeSpaceBetweenButtons),
			),
			ChartContextButtonSection.classNames[buttonType],
			true,
		);
		// to make sure the update Position will happen
		this.forceNextReposition();
		this.updatePosition();
		this.sectionProperties.buttonType = buttonType;
		this.sectionProperties.lastInputEvent = null;
	}

	public onMouseEnter(point: cool.SimplePoint, e: MouseEvent): void {
		this.getHTMLObject()?.classList.add('hovered');
	}

	public onMouseLeave(point: cool.SimplePoint, e: MouseEvent): void {
		this.getHTMLObject()?.classList.remove('hovered');
	}

	public onMouseDown(point: cool.SimplePoint, e: MouseEvent): void {
		this.stopEvents(e);
	}

	public onMouseUp(point: cool.SimplePoint, e: MouseEvent): void {
		this.stopEvents(e);
	}

	private stopEvents(e: MouseEvent) {
		this.stopPropagating();

		// We shouldn't need below 2 when we remove map element.
		e.preventDefault();
		e.stopImmediatePropagation();
	}

	public onClick(point: cool.SimplePoint, e: MouseEvent): void {
		if (this.sectionProperties.buttonType === 0) {
			app.socket.sendMessage('uno .uno:SelectTheme');
		} else {
			app.socket.sendMessage('uno .uno:ChartSaveToNewTheme');
		}
	}

	showChartContextToolbar(): void {
		this.setShowSection(true);
	}

	updatePosition(): void {
		var origZoom = app.map.getZoom();
		// Position goes wrong when zoom change so update it when zoom changed.
		if (this.lastZoom != origZoom) {
			this.lastZoom = origZoom;
			var x = Math.round(
				GraphicSelection.rectangle.x2 * app.twipsToPixels +
					ChartContextButtonSection.sizeSpaceBetweenButtons,
			);
			var y = Math.round(
				GraphicSelection.rectangle.y1 * app.twipsToPixels +
					this.sectionProperties.buttonType *
						(ChartContextButtonSection.sizeButtons +
							ChartContextButtonSection.sizeSpaceBetweenButtons),
			);
			this.setPosition(x, y);
		}
	}

	forceNextReposition(): void {
		this.lastZoom = 0;
	}

	// catch zoom, and scroll events ..
	adjustHTMLObjectPosition() {
		this.updatePosition();
		super.adjustHTMLObjectPosition();
	}

	setLastInputEventType(e: any) {
		this.sectionProperties.lastInputEvent = e;
	}
}

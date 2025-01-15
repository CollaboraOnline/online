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
	This class is for Impress's and Draw's comment markers.
	This is a sub section, needs to know about the parent section.
*/

class CommentMarkerSubSection extends HTMLObjectSection {
	constructor(
		sectionName: string,
		objectWidth: number,
		objectHeight: number,
		documentPosition: cool.SimplePoint,
		extraClass: string = '',
		showSection: boolean = false,
		parentSection: any, // Parent section.
		data: any, // Parent section's data.
	) {
		super(
			sectionName,
			objectWidth,
			objectHeight,
			documentPosition,
			extraClass,
			showSection,
		);
		this.sectionProperties.parentSection = parentSection;
		this.sectionProperties.data = data;
		this.sectionProperties.dragStartPosition = null;
	}

	private sendAnnotationPositionChange(newPosition: number[]): void {
		if (app.file.fileBasedView) {
			app.map.setPart(this.sectionProperties.docLayer._selectedPart, false);
			newPosition[1] -= this.sectionProperties.data.yAddition;
		}

		const comment = {
			Id: {
				type: 'string',
				value: this.sectionProperties.data.id,
			},
			PositionX: {
				type: 'int32',
				value: newPosition[0],
			},
			PositionY: {
				type: 'int32',
				value: newPosition[1],
			},
		};
		app.map.sendUnoCommand('.uno:EditAnnotation', comment);

		if (app.file.fileBasedView) app.setPart(0, false);
	}

	onMouseMove(
		point: Array<number>,
		dragDistance: Array<number>,
		e: MouseEvent,
	): void {
		if (this.sectionProperties.parentSection === null) return;

		if (app.sectionContainer.isDraggingSomething()) {
			(<any>window).IgnorePanning = true;

			if (this.sectionProperties.parent === null) return;

			if (this.sectionProperties.dragStartPosition === null)
				this.sectionProperties.dragStartPosition = this.position.slice();

			this.setPosition(
				this.sectionProperties.dragStartPosition[0] + dragDistance[0],
				this.sectionProperties.dragStartPosition[1] + dragDistance[1],
			);
		}
	}

	onDragEnd(): void {
		(<any>window).IgnorePanning = undefined;

		this.sectionProperties.dragStartPosition = null;

		const twips = [
			this.position[0] * app.pixelsToTwips,
			this.position[1] * app.pixelsToTwips,
		];

		this.sendAnnotationPositionChange(twips);
	}

	onClick(point: number[], e: MouseEvent): void {
		e.stopPropagation();
		this.stopPropagating();
		this.sectionProperties.parentSection.sectionProperties.commentListSection.selectById(
			this.sectionProperties.data.id,
		);
	}

	onMouseDown(point: number[], e: MouseEvent): void {
		e.stopPropagation();
		this.stopPropagating();
	}

	onMouseUp(point: number[], e: MouseEvent): void {
		e.stopPropagation();
		if (this.containerObject.isDraggingSomething()) {
			this.stopPropagating();
			this.onDragEnd();
		}
	}
}

app.definitions.commentMarkerSubSection = CommentMarkerSubSection;

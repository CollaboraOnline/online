/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
declare var L: any;

namespace cool {

// SheetSwitchViewRestore is used to store the last view position of a sheet
// before a sheet switch so that when the user switches back to previously used
// sheets we can restore the last scroll position of that sheet.
export class SheetSwitchViewRestore {

	private map: any;
	private docLayer: any;

	// centerOfSheet maps from sheet id to center of sheet view.
	// Currently LatLng is used for center, but this will be
	// replaced by pixel coordinates.
	private centerOfSheet: Map<number, any>;
	private mayRestore: boolean;
	private restorePart: number;
	private setPartRecvd: boolean;
	private currentSheetIndexReassigned: boolean;

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	constructor (map: any) {

		this.map = map;
		this.docLayer = this.map._docLayer;

		this.centerOfSheet = new Map<number, any>();
		this.mayRestore = false;
		this.restorePart = -1;
		this.setPartRecvd = false;
		this.currentSheetIndexReassigned = false;

		this.map.on('commandresult', this.onCommandResult, this);
	}

	public save (toPart: number): void {
		if (!this.currentSheetIndexReassigned) {
			this.centerOfSheet.set(this.docLayer._selectedPart as number, this.map.getCenter());
		} else {
			this.currentSheetIndexReassigned = false;
		}
		this.mayRestore = this.centerOfSheet.has(toPart);
		this.restorePart = this.mayRestore ? toPart : -1;
		this.setPartRecvd = false;
	}

	public updateOnSheetMoved(oldIndex: number, newIndex: number): void {
		window.app.console.log('SheetSwitchViewRestore.updateOnSheetMoved: oldIndex: ' + oldIndex + ', newIndex: ' + newIndex);
		if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex)
			return;

		const currentSheetNumber: number = this.map.getCurrentPartNumber();
		const movedSheetCenter = this.centerOfSheet.get(oldIndex);

		if (oldIndex < newIndex) {
			this.currentSheetIndexReassigned = oldIndex <= currentSheetNumber && currentSheetNumber <= newIndex;
			for (let i = oldIndex; i < newIndex; ++i) {
				const center = this.centerOfSheet.get(i + 1);
				if (center)
					this.centerOfSheet.set(i, center);
				else
					this.centerOfSheet.delete(i);
			}
		} else {
			this.currentSheetIndexReassigned = newIndex <= currentSheetNumber && currentSheetNumber <= oldIndex;
			for (let i = oldIndex; i > newIndex; --i) {
				const center = this.centerOfSheet.get(i - 1);
				if (center)
					this.centerOfSheet.set(i, center);
				else
					this.centerOfSheet.delete(i);
			}
		}

		if (movedSheetCenter)
			this.centerOfSheet.set(newIndex, movedSheetCenter);
		else
			this.centerOfSheet.delete(newIndex);
	}

	public updateOnSheetInsertion(index: number): void {
		if (index < 0)
			return;

		// when insert a sheet
		this.centerOfSheet.set(this.docLayer._selectedPart as number, this.map.getCenter());

		const numberOfSheets: number = this.map.getNumberOfParts();
		for (let i = numberOfSheets; i > index; --i) {
			const center = this.centerOfSheet.get(i - 1);
			if (center)
				this.centerOfSheet.set(i, center);
			else
				this.centerOfSheet.delete(i);
		}
		this.centerOfSheet.delete(index);

		const currentSheetNumber: number = this.map.getCurrentPartNumber();
		this.currentSheetIndexReassigned = index <= currentSheetNumber;
		if (this.currentSheetIndexReassigned) {
			this.centerOfSheet.set(currentSheetNumber + 1, this.map.getCenter());
		}
	}

	public updateOnSheetDeleted(index: number): void {
		if (index < 0)
			return;

		const numberOfSheets: number = this.map.getNumberOfParts();
		for (let i = index; i < numberOfSheets; ++i) {
			const center = this.centerOfSheet.get(i + 1);
			if (center)
				this.centerOfSheet.set(i, center);
			else
				this.centerOfSheet.delete(i);
		}

		const currentSheetNumber: number = this.map.getCurrentPartNumber();
		this.currentSheetIndexReassigned = index <= currentSheetNumber;
		if (index < currentSheetNumber) {
			this.centerOfSheet.set(currentSheetNumber - 1, this.map.getCenter());
		}
	}

	public gotSetPart(part: number): void {

		this.setPartRecvd = (part === this.restorePart);
	}

	// This resets the flags but not the center map.
	private reset (): void {

		this.restorePart = -1;
		this.mayRestore = false;
	}

	private restoreView (): void {

		const center = this.centerOfSheet.get(this.restorePart);
		if (center === undefined) {
			this.reset();
			return;
		}

		this.map._resetView(center, this.map._zoom);

		// Keep restoring view for every cell-cursor messages until we get this
		// call after receiving cell-cursor msg after setpart incoming msg.
		// Because it is guaranteed that cell-cursor messages belong to the new part
		// after setpart(incoming) msg.
		if (this.setPartRecvd)
			this.reset();
	}

	// This should be called to restore sheet's last scroll position if necessary and
	// returns whether the map should scroll to current cursor.
	public tryRestore(duplicateCursor: boolean, currentPart: number): boolean {
		let shouldScrollToCursor = false;
		const attemptRestore = (this.mayRestore && currentPart === this.restorePart);

		if (attemptRestore) {
			if (this.setPartRecvd && duplicateCursor)
				this.reset();
			if (!this.setPartRecvd)
				this.restoreView();
		}

		if ((!attemptRestore || this.setPartRecvd) && !duplicateCursor)
			shouldScrollToCursor = true;
		return shouldScrollToCursor;
	}

	private onCommandResult(e: any): void {
		if (!((e.commandName === '.uno:Undo' || e.commandName === '.uno:Redo') && e.success && e.result))
			return;

		const newTabs = e.result.newTabs;
		if (!newTabs || newTabs.length === 0)
			return;

		let centerOfSheetUpdated = false;
		if (e.result.type === 'ScUndoMoveTab') {
			const oldTabs = e.result.oldTabs;
			if (oldTabs) {
				const numTabs= Math.min(newTabs.length, oldTabs.length);
				for (let i = 0; i < numTabs; ++i) {
					this.updateOnSheetMoved(oldTabs[i], newTabs[i]);
				}
				centerOfSheetUpdated = true;
			}
		}
		else if (e.result.type === 'ScUndoDeleteTab') {
			for (let i = 0; i < newTabs.length; ++i) {
				this.updateOnSheetInsertion(newTabs[i]);
			}
			centerOfSheetUpdated = true;
		}
		else if (e.result.type === 'ScUndoInsertTab') {
			for (let i = 0; i < newTabs.length; ++i) {
				this.updateOnSheetDeleted(newTabs[i]);
			}
			centerOfSheetUpdated = true;
		}
		if (centerOfSheetUpdated) {
			const currentSheetNumber: number = this.map.getCurrentPartNumber();
			for (let i = 0; i < newTabs.length; ++i) {
				if (newTabs[i] === currentSheetNumber) {
					this.mayRestore = true;
					this.restorePart = currentSheetNumber;
					this.setPartRecvd = false;
					break;
				}
			}
		}
	}
}

}

L.SheetSwitchViewRestore = cool.SheetSwitchViewRestore;



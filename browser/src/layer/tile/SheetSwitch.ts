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
	private centerOfSheet: Map<string, any>;
	private mayRestore: boolean;
	private restorePart: string;
	private setPartRecvd: boolean;
	public currentSheetIndexReassigned: boolean;

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	constructor (map: any) {

		this.map = map;
		this.docLayer = this.map._docLayer;

		this.centerOfSheet = new Map<string, any>();
		this.mayRestore = false;
		this.restorePart = '';
		this.setPartRecvd = false;
		this.currentSheetIndexReassigned = false;

	}

	public saveCurrent(): void {
		const selectedPartHash = this.getHash(this.docLayer._selectedPart as number);
		if (selectedPartHash.length > 0) {
			this.centerOfSheet.set(selectedPartHash, this.map.getCenter());
		}
	}

	public setRestorePart(toPart: number): void {
		const toPartHash = this.getHash(toPart);
		this.mayRestore = this.centerOfSheet.has(toPartHash);
		this.restorePart = this.mayRestore ? toPartHash : '';
		this.setPartRecvd = false;
	}

	public save (toPart: number): void {
		if (!this.currentSheetIndexReassigned) {
			this.saveCurrent();
		} else {
			this.currentSheetIndexReassigned = false;
		}

		this.setRestorePart(toPart);
	}

	public gotSetPart(part: number): void {
		this.setPartRecvd = (this.getHash(part) === this.restorePart);
	}

	private getHash(part: number): string {
		const hash  = this.docLayer._partHashes[part];
		if (typeof hash === 'string')
			return hash;
		else
			return '';
	}
	// This resets the flags but not the center map.
	private reset (): void {
		this.restorePart = '';
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
		const currentPartHash = this.getHash(currentPart);
		let shouldScrollToCursor = false;
		const attemptRestore = (this.mayRestore && currentPartHash === this.restorePart);

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
}

}

L.SheetSwitchViewRestore = cool.SheetSwitchViewRestore;



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

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	constructor (map: any) {

		this.map = map;
		this.docLayer = this.map._docLayer;

		this.centerOfSheet = new Map<number, any>();
		this.mayRestore = false;
		this.restorePart = -1;
		this.setPartRecvd = false;


	}

	public save (toPart: number): void {

		this.centerOfSheet.set(this.docLayer._selectedPart as number, this.map.getCenter());
		this.mayRestore = this.centerOfSheet.has(toPart);
		this.restorePart = this.mayRestore ? toPart : -1;
		this.setPartRecvd = false;
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
}

}

L.SheetSwitchViewRestore = cool.SheetSwitchViewRestore;



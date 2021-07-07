/* eslint-disable */

/*
 * CRectangle extends CPolygon and creates a rectangle of given bounds.
 */

class CRectangle extends CPolygon {

	constructor(bounds: CBounds, options: any) {
		super(CRectangle.boundsToPointSet(bounds), options);
	}

	setBounds(bounds: CBounds) {
		this.setPointSet(CRectangle.boundsToPointSet(bounds));
	}

	public static boundsToPointSet(bounds: CBounds): CPointSet {
		if (!bounds.isValid()) {
			return new CPointSet();
		}
		return CPointSet.fromPointArray([bounds.getTopLeft(), bounds.getTopRight(), bounds.getBottomRight(), bounds.getBottomLeft(), bounds.getTopLeft()]);
	}
}

function getOptionsClone(baseOpts: any): any {
	// TODO: implement polyfill for Object.assign() instead.
	let newOpt: any = {};
	for (let prop in baseOpts) {
		if (Object.prototype.hasOwnProperty.call(baseOpts, prop)) {
			newOpt[prop] = baseOpts[prop];
		}
	}

	return newOpt;
}

// CCellCursor is used for drawing of the self and view cell-cursor on the canvas.
class CCellCursor extends CPathGroup {

	private cursorWeight: number = 2;
	private borderPaths: CRectangle[] = [];
	private innerContrastBorder: CRectangle;
	private options: any;

	constructor(bounds: CBounds, options: any) {
		super([]);
		if (options.weight != 1) {
			this.cursorWeight = Math.round(options.weight);
			options.weight = 1;
		}
		this.options = options;
		this.options.lineJoin = 'miter';
		this.options.lineCap = 'butt';

		this.setBounds(bounds);
	}

	setBounds(bounds: CBounds) {
		let cellBounds = new CBounds(
			bounds.min.subtract(new CPoint(0.5, 0.5)),
			bounds.max.subtract(new CPoint(0.5, 0.5))
		);

		// Compute bounds for border path.
		let boundsForBorder: CBounds[] = [];
		for (let idx = 0; idx < this.cursorWeight; ++idx) {
			let pixels = idx; // device pixels from real cell-border.
			boundsForBorder.push(new CBounds(
				cellBounds.min.add(new CPoint(pixels, pixels)),
				cellBounds.max.subtract(new CPoint(pixels, pixels))
			));
		}

		let boundsForContrastBorder = new CBounds(
			cellBounds.min.add(new CPoint(this.cursorWeight, this.cursorWeight)),
			cellBounds.max.subtract(new CPoint(this.cursorWeight, this.cursorWeight)));

		if (this.borderPaths && this.innerContrastBorder) {
			console.assert(this.borderPaths.length === this.cursorWeight);
			// Update the border path.
			this.borderPaths.forEach(function (borderPath, index) {
				borderPath.setBounds(boundsForBorder[index]);
			})
			// Update constrast path
			this.innerContrastBorder.setBounds(boundsForContrastBorder);

		} else {
			for (let index = 0; index < this.cursorWeight; ++index) {
				let borderOpt = getOptionsClone(this.options);
				borderOpt.name += '-border-' + index;
				let borderPath = new CRectangle(boundsForBorder[index], borderOpt);
				this.borderPaths.push(borderPath);
				this.push(borderPath);
			}

			let contrastBorderOpt = getOptionsClone(this.options);
			contrastBorderOpt.name += '-contrast-border';
			contrastBorderOpt.color = 'white';
			this.innerContrastBorder = new CRectangle(boundsForContrastBorder, contrastBorderOpt);
			this.push(this.innerContrastBorder);
		}
	}

	// This method is needed to allow setting up of a popup which is needed for showing
	// other user's name in it when the CCellCursor is used for displaying view cell cursors.
	bindPopup(content: any, options: any): CPath {
		// forward to the innermost black border rectangle.
		console.assert(this.borderPaths && this.borderPaths.length, 'borders not setup yet!');

		return this.borderPaths[0].bindPopup(content, options)
	}
}

// CCellSelection is used for drawing of the self and view cell-range selections on the canvas.
class CCellSelection extends CPathGroup {

	private selectionWeight: number = 2;
	private borderPaths: CPolygon[];
	private innerContrastBorder: CPolygon;
	private options: any;

	constructor(pointSet: CPointSet, options: any) {
		super([]);
		this.selectionWeight = Math.round(options.weight);
		options.weight = 1; // Selection has multiple paths each with weight 1.
		this.options = options;
		this.options.lineJoin = 'miter';
		this.options.lineCap = 'butt';

		this.setPointSet(pointSet);
	}

	// This method is used to create/update the internal CPaths with the correct positions and dimensions
	// using CPointSet data-structure.
	setPointSet(pointSet: CPointSet) {
		let outerPointSet = pointSet;
		outerPointSet.applyOffset(new CPoint(0.5, 0.5), false /* centroidSymmetry */, true /* preRound */);

		let borderPointSets: CPointSet[] = [];

		for (let idx = 0; idx < this.selectionWeight; ++idx) {
			let pixels = idx; // device pixels from real cell-border.
			let borderPset = outerPointSet.clone();
			borderPset.applyOffset(new CPoint(-pixels, -pixels), true /* centroidSymmetry */, false /* preRound */);
			borderPointSets.push(borderPset);
		}
		let contrastBorderPointSet = outerPointSet.clone();
		contrastBorderPointSet.applyOffset(new CPoint(-this.selectionWeight, -this.selectionWeight), true /* centroidSymmetry */, false /* preRound */)

		if (this.borderPaths && this.innerContrastBorder) {
			console.assert(this.borderPaths.length === this.selectionWeight);
			// Update the border path.
			this.borderPaths.forEach(function (borderPath, index) {
				borderPath.setPointSet(borderPointSets[index]);
			})
			this.innerContrastBorder.setPointSet(contrastBorderPointSet);

		} else {
			this.borderPaths = [];
			for (let index = 0; index < this.selectionWeight; ++index) {
				let borderOpt = getOptionsClone(this.options);
				borderOpt.fillColor = undefined;
				borderOpt.fillOpacity = undefined;
				borderOpt.fill = false;
				borderOpt.name += '-border-' + index;
				let borderPath = new CPolygon(borderPointSets[index], borderOpt);
				this.borderPaths.push(borderPath);
				this.push(borderPath);
			}

			let contrastBorderOpt = getOptionsClone(this.options);
			contrastBorderOpt.name += '-contrast-border';
			contrastBorderOpt.color = 'white';
			contrastBorderOpt.fill = true;
			this.innerContrastBorder = new CPolygon(contrastBorderPointSet, contrastBorderOpt);
			this.push(this.innerContrastBorder);
		}
	}

	getBounds(): CBounds {
		if (!this.borderPaths || !this.borderPaths.length)
			return new CBounds();
		return this.borderPaths[0].getBounds();
	}

	anyRingBoundContains(corePxPoint: CPoint): boolean {
		if (!this.borderPaths || !this.borderPaths.length)
			return false;

		return this.borderPaths[0].anyRingBoundContains(corePxPoint);
	}
}
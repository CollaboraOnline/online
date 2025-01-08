interface LatLng {
	lat: number;
	lng: number;
}

interface Point {
	x: number;
	y: number;
}

class Coordinate {
	private readonly _latLng: LatLng;
	private readonly _cssPixelOrigin: Point;
	private readonly _zoom: number;

	constructor(latLng: LatLng, cssPixelOrigin: Point, zoom: number) {
		this._latLng = latLng;
		this._cssPixelOrigin = cssPixelOrigin;
		this._zoom = zoom;
	}

	asDelta(): CoordinateDelta {
		if (this._zoom) {
			throw Error(
				'Cannot convert coordinate with an origin to a CoordinateDelta',
			);
		}

		return new CoordinateDelta(this._latLng);
	}

	cssPixelOrigin(): Readonly<Point> {
		return this._cssPixelOrigin;
	}

	/**
	 * Zoom the coordinate to a new zoom level such that returned pixel values use the new zoom, and return the zoomed coordinate
	 * @param zoom The new zoom level
	 * @param around A coordinate where the zoom will happen around (i.e. the lat/lng is constant against css pixels at both zoom levels). If none is provided, the coordinate will zoom around itself
	 * @returns The zoomed coordinate
	 */
	zoomTo(zoom: number, around?: Coordinate): Coordinate {
		if (around === undefined) {
			around = this;
		}

		const aroundCSSPixel = around.cssPixel();
		const scale = L.CRS.scale(zoom) / L.CRS.scale(this._zoom);

		return new Coordinate(
			this._latLng,
			{
				x: this._cssPixelOrigin.x * scale - (scale - 1) * aroundCSSPixel.x,
				y: this._cssPixelOrigin.y * scale - (scale - 1) * aroundCSSPixel.y,
			},
			zoom
		)
	}

	zoom(): number {
		return this._zoom;
	}

	/**
	 * Convert from a latitude/longitude (relative to the document) into a coordinate.
	 * @param lat The latitude of your LatLng
	 * @param lng The longitude of your LatLng
	 * @returns A CoordinateDelta with the provided lat/lng
	 */
	static fromLatLng(lat: number, lng: number, zoom: number): Coordinate {
		return new Coordinate({ lat, lng }, { x: 0, y: 0 }, zoom);
	}

	latLng(): Readonly<LatLng> {
		return this._latLng;
	}

	/**
	 * Convert from a CSS pixel (a pixel as understood by your browser) into a coordinate delta.
	 * @param x The x of your CSS pixel (often "pixel.x")
	 * @param y The y of your CSS pixel (often "pixel.y")
	 * @param zoom The zoom your pixel is understood at, the old `unproject` conversion defaulted to `map.getZoom()`
	 * @returns A CoordinateDelta which represents the same distance as your CSS pixel distance when at the same zoom level
	 */
	static fromCSSPixel(x: number, y: number, zoom: number): Coordinate {
		const latLng = L.CRS.pointToLatLng(L.point(x, y), zoom);
		return new Coordinate(latLng, { x: 0, y: 0 }, zoom);
	}

	cssPixel() {
		const latLngAsPixel = L.CRS.latLngToPoint(L.latLng(this._latLng), this._zoom);

		return {
			x: latLngAsPixel.x + this._cssPixelOrigin.x,
			y: latLngAsPixel.y + this._cssPixelOrigin.y,
		};
	}

	/**
	 * Convert from a Core pixel (a pixel as understood by core) into a coordinate delta.
	 * @param x The x of your CSS pixel (often "pixel.x")
	 * @param y The y of your CSS pixel (often "pixel.y")
	 * @param zoom The zoom your pixel is understood at, the old `unproject` conversion defaulted to `map.getZoom()`
	 * @returns A CoordinateDelta which represents the same distance as your Core pixel distance when at the same zoom level
	 */
	static fromCorePixel(x: number, y: number, zoom: number): Coordinate {
		const cssPixel = {
			x: x / app.dpiScale,
			y: y / app.dpiScale,
		};
		return Coordinate.fromCSSPixel(cssPixel.x, cssPixel.y, zoom);
	}

	corePixel() {
		const cssPixel = this.cssPixel();
		return {
			x: cssPixel.x * app.dpiScale,
			y: cssPixel.y * app.dpiScale,
		};
	}

	static fromTwip(
		x: number,
		y: number,
		zoom: number,
		docLayer: any,
	): Coordinate {
		const corePixel = {
			x: (x / docLayer._tileWidthTwips) * docLayer._tileSize,
			y: (y / docLayer._tileHeightTwips) * docLayer._tileSize,
		};
		return Coordinate.fromCorePixel(corePixel.x, corePixel.y, zoom);
	}

	twip(docLayer: any) {
		const corePixel = this.corePixel();
		return {
			x: (corePixel.x / docLayer._tileSize) * docLayer._tileWidthTwips,
			y: (corePixel.y / docLayer._tileSize) * docLayer._tileHeightTwips,
		};
	}

	subtract(other: CoordinateDelta): Coordinate;
	subtract(other: Coordinate): CoordinateDelta;
	subtract(other: Coordinate | CoordinateDelta): Coordinate | CoordinateDelta {
		if (other instanceof CoordinateDelta) {
			return new Coordinate(
				{
					lat: this._latLng.lat - other.latLng().lat,
					lng: this._latLng.lng - other.latLng().lng,
				},
				this._cssPixelOrigin,
				this._zoom,
			);
		}

		if (other.zoom() != this._zoom) {
			throw new Error(
				'Cannot subtract points which do not share a common zoom',
			);
		}

		if (
			other.cssPixelOrigin().x != this._cssPixelOrigin.x
			|| other.cssPixelOrigin().y != this._cssPixelOrigin.y
		) {
			throw new Error(
				'Cannot subtract points which do not share a common origin',
			);
		}

		return new CoordinateDelta({
			lat: this._latLng.lat - other.latLng().lat,
			lng: this._latLng.lng - other.latLng().lng,
		});
	}

	add(other: CoordinateDelta): Coordinate {
		return new Coordinate(
			{
				lat: this._latLng.lat - other.latLng().lat,
				lng: this._latLng.lng - other.latLng().lng,
			},
			this._cssPixelOrigin,
			this._zoom,
		);
	}

	divide(other: CoordinateDelta | number): CoordinateDelta {
		if (typeof other === 'number') {
			other = new CoordinateDelta({
				lat: other,
				lng: other,
			});
		}

		return new CoordinateDelta({
			lat: this._latLng.lat / other.latLng().lat,
			lng: this._latLng.lng / other.latLng().lng,
		});
	}

	multiply(other: CoordinateDelta | number): CoordinateDelta {
		if (typeof other === 'number') {
			other = new CoordinateDelta({
				lat: other,
				lng: other,
			});
		}

		return new CoordinateDelta({
			lat: this._latLng.lat * other.latLng().lat,
			lng: this._latLng.lng * other.latLng().lng,
		});
	}
}

class CoordinateDelta {
	private readonly _latLng: LatLng;

	constructor(latLng: LatLng) {
		this._latLng = latLng;
	}

	asAbsolute(atZoom: number): Coordinate {
		return new Coordinate(
			this._latLng,
			/* cssPixelOrigin */ { x: 0, y: 0 },
			atZoom,
		);
	}

	/**
	 * Convert from a latitude/longitude (relative to the document) into a coordinate delta.
	 * @param lat The latitude of your LatLng
	 * @param lng The longitude of your LatLng
	 * @returns A CoordinateDelta with the provided lat/lng
	 */
	static fromLatLng(lat: number, lng: number): CoordinateDelta {
		return new CoordinateDelta({ lat, lng });
	}

	latLng(): Readonly<LatLng> {
		return this._latLng;
	}

	/**
	 * Convert from a CSS pixel (a pixel as understood by your browser) into a coordinate delta.
	 * @param x The x of your CSS pixel (often "pixel.x")
	 * @param y The y of your CSS pixel (often "pixel.y")
	 * @param zoom The zoom your pixel is understood at, the old `unproject` conversion defaulted to `map.getZoom()`
	 * @returns A CoordinateDelta which represents the same distance as your CSS pixel distance when at the same zoom level
	 */
	static fromCSSPixel(x: number, y: number, zoom: number): CoordinateDelta {
		const latLng = L.CRS.pointToLatLng(L.point(x, y), zoom);
		return new CoordinateDelta(latLng);
	}

	cssPixel(zoom: number) {
		return L.CRS.latLngToPoint(L.latLng(this._latLng), zoom);
	}

	/**
	 * Convert from a Core pixel (a pixel as understood by core) into a coordinate delta.
	 * @param x The x of your CSS pixel (often "pixel.x")
	 * @param y The y of your CSS pixel (often "pixel.y")
	 * @param zoom The zoom your pixel is understood at, the old `unproject` conversion defaulted to `map.getZoom()`
	 * @returns A CoordinateDelta which represents the same distance as your Core pixel distance when at the same zoom level
	 */
	static fromCorePixel(x: number, y: number, zoom: number): CoordinateDelta {
		const cssPixel = {
			x: x / app.dpiScale,
			y: y / app.dpiScale,
		};
		return CoordinateDelta.fromCSSPixel(cssPixel.x, cssPixel.y, zoom);
	}

	corePixel(zoom: number) {
		return this.cssPixel(zoom).multiplyBy(app.dpiScale);
	}

	static fromTwip(
		x: number,
		y: number,
		zoom: number,
		docLayer: any,
	): Coordinate {
		const corePixel = {
			x: (x / docLayer._tileWidthTwips) * docLayer._tileSize,
			y: (y / docLayer._tileHeightTwips) * docLayer._tileSize,
		};
		return Coordinate.fromCorePixel(corePixel.x, corePixel.y, zoom);
	}

	twip(zoom: number, docLayer: any) {
		const corePixel = this.corePixel(zoom);
		return {
			x: (corePixel.x / docLayer._tileSize) * docLayer._tileWidthTwips,
			y: (corePixel.y / docLayer._tileSize) * docLayer._tileHeightTwips,
		};
	}

	subtract(other: CoordinateDelta): CoordinateDelta {
		return new CoordinateDelta({
			lat: this._latLng.lat - other.latLng().lat,
			lng: this._latLng.lng - other.latLng().lng,
		});
	}

	add(other: CoordinateDelta): CoordinateDelta {
		return new CoordinateDelta({
			lat: this._latLng.lat - other.latLng().lat,
			lng: this._latLng.lng - other.latLng().lng,
		});
	}

	divide(other: CoordinateDelta | number): CoordinateDelta {
		if (typeof other === 'number') {
			other = new CoordinateDelta({
				lat: other,
				lng: other,
			});
		}

		return new CoordinateDelta({
			lat: this._latLng.lat / other.latLng().lat,
			lng: this._latLng.lng / other.latLng().lng,
		});
	}

	multiply(other: CoordinateDelta | number): CoordinateDelta {
		if (typeof other === 'number') {
			other = new CoordinateDelta({
				lat: other,
				lng: other,
			});
		}

		return new CoordinateDelta({
			lat: this._latLng.lat * other.latLng().lat,
			lng: this._latLng.lng * other.latLng().lng,
		});
	}
}

class CoordinateBounds {
	min: Coordinate;
	max: Coordinate;

	constructor(min: Coordinate, max: Coordinate) {
		this.min = min;
		this.max = max;
	}

	static fromCorePixelBounds(min: Point, max: Point, zoom: number): CoordinateBounds {
		return new CoordinateBounds(
			Coordinate.fromCorePixel(min.x, min.y, zoom),
			Coordinate.fromCorePixel(max.x, max.y, zoom)
		);
	}

	center(): Coordinate {
		return this.min.add(this.max.subtract(this.min).divide(2));
	}
}

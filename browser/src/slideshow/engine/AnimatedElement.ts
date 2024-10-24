/* -*- tab-width: 4 -*- */

/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

declare var app: any;

type BoundingBoxType = DOMRect;

type AnimatedObjectType = ImageBitmap;

const NSS_SVG = 'http://www.w3.org/2000/svg';

enum PropertyValueType {
	Unknown,
	Number,
	Enum,
	Color,
	String,
	Bool,
	TupleNumber,
}

namespace PropertyOperators {
	const GenericPropOpSet = {
		equal: (a: any, b: any) => {
			return a === b;
		},
		add: (a: any, b: any) => {
			return a;
		},
		scale: (k: any, v: any) => {
			return v;
		},
	};
	const NumberPropOpSet = {
		equal: (a: number, b: number) => {
			return a === b;
		},
		add: (a: number, b: number) => {
			return a + b;
		},
		scale: (k: number, v: number) => {
			return k * v;
		},
	};
	const TupleNumberPropOpSet = {
		equal: (a: number[], b: number[]) => {
			assert(a.length === b.length, 'Tuples length mismatch.');
			return a.toString() === b.toString();
		},
		add: (a: number[], b: number[]) => {
			assert(a.length === b.length, 'Tuples length mismatch.');
			const r: number[] = [];
			for (let i = 0; i < a.length; ++i) {
				r.push(a[i] + b[i]);
			}
			return r;
		},
		scale: (k: number, v: number[]) => {
			const r: number[] = [];
			for (let i = 0; i < v.length; ++i) {
				r.push(k * v[i]);
			}
			return r;
		},
	};

	export type PropOpSet = typeof GenericPropOpSet;
	export type PropertyOperatorsMap = Map<PropertyValueType, PropOpSet>;
	export const aOperatorSetMap: PropertyOperatorsMap = new Map();
	aOperatorSetMap.set(PropertyValueType.Number, NumberPropOpSet);
	aOperatorSetMap.set(PropertyValueType.Enum, GenericPropOpSet);
	aOperatorSetMap.set(PropertyValueType.String, GenericPropOpSet);
	aOperatorSetMap.set(PropertyValueType.Bool, GenericPropOpSet);
	aOperatorSetMap.set(PropertyValueType.TupleNumber, TupleNumberPropOpSet);
}

type PropertyOperatorSet = PropertyOperators.PropOpSet;
type PropertyOperatorsMap = PropertyOperators.PropertyOperatorsMap;
const aOperatorSetMap = PropertyOperators.aOperatorSetMap;

type PropertyInterpolatorType = (nFrom: any, nTo: any, nT: number) => any;

namespace PropertyInterpolator {
	const aLinearLerpFunctor = new Map([
		[
			PropertyValueType.Number,
			(nFrom: any, nTo: any, nT: number): any => {
				return (1.0 - nT) * nFrom + nT * nTo;
			},
		],
		[
			PropertyValueType.TupleNumber,
			(aFrom: any, aTo: any, nT: number): any => {
				const aRes = [];
				for (let i = 0; i < aFrom.length; ++i) {
					aRes.push((1.0 - nT) * aFrom[i] + nT * aTo[i]);
				}
				return aRes as any;
			},
		],
	]);

	type LerpFunctorMap = Map<CalcMode, typeof aLinearLerpFunctor>;
	const aLerpFunctorMap: LerpFunctorMap = new Map();
	aLerpFunctorMap.set(CalcMode.Linear, aLinearLerpFunctor);

	export function getInterpolator(
		eCalcMode: CalcMode,
		eValueType: PropertyValueType,
	): PropertyInterpolatorType {
		if (
			aLerpFunctorMap.has(eCalcMode) &&
			aLerpFunctorMap.get(eCalcMode).has(eValueType)
		) {
			return aLerpFunctorMap.get(eCalcMode).get(eValueType);
		}
		window.app.console.log(
			'aInterpolatorHandler.getInterpolator: not found any valid interpolator for calc mode ' +
				CalcMode[eCalcMode] +
				' and value type ' +
				PropertyValueType[eValueType],
		);
		return null;
	}
}

interface PropertyGetterSetter {
	type: PropertyValueType;
	get: string;
	set: string;
	getmod?: string;
	setmod?: string;
}

const aPropertyGetterSetterMap = {
	height: {
		type: PropertyValueType.Number,
		get: 'getHeight',
		set: 'setHeight',
		getmod: 'makeScaler( 1/nHeight )',
		setmod: 'makeScaler( nHeight)',
	},

	opacity: {
		type: PropertyValueType.Number,
		get: 'getOpacity',
		set: 'setOpacity',
	},

	scale: {
		type: PropertyValueType.TupleNumber,
		get: 'getSize',
		set: 'setSize',
	},

	translate: {
		type: PropertyValueType.TupleNumber,
		get: 'getPos',
		set: 'setPos',
	},

	rotate: {
		type: PropertyValueType.Number,
		get: 'getRotationAngle',
		set: 'setRotationAngle',
	},

	skewx: {
		type: PropertyValueType.Number,
		get: 'getSkewX',
		set: 'setSkewX',
	},

	skewy: {
		type: PropertyValueType.Number,
		get: 'getSkewY',
		set: 'setSkewY',
	},

	width: {
		type: PropertyValueType.Number,
		get: 'getWidth',
		set: 'setWidth',
		getmod: 'makeScaler( 1/nWidth )',
		setmod: 'makeScaler( nWidth)',
	},

	x: {
		type: PropertyValueType.Number,
		get: 'getX',
		set: 'setX',
		getmod: 'makeScaler( 1/nWidth )',
		setmod: 'makeScaler( nWidth)',
	},

	y: {
		type: PropertyValueType.Number,
		get: 'getY',
		set: 'setY',
		getmod: 'makeScaler( 1/nHeight )',
		setmod: 'makeScaler( nHeight)',
	},

	visibility: {
		type: PropertyValueType.Enum,
		get: 'getVisibility',
		set: 'setVisibility',
	},
};

type PropertyGetterSetterMapKeyType = keyof typeof aPropertyGetterSetterMap;

interface TransitionFilterFrameInfo {
	animation: TransitionFilterAnimation;
	time: number;
}

interface TransitionFiltersState {
	filterQueue: Array<number>;
	frameInfoMap: Map<number, TransitionFilterFrameInfo>;
}

class TransitionFiltersManager {
	private filterQueue = new Array<number>();
	private frameInfoMap = new Map<number, TransitionFilterFrameInfo>();

	public isEmpty() {
		return this.filterQueue.length === 0;
	}

	public add(animation: TransitionFilterAnimation, time: number) {
		this.frameInfoMap.set(animation.getNodeId(), {
			animation: animation,
			time: time,
		});
		this.updateQueue(animation.getNodeId());
	}

	private updateQueue(nodeId: number) {
		const length = this.filterQueue.length;
		const last = this.filterQueue[length];
		if (nodeId === last) return;
		const index = this.filterQueue.indexOf(nodeId);
		if (index > -1) {
			// remove it
			this.filterQueue.splice(index, 1);
		}
		this.filterQueue.push(nodeId);
	}

	public apply(properties?: AnimatedElementRenderProperties): boolean {
		let applied = false;
		this.filterQueue.forEach((nodeId) => {
			const frameInfo = this.frameInfoMap.get(nodeId);
			if (frameInfo) {
				applied = true;
				ANIMDBG.print(`TransitionFiltersManager.apply: node: ${nodeId}`);
				frameInfo.animation.renderFrame(frameInfo.time, properties);
			}
		});
		return applied;
	}

	public clear() {
		this.frameInfoMap.forEach((frameInfo) => {
			frameInfo.animation.notifySlideEnd();
		});
		this.filterQueue = [];
		this.frameInfoMap.clear();
	}

	public getState(): TransitionFiltersState {
		return {
			filterQueue: structuredClone(this.filterQueue),
			frameInfoMap: new Map(this.frameInfoMap),
		};
	}

	public setState(state: TransitionFiltersState) {
		this.filterQueue = structuredClone(state.filterQueue);
		this.frameInfoMap = new Map(state.frameInfoMap);
	}
}

interface AnimatedElementState {
	nCenterX: number;
	nCenterY: number;
	nScaleFactorX: number;
	nScaleFactorY: number;
	nRotationAngle: number;
	nSkewX: number;
	nSkewY: number;
	aTMatrix: DOMMatrix;
	nOpacity: number;
	bVisible: boolean;
	transitionFiltersState: TransitionFiltersState;
}

type BoundsType = [DOMPoint, DOMPoint, DOMPoint, DOMPoint];

interface AnimatedElementRenderProperties {
	bounds: BoundsType;
	alpha: number;
}

function BBoxToString(aBB: BoundingBoxType) {
	return `{ x: ${aBB.x}, y: ${aBB.y}, width: ${aBB.width}, height: ${aBB.height} }`;
}

class AnimatedElement {
	public static readonly SupportedProperties = new Set<string>([
		'x',
		'y',
		'width',
		'height',
		'opacity',
		'visibility',
		'rotate',
		'skewx',
		'skewy',
	]);

	public static readonly SupportedTransformations = new Set<string>([
		'translate',
		'scale',
		'rotate',
	]);

	private sId: string;
	private slideHash: string;
	private slideWidth: number;
	private slideHeight: number;
	private canvasWidth: number;
	private canvasHeight: number;
	private bIsValid: boolean;
	private slideRenderer: SlideRenderer;
	private animatedLayerInfo: AnimatedShapeInfo = null;
	private aLayer: ImageBitmap = null;
	private canvasScaleFactor: { x: number; y: number };
	private aBaseBBox: BoundingBoxType = null;
	private aBBoxInCanvas: BoundingBoxType;
	private aBaseElement: AnimatedObjectType;
	private nBaseCenterX: number = 0;
	private nBaseCenterY: number = 0;
	private aActiveBBox: BoundingBoxType;
	private aActiveElement: AnimatedObjectType;
	private eAdditiveMode = AdditiveMode.Replace;
	private aStateSet = new Map<number, AnimatedElementState>();
	private nCenterX: number;
	private nCenterY: number;
	private nScaleFactorX: number = 1.0;
	private nScaleFactorY: number = 1.0;
	private nRotationAngle: number = 0;
	private nSkewX: number = 0;
	private nSkewY: number = 0;
	private aTMatrix: DOMMatrix;
	private nOpacity: number; // [0, 1]
	private bVisible: boolean;
	private aClipPath: SVGPathElement = null;
	private runningAnimations: number = 0;

	private tfContext: RenderContextGl;
	private transitionFiltersManager: TransitionFiltersManager;

	constructor(
		sId: string,
		slideHash: string,
		slideWidth: number,
		slideHeight: number,
	) {
		ANIMDBG.print(`AnimatedElement(${sId}, ${slideHash})`);
		this.sId = sId;
		this.slideHash = slideHash;
		this.slideWidth = slideWidth;
		this.slideHeight = slideHeight;
		this.bIsValid = false;

		this.transitionFiltersManager = new TransitionFiltersManager();

		const presenter: SlideShowPresenter = app.map.slideShowPresenter;
		this.slideRenderer = presenter._slideRenderer;
	}

	getId() {
		return this.sId;
	}

	public isValid() {
		return this.bIsValid;
	}

	private isGlSupported() {
		return !this.tfContext.is2dGl();
	}

	private cloneBBox(aBBox: BoundingBoxType): BoundingBoxType {
		if (!aBBox) return null;
		return new DOMRect(aBBox.x, aBBox.y, aBBox.width, aBBox.height);
	}

	private createBaseElement(
		layer: ImageBitmap,
		bounds: BoundingBoxType,
	): AnimatedObjectType {
		const canvas = new OffscreenCanvas(bounds.width, bounds.height);
		const context = canvas.getContext('2d');
		context.drawImage(
			layer,
			bounds.x,
			bounds.y,
			bounds.width,
			bounds.height,
			0,
			0,
			bounds.width,
			bounds.height,
		);
		return canvas.transferToImageBitmap();
	}

	private clone(aElement: AnimatedObjectType): AnimatedObjectType {
		if (!aElement) return null;
		const canvas = new OffscreenCanvas(aElement.width, aElement.height);
		const context = canvas.getContext('2d');
		context.drawImage(aElement, 0, 0, canvas.width, canvas.height);
		return canvas.transferToImageBitmap();
	}

	public updateCanvasSize(size: [number, number]) {
		this.canvasWidth = size[0];
		this.canvasHeight = size[1];
		this.canvasScaleFactor = {
			x: this.canvasWidth / this.slideWidth,
			y: this.canvasHeight / this.slideHeight,
		};
		console.debug(
			`AnimatedElement.updateCanvasSize: (${this.canvasWidth}x${this.canvasHeight}), scale factor: ${this.canvasScaleFactor}`,
		);
	}

	public updateAnimationInfo(animatedLayerInfo: AnimatedShapeInfo) {
		if (!animatedLayerInfo) {
			// create a dummy bounding box for not break animation engine
			this.aBaseBBox = new DOMRect(0, 0, 1920, 1080);
			window.app.console.log(
				'AnimatedElement.updateAnimationInfo: passed info is not valid',
			);
			return;
		}
		this.animatedLayerInfo = animatedLayerInfo;

		this.aLayer = (this.animatedLayerInfo.content as ImageInfo).data;
		if (!this.aLayer) {
			window.app.console.log(
				'AnimatedElement.updateAnimationInfo: layer not valid',
			);
		}

		this.aBaseBBox = this.cloneBBox(this.animatedLayerInfo.bounds);
		({ x: this.nBaseCenterX, y: this.nBaseCenterY } = getRectCenter(
			this.aBaseBBox,
		));
		this.aBBoxInCanvas = convert(this.canvasScaleFactor, this.aBaseBBox);
		this.aBaseElement = this.createBaseElement(this.aLayer, this.aBBoxInCanvas);

		this.DBG(
			'.updateAnimationInfo: ' +
				`\n  aBaseBBox: ${BBoxToString(this.aBaseBBox)}` +
				`\n  aBBoxInCanvas: ${BBoxToString(this.aBBoxInCanvas)}` +
				`\n  base center: x: ${this.nBaseCenterX} y: ${this.nBaseCenterY}`,
		);

		this.bIsValid = true;
	}

	private getTextureFromElement(element: AnimatedObjectType) {
		return this.tfContext.loadTexture(element);
	}

	public setTransitionParameters(transitionParameters: TransitionParameters) {
		if (!this.tfContext) {
			const layerCompositor = this.getLayerCompositor();
			if (!layerCompositor) {
				window.app.console.error(
					'AnimatedElement.setTransitionParameters: layer compositor is undefined',
				);
				return;
			}
			this.tfContext = layerCompositor.getLayerRendererContext();
			if (!this.tfContext) {
				window.app.console.error(
					'AnimatedElement.setTransitionParameters: layer renderer context is undefined',
				);
				return;
			}
		}

		transitionParameters.context = this.tfContext;
		transitionParameters.current = null;
		transitionParameters.next = this.getTextureFromElement(this.aBaseElement);
	}

	private resetProperties() {
		this.nCenterX = this.nBaseCenterX;
		this.nCenterY = this.nBaseCenterY;
		this.nScaleFactorX = 1.0;
		this.nScaleFactorY = 1.0;
		this.nRotationAngle = 0.0;
		this.nSkewX = 0.0;
		this.nSkewY = 0.0;
		this.aTMatrix = new DOMMatrix([1, 0, 0, 1, 0, 0]);
		this.nOpacity = 1;
		this.bVisible = this.animatedLayerInfo
			? this.animatedLayerInfo.initVisible
			: false;
		this.transitionFiltersManager.clear();
		// this.aActiveBBox = this.cloneBBox(this.aBaseBBox);
	}

	initClipPath() {
		this.aClipPath = document.createElementNS(NSS_SVG, 'path');

		const nWidth = this.aActiveBBox.width;
		const nHeight = this.aActiveBBox.height;
		const sPathData =
			'M ' +
			this.aActiveBBox.x +
			' ' +
			this.aActiveBBox.y +
			' h ' +
			nWidth +
			' v ' +
			nHeight +
			' h -' +
			nWidth +
			' z';
		this.aClipPath.setAttribute('d', sPathData);
	}

	cleanClipPath() {
		this.aClipPath = null;
	}

	private getLayerCompositor(): SlideCompositor {
		const presenter: SlideShowPresenter = app.map.slideShowPresenter;
		if (presenter) {
			return presenter._slideCompositor;
		}
		return null;
	}

	applyTransitionFilters(
		properties?: AnimatedElementRenderProperties,
	): boolean {
		if (this.transitionFiltersManager.isEmpty() || !this.isGlSupported()) {
			return false;
		}
		return this.transitionFiltersManager.apply(properties);
	}

	renderLayer(renderer: LayerRenderer) {
		if (!this.bVisible) return;
		if (renderer instanceof LayerRendererGl) this.renderLayerGl(renderer);
		else if (renderer instanceof LayerRenderer2d) this.renderLayer2d(renderer);
	}

	renderLayer2d(renderer: LayerRenderer2d) {
		const renderContext = renderer.getRenderContext();
		const renderingContext = renderContext.get2dOffscreen();

		renderingContext.save();
		// renderingContext.scale(sf.x, sf.y);

		// factor to convert from slide coordinate to canvas coordinate
		const sf = this.canvasScaleFactor;

		renderingContext.globalAlpha = this.nOpacity;

		const T = this.aTMatrix;
		const transform = new DOMMatrix([
			T.a,
			T.b,
			T.c,
			T.d,
			T.e * sf.x,
			T.f * sf.y,
		]);
		renderingContext.setTransform(transform);

		const aElement = this.aBaseElement;
		console.debug(
			`AnimatedElement(${this.sId}).renderLayer2d:
				element width: ${aElement.width}
				element height: ${aElement.height}
				base center: (${this.nBaseCenterX}, ${this.nBaseCenterY})
				actual center: (${this.nCenterX}, ${this.nCenterY})
				transform: ${transform.toString()}`,
		);

		// renderingContext.drawImage(
		// 	aElement,
		// 	0,
		// 	0,
		// 	aElement.width,
		// 	aElement.height,
		// 	this.aBaseBBox.x,
		// 	this.aBaseBBox.y,
		// 	this.aBaseBBox.width,
		// 	this.aBaseBBox.height,
		// );

		renderingContext.drawImage(
			aElement,
			0,
			0,
			aElement.width,
			aElement.height,
			this.aBBoxInCanvas.x,
			this.aBBoxInCanvas.y,
			aElement.width,
			aElement.height,
		);
		renderingContext.restore();
	}

	renderLayerGl(renderer: LayerRendererGl) {
		const T = this.aTMatrix;

		console.debug(
			`AnimatedElement(${this.sId}).renderLayerGl:
				element width: ${this.aBaseElement.width}
				element height: ${this.aBaseElement.height}
				base center: (${this.nBaseCenterX}, ${this.nBaseCenterY})
				actual center: (${this.nCenterX}, ${this.nCenterY})
				transform: ${T.toString()}`,
		);

		const tl = new DOMPoint(this.aBaseBBox.x, this.aBaseBBox.y);
		const br = new DOMPoint(
			tl.x + this.aBaseBBox.width,
			tl.y + this.aBaseBBox.height,
		);
		const bl = new DOMPoint(tl.x, br.y);
		const tr = new DOMPoint(br.x, tl.y);

		const unitBounds = [];
		for (const v of [bl, br, tl, tr]) {
			const u = v.matrixTransform(T);
			u.x = u.x / this.slideWidth;
			u.y = u.y / this.slideHeight;
			unitBounds.push(u);
		}

		const properties: AnimatedElementRenderProperties = {
			bounds: unitBounds as BoundsType,
			alpha: this.nOpacity,
		};

		if (this.applyTransitionFilters(properties)) return;

		renderer.drawBitmap(this.aBaseElement, properties);
	}

	notifySlideStart(aSlideShowContext: SlideShowContext) {
		this.runningAnimations = 0;

		// this.aActiveElement = this.clone(this.aBaseElement);

		this.resetProperties();
		this.DBG('.notifySlideStart invoked');
	}

	notifySlideEnd() {
		this.transitionFiltersManager.clear();
	}

	notifyAnimationStart() {
		if (!this.isActive()) {
			this.slideRenderer.notifyAnimationStarted(this.sId);
		}
		++this.runningAnimations;
	}

	isActive(): boolean {
		return this.runningAnimations > 0;
	}

	notifyAnimationEnd() {
		if (this.runningAnimations <= 0) {
			window.app.console.log(
				'AnimatedElement.notifyAnimationEnd: running animations <= 0',
			);
			return;
		}
		--this.runningAnimations;
		if (!this.isActive()) {
			this.slideRenderer.notifyAnimationEnded(this.sId);
		}
	}

	notifyNextEffectStart(nEffectIndex?: number) {
		// empty body
	}

	// TODO remove it
	setToElement(aElement: AnimatedObjectType) {
		if (!aElement) {
			window.app.console.log(
				'AnimatedElement(' +
					this.getId() +
					').setToElement: element is not valid',
			);
			return false;
		}

		this.aActiveElement = this.clone(aElement);
		return true;
	}

	/** saveState
	 *  Save the state of the managed animated element and append it to aStateSet
	 *  using the passed animation node id as key.
	 *
	 *  @param nAnimationNodeId
	 *      A non negative integer representing the unique id of an animation node.
	 */
	saveState(nAnimationNodeId: number) {
		ANIMDBG.print(
			'AnimatedElement(' +
				this.getId() +
				').saveState(' +
				nAnimationNodeId +
				')',
		);
		const aState: AnimatedElementState = {
			nCenterX: this.nCenterX,
			nCenterY: this.nCenterY,
			nScaleFactorX: this.nScaleFactorX,
			nScaleFactorY: this.nScaleFactorY,
			nRotationAngle: this.nRotationAngle,
			nSkewX: this.nSkewX,
			nSkewY: this.nSkewY,
			aTMatrix: DOMMatrix.fromMatrix(this.aTMatrix),
			nOpacity: this.nOpacity,
			bVisible: this.bVisible,
			transitionFiltersState: this.transitionFiltersManager.getState(),
		};
		this.aStateSet.set(nAnimationNodeId, aState);
	}

	/** restoreState
	 *  Restore the state of the managed animated element to the state with key
	 *  the passed animation node id.
	 *
	 *  @param nAnimationNodeId
	 *      A non negative integer representing the unique id of an animation node.
	 *
	 *  @return
	 *      True if the restoring operation is successful, false otherwise.
	 */
	restoreState(nAnimationNodeId: number) {
		if (!this.aStateSet.has(nAnimationNodeId)) {
			window.app.console.log(
				'AnimatedElement(' +
					this.getId() +
					').restoreState: state ' +
					nAnimationNodeId +
					' is not valid',
			);
			return false;
		}

		ANIMDBG.print(
			'AnimatedElement(' +
				this.getId() +
				').restoreState(' +
				nAnimationNodeId +
				')',
		);

		const aState = this.aStateSet.get(nAnimationNodeId);
		const bRet = true;
		if (bRet) {
			this.nCenterX = aState.nCenterX;
			this.nCenterY = aState.nCenterY;
			this.nScaleFactorX = aState.nScaleFactorX;
			this.nScaleFactorY = aState.nScaleFactorY;
			this.nRotationAngle = aState.nRotationAngle;
			this.nSkewX = aState.nSkewX;
			this.nSkewY = aState.nSkewY;
			this.aTMatrix = aState.aTMatrix;
			this.nOpacity = aState.nOpacity;
			this.bVisible = aState.bVisible;
			this.transitionFiltersManager.setState(aState.transitionFiltersState);
		}
		// we need to trigger at least one request animation frame for SlideRenderer.render method
		// maybe we could implement a SlideRenderer.oneShot method.
		this.notifyAnimationStart();
		this.notifyAnimationEnd();

		return bRet;
	}

	getBaseBBox() {
		return this.aBaseBBox;
	}

	getBaseCenterX() {
		return this.nBaseCenterX;
	}

	getBaseCenterY() {
		return this.nBaseCenterY;
	}

	applyTransform() {
		// empty body
	}

	getAdditiveMode() {
		return this.eAdditiveMode;
	}

	setAdditiveMode(eAdditiveMode: AdditiveMode) {
		this.eAdditiveMode = eAdditiveMode;
	}

	private updateTransformationMatrix() {
		const aTMatrix = new DOMMatrix([1, 0, 0, 1, 0, 0]);
		const skewXAngle = (180 * Math.atan(this.nSkewX)) / Math.PI;
		const skewYAngle = (180 * Math.atan(this.nSkewY)) / Math.PI;
		aTMatrix
			.translateSelf(this.nCenterX, this.nCenterY)
			.rotateSelf(this.nRotationAngle)
			.scaleSelf(this.nScaleFactorX, this.nScaleFactorY)
			.skewXSelf(skewYAngle)
			.skewXSelf(skewXAngle)
			.translateSelf(-this.nBaseCenterX, -this.nBaseCenterY);
		this.aTMatrix = aTMatrix;
	}

	// Get/Set Properties
	getX() {
		return this.nCenterX;
	}

	getY() {
		return this.nCenterY;
	}

	getPos() {
		return [this.getX(), this.getY()];
	}

	getWidth() {
		return this.nScaleFactorX * this.getBaseBBox().width;
	}

	getHeight() {
		return this.nScaleFactorY * this.getBaseBBox().height;
	}

	getSize() {
		return [this.getWidth(), this.getHeight()];
	}

	setX(nNewCenterX: number) {
		ANIMDBG.print('AnimatedElement.setX(' + nNewCenterX + ')');
		if (nNewCenterX === this.nCenterX) return;

		this.aTMatrix.translateSelf(nNewCenterX - this.nCenterX, 0);
		this.nCenterX = nNewCenterX;
	}

	setY(nNewCenterY: number) {
		ANIMDBG.print('AnimatedElement.setY(' + nNewCenterY + ')');
		if (nNewCenterY === this.nCenterY) return;

		this.aTMatrix.translateSelf(0, nNewCenterY - this.nCenterY);
		this.nCenterY = nNewCenterY;
	}

	setPos(aNewPos: [number, number]) {
		const nNewCenterX = aNewPos[0];
		const nNewCenterY = aNewPos[1];
		ANIMDBG.print(
			'AnimatedElement.setPos(' + nNewCenterX + ', ' + nNewCenterY + ')',
		);

		if (nNewCenterX === this.nCenterX && nNewCenterY === this.nCenterY) return;

		this.aTMatrix.translateSelf(
			nNewCenterX - this.nCenterX,
			nNewCenterY - this.nCenterY,
		);
		this.nCenterX = nNewCenterX;
		this.nCenterY = nNewCenterY;
	}

	setWidth(nNewWidth: number) {
		ANIMDBG.print('AnimatedElement.setWidth(' + nNewWidth + ')');

		const nBaseWidth = this.getBaseBBox().width;
		let nScaleFactorX = nNewWidth / nBaseWidth;

		if (Math.abs(nScaleFactorX) < 1e-5)
			nScaleFactorX = Math.sign(nScaleFactorX) * 1e-5;
		if (nScaleFactorX == this.nScaleFactorX) return;

		this.nScaleFactorX = nScaleFactorX;
		this.updateTransformationMatrix();
	}

	setHeight(nNewHeight: number) {
		ANIMDBG.print('AnimatedElement.setHeight(' + nNewHeight + ')');

		const nBaseHeight = this.getBaseBBox().height;
		let nScaleFactorY = nNewHeight / nBaseHeight;

		if (Math.abs(nScaleFactorY) < 1e-5)
			nScaleFactorY = Math.sign(nScaleFactorY) * 1e-5;
		if (nScaleFactorY == this.nScaleFactorY) return;

		this.nScaleFactorY = nScaleFactorY;
		this.updateTransformationMatrix();
	}

	setSize(aNewSize: [number, number]) {
		const nNewWidth = aNewSize[0];
		const nNewHeight = aNewSize[1];
		ANIMDBG.print(
			'AnimatedElement.setSize(' + nNewWidth + ', ' + nNewHeight + ')',
		);

		const nBaseWidth = this.getBaseBBox().width;
		let nScaleFactorX = nNewWidth / nBaseWidth;
		if (Math.abs(nScaleFactorX) < 1e-5)
			nScaleFactorX = Math.sign(nScaleFactorX) * 1e-5;

		const nBaseHeight = this.getBaseBBox().height;
		let nScaleFactorY = nNewHeight / nBaseHeight;
		if (Math.abs(nScaleFactorY) < 1e-5)
			nScaleFactorY = Math.sign(nScaleFactorY) * 1e-5;

		if (
			nScaleFactorX == this.nScaleFactorX &&
			nScaleFactorY == this.nScaleFactorY
		)
			return;

		this.nScaleFactorX = nScaleFactorX;
		this.nScaleFactorY = nScaleFactorY;
		this.updateTransformationMatrix();
	}

	getOpacity() {
		return this.nOpacity;
	}

	setOpacity(nValue: number) {
		this.nOpacity = clampN(nValue, 0, 1);
		ANIMDBG.print('AnimatedElement.setOpacity(' + nValue + ')');
	}

	getRotationAngle() {
		return this.nRotationAngle;
	}

	setRotationAngle(nNewRotAngle: number) {
		this.nRotationAngle = nNewRotAngle;
		this.updateTransformationMatrix();
		ANIMDBG.print('AnimatedElement.setRotationAngle(' + nNewRotAngle + ')');
	}

	getSkewX() {
		return this.nSkewX;
	}

	setSkewX(nSkewValue: number) {
		this.nSkewX = nSkewValue;
		this.updateTransformationMatrix();
		ANIMDBG.print('AnimatedElement.setSkewX(' + nSkewValue + ')');
	}

	getSkewY() {
		return this.nSkewY;
	}

	setSkewY(nSkewValue: number) {
		this.nSkewY = nSkewValue;
		this.updateTransformationMatrix();
		ANIMDBG.print('AnimatedElement.setSkewY(' + nSkewValue + ')');
	}

	getVisibility(): boolean {
		return this.bVisible;
	}

	setVisibility(sValue: string) {
		this.bVisible = sValue === 'visible';
		console.debug('AnimatedElement.setVisibility(' + sValue + ')');
	}

	getFillColor(): any {
		window.app.console.log('AnimatedElement.getFillColor() not implemented');
		return null;
	}

	setFillColor(aRGBValue: any) {
		window.app.console.log(
			'AnimatedElement.setFillColor(' + aRGBValue + ') not implemented',
		);
	}

	getStrokeColor(): any {
		window.app.console.log('AnimatedElement.getStrokeColor() not implemented');
		return null;
	}

	setStrokeColor(aRGBValue: any) {
		window.app.console.log(
			'AnimatedElement.setStrokeColor(' + aRGBValue + ') not implemented',
		);
	}

	setClipPath(aClipPath: SVGPathElement) {
		// TODO: maybe we can reuse the path for creating a texture mask
		if (this.aClipPath) {
			// We need to translate the clip path to the top left corner of
			// the element bounding box.
			// var aTranslation = SVGIdentityMatrix.translate( this.aActiveBBox.x,
			// 	this.aActiveBBox.y);
			// aClipPath.matrixTransform( aTranslation );
			const sPathData = aClipPath.getAttribute('d');
			this.aClipPath.setAttribute('d', sPathData);
		}
	}

	setTransitionFilterFrame(
		aTransitionFilterAnimation: TransitionFilterAnimation,
		nT: number,
	) {
		this.transitionFiltersManager.add(aTransitionFilterAnimation, nT);
	}

	DBG(sMessage: string, nTime?: number) {
		aAnimatedElementDebugPrinter.print(
			'AnimatedElement(' + this.getId() + ')' + sMessage,
			nTime,
		);
	}
}

class AnimatedTextElement extends AnimatedElement {
	// TODO: to be implemented
}

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

type GetterType = () => any;
type SetterType = (x: any) => any;

abstract class AnimationBase {
	public abstract start(aAnimatableElement: AnimatedElement): void;

	public abstract perform(aValue: any): void;

	public abstract end(): void;

	public abstract getUnderlyingValue(): any;
}

class GenericAnimation extends AnimationBase {
	protected readonly aGetValueFunc: GetterType;
	protected readonly aSetValueFunc: SetterType;
	private readonly aGetModifier: SetterType;
	private readonly aSetModifier: SetterType;
	private aAnimatableElement: AnimatedElement;
	private bAnimationStarted: boolean;

	constructor(
		aGetValueFunc: GetterType,
		aSetValueFunc: SetterType,
		aGetModifier?: SetterType,
		aSetModifier?: SetterType,
	) {
		super();

		assert(
			aGetValueFunc && aSetValueFunc,
			'GenericAnimation constructor: get value functor and/or set value functor are not valid',
		);

		this.aGetValueFunc = aGetValueFunc;
		this.aSetValueFunc = aSetValueFunc;
		this.aGetModifier = aGetModifier;
		this.aSetModifier = aSetModifier;
		this.aAnimatableElement = null;
		this.bAnimationStarted = false;
	}

	start(aAnimatableElement: any): void {
		assert(
			aAnimatableElement,
			'GenericAnimation.start: animatable element is not valid',
		);

		this.aAnimatableElement = aAnimatableElement;
		this.aAnimatableElement.notifyAnimationStart();

		if (!this.bAnimationStarted) this.bAnimationStarted = true;
	}

	end(): void {
		if (this.bAnimationStarted) {
			this.bAnimationStarted = false;
			this.aAnimatableElement.notifyAnimationEnd();
		}
	}

	perform(aValue: any): void {
		if (this.aSetModifier) aValue = this.aSetModifier(aValue);

		this.aSetValueFunc(aValue);
	}

	getUnderlyingValue(): any {
		let aValue = this.aGetValueFunc();
		if (this.aGetModifier) aValue = this.aGetModifier(aValue);
		return aValue;
	}
}

class TupleAnimation extends GenericAnimation {
	private aDefaultValue: any[];
	private aReferenceSize: any[];

	constructor(
		aGetValueFunc: GetterType,
		aSetValueFunc: SetterType,
		aDefaultValue: any[],
		aReferenceSize: any[],
	) {
		super(aGetValueFunc, aSetValueFunc);

		assert(
			aDefaultValue && aReferenceSize,
			'TupleAnimation constructor: default value functor and/or reference size are not valid',
		);

		this.aDefaultValue = aDefaultValue;
		this.aReferenceSize = aReferenceSize;
	}

	perform(aNormValue: any[]): void {
		assert(
			aNormValue.length === this.aReferenceSize.length,
			'TupleAnimation.perform: aNormValue array param has wrong length',
		);

		const aValue: any[] = [];
		for (let i = 0; i < aNormValue.length; ++i) {
			aValue.push(aNormValue[i] * this.aReferenceSize[i]);
		}

		this.aSetValueFunc(aValue);
	}

	getUnderlyingValue(): any {
		const aValue: any[] = this.aGetValueFunc();
		assert(
			aValue.length === this.aReferenceSize.length,
			'TupleAnimation.perform: array param has wrong length',
		);

		const aNormValue: any[] = [];
		for (let i = 0; i < aValue.length; ++i) {
			aNormValue.push(aValue[i] / this.aReferenceSize[i]);
		}
		return aNormValue;
	}
}

function createPropertyAnimation(
	sAttrName: string,
	aAnimatedElement: AnimatedElement,
	nWidth: number,
	nHeight: number,
): AnimationBase {
	const sPropNameAsKey = sAttrName as PropertyGetterSetterMapKeyType;
	if (!aPropertyGetterSetterMap[sPropNameAsKey]) {
		window.app.console.log('createPropertyAnimation: attribute is unknown');
		return null;
	}

	const aFunctorSet: PropertyGetterSetter =
		aPropertyGetterSetterMap[sPropNameAsKey];

	const sGetValueMethod = aFunctorSet.get;
	const sSetValueMethod = aFunctorSet.set;

	if (!sGetValueMethod || !sSetValueMethod) {
		window.app.console.log('createPropertyAnimation: attribute is not handled');
		return null;
	}

	// nWidth, nHeight are used here
	const aGetModifier = eval(aFunctorSet.getmod);
	const aSetModifier = eval(aFunctorSet.setmod);

	const aGetValueMethod =
		aAnimatedElement[sGetValueMethod as keyof typeof aAnimatedElement];
	const aSetValueMethod =
		aAnimatedElement[sSetValueMethod as keyof typeof aAnimatedElement];
	return new GenericAnimation(
		aGetValueMethod.bind(aAnimatedElement),
		aSetValueMethod.bind(aAnimatedElement),
		aGetModifier,
		aSetModifier,
	);
}

function createPairPropertyAnimation(
	sTransformType: string,
	aAnimatedElement: AnimatedElement,
	nWidth: number,
	nHeight: number,
): AnimationBase {
	const sTransformTypeAsKey = sTransformType as PropertyGetterSetterMapKeyType;
	const aFunctorSet: PropertyGetterSetter =
		aPropertyGetterSetterMap[sTransformTypeAsKey];
	const sGetValueMethod = aFunctorSet.get;
	const sSetValueMethod = aFunctorSet.set;

	const aDefaultValue: any[] = [];
	const aSizeReference: any[] = [];
	if (sTransformType === 'scale') {
		aDefaultValue[0] = aSizeReference[0] = aAnimatedElement.getBaseBBox().width;
		aDefaultValue[1] = aSizeReference[1] =
			aAnimatedElement.getBaseBBox().height;
	} else if (sTransformType === 'translate') {
		aDefaultValue[0] = aAnimatedElement.getBaseCenterX();
		aDefaultValue[1] = aAnimatedElement.getBaseCenterY();
		aSizeReference[0] = nWidth;
		aSizeReference[1] = nHeight;
	} else {
		window.app.console.log(
			'createPairPropertyAnimation: transform type is not handled',
		);
		return null;
	}

	const aGetValueMethod =
		aAnimatedElement[sGetValueMethod as keyof typeof aAnimatedElement];
	const aSetValueMethod =
		aAnimatedElement[sSetValueMethod as keyof typeof aAnimatedElement];
	return new TupleAnimation(
		aGetValueMethod.bind(aAnimatedElement),
		aSetValueMethod.bind(aAnimatedElement),
		aDefaultValue,
		aSizeReference,
	);
}

enum TransitionClass {
	Invalid,
	ClipPoligon,
	Special,
}

function createClipPolyPolygon(
	eTransitionType: TransitionType,
	eTransitionSubType: TransitionSubType,
): any {
	// TODO implement createClipPolyPolygon
	window.app.console.log(
		'createClipPolyPolygon: Transition Type: ' +
			TransitionType[eTransitionType] +
			', Transition SubType: ' +
			TransitionSubType[eTransitionSubType],
	);
	return null;
}

class ClippingAnimation extends AnimationBase {
	constructor(
		aParametricPolyPolygon: any,
		aTransitionInfo: any,
		bDirectionForward: boolean,
		bModeIn: boolean,
	) {
		window.app.console.log(
			'ClippingAnimation ctor: ' +
				'aParametricPolyPolygon' +
				aParametricPolyPolygon +
				',  aTransitionInfo: ' +
				aTransitionInfo +
				', bDirectionForward: ' +
				bDirectionForward +
				', bModeIn: ' +
				bModeIn,
		);
		super();
	}

	start(aAnimatableElement: AnimatedElement): void {
		// TODO implement ClippingAnimation.start()
		window.app.console.log(
			'ClippingAnimation.start(): Animated Element Id: ' +
				aAnimatableElement.getId(),
		);
	}

	end(): void {
		// TODO implement ClippingAnimation.end()
		window.app.console.log('ClippingAnimation.end()');
	}

	perform(aValue: any): void {
		// TODO implement ClippingAnimation.perform()
		window.app.console.log('ClippingAnimation.perform(): value: ' + aValue);
	}

	getUnderlyingValue(): any {
		// TODO implement ClippingAnimation.getUnderlyingValue()
		window.app.console.log('ClippingAnimation.getUnderlyingValue()');
		return null;
	}
}

const aTransitionInfoTable: any = {};
// type: fake transition
aTransitionInfoTable[0] = {};
// subtype: default
aTransitionInfoTable[0][0] = {
	class: TransitionClass.Invalid,
	rotationAngle: 0.0,
	scaleX: 0.0,
	scaleY: 0.0,
	reverseMethod: 0,
	outInvertsSweep: false,
	scaleIsotropically: false,
};
aTransitionInfoTable[TransitionType.FADE] = {};
aTransitionInfoTable[TransitionType.FADE][TransitionSubType.CROSSFADE] =
	aTransitionInfoTable[TransitionType.FADE][TransitionSubType.FADEOVERCOLOR] = {
		class: TransitionClass.Special,
		rotationAngle: 0.0,
		scaleX: 1.0,
		scaleY: 1.0,
		reverseMethod: 0,
		outInvertsSweep: true,
		scaleIsotropically: false,
	};

function createShapeTransition(
	aActivityParamSet: ActivityParamSet,
	aAnimatedElement: AnimatedElement,
	nSlideWidth: number,
	nSlideHeight: number,
	aAnimatedTransitionFilterNode: AnimationTransitionFilterNode,
): AnimationActivity {
	if (!aAnimatedTransitionFilterNode) {
		window.app.console.log(
			'createShapeTransition: the animated transition filter node is not valid.',
		);
		return null;
	}
	const eTransitionType = aAnimatedTransitionFilterNode.getTransitionType();
	const eTransitionSubType =
		aAnimatedTransitionFilterNode.getTransitionSubtype();
	const bDirectionForward =
		!aAnimatedTransitionFilterNode.getReverseDirection();
	const bModeIn =
		aAnimatedTransitionFilterNode.getTransitionMode() == TransitionMode.in;

	let aTransitionInfo = null;
	if (aTransitionInfoTable[eTransitionType])
		aTransitionInfo = aTransitionInfoTable[eTransitionType][eTransitionSubType];

	const eTransitionClass: TransitionClass = aTransitionInfo
		? aTransitionInfo['class']
		: TransitionClass.Invalid;

	switch (eTransitionClass) {
		default:
		case TransitionClass.Invalid:
			window.app.console.log(
				'createShapeTransition: transition class: TRANSITION_INVALID',
			);
			return null;

		case TransitionClass.ClipPoligon: {
			const aParametricPolyPolygon = createClipPolyPolygon(
				eTransitionType,
				eTransitionSubType,
			);
			const aClippingAnimation = new ClippingAnimation(
				aParametricPolyPolygon,
				aTransitionInfo,
				bDirectionForward,
				bModeIn,
			);
			return new SimpleActivity(
				aActivityParamSet,
				aClippingAnimation,
				DirectionType.Forward,
			);
		}

		case TransitionClass.Special:
			switch (eTransitionType) {
				// no special transition filter provided
				// we map everything to crossfade
				default: {
					const aAnimation = createPropertyAnimation(
						'opacity',
						aAnimatedElement,
						nSlideWidth,
						nSlideHeight,
					);
					const eDirection = bModeIn
						? DirectionType.Forward
						: DirectionType.Backward;
					return new SimpleActivity(aActivityParamSet, aAnimation, eDirection);
				}
			}
	}
}

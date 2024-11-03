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

function createActivity(
	aActivityParamSet: ActivityParamSet,
	aAnimationNode: AnimationBaseNode3,
	aAnimation: AnimationBase,
	aInterpolator: PropertyInterpolatorType,
): AnimationActivity {
	const eCalcMode = aAnimationNode.getCalcMode();

	const sAttributeName = aAnimationNode.getAttributeName();
	const sKey = sAttributeName as PropertyGetterSetterMapKeyType;
	const aAttributeProp = aPropertyGetterSetterMap[sKey];

	const eValueType: PropertyValueType = aAttributeProp['type'];

	// do we need to get an interpolator ?
	if (!aInterpolator) {
		aInterpolator = PropertyInterpolator.getInterpolator(eValueType);
	}

	// is it cumulative ?
	const bAccumulate =
		aAnimationNode.getAccumulate() === AccumulateMode.Sum &&
		!(
			eValueType === PropertyValueType.Bool ||
			eValueType === PropertyValueType.String ||
			eValueType === PropertyValueType.Enum
		);

	if (aAnimationNode.getFormula()) {
		let sFormula: string = aAnimationNode.getFormula();
		const reMath = /abs|sqrt|asin|acos|atan|sin|cos|tan|exp|log|min|max/g;
		sFormula = sFormula.replace(reMath, 'Math.$&');
		sFormula = sFormula.replace(/pi(?!\w)/g, 'Math.PI');
		sFormula = sFormula.replace(/e(?!\w)/g, 'Math.E');
		sFormula = sFormula.replace(/\$/g, '__PARAM0__');

		const aAnimatedElement = aAnimationNode.getAnimatedElement();
		const aBBox = aAnimatedElement.getBaseBBox();

		// the following variable are used for evaluating sFormula
		/* eslint-disable no-unused-vars */
		const width = aBBox.width / aActivityParamSet.nSlideWidth;
		const height = aBBox.height / aActivityParamSet.nSlideHeight;
		const x = (aBBox.x + aBBox.width / 2) / aActivityParamSet.nSlideWidth;
		const y = (aBBox.y + aBBox.height / 2) / aActivityParamSet.nSlideHeight;

		aActivityParamSet.aFormula = function (__PARAM0__: any) {
			return eval(sFormula);
		};
		/* eslint-enable no-unused-vars */
	}

	aActivityParamSet.aDiscreteTimes = aAnimationNode.getKeyTimes();

	// do we have a value list ?
	const aValueSet = aAnimationNode.getValues();
	const nValueSetSize = aValueSet.length;

	if (nValueSetSize != 0) {
		// Value list activity
		if (aActivityParamSet.aDiscreteTimes.length == 0) {
			for (let i = 0; i < nValueSetSize; ++i)
				aActivityParamSet.aDiscreteTimes.push(i / nValueSetSize);
		}

		switch (eCalcMode) {
			case CalcMode.Discrete:
				aActivityParamSet.aWakeupEvent = new WakeupEvent(
					aActivityParamSet.aTimerEventQueue.getTimer(),
					aActivityParamSet.aActivityQueue,
				);

				return createValueListActivity(
					aActivityParamSet,
					aAnimationNode,
					aAnimation,
					aInterpolator,
					DiscreteValueListActivity,
					bAccumulate,
					eValueType,
				);
			default:
				window.app.console.log(
					'createActivity: unexpected calculation mode: ' + CalcMode[eCalcMode],
				);
			// FALLTHROUGH intended
			case CalcMode.Paced:
			case CalcMode.Spline:
			case CalcMode.Linear:
				return createValueListActivity(
					aActivityParamSet,
					aAnimationNode,
					aAnimation,
					aInterpolator,
					LinearValueListActivity,
					bAccumulate,
					eValueType,
				);
		}
	} else {
		// FromToBy activity
		switch (eCalcMode) {
			case CalcMode.Discrete:
				aActivityParamSet.aWakeupEvent = new WakeupEvent(
					aActivityParamSet.aTimerEventQueue.getTimer(),
					aActivityParamSet.aActivityQueue,
				);
				return createFromToByActivity(
					aActivityParamSet,
					aAnimationNode,
					aAnimation,
					aInterpolator,
					DiscreteFromToByActivity,
					bAccumulate,
					eValueType,
				);

			default:
				window.app.console.log(
					'createActivity: unexpected calculation mode: ' + CalcMode[eCalcMode],
				);
			// FALLTHROUGH intended
			case CalcMode.Paced:
			case CalcMode.Spline:
			case CalcMode.Linear:
				return createFromToByActivity(
					aActivityParamSet,
					aAnimationNode,
					aAnimation,
					aInterpolator,
					LinearFromToByActivity,
					bAccumulate,
					eValueType,
				);
		}
	}
}

function createValueListActivity(
	aActivityParamSet: ActivityParamSet,
	aAnimationNode: AnimationBaseNode3,
	aAnimation: AnimationBase,
	aInterpolator: PropertyInterpolatorType,
	ValueListActivityCtor: ValueListActivityCtorType,
	bAccumulate: boolean,
	eValueType: PropertyValueType,
): AnimationActivity {
	const aAnimatedElement = aAnimationNode.getAnimatedElement();
	const aOperatorSet = aOperatorSetMap.get(eValueType);
	assert(aOperatorSet, 'createValueListActivity: no operator set found');

	const aValueSet = aAnimationNode.getValues();

	const aValueList: any[] = [];

	extractAttributeValues(
		eValueType,
		aValueList,
		aValueSet,
		aAnimatedElement.getBaseBBox(),
		aActivityParamSet.nSlideWidth,
		aActivityParamSet.nSlideHeight,
	);

	for (let i = 0; i < aValueList.length; ++i) {
		ANIMDBG.print(
			'createValueListActivity: value[' + i + '] = ' + aValueList[i],
		);
	}

	return new ValueListActivityCtor(
		aValueList,
		aActivityParamSet,
		aAnimation,
		aInterpolator,
		aOperatorSet,
		bAccumulate,
	);
}

function createFromToByActivity(
	aActivityParamSet: ActivityParamSet,
	aAnimationNode: AnimationBaseNode3,
	aAnimation: any,
	aInterpolator: PropertyInterpolatorType,
	ClassTemplateInstance: FromToByActivityCtorType,
	bAccumulate: boolean,
	eValueType: PropertyValueType,
) {
	const aAnimatedElement = aAnimationNode.getAnimatedElement();
	const aOperatorSet = aOperatorSetMap.get(eValueType);
	assert(aOperatorSet, 'createFromToByActivity: no operator set found');

	const aValueSet = [];
	aValueSet[0] = aAnimationNode.getFromValue();
	aValueSet[1] = aAnimationNode.getToValue();
	aValueSet[2] = aAnimationNode.getByValue();

	ANIMDBG.print(
		'createFromToByActivity: value type: ' +
			PropertyValueType[eValueType] +
			', aFrom = ' +
			aValueSet[0] +
			', aTo = ' +
			aValueSet[1] +
			', aBy = ' +
			aValueSet[2],
	);

	const aValueList: any[] = [];

	extractAttributeValues(
		eValueType,
		aValueList,
		aValueSet,
		aAnimatedElement.getBaseBBox(),
		aActivityParamSet.nSlideWidth,
		aActivityParamSet.nSlideHeight,
	);

	ANIMDBG.print(
		'createFromToByActivity: ' +
			', aFrom = ' +
			aValueList[0] +
			', aTo = ' +
			aValueList[1] +
			', aBy = ' +
			aValueList[2],
	);

	return new ClassTemplateInstance(
		aValueList[0],
		aValueList[1],
		aValueList[2],
		aActivityParamSet,
		aAnimation,
		aInterpolator,
		aOperatorSet,
		bAccumulate,
	);
}

function extractAttributeValues(
	eValueType: PropertyValueType,
	aValueList: any[],
	aValueSet: any[],
	aBBox: DOMRect,
	nSlideWidth: number,
	nSlideHeight: number,
) {
	let i: number;
	switch (eValueType) {
		case PropertyValueType.Number:
			evalValuesAttribute(
				aValueList,
				aValueSet,
				aBBox,
				nSlideWidth,
				nSlideHeight,
			);
			break;
		case PropertyValueType.Bool:
			for (i = 0; i < aValueSet.length; ++i) {
				const aValue = booleanParser(aValueSet[i]);
				aValueList.push(aValue);
			}
			break;
		case PropertyValueType.String:
			for (i = 0; i < aValueSet.length; ++i) {
				aValueList.push(aValueSet[i]);
			}
			break;
		case PropertyValueType.Enum:
			for (i = 0; i < aValueSet.length; ++i) {
				aValueList.push(aValueSet[i]);
			}
			break;
		case PropertyValueType.Color:
			for (i = 0; i < aValueSet.length; ++i) {
				const aValue = colorParser(aValueSet[i]);
				aValueList.push(aValue);
			}
			break;
		case PropertyValueType.TupleNumber:
			for (i = 0; i < aValueSet.length; ++i) {
				if (typeof aValueSet[i] === 'string') {
					const aTuple = aValueSet[i].split(',');
					const aValue: number[] = [];
					evalValuesAttribute(aValue, aTuple, aBBox, nSlideWidth, nSlideHeight);
					aValueList.push(aValue);
				} else {
					aValueList.push(undefined);
				}
			}
			break;
		default:
			window.app.console.log(
				'createValueListActivity: unexpected value type: ' + eValueType,
			);
	}
}

function evalValuesAttribute(
	aValueList: number[],
	aValueSet: any[],
	aBBox: DOMRect,
	nSlideWidth: number,
	nSlideHeight: number,
) {
	// the following variables are used for evaluating sValue later
	/* eslint-disable no-unused-vars */
	const width = aBBox.width / nSlideWidth;
	const height = aBBox.height / nSlideHeight;
	const x = (aBBox.x + aBBox.width / 2) / nSlideWidth;
	const y = (aBBox.y + aBBox.height / 2) / nSlideHeight;
	/* eslint-enable no-unused-vars */

	const reMath = /abs|sqrt|asin|acos|atan|sin|cos|tan|exp|log|min|max/g;

	for (let i = 0; i < aValueSet.length; ++i) {
		let sValue: string = aValueSet[i];
		if (sValue) {
			sValue = sValue.replace(reMath, 'Math.$&');
			sValue = sValue.replace(/pi(?!\w)/g, 'Math.PI');
			sValue = sValue.replace(/e(?!\w)/g, 'Math.E');
		}
		const aValue = eval(sValue);
		aValueList.push(aValue);
	}
}

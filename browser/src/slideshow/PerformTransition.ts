/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
declare var SlideShow: any;

enum TransitionType {
	BARWIPE,
	PINWHEELWIPE,
	SLIDEWIPE,
	RANDOMBARWIPE,
	CHECKERBOARDWIPE,
	FOURBOXWIPE,
	IRISWIPE,
	FANWIPE,
	BLINDSWIPE,
	FADE,
	DISSOLVE,
	PUSHWIPE,
	ELLIPSEWIPE,
	BARNDOORWIPE,
	WATERFALLWIPE,
}

enum TransitionSubType {
	LEFTTORIGHT,
	TOPTOBOTTOM,
	EIGHTBLADE,
	FOURBLADE,
	THREEBLADE,
	TWOBLADEVERTICAL,
	ONEBLADE,
	FROMTOPLEFT,
	FROMTOPRIGHT,
	FROMBOTTOMLEFT,
	FROMBOTTOMRIGHT,
	VERTICAL,
	HORIZONTAL,
	DOWN,
	ACROSS,
	CORNERSOUT,
	DIAMOND,
	CIRCLE,
	RECTANGLE,
	CENTERTOP,
	CROSSFADE,
	FADEOVERCOLOR,
	FROMLEFT,
	FROMRIGHT,
	FROMTOP,
	HORIZONTALLEFT,
	HORIZONTALRIGHT,
}

const stringToTransitionTypeMap: Record<string, TransitionType> = {
	BarWipe: TransitionType.BARWIPE,
	PineWheelWipe: TransitionType.PINWHEELWIPE,
	SlideWipe: TransitionType.SLIDEWIPE,
	RandomBarWipe: TransitionType.RANDOMBARWIPE,
	CheckerBoardWipe: TransitionType.CHECKERBOARDWIPE,
	FourBoxWipe: TransitionType.FOURBOXWIPE,
	IrisWipe: TransitionType.IRISWIPE,
	FanWipe: TransitionType.FANWIPE,
	BlindWipe: TransitionType.BLINDSWIPE,
	Fade: TransitionType.FADE,
	Dissolve: TransitionType.DISSOLVE,
	PushWipe: TransitionType.PUSHWIPE,
	EllipseWipe: TransitionType.ELLIPSEWIPE,
	BarnDoorWipe: TransitionType.BARNDOORWIPE,
	WaterfallWipe: TransitionType.WATERFALLWIPE,
};

const stringToTransitionSubTypeMap: Record<string, TransitionSubType> = {
	LeftToRight: TransitionSubType.LEFTTORIGHT,
	TopToBottom: TransitionSubType.TOPTOBOTTOM,
	'8Blade': TransitionSubType.EIGHTBLADE,
	'4Blade': TransitionSubType.FOURBLADE,
	'3Blade': TransitionSubType.THREEBLADE,
	'2BladeVertical': TransitionSubType.TWOBLADEVERTICAL,
	'1Blade': TransitionSubType.ONEBLADE,
	FromTopLeft: TransitionSubType.FROMTOPLEFT,
	FromTopRight: TransitionSubType.FROMTOPRIGHT,
	FromBottomLeft: TransitionSubType.FROMBOTTOMLEFT,
	FromBottomRight: TransitionSubType.FROMBOTTOMRIGHT,
	Vertical: TransitionSubType.VERTICAL,
	Horizontal: TransitionSubType.HORIZONTAL,
	Down: TransitionSubType.DOWN,
	Across: TransitionSubType.ACROSS,
	CornersOut: TransitionSubType.CORNERSOUT,
	Diamond: TransitionSubType.DIAMOND,
	Circle: TransitionSubType.CIRCLE,
	Rectangle: TransitionSubType.RECTANGLE,
	CenterTop: TransitionSubType.CENTERTOP,
	CrossFade: TransitionSubType.CROSSFADE,
	FadeOverColor: TransitionSubType.FADEOVERCOLOR,
	FromLeft: TransitionSubType.FROMLEFT,
	FromRight: TransitionSubType.FROMRIGHT,
	FromTop: TransitionSubType.FROMTOP,
	HorizontalLeft: TransitionSubType.HORIZONTALLEFT,
	HorizontalRight: TransitionSubType.HORIZONTALRIGHT,
};

SlideShow.PerformTransition = function (
	canvas: HTMLCanvasElement,
	image1: HTMLImageElement,
	image2: HTMLImageElement,
	slideInfo: SlideInfo,
) {
	let subTypeIndex = 1;
	const transitionSubType =
		stringToTransitionSubTypeMap[slideInfo.transitionSubtype];

	switch (stringToTransitionTypeMap[slideInfo.transitionType]) {
		case TransitionType.FADE:
			new SlideShow.FadeTransition(canvas, image1, image2, slideInfo).start();
			break;

		case TransitionType.BARWIPE:
			BarWipeTransition(canvas, image1, image2, slideInfo).start();
			break;

		case TransitionType.PINWHEELWIPE:
			new SlideShow.WheelTransition(canvas, image1, image2, slideInfo).start();
			break;

		case TransitionType.SLIDEWIPE:
			SlideWipeTransition(canvas, image1, image2, slideInfo).start();
			break;

		case TransitionType.RANDOMBARWIPE:
			new SlideShow.BarsTransition(canvas, image1, image2, slideInfo).start();
			break;

		case TransitionType.CHECKERBOARDWIPE:
			new SlideShow.CheckersTransition(
				canvas,
				image1,
				image2,
				slideInfo,
			).start();
			break;

		case TransitionType.FOURBOXWIPE:
			if (
				slideInfo.transitionSubtype &&
				slideInfo.transitionSubtype.length > 0
			) {
				if (transitionSubType == TransitionSubType.CORNERSOUT) {
					new SlideShow.PlusTransition(canvas, image1, image2).start();
					return;
				}
			}
			break;

		case TransitionType.IRISWIPE:
			if (
				slideInfo.transitionSubtype &&
				slideInfo.transitionSubtype.length > 0
			) {
				if (transitionSubType == TransitionSubType.DIAMOND) {
					new SlideShow.DiamondTransition(canvas, image1, image2).start();
					return;
				} else if (
					transitionSubType == TransitionSubType.RECTANGLE &&
					slideInfo.transitionDirection
				) {
					subTypeIndex = 1;
				} else {
					subTypeIndex = 0;
				}
			}
			new SlideShow.BoxTransition(canvas, image1, image2).start(subTypeIndex);
			break;

		case TransitionType.ELLIPSEWIPE:
			if (
				slideInfo.transitionSubtype &&
				slideInfo.transitionSubtype.length > 0
			) {
				if (transitionSubType == TransitionSubType.CIRCLE) {
					new SlideShow.CircleTransition(canvas, image1, image2).start();
					return;
				} else if (transitionSubType == TransitionSubType.HORIZONTAL) {
					new SlideShow.OvalTransition(canvas, image1, image2).start(1);
				} else if (transitionSubType == TransitionSubType.VERTICAL) {
					new SlideShow.OvalTransition(canvas, image1, image2).start(0);
				}
			}

			break;

		case TransitionType.FANWIPE:
			new SlideShow.WedgeTransition(canvas, image1, image2).start();
			break;

		case TransitionType.BLINDSWIPE:
			// todo : add Venetian to online UI
			new SlideShow.VenetianTransition(canvas, image1, image2).start(1);
			break;

		case TransitionType.DISSOLVE:
			new SlideShow.SimpleDissolveTransition(canvas, image1, image2).start();
			break;

		case TransitionType.PUSHWIPE:
			if (
				slideInfo.transitionSubtype &&
				slideInfo.transitionSubtype.length > 0
			) {
				if (transitionSubType == TransitionSubType.FROMTOP) {
					subTypeIndex = 4;
				} else if (transitionSubType == TransitionSubType.FROMRIGHT) {
					subTypeIndex = 3;
				} else if (transitionSubType == TransitionSubType.FROMLEFT) {
					subTypeIndex = 2;
				} else {
					subTypeIndex = 1;
				}
			}

			new SlideShow.PushTransition(canvas, image1, image2).start(subTypeIndex);
			break;

		case TransitionType.BARNDOORWIPE:
			if (
				slideInfo.transitionSubtype &&
				slideInfo.transitionSubtype.length > 0
			) {
				if (
					transitionSubType == TransitionSubType.HORIZONTAL &&
					slideInfo.transitionDirection == false
				) {
					subTypeIndex = 1;
				} else if (
					transitionSubType == TransitionSubType.HORIZONTAL &&
					slideInfo.transitionDirection == true
				) {
					subTypeIndex = 2;
				} else if (
					transitionSubType == TransitionSubType.VERTICAL &&
					slideInfo.transitionDirection == false
				) {
					subTypeIndex = 3;
				} else if (
					transitionSubType == TransitionSubType.VERTICAL &&
					slideInfo.transitionDirection == true
				) {
					subTypeIndex = 4;
				}
			}
			new SlideShow.SplitTransition(canvas, image1, image2).start(subTypeIndex);
			break;

		case TransitionType.WATERFALLWIPE:
			// TODO: Need to implement
			break;

		default:
			new SlideShow.NoTransition(canvas, image1, image2).start();
			console.log('Unknown transition type', slideInfo.transitionType);
			break;
	}

	return;
};

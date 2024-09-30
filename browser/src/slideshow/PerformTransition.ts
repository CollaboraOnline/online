/* -*- js-indent-level: 8 -*- */

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

// TODO TransitionType, TransitionSubType to be moved to a separate file: engine/TransitionType.ts

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
	MISCSHAPEWIPE,
	ZOOM,
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
	COMBVERTICAL,
	COMBHORIZONTAL,
	TOPLEFT,
	TOPRIGHT,
	BOTTOMRIGHT,
	BOTTOMLEFT,
	TOPCENTER,
	RIGHTCENTER,
	BOTTOMCENTER,
	HEARTCORNERSIN,
	FANOUTHORIZONTAL,
	CORNERSIN,
	HEART,
	ROTATEIN,
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
	MiscShapeWipe: TransitionType.MISCSHAPEWIPE,
	Zoom: TransitionType.ZOOM,
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
	CombVertical: TransitionSubType.COMBVERTICAL,
	CombHorizontal: TransitionSubType.COMBHORIZONTAL,
	TopLeft: TransitionSubType.TOPLEFT,
	TopRight: TransitionSubType.TOPRIGHT,
	BottomRight: TransitionSubType.BOTTOMRIGHT,
	BottomLeft: TransitionSubType.BOTTOMLEFT,
	TopCenter: TransitionSubType.TOPCENTER,
	RightCenter: TransitionSubType.RIGHTCENTER,
	BottomCenter: TransitionSubType.BOTTOMCENTER,
	CornersIn: TransitionSubType.CORNERSIN,
	FanOutHorizontal: TransitionSubType.FANOUTHORIZONTAL,
	Heart: TransitionSubType.HEART,
	RotateIn: TransitionSubType.ROTATEIN,
};

// TODO SlideShow.PerformTransition (don't hack it, no more used)
//  look at SlideTransition.createSlideTransition
//  3d transition still to be integrated in SlideTransition
//  to be tested 2d context case with ported engine
//  to be removed
SlideShow.PerformTransition = function (
	transitionParameters: TransitionParameters,
) {
	if (transitionParameters.context.is2dGl()) {
		transitionParameters.callback();
		return;
	}

	switch (transitionParameters.transitionFilterInfo.transitionType) {
		case TransitionType.FADE:
			new SlideShow.FadeTransition(transitionParameters).start();
			break;

		case TransitionType.BARWIPE:
			BarWipeTransition(transitionParameters).start();
			break;

		case TransitionType.PINWHEELWIPE:
			new SlideShow.WheelTransition(transitionParameters).start();
			break;

		case TransitionType.SLIDEWIPE:
			SlideWipeTransition(transitionParameters).start();
			break;

		case TransitionType.RANDOMBARWIPE:
			new SlideShow.BarsTransition(transitionParameters).start();
			break;

		case TransitionType.CHECKERBOARDWIPE:
			new SlideShow.CheckersTransition(transitionParameters).start();
			break;

		case TransitionType.FOURBOXWIPE:
			new SlideShow.PlusTransition(transitionParameters).start();
			break;

		case TransitionType.IRISWIPE:
			SlideShow.IrisWipeTransition(transitionParameters).start();
			break;

		case TransitionType.ELLIPSEWIPE:
			SlideShow.EllipseWipeTransition(transitionParameters).start();
			break;

		case TransitionType.FANWIPE:
			new SlideShow.WedgeTransition(transitionParameters).start();
			break;

		case TransitionType.BLINDSWIPE:
			new SlideShow.VenetianTransition(transitionParameters).start();
			break;

		case TransitionType.DISSOLVE:
			new SlideShow.SimpleDissolveTransition(transitionParameters).start();
			break;

		case TransitionType.PUSHWIPE:
			SlideShow.PushWipeTransition(transitionParameters).start();
			break;

		case TransitionType.BARNDOORWIPE:
			new SlideShow.SplitTransition(transitionParameters).start();
			break;

		case TransitionType.WATERFALLWIPE:
			new SlideShow.DiagonalTransition(transitionParameters).start();
			break;
		// TODO: move also MISCSHAPEWIPE to SlideTransition
		case TransitionType.MISCSHAPEWIPE:
			SlideShow.MicsShapeWipeTransition(transitionParameters).start();
			break;

		case TransitionType.ZOOM:
			SlideShow.NewsFlashTransition(transitionParameters).start();
			break;

		default:
			new SlideShow.NoTransition(transitionParameters).start();
			console.log(
				'Unknown transition type',
				transitionParameters.transitionFilterInfo.transitionType,
			);
			break;
	}

	return;
};

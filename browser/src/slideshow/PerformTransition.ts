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

const stringToTransitionTypeMap: Record<string, TransitionType> = {
    'BarWipe': TransitionType.BARWIPE,
    'PineWheelWipe': TransitionType.PINWHEELWIPE,
    'SlideWipe': TransitionType.SLIDEWIPE,
    'RandomBarWipe': TransitionType.RANDOMBARWIPE,
    'CheckerBoardWipe': TransitionType.CHECKERBOARDWIPE,
    'FourBoxWipe': TransitionType.FOURBOXWIPE,
    'IrisWipe': TransitionType.IRISWIPE,
    'FanWipe': TransitionType.FANWIPE,
    'BlindWipe': TransitionType.BLINDSWIPE,
    'Fade': TransitionType.FADE,
    'Dissolve': TransitionType.DISSOLVE,
    'PushWipe': TransitionType.PUSHWIPE,
    'EllipseWipe': TransitionType.ELLIPSEWIPE,
    'BarnDoorWipe': TransitionType.BARNDOORWIPE,
    'WaterfallWipe': TransitionType.WATERFALLWIPE,
};

SlideShow.PerformTransition = function (
	canvas: HTMLCanvasElement,
	image1: HTMLImageElement,
	image2: HTMLImageElement,
	slideInfo: SlideInfo,
) {
	switch (stringToTransitionTypeMap[slideInfo.transitionType]) {
		case TransitionType.FADE:
			new SlideShow.FadeTransition(canvas, image1, image2).start(2);
			break;
		
		case TransitionType.BARWIPE:
			new SlideShow.WipeTransition(canvas, image1, image2).start(1);
			break;
		
		case TransitionType.PINWHEELWIPE:
			// 1,2,3, 4, 8
			new SlideShow.WheelTransition(canvas, image1, image2).start(2);
			break;

		case TransitionType.SLIDEWIPE:
			new SlideShow.UncoverTransition(canvas, image1, image2).start(2);
			break;

		case TransitionType.RANDOMBARWIPE:
			new SlideShow.BarsTransition(canvas, image1, image2).start(1);
			break;

		case TransitionType.CHECKERBOARDWIPE:
			new SlideShow.CheckersTransition(canvas, image1, image2).start(1);
			break;

		case TransitionType.FOURBOXWIPE:
			// All Shapes come here
            break;

		case TransitionType.IRISWIPE:
			new SlideShow.BoxTransition(canvas, image1, image2).start(1);
			break;

		case TransitionType.FANWIPE:
			new SlideShow.WedgeTransition(canvas, image1, image2).start();
			break;

		case TransitionType.BLINDSWIPE:
			new SlideShow.VenetianTransition(canvas, image1, image2).start(1);
			break;

		case TransitionType.DISSOLVE:
			new SlideShow.SimpleDissolveTransition(canvas, image1, image2).start();
			break;

		case TransitionType.PUSHWIPE:
			new SlideShow.PushTransition(canvas, image1, image2).start(1);
			break;

		case TransitionType.BARNDOORWIPE:
			new SlideShow.SplitTransition(canvas, image1, image2).start(1);
			break;
	
		case TransitionType.ELLIPSEWIPE:
			// todo: have to find!
			break;

		case TransitionType.WATERFALLWIPE:
			// TODO: Need to implement
			break;

		default:
			new SlideShow.NoTransition(canvas, image1, image2).start();
			console.error('Unknown transition type', slideInfo.transitionType);
			break;
	}

	return;
};

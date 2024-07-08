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

SlideShow.PerformTransition = function (
	canvas: HTMLCanvasElement,
	image1: HTMLImageElement,
	image2: HTMLImageElement,
	slideInfo: SlideInfo,
) {
	switch (slideInfo.transitionType) {
		case 'Fade':
			new SlideShow.FadeTransition(canvas, image1, image2).start(2);
			break;
		
		case 'BarWipe':
			new SlideShow.WipeTransition(canvas, image1, image2).start(1);
			break;
		
		case 'PineWheelWipe':
			// 1,2,3, 4, 8
			new SlideShow.WheelTransition(canvas, image1, image2).start(2);
			break;

			case 'SlideWipe':
			new SlideShow.UncoverTransition(canvas, image1, image2).start(2);
			break;

		case 'RandomBarWipe':
			new SlideShow.BarsTransition(canvas, image1, image2).start(1);
			break;

		case 'CheckerBoardWipe':
			new SlideShow.CheckersTransition(canvas, image1, image2).start(1);
			break;

		case "FourBoxWipe":
			// All Shapes come here
            break;

		case 'PLUS':
			new SlideShow.PlusTransition(canvas, image1, image2).start();
			break;

		case 'CIRCLE':
			new SlideShow.CircleTransition(canvas, image1, image2).start();
			break;

		case 'DIAMOND':
			new SlideShow.DiamondTransition(canvas, image1, image2).start();
			break;

		case 'OVAL':
			new SlideShow.OvalTransition(canvas, image1, image2).start(1);
			break;

		case 'IrisWipe':
			new SlideShow.BoxTransition(canvas, image1, image2).start(1);
			break;

		case 'FanWipe':
			new SlideShow.WedgeTransition(canvas, image1, image2).start();
			break;

		case 'BlindWipe':
			new SlideShow.VenetianTransition(canvas, image1, image2).start(1);
			break;

		case 'CUT':
			// todo: subtype of "BarWipe" to "FadeOverColor"
			new SlideShow.CutTransition(canvas, image1, image2).start();
			break;

		case 'COVER':
			new SlideShow.CoverTransition(canvas, image1, image2).start(1);
			break;

		case 'Dissolve':
			new SlideShow.SimpleDissolveTransition(canvas, image1, image2).start();
			break;

		case 'PushWipe':
			new SlideShow.PushTransition(canvas, image1, image2).start(1);
			break;

		case 'BarnDoorWipe':
			new SlideShow.SplitTransition(canvas, image1, image2).start(1);
			break;
	
		case 'EllipseWipe':
			// todo: have to find!
			break;

		case 'WaterfallWipe':
			// TODO: Need to implement
			break;

		default:
			new SlideShow.NoTransition(canvas, image1, image2).start();
			console.error('Unknown transition type', slideInfo.transitionType);
			break;
	}

	return;
};

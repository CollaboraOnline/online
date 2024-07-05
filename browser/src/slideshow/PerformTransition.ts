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
    type: string,
) {

    switch (type) {
        case 'FADE':
            new SlideShow.FadeTransition(
                canvas,
                image1,
                image2,
            ).start(2);
            break;
        case 'WIPE':
            new SlideShow.WipeTransition(
                canvas,
                image1,
                image2,
            ).start(1);
            break;
        case 'WHEEL':
            // 1,2,3, 4, 8
            new SlideShow.WheelTransition(
                canvas,
                image1,
                image2,
            ).start(2);
            break;

        case 'UNCOVER':
            new SlideShow.UncoverTransition(
                canvas,
                image1,
                image2,
            ).start(2);
            break;
        
        case 'BARS':
            new SlideShow.BarsTransition(
                canvas,
                image1,
                image2,
            ).start(1);
            break;
        
        case 'CHECKERS':
            new SlideShow.CheckersTransition(
                canvas,
                image1,
                image2,
            ).start(1);
            break;

        case 'PLUS':
            new SlideShow.PlusTransition(
                canvas,
                image1,
                image2,
            ).start();
            break;
        
        case 'CIRCLE':
            new SlideShow.CircleTransition(
                canvas,
                image1,
                image2,
            ).start();
            break;

        case 'DIAMOND':
            new SlideShow.DiamondTransition(
                canvas,
                image1,
                image2,
            ).start();
            break;

        case 'OVAL':
            new SlideShow.OvalTransition(
                canvas,
                image1,
                image2,
            ).start(1);
            break;

        case 'BOX':
            new SlideShow.BoxTransition(
                canvas,
                image1,
                image2,
            ).start(1);
            break;

        case 'WEDGE':
            new SlideShow.WedgeTransition(
                canvas,
                image1,
                image2,
            ).start();
            break;

        case 'VENETIAN':
            new SlideShow.VenetianTransition(
                canvas,
                image1,
                image2,
            ).start(1);
            break;
        
        case 'CUT':
            new SlideShow.CutTransition(
                canvas,
                image1,
                image2,
            ).start();
            break;
        
        case 'COVER':
            new SlideShow.CoverTransition(
                canvas,
                image1,
                image2,
            ).start(1);
            break;

        case 'DISSOLVE':
            new SlideShow.SimpleDissolveTransition(
                canvas,
                image1,
                image2,
            ).start();
            break;

        case 'PUSH':
            new SlideShow.PushTransition(
                canvas,
                image1,
                image2,
            ).start(1);
            break;

        case 'SPLIT':
            new SlideShow.SplitTransition(
                canvas,
                image1,
                image2,
            ).start(1);
            break;

        default:
            console.error('Unknown transition type');
            break;
    }

	return;
};

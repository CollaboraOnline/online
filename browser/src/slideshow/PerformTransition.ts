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
            new FadeTransition(
                canvas,
                image1,
                image2,
            ).start(2);
            break;
        case 'WIPE':
            new WipeTransition(
                canvas,
                image1,
                image2,
            ).start(1);
            break;
        case 'WHEEL':
            // 1,2,3, 4, 8
            new WheelTransition(
                canvas,
                image1,
                image2,
            ).start(2);
            break;

        case 'UNCOVER':
            new UncoverTransition(
                canvas,
                image1,
                image2,
            ).start(2);
            break;
        
        case 'BARS':
            new BarsTransition(
                canvas,
                image1,
                image2,
            ).start(1);
            break;
        
        case 'CHECKERS':
            new CheckersTransition(
                canvas,
                image1,
                image2,
            ).start(1);
            break;

        case 'PLUS':
            new PlusTransition(
                canvas,
                image1,
                image2,
            ).start();
            break;
        
        case 'CIRCLE':
            new CircleTransition(
                canvas,
                image1,
                image2,
            ).start();
            break;

        case 'DIAMOND':
            new DiamondTransition(
                canvas,
                image1,
                image2,
            ).start();
            break;
        default:
            console.error('Unknown transition type');
            break;
    }

	return;
};

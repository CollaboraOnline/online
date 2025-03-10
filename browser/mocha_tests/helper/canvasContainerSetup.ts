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

/// <reference path="../../src/canvas/CanvasSectionContainer.ts" />
/// <reference path="../../src/canvas/CanvasSectionObject.ts" />
/// <reference path="../../src/canvas/sections/TilesSection.ts" />

function canvasDomString() {
    return `
    <!DOCTYPE html>
    <html>
      <head></head>
      <body>
        <div id="canvas-container">
            <canvas id="document-canvas"></canvas>
        </div>
      </body>
    </html>`;
}

function setupCanvasContainer(width: number, height: number): CanvasSectionContainer {
  const canvas = <HTMLCanvasElement>document.getElementById('document-canvas');

  const sectionContainer = new CanvasSectionContainer(canvas, true /* disableDrawing? */);
  sectionContainer.onResize(width, height); // Set canvas size.

  return sectionContainer;
}

// The necessary canvas API functions are mocked here as we don't use canvas node module.
function addMockCanvas(window: any): void {
	window.HTMLCanvasElement.prototype.getContext = function () {
		return {
			fillRect: function() {},
			clearRect: function(){},
			setTransform: function(){},
			drawImage: function(){},
			save: function(){},
			fillText: function(){},
			restore: function(){},
			beginPath: function(){},
			moveTo: function(){},
			lineTo: function(){},
			closePath: function(){},
			stroke: function(){},
			translate: function(){},
			scale: function(){},
			rotate: function(){},
			fill: function(){},
			transform: function(){},
			rect: function(){},
			clip: function(){},
		};
	};
}

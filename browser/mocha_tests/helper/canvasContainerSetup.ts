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

function setupCanvasContainer(width: number, height: number) {
  const canvas = <HTMLCanvasElement>document.getElementById('document-canvas');

  app.sectionContainer = new CanvasSectionContainer(canvas, true /* disableDrawing? */);
  app.sectionContainer.enableDrawing();

  app.sectionContainer.onResize(width, height); // Set canvas size.

  app.layoutingService = new LayoutingService();

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

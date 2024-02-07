/// <reference path="../../src/layer/tile/CanvasSectionContainer.ts" />
/// <reference path="../../src/layer/tile/TilesSection.ts" />

import { CanvasSectionContainer } from "../../src/layer/tile/CanvasSectionContainer";

export function canvasDomString() {
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

export function setupCanvasContainer(width: number, height: number): CanvasSectionContainer {
    const canvas = <HTMLCanvasElement>document.getElementById('document-canvas');

    const sectionContainer = new CanvasSectionContainer(canvas, true /* disableDrawing? */);
    sectionContainer.onResize(width, height); // Set canvas size.

    return sectionContainer;
}

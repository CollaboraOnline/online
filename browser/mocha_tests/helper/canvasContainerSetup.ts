/// <reference path="../../src/layer/tile/CanvasSectionContainer.ts" />

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

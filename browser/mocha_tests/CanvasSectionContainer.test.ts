/// <reference path="./refs/globals.ts"/>
/// <reference path="../src/geometry/Point.ts" />
/// <reference path="../src/geometry/Bounds.ts" />
/// <reference path="../src/layer/tile/CanvasSectionContainer.ts" />

var jsdom = require('jsdom');

var assert = require('assert').strict;

var dom = new jsdom.JSDOM(
    `<!DOCTYPE html>
    <html>
      <head></head>
      <body>
        <div id="canvas-container">
            <canvas id="document-canvas"></canvas>
        </div>
      </body>
    </html>`
);

global.window = dom.window;
global.document = dom.window.document;

const canvasWidth = 1024;
const canvasHeight = 768;

interface Rectangle {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
};

function assertPosSize(actual: Rectangle, expected: Rectangle) {
    // Only assert components of expected that are provided.
    if (typeof expected.x === 'number')
        assert.equal(actual.x, expected.x, 'Left mismatch');
    if (typeof expected.y === 'number')
        assert.equal(actual.y, expected.y, 'Top mismatch');
    if (typeof expected.width === 'number')
        assert.equal(actual.width, expected.width, 'Width mismatch');
    if (typeof expected.height === 'number')
        assert.equal(actual.height, expected.height, 'Height mismatch');
}

function getSectionRectangle(section: CanvasSectionObject): Rectangle {
    return {
        x: section.myTopLeft[0],
        y: section.myTopLeft[1],
        width: section.size[0],
        height: section.size[1],
    };
}

describe('Singleton section container', function() {
    const canvas = <HTMLCanvasElement>document.getElementById('document-canvas');
    const docLayer = {};
    const tsManager = {};

    const sectionContainer = new CanvasSectionContainer(canvas, true /* disableDrawing? */);
    sectionContainer.onResize(canvasWidth, canvasHeight); // Set canvas size.

    sectionContainer.createSection({
        name: 'OnlySection',
        anchor: 'top left',
        position: [0, 0],
        size: [1, 1],
        expand: 'bottom right',
        processingOrder: 1,
        drawingOrder: 1,
        zIndex: 1,
        interactable: false,
        sectionProperties: {
            docLayer: docLayer,
            tsManager: tsManager,
            strokeStyle: '#c0c0c0'
        },
    });

    sectionContainer.enableDrawing();
    it('Container should have OnlySection', function() {
        assert.ok(sectionContainer.doesSectionExist('OnlySection'));
    });

    it('OnlySection PosSize checks', function () {
        const only = sectionContainer.getSectionWithName('OnlySection');
        const onlyRect = getSectionRectangle(only);
        assertPosSize(onlyRect, {x: 0, y: 0, width: 1024, height: 768});
    });
});

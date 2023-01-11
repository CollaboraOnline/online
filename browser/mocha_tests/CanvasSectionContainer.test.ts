/// <reference path="./refs/globals.ts"/>
/// <reference path="../src/geometry/Point.ts" />
/// <reference path="../src/geometry/Bounds.ts" />
/// <reference path="./helper/canvasContainerSetup.ts" />
/// <reference path="./helper/rectUtil.ts" />

var jsdom = require('jsdom');
var assert = require('assert').strict;

var dom = new jsdom.JSDOM(canvasDomString());

global.window = dom.window;
global.document = dom.window.document;

const canvasWidth = 1024;
const canvasHeight = 768;

describe('Singleton section container', function() {

    const sectionContainer = setupCanvasContainer(canvasWidth, canvasHeight);

    const docLayer = {};
    const tsManager = {};

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

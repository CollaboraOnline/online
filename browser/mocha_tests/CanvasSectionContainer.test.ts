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
const halfWidth = Math.floor(canvasWidth / 2);
const halfHeight = Math.floor(canvasHeight / 2);
const originX = 0;
const originY = 0;

describe('Singleton section container', function() {

    const sectionContainer = setupCanvasContainer(canvasWidth, canvasHeight);

    const docLayer = {};
    const tsManager = {};

    sectionContainer.createSection({
        name: 'OnlySection',
        anchor: 'top left',
        position: [originX, originY],
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
        assertPosSize(onlyRect,
            {
                x: originX,
                y: originY,
                width: canvasWidth - originX,
                height: canvasHeight - originY
            });
    });
});

describe('Horizontally packed two section container', function() {

    const sectionContainer = setupCanvasContainer(canvasWidth, canvasHeight);

    const docLayer = {};
    const tsManager = {};

    sectionContainer.createSection({
        name: 'LeftSection',
        anchor: 'top left',
        position: [originX, originY],
        size: [halfWidth, 1],
        expand: 'bottom',
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

    sectionContainer.createSection({
        name: 'RightSection',
        anchor: ['top', ['LeftSection', 'right', 'left']],
        position: [originX, originY],
        size: [1, 1],
        expand: 'bottom right',
        processingOrder: 2,
        drawingOrder: 2,
        zIndex: 1,
        interactable: false,
        sectionProperties: {
            docLayer: docLayer,
            tsManager: tsManager,
            strokeStyle: '#c0c0c0'
        },
    });

    sectionContainer.enableDrawing();
    it('Container should have LeftSection', function() {
        assert.ok(sectionContainer.doesSectionExist('LeftSection'));
    });

    it('Container should have RightSection', function() {
        assert.ok(sectionContainer.doesSectionExist('RightSection'));
    });

    it('LeftSection PosSize checks', function () {
        const left = sectionContainer.getSectionWithName('LeftSection');
        const leftRect = getSectionRectangle(left);
        assertPosSize(leftRect,
            {
                x: originX,
                y: originY,
                width: halfWidth,
                height: canvasHeight - originY
            });
    });

    it('RightSection PosSize checks', function () {
        const right = sectionContainer.getSectionWithName('RightSection');
        const rightRect = getSectionRectangle(right);
        assertPosSize(rightRect,
            {
                x: 1 + halfWidth + originX,
                y: originY,
                width: halfWidth - 1 - originX,
                height: canvasHeight - originY
            });
    });
});

describe('Vertically packed two section container', function() {

    const sectionContainer = setupCanvasContainer(canvasWidth, canvasHeight);

    const docLayer = {};
    const tsManager = {};

    sectionContainer.createSection({
        name: 'TopSection',
        anchor: 'top left',
        position: [originX, originY],
        size: [1, halfHeight],
        expand: 'right',
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

    sectionContainer.createSection({
        name: 'BottomSection',
        anchor: [['TopSection', 'bottom', 'top'], 'left'],
        position: [originX, originY],
        size: [1, 1],
        expand: 'bottom right',
        processingOrder: 2,
        drawingOrder: 2,
        zIndex: 1,
        interactable: false,
        sectionProperties: {
            docLayer: docLayer,
            tsManager: tsManager,
            strokeStyle: '#c0c0c0'
        },
    });

    sectionContainer.enableDrawing();
    it('Container should have TopSection', function() {
        assert.ok(sectionContainer.doesSectionExist('TopSection'));
    });

    it('Container should have BottomSection', function() {
        assert.ok(sectionContainer.doesSectionExist('BottomSection'));
    });

    it('TopSection PosSize checks', function () {
        const top = sectionContainer.getSectionWithName('TopSection');
        const topRect = getSectionRectangle(top);
        assertPosSize(topRect,
            {
                x: originX,
                y: originY,
                width: canvasWidth - originX,
                height: halfHeight
            });
    });

    it('BottomSection PosSize checks', function () {
        const bottom = sectionContainer.getSectionWithName('BottomSection');
        const bottomRect = getSectionRectangle(bottom);
        assertPosSize(bottomRect,
            {
                x: originX,
                y: 1 + halfHeight + originY,
                width: canvasWidth - originX,
                height: halfHeight - 1 - originY
            });
    });
});

// '-left' layout is usually used for RTL where it is used to attach a section's right to the left of another section.
describe('Horizontally packed two section container with -left layout', function() {

    const sectionContainer = setupCanvasContainer(canvasWidth, canvasHeight);

    const docLayer = {};
    const tsManager = {};

    sectionContainer.createSection({
        name: 'RightSection',
        anchor: 'top right',
        position: [originX, originY],
        size: [halfWidth, 1],
        expand: 'bottom',
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

    sectionContainer.createSection({
        name: 'LeftSection',
        // Attach LeftSection's right to left of RightSection.
        anchor: ['top', ['RightSection', '-left', 'right']],
        position: [originX, originY],
        size: [1, 1],
        expand: 'bottom left',
        processingOrder: 2,
        drawingOrder: 2,
        zIndex: 1,
        interactable: false,
        sectionProperties: {
            docLayer: docLayer,
            tsManager: tsManager,
            strokeStyle: '#c0c0c0'
        },
    });

    sectionContainer.enableDrawing();
    it('Container should have LeftSection', function() {
        assert.ok(sectionContainer.doesSectionExist('LeftSection'));
    });

    it('Container should have RightSection', function() {
        assert.ok(sectionContainer.doesSectionExist('RightSection'));
    });

    it('LeftSection PosSize checks', function () {
        const left = sectionContainer.getSectionWithName('LeftSection');
        const leftRect = getSectionRectangle(left);
        assertPosSize(leftRect,
            {
                x: 0,
                y: originY,
                width: halfWidth - 1,
                height: canvasHeight - originY
            });
    });

    it('RightSection PosSize checks', function () {
        const right = sectionContainer.getSectionWithName('RightSection');
        const rightRect = getSectionRectangle(right);
        assertPosSize(rightRect,
            {
                x: canvasWidth - originX - halfWidth,
                y: originY,
                width: halfWidth,
                height: canvasHeight - originY
            });
    });
});

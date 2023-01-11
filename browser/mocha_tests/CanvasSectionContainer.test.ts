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

describe('Horizontally packed two section container', function() {

    const sectionContainer = setupCanvasContainer(canvasWidth, canvasHeight);

    const docLayer = {};
    const tsManager = {};

    sectionContainer.createSection({
        name: 'LeftSection',
        anchor: 'top left',
        position: [0, 0],
        size: [Math.round(canvasWidth / 2), 1],
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
        position: [0, 0],
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
        assertPosSize(leftRect, {x: 0, y: 0, width: 512, height: 768});
    });

    it('RightSection PosSize checks', function () {
        const right = sectionContainer.getSectionWithName('RightSection');
        const rightRect = getSectionRectangle(right);
        assertPosSize(rightRect, {x: 513, y: 0, width: 511, height: 768});
    });
});

describe('Vertically packed two section container', function() {

    const sectionContainer = setupCanvasContainer(canvasWidth, canvasHeight);

    const docLayer = {};
    const tsManager = {};

    sectionContainer.createSection({
        name: 'TopSection',
        anchor: 'top left',
        position: [0, 0],
        size: [1, Math.round(canvasHeight / 2)],
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
        position: [0, 0],
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
        assertPosSize(topRect, {x: 0, y: 0, width: 1024, height: 384});
    });

    it('BottomSection PosSize checks', function () {
        const bottom = sectionContainer.getSectionWithName('BottomSection');
        const bottomRect = getSectionRectangle(bottom);
        assertPosSize(bottomRect, {x: 0, y: 385, width: 1024, height: 383});
    });
});

/// <reference path="./refs/globals.ts"/>
/// <reference path="../src/core/geometry.ts" />
/// <reference path="../src/geometry/Point.ts" />
/// <reference path="../src/geometry/Bounds.ts" />
/// <reference path="../src/app/TilesMiddleware.ts" />
/// <reference path="./helper/canvasContainerSetup.ts" />
/// <reference path="./helper/rectUtil.ts" />

var jsdom = require('jsdom');
var assert = require('assert').strict;

var dom = new jsdom.JSDOM(canvasDomString());

addMockCanvas(dom.window);
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

    let onlySection = new app.definitions.canvasSectionObject();
    onlySection.name = 'OnlySection';
    onlySection.anchor = ['top', 'left'];
    onlySection.position = [originX, originY];
    onlySection.size = [1, 1];
    onlySection.expand = ['bottom', 'right'];
    onlySection.processingOrder = onlySection.drawingOrder = onlySection.zIndex = 1;
    onlySection.interactable = false;
    onlySection.sectionProperties = {
        docLayer: docLayer,
        tsManager: tsManager,
        strokeStyle: '#c0c0c0'
    };
    sectionContainer.addSection(onlySection);

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

    let leftSection = new app.definitions.canvasSectionObject();
    leftSection.name = 'LeftSection';
    leftSection.anchor = ['top', 'left'];
    leftSection.position = [originX, originY];
    leftSection.size = [halfWidth, 1];
    leftSection.expand = ['bottom'];
    leftSection.processingOrder = leftSection.drawingOrder = leftSection.zIndex = 1;
    leftSection.interactable = false;
    leftSection.sectionProperties = {
        docLayer: docLayer,
        tsManager: tsManager,
        strokeStyle: '#c0c0c0'
    };
    sectionContainer.addSection(leftSection);

    let rightSection = new app.definitions.canvasSectionObject();
    rightSection.name = 'RightSection';
    rightSection.anchor = ['top', ['LeftSection', 'right', 'left']];
    rightSection.position = [originX, originY];
    rightSection.size = [1, 1];
    rightSection.expand = ['bottom', 'right'];
    rightSection.processingOrder = rightSection.drawingOrder = 2;
    rightSection.zIndex = 1;
    rightSection.interactable = false;
    rightSection.sectionProperties = {
        docLayer: docLayer,
        tsManager: tsManager,
        strokeStyle: '#c0c0c0'
    };
    sectionContainer.addSection(rightSection);

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

    let topSection = new app.definitions.canvasSectionObject();
    topSection.name = 'TopSection';
    topSection.anchor = ['top', 'left'];
    topSection.position = [originX, originY];
    topSection.size = [1, halfHeight];
    topSection.expand = ['right'];
    topSection.processingOrder = topSection.drawingOrder = topSection.zIndex = 1;
    topSection.interactable = false;
    topSection.sectionProperties = {
        docLayer: docLayer,
        tsManager: tsManager,
        strokeStyle: '#c0c0c0'
    };
    sectionContainer.addSection(topSection);

    let bottomSection = new app.definitions.canvasSectionObject();
    bottomSection.name = 'BottomSection';
    bottomSection.anchor = [['TopSection', 'bottom', 'top'], 'left'];
    bottomSection.position = [originX, originY];
    bottomSection.size = [1, 1];
    bottomSection.expand = ['bottom', 'right'];
    bottomSection.processingOrder = bottomSection.drawingOrder = 2;
    bottomSection.zIndex = 1;
    bottomSection.interactable = false;
    bottomSection.sectionProperties = {
        docLayer: docLayer,
        tsManager: tsManager,
        strokeStyle: '#c0c0c0'
    };
    sectionContainer.addSection(bottomSection);

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

    let rightSection = new app.definitions.canvasSectionObject();
    rightSection.name = 'RightSection';
    rightSection.anchor = ['top', 'right'];
    rightSection.position = [originX, originY];
    rightSection.size = [halfWidth, 1];
    rightSection.expand = ['bottom'];
    rightSection.processingOrder = rightSection.drawingOrder = rightSection.zIndex = 1;
    rightSection.interactable = false;
    rightSection.sectionProperties = {
        docLayer: docLayer,
        tsManager: tsManager,
        strokeStyle: '#c0c0c0'
    };
    sectionContainer.addSection(rightSection);

    let leftSection = new app.definitions.canvasSectionObject();
    leftSection.name = 'LeftSection';
    leftSection.anchor = ['top', ['RightSection', '-left', 'right']]; // Attach LeftSection's right to left of RightSection.
    leftSection.position = [originX, originY];
    leftSection.size = [1, 1];
    leftSection.expand = ['bottom', 'left'];
    leftSection.processingOrder = leftSection.drawingOrder = 2;
    leftSection.zIndex = 1;
    leftSection.interactable = false;
    leftSection.sectionProperties = {
        docLayer: docLayer,
        tsManager: tsManager,
        strokeStyle: '#c0c0c0'
    };
    sectionContainer.addSection(leftSection);

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

/// <reference path="./types.ts" />

function assertPosSize(actual: mtest.Rectangle, expected: mtest.Rectangle) {
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

function getSectionRectangle(section: CanvasSectionObject): mtest.Rectangle {
    return {
        x: section.myTopLeft[0],
        y: section.myTopLeft[1],
        width: section.size[0],
        height: section.size[1],
    };
}

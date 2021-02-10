/* eslint-disable */
/*
 * CPoint represents a point with x and y coordinates.
 */
var CPoint = /** @class */ (function () {
    function CPoint(x, y, round) {
        if (round === void 0) { round = false; }
        this.x = (round ? Math.round(x) : x);
        this.y = (round ? Math.round(y) : y);
    }
    CPoint.arrayToPoint = function (arr) {
        return new CPoint(arr[0], arr[1]);
    };
    CPoint.parse = function (pointString) {
        var pointParts = pointString.match(/\d+/g);
        if (pointParts === null || pointParts.length < 2) {
            console.error('incomplete point');
            return undefined;
        }
        return new CPoint(parseInt(pointParts[0]), parseInt(pointParts[1]));
    };
    ;
    CPoint.prototype.clone = function () {
        return new CPoint(this.x, this.y);
    };
    // non-destructive, returns a new point
    CPoint.prototype.add = function (point) {
        return this.clone()._add(point);
    };
    // destructive, used directly for performance in situations where it's safe to modify existing point
    CPoint.prototype._add = function (point) {
        this.x += point.x;
        this.y += point.y;
        return this;
    };
    CPoint.prototype.subtract = function (point) {
        return this.clone()._subtract(point);
    };
    CPoint.prototype._subtract = function (point) {
        this.x -= point.x;
        this.y -= point.y;
        return this;
    };
    CPoint.prototype.divideBy = function (num) {
        return this.clone()._divideBy(num);
    };
    CPoint.prototype._divideBy = function (num) {
        this.x /= num;
        this.y /= num;
        return this;
    };
    CPoint.prototype.multiplyBy = function (num) {
        return this.clone()._multiplyBy(num);
    };
    CPoint.prototype._multiplyBy = function (num) {
        this.x *= num;
        this.y *= num;
        return this;
    };
    CPoint.prototype.round = function () {
        return this.clone()._round();
    };
    CPoint.prototype._round = function () {
        this.x = Math.round(this.x);
        this.y = Math.round(this.y);
        return this;
    };
    CPoint.prototype.floor = function () {
        return this.clone()._floor();
    };
    CPoint.prototype._floor = function () {
        this.x = Math.floor(this.x);
        this.y = Math.floor(this.y);
        return this;
    };
    CPoint.prototype.ceil = function () {
        return this.clone()._ceil();
    };
    CPoint.prototype._ceil = function () {
        this.x = Math.ceil(this.x);
        this.y = Math.ceil(this.y);
        return this;
    };
    CPoint.prototype.distanceTo = function (point) {
        var x = point.x - this.x, y = point.y - this.y;
        return Math.sqrt(x * x + y * y);
    };
    CPoint.prototype.equals = function (point) {
        // Proper ieee 754 equality comparison.
        return Math.abs(point.x - this.x) < Number.EPSILON &&
            Math.abs(point.y - this.y) < Number.EPSILON;
    };
    CPoint.prototype.contains = function (point) {
        return Math.abs(point.x) <= Math.abs(this.x) &&
            Math.abs(point.y) <= Math.abs(this.y);
    };
    CPoint.prototype.assign = function (point) {
        var xChanged = this.setX(point.x);
        var yChanged = this.setY(point.y);
        return xChanged || yChanged;
    };
    CPoint.prototype.setX = function (x) {
        if (x === this.x) {
            return false;
        }
        this.x = x;
        return true;
    };
    CPoint.prototype.setY = function (y) {
        if (y === this.y) {
            return false;
        }
        this.y = y;
        return true;
    };
    CPoint.prototype.toString = function () {
        return 'CPoint(' + this.x + ', ' + this.y + ')';
    };
    return CPoint;
}());
;
/* eslint-disable */
/*
 * CBounds represents a rectangular area on the screen in pixel coordinates.
 */
var CBounds = /** @class */ (function () {
    function CBounds(a, b) {
        if (a !== undefined)
            this.extend(a);
        if (b !== undefined)
            this.extend(b);
    }
    CBounds.fromPointArray = function (points) {
        if (!points.length)
            return undefined;
        if (points.length == 1)
            return new CBounds(points[0], points[0]);
        var bounds = new CBounds(points[0], points[1]);
        for (var i = 2; i < points.length; ++i)
            bounds.extend(points[i]);
        return bounds;
    };
    CBounds.parse = function (rectString) {
        var rectParts = rectString.match(/\d+/g);
        if (rectParts === null || rectParts.length < 4) {
            console.error('incomplete rectangle');
            return undefined;
        }
        var refPoint1 = new CPoint(parseInt(rectParts[0]), parseInt(rectParts[1]));
        var offset = new CPoint(parseInt(rectParts[2]), parseInt(rectParts[3]));
        var refPoint2 = refPoint1.add(offset);
        return new CBounds(refPoint1, refPoint2);
    };
    ;
    CBounds.parseArray = function (rectListString) {
        var parts = rectListString.match(/\d+/g);
        if (parts === null || parts.length < 4) {
            return new Array();
        }
        var rectangles = new Array();
        for (var i = 0; (i + 3) < parts.length; i += 4) {
            var refPoint1 = new CPoint(parseInt(parts[i]), parseInt(parts[i + 1]));
            var offset = new CPoint(parseInt(parts[i + 2]), parseInt(parts[i + 3]));
            var refPoint2 = refPoint1.add(offset);
            rectangles.push(new CBounds(refPoint1, refPoint2));
        }
        return rectangles;
    };
    ;
    // extend the bounds to contain the given point
    CBounds.prototype.extend = function (point) {
        if (!this.min && !this.max) {
            this.min = point.clone();
            this.max = point.clone();
        }
        else {
            this.min.x = Math.min(point.x, this.min.x);
            this.max.x = Math.max(point.x, this.max.x);
            this.min.y = Math.min(point.y, this.min.y);
            this.max.y = Math.max(point.y, this.max.y);
        }
        return this;
    };
    CBounds.prototype.clone = function () {
        return new CBounds(this.min, this.max);
    };
    CBounds.prototype.getCenter = function (round) {
        if (round === void 0) { round = false; }
        return new CPoint((this.min.x + this.max.x) / 2, (this.min.y + this.max.y) / 2, round);
    };
    CBounds.prototype.round = function () {
        this.min.x = Math.round(this.min.x);
        this.min.y = Math.round(this.min.y);
        this.max.x = Math.round(this.max.x);
        this.max.y = Math.round(this.max.y);
    };
    CBounds.prototype.getBottomLeft = function () {
        return new CPoint(this.min.x, this.max.y);
    };
    CBounds.prototype.getTopRight = function () {
        return new CPoint(this.max.x, this.min.y);
    };
    CBounds.prototype.getTopLeft = function () {
        return new CPoint(this.min.x, this.min.y);
    };
    CBounds.prototype.getBottomRight = function () {
        return new CPoint(this.max.x, this.max.y);
    };
    CBounds.prototype.getSize = function () {
        return this.max.subtract(this.min);
    };
    CBounds.prototype.contains = function (obj) {
        var min, max;
        if (obj instanceof CBounds) {
            min = obj.min;
            max = obj.max;
        }
        else {
            min = max = obj;
        }
        return (min.x >= this.min.x) &&
            (max.x <= this.max.x) &&
            (min.y >= this.min.y) &&
            (max.y <= this.max.y);
    };
    CBounds.prototype.intersects = function (bounds) {
        var min = this.min, max = this.max, min2 = bounds.min, max2 = bounds.max, xIntersects = (max2.x >= min.x) && (min2.x <= max.x), yIntersects = (max2.y >= min.y) && (min2.y <= max.y);
        return xIntersects && yIntersects;
    };
    // non-destructive, returns a new Bounds
    CBounds.prototype.add = function (point) {
        return this.clone()._add(point);
    };
    // destructive, used directly for performance in situations where it's safe to modify existing Bounds
    CBounds.prototype._add = function (point) {
        this.min._add(point);
        this.max._add(point);
        return this;
    };
    CBounds.prototype.getPointArray = function () {
        return Array(this.getBottomLeft(), this.getBottomRight(), this.getTopLeft(), this.getTopRight());
    };
    CBounds.prototype.toString = function () {
        return '[' +
            this.min.toString() + ', ' +
            this.max.toString() + ']';
    };
    CBounds.prototype.isValid = function () {
        return !!(this.min && this.max);
    };
    CBounds.prototype.intersectsAny = function (boundsArray) {
        for (var i = 0; i < boundsArray.length; ++i) {
            if (boundsArray[i].intersects(this)) {
                return true;
            }
        }
        return false;
    };
    CBounds.prototype.clampX = function (x) {
        return Math.max(this.min.x, Math.min(this.max.x, x));
    };
    CBounds.prototype.clampY = function (y) {
        return Math.max(this.min.y, Math.min(this.max.y, y));
    };
    CBounds.prototype.clampPoint = function (obj) {
        return new CPoint(this.clampX(obj.x), this.clampY(obj.y));
    };
    CBounds.prototype.clampBounds = function (obj) {
        return new CBounds(new CPoint(this.clampX(obj.min.x), this.clampY(obj.min.y)), new CPoint(this.clampX(obj.max.x), this.clampY(obj.max.y)));
    };
    CBounds.prototype.equals = function (bounds) {
        return this.min.equals(bounds.min) && this.max.equals(bounds.max);
    };
    return CBounds;
}());
;
/* eslint-disable */
/*
 * CPath is the base class for all vector paths like polygons and circles used to draw overlay
 * objects like cell-cursors, cell-selections etc.
 */
var CPath = /** @class */ (function () {
    function CPath(options) {
        this.stroke = true;
        this.color = '#3388ff';
        this.weight = 3;
        this.opacity = 1;
        this.lineCap = 'round';
        this.lineJoin = 'round';
        this.fill = false;
        this.fillColor = this.color;
        this.fillOpacity = 0.2;
        this.fillRule = 'evenodd';
        this.interactive = true;
        this.fixed = false;
        this.radius = 0;
        this.radiusY = 0;
        this.zIndex = 0;
        this.isDeleted = false;
        this.renderer = null;
        this.setStyleOptions(options);
        this.radius = options.radius !== undefined ? options.radius : this.radius;
        this.radiusY = options.radiusY !== undefined ? options.radiusY : this.radiusY;
        this.point = options.point !== undefined ? options.point : this.point;
        CPath.countObjects += 1;
        this.id = CPath.countObjects;
        this.zIndex = this.id;
    }
    CPath.prototype.setStyleOptions = function (options) {
        this.stroke = options.stroke !== undefined ? options.stroke : this.stroke;
        this.color = options.color !== undefined ? options.color : this.color;
        this.weight = options.weight !== undefined ? options.weight : this.weight;
        this.opacity = options.opacity !== undefined ? options.opacity : this.opacity;
        this.lineCap = options.lineCap !== undefined ? options.lineCap : this.lineCap;
        this.lineJoin = options.lineJoin !== undefined ? options.lineJoin : this.lineJoin;
        this.fill = options.fill !== undefined ? options.fill : this.fill;
        this.fillColor = options.fillColor !== undefined ? options.fillColor : this.fillColor;
        this.fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : this.fillOpacity;
        this.fillRule = options.fillRule !== undefined ? options.fillRule : this.fillRule;
        this.cursorType = options.cursorType !== undefined ? options.cursorType : this.cursorType;
        this.interactive = options.interactive !== undefined ? options.interactive : this.interactive;
        this.fixed = options.fixed !== undefined ? options.fixed : this.fixed;
    };
    CPath.prototype.setRenderer = function (rendererObj) {
        this.renderer = rendererObj;
    };
    CPath.prototype.getId = function () {
        return this.id;
    };
    CPath.prototype.setDeleted = function () {
        this.isDeleted = true;
    };
    CPath.prototype.redraw = function (oldBounds) {
        if (this.renderer)
            this.renderer.updatePath(this, oldBounds);
    };
    CPath.prototype.setStyle = function (style) {
        var oldBounds = this.getBounds();
        this.setStyleOptions(style);
        if (this.renderer) {
            this.renderer.updateStyle(this, oldBounds);
        }
    };
    CPath.prototype.updatePathAllPanes = function (paintArea) {
        var viewBounds = this.renderer.getBounds().clone();
        var splitPanesContext = this.renderer.getSplitPanesContext();
        var paneBoundsList = splitPanesContext ?
            splitPanesContext.getPxBoundList() :
            [viewBounds];
        var paneProperties = splitPanesContext ? splitPanesContext.getPanesProperties() :
            [{ xFixed: false, yFixed: false }];
        for (var i = 0; i < paneBoundsList.length; ++i) {
            var panePaintArea = paintArea ? paintArea.clone() : paneBoundsList[i].clone();
            if (paintArea) {
                var paneArea = paneBoundsList[i];
                if (!paneArea.intersects(panePaintArea))
                    continue;
                panePaintArea.min.x = Math.max(panePaintArea.min.x, paneArea.min.x);
                panePaintArea.min.y = Math.max(panePaintArea.min.y, paneArea.min.y);
                panePaintArea.max.x = Math.min(panePaintArea.max.x, paneArea.max.x);
                panePaintArea.max.y = Math.min(panePaintArea.max.y, paneArea.max.y);
            }
            this.updatePath(panePaintArea, paneProperties[i].xFixed, paneProperties[i].yFixed);
        }
    };
    CPath.prototype.updatePath = function (paintArea, paneXFixed, paneYFixed) {
        // Overridden in implementations.
    };
    CPath.prototype.bringToFront = function () {
        if (this.renderer) {
            this.renderer.bringToFront(this);
        }
    };
    CPath.prototype.bringToBack = function () {
        if (this.renderer) {
            this.renderer.bringToBack(this);
        }
    };
    CPath.prototype.getBounds = function () {
        // Overridden in implementations.
        return undefined;
    };
    CPath.prototype.empty = function () {
        // Overridden in implementations.
        return true;
    };
    CPath.prototype.getParts = function () {
        // Overridden in implementations.
        return Array();
    };
    CPath.prototype.clickTolerance = function () {
        // used when doing hit detection for Canvas layers
        return (this.stroke ? this.weight / 2 : 0) + (CPath.isTouchDevice ? 10 : 0);
    };
    CPath.prototype.setCursorType = function (cursorType) {
        // TODO: Implement this using move-move + hover handler.
        this.cursorType = cursorType;
    };
    CPath.countObjects = 0;
    CPath.isTouchDevice = false; // Need to set this from current L.Browser.touch
    return CPath;
}());
;
/* -*- js-indent-level: 8 -*- */
/*
 * CLineUtil contains different utility functions for line segments
 * and polylines (clipping, simplification, distances, etc.)
 */
var CLineUtil;
(function (CLineUtil) {
    var _lastCode = 0;
    // Simplify polyline with vertex reduction and Douglas-Peucker simplification.
    // Improves rendering performance dramatically by lessening the number of points to draw.
    function simplify(points, tolerance) {
        if (!tolerance || !points.length) {
            return points.slice();
        }
        var sqTolerance = tolerance * tolerance;
        // stage 1: vertex reduction
        points = _reducePoints(points, sqTolerance);
        // stage 2: Douglas-Peucker simplification
        points = _simplifyDP(points, sqTolerance);
        return points;
    }
    CLineUtil.simplify = simplify;
    // distance from a point to a segment between two points
    function pointToSegmentDistance(p, p1, p2) {
        return Math.sqrt(_sqDistToClosestPointOnSegment(p, p1, p2));
    }
    // Douglas-Peucker simplification, see http://en.wikipedia.org/wiki/Douglas-Peucker_algorithm
    function _simplifyDP(points, sqTolerance) {
        var len = points.length;
        var markers = typeof Uint8Array !== undefined + '' ? new Uint8Array(len) : Array(len);
        markers[0] = markers[len - 1] = true;
        _simplifyDPStep(points, markers, sqTolerance, 0, len - 1);
        var i;
        var newPoints = Array();
        for (i = 0; i < len; i++) {
            if (markers[i]) {
                newPoints.push(points[i]);
            }
        }
        return newPoints;
    }
    function _simplifyDPStep(points, markers, sqTolerance, first, last) {
        var maxSqDist = 0;
        var index;
        var i;
        var sqDist;
        for (i = first + 1; i <= last - 1; i++) {
            sqDist = _sqDistToClosestPointOnSegment(points[i], points[first], points[last]);
            if (sqDist > maxSqDist) {
                index = i;
                maxSqDist = sqDist;
            }
        }
        if (maxSqDist > sqTolerance) {
            markers[index] = true;
            _simplifyDPStep(points, markers, sqTolerance, first, index);
            _simplifyDPStep(points, markers, sqTolerance, index, last);
        }
    }
    // reduce points that are too close to each other to a single point
    function _reducePoints(points, sqTolerance) {
        var reducedPoints = [points[0]];
        for (var i = 1, prev = 0, len = points.length; i < len; i++) {
            if (_sqDist(points[i], points[prev]) > sqTolerance) {
                reducedPoints.push(points[i]);
                prev = i;
            }
        }
        if (prev < len - 1) {
            reducedPoints.push(points[len - 1]);
        }
        return reducedPoints;
    }
    // Cohen-Sutherland line clipping algorithm.
    // Used to avoid rendering parts of a polyline that are not currently visible.
    function clipSegment(a, b, bounds, useLastCode, round) {
        var codeA = useLastCode ? _lastCode : _getBitCode(a, bounds);
        var codeB = _getBitCode(b, bounds);
        var codeOut;
        var p;
        var newCode;
        // save 2nd code to avoid calculating it on the next segment
        _lastCode = codeB;
        while (true) {
            // if a,b is inside the clip window (trivial accept)
            if (!(codeA | codeB)) {
                return [a, b];
                // if a,b is outside the clip window (trivial reject)
            }
            else if (codeA & codeB) {
                return [];
                // other cases
            }
            else {
                codeOut = codeA || codeB;
                p = _getEdgeIntersection(a, b, codeOut, bounds, round);
                newCode = _getBitCode(p, bounds);
                if (codeOut === codeA) {
                    a = p;
                    codeA = newCode;
                }
                else {
                    b = p;
                    codeB = newCode;
                }
            }
        }
    }
    CLineUtil.clipSegment = clipSegment;
    function _getEdgeIntersection(a, b, code, bounds, round) {
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var min = bounds.min;
        var max = bounds.max;
        var x;
        var y;
        if (code & 8) { // top
            x = a.x + dx * (max.y - a.y) / dy;
            y = max.y;
        }
        else if (code & 4) { // bottom
            x = a.x + dx * (min.y - a.y) / dy;
            y = min.y;
        }
        else if (code & 2) { // right
            x = max.x;
            y = a.y + dy * (max.x - a.x) / dx;
        }
        else if (code & 1) { // left
            x = min.x;
            y = a.y + dy * (min.x - a.x) / dx;
        }
        return new CPoint(x, y, round);
    }
    function _getBitCode(p, bounds) {
        var code = 0;
        if (p.x < bounds.min.x) { // left
            code |= 1;
        }
        else if (p.x > bounds.max.x) { // right
            code |= 2;
        }
        if (p.y < bounds.min.y) { // bottom
            code |= 4;
        }
        else if (p.y > bounds.max.y) { // top
            code |= 8;
        }
        return code;
    }
    // square distance (to avoid unnecessary Math.sqrt calls)
    function _sqDist(p1, p2) {
        var dx = p2.x - p1.x, dy = p2.y - p1.y;
        return dx * dx + dy * dy;
    }
    // return closest point on segment or distance to that point
    function _sqClosestPointOnSegment(p, p1, p2) {
        var x = p1.x;
        var y = p1.y;
        var dx = p2.x - x;
        var dy = p2.y - y;
        var dot = dx * dx + dy * dy;
        var t;
        if (dot > 0) {
            t = ((p.x - x) * dx + (p.y - y) * dy) / dot;
            if (t > 1) {
                x = p2.x;
                y = p2.y;
            }
            else if (t > 0) {
                x += dx * t;
                y += dy * t;
            }
        }
        return new CPoint(x, y);
    }
    // returns distance to closest point on segment.
    function _sqDistToClosestPointOnSegment(p, p1, p2) {
        return _sqDist(_sqClosestPointOnSegment(p, p1, p2), p);
    }
})(CLineUtil || (CLineUtil = {}));
/* eslint-disable */
/// <reference path="CLineUtil.ts" />
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
/*
 * CPolyline implements polyline vector layer (a set of points connected with lines).
 * This class implements basic line drawing and CPointSet datastructure which is to be used
 * by the subclass CPolygon for drawing of overlays like cell-selections, cell-cursors etc.
 */
var CPointSet = /** @class */ (function () {
    function CPointSet() {
    }
    CPointSet.fromPointArray = function (array) {
        var ps = new CPointSet();
        ps.points = array;
        return ps;
    };
    CPointSet.fromSetArray = function (array) {
        var ps = new CPointSet();
        ps.pointSets = array;
        return ps;
    };
    CPointSet.prototype.isFlat = function () {
        return this.points !== undefined;
    };
    CPointSet.prototype.empty = function () {
        return ((this.points === undefined && this.pointSets === undefined) ||
            (this.pointSets === undefined && this.points.length == 0));
    };
    CPointSet.prototype.getPointArray = function () {
        return this.points;
    };
    CPointSet.prototype.getSetArray = function () {
        return this.pointSets;
    };
    CPointSet.prototype.setPointArray = function (array) {
        this.points = array;
        this.pointSets = undefined;
    };
    CPointSet.prototype.setSetArray = function (array) {
        this.points = undefined;
        this.pointSets = array;
    };
    return CPointSet;
}());
;
var CPolyline = /** @class */ (function (_super) {
    __extends(CPolyline, _super);
    function CPolyline(pointSet, options) {
        var _this = _super.call(this, options) || this;
        // how much to simplify the polyline on each zoom level
        // more = better performance and smoother look, less = more accurate
        _this.smoothFactor = 1.0;
        _this.noClip = false;
        _this.smoothFactor = options.smoothFactor !== undefined ? options.smoothFactor : _this.smoothFactor;
        _this.setPointSet(pointSet);
        return _this;
    }
    CPolyline.invalidPoint = function () {
        return new CPoint(-1000000, -1000000);
    };
    CPolyline.emptyBounds = function () {
        var bounds = new CBounds();
        bounds.extend(CPolyline.invalidPoint());
        return bounds;
    };
    CPolyline.prototype.getPointSet = function () {
        return this.pointSet;
    };
    CPolyline.prototype.setPointSet = function (pointSet) {
        var oldBounds;
        if (this.bounds)
            oldBounds = this.bounds.clone();
        else
            oldBounds = CPolyline.emptyBounds();
        this.pointSet = pointSet;
        this.updateRingsBounds();
        return this.redraw(oldBounds);
    };
    CPolyline.prototype.updateRingsBounds = function () {
        this.rings = new Array();
        var bounds = this.bounds = new CBounds();
        if (this.pointSet.empty()) {
            bounds.extend(CPolyline.invalidPoint());
            return;
        }
        CPolyline.calcRingsBounds(this.pointSet, this.rings, function (pt) {
            bounds.extend(pt);
        });
    };
    // Converts the point-set datastructure into an array of point-arrays each of which is called a 'ring'.
    // While doing that it also computes the bounds too.
    CPolyline.calcRingsBounds = function (pset, rings, updateBounds) {
        if (pset.isFlat()) {
            var srcArray = pset.getPointArray();
            if (srcArray === undefined) {
                rings.push([]);
                return;
            }
            var array = Array(srcArray.length);
            srcArray.forEach(function (pt, index) {
                array[index] = pt.clone();
                updateBounds(pt);
            });
            rings.push(array);
            return;
        }
        var psetArray = pset.getSetArray();
        if (psetArray) {
            psetArray.forEach(function (psetNext) {
                CPolyline.calcRingsBounds(psetNext, rings, updateBounds);
            });
        }
    };
    CPolyline.getPoints = function (pset) {
        if (pset.isFlat()) {
            var parray = pset.getPointArray();
            return parray === undefined ? [] : parray;
        }
        var psetArray = pset.getSetArray();
        if (psetArray && psetArray.length) {
            return CPolyline.getPoints(psetArray[0]);
        }
        return [];
    };
    CPolyline.prototype.getCenter = function () {
        var i;
        var halfDist;
        var segDist;
        var dist;
        var p1;
        var p2;
        var ratio;
        var points = CPolyline.getPoints(this.pointSet);
        var len = points.length;
        // polyline centroid algorithm; only uses the first ring if there are multiple
        for (i = 0, halfDist = 0; i < len - 1; i++) {
            halfDist += points[i].distanceTo(points[i + 1]) / 2;
        }
        for (i = 0, dist = 0; i < len - 1; i++) {
            p1 = points[i];
            p2 = points[i + 1];
            segDist = p1.distanceTo(p2);
            dist += segDist;
            if (dist > halfDist) {
                ratio = (dist - halfDist) / segDist;
                return new CPoint(p2.x - ratio * (p2.x - p1.x), p2.y - ratio * (p2.y - p1.y));
            }
        }
    };
    CPolyline.prototype.getBounds = function () {
        return this.bounds;
    };
    CPolyline.prototype.getHitBounds = function () {
        // add clicktolerance for hit detection/etc.
        var w = this.clickTolerance();
        var p = new CPoint(w, w);
        return new CBounds(this.bounds.getTopLeft().subtract(p), this.bounds.getBottomRight().add(p));
    };
    CPolyline.prototype.updatePath = function (paintArea, paneXFixed, paneYFixed) {
        this.clipPoints(paintArea);
        this.simplifyPoints();
        this.renderer.updatePoly(this, false /* closed? */, paneXFixed, paneYFixed, paintArea);
    };
    // clip polyline by renderer bounds so that we have less to render for performance
    CPolyline.prototype.clipPoints = function (paintArea) {
        if (this.noClip) {
            this.parts = this.rings;
            return;
        }
        this.parts = new Array();
        var parts = this.parts;
        var bounds = paintArea ? paintArea : this.renderer.getBounds();
        var i;
        var j;
        var k;
        var len;
        var len2;
        var segment;
        var points;
        for (i = 0, k = 0, len = this.rings.length; i < len; i++) {
            points = this.rings[i];
            for (j = 0, len2 = points.length; j < len2 - 1; j++) {
                segment = CLineUtil.clipSegment(points[j], points[j + 1], bounds, j != 0, true);
                if (!segment.length) {
                    continue;
                }
                parts[k] = parts[k] || [];
                parts[k].push(segment[0]);
                // if segment goes out of screen, or it's the last one, it's the end of the line part
                if ((segment[1] !== points[j + 1]) || (j === len2 - 2)) {
                    parts[k].push(segment[1]);
                    k++;
                }
            }
        }
    };
    // simplify each clipped part of the polyline for performance
    CPolyline.prototype.simplifyPoints = function () {
        var parts = this.parts;
        var tolerance = this.smoothFactor;
        for (var i = 0, len = parts.length; i < len; i++) {
            parts[i] = CLineUtil.simplify(parts[i], tolerance);
        }
    };
    CPolyline.prototype.getParts = function () {
        return this.parts;
    };
    CPolyline.prototype.empty = function () {
        return this.pointSet.empty();
    };
    return CPolyline;
}(CPath));
;
/* eslint-disable */
/*
 * CPolyUtil contains utility functions for polygons.
 */
var CPolyUtil;
(function (CPolyUtil) {
    function rectanglesToPointSet(rectangles, unitConverter) {
        /* An Implementation based on O'ROURKE, Joseph. "Uniqueness of orthogonal connect-the-dots."
           Machine Intelligence and Pattern Recognition. Vol. 6. North-Holland, 1988. 97-104.
           http://www.science.smith.edu/~jorourke/Papers/OrthoConnect.pdf
        */
        var eps = 20;
        // Glue rectangles if the space between them is less then eps
        for (var i = 0; i < rectangles.length - 1; i++) {
            for (var j = i + 1; j < rectangles.length; j++) {
                for (var k = 0; k < rectangles[i].length; k++) {
                    for (var l = 0; l < rectangles[j].length; l++) {
                        if (Math.abs(rectangles[i][k].x - rectangles[j][l].x) < eps) {
                            rectangles[j][l].x = rectangles[i][k].x;
                        }
                        if (Math.abs(rectangles[i][k].y - rectangles[j][l].y) < eps) {
                            rectangles[j][l].y = rectangles[i][k].y;
                        }
                    }
                }
            }
        }
        var points = new Map();
        for (i = 0; i < rectangles.length; i++) {
            for (j = 0; j < rectangles[i].length; j++) {
                if (points.has(rectangles[i][j])) {
                    points.delete(rectangles[i][j]);
                }
                else {
                    points.set(rectangles[i][j], rectangles[i][j]);
                }
            }
        }
        function getKeys(points) {
            var keys = [];
            points.forEach(function (_, key) {
                keys.push(key);
            });
            return keys;
        }
        // CPoint comparison function for sorting a list of CPoints w.r.t x-coordinate.
        // When the points have same x-coordinate break tie based on y-coordinates.
        function xThenY(ap, bp) {
            if (ap.x < bp.x || (ap.x === bp.x && ap.y < bp.y)) {
                return -1;
            }
            else if (ap.x === bp.x && ap.y === bp.y) {
                return 0;
            }
            else {
                return 1;
            }
        }
        // CPoint comparison function for sorting a list of CPoints w.r.t y-coordinate.
        // When the points have same y-coordinate break tie based on x-coordinates.
        function yThenX(ap, bp) {
            if (ap.y < bp.y || (ap.y === bp.y && ap.x < bp.x)) {
                return -1;
            }
            else if (ap.x === bp.x && ap.y === bp.y) {
                return 0;
            }
            else {
                return 1;
            }
        }
        var sortX = getKeys(points).sort(xThenY);
        var sortY = getKeys(points).sort(yThenX);
        var edgesH = new Map();
        var edgesV = new Map();
        var len = getKeys(points).length;
        i = 0;
        while (i < len) {
            var currY = points.get(sortY[i]).y;
            while (i < len && points.get(sortY[i]).y === currY) {
                edgesH.set(sortY[i], sortY[i + 1]);
                edgesH.set(sortY[i + 1], sortY[i]);
                i += 2;
            }
        }
        i = 0;
        while (i < len) {
            var currX = points.get(sortX[i]).x;
            while (i < len && points.get(sortX[i]).x === currX) {
                edgesV.set(sortX[i], sortX[i + 1]);
                edgesV.set(sortX[i + 1], sortX[i]);
                i += 2;
            }
        }
        var polygons = new Array();
        var edgesHKeys = getKeys(edgesH);
        while (edgesHKeys.length > 0) {
            var p = [[edgesHKeys[0], 0]];
            while (true) {
                var curr = p[p.length - 1][0];
                var e = p[p.length - 1][1];
                if (e === 0) {
                    var nextVertex = edgesV.get(curr);
                    edgesV.delete(curr);
                    p.push([nextVertex, 1]);
                }
                else {
                    var nextVertex = edgesH.get(curr);
                    edgesH.delete(curr);
                    p.push([nextVertex, 0]);
                }
                if (p[p.length - 1][0].equals(p[0][0]) && p[p.length - 1][1] === p[0][1]) {
                    p.pop();
                    break;
                }
            }
            var polygon = new Array();
            for (i = 0; i < p.length; i++) {
                polygon.push(unitConverter(points.get(p[i][0])));
                edgesH.delete(p[i][0]);
                edgesV.delete(p[i][0]);
            }
            polygon.push(unitConverter(points.get(p[0][0])));
            edgesHKeys = getKeys(edgesH);
            polygons.push(CPointSet.fromPointArray(polygon));
        }
        return CPointSet.fromSetArray(polygons);
    }
    CPolyUtil.rectanglesToPointSet = rectanglesToPointSet;
})(CPolyUtil || (CPolyUtil = {}));
/* eslint-disable */
/// <reference path="CPolyUtil.ts" />
/*
 * CPolygon implements polygon vector layer (closed polyline with a fill inside).
 * This is used to draw overlays like cell-selections (self or views) with multi-selection support.
 */
var CPolygon = /** @class */ (function (_super) {
    __extends(CPolygon, _super);
    function CPolygon(pointSet, options) {
        var _this = _super.call(this, pointSet, options) || this;
        if (options.fill === undefined)
            _this.fill = true;
        return _this;
    }
    CPolygon.prototype.getCenter = function () {
        var i;
        var j;
        var len;
        var p1;
        var p2;
        var f;
        var area;
        var x;
        var y;
        var points = this.rings[0];
        // polygon centroid algorithm; only uses the first ring if there are multiple
        area = x = y = 0;
        for (i = 0, len = points.length, j = len - 1; i < len; j = i++) {
            p1 = points[i];
            p2 = points[j];
            f = p1.y * p2.x - p2.y * p1.x;
            x += (p1.x + p2.x) * f;
            y += (p1.y + p2.y) * f;
            area += f * 3;
        }
        return new CPoint(x / area, y / area);
    };
    CPolygon.prototype.updatePath = function (paintArea, paneXFixed, paneYFixed) {
        this.parts = this.rings;
        // remove last point in the rings/parts if it equals first one
        for (var i = 0, len = this.rings.length; i < len; i++) {
            var ring = this.rings[i];
            var ringlen = ring.length;
            if (ring.length >= 2 && ring[0].equals(ring[ringlen - 1])) {
                ring.pop();
            }
        }
        this.simplifyPoints();
        this.renderer.updatePoly(this, true /* closed? */, paneXFixed, paneYFixed, paintArea);
    };
    CPolygon.prototype.anyRingBoundContains = function (corePxPoint) {
        for (var i = 0; i < this.rings.length; ++i) {
            var ringBound = new CBounds();
            var ring = this.rings[i];
            for (var pointIdx = 0; pointIdx < ring.length; ++pointIdx) {
                ringBound.extend(ring[pointIdx]);
            }
            if (ring.length && ringBound.contains(corePxPoint))
                return true;
        }
        return false;
    };
    return CPolygon;
}(CPolyline));
;
/* eslint-disable */
/*
 * CRectangle extends CPolygon and creates a rectangle of given bounds.
 * This is used for drawing of the self and view cell-cursor on the canvas.
 */
var CRectangle = /** @class */ (function (_super) {
    __extends(CRectangle, _super);
    function CRectangle(bounds, options) {
        return _super.call(this, CRectangle.boundsToPointSet(bounds), options) || this;
    }
    CRectangle.prototype.setBounds = function (bounds) {
        this.setPointSet(CRectangle.boundsToPointSet(bounds));
    };
    CRectangle.boundsToPointSet = function (bounds) {
        return CPointSet.fromPointArray([bounds.getTopLeft(), bounds.getTopRight(), bounds.getBottomRight(), bounds.getBottomLeft(), bounds.getTopLeft()]);
    };
    return CRectangle;
}(CPolygon));
/// <reference path="CPoint.ts" />
/// <reference path="CBounds.ts" />
/// <reference path="CPath.ts" />
/// <reference path="CPolyline.ts" />
/// <reference path="CPolygon.ts" />
/// <reference path="CRectangle.ts" />
/* eslint-disable */
// CanvasOverlay handles CPath rendering and mouse events handling via overlay-section of the main canvas.
// where overlays like cell-cursors, cell-selections, edit-cursors are instances of CPath or its subclasses.
var CanvasOverlay = /** @class */ (function () {
    function CanvasOverlay(mapObject, canvasContext) {
        this.map = mapObject;
        this.ctx = canvasContext;
        this.tsManager = this.map.getTileSectionMgr();
        this.paths = new Map();
        this.updateCanvasBounds();
    }
    CanvasOverlay.prototype.onInitialize = function () {
    };
    CanvasOverlay.prototype.onResize = function () {
        this.onDraw();
    };
    CanvasOverlay.prototype.onDraw = function () {
        // No need to "erase" previous drawings because tiles are draw first via its onDraw.
        this.draw();
    };
    CanvasOverlay.prototype.initPath = function (path) {
        var pathId = path.getId();
        this.paths.set(pathId, path);
        path.setRenderer(this);
        path.updatePathAllPanes();
    };
    CanvasOverlay.prototype.removePath = function (path) {
        // This does not get called via onDraw, so ask tileSection to "erase" by painting over.
        this.tsManager._tilesSection.onDraw();
        path.setDeleted();
        this.paths.delete(path.getId());
        this.draw();
    };
    CanvasOverlay.prototype.updatePath = function (path, oldBounds) {
        this.redraw(path, oldBounds);
    };
    CanvasOverlay.prototype.updateStyle = function (path, oldBounds) {
        this.redraw(path, oldBounds);
    };
    CanvasOverlay.prototype.paintRegion = function (paintArea) {
        this.draw(paintArea);
    };
    CanvasOverlay.prototype.getSplitPanesContext = function () {
        return this.map.getSplitPanesContext();
    };
    CanvasOverlay.prototype.isVisible = function (path) {
        var pathBounds = path.getBounds();
        return this.intersectsVisible(pathBounds);
    };
    CanvasOverlay.prototype.intersectsVisible = function (queryBounds) {
        this.updateCanvasBounds();
        var spc = this.getSplitPanesContext();
        return spc ? spc.intersectsVisible(queryBounds) : this.bounds.intersects(queryBounds);
    };
    CanvasOverlay.prototype.draw = function (paintArea) {
        var orderedPaths = Array();
        this.paths.forEach(function (path) {
            orderedPaths.push(path);
        });
        // Sort in ascending order w.r.t zIndex.
        // TODO: cache this operation away whenever possible.
        orderedPaths.sort(function (a, b) {
            return a.zIndex - b.zIndex;
        });
        var renderer = this;
        orderedPaths.forEach(function (path) {
            if (renderer.isVisible(path))
                path.updatePathAllPanes(paintArea);
        });
    };
    CanvasOverlay.prototype.redraw = function (path, oldBounds) {
        if (!this.isVisible(path) && !this.intersectsVisible(oldBounds))
            return;
        // This does not get called via onDraw(ie, tiles aren't painted), so ask tileSection to "erase" by painting over.
        // Repainting the whole canvas is not necessary but finding the minimum area to paint over
        // is potentially expensive to compute (think of overlapped path objects).
        // TODO: We could repaint the area on the canvas occupied by all the visible path-objects
        // and paint tiles just for that, but need a more general version of _tilesSection.onDraw() and callees.
        this.tsManager.clearTilesSection();
        this.tsManager._tilesSection.onDraw();
        this.draw();
    };
    CanvasOverlay.prototype.updateCanvasBounds = function () {
        var viewBounds = this.map.getPixelBoundsCore();
        this.bounds = new CBounds(new CPoint(viewBounds.min.x, viewBounds.min.y), new CPoint(viewBounds.max.x, viewBounds.max.y));
    };
    CanvasOverlay.prototype.getBounds = function () {
        this.updateCanvasBounds();
        return this.bounds;
    };
    // Applies canvas translation so that polygons/circles can be drawn using core-pixel coordinates.
    CanvasOverlay.prototype.ctStart = function (paneXFixed, paneYFixed, clipArea) {
        this.updateCanvasBounds();
        var docTopLeft = this.bounds.getTopLeft();
        var cOrigin = new CPoint(0, 0);
        this.ctx.save();
        if (!paneXFixed)
            cOrigin.x = -docTopLeft.x;
        if (!paneYFixed)
            cOrigin.y = -docTopLeft.y;
        this.ctx.translate(cOrigin.x, cOrigin.y);
        if (clipArea) {
            this.ctx.beginPath();
            var clipSize = clipArea.getSize();
            this.ctx.rect(clipArea.min.x, clipArea.min.y, clipSize.x, clipSize.y);
            this.ctx.clip();
        }
    };
    // Undo the canvas translation done by ctStart().
    CanvasOverlay.prototype.ctEnd = function () {
        this.ctx.restore();
    };
    CanvasOverlay.prototype.updatePoly = function (path, closed, paneXFixed, paneYFixed, clipArea) {
        if (closed === void 0) { closed = false; }
        var i;
        var j;
        var len2;
        var part;
        var parts = path.getParts();
        var len = parts.length;
        if (!len)
            return;
        this.ctStart(paneXFixed, paneYFixed, clipArea);
        this.ctx.beginPath();
        for (i = 0; i < len; i++) {
            for (j = 0, len2 = parts[i].length; j < len2; j++) {
                part = parts[i][j];
                this.ctx[j ? 'lineTo' : 'moveTo'](part.x, part.y);
            }
            if (closed) {
                this.ctx.closePath();
            }
        }
        this.fillStroke(path);
        this.ctEnd();
    };
    CanvasOverlay.prototype.updateCircle = function (path, paneXFixed, paneYFixed) {
        if (path.empty())
            return;
        this.ctStart(paneXFixed, paneYFixed);
        var point = path.point;
        var r = path.radius;
        var s = (path.radiusY || r) / r;
        if (s !== 1) {
            this.ctx.save();
            this.ctx.scale(1, s);
        }
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y / s, r, 0, Math.PI * 2, false);
        if (s !== 1) {
            this.ctx.restore();
        }
        this.fillStroke(path);
        this.ctEnd();
    };
    CanvasOverlay.prototype.fillStroke = function (path) {
        if (path.fill) {
            this.ctx.globalAlpha = path.fillOpacity;
            this.ctx.fillStyle = path.fillColor || path.color;
            this.ctx.fill(path.fillRule || 'evenodd');
        }
        if (path.stroke && path.weight !== 0) {
            this.ctx.globalAlpha = path.opacity;
            this.ctx.lineWidth = path.weight;
            this.ctx.strokeStyle = path.color;
            this.ctx.lineCap = path.lineCap;
            this.ctx.lineJoin = path.lineJoin;
            this.ctx.stroke();
        }
    };
    CanvasOverlay.prototype.bringToFront = function (path) {
        // TODO: Implement this.
    };
    CanvasOverlay.prototype.bringToBack = function (path) {
        // TODO: Implement this.
    };
    return CanvasOverlay;
}());
;

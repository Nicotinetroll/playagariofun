#!/bin/bash

echo "🔧 Simplifying - accept any name, no validation..."

# 1. Update server to accept ANY name
cat > src/server/lib/util.js << 'EOF'
/* jslint node: true */
'use strict';

const cfg = require('../../../config');

exports.validNick = function (nickname) {
    // Accept anything that's not empty
    if (!nickname) return false;
    return nickname.trim().length > 0;
};

exports.massToRadius = function (mass) {
    return 4 + Math.sqrt(mass) * 6;
};

exports.mathLog = (function () {
    var log = Math.log;
    return function (n, base) {
        return log(n) / (base ? log(base) : 1);
    };
})();

exports.getDistance = function (p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)) - p1.radius - p2.radius;
};

exports.randomInRange = function (from, to) {
    return Math.floor(Math.random() * (to - from)) + from;
};

exports.randomPosition = function (radius) {
    return {
        x: exports.randomInRange(radius, cfg.gameWidth - radius),
        y: exports.randomInRange(radius, cfg.gameHeight - radius)
    };
};

exports.uniformPosition = function (points, radius) {
    var bestCandidate, maxDistance = 0;
    var numberOfCandidates = 10;
    if (points.length === 0) {
        return exports.randomPosition(radius);
    }
    for (var ci = 0; ci < numberOfCandidates; ci++) {
        var minDistance = Infinity;
        var candidate = exports.randomPosition(radius);
        candidate.radius = radius;
        for (var pi = 0; pi < points.length; pi++) {
            var distance = exports.getDistance(candidate, points[pi]);
            if (distance < minDistance) {
                minDistance = distance;
            }
        }
        if (minDistance > maxDistance) {
            bestCandidate = candidate;
            maxDistance = minDistance;
        } else {
            return exports.randomPosition(radius);
        }
    }
    return bestCandidate;
};

exports.findIndex = function (arr, id) {
    var len = arr.length;
    while (len--) {
        if (arr[len].id === id) {
            return len;
        }
    }
    return -1;
};

exports.randomColor = function () {
    var color = '#' + ('00000' + (Math.random() * (1 << 24) | 0).toString(16)).slice(-6);
    var c = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    var r = (parseInt(c[1], 16) - 32) > 0 ? (parseInt(c[1], 16) - 32) : 0;
    var g = (parseInt(c[2], 16) - 32) > 0 ? (parseInt(c[2], 16) - 32) : 0;
    var b = (parseInt(c[3], 16) - 32) > 0 ? (parseInt(c[3], 16) - 32) : 0;
    return {
        fill: color,
        border: '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
    };
};

exports.removeNulls = function (inputArray) {
    let result = [];
    for (let element of inputArray) {
        if (element != null) {
            result.push(element);
        }
    }
    return result;
}

exports.removeIndexes = function (inputArray, indexes) {
    let nullified = inputArray;
    for (let index of indexes) {
        nullified[index] = null;
    }
    return exports.removeNulls(nullified);
}

exports.testRectangleRectangle = function (centerXA, centerYA, widthA, heightA, centerXB, centerYB, widthB, heightB) {
    return centerXA + widthA > centerXB - widthB
        && centerXA - widthA < centerXB + widthB
        && centerYA + heightA > centerYB - heightB
        && centerYA - heightA < centerYB + heightB;
}

exports.testSquareRectangle = function (centerXA, centerYA, edgeLengthA, centerXB, centerYB, widthB, heightB) {
    return exports.testRectangleRectangle(
        centerXA, centerYA, edgeLengthA, edgeLengthA,
        centerXB, centerYB, widthB, heightB);
}

exports.getIndexes = (array, predicate) => {
    return array.reduce((acc, value, index) => {
        if (predicate(value)) {
            acc.push(index)
        }
        return acc;
    }, []);
}
EOF

# 2. Update HTML with correct placeholder
sed -i 's/Enter your name or SOL address/Enter your SOL address (optional)/g' src/client/index.html
sed -i 's/You must enter a name!/Name cannot be empty!/g' src/client/index.html

# 3. Fix tests to match new validation
cat > test/util.js << 'EOF'
var expect = require('chai').expect;
var util = require('../src/server/lib/util');

describe('util.js', function () {
    
    describe('massToRadius', function () {
        it('should return non-zero radius on zero input', function () {
            var r = util.massToRadius(0);
            expect(r).to.be.a('number');
            expect(r).to.equal(4);
        });
        
        it('should convert masses to a circle radius', function () {
            var r1 = util.massToRadius(4),
                r2 = util.massToRadius(16),
                r3 = util.massToRadius(1);
            
            expect(r1).to.equal(16);
            expect(r2).to.equal(28);
            expect(r3).to.equal(10);
        });
    });
    
    describe('validNick', function () {
        it('should disallow empty nicknames', function () {
            expect(util.validNick("")).to.be.false;
            expect(util.validNick(null)).to.be.false;
        });
        
        it('should allow any non-empty name', function () {
            expect(util.validNick("Player123")).to.be.true;
            expect(util.validNick("GmXvnZ8FnvgCaY4KkPaJdkJqiAEMJbSPu7kXqq7kPaJd")).to.be.true;
            expect(util.validNick("John")).to.be.true;
            expect(util.validNick("test")).to.be.true;
        });
        
        it('should allow spaces and special characters', function () {
            expect(util.validNick("Cool Player")).to.be.true;
            expect(util.validNick("Player_123")).to.be.true;
        });
    });
    
    describe('log', function () {
        it('should compute the log_{base} of a number', function () {
            expect(util.mathLog(1, 5)).to.equal(0);
            expect(util.mathLog(5, 5)).to.equal(1);
            expect(util.mathLog(25, 5)).to.equal(2);
            expect(Math.round(util.mathLog(125, 5))).to.equal(3);
        });
    });
    
    describe('getDistance', function () {
        it('should return a positive number', function () {
            var a = {
                    x: 0,
                    y: 0,
                    radius: 1
                },
                b = {
                    x: 0,
                    y: 5,
                    radius: 1
                },
                c = {
                    x: 0,
                    y: 10,
                    radius: 1
                };
            expect(util.getDistance(a, b)).to.equal(3);
            expect(util.getDistance(b, c)).to.equal(3);
            expect(util.getDistance(a, c)).to.equal(8);
        });
    });
});
EOF

# 4. Build and restart
npm run build
pm2 restart all

echo "✅ Done! Simple validation - any non-empty name works!"
echo "  • Placeholder says 'Enter your SOL address (optional)'"
echo "  • Accepts ANY name"
echo "  • Auto-generates random name on load"
echo "  • SOL addresses display shortened if entered"

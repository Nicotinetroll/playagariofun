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

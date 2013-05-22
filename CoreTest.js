module('users.ohshima.frp.CoreTest').requires('lively.TestFramework', 'users.ohshima.frp.FRPCore').toRun(function() {

TestCase.subclass('users.ohshima.frp.FRPTests',

'tests', {
    testTimer: function() {
        var obj = {};
        var evaluator = this.newEvaluator();
        evaluator.installTo(obj);
        var timer = new users.ohshima.frp.FRPCore.EventStream().timerE(1000);
        timer.finalize([]);
        timer.installTo(obj, "timer");
        evaluator.reset();
        evaluator.addStreamsFrom(obj);
        var result = evaluator.sort();
        obj.evaluateAt(500);
        this.assertEquals(timer.currentValue, undefined);
        obj.evaluateAt(1000);
        this.assertEquals(timer.currentValue, 1000);
        obj.evaluateAt(1999);
        this.assertEquals(timer.currentValue, 1000);
        obj.evaluateAt(2001);
        this.assertEquals(timer.currentValue, 2000);
    },
    testSorter: function() {
        var obj = {};
        var evaluator = this.newEvaluator();
        evaluator.installTo(obj);
        var timer = new users.ohshima.frp.FRPCore.EventStream().timerE(1000);
        timer.finalize([]);
        var expr1 = new users.ohshima.frp.FRPCore.EventStream().expr([this.ref("timer")],
function(t) {return 0 - t});
        expr1.finalize([]);
        timer.installTo(obj, "timer");
        expr1.installTo(obj, "expr1");

        evaluator.reset();
        evaluator.addStreamsFrom(obj);
        result = evaluator.sort();

        obj.evaluateAt(3500);
        this.assertEquals(expr1.currentValue, -3000);
        obj.evaluateAt(4000);
        this.assertEquals(expr1.currentValue, -4000);
    },
    testSorter2: function() {
        var obj = {};
        var evaluator = this.newEvaluator();
        evaluator.installTo(obj);

        var timer = new users.ohshima.frp.FRPCore.EventStream().timerE(1000);
        timer.finalize([]);
        timer.installTo(obj, "timer");

        var expr1 = new users.ohshima.frp.FRPCore.EventStream().expr([this.ref("timer")],
function(t) {return 0 - t});
        expr1.finalize([]);
        expr1.installTo(obj, "expr1");

        var expr2 = new users.ohshima.frp.FRPCore.EventStream().expr([this.ref("timer")],
function(t) {return t * 3});
        expr2.finalize([]);
        expr2.installTo(obj, "expr2");

        var expr3 = new users.ohshima.frp.FRPCore.EventStream().expr([this.ref("expr1"), this.ref("expr2")],
function(x, y) {return x + y});
        expr3.finalize([]);
        expr3.installTo(obj, "expr3");

        evaluator.reset();
        evaluator.addStreamsFrom(obj);
        evaluator.sort();

        obj.evaluateAt(3500);
        this.assertEquals(expr3.currentValue, 6000);
        obj.evaluateAt(4000);
        this.assertEquals(expr3.currentValue, 8000);
    },

    testSubExpressions: function() {
        var obj = {};
        var evaluator = this.newEvaluator();
        evaluator.installTo(obj);

        var timer = new users.ohshima.frp.FRPCore.EventStream().timerE(1000);
        timer.finalize([]);
        timer.installTo(obj, "timer");

        var expr1 = new users.ohshima.frp.FRPCore.EventStream().expr([this.ref("_t1")],
function(t) {return 0 - t});
        expr1.installTo(obj, "expr1");

        var expr2 = new users.ohshima.frp.FRPCore.EventStream().expr([this.ref("timer")],
function(t) {return t * 3});
        expr2.finalize([]);
        expr1.addSubExpression("_t1", expr2);
        expr1.finalize([this.ref("timer")]);

        evaluator.reset();
        evaluator.addStreamsFrom(obj);
        evaluator.sort();

        obj.evaluateAt(3500);
        this.assertEquals(expr1.currentValue, -9000);
        obj.evaluateAt(4000);
        this.assertEquals(expr1.currentValue, -12000);
    },
    testConstant: function() {
        var obj = {};
        var evaluator = this.newEvaluator();
        evaluator.installTo(obj);

        var timer = new users.ohshima.frp.FRPCore.EventStream().timerE(1000);
        timer.finalize([]);
        timer.installTo(obj, "timer");

        var expr1 = new users.ohshima.frp.FRPCore.EventStream().expr([100, this.ref("_t1")],
function(c, t) {return c - t});
        expr1.installTo(obj, "expr1");

        var expr2 = new users.ohshima.frp.FRPCore.EventStream().expr([this.ref("timer")],
function(t) {return t * 3});
        expr2.finalize([]);
        expr1.addSubExpression("_t1", expr2);
        expr1.finalize([this.ref("timer")]);

        evaluator.reset();
        evaluator.addStreamsFrom(obj);
        evaluator.sort();

        obj.evaluateAt(3500);
        this.assertEquals(expr1.currentValue, -8900);
        obj.evaluateAt(4000);
        this.assertEquals(expr1.currentValue, -11900);
    },
    testCollect: function() {
        var obj = {};
        var evaluator = this.newEvaluator();
        evaluator.installTo(obj);

        var timer = new users.ohshima.frp.FRPCore.EventStream().timerE(1000);
        timer.finalize([]);
        timer.installTo(obj, "timer");

        var collector = new users.ohshima.frp.FRPCore.EventStream().collector("timer", {now: 1, prev: 0},
            function(newVal, oldVal) {return {now: oldVal.now + oldVal.prev, prev: oldVal.now}});
        collector.installTo(obj, "collector");
        collector.finalize([]);

        evaluator.reset();
        evaluator.addStreamsFrom(obj);
        evaluator.sort();

        debugger;
        obj.evaluateAt(1000);
        this.assertEquals(collector.currentValue.now, 1);
        obj.evaluateAt(2000);
        this.assertEquals(collector.currentValue.now, 2);
        obj.evaluateAt(3000);
        this.assertEquals(collector.currentValue.now, 3);
        obj.evaluateAt(4000);
        this.assertEquals(collector.currentValue.now, 5);
    }

},
'support', {
    newEvaluator: function() {
        return new users.ohshima.frp.FRPCore.Evaluator();
    },
    ref: function(aName) {
        return new users.ohshima.frp.FRPCore.StreamRef(aName);
    }

});
}); // end of module
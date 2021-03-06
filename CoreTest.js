module('users.ohshima.frp.CoreTest').requires('lively.TestFramework', 'users.ohshima.frp.FRPCore').toRun(function() {

TestCase.subclass('users.ohshima.frp.FRPTests',

'tests', {
    testTimer: function() {
        var obj = {};
        var evaluator = this.newEvaluator();
        evaluator.installTo(obj);
        var timer = new users.ohshima.frp.FRPCore.EventStream().timerE(1000).setCode("timerE(1000)").finalize([]);
        timer.installTo(obj, "timer");
        evaluator.reset();
        evaluator.addStreamsFrom(obj);
        var result = evaluator.sort();
        evaluator.evaluateAt(500);
        this.assertEquals(timer.currentValue, undefined);
        evaluator.evaluateAt(1000);
        this.assertEquals(timer.currentValue, 1000);
        evaluator.evaluateAt(1999);
        this.assertEquals(timer.currentValue, 1000);
        evaluator.evaluateAt(2001);
        this.assertEquals(timer.currentValue, 2000);
    },
    testSorter: function() {
        var obj = {};
        var evaluator = this.newEvaluator();
        evaluator.installTo(obj);
        var timer = new users.ohshima.frp.FRPCore.EventStream().timerE(1000).setCode("timerE(1000)").finalize([]);
        var expr1 = new users.ohshima.frp.FRPCore.EventStream().expr([this.ref("timer")],
function(t) {return 0 - t}).setCode("0 - timer").finalize([]);
        timer.installTo(obj, "timer");
        expr1.installTo(obj, "expr1");

        evaluator.reset();
        evaluator.addStreamsFrom(obj);
        result = evaluator.sort();

        evaluator.evaluateAt(3500);
        this.assertEquals(expr1.currentValue, -3000);
        evaluator.evaluateAt(4000);
        this.assertEquals(expr1.currentValue, -4000);
    },
    testSorter2: function() {
        var obj = {};
        var evaluator = this.newEvaluator();
        evaluator.installTo(obj);

        var timer = new users.ohshima.frp.FRPCore.EventStream().timerE(1000).setCode("timerE(1000)").finalize([]);
        timer.installTo(obj, "timer");

        var expr1 = new users.ohshima.frp.FRPCore.EventStream().expr([this.ref("timer")],
function(t) {return 0 - t}).setCode("0 - timer").finalize([]);
        expr1.installTo(obj, "expr1");

        var expr2 = new users.ohshima.frp.FRPCore.EventStream().expr([this.ref("timer")],
function(t) {return t * 3}).setCode("timer * 3").finalize([]);
        expr2.installTo(obj, "expr2");

        var expr3 = new users.ohshima.frp.FRPCore.EventStream().expr([this.ref("expr1"), this.ref("expr2")],
function(x, y) {return x + y}).setCode("expr1 + expr2").finalize([]);
        expr3.installTo(obj, "expr3");

        evaluator.reset();
        evaluator.addStreamsFrom(obj);
        evaluator.sort();

        evaluator.evaluateAt(3500);
        this.assertEquals(expr3.currentValue, 6000);
        evaluator.evaluateAt(4000);
        this.assertEquals(expr3.currentValue, 8000);
    },

    testSubExpressions: function() {
        var obj = {};
        var evaluator = this.newEvaluator();
        evaluator.installTo(obj);

        var timer = new users.ohshima.frp.FRPCore.EventStream().timerE(1000).setCode("timerE(1000)").finalize([]);
        timer.installTo(obj, "timer");

        var expr1 = new users.ohshima.frp.FRPCore.EventStream().expr([this.ref("_t1")],
function(t) {return 0 - t}).setCode("0 - (timer * 3)").finalize([this.ref("timer")]);
        expr1.installTo(obj, "expr1");

        var expr2 = new users.ohshima.frp.FRPCore.EventStream().expr([this.ref("timer")],
function(t) {return t * 3}).finalize([]);
        expr1.addSubExpression("_t1", expr2);

        evaluator.reset();
        evaluator.addStreamsFrom(obj);
        evaluator.sort();

        evaluator.evaluateAt(3500);
        this.assertEquals(expr1.currentValue, -9000);
        evaluator.evaluateAt(4000);
        this.assertEquals(expr1.currentValue, -12000);
    },
    testConstant: function() {
        var obj = {};
        var evaluator = this.newEvaluator();
        evaluator.installTo(obj);

        var timer = new users.ohshima.frp.FRPCore.EventStream().timerE(1000).setCode("timerE(1000)").finalize([]);
        timer.installTo(obj, "timer");

        var expr1 = new users.ohshima.frp.FRPCore.EventStream().expr([100, this.ref("_t1")],
function(c, t) {return c - t}).setCode("100 - (timer * 3)").finalize([this.ref("timer")]);
        expr1.installTo(obj, "expr1");

        var expr2 = new users.ohshima.frp.FRPCore.EventStream().expr([this.ref("timer")],
function(t) {return t * 3}).finalize([]);
        expr1.addSubExpression("_t1", expr2);

        evaluator.reset();
        evaluator.addStreamsFrom(obj);
        evaluator.sort();

        evaluator.evaluateAt(3500);
        this.assertEquals(expr1.currentValue, -8900);
        evaluator.evaluateAt(4000);
        this.assertEquals(expr1.currentValue, -11900);
    },
    testCollect: function() {
        var obj = {};
        var evaluator = this.newEvaluator();
        evaluator.installTo(obj);

        var timer = new users.ohshima.frp.FRPCore.EventStream().timerE(1000).setCode("timerE(1000)").finalize([]);
        timer.installTo(obj, "timer");

        var collector = new users.ohshima.frp.FRPCore.EventStream().collector("timer", {now: 1, prev: 0},
            function(newVal, oldVal) {return {now: oldVal.now + oldVal.prev, prev: oldVal.now}}).setCode("timer.collectE({now: 1, prev: 0}, function(newVal, oldVal) {return {now: oldVal.now + oldVal.prev, prev: oldVal.now}}").finalize([]);
        collector.installTo(obj, "collector");

        evaluator.reset();
        evaluator.addStreamsFrom(obj);
        evaluator.sort();

        evaluator.evaluateAt(1000);
        this.assertEquals(collector.currentValue.now, 1);
        evaluator.evaluateAt(2000);
        this.assertEquals(collector.currentValue.now, 2);
        evaluator.evaluateAt(3000);
        this.assertEquals(collector.currentValue.now, 3);
        evaluator.evaluateAt(4000);
        this.assertEquals(collector.currentValue.now, 5);
    },
    testDuration: function() {
        var obj = {};
        var evaluator = this.newEvaluator();
        evaluator.installTo(obj);

        var timer = new users.ohshima.frp.FRPCore.EventStream().durationE(1000, 10000).setCode("durationE(1000, 10000)").finalize([]);
        timer.installTo(obj, "timer");

        evaluator.reset();
        evaluator.addStreamsFrom(obj);
        evaluator.sort();

        evaluator.evaluateAt(1000);
        this.assertEquals(timer.currentValue, 0);
        evaluator.evaluateAt(2000);
        this.assertEquals(timer.currentValue, 1000);
        evaluator.evaluateAt(9000);
        this.assertEquals(timer.currentValue, 8000);
        evaluator.evaluateAt(10001);
        this.assertEquals(timer.currentValue, 9000);
        this.assertEquals(timer.done, false);
        evaluator.evaluateAt(11000);
        this.assertEquals(timer.currentValue, 10000);
        this.assertEquals(timer.done, true);
        evaluator.evaluateAt(12000);
        this.assertEquals(timer.currentValue, 10000);
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
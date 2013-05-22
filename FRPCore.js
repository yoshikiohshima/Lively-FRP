module('users.ohshima.frp.FRPCore').requires().toRun(function() {

Object.subclass('users.ohshima.frp.FRPCore.StreamRef',
'all', {
    initialize: function($super, ref, last) {
        this.ref = ref;
        this.isSubExpression = ref.match(/^_t/) !== null;
        this.last = last || false;
    }
});

Object.subclass('users.ohshima.frp.FRPCore.EventStream',
'initialization', {
    setUp: function(type, srcs, updater, checker, isContinuous) {
        this.id = this.constructor.nextId++;
        this.type = type;
        this.updater = updater || this.basicUpdater;
        this.isBehavior = false;
        this.sources = srcs;
        this.dependents = srcs.clone();
        this.currentValue = undefined;
        this.lastValue = undefined;
        this.checker = checker || this.basicChecker;
        this.isContinuous = isContinuous || false;
        this.setLastTime(0);
    },

    beContinous: function(val) {
        this.currentValue = val;
        this.isContinous = true;
    },
    
    installTo: function(object, name) {
        if (this.type === "timerE") {
            object.evaluator.timers.push(this);
            //this.timerId = setInterval(function() {
            //      this.owner.evaluator.evaluate();}.bind(this), this.interval);
        }
        object[name] = this;
        this.owner = object;
        if (this.isContinuous) {
            this.setLastTime(-1);
        }
    },

    timerE: function(interval) {
        this.setUp("timerE", [],
            function(space, evaluator) {return this.ceilTime(evaluator.currentTime, this.interval)},
            function(space, time, evaluator) {
                return !this.dormant && this.lastTime + (space.frpGet(this.interval)) <= time},
            false);
        this.interval = interval;
        return this;
    },

    expr: function(arguments, expression, isContinuous) {
        this.setUp("exprE", arguments, null, null, isContinuous);
        this.expression = expression;
        return this;
    }
},
'evaluation', {
    addSubExpression: function(id, stream) {
        if (!this.subExpressions) {
            this.subExpressions = [];
        }
        this.subExpressions.push(this.ref(id));
        this[id] = stream;
    },
    
    finalize: function(collection) {
        if (!this.subExpressions) {
            this.subExpressions = [];
        }
        collection.forEach(function(elem) {
            var hasIt = false;
            this.dependents.forEach(function(e) {
                if (this.isStreamRef(e) && e.ref === elem.ref) {
                    hasIt = true;
                }
            }.bind(this));
            if (!hasIt) {
               this.dependents.push(elem);
            }
        }.bind(this));
        return this;
    },

    evalSubExpression: function(time, space, evaluator) {
        var val = this.updater(space, evaluator);
        if (val !== undefined) {
            this.lastValue = this.currentValue = val;
            this.setLastTime(time);
            return true;
        }
        return false;
    },

    maybeEvalAt: function(time, evaluator) {
        var changed = false;
        this.subExpressions.forEach(function(ref) {
            var elem = this[ref.ref] || this.owner[ref.ref];
            if (elem.checker(this, time, evaluator)) {
                changed = elem.evalSubExpression(time, this, evaluator) || changed;
            }
        }.bind(this));
        if (this.checker(this, time, evaluator)) {
            var val = this.updater(this, evaluator);
            if (val !== undefined) {
                this.lastValue = this.currentValue;
                this.setLastTime(this.type === "timerE" ? val : time);
                this.currentValue = val;
                changed = true;
            }
        }
		if (time > this.lastCheckTime) {
			this.lastCheckTime = time;
		}
        return changed;
    },

    basicChecker: function(space, time, evaluator) {
        var dependents = evaluator.dependents[this.id];
        var result = null;
        var args = evaluator.arguments[this.id];
        for (var i = 0; i < dependents.length; i++) {
            var src = dependents[i];
            if (this.isEventStream(src)) {
                if (src.currentValue === undefined)
                    result = result === null ? false : result;
                if (this.isEarlierThan(src)) {
                    result = result === null ? true: result;
                }
            }
        }
        if (result) {
            var sources = evaluator.sources[this.id];
            for (i = 0; i < sources.length; i++) {
                args[i] = this.isEventStream(sources[i]) ? sources[i].currentValue : sources[i];
            }
        }
        return result === null ? false : result;
    },
    basicUpdater: function(space, evaluator) {
        return this.expression.apply(this, evaluator.arguments[this.id]);
    },

    frpGet: function(ref) {
        if (this.isStreamRef(ref)) {
            var v = this.lookup(ref);
            var last = ref.last;
            if (last && this.isEventStream(v)) {
                return v.lastValue;
            }
            return v.currentValue;
        }
        return ref;
    },
    isEarlierThan: function(other) {
        var otherTime = other.lastTime;
        return otherTime === -1 || otherTime > this.lastCheckTime;
    },
    lookup: function(ref) {
        if (this.isStreamRef(ref)) {
            return this[ref.ref] || this.owner[ref.ref];
        }
        return ref;
    },
    setLastTime: function(aNumber) {
        this.lastTime = aNumber;
        this.lastCheckTime = aNumber;
    },
    ceilTime: function(time, interval) {
        return Math.floor(time / interval) * interval;
    },

    isEventStream: function(v) {
        return v instanceof users.ohshima.frp.FRPCore.EventStream;
    },

    isStreamRef: function(v) {
        return v instanceof users.ohshima.frp.FRPCore.StreamRef;
    },
    ref: function(name, last) {
        return new users.ohshima.frp.FRPCore.StreamRef(name, last);
    }

});

users.ohshima.frp.FRPCore.EventStream.nextId = 0;

Object.subclass('users.ohshima.frp.FRPCore.Evaluator',
'all', {
    initialize: function($super) {
        this.reset();
        this.deletedNode = null;
        this.timers = [];
        return this;
    },
    reset: function() {
        delete this.results;
        this.sources = {};
        this.arguments = {};
        this.dependents = {};
        this.endNodes = {};
        this.wasInvalidated = true;
        this.invalidated = true;
        return this;
        
    },
    addDependents: function(elem, top) {
        var srcs = this.sources[elem.id] = [];
        var deps = this.dependents[elem.id] = [];
        elem.visited = false;
        for (var i = 0; i < elem.dependents.length; i++) {
            var depRef = elem.dependents[i];
            var dep = top.lookup(depRef);
            if (this.isEventStream(dep) && !depRef.isSubExpression) {
                deps.push(dep);
                this.endNodes[dep.id] = this.deletedNode;
            }
        }
        this.arguments[elem.id] = new Array(elem.sources.length);
        for (i = 0; i < elem.sources.length; i++) {
            var ref = elem.sources[i];
            var src = top.lookup(ref);
            srcs.push(src);
        }
    },
    addStreamsFrom: function(object) {
        for (var k in object) {
            var v = object[k];
            if (this.isEventStream(v) && !this.sources[v.id]) {
                if (this.endNodes[v.id] !== this.deletedNode) {
                    this.endNodes[v.id] = v;
                }
                this.addDependents(v, v);
                for (i = 0; i < v.subExpressions.length; i++) {
                    var s = v.lookup(v.subExpressions[i]);
                    this.addDependents(s, v);
                }  
            }
        }
    },
    isEventStream: function(v) {
        return v instanceof users.ohshima.frp.FRPCore.EventStream;
    },
    visit: function(elem, col) {
    // Starting from the "endNodes", recursively visit their sources.  col is used to detect circular dependency.
        if (col.indexOf(elem) >= 0 && !elem.visited) {
            this.results.push(elem);
            return;
        }
        if (!elem.visited) {
            elem.visited = true;
            col.push(elem);
            this.dependents[elem.id].forEach(function(srcElem) {
                this.visit(srcElem, col);
            }.bind(this));
            col.pop();
            this.results.push(elem);
        }
    },
    sort: function() {
        var results = this.results = [];
        for (var k in this.endNodes) {
            var e = this.endNodes[k];
            if (e !== this.deletedNode) {
                this.visit(e, []);
            }
        }
        return results;
    },
    evaluate: function() {
        var now = Date.now();
        return this.evaluateAt(now - this.object.startTime);
    },
    evaluateAt: function(time) {
        var changed = false;
        this.currentTime = time;
        var s = this.result;
        for (var i = 0; i < this.results.length; i++) {
            changed = this.results[i].maybeEvalAt(time, this) || changed;
        }
        return changed;
    },
    sortAndEvaluateAt: function(time) {
        this.sort();
        this.wasInvalidated = true;
        this.evaluateAt(time);
    },
    installTo: function(object) {
        object.startTime = Date.now();
        object.evaluator = this;
        this.object = object;
        object.evaluate = function() {
            if (!this.evaluator.results) {
                this.evaluator.addSortedStreamsFrom(this);
                this.evaluator.sort();
            }
            this.evaluator.evaluateAt(Date.now() - this.startTime);
        }.bind(object);
        object.evaluateAt = function(time) {
            if (!this.evaluator.results) {
                this.evaluator.addSortedStreamsFrom(this);
                this.evaluator.sort();
            }
            this.evaluator.evaluateAt(time);
        }.bind(object);

    },
    addTimer: function(timer) {
        this.timers.push(timer);
        this.constructors.allTimers.push(timer);
        timer.timerId = setInterval(function() {this.evaluate();}.bind(this), timer.interval);

    },
    clearAllTimer: function() {
        for (var i = 1; i < 99999; i++) {
            window.clearInterval(i);
        }
    }
});

users.ohshima.frp.FRPCore.Evaluator.allTimers = [];

}); // end of module

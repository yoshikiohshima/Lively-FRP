module('users.ohshima.frp.FRPCore').requires().toRun(function() {

Object.subclass('users.ohshima.frp.FRPCore.StreamRef',
// StreamRef represents the loose-coupled variable name.
// It is used for the key to look up the corresponding stream
// in the owner object.
'all', {
    initialize: function($super, ref, last) {
        this.ref = ref;
        this.isSubExpression = ref.match(/^_t/) !== null;
        this.last = last || false;
    }
});

Object.subclass('users.ohshima.frp.FRPCore.EventStream',
//EventStream represents a node in the data flow graph.
'initialization', {
    setUp: function(type, srcs, updater, checker, isContinuous) {
    // type is either a pre-defined combinator ("timerE", "collectE", etc) or
    // generic "exprE", that is used for everything else.
    //
    // sources is a list of (StreamsRef | value) that is used to compute 
    // the new value of the stream.  a value is allowed when a sub term is not
    // a stream, but a value.
    // 
    // depenencies is a list of (StreamRef) that is used to determine whether
    // this stream should be updated.  Usually, dependencies are a super-set of
    // sources.
    //
    // currentValue is the currentValue of the stream.  Last Value is the 
    // last value.
    //
    // checker and updater are functions to determine the stream should be updated,
    // and compute the actual new value.
        this.id = this.constructor.nextId++;
        this.type = type;
        this.updater = updater || this.basicUpdater;
        this.sources = srcs;
        this.dependencies = srcs.clone();
        this.currentValue = undefined;
        this.lastValue = undefined;
        this.checker = checker || this.basicChecker;
        this.isContinuous = isContinuous || false;
        this.setLastTime(0);
    },
    setCode: function(aString) {
        this.code = aString;
        return this;
    },

    beContinuous: function(val) {
        this.currentValue = val;
        this.isContinuous = true;
    },
    
    installTo: function(object, name) {
    // Install this into the owner object under the name
    // When the stream is continuous, the potential dependents will be evaluated
    // upon next available step.
        object.__evaluator.installStream(this);
        object[name] = this;
        this.owner = object;
        if (this.isContinuous) {
            this.setLastTime(-1);
        }
    },

    uninstall: function() {
        this.owner.__evaluator.uninstallStream(this);
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

    durationE: function(interval, duration) {
        this.setUp("durationE", [],
            function(space, evaluator) {
                var dur = space.frpGet(this.duration);
                if (this.start === null) {
                    this.start = this.ceilTime(evaluator.currentTime, this.interval);
                }
                var val = this.ceilTime(evaluator.currentTime, this.interval) - this.start;
                if (val >= dur) {
                    this.done = true;
                    evaluator.removeTimer(this);
                    val = dur;
                }
                return val;
            },
            function(space, time, evaluator) {
                return this.start === null || !this.done ||
                    ((this.lastTime + space.frpGet(this.interval) <= time) &&
                        (this.start + space.frpGet(this.duration) >= time));
            },
            false);
        this.interval = interval;
        this.duration = duration;
        this.done = false;
        this.start = null;
        return this;
    },

    collector: function(event, initialValue, func) {
        this.setUp("collectE", [this.ref(event)],
            function(space, evaluator) {
                return (space.frpGet(this.func))
                    (space.frpGet(this.event),
                    (this.currentValue === undefined ? space.frpGet(this.initialValue) : this.currentValue))},
            null,
            true);
        this.initialValue = initialValue;
        this.func = func;
        this.event = this.ref(event);
        return this;        
    },

    expr: function(arguments, expression, isContinuous) {
        this.setUp("exprE", arguments, null, null, isContinuous);
        this.expression = expression;
        return this;
    },
    value: function(initialValue) {
        this.setUp("value", [], null, null);
        if (initialValue === undefined) {
            this.beContinuous(initialValue);
        }
        return this;
    }

},
'evaluation', {
    addSubExpression: function(id, stream) {
    // Add a sub stream for a complex stream.  A sub stream is an internal stream
    // that represents a sub expression of a stream.  For example, if the stream
    // definition is "a + b * c", "b * c" is a sub-stream, and the top level stream
    // is "+" with "a" and the sub-stream.
        if (!this.subExpressions) {
            this.subExpressions = [];
        }
        this.subExpressions.push(this.ref(id));
        this[id] = stream;
    },
    
    finalize: function(collection) {
    // Make sure that subExpressions field at least has a value.
    // collection is a collection of additional dependencies.
        if (!this.subExpressions) {
            this.subExpressions = [];
        }
        collection.forEach(function(elem) {
            var hasIt = false;
            this.dependencies.forEach(function(e) {
                if (this.isStreamRef(e) && e.ref === elem.ref) {
                    hasIt = true;
                }
            }.bind(this));
            if (!hasIt) {
               this.dependencies.push(elem);
            }
        }.bind(this));
        return this;
    },

    evalSubExpression: function(time, space, evaluator) {
    // Evaluate this as a sub expression.
    // When evaluating a sub expression, there is no need to keep the last value
        var val = this.updater(space, evaluator);
        if (val !== undefined) {
            this.lastValue = this.currentValue = val;
            this.setLastTime(this.type === "timerE" ? val : time);
            return true;
        }
        return false;
    },

    maybeEvalAt: function(time, evaluator) {
    // Evaluate a stream.  First attempt to evaluate the sub expressions in order
    //  and then evaluate the top level stream (this) if necessary.
        var changed = false;
        for (var i = 0; i < this.subExpressions.length; i++) {
            var ref = this.subExpressions[i];
            var elem = this[ref.ref] || this.owner[ref.ref];
            if (elem.checker(this, time, evaluator)) {
                changed = elem.evalSubExpression(time, this, evaluator) || changed;
            }
        }
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
    // The default implementation of checker.  It checks all dependencies of
    // this stream.  If it should be evaluated, it fetches the values to be used.
        var dependencies = evaluator.dependencies[this.id];
        var result = null;
        var args = evaluator.arguments[this.id];
        for (var i = 0; i < dependencies.length; i++) {
            var src = dependencies[i];
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
    // The updater for the expr type
        return this.expression.apply(this, evaluator.arguments[this.id]);
    },
    
    frpSet: function(val) {
        this.currentValue = val;
        this.setLastTime(this.owner.__evaluator.currentTime+1);
        this.owner.__evaluator.evaluate();
        return val;
    },

    frpGet: function(ref) {
    // Fetches the value from ref
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
        this.syncWithRealTime = false;
        this.clearTimers();
        return this;
    },
    reset: function() {
        delete this.results;
        this.sources = {};
        this.arguments = {};
        this.dependencies = {};
        this.endNodes = {};
        return this;
        
    },
    addDependencies: function(elem, top) {
        var srcs = this.sources[elem.id] = [];
        var deps = this.dependencies[elem.id] = [];
        elem.visited = false;
        for (var i = 0; i < elem.dependencies.length; i++) {
            var depRef = elem.dependencies[i];
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
    // An entry point to gather all streams in object.  For each top-level
    // stream, its sub expressions are visited. 
        for (var k in object) {
            var v = object[k];
            if (this.isEventStream(v) && !this.sources[v.id]) {
                if (this.endNodes[v.id] !== this.deletedNode) {
                    this.endNodes[v.id] = v;
                }
                this.addDependencies(v, v);
                for (i = 0; i < v.subExpressions.length; i++) {
                    var s = v.lookup(v.subExpressions[i]);
                    this.addDependencies(s, v);
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
            for (var i = 0; i < this.dependencies[elem.id].length; i++) {
                var srcElem = this.dependencies[elem.id][i];
                this.visit(srcElem, col);
            }
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
        if (!this.results) {
            this.addStreamsFrom(this.object);
            this.sort();
        }
        return this.evaluateAt(now - this.object.__startTime);
    },
    evaluateAt: function(time) {
        var changed = false;
        this.currentTime = time;
        for (var i = 0; i < this.results.length; i++) {
            changed = this.results[i].maybeEvalAt(time, this) || changed;
        }
        return changed;
    },
    resetSortedResults: function() {
        this.results = null;
    },
    installTo: function(object) {
        object.__startTime = Date.now();
        object.__evaluator = this;
        this.object = object;
    },

    installStream: function(strm) {
    // For a timer, it starts the timer.
    // The evaluator is reset as the network may change.
        if (strm.type === "timerE" || strm.type === "durationE") {
            this.addTimer(strm);
        }
        this.resetSortedResults();
    },

    uninstallStream: function(strm) {
        if (strm.type === "timerE" || strm.type === "durationE") {
            this.removeTimer(strm);
        }
        this.resetSortedResults();
   },

    addTimer: function(timer) {
        if (this.syncWithRealTime) {
            this.timers.push(timer);
            this.constructor.allTimers.push(timer);
            timer.timerId = setInterval(function() {this.evaluate();}.bind(this), timer.interval);
        }
    },

    removeTimer: function(strm) {
        window.clearInterval(strm.timerId);
        this.timers.remove(strm);
        this.constructor.allTimers.remove(strm);
    },

    clearTimers: function() {
        if (this.timers) {
            this.timers.forEach(function(strm) {
                window.clearInterval(strm.timerId);
                this.constructor.allTimers.remove(strm);
            }.bind(this));
        }
        this.timers = [];
    },
    clearAllTimers: function() {
        for (var i = 1; i < 99999; i++) {
            window.clearInterval(i);
        }
    }
});

users.ohshima.frp.FRPCore.Evaluator.allTimers = [];

}); // end of module

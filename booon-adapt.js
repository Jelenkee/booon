"use strict";
//@ts-check
(function () {
    const O = Object;
    O.k = O.keys;
    const A = Array;
    class Adapt {
        constructor(opts) {
            // el, data, watch, methods, options, init
            if (!opts.options) { opts.options = {}; }
            const that = this;
            that._options = O.freeze(opts);
            ["methods", "watch", "el", "options", "validators"].forEach(name => O.freeze(opts[name] || {}));
            that._changedAttrs = new Set();
            that._data = enrichData(that, opts.data || {}, opts.methods || {});

            booon(() => {
                that._el = opts.el instanceof Element ? opts.el : document.querySelector(opts.el);
                if (!that._el || that._el == document.body || that._el == document.body.parentElement) {
                    throw new Error("no valid el");
                }
                scanDOM(that);
                setDirty(that);
                if (opts.init) {
                    init.apply(that);
                }
            });
        }
    }

    function setDirty(adapt) {
        if (!adapt._timeout) {
            adapt._timeout = setTimeout(() => {
                applyDOMChanges(adapt);
                adapt._timeout = null;
            }, 20);
        }
    }

    function enrichData(adapt, data, methods) {
        adapt._usedAttributes = {};
        let collect;
        //O.seal(data);
        O.k(data).forEach(key => {
            if (key.startsWith("_")) {
                throw new Error("no '_'-keys");
            }
            const value = data[key];
            adapt._cachedData = {};
            if (typeof value == "function") {
                adapt._usedAttributes[key] = null;
                O.defineProperty(adapt, key, {
                    get: function () {
                        return adapt._cachedData[key];
                    }
                });
                return;
            }
            const callback = () => {
                callWatcher(adapt, key, value, value);
                setDirty(adapt);
            };
            if (A.isArray(value)) {
                enrichArray(value, callback);
            } else if (typeof value == "object") {
                enrichObject(value, callback);
            }
            O.defineProperty(adapt, key, {
                set: function (x) {
                    const old = data[key];
                    const validationResult = callValidator(adapt, key, x);
                    if (validationResult !== undefined) {
                        if (validationResult !== x) {
                            setDirty(adapt);
                        }
                        x = validationResult;
                    }
                    if (A.isArray(x)) {
                        enrichArray(key, x, callback);
                    } else if (typeof x == "object") {
                        enrichObject(key, x, callback);
                    }
                    data[key] = x;
                    if (old !== x) {
                        callWatcher(adapt, key, old, x);
                        setDirty(adapt);
                    }
                },
                get: function () {
                    if (collect) {
                        collect.add(key);
                    }
                    return data[key];
                }
            });
        });
        O.k(methods).forEach(key => {
            if (key.startsWith("_")) {
                throw new Error("no '_'-keys");
            }
            O.defineProperty(adapt, key, {
                get: function () {
                    return methods[key];
                }
            });
        });
        O.k(adapt._usedAttributes).forEach(key => {
            collect = new Set();
            data[key].apply(adapt);
            adapt._usedAttributes[key] = A.from(collect);
            collect.forEach(e => adapt._changedAttrs.add(e));
        });
        collect = null;
        O.freeze(adapt._usedAttributes);

        return data;
    }

    function enrichObject(object, callback) {
        O.k(object).forEach(k => {
            if (!O._data) {
                O.defineProperty(object, "_data", { writable: true });
                O._data = {};
            }
            if (O._data.hasOwnProperty(k)) {
                return;
            }
            if (A.isArray(object[k])) {
                enrichArray(object[k], callback);
            } else if (typeof object[k] == "object") {
                enrichObject(object[k], callback);
            }
            O._data[k] = object[k];
            O.defineProperty(object, k, {
                set: function (x) {
                    /*if (A.isArray(x)) {
                        enrichArray(key, x)
                    } else if (typeof x == "object") {
                        enrichObject(key, x)
                    }*/
                    O._data[k] = x;
                    callback();
                },
                get: function () {
                    return O._data[k];
                }
            });
        });
    }

    function enrichArray(array, callback) {
        ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"]
            .forEach(method => {
                const old = array[method];
                if (old.custom) {
                    return;
                }
                array[method] = (...args) => {
                    old.apply(array, args);
                    enrich();
                    callback();
                };
                array[method].custom = true;
            });
        function enrich() {
            array.forEach(e => {
                if (A.isArray(e)) {
                    enrichArray(e, callback);
                } else if (typeof e == "object") {
                    enrichObject(e, callback);
                }
            });
        }
        enrich();
    }

    function callWatcher(adapt, key, oldValue, newValue) {
        const opts = adapt._options;
        const watch = opts.watch;
        if (watch) {
            if (watch[key]) {
                watch[key].apply(adapt, [newValue, oldValue]);
            }
        }
        adapt._changedAttrs.add(key);
    }
    function callValidator(adapt, key, newValue) {
        const opts = adapt._options;
        const validators = opts.validators;
        if (validators) {
            if (validators[key]) {
                return validators[key].apply(adapt, [newValue]);
            }
        }
    }

    function applyDOMChanges(adapt) {
        O.entries(adapt._usedAttributes).forEach(e => {
            if (e[1].some(a => adapt._changedAttrs.has(a))) {
                adapt._cachedData[e[0]] = adapt._data[e[0]].apply(adapt);
            }
        });
        adapt._changedAttrs.clear();
        adapt._updateFunctions.forEach(uf => {
            const node = uf.node;
            const dir = uf.dir;
            const attribute=uf.attribute;
            if (node.nodeType == 1) {
                const calculatedValue = uf.func.apply(adapt);
                const calculatedString = toString(calculatedValue);
                if (dir == "bind") {
                    if (typeof calculatedValue != "object") {
                        if (node.getAttribute(attribute) !== calculatedValue) {
                            node.setAttribute(attribute, calculatedValue);
                        }
                    } else if (attribute == "class") {
                        node.setAttribute(attribute, "");
                        if (A.isArray(calculatedValue)) {
                            calculatedValue.forEach(e => { if (e) node.classList.add(e); });
                        } else {
                            for (const key in calculatedValue) {
                                if (calculatedValue[key]) {
                                    node.classList.add(key);
                                }
                            }
                        }
                        if (uf.initClass) {
                            uf.initClass.forEach(c => node.classList.add(c));
                        }
                    }
                } else if (dir == "model") {
                    if (node.tagName.toLowerCase() == "input" && node.type == "checkbox") {
                        if (node.checked !== calculatedValue) {
                            node.checked = calculatedValue;
                        }
                    } else if (node.tagName.toLowerCase() == "input" && node.type == "radio") {
                        if (node.checked !== (node.value == calculatedString)) {
                            node.checked = node.value == calculatedString;
                        }
                    } else {
                        if (node.value !== calculatedString) {
                            node.value = calculatedString;
                        }
                    }
                } else if (dir == "text") {
                    node.innerText = calculatedString;
                } else if (dir == "html") {
                    node.innerHTML = calculatedString;
                } else if (dir == "visible") {
                    node.style["display"] = calculatedValue ? "" : "none";
                } else if (dir == "style") {
                    node.setAttribute("style", "");
                    for (const key in calculatedValue) {
                        node.style[key] = calculatedValue[key];
                    }
                    if (uf.initStyle) {
                        node.setAttribute("style", uf.initStyle + node.getAttribute("style"));
                    }
                }
            } else if (node.nodeType == 3) {
                let result = uf.expression;
                O.entries(uf.areas).forEach(e => {
                    result = result.split(e[0]).join(toString(e[1].apply(adapt)));
                });
                node.textContent = result;
            }
        });
    }

    function scanDOM(adapt) {
        const reactNodes = [];
        fillNodes(adapt._el);
        function fillNodes(node) {
            if (isReactNode(node)) {
                reactNodes.push(node);
            }
            node.childNodes.forEach(fillNodes);
        }
        //console.log(reactNodes);

        adapt._updateFunctions = reactNodes
            .map(node => {
                const result = {};
                result.node = node;
                if (node.nodeType == 1) {
                    const attrNames = node.getAttributeNames();
                    attrNames.forEach(name => {
                        if (name.startsWith("b-bind:") || name.startsWith(":")) {
                            result.dir = "bind";
                            result.attribute = name.slice(name.indexOf(":") + 1);
                            if (result.attribute == "class") {
                                result.initClass = A.from(node.classList);
                            }
                            addFunc(name);
                        } else if (name == "b-model") {
                            result.dir = "model";
                            const key = node.getAttribute(name).trim();
                            node.addEventListener("input", function (e) {
                                if (node.tagName.toLowerCase() == "input" && node.type == "checkbox") {
                                    adapt[key] = this.checked;
                                } else {
                                    adapt[key] = this.value;
                                }
                            });
                            addFunc(name);
                        } else if (name == "b-text") {
                            result.dir = "text";
                            addFunc(name);
                        } else if (name == "b-html") {
                            result.dir = "html";
                            addFunc(name);
                        } else if (name == "b-visible") {
                            result.dir = "visible";
                            addFunc(name);
                        } else if (name == "b-style") {
                            result.dir = "style";
                            const style = node.getAttribute("style")
                            if (style) {
                                result.initStyle = style;
                                if (!result.initStyle.endsWith(";")) {
                                    result.initStyle += ";";
                                }
                            }
                            addFunc(name);
                        } else if (name.startsWith("b-on:") || name.startsWith("@")) {
                            const event = name.slice(Math.max(name.indexOf(":"), name.indexOf("@")) + 1);
                            const func = getFunction(adapt, node.getAttribute(name), true);
                            node.addEventListener(event, function (e) {
                                adapt._event = e;
                                func.apply(adapt);
                                delete adapt._event;
                            });
                            node.removeAttribute(name);
                            result.func = () => { };
                        }
                    });
                    function addFunc(name) {
                        const expression = node.getAttribute(name);
                        result.func = getFunction(adapt, expression);
                        node.removeAttribute(name);
                    }
                } else {
                    result.expression = node.textContent;
                    result.areas = {};
                    const start = adapt._options.options.startTag || "{{";
                    const end = adapt._options.options.endTag || "}}";

                    const startInds = getIndicesOf(start, node.textContent);
                    const endInds = getIndicesOf(end, node.textContent);
                    for (let i = 0; i < endInds.length; i++) {
                        const key = node.textContent.substring(startInds[i], endInds[i] + end.length);
                        const val = key.slice(start.length, key.length - end.length);
                        result.areas[key] = getFunction(adapt, val);
                    }
                }
                return result;
            });

        function getModifiers(attr) {
            const res = [];
            let index;
            while ((index = attr.lastIndexOf(".")) !== -1) {
                res.push(attr.slice(index + 1));
                attr = attr.slice(0, index);
            }
            return res.reverse();
        }

        //console.log(adapt._updateFunctions);

        function isReactNode(node) {
            // element node
            if ((node.nodeType == 1)) {
                const attrNames = node.getAttributeNames();
                for (const name of attrNames) {
                    if (dirs.includes(name) && node.getAttribute(name)) {
                        return true;
                    }
                    if (dirsStarts.some(start => name.startsWith(start))) {
                        return true;
                    }
                }
            } else if (node.nodeType == 3) {
                // text node
                const start = adapt._options.options.startTag || "{{";
                const end = adapt._options.options.endTag || "}}";

                const startInds = getIndicesOf(start, node.textContent);
                const endInds = getIndicesOf(end, node.textContent);
                if (startInds.length && startInds.length == endInds.length) {
                    for (let i = 0; i < startInds.length; i++) {
                        if (startInds[i] + start.length >= endInds[i]) {
                            return false;
                        }
                    }
                    return true;
                }
            }
        }
    }
    const dirs = ["b-model", "b-text", "b-html", "b-visible", "b-style"];
    const dirsStarts = ["b-on:", "@", "b-bind:", ":"];
    function getIndicesOf(searchStr, str) {
        const searchStrLen = searchStr.length;
        if (searchStrLen == 0) {
            return [];
        }
        let startIndex = 0, index, indices = [];
        while ((index = str.indexOf(searchStr, startIndex)) > -1) {
            indices.push(index);
            startIndex = index + searchStrLen;
        }
        return indices;
    }

    function getFunction(adapt, expression, isEvent) {
        expression = expression.trim();
        const dataKeys = O.k(adapt._options.data || {});

        const pref = k => "let " + k + "=this." + k + ";";
        let funcPrefix = "";
        dataKeys.forEach(k => {
            if (expression.includes(k)) {
                funcPrefix += pref(k);
            }
        });
        O.k(adapt._options.methods || {}).forEach(k => {
            if (expression.includes(k)) {
                funcPrefix += pref(k);
            }
        });

        let funcSuffix = ";";
        dataKeys.forEach(k => {
            if (expression.includes(k)) {
                funcSuffix += "if(" + k + "!==this." + k + ")this." + k + "=" + k + ";";
            }
        });
        let funcBody = funcPrefix + (isEvent ? "" : "return ");
        if (isEvent) {
            funcBody = "const $event=this._event;" + funcBody;
        }
        const isFunc = Boolean((adapt._options.methods || {})[expression]) ||
            (expression.endsWith(")") && !expression.startsWith("(") && (expression.match(/\)/g) || "").length == 1 && (expression.match(/\(/g) || "").length == 1);
        if (isFunc) {
            if (!expression.endsWith(")")) {
                funcBody += expression + ".apply(this" + (isEvent ? ",[$event]" : "") + ")";
            } else {
                const paraIndex = expression.indexOf("(");
                const funcName = expression.slice(0, paraIndex);
                funcBody += funcName + ".apply(this,[" + expression.slice(paraIndex + 1, expression.length - 1) + "])";
            }
        } else {
            funcBody += expression;
        }
        if (isEvent) {
            funcBody += funcSuffix;
        }
        //console.log(funcBody);
        return new Function(funcBody);
    }

    function toString(val) {
        return typeof val == "object" ? JSON.stringify(val) : String(val);
    }

    booon.adapt = function (options) {
        return new Adapt(options);
    };
})();

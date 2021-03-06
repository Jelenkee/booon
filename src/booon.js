"use strict";
window.booon = (function () {
    if (window.booon) {
        throw new Error("window.booon is already defined.");
    }
    // ALIAS //
    class Booon {
        constructor(elements) {
            if (!Array.isArray(elements))
                throw new Error("no array");
            this.es = Array.from(elements);
            for (let i = 0; i < this.es.length; i++) {
                this[i] = this.es[i];
            }
        }
        each(func) {
            this.es.forEach(element => func(element));
            return this;
        }
        get length() {
            return this.es.length;
        }
        get all() {
            return this.es.slice();
        }
        get last() {
            return this.es[this.length - 1];
        }
        mapToArray(mapper) {
            return this.es.map(e => mapper(e));
        }
        // ---class---
        addClass(clazz) {
            return this.each(element => element.classList.add(...toArray(clazz)));
        }
        removeClass(clazz) {
            return this.each(element => element.classList.remove(...toArray(clazz)));
        }
        toggleClass(clazz) {
            return this.each(element => toArray(clazz).forEach(c => element.classList.toggle(c)));
        }
        hasClass(clazz) {
            return this.es.some(element => element.classList.contains(clazz));
        }
        // ---transform---
        parent() {
            return booon(distinct(this.es.map(element => element.parentElement)));
        }
        children() {
            return booon(distinct(this.es
                .flatMap(element => Array.from(element.children))));
        }
        siblings(inclusive) {
            if (inclusive) {
                return booon(distinct(this.es
                    .map(element => element.parentElement)
                    .filter(element => element)
                    .flatMap(element => Array.from(element.children))));
            } else {
                function s(elem) {
                    var siblings = [];
                    var sibling = elem.parentNode.firstChild;
                    while (sibling) {
                        if (sibling.nodeType === 1 && sibling !== elem) {
                            siblings.push(sibling);
                        }
                        sibling = sibling.nextSibling;
                    }
                    return siblings;
                }
                return booon(distinct(this.es
                    .flatMap(element => s(element))
                ));
            }
        }
        find(selector) {
            return booon(distinct(this.es
                .flatMap(element => Array.from(element.querySelectorAll(selector)))));
        }
        filter(predicate) {
            return booon(this.es.filter(e => {
                if (typeof predicate == "string") {
                    return e.matches(predicate);
                } else if (typeof predicate == "function") {
                    return predicate(e);
                }
            }));
        }
        limit(num) {
            return booon(this.es.slice(0, num));
        }
        map(mapper) {
            return booon(distinct(this.mapToArray(mapper)));
        }
        merge(value) {
            const newBooon = booon(value);
            const newElements = newBooon.es;
            this.each(element => { if (!newElements.includes(element)) newElements.push(element); });
            return booon(newElements);
        }
        // ---event---
        on(type, listener, capture) {
            return this.each(element => element.addEventListener(type, listener, capture));
        }
        once(type, listener, capture) {
            let options;
            if (typeof capture == "object") {
                options = capture;
                options.once = true;
            } else if (typeof capture == "boolean") {
                options = { capture: capture, once: true };
            } else {
                options = { once: true };
            }
            this.on(type, listener, options);
        }
        click(listener, options) {
            return this.on("click", listener, options);
        }
        hover(enterListener, leaveListener, capture) {
            if (enterListener) {
                this.on("mouseenter", enterListener, capture);
            }
            if (leaveListener) {
                this.on("mouseleave", leaveListener, capture);
            }
            return this;
        }
        // ---manipulation---
        show() {
            return this.css("display", "");
        }
        hide() {
            return this.css("display", "none");
        }
        toggle(visible) {
            const show = visible !== undefined ? Boolean(visible) : this.css("display") == "none";
            if (show) {
                this.show();
            } else {
                this.hide();
            }
            return this;
        }
        css(property, value) {
            if (value === undefined) {
                return first(this, element => element.style[property]);
            } else {
                return this.each(element => element.style[property] = value);
            }
        }
        html(value) {
            return this.prop("innerHTML", value);
        }
        text(value) {
            return this.prop("innerText", value);
        }
        attr(attribute, value) {
            if (value === undefined) {
                return first(this, element => element.getAttribute(attribute));
            } else {
                return this.each(element => value == null ? element.removeAttribute(attribute) : element.setAttribute(attribute, value));
            }
        }
        prop(property, value) {
            if (value === undefined) {
                return first(this, element => element[property]);
            } else {
                return this.each(element => element[property] = value);
            }
        }
        val(value) {
            return this.prop("value", value);
        }
        remove() {
            this.each(element => element.remove());
        }
        data(key, value) {
            if (value === undefined) {
                return first(this, element => element.dataset[key]);
            } else {
                return this.each(element => {
                    if (value == null) {
                        delete element.dataset[key];
                    } else {
                        element.dataset[key] = typeof value == "object" ? JSON.stringify(value) : value;
                    }
                });
            }
        }
    }

    const first = (booon, func) => {
        let element = booon[0];
        if (element) {
            return func(element);
        }
    };

    const distinct = (elements) => {
        return [...new Set(elements)];
    };

    const validNode = (node) => {
        return node && (node.nodeType == Node.ELEMENT_NODE || node.nodeType == Node.DOCUMENT_NODE);
    };

    const toArray = (value) => {
        return Array.isArray(value) ? value : [value];
    };

    const booon = (value, ...args) => {
        if (!value) return new Booon([]);
        let valueType = typeof value;
        if (value instanceof Booon) {
            return value;
        } else if (value instanceof NodeList) {
            return new Booon(Array.from(value));
        } else if (Array.isArray(value)) {
            return new Booon(value.filter(validNode));
        } else if (valueType == "function") {
            if (document.readyState == "complete") {
                value(...args);
            } else {
                document.addEventListener("DOMContentLoaded", () => value(...args));
            }
        } else if (validNode(value)) {
            return new Booon([value]);
        } else if (valueType == "string") {
            return booon((booon(args[0])[0] || document).querySelectorAll(value));
        } else {
            return new Booon([]);
        }
    };
    return booon;
})();

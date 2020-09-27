const tap = require("tap");
const test = tap.test;
const { getDom, getBooon, getAdapt } = require("./dom");

const booon = getBooon(getDom());
getAdapt(booon);
test("bind", t => {
    t.plan(3);
    setTimeout(() => {
        const sNode = booon("#main>.bind>.string")[0];
        t.equal(sNode.getAttribute("tank"),"green");
        const ssNode = booon("#main>.bind>.string-static")[0];
        t.equal(ssNode.getAttribute("tank"),"z");
        const wrongNode = booon("#main>.bind>.wrong")[0];
        t.equal(wrongNode.getAttribute("tank"),null);
    }, 300);
});

test("class", t => {
    t.plan(8);
    setTimeout(() => {
        const coNode = booon("#main>.bind>.c-object")[0];
        t.ok(coNode.classList.contains("foo"));
        t.notOk(coNode.classList.contains("bar"));
        const csNode = booon("#main>.bind>.c-string")[0];
        t.ok(csNode.classList.contains("brad"));
        t.ok(csNode.classList.contains("pitt"));
        t.ok(csNode.classList.contains("c-string"));
        const caNode = booon("#main>.bind>.c-array")[0];
        t.ok(caNode.classList.contains("c-array"));
        t.ok(caNode.classList.contains("blue"));
        t.ok(caNode.classList.contains("green"));
    }, 300);
});
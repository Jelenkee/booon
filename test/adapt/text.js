const tap = require("tap");
const test = tap.test;
const { getDom, getBooon, getAdapt } = require("./dom");

const dom = getDom();
const booon = getBooon(dom);
const adapt = getAdapt(booon);

test("text", t => {
    t.plan(6);
    setTimeout(() => {
        const tNode = booon("#main>.text>.t")[0];
        t.equal(tNode.innerHTML, adapt.html);
        const t2Node = booon("#main>.text>.t2")[0];
        t.equal(t2Node.innerHTML, "88");
        const hNode = booon("#main>.text>.h")[0];
        t.equal(hNode.innerHTML, adapt.html);
        const temp1Node = booon("#main>.text>.temp1")[0];
        t.equal(temp1Node.textContent, adapt.html + " tooth");
        const temp2Node = booon("#main>.text>.temp2")[0];
        t.equal(temp2Node.textContent, "4 times");
        booon.adapt({
            el: "#main2",
            data: { "t": "T", "html": "" },
            options: {
                startTag: "[[",
                endTag: "%%%"
            }
        });
        setTimeout(() => {
            const tagNode = booon("#main2>.tag")[0];
            t.equal(tagNode.textContent, "T");
        }, 300);
    }, 300);
});
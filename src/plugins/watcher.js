"use strict"; "use restrict";

var Fmt = Fmt || require("../fmt.js") || Fmt;
var Shaper = Shaper || require("../shaper.js") || Shaper;

Shaper("watcher", function(root) {
    var opStr = [];
    opStr[tkn.PLUS] = "+=";
    opStr[tkn.MINUS] = "-=";
    opStr[tkn.MUL] = "*=";
    opStr[tkn.DIV] = "/=";
    opStr[tkn.MOD] = "%=";
    opStr[tkn.BITWISE_AND] = "&=";
    opStr[tkn.BITWISE_OR] = "|=";
    opStr[tkn.BITWISE_XOR] = "^=";
    opStr[tkn.LSH] = "<<=";
    opStr[tkn.RSH] = ">>=";
    opStr[tkn.URSH] = ">>>=";

    Shaper.traverseTree(root, {pre: function(node, ref) {
        var op;
        var expr;
        var prop;
        var v;
        var call;
        if (node.type === tkn.INCREMENT || node.type === tkn.DECREMENT) {
            var c = node.children[0];
            op = node.type === tkn.INCREMENT ?
                (node.postfix ? "v++" : "++v") : (node.postfix ? "v--" : "--v");

            if (c.type === tkn.DOT) { // expr.id++
                expr = c.children[0];
                prop = c.children[1].value;
                call = Shaper.parseExpression(Fmt('Watch.set("{0}", $, "{1}")', op, prop));
                Shaper.replace(call, expr);
            }
            else if (c.type === tkn.INDEX) { // expr1[expr2]++
                expr = c.children[0];
                prop = c.children[1];
                call = Shaper.parseExpression(Fmt('Watch.set("{0}", $, String($))', op));
                Shaper.replace(call, expr, prop);
            }
            else {
                return;
            }
        }
        else if (node.type === tkn.ASSIGN) {
            var lvalue = node.children[0];
            v = node.children[1];
            op = opStr[node.assignOp] || "=";

            if (lvalue.type === tkn.DOT) { // expr.id += v
                expr = lvalue.children[0];
                prop = lvalue.children[1].value;
                call = Shaper.parseExpression(Fmt('Watch.set("{0}", $, "{1}", $)', op, prop));
                Shaper.replace(call, expr, v);
            }
            else if (lvalue.type === tkn.INDEX) { // expr1[expr2] += v
                expr = lvalue.children[0];
                prop = lvalue.children[1];
                call = Shaper.parseExpression(Fmt('Watch.set("{0}", $, String($), $)', op));
                Shaper.replace(call, expr, prop, v);
            }
            else {
                return;
            }
        }
        else {
            return;
        }
        ref.set(call);
        return call;
    }});
});

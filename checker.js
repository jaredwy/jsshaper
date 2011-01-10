"use strict";

load('jsecma5.js');
load('narcissus/lib/jsdefs.js');
load('narcissus/lib/jslex.js');
load('narcissus/lib/jsparse.js');

var tkn = Narcissus.definitions.tokenIds;

Array.isArray = Array.isArray || function(o) {
    return Object.prototype.toString.call(o) === '[object Array]';
};

function createTraverseData() {
    var o = [];

    o[tkn.FUNCTION] = ["body"];
    o[tkn.IF] = ["condition", "thenPart", "elsePart"];
    o[tkn.SWITCH] = ["discriminant", "cases"];
    o[tkn.CASE] = ["caseLabel", "statements"];
    o[tkn.DEFAULT] = ["statements"];
    o[tkn.FOR] = ["setup", "condition", "body", "update"];
    o[tkn.WHILE] = ["condition", "body"];
    o[tkn.FOR_IN] = ["varDecl", "iterator", "object", "body"];
    o[tkn.DO] = ["body", "condition"];
    o[tkn.TRY] = ["tryBlock", "catchClauses", "finallyBlock"];
    o[tkn.CATCH] = ["guard", "block"];
    o[tkn.THROW] = ["exception"];
    o[tkn.RETURN] = ["value"];
    o[tkn.WITH] = ["object", "body"];
    o[tkn.SEMICOLON] = ["expression"];
    o[tkn.LABEL] = ["statement"];
    o[tkn.IDENTIFIER] = ["initializer"];
    o[tkn.GETTER] = ["body"];
    o[tkn.SETTER] = ["body"];

    var c = [tkn.SCRIPT,
             tkn.BLOCK, tkn.VAR, tkn.CONST, tkn.COMMA, tkn.ASSIGN,
             tkn.HOOK, tkn.OR, tkn.AND, tkn.BITWISE_OR, tkn.BITWISE_XOR,
             tkn.BITWISE_AND, tkn.EQ, tkn.NE, tkn.STRICT_EQ, tkn.STRICT_NE,
             tkn.LT, tkn.LE, tkn.GE, tkn.GT, tkn.IN, tkn.INSTANCEOF,
             tkn.LSH, tkn.RSH, tkn.URSH, tkn.PLUS, tkn.MINUS, tkn.MUL,
             tkn.DIV, tkn.MOD, tkn.DELETE, tkn.VOID, tkn.TYPEOF,
             tkn.NOT, tkn.BITWISE_NOT, tkn.UNARY_PLUS, tkn.UNARY_MINUS,
             tkn.INCREMENT, tkn.DECREMENT, tkn.DOT, tkn.INDEX,
             tkn.LIST, tkn.CALL, tkn.NEW, tkn.NEW_WITH_ARGS, tkn.ARRAY_INIT,
             tkn.OBJECT_INIT, tkn.PROPERTY_INIT, tkn.GROUP];

    // add "children" to all tokens enumerated in c
    for (var i = 0; i < c.length; i++) {
        if (o[c[i]]) {
            o[c[i]].push("children");
        }
        else {
            o[c[i]] = ["children"];
        }
    }

    return o;
}

var traverseData = createTraverseData();

// visitfns: {pre: function, post: function}
// visit function signature: function(node, level, parent, parentProp)
function traverseAstDFS(node, visitfns, level, parent, parentProp) {
    if (!node) {
        return;
    }
    if (node instanceof Narcissus.parser.Node !== true) {
        throw new Error("traverseAstDFS expected Node, got "+ typeof node +
                       ". parentProp: "+ parentProp);
    }

    level = level || 0;
    var n;
    visitfns.pre && (n = visitfns.pre(node, level, parent, parentProp));
    if (n !== undefined) {
        node = n;
    }

    for (var prop in node) {
        if (!node.hasOwnProperty(prop)) {
            continue;
        }
        if (prop === "funDecls" || prop === "params" || prop === "varDecls" ||
            prop === "target") {
            continue;
        }
        if (node[prop] instanceof Narcissus.parser.Node) {
            traverseAstDFS(node[prop], visitfns, level + 1, node, prop);
        }
        else if (Array.isArray(node[prop])) {
            for (var j = 0, k = node[prop].length; j < k; j++) {
                traverseAstDFS(node[prop][j], visitfns, level + 1, node, prop + "[" + String(j) + "]");
            }
        }
    }

    visitfns.post && visitfns.post(node, level, parent, parentProp);
}

function traverseAstDFS_traverseData(node, visitfns, level, parent, parentProp) {
    if (!node) {
        return;
    }
    level = level || 0;
    var n;
    visitfns.pre && (n = visitfns.pre(node, level, parent, parentProp));
    if (n !== undefined) {
        node = n;
    }

    var subprops = traverseData[node.type];
    // temporary sanity-check
    if (Array.isArray(node.children) && node.children.length > 0 &&
        (!Array.isArray(subprops) || subprops[subprops.length - 1] !== "children")) {
        throw new Error("traverse error "+ tokenString(node.type) +
                        " has children property but not in subprops");
    }

    if (subprops) {
        for (var i = 0; i < subprops.length; i++) {
            var prop = subprops[i];
            if (Array.isArray(node[prop])) {
                for (var j = 0, k = node[prop].length; j < k; j++) {
                    traverseAstDFS(node[prop][j], visitfns, level + 1, node, prop + "[" + String(j) + "]");
                }
            }
            else {
                traverseAstDFS(node[prop], visitfns, level + 1, node, prop);
            }
        }
    }

    visitfns.post && visitfns.post(node, level, parent, parentProp);
}

function spaces(n, s) {
    var str = "";
    s = s || " ";
    for (var i = 0; i < n; i++) {
        str += s;
    }
    return str;
}
function tokenString(tt) {
    var defs = Narcissus.definitions;
    var t = defs.tokens[tt];
    return /^\W/.test(t) ? defs.opTypeNames[t] : t.toUpperCase();
}

function abbrev(str, max) {
    max = Math.max(Number(max) || 3, 3);
    if (str.length <= max) {
        return str;
    }
    var l = Math.ceil((max - 3) / 2);
    var r = Math.floor((max - 3) / 2);
    return str.slice(0, l) +"..."+ str.slice(str.length - r, str.length);
}

function nodeString(node) {
    function strPos(pos) {
        return pos === undefined ? "?" : String(pos);
    }
    var src = node.tokenizer.source;
    return tokenString(node.type) +
        ("start" in node && "end" in node ?
         " '"+ abbrev(src.slice(node.start, node.end), 30) +"'" :
         (node.value !== undefined ? " ("+ node.value +")" : "")) +
        ("start" in node || "end" in node ?
         " ("+ strPos(node.start) +".."+ strPos(node.end) +")" : "") +
        ("parenthesized" in node ? " parenthesized": "");
}

function printTree(root) {
    traverseAstDFS(root, {pre: function(node, level, parent, parentProp) {
        print(spaces(level * 2) + (parentProp || "root") +": "+
              nodeString(node));
    }});
}

function setParent(parent, parentProp, node) {
    if (parentProp[parentProp.length - 1] === "]") {
        var leftBracket = parentProp.indexOf("[");
        var index = parentProp.slice(leftBracket + 1,
                                     parentProp.length - 1);
        var base = parentProp.slice(0, leftBracket);
        parent[base][index] = node;
    }
    else {
        parent[parentProp] = node;
    }
}

function newNode(type, tokenizer, props) {
    var node = Object.create(Narcissus.parser.Node);
    node.tokenizer = tokenizer;
    node.type = type;
    node.children = [];

    if (props !== undefined) {
        for (var prop in props) {
            node[prop] = props[prop];
        }
    }
    //value, lineno, start, end
    return node;
}

function alterTree(root) {
    var tokenizer = root.tokenizer;
    function IDENTIFIER(name) {
        return newNode(tkn.IDENTIFIER, tokenizer, {value: name});
    }
    function LIST(children) {
        return newNode(tkn.LIST, tokenizer, {children: children});
    }
    function CALL(f, args) {
        return newNode(tkn.CALL, tokenizer, {
            children: [IDENTIFIER(f), LIST(args)]
        });
    }
    traverseAstDFS(root, {pre: function(node, level, parent, parentProp) {
        if (node.type === tkn.PLUS) {
            var call = CALL("__add", node.children);
            setParent(parent, parentProp, call);
            return call;
        }
    }});
}
function adjustStartEnd(root) {
    traverseAstDFS(root, {post: function(node, level, parent, parentProp) {
        if (parent) {
            parent.start = Math.min(parent.start, node.start);
            parent.end = Math.max(parent.end, node.end);
        }
    }});
    return root;
}

print("checker.js done");

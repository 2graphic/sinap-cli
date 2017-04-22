#!/usr/bin/env node

import { ArgumentParser } from "argparse";
import * as fs from "fs";
import { Parser } from "xml2js";
import { TypescriptPluginLoader } from "sinap-typescript";
import { Plugin, Model, getPluginInfo, ElementValue } from "sinap-core";
import { Value, Type } from "sinap-types";

class NodePromise<T> {
    readonly promise: Promise<T>;
    readonly cb: (err: any, obj: T) => void;
    private _resolve: (res: T) => void;
    private _reject: (err: any) => void;

    constructor() {
        this.promise = new Promise<T>((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });

        this.cb = (err, obj) => {
            if (err) this._reject(err);
            else this._resolve(obj);
        };
    }
}

const parser = new ArgumentParser({
    version: "0.0.1",
    addHelp: true,
    description: "The Sinap CLI tool."
});
const subparsers = parser.addSubparsers();
const interp = subparsers.addParser("interp", {
    addHelp: true
});

interp.addArgument(["plugin"], {
    help: "the plugin to use"
});

interp.addArgument(["source"], {
    help: "JFLAP document to read in"
});

interp.addArgument(["destination"], {
    help: "Sinap file to write out"
});

const args = interp.parseArgs();
const loader = new TypescriptPluginLoader();

getPluginInfo(args.plugin).then(info => {
    loader.load(info).then(plugin => {
        const name = plugin.pluginInfo.packageJson.name;
        const converter = convert[name];
        if (converter) {
            converter(plugin, args.source, args.destination).catch((err) => {
                console.log("Conversion failed:", err);
            });
        } else {
            console.log("don't know how to convert", name);
        }
    });
});


function awaitable<T, U>(func: (a: T, u: (err: any, obj: U) => void) => void, t: T) {
    const promise = new NodePromise<U>();
    func(t, promise.cb);
    return promise.promise;
}


type ElementAdder = (jElement: any, coreElement: ElementValue) => void;


const stringType = new Type.Primitive("string");
const numberType = new Type.Primitive("number");
const booleanType = new Type.Primitive("boolean");
const pointType = new Type.Record(new Map([["x", numberType], ["y", numberType]]));
const colorType = new Type.Primitive("color");
const widthType = new Type.Union([new Type.Literal("thin"), new Type.Literal("medium"), new Type.Literal("thick"), numberType]);

const convert: { [a: string]: undefined | ((plugin: Plugin, sourceFile: string, destFile: string) => Promise<void>) } = {
    ["turing-machine"]: (plugin: Plugin, sourceFile: string, destFile: string) => {
        const leftType = new Type.Literal("Left");
        const rightType = new Type.Literal("Right");
        const lrType = new Type.Union([leftType, rightType]);

        return convertInner(plugin, sourceFile, destFile, (jNode, coreNode) => {
            const accept = Boolean(jNode.final);
            const start = Boolean(jNode.initial);
            coreNode.set("isStartState", new Value.Primitive(booleanType, coreNode.environment, start));
            coreNode.set("isAcceptState", new Value.Primitive(booleanType, coreNode.environment, accept));
        }, (jEdge, coreEdge) => {
            const read = jEdge.read[0];
            const write = jEdge.write[0];
            const move = jEdge.move[0];
            coreEdge.set("read", new Value.Primitive(stringType, coreEdge.environment, read));
            coreEdge.set("write", new Value.Primitive(stringType, coreEdge.environment, write));
            const moveUnion = new Value.Union(lrType, coreEdge.environment);
            moveUnion.value = new Value.Literal(move[0] === "L" ? leftType : rightType, coreEdge.environment);
            coreEdge.set("move", moveUnion);
        });
    },
    ["dfa"]: (plugin: Plugin, sourceFile: string, destFile: string) => {
        return convertInner(plugin, sourceFile, destFile, (jNode, coreNode) => {
            const accept = Boolean(jNode.final);
            const start = Boolean(jNode.initial);
            coreNode.set("isStartState", new Value.Primitive(booleanType, coreNode.environment, start));
            coreNode.set("isAcceptState", new Value.Primitive(booleanType, coreNode.environment, accept));
        }, (jEdge, coreEdge) => {
            const read = jEdge.read[0];
            coreEdge.set("symbol", new Value.Primitive(stringType, coreEdge.environment, read));
        });
    },
    ["nfa"]: (plugin: Plugin, sourceFile: string, destFile: string) => {
        return convertInner(plugin, sourceFile, destFile, (jNode, coreNode) => {
            const accept = Boolean(jNode.final);
            const start = Boolean(jNode.initial);
            coreNode.set("isStartState", new Value.Primitive(booleanType, coreNode.environment, start));
            coreNode.set("isAcceptState", new Value.Primitive(booleanType, coreNode.environment, accept));
        }, (jEdge, coreEdge) => {
            const read = jEdge.read[0];
            coreEdge.set("symbol", new Value.Primitive(stringType, coreEdge.environment, read));
        });
    }
};

async function convertInner(plugin: Plugin, sourceFile: string, destFile: string, nodeConvert: ElementAdder, edgeConvert: ElementAdder) {
    const xmlParser = new Parser();
    const file = await awaitable(fs.readFile, sourceFile);
    const flap: any = await awaitable(xmlParser.parseString, file);

    const model = new Model(plugin);

    const jNodes = flap.structure.automaton[0].state;
    const jEdges = flap.structure.automaton[0].transition;

    const nodeMap = new Map<string, ElementValue>(
        jNodes.map((n: any) => {
            const x = Number(n.x[0]);
            const y = Number(n.y[0]);
            const label = n.$.name;
            const id = n.$.id;

            const position = new Value.Record(pointType, model.environment);
            position.value.x = new Value.Primitive(numberType, model.environment, x);
            position.value.y = new Value.Primitive(numberType, model.environment, y);

            const v = model.makeNode();
            v.set("label", new Value.Primitive(stringType, model.environment, label));
            v.set("position", position);
            v.set("borderColor", new Value.Primitive(colorType, model.environment, "#000000"));
            nodeConvert(n, v);

            return [id, v];
        })
    );

    for (const edge of jEdges) {
        const from = edge.from[0];
        const to = edge.to[0];
        const e = model.makeEdge(undefined, nodeMap.get(from)!, nodeMap.get(to)!);
        e.set("color", new Value.Primitive(colorType, model.environment, "#000000"));
        const widthUnion = new Value.Union(widthType, model.environment);
        widthUnion.value = new Value.Primitive(numberType, model.environment, 2);
        e.set("lineWidth", widthUnion);
        e.set("showDestinationArrow", new Value.Primitive(booleanType, model.environment, true));
        edgeConvert(edge, e);
    }

    fs.writeFile(destFile, JSON.stringify({
        kind: plugin.pluginInfo.pluginKind,
        graph: model.serialize()
    }, null, 4), (err) => {
        if (err) {
            throw err;
        }
    });
}



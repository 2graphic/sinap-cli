#!/usr/bin/env node

import { ArgumentParser } from "argparse";
import { getPluginInfo, Model, readFile } from "sinap-core";
import { Value, Type } from "sinap-types";
import { TypescriptPluginLoader } from "sinap-typescript-loader";

const parser = new ArgumentParser({
    version: "0.0.1",
    addHelp: true,
    description: "The Sinap CLI tool."
});

parser.addArgument(["plugin"], {
    help: "The directory of the plugin to use."
});
parser.addArgument(["graph"], {
    help: "The graph to interpret.",
});
parser.addArgument(["inputs"], {
    help: "The inputs to run with the graph.",
    nargs: "*"
});

const args = parser.parseArgs();

function sinapToS(toPrint: Value.Primitive): string {
    return JSON.stringify(toPrint.value);
}

async function main() {
    const graph: string = args.graph;
    const pluginInfo = await getPluginInfo(args.plugin);
    const loader = new TypescriptPluginLoader();
    const plugin = await loader.load(pluginInfo);

    const raw = JSON.parse(await readFile(graph));
    const model = Model.fromSerial(raw.graph, plugin);
    const program = await plugin.makeProgram(model);
    const validation = program.validate();

    async function runInput(input: string) {
        const realInput = model.environment.make(new Type.Primitive("string"));
        realInput.value = input;

        if (validation) {
            console.error(`Could not compile ${graph}: ${validation}`);
        } else {
            const result = await program.run([realInput]);
            const error = result.error;
            if (error) {
                console.error(`ERROR: ${sinapToS(error)}`);
            } else {
                console.log(sinapToS(result.result as Value.Primitive));
            }
        }
    }

    const inputs: string[] = args.inputs;
    for (const input of inputs) {
        await runInput(input);
    }
}

main();
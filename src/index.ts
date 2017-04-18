import { ArgumentParser } from "argparse";

const parser = new ArgumentParser({
    version: "0.0.1",
    addHelp: true,
    description: "The Sinap CLI tool."
});
const subparsers = parser.addSubparsers();
const interp = subparsers.addParser("interp", {
    addHelp: true
});
interp.addArgument(["graph"], {
    help: "Which graph to interpret."
});
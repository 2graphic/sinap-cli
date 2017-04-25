# sinap-cli

## Installing 

    $ npm install -g sinap-cli

## Example Usage:

    $ sinap-convert plugins/nfa somefile.jff somefile.sinap
    $ sinap-run plugins/nfa somefile.sinap 10111

### Convert Help:

    $ sinap-convert -h
    usage: sinap-convert interp [-h] plugin source destination
    
    Positional arguments:
      plugin       the plugin to use
      source       JFLAP document to read in
      destination  Sinap file to write out
    
    Optional arguments:
      -h, --help   Show this help message and exit.

### Run Help:

    $ sinap-run -h
    usage: sinap-run [-h] [-v] plugin graph [inputs [inputs ...]]
    
    The Sinap CLI tool.
    
    Positional arguments:
      plugin         The directory of the plugin to use.
      graph          The graph to interpret.
      inputs         The inputs to run with the graph.
    
    Optional arguments:
      -h, --help     Show this help message and exit.
      -v, --version  Show program's version number and exit.
      
## Building the tools:

    $ git clone https://github.com/2graphic/sinap-cli.git
    $ cd sinap-cli
    $ npm install
    $ npm run build
    $ node bin/convert.js ...
    $ node bin/interpret.js ...

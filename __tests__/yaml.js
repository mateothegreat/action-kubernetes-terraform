const YAML = require('yamljs');

console.log(YAML.parse(`
a:
    b: 1
    c: 2
d: e`))
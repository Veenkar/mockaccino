class Interpolator {
    private names: string[];
    private values: any[];

    constructor(params = {}) {
        this.names = Object.keys(params);
        this.values = Object.values(params);
    }

    interpolate(template: string): string {
        template = template.replace(/\\/g, '\\\\');
        return new Function(...this.names, `return \`${template}\`;`)(...this.values);
    }
}

// const interpolator = new Interpolator( {
//   name: 'World',
//   greeting: 'Hello',
// });
// const template = 'Example text: ${greeting} ${name}';
// const result = interpolator.interpolate(template);
// console.log(result);

if(typeof module == "object")
	module.exports = Interpolator;



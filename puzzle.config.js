// Puzzle app configuration (constellation/doc/DOC-DECISIONS.md D12/D26). Read by the compiler
// via node — the Go side never parses JS (D3). Declaring the Tailwind pipeline
// makes `puzzle build` / `puzzle dev` run the Tailwind CLI and fold its output
// into dist/styles.css ahead of the collected <styles> blocks.
export default {
	styles: {
		use: ['tailwindcss'],
	},
};

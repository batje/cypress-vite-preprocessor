exports['vite preprocessor - e2e correctly preprocesses the file 1'] = `
it("is a test", () => {
  const [a, b] = [1, 2];
  expect(a).to.equal(1);
  expect(b).to.equal(2);
  expect(Math.min(...[3, 4])).to.equal(3);
});
//# sourceMappingURL=example_spec_output.js.map
`

exports['vite preprocessor - e2e has less verbose syntax error 1'] = `
Unexpected token (1:18)
`

exports['vite preprocessor - e2e has less verbose "Module not found" error 1'] = `
Could not resolve './does/not-exist' from test/_test-output/imports_nonexistent_file_spec.js
`

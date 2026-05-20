const { RuleTester } = require("eslint");
const rule = require("../../lib/rules/no-unnecessary-use-client");

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
});

ruleTester.run("no-unnecessary-use-client", rule, {
  valid: [
    // No directive
    "export default function X() { return <div />; }",
    // Directive + hook
    "'use client'; import { useState } from 'react'; export default function X() { const [n] = useState(0); return <div>{n}</div>; }",
    // Directive + event handler
    "'use client'; export default function X() { return <button onClick={() => {}}>x</button>; }",
    // Directive + React.useState
    "'use client'; export default function X() { const [n] = React.useState(0); return <div>{n}</div>; }",
  ],
  invalid: [
    {
      code: "'use client'; export default function X() { return <div>hello</div>; }",
      errors: [{ messageId: "unnecessaryUseClient" }],
    },
    {
      code: "'use client'; export default function X({ name }) { return <div>{name}</div>; }",
      errors: [{ messageId: "unnecessaryUseClient" }],
    },
  ],
});

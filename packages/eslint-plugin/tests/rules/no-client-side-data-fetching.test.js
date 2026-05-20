const { RuleTester } = require("eslint");
const rule = require("../../lib/rules/no-client-side-data-fetching");

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
});

ruleTester.run("no-client-side-data-fetching", rule, {
  valid: [
    // fetch outside useEffect is fine
    "async function load() { return await fetch('/x'); }",
    // useEffect with no fetch is fine
    "import { useEffect } from 'react'; useEffect(() => { console.log('x'); }, []);",
    // useState only
    "import { useState } from 'react'; const [x, setX] = useState(0);",
  ],
  invalid: [
    {
      code: "useEffect(() => { fetch('/api/users'); }, []);",
      errors: [{ messageId: "noClientFetch" }],
    },
    {
      code: "useEffect(() => { axios.get('/api/users'); }, []);",
      errors: [{ messageId: "noClientFetch" }],
    },
    {
      code: "useEffect(async () => { const r = await fetch('/api/x'); }, []);",
      errors: [{ messageId: "noClientFetch" }],
    },
    {
      code: "useEffect(function () { axios('/x'); }, []);",
      errors: [{ messageId: "noClientFetch" }],
    },
  ],
});

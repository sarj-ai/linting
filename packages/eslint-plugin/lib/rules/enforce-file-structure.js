module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce consistent file structure: imports → types → constants → functions → exports",
      category: "Stylistic Issues",
      recommended: true,
    },
    schema: [],
    messages: {
      incorrectOrder: "File structure violation: {{current}} should come after {{expected}}",
      useServerDirective: "Server action files must start with 'use server' directive"
    }
  },
  create(context) {
    const filename = context.getFilename();
    const isServerAction = filename.includes('/actions/') || filename.includes('action');

    return {
      Program(node) {
        const body = node.body;
        let currentSection = 0; // 0: imports, 1: types, 2: constants, 3: functions, 4: exports
        const sections = ['imports', 'types', 'constants', 'functions', 'exports'];

        // Check for "use server" directive in server action files
        if (isServerAction) {
          const firstNode = body[0];
          if (!firstNode ||
              firstNode.type !== 'ExpressionStatement' ||
              firstNode.expression.type !== 'Literal' ||
              firstNode.expression.value !== 'use server') {
            context.report({
              node: node,
              messageId: "useServerDirective"
            });
          }
        }

        body.forEach(statement => {
          let statementSection = getStatementSection(statement);

          if (statementSection < currentSection) {
            context.report({
              node: statement,
              messageId: "incorrectOrder",
              data: {
                current: sections[statementSection],
                expected: sections[currentSection]
              }
            });
          } else {
            currentSection = Math.max(currentSection, statementSection);
          }
        });
      }
    };

    function getStatementSection(statement) {
      switch (statement.type) {
        case 'ImportDeclaration':
          return 0; // imports
        case 'TSTypeAliasDeclaration':
        case 'TSInterfaceDeclaration':
        case 'TSEnumDeclaration':
          return 1; // types
        case 'VariableDeclaration':
          // Check if it's a constant (const with UPPER_CASE or simple values)
          if (statement.kind === 'const') {
            const declarator = statement.declarations[0];
            if (declarator && declarator.id.name === declarator.id.name.toUpperCase()) {
              return 2; // constants
            }
          }
          return 3; // functions (const fn = ...)
        case 'FunctionDeclaration':
          return 3; // functions
        case 'ExportNamedDeclaration':
        case 'ExportDefaultDeclaration':
          return 4; // exports
        default:
          return 3; // default to functions
      }
    }
  }
};
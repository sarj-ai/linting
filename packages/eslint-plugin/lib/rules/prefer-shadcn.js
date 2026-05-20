/**
 * @fileoverview Prefer shadcn/ui components over native HTML elements
 * @description Use shadcn components for consistent design system
 */

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefer shadcn/ui components over native HTML elements",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
    messages: {
      preferShadcn:
        "Use shadcn <{{replacement}}> component from @/components/ui/{{lowercase}} instead of native <{{element}}>",
    },
  },
  create(context) {
    const replacements = {
      button: "Button",
      input: "Input",
      select: "Select",
      textarea: "Textarea",
      table: "Table",
      dialog: "Dialog",
    };

    return {
      JSXOpeningElement(node) {
        // Only check lowercase element names (native HTML)
        if (node.name.type !== "JSXIdentifier") {
          return;
        }

        const elementName = node.name.name;
        const replacement = replacements[elementName];

        if (replacement) {
          context.report({
            node,
            messageId: "preferShadcn",
            data: {
              element: elementName,
              replacement: replacement,
              lowercase: elementName,
            },
          });
        }
      },
    };
  },
};

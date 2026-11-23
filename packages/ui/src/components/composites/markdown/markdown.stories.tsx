import type { Story } from "@ladle/react";
import { Markdown } from "./markdown.js";

const SOURCE = `# Untrusted markdown

A [safe link](https://example.com), a [relative link](/docs) and a [script link](javascript:alert(1)).

- GFM lists
- \`inline code\`

\`\`\`ts
const x = 1
\`\`\`
`;

export const Default: Story = () => <Markdown source={SOURCE} />;

export const HttpsOnly: Story = () => (
  <Markdown source="[http](http://e.com) and [https](https://e.com)" allowedProtocols={["https"]} />
);

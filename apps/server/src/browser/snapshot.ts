import type CDP from 'chrome-remote-interface';

export interface ElementRef {
  ref: string;
  backendNodeId: number;
  role: string;
  name: string;
  properties: Record<string, string>;
}

export interface PageSnapshot {
  text: string;
  refs: Map<string, ElementRef>;
  url: string;
  title: string;
}

interface AXNode {
  nodeId: string;
  backendDOMNodeId?: number;
  role: { type: string; value: string };
  name?: { type: string; value: string };
  properties?: Array<{ name: string; value: { type: string; value: unknown } }>;
  childIds?: string[];
  ignored?: boolean;
}

export async function takeSnapshot(client: CDP.Client): Promise<PageSnapshot> {
  // Get the current URL and title
  const { result: urlResult } = await client.Runtime.evaluate({
    expression: 'document.location.href',
  });
  const { result: titleResult } = await client.Runtime.evaluate({
    expression: 'document.title',
  });

  const url = String(urlResult.value ?? '');
  const title = String(titleResult.value ?? '');

  // Get the full accessibility tree
  const { nodes } = await client.Accessibility.getFullAXTree();
  const axNodes = nodes as AXNode[];

  // Build node map for tree traversal
  const nodeMap = new Map<string, AXNode>();
  for (const node of axNodes) {
    nodeMap.set(node.nodeId, node);
  }

  // Assign refs to interactive elements
  const refs = new Map<string, ElementRef>();
  let refCounter = 0;

  const lines: string[] = [];

  function isInteractive(role: string): boolean {
    return [
      'link',
      'button',
      'textbox',
      'checkbox',
      'radio',
      'combobox',
      'menuitem',
      'tab',
      'switch',
      'slider',
      'spinbutton',
      'searchbox',
      'option',
    ].includes(role);
  }

  function renderNode(nodeId: string, depth: number): void {
    const node = nodeMap.get(nodeId);
    if (!node || node.ignored) return;

    const role = node.role.value;
    if (role === 'none' || role === 'generic') {
      // Skip non-semantic nodes but render children
      for (const childId of node.childIds ?? []) {
        renderNode(childId, depth);
      }
      return;
    }

    const name = node.name?.value ?? '';
    const indent = '  '.repeat(depth);

    // Extract useful properties
    const props: Record<string, string> = {};
    for (const prop of node.properties ?? []) {
      if (prop.name === 'url' || prop.name === 'value' || prop.name === 'checked') {
        props[prop.name] = String(prop.value.value);
      }
    }

    if (isInteractive(role) && node.backendDOMNodeId) {
      refCounter++;
      const ref = `@e${refCounter}`;
      refs.set(ref, {
        ref,
        backendNodeId: node.backendDOMNodeId,
        role,
        name,
        properties: props,
      });

      const propsStr = Object.entries(props)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      lines.push(`${indent}[${ref}] ${role} "${name}"${propsStr ? ` ${propsStr}` : ''}`);
    } else if (name) {
      lines.push(`${indent}[${role}] "${name}"`);
    }

    for (const childId of node.childIds ?? []) {
      renderNode(childId, depth + 1);
    }
  }

  // Find root node (usually first node)
  if (axNodes.length > 0 && axNodes[0]) {
    renderNode(axNodes[0].nodeId, 0);
  }

  return {
    text: lines.join('\n'),
    refs,
    url,
    title,
  };
}

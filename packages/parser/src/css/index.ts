import { walk } from 'svelte/compiler';
import * as csstree from 'css-tree';
import { camelCase } from 'lodash';
import { MitosisNode } from '@builder.io/mitosis';

import type { Style } from 'svelte/types/compiler/interfaces';

function bindTypeSelectorToNode(node: MitosisNode, block: string) {
  node.bindings.css = {
    code: block,
  };
}

function bindClassSelectorToNode(node: MitosisNode, block: string) {
  function appendToExisting(block: string) {
    return (
      node.bindings.css?.code.slice(0, Math.max(0, node.bindings.css?.code.length - 1)) +
      block.slice(1)
    );
  }

  node.bindings.css = {
    code: node.bindings.css?.code?.length ? appendToExisting(block) : block,
  };
}

function bindTypeSelector(children: MitosisNode[], selector: string, block: string) {
  for (const node of children) {
    if (node.name === selector) {
      bindTypeSelectorToNode(node, block);
    }

    if (node.children?.length) {
      bindTypeSelector(node.children, selector, block);
    }
  }
}

function bindClassSelector(children: MitosisNode[], selector: string, block: string) {
  for (const node of children) {
    if (node.properties?.class?.split(' ').includes(selector.slice(1))) {
      bindClassSelectorToNode(node, block);
    }

    if (node.children?.length) {
      bindClassSelector(node.children, selector, block);
    }
  }
}

function objectToString(object: any) {
  let string_ = '';

  for (const [p, value] of Object.entries(object)) {
    string_ = `${string_}${p}: "${value}",\n `;
  }

  return `{\n ${string_} \n}`;
}

export function parseCss(style: Style, json: SveltosisComponent) {
  walk(style, {
    enter(node: any, parent: any) {
      if (node.type === 'Rule') {
        const selector = csstree.generate(node.prelude);
        let block: any = {};

        csstree.walk(node.block, {
          enter(node: any) {
            if (node.type === 'Value') {
              const firstChildNode = node.children[0];
              block[camelCase(parent.property)] = node.children
                .map((c: any) => csstree.generate(c))
                .join(' ');
            }
            parent = node;
          },
        });

        block = objectToString(block);

        if (node.prelude.children[0]?.children[0]?.type === 'TypeSelector') {
          bindTypeSelector(json.children, selector, block);
        } else if (node.prelude.children[0]?.children[0]?.type === 'ClassSelector') {
          bindClassSelector(json.children, selector, block);
        }
        // todo: support .card > .input
        // todo: handle multiple blocks
      }
    },
  });
}

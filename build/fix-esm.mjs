#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import fs from 'fs/promises';

await fs.writeFile(
	new URL('../lib/esm/package.json', import.meta.url),
	JSON.stringify({ type: 'module' }, undefined, 2) + '\n'
);

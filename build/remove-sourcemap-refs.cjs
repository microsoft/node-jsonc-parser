/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const fs = require('fs');
const path = require('path');

function deleteRefs(dir) {
	const files = fs.readdirSync(dir);
	for (let file of files) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);
		if (stat.isDirectory()) {
			deleteRefs(filePath);
		} else if (path.extname(file) === '.js') {
			const content = fs.readFileSync(filePath, 'utf8');
			const newContent = content.replace(/\/\/\# sourceMappingURL=[^]+.js.map/, '')
			if (content.length !== newContent.length) {
				console.log('remove sourceMappingURL in ' + filePath);
				fs.writeFileSync(filePath, newContent);
			}
		} else if (path.extname(file) === '.map') {
			fs.unlinkSync(filePath)
			console.log('remove ' + filePath);
		}
	}
}

let location = path.join(__dirname, '..', 'lib');
console.log('process ' + location);
deleteRefs(location);